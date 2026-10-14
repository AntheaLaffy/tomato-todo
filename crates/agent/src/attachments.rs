use super::state::{atomic_json, nonempty_text, private_directory, Attachment};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tomato_core::AppResult;

fn root(dir: &Path) -> PathBuf {
    dir.join("workspace/attachments")
}
fn plain_directory(path: &Path) -> AppResult<()> {
    if fs::symlink_metadata(path).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err("附件目录不能是符号链接".into());
    }
    private_directory(path)
}
fn valid_name(name: &str) -> AppResult<()> {
    if name.is_empty()
        || name.chars().count() > 200
        || name == "."
        || name == ".."
        || name
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':'))
    {
        return Err("附件文件名无效".into());
    }
    Ok(())
}
fn valid_id(id: &str) -> AppResult<()> {
    if uuid::Uuid::parse_str(id).is_err() {
        return Err("附件 ID 无效".into());
    }
    Ok(())
}
pub fn upload(dir: &Path, args: &Value) -> AppResult<Attachment> {
    let name = nonempty_text(args, "name", 200)?;
    valid_name(&name)?;
    let data = args["data"].as_str().ok_or("附件缺少数据")?;
    if data.len() > 12 * 1024 * 1024 {
        return Err("单个附件最多 8 MB".into());
    }
    let bytes = STANDARD.decode(data).map_err(|_| "附件 Base64 无效")?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("单个附件最多 8 MB".into());
    }
    let mime = args["mimeType"]
        .as_str()
        .unwrap_or("application/octet-stream");
    if mime.len() > 100 || mime.chars().any(char::is_control) {
        return Err("附件类型无效".into());
    }
    if mime.starts_with("image/") {
        super::validated_images(&json!([{"type":"image","mimeType":mime,"data":data}]))?;
    }
    let attachment = Attachment {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        mime_type: mime.into(),
        bytes: bytes.len(),
    };
    let root = root(dir);
    plain_directory(&root)?;
    let folder = root.join(&attachment.id);
    plain_directory(&folder)?;
    let file = folder.join(&attachment.name);
    fs::write(&file, bytes).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&file, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    }
    atomic_json(&root.join(format!("{}.json", attachment.id)), &attachment)?;
    Ok(attachment)
}
pub fn load(dir: &Path, id: &str) -> AppResult<(Attachment, Vec<u8>)> {
    valid_id(id)?;
    let root = root(dir);
    plain_directory(&root)?;
    let meta = root.join(format!("{id}.json"));
    let stat = fs::symlink_metadata(&meta).map_err(|_| "附件不存在")?;
    if !stat.is_file() || stat.len() > 4096 {
        return Err("附件元数据无效".into());
    }
    let attachment: Attachment =
        serde_json::from_slice(&fs::read(&meta).map_err(|e| e.to_string())?)
            .map_err(|_| "附件元数据损坏")?;
    if attachment.id != id {
        return Err("附件 ID 不匹配".into());
    }
    valid_name(&attachment.name)?;
    let folder = root.join(id);
    plain_directory(&folder)?;
    let file = folder.join(&attachment.name);
    let stat = fs::symlink_metadata(&file).map_err(|_| "附件文件不存在")?;
    if !stat.is_file() || stat.len() > 8 * 1024 * 1024 || stat.len() as usize != attachment.bytes {
        return Err("附件文件已变化".into());
    }
    let bytes = fs::read(&file).map_err(|e| e.to_string())?;
    Ok((attachment, bytes))
}
pub fn for_prompt(dir: &Path, ids: &Value) -> AppResult<(Vec<Attachment>, Vec<Value>)> {
    if ids.is_null() {
        return Ok((vec![], vec![]));
    }
    let ids = ids.as_array().ok_or("附件 ID 应为数组")?;
    if ids.len() > 10 {
        return Err("每条消息最多 10 个附件".into());
    }
    let mut attachments = Vec::new();
    let mut images = Vec::new();
    let mut total = 0;
    for id in ids {
        let id = id.as_str().ok_or("附件 ID 无效")?;
        if attachments.iter().any(|a: &Attachment| a.id == id) {
            return Err("附件不能重复".into());
        }
        let (attachment, bytes) = load(dir, id)?;
        total += bytes.len();
        if total > 20 * 1024 * 1024 {
            return Err("每条消息的附件合计最多 20 MB".into());
        }
        if attachment.mime_type.starts_with("image/") {
            images.push(json!({"type":"image","mimeType":attachment.mime_type,"data":STANDARD.encode(bytes)}));
        }
        attachments.push(attachment);
    }
    super::validated_images(&json!(images))?;
    Ok((attachments, images))
}
pub fn download(dir: &Path, id: &str) -> AppResult<Value> {
    let (attachment, bytes) = load(dir, id)?;
    Ok(json!({"attachment":attachment,"data":STANDARD.encode(bytes)}))
}
