//! Private JSON workspace: optimistic concurrency for exported app data.
use crate::state::{atomic_json, nonempty_text, private_directory};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tomato_core::{Action, AppData, AppResult, Engine};

pub fn fingerprint(data: &AppData) -> AppResult<String> {
    Ok(hash(&serde_json::to_vec(data).map_err(|e| e.to_string())?))
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Origin {
    kind: String,
    base_hash: String,
    exported_at: i64,
}
fn filename(args: &Value) -> AppResult<String> {
    let name = nonempty_text(args, "name", 100)?;
    if !name.ends_with(".json")
        || name.starts_with('.')
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
    {
        return Err("文件名只能含字母、数字、点、下划线和短横线，且需以 .json 结尾".into());
    }
    Ok(name)
}
fn safe_path(dir: &Path, name: &str) -> AppResult<PathBuf> {
    let path = dir.join(name);
    if fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err("工作区不能读写符号链接".into());
    }
    Ok(path)
}
fn read(dir: &Path, args: &Value) -> AppResult<(String, Value, String)> {
    let name = filename(args)?;
    let path = safe_path(dir, &name)?;
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
        return Err("文件不能超过 20 MB".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let sha = hash(&bytes);
    let value = serde_json::from_slice(&bytes).map_err(|e| format!("JSON 无效：{e}"))?;
    Ok((name, value, sha))
}
pub fn export(
    dir: &Path,
    engine: &mut Engine,
    args: &Value,
    plan: bool,
    at: i64,
) -> AppResult<Value> {
    private_directory(dir)?;
    let name = filename(args)?;
    let data = engine.snapshot(at)?.data;
    let value = if plan {
        serde_json::to_value(data.export_plan())
    } else {
        serde_json::to_value(&data)
    }
    .map_err(|e| e.to_string())?;
    let path = safe_path(dir, &name)?;
    if path.exists() {
        return Err("文件已存在，请使用新文件名，避免覆盖未应用的方案".into());
    }
    atomic_json(&path, &value)?;
    atomic_json(
        &dir.join(format!("{name}.origin")),
        &Origin {
            kind: if plan { "plan" } else { "backup" }.into(),
            base_hash: fingerprint(&data)?,
            exported_at: at,
        },
    )?;
    let (_, _, sha) = read(dir, args)?;
    Ok(
        json!({"name":name,"fileHash":sha,"kind":if plan {"plan"} else {"backup"},"baseHash":fingerprint(&data)?,"bytes":fs::metadata(path).map_err(|e|e.to_string())?.len()}),
    )
}
pub fn read_file(dir: &Path, args: &Value) -> AppResult<Value> {
    let (name, value, sha) = read(dir, args)?;
    let pointer = args.get("pointer").and_then(Value::as_str).unwrap_or("");
    let content = value.pointer(pointer).ok_or("JSON Pointer 没有对应内容")?;
    if serde_json::to_vec(content)
        .map_err(|e| e.to_string())?
        .len()
        > 256 * 1024
    {
        return Err("内容过大，请使用 JSON Pointer 分段读取".into());
    }
    Ok(json!({"name":name,"fileHash":sha,"pointer":pointer,"content":content}))
}
pub fn download(dir: &Path, args: &Value) -> AppResult<Value> {
    let (name, value, sha) = read(dir, args)?;
    Ok(json!({"name":name,"content":value,"fileHash":sha}))
}
pub fn stage(dir: &Path, args: &Value) -> AppResult<Value> {
    let name = filename(args)?;
    let source = filename(&json!({"name":args["source"]}))?;
    let origin_name = filename(&json!({"name":args["originName"]}))?;
    let coding = dir.join("coding");
    if fs::symlink_metadata(&coding)
        .map_err(|e| e.to_string())?
        .file_type()
        .is_symlink()
    {
        return Err("coding 目录不能为符号链接".into());
    }
    let (_, value, _) = read(&coding, &json!({"name":source}))?;
    let origin_path = safe_path(dir, &format!("{origin_name}.origin"))?;
    let origin: Origin = serde_json::from_slice(&fs::read(origin_path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let target = safe_path(dir, &name)?;
    if target.exists() {
        return Err("候选文件已存在，请使用新名称".into());
    }
    atomic_json(&target, &value)?;
    atomic_json(&safe_path(dir, &format!("{name}.origin"))?, &origin)?;
    let (_, _, sha) = read(dir, args)?;
    Ok(json!({"name":name,"fileHash":sha,"kind":origin.kind,"baseHash":origin.base_hash}))
}
/// Apply a constrained RFC 6902 subset in memory and write only after every edit
/// succeeds. This keeps large backup editing out of model output/token budgets.
pub fn patch(dir: &Path, args: &Value) -> AppResult<Value> {
    let (name, mut value, sha) = read(dir, args)?;
    if args.get("fileHash").and_then(Value::as_str) != Some(&sha) {
        return Err("文件已变化，请重新读取后修改".into());
    }
    let edits = args
        .get("edits")
        .and_then(Value::as_array)
        .ok_or("缺少 edits 数组")?;
    if edits.is_empty() || edits.len() > 200 {
        return Err("每次需提供 1–200 项编辑".into());
    }
    for edit in edits {
        apply_edit(&mut value, edit)?;
    }
    let raw = serde_json::to_vec(&value).map_err(|e| e.to_string())?;
    if raw.len() > 20 * 1024 * 1024 {
        return Err("文件不能超过 20 MB".into());
    }
    atomic_json(&safe_path(dir, &name)?, &value)?;
    let (_, _, sha) = read(dir, args)?;
    Ok(json!({"name":name,"fileHash":sha,"edits":edits.len()}))
}
fn apply_edit(root: &mut Value, edit: &Value) -> AppResult<()> {
    let op = edit
        .get("op")
        .and_then(Value::as_str)
        .ok_or("缺少编辑类型")?;
    let path = edit
        .get("path")
        .and_then(Value::as_str)
        .ok_or("缺少 JSON Pointer")?;
    if op == "test" {
        if root.pointer(path) != edit.get("value") {
            return Err("JSON test 不匹配".into());
        }
        return Ok(());
    }
    if !["add", "replace", "remove"].contains(&op) || path.is_empty() || !path.starts_with('/') {
        return Err("仅允许 add/replace/remove/test，不能替换整个文件根节点".into());
    }
    let (parent, leaf) = path.rsplit_once('/').ok_or("无效 JSON Pointer")?;
    let key = leaf.replace("~1", "/").replace("~0", "~");
    let object = root
        .pointer_mut(parent)
        .ok_or("JSON Pointer 的父节点不存在")?;
    let value = edit.get("value");
    if op != "remove" && value.is_none() {
        return Err("编辑缺少 value".into());
    }
    match object {
        Value::Object(map) => {
            if op != "add" && !map.contains_key(&key) {
                return Err("编辑目标不存在".into());
            }
            if op == "remove" {
                map.remove(&key);
            } else {
                map.insert(key, value.unwrap().clone());
            }
        }
        Value::Array(array) => {
            let index = if key == "-" && op == "add" {
                array.len()
            } else {
                key.parse::<usize>().map_err(|_| "无效数组索引")?
            };
            if op == "add" && index <= array.len() {
                array.insert(index, value.unwrap().clone());
            } else if index < array.len() {
                if op == "remove" {
                    array.remove(index);
                } else {
                    array[index] = value.unwrap().clone();
                }
            } else {
                return Err("数组索引超出范围".into());
            }
        }
        _ => return Err("编辑父节点不是对象或数组".into()),
    }
    Ok(())
}
pub fn candidate(
    dir: &Path,
    engine: &mut Engine,
    args: &Value,
    at: i64,
) -> AppResult<(Action, Value)> {
    let (name, value, sha) = read(dir, args)?;
    let origin: Origin = serde_json::from_slice(
        &fs::read(safe_path(dir, &format!("{name}.origin"))?).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let current = engine.snapshot(at)?.data;
    if fingerprint(&current)? != origin.base_hash {
        return Err("软件数据已变化，请重新导出并将编辑重放到最新文件，避免覆盖新的进度".into());
    }
    if args.get("fileHash").and_then(Value::as_str) != Some(&sha) {
        return Err("文件已变化，请重新审阅最新内容".into());
    }
    let action = if origin.kind == "backup" {
        Action::Import {
            data: Box::new(serde_json::from_value(value).map_err(|e| e.to_string())?),
        }
    } else {
        Action::ImportPlan {
            plan: serde_json::from_value(value).map_err(|e| e.to_string())?,
        }
    };
    let serialized = serde_json::to_value(&action).map_err(|e| e.to_string())?;
    let after = engine.preview_action(
        serde_json::from_value(serialized).map_err(|e| e.to_string())?,
        at,
    )?;
    let differences = diff(
        &serde_json::to_value(&current).map_err(|e| e.to_string())?,
        &serde_json::to_value(&after).map_err(|e| e.to_string())?,
        "",
    );
    let info = json!({"name":name,"fileHash":sha,"kind":origin.kind,"valid":true,"changes":differences,"truncated":differences.len()>=100,"effects":if origin.kind=="backup" { "导入完整备份会暂停计时、清除当前锁机并停用导入的定时锁机规则；任务历史和不可逆裁定仍由核心校验。" } else { "按 ID 更新计划配置，保留完成进度、历史和裁定。" }});
    Ok((action, info))
}
fn diff(before: &Value, after: &Value, path: &str) -> Vec<Value> {
    if before == after {
        return vec![];
    }
    if let (Some(a), Some(b)) = (before.as_object(), after.as_object()) {
        let mut keys = a.keys().chain(b.keys()).collect::<Vec<_>>();
        keys.sort();
        keys.dedup();
        let mut out = vec![];
        for key in keys {
            out.extend(diff(
                a.get(key).unwrap_or(&Value::Null),
                b.get(key).unwrap_or(&Value::Null),
                &format!("{path}/{}", key.replace('~', "~0").replace('/', "~1")),
            ));
            if out.len() >= 100 {
                break;
            }
        }
        out.truncate(100);
        return out;
    }
    if let (Some(a), Some(b)) = (before.as_array(), after.as_array()) {
        let keyed = a.iter().chain(b).all(|v| v["id"].as_str().is_some());
        let mut out = vec![];
        if keyed {
            let mut ids = a
                .iter()
                .chain(b)
                .filter_map(|v| v["id"].as_str())
                .collect::<Vec<_>>();
            ids.sort();
            ids.dedup();
            for id in ids {
                out.extend(diff(
                    a.iter().find(|v| v["id"] == id).unwrap_or(&Value::Null),
                    b.iter().find(|v| v["id"] == id).unwrap_or(&Value::Null),
                    &format!("{path}/id={id}"),
                ));
                if out.len() >= 100 {
                    break;
                }
            }
            let old = a.iter().map(|v| &v["id"]).collect::<Vec<_>>();
            let new = b.iter().map(|v| &v["id"]).collect::<Vec<_>>();
            if old != new {
                out.push(json!({"path":format!("{path}/order"),"before":old,"after":new}));
            }
        } else {
            for i in 0..a.len().max(b.len()) {
                out.extend(diff(
                    a.get(i).unwrap_or(&Value::Null),
                    b.get(i).unwrap_or(&Value::Null),
                    &format!("{path}/{i}"),
                ));
                if out.len() >= 100 {
                    break;
                }
            }
        }
        out.truncate(100);
        return out;
    }
    vec![json!({"path":path,"before":before,"after":after})]
}
pub fn list(dir: &Path) -> AppResult<Value> {
    private_directory(dir)?;
    let mut files = vec![];
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_file()
            && entry.file_name().to_string_lossy().ends_with(".json")
        {
            let name = entry.file_name().to_string_lossy().to_string();
            let origin = dir.join(format!("{name}.origin"));
            files.push(json!({"name":name,"bytes":entry.metadata().map_err(|e|e.to_string())?.len(),"reviewable":origin.exists()}));
        }
    }
    files.sort_by_key(|v| v["name"].as_str().unwrap_or_default().to_string());
    Ok(json!(files))
}
