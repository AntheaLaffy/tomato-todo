//! Entity identities remain reserved after deletion; undo restores the same task.
use crate::{AppData, AppResult, Task};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Identity {
    pub id: String,
    pub kind: String,
    pub retired: bool,
    #[serde(default)]
    pub restore_task: Option<String>,
}
fn active(data: &AppData) -> AppResult<HashMap<String, String>> {
    let mut ids = HashMap::new();
    let mut add = |id: &str, kind: &str| -> AppResult<()> {
        if id.trim().is_empty() || id.len() > 200 || ids.insert(id.into(), kind.into()).is_some() {
            return Err("独立实体 ID 为空、过长或重复（节点 ID 在不同任务组间也必须唯一）".into());
        }
        Ok(())
    };
    for x in &data.projects {
        add(&x.id, "project")?;
    }
    for x in &data.goals {
        add(&x.id, "goal")?;
        for n in &x.nodes {
            add(&n.spec.id, "node")?;
        }
    }
    for x in &data.habits {
        add(&x.id, "habit")?;
    }
    for x in &data.visions {
        add(&x.id, "vision")?;
    }
    for x in &data.tasks {
        add(&x.id, "task")?;
    }
    for x in &data.templates {
        add(&x.id, "template")?;
    }
    for x in &data.sessions {
        add(&x.id, "session")?;
    }
    for x in &data.signal_events {
        add(&x.id, "signal")?;
    }
    Ok(ids)
}
pub(crate) fn reconcile(
    before: &AppData,
    after: &mut AppData,
    restore_id: Option<&str>,
) -> AppResult<()> {
    let old_active = active(before)?;
    let new_active = active(after)?;
    let mut entries = HashMap::new();
    for record in before.identities.iter().chain(after.identities.iter()) {
        if let Some(old) = entries.get_mut(&record.id) {
            let old: &mut Identity = old;
            if old.kind != record.kind {
                return Err("历史 ID 不能转用于另一种实体".into());
            }
            old.retired |= record.retired;
            if old.restore_task.is_none() {
                old.restore_task = record.restore_task.clone();
            }
        } else {
            entries.insert(record.id.clone(), record.clone());
        }
    }
    for (id, kind) in &old_active {
        entries.entry(id.clone()).or_insert(Identity {
            id: id.clone(),
            kind: kind.clone(),
            retired: false,
            restore_task: None,
        });
    }
    // Deleted tasks can already be visible only through historical sessions or bindings.
    for (data, live) in [(before, &old_active), (&*after, &new_active)] {
        for task_id in data
            .sessions
            .iter()
            .filter_map(|s| s.task_id.as_ref())
            .chain(data.node_bindings.iter().map(|b| &b.task_id))
        {
            if let Some(record) = entries.get(task_id) {
                if record.kind != "task" {
                    return Err("历史任务引用的 ID 与其他实体冲突".into());
                }
            } else {
                entries.insert(
                    task_id.clone(),
                    Identity {
                        id: task_id.clone(),
                        kind: "task".into(),
                        retired: !live.contains_key(task_id),
                        restore_task: None,
                    },
                );
            }
        }
    }
    for (id, kind) in &new_active {
        if let Some(record) = entries.get_mut(id) {
            if &record.kind != kind {
                return Err("历史 ID 不能被其他实体复用".into());
            }
            if record.retired {
                let same_task = restore_id == Some(id.as_str()) && kind == "task";
                if !same_task {
                    return Err("历史 ID 已被永久保留，不能用于新建或导入其他实体".into());
                }
                record.retired = false;
                record.restore_task = None;
            }
        } else {
            entries.insert(
                id.clone(),
                Identity {
                    id: id.clone(),
                    kind: kind.clone(),
                    retired: false,
                    restore_task: None,
                },
            );
        }
    }
    for record in entries
        .values_mut()
        .filter(|r| !new_active.contains_key(&r.id))
    {
        record.retired = true;
        if record.kind == "task" {
            if let Some(task) = before.tasks.iter().find(|t| t.id == record.id) {
                record.restore_task = Some(serde_json::to_string(task).map_err(|e| e.to_string())?);
            }
        }
    }
    let mut records = entries.into_values().collect::<Vec<_>>();
    records.sort_by(|a, b| a.id.cmp(&b.id));
    after.identities = records;
    Ok(())
}
pub(crate) fn validate(data: &AppData) -> AppResult<()> {
    let current = active(data)?;
    let mut seen = HashMap::new();
    if data.identities.len() > 1_000_000 {
        return Err("ID 历史数量超出限制".into());
    }
    for record in &data.identities {
        if record.id.trim().is_empty()
            || record.id.len() > 200
            || seen.insert(&record.id, ()).is_some()
            || ![
                "project", "goal", "node", "habit", "vision", "task", "template", "session",
                "signal",
            ]
            .contains(&record.kind.as_str())
        {
            return Err("无效的 ID 历史登记".into());
        }
        // Retirement is checked by reconcile, allowing a validated undo candidate.
        if current
            .get(&record.id)
            .is_some_and(|kind| kind != &record.kind)
        {
            return Err("历史 ID 类型冲突".into());
        }
        if let Some(raw) = &record.restore_task {
            let task: Task = serde_json::from_str(raw).map_err(|_| "无效的任务恢复记录")?;
            if record.kind != "task" || task.id != record.id || !record.retired {
                return Err("任务恢复记录与 ID 登记不一致".into());
            }
        }
    }
    Ok(())
}
