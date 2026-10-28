//! Upgrade the local v3 database once; exchanged files use only the current format.
use crate::{AppData, AppResult};
use serde_json::Value;

pub(crate) fn read_local(raw: &str) -> AppResult<AppData> {
    let mut value: Value = serde_json::from_str(raw).map_err(|e| e.to_string())?;
    if value["version"] == 3 {
        let today = crate::date_at(crate::now());
        let data = value.as_object_mut().ok_or("无效的本地数据")?;
        data.insert("version".into(), Value::from(4));
        for key in ["goals", "nodeBindings", "signalEvents"] {
            data.remove(key);
        }
        if let Some(tasks) = data.get_mut("tasks").and_then(Value::as_array_mut) {
            for task in tasks {
                upgrade_task(task, &today);
            }
        }
        if let Some(templates) = data.get_mut("templates").and_then(Value::as_array_mut) {
            for template in templates {
                if let Some(shape) = template["shape"].as_object_mut() {
                    shape.remove("goalId");
                }
                if template["printing"]["kind"] == "once" && template["printing"]["date"].is_null()
                {
                    template["printing"]["date"] = Value::from(today.clone());
                }
            }
        }
        if let Some(prints) = data.get_mut("prints").and_then(Value::as_array_mut) {
            // Undated ledger entries have no valid day; instances retain their history.
            prints.retain(|p| !p["date"].is_null());
        }
        if let Some(visions) = data.get_mut("visions").and_then(Value::as_array_mut) {
            for vision in visions {
                if let Some(vision) = vision.as_object_mut() {
                    vision.remove("goalId");
                }
            }
        }
        if let Some(ids) = data.get_mut("identities").and_then(Value::as_array_mut) {
            ids.retain(|r| !matches!(r["kind"].as_str(), Some("goal" | "node" | "signal")));
            for record in ids {
                if let Some(raw) = record["restoreTask"].as_str() {
                    let mut task: Value = serde_json::from_str(raw).map_err(|e| e.to_string())?;
                    upgrade_task(&mut task, &today);
                    // Undo compares the registered DTO serialization, including field order.
                    let task: crate::Task =
                        serde_json::from_value(task).map_err(|e| e.to_string())?;
                    record["restoreTask"] =
                        Value::from(serde_json::to_string(&task).map_err(|e| e.to_string())?);
                }
            }
        }
    }
    serde_json::from_value(value).map_err(|e| e.to_string())
}

fn upgrade_task(task: &mut Value, today: &str) {
    let date = task["createdAt"]
        .as_i64()
        .map(crate::date_at)
        .unwrap_or_else(|| today.into());
    if let Some(task) = task.as_object_mut() {
        task.remove("goalId");
        task.remove("nodeId");
        if task.get("dueDate").is_none_or(Value::is_null) {
            task.insert("dueDate".into(), Value::from(date));
        }
    }
}
