//! Registered resources resolve through local grants; large exports never cross JSON IPC.
use super::Agent;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};
use std::{fs, io::Read, path::PathBuf, sync::Arc};
use tomato_core::{education::Resource, AppResult};

pub struct ResourceFile {
    pub path: PathBuf,
    pub name: String,
    pub mime_type: &'static str,
    pub size_bytes: u64,
}
const PREVIEW_BYTES: u64 = 20 * 1024 * 1024;
fn mime(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "txt" | "log" | "md" | "markdown" | "csv" | "json" => "text/plain",
        _ => "application/octet-stream",
    }
}
impl Agent {
    fn resource(&self, id: &str) -> AppResult<Resource> {
        self.engine
            .lock()
            .map_err(|e| e.to_string())?
            .snapshot(tomato_core::now())?
            .data
            .education
            .resources
            .into_iter()
            .find(|r| r.id == id)
            .ok_or_else(|| "项目资源不存在".into())
    }
    /// Host-only file handle metadata; callers must not accept paths from the webview.
    pub fn project_resource_file(&self, id: &str) -> AppResult<ResourceFile> {
        let resource = self.resource(id)?;
        let path = self.project_path(&resource.project_id, &resource.path)?;
        let metadata = fs::metadata(&path).map_err(|e| format!("资料文件不可用：{e}"))?;
        if !metadata.is_file() {
            return Err("项目资源不是普通文件".into());
        }
        let name = path
            .file_name()
            .and_then(|v| v.to_str())
            .filter(|v| !v.is_empty() && !v.chars().any(char::is_control))
            .ok_or("资源文件名无效")?
            .to_string();
        Ok(ResourceFile {
            mime_type: mime(&path),
            path,
            name,
            size_bytes: metadata.len(),
        })
    }
    /// Copy through a sibling temporary file so a failed export cannot truncate the source
    /// or an existing destination (including a hard link to the source).
    pub fn copy_project_resource(&self, id: &str, target: &std::path::Path) -> AppResult<u64> {
        let file = self.project_resource_file(id)?;
        if fs::canonicalize(target).is_ok_and(|path| path == file.path) {
            return Err("保存位置与原件相同，请选择其他文件名或目录".into());
        }
        let mut source = fs::File::open(file.path).map_err(|e| e.to_string())?;
        let parent = target.parent().ok_or("保存目录无效")?;
        let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        let count = std::io::copy(&mut source, &mut temporary).map_err(|e| e.to_string())?;
        temporary.as_file().sync_all().map_err(|e| e.to_string())?;
        temporary.persist(target).map_err(|e| e.to_string())?;
        Ok(count)
    }
    pub(crate) fn resource_info(&self, args: &Value) -> AppResult<Value> {
        let file = self.project_resource_file(args["resourceId"].as_str().ok_or("缺少资源 ID")?)?;
        Ok(
            json!({"name":file.name,"mimeType":file.mime_type,"sizeBytes":file.size_bytes,
            "canPreview":file.size_bytes <= PREVIEW_BYTES && file.mime_type != "application/octet-stream"}),
        )
    }
    pub(crate) fn preview_resource(&self, args: &Value) -> AppResult<Value> {
        let file = self.project_resource_file(args["resourceId"].as_str().ok_or("缺少资源 ID")?)?;
        if file.size_bytes > PREVIEW_BYTES {
            return Err("文件较大，请下载原件或用系统应用打开；原件下载不设大小上限".into());
        }
        if file.mime_type == "application/octet-stream" {
            return Err("此格式请下载原件或用系统应用打开".into());
        }
        let mut bytes = Vec::new();
        fs::File::open(&file.path)
            .map_err(|e| e.to_string())?
            .take(PREVIEW_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() as u64 > PREVIEW_BYTES {
            return Err("文件已增大，请下载原件或用系统应用打开".into());
        }
        Ok(json!({"name":file.name,"mimeType":file.mime_type,"data":STANDARD.encode(bytes)}))
    }
    pub(crate) fn repair_resource(self: &Arc<Self>, args: &Value) -> AppResult<Value> {
        let mut resource = self.resource(args["resourceId"].as_str().ok_or("缺少资源 ID")?)?;
        resource.path = args["path"]
            .as_str()
            .ok_or("请输入项目内的相对路径")?
            .into();
        self.register_resource(resource)
    }
    pub(crate) fn clean_missing_resources(self: &Arc<Self>, args: &Value) -> AppResult<Value> {
        let ids = args["ids"].as_array().ok_or("请选择要清理的登记")?;
        let education = self
            .engine
            .lock()
            .map_err(|e| e.to_string())?
            .snapshot(tomato_core::now())?
            .data
            .education;
        let resources = education
            .resources
            .iter()
            .map(|r| (r.id.as_str(), r))
            .collect::<std::collections::HashMap<_, _>>();
        let mounts = self.project_mounts()?;
        for id in ids {
            let resource = resources
                .get(id.as_str().ok_or("资源 ID 无效")?)
                .ok_or("项目资源不存在")?;
            let root = mounts
                .as_array()
                .and_then(|ms| ms.iter().find(|m| m["projectId"] == resource.project_id))
                .and_then(|m| m["directory"].as_str())
                .ok_or("项目目录尚未授权或已失联，请重新授权")?;
            let path = super::projects::resolve_path(std::path::Path::new(root), &resource.path)?;
            match fs::metadata(path) {
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                _ => return Err("文件状态已变化，请重新检查后再清理".into()),
            }
        }
        serde_json::to_value((self.apply)(
            tomato_core::Action::Education {
                command: tomato_core::education::Command::RemoveResources {
                    ids: ids
                        .iter()
                        .map(|id| id.as_str().unwrap().to_string())
                        .collect(),
                },
            },
            None,
        )?)
        .map_err(|e| e.to_string())
    }
    pub(crate) fn scan_resources(&self, args: &Value) -> AppResult<Value> {
        let id = args["projectId"].as_str().ok_or("缺少项目 ID")?;
        let education = self
            .engine
            .lock()
            .map_err(|e| e.to_string())?
            .snapshot(tomato_core::now())?
            .data
            .education;
        if !education.projects.iter().any(|p| p.project_id == id) {
            return Err("项目不存在".into());
        }
        let mounts = self.project_mounts()?;
        let root = mounts
            .as_array()
            .and_then(|ms| ms.iter().find(|m| m["projectId"] == id))
            .and_then(|m| m["directory"].as_str())
            .map(PathBuf::from);
        let references = education.resource_reference_index();
        let entries = education.resources.iter().filter(|r| r.project_id == id).map(|r| {
            let checked = root.as_ref().ok_or_else(|| "项目目录尚未授权或已失联，请重新授权".to_string())
                .and_then(|root| super::projects::resolve_path(root, &r.path));
            let (state, size, detail) = match checked {
                Err(e) => ("unavailable", None, e),
                Ok(path) => match fs::metadata(path) {
                    Ok(m) if m.is_file() => ("available", Some(m.len()), String::new()),
                    Ok(_) => ("unavailable", None, "登记路径不是普通文件".into()),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => ("missing", None, "文件不存在，可修复路径".into()),
                    Err(e) => ("unavailable", None, e.to_string()),
                },
            };
            json!({"id":r.id,"state":state,"sizeBytes":size,"detail":detail,"references":references.get(r.id.as_str()).cloned().unwrap_or_default()})
        }).collect::<Vec<_>>();
        Ok(json!({"projectId":id,"checkedAt":tomato_core::now(),"resources":entries}))
    }
}
