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
        if !profile.directory.is_empty()
            && Path::new(&profile.directory) != directory
            && snapshot
                .data
                .education
                .resources
                .iter()
                .any(|r| r.project_id == project_id)
        {
            return Err("项目已有资料；请先在磁盘迁移资料到新目录，再使用相同项目重新授权；当前版本请保留原绑定以免断开引用".into());
        }
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
    fn project_path(&self, project_id: &str, path: &str) -> AppResult<PathBuf> {
        let mounts = self.project_mounts()?;
        let directory = mounts
            .as_array()
            .and_then(|ms| ms.iter().find(|m| m["projectId"] == project_id))
            .and_then(|m| m["directory"].as_str())
            .ok_or("项目目录尚未由用户授权，或目录已失联")?;
        let relative = Path::new(path);
        if relative.is_absolute()
            || relative
                .components()
                .any(|p| !matches!(p, Component::Normal(_)))
        {
            return Err("资料路径必须是安全的项目相对路径".into());
        }
        let root = Path::new(directory);
        let mut target = root.to_path_buf();
        for component in relative.components() {
            target.push(component);
            if fs::symlink_metadata(&target).is_ok_and(|m| m.file_type().is_symlink()) {
                return Err("项目资料不能通过符号链接跳转".into());
            }
        }
        Ok(target)
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
