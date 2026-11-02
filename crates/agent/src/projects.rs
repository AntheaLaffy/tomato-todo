//! Local grants are separate from exchanged data: a backup cannot authorize a host directory.
use super::{state::atomic_json, Agent};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    sync::Arc,
};
use tomato_core::{
    education::{Command, ProjectStudy, Resource, ResourceKind},
    Action, AppResult,
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Grant {
    project_id: String,
    directory: PathBuf,
}
impl Agent {
    fn grants(&self) -> AppResult<Vec<Grant>> {
        let file = self.dir.join("project-grants.json");
        if !file.exists() {
            return Ok(vec![]);
        }
        serde_json::from_slice(&fs::read(file).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())
    }
    pub(crate) fn project_mounts(&self) -> AppResult<Value> {
        let data = self
            .engine
            .lock()
            .map_err(|e| e.to_string())?
            .snapshot(tomato_core::now())?
            .data;
        let grants = self.grants()?;
        Ok(json!(grants
            .into_iter()
            .filter(|g| data
                .education
                .projects
                .iter()
                .any(|p| p.project_id == g.project_id && Path::new(&p.directory) == g.directory)
                && g.directory.is_dir()
                && fs::canonicalize(&g.directory).is_ok_and(|p| p == g.directory))
            .collect::<Vec<_>>()))
    }
    pub(crate) fn rename_project_directory(self: &Arc<Self>, args: &Value) -> AppResult<Value> {
        let _workspace = self.workspace_lock.lock().map_err(|e| e.to_string())?;
        if self.inner.lock().map_err(|e| e.to_string())?.live.busy {
            return Err("请先停止助手，再重命名项目资料目录".into());
        }
        let id = args["projectId"].as_str().ok_or("缺少项目 ID")?;
        let name = args["name"].as_str().ok_or("缺少项目名称")?.trim();
        let color = args["color"].as_str().ok_or("缺少项目颜色")?;
        if name.is_empty()
            || name.chars().count() > 40
            || name == "."
            || name == ".."
            || name.ends_with([' ', '.'])
            || name
                .chars()
                .any(|c| c.is_control() || "/\\<>:\"|?*".contains(c))
            || matches!(
                name.split('.')
                    .next()
                    .unwrap_or("")
                    .to_ascii_uppercase()
                    .as_str(),
                "CON"
                    | "PRN"
                    | "AUX"
                    | "NUL"
                    | "COM1"
                    | "COM2"
                    | "COM3"
                    | "COM4"
                    | "COM5"
                    | "COM6"
                    | "COM7"
                    | "COM8"
                    | "COM9"
                    | "LPT1"
                    | "LPT2"
                    | "LPT3"
                    | "LPT4"
                    | "LPT5"
                    | "LPT6"
                    | "LPT7"
                    | "LPT8"
                    | "LPT9"
            )
        {
            return Err("项目名称不能作为安全的文件夹名称".into());
        }
        let snapshot = self
            .engine
            .lock()
            .map_err(|e| e.to_string())?
            .snapshot(tomato_core::now())?;
        let project = snapshot
            .data
            .projects
            .iter()
            .find(|p| p.id == id)
            .ok_or("项目不存在")?;
        if name == project.name {
            return serde_json::to_value((self.apply)(
                Action::SaveProject {
                    id: Some(id.into()),
                    name: name.into(),
                    color: color.into(),
                    directory: None,
                },
                None,
            )?)
            .map_err(|e| e.to_string());
        }
        let profile = snapshot
            .data
            .education
            .projects
            .iter()
            .find(|p| p.project_id == id)
            .ok_or("项目没有绑定资料目录")?;
        let mut grants = self.grants()?;
        let grant_index = grants
            .iter()
            .position(|g| g.project_id == id)
            .ok_or("项目资料目录未授权，请先在项目页重新授权")?;
        let old = grants[grant_index].directory.clone();
        if Path::new(&profile.directory) != old
            || !old.is_dir()
            || fs::canonicalize(&old).map_err(|e| e.to_string())? != old
        {
            return Err("项目资料目录已失联，请先重新授权现有资料目录".into());
        }
        let parent = old.parent().ok_or("资料目录没有父目录")?;
        let target = parent.join(name);
        if target != old && fs::symlink_metadata(&target).is_ok() {
            return Err("目标资料目录已经存在，不会覆盖；请换一个项目名称".into());
        }
        let action = || Action::RenameProjectDirectory {
            id: id.into(),
            name: name.into(),
            color: color.into(),
            directory: target.to_string_lossy().into_owned(),
        };
        self.engine
            .lock()
            .map_err(|e| e.to_string())?
            .preview_action(action(), tomato_core::now())?;
        if target != old {
            fs::rename(&old, &target).map_err(|e| format!("重命名资料目录失败：{e}"))?;
        }
        grants[grant_index].directory = target.clone();
        let grants_file = self.dir.join("project-grants.json");
        if let Err(e) = atomic_json(&grants_file, &grants) {
            if target != old {
                fs::rename(&target, &old).map_err(|rollback| {
                    format!(
                        "授权保存失败：{e}；目录回退失败：{rollback}，资料仍在 {}",
                        target.display()
                    )
                })?;
            }
            return Err(format!("授权保存失败，目录已回退：{e}"));
        }
        match (self.apply)(action(), None) {
            Ok(snapshot) => serde_json::to_value(snapshot).map_err(|e| e.to_string()),
            Err(e) => {
                grants[grant_index].directory = old.clone();
                let grant_error = atomic_json(&grants_file, &grants).err();
                let directory_error = if target != old {
                    fs::rename(&target, &old).err()
                } else {
                    None
                };
                if grant_error.is_some() || directory_error.is_some() {
                    return Err(format!("项目保存失败：{e}；回退不完整：授权 {grant_error:?}，目录 {directory_error:?}；资料位于 {}，请重新授权，不要重新导入", if directory_error.is_some() { target.display() } else { old.display() }));
                }
                Err(format!("项目保存失败，目录及授权已回退：{e}"))
            }
        }
    }
    /// Only called by the user's settings request, never registered as an AI tool.
    pub(crate) fn authorize_project(self: &Arc<Self>, args: &Value) -> AppResult<Value> {
        let _lock = self.workspace_lock.lock().map_err(|e| e.to_string())?;
        if self.inner.lock().map_err(|e| e.to_string())?.live.busy {
            return Err("请先停止助手，再修改项目目录授权".into());
        }
        let requested = Path::new(args["directory"].as_str().ok_or("请选择项目资料目录")?);
        if !requested.is_absolute() || !requested.is_dir() {
            return Err("请选择已存在的绝对目录".into());
        }
        let directory = fs::canonicalize(requested).map_err(|e| e.to_string())?;
        let internal = fs::canonicalize(&self.dir).map_err(|e| e.to_string())?;
        if directory.parent().is_none()
            || internal.starts_with(&directory)
            || directory.starts_with(&internal)
            || std::env::var_os("HOME").is_some_and(|h| h == directory.as_os_str())
        {
            return Err("请选择专用资料目录，不能授权根目录、整个主目录或应用内部目录".into());
        }
        let mut grants = self.grants()?;
        let existing = args["projectId"].as_str();
        if grants.iter().any(|g| {
            Some(g.project_id.as_str()) != existing
                && (directory.starts_with(&g.directory) || g.directory.starts_with(&directory))
        }) {
            return Err("不同项目的授权目录不能重叠".into());
        }
        let mut snapshot = self
            .engine
            .lock()
            .map_err(|e| e.to_string())?
            .snapshot(tomato_core::now())?;
        let project_id = if let Some(id) = existing {
            if !snapshot.data.projects.iter().any(|p| p.id == id) {
                return Err("项目不存在".into());
            }
            id.to_string()
        } else {
            let before = snapshot
                .data
                .projects
                .iter()
                .map(|p| p.id.clone())
                .collect::<Vec<_>>();
            snapshot = (self.apply)(
                Action::SaveProject {
                    id: None,
                    directory: Some(directory.to_string_lossy().into()),
                    name: args["name"].as_str().unwrap_or("未分类").into(),
                    color: args["color"].as_str().unwrap_or("#849b7d").into(),
                },
                None,
            )?;
            snapshot
                .data
                .projects
                .iter()
                .find(|p| !before.contains(&p.id))
                .ok_or("项目创建失败")?
                .id
                .clone()
        };
        let mut profile = snapshot
            .data
            .education
            .projects
            .iter()
            .find(|p| p.project_id == project_id)
            .cloned()
            .unwrap_or(ProjectStudy {
                project_id: project_id.clone(),
                directory: String::new(),
                exam_mode: false,
                vision_id: None,
                target: String::new(),
                exam_date: None,
                syllabus_id: None,
                past_paper_ids: vec![],
                mock_paper_ids: vec![],
            });
        // Explicit directory selection also repairs a moved project root; resource IDs
        // and relative paths stay intact, and the next scan reports any missing files.
        profile.directory = directory.to_string_lossy().into();
        snapshot = (self.apply)(
            Action::Education {
                command: Command::SaveProject { project: profile },
            },
            None,
        )?;
        grants.retain(|g| g.project_id != project_id);
        grants.push(Grant {
            project_id,
            directory,
        });
        atomic_json(&self.dir.join("project-grants.json"), &grants)?;
        Ok(json!(snapshot))
    }
    pub(crate) fn project_path(&self, project_id: &str, path: &str) -> AppResult<PathBuf> {
        let mounts = self.project_mounts()?;
        let directory = mounts
            .as_array()
            .and_then(|ms| ms.iter().find(|m| m["projectId"] == project_id))
            .and_then(|m| m["directory"].as_str())
            .ok_or("项目目录尚未由用户授权，或目录已失联")?;
        resolve_path(Path::new(directory), path)
    }
    pub(crate) fn register_resource(self: &Arc<Self>, resource: Resource) -> AppResult<Value> {
        let path = self.project_path(&resource.project_id, &resource.path)?;
        if !path.is_file() {
            return Err("资源文件不存在；请先导入或在授权项目目录保存文件".into());
        }
        serde_json::to_value((self.apply)(
            Action::Education {
                command: Command::SaveResource { resource },
            },
            None,
        )?)
        .map_err(|e| e.to_string())
    }
    pub(crate) fn upload_project_attachment(self: &Arc<Self>, args: &Value) -> AppResult<Value> {
        let _lock = self.workspace_lock.lock().map_err(|e| e.to_string())?;
        let mounts = self.project_mounts()?;
        let project_id = args["projectId"]
            .as_str()
            .or_else(|| mounts.as_array()?.first()?["projectId"].as_str())
            .ok_or("上传资料前，请先给项目（也可以是未分类项目）绑定资料目录")?
            .to_string();
        // Check authorization before saving the delivery copy.
        self.project_path(&project_id, "attachments")?;
        let attachment = super::attachments::upload(&self.dir, args)?;
        let (_, bytes) = super::attachments::load(&self.dir, &attachment.id)?;
        let relative = format!("attachments/{}/{}", attachment.id, attachment.name);
        let target = self.project_path(&project_id, &relative)?;
        fs::create_dir_all(target.parent().ok_or("无效的资料目录")?).map_err(|e| e.to_string())?;
        fs::write(&target, bytes).map_err(|e| e.to_string())?;
        let resource = Resource {
            id: attachment.id.clone(),
            project_id,
            title: attachment.name.clone(),
            kind: ResourceKind::Attachment,
            path: relative,
            source: "聊天上传".into(),
            edition: String::new(),
            topics: vec![],
        };
        (self.apply)(
            Action::Education {
                command: Command::SaveResource { resource },
            },
            None,
        )?;
        serde_json::to_value(attachment).map_err(|e| e.to_string())
    }
}
pub(crate) fn resolve_path(root: &Path, path: &str) -> AppResult<PathBuf> {
    let relative = Path::new(path);
    if path.is_empty()
        || path.contains('\\')
        || relative.is_absolute()
        || relative
            .components()
            .any(|p| !matches!(p, Component::Normal(_)))
    {
        return Err("资料路径必须是安全的项目相对路径".into());
    }
    let mut target = root.to_path_buf();
    for component in relative.components() {
        target.push(component);
        if fs::symlink_metadata(&target).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err("项目资料不能通过符号链接跳转".into());
        }
    }
    Ok(target)
}
