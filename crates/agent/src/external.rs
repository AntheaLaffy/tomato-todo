//! The same live application and skills are available to any MCP client.
use crate::{state::nonempty_text, Agent};
use serde_json::{json, Value};
use std::sync::Arc;
use tomato_core::AppResult;

pub const GUIDE: &str = "番茄 Todo 外部 Agent 接管入口\n\
连接的是正在运行的软件，共享同一份状态，不另开数据库。先 get_control_status、get_context、list_skills，按需 read_skill。\n\
需要独立负责后续教学/定时/复盘时，调用 set_external_control(controller=你的名称) 暂停内置助手的自动执行；完成后用 controller=null 归还。不会中断正在执行的请求，也没有自动过期时间。用户主动聊天仍可用。\n\
普通任务用 create_task/update_task/move_tasks/complete_task；番茄、设置、愿景、保护等单项动作走 dispatch。大批改动走 export_plan/export_backup → read_file/patch_file → review_file → apply_file，保留来源与哈希。\n\
教学先读 exam-teaching 和 contract.md；命题再读 exam-authoring。get_education 可按 collection/projectId/id 分页读完整教学记录，education 工具保存学期、课程、题卷、提交、评分和复盘。课程与作业自动落入今日专注，不再另建副本。\n\
get_control_status.projectMounts 给出本机实际授权目录；技能和参考文件也能通过 tomato://skills/{name}/{reference} 读取。目录绑定必须由用户在界面授权，不能用配置或备份扩大访问。\n\
外部接管时教学事件仍会排队；用 get_education(collection=events) 查看，保存实际产物后 finishEvent。内置自动任务暂停期间不会替外部客户端执行这些事件。用户停止、供应商错误和未知学情必须如实保留；考试中不泄题。\n\
外部工具仍受原生预检、严格保护、教学历史不可改写、评分与文件校验约束。不能通过 MCP 紧急解锁或提前完成番茄。";

impl Agent {
    pub(crate) fn skill_catalog(self: &Arc<Self>) -> AppResult<Value> {
        let mut entries = Vec::new();
        for name in self.available_skills() {
            let skill = self.call("read_skill", &json!({"name":name}), true)?;
            let text = skill["text"].as_str().unwrap_or_default();
            let mut description = String::new();
            let mut collecting = false;
            for line in text.lines().skip(1).take_while(|line| *line != "---") {
                if let Some(value) = line.strip_prefix("description:") {
                    description = value.trim().trim_matches(['\'', '"']).to_string();
                    collecting = matches!(description.as_str(), "" | ">" | "|");
                    if collecting {
                        description.clear();
                    }
                } else if collecting && line.starts_with(char::is_whitespace) {
                    if !description.is_empty() {
                        description.push(' ');
                    }
                    description.push_str(line.trim());
                } else if collecting && !line.trim().is_empty() {
                    collecting = false;
                }
            }
            entries.push(json!({"name":name,"description":description,"uri":format!("tomato://skills/{name}/SKILL.md")}));
        }
        Ok(json!({"skills":entries}))
    }

    pub(crate) fn control_status(&self) -> AppResult<Value> {
        let inner = self.inner.lock().map_err(|e| e.to_string())?;
        let controller = inner.store.external_controller.clone();
        let busy = inner.live.busy;
        drop(inner);
        Ok(json!({"externalController":controller,"internalBusy":busy,
            "automaticExecutionPaused":controller.is_some(),"projectMounts":self.project_mounts()?}))
    }

    pub(crate) fn external_control(&self, args: &Value) -> AppResult<Value> {
        let _control = self.control_lock.lock().map_err(|e| e.to_string())?;
        let controller = if args.get("controller").is_none() {
            return Err("必须指定 controller：名称或 null".into());
        } else if args["controller"].is_null() {
            None
        } else {
            Some(nonempty_text(args, "controller", 80)?)
        };
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if controller.is_some() && inner.live.busy {
            return Err("内置助手仍在执行请求，请等它结束或由用户停止后再接管".into());
        }
        let mut next = inner.store.clone();
        next.external_controller = controller;
        next.save(&self.dir)?;
        inner.store = next;
        drop(inner);
        self.control_status()
    }

    pub(crate) fn education_records(&self, args: &Value) -> AppResult<Value> {
        let collection = nonempty_text(args, "collection", 40)?;
        let mut engine = self.engine.lock().map_err(|e| e.to_string())?;
        let snapshot = engine.snapshot(tomato_core::now())?;
        let education =
            serde_json::to_value(&snapshot.data.education).map_err(|e| e.to_string())?;
        let rows = education
            .get(&collection)
            .and_then(Value::as_array)
            .ok_or("未知教学记录集合")?;
        let source_project = |row: &Value| -> Option<String> {
            if let Some(project) = row["projectId"].as_str() {
                return Some(project.into());
            }
            let mut assessment_id = row["assessmentId"].as_str();
            let mut submission_id = row["submissionId"].as_str();
            if let Some(grade) = row["gradeId"]
                .as_str()
                .and_then(|id| snapshot.data.education.grades.iter().find(|g| g.id == id))
            {
                submission_id = Some(&grade.submission_id);
            }
            if let Some(sub) = submission_id.and_then(|id| {
                snapshot
                    .data
                    .education
                    .submissions
                    .iter()
                    .find(|s| s.id == id)
            }) {
                assessment_id = Some(&sub.assessment_id);
            }
            if let Some(paper) = assessment_id.and_then(|id| {
                snapshot
                    .data
                    .education
                    .assessments
                    .iter()
                    .find(|a| a.id == id)
            }) {
                return Some(paper.project_id.clone());
            }
            row["taskId"]
                .as_str()
                .and_then(|id| snapshot.data.tasks.iter().find(|t| t.id == id))
                .and_then(|t| t.project_id.clone())
        };
        let filtered = rows
            .iter()
            .filter(|row| {
                args["id"]
                    .as_str()
                    .is_none_or(|id| row["id"] == id || row["taskId"] == id)
                    && args["projectId"]
                        .as_str()
                        .is_none_or(|project| source_project(row).as_deref() == Some(project))
            })
            .collect::<Vec<_>>();
        let offset = args["offset"].as_u64().unwrap_or(0) as usize;
        let limit = args["limit"].as_u64().unwrap_or(30).clamp(1, 100) as usize;
        Ok(
            json!({"collection":collection,"asOf":snapshot.server_time,"total":filtered.len(),"offset":offset,
            "records":filtered.into_iter().skip(offset).take(limit).collect::<Vec<_>>()}),
        )
    }

    pub(crate) fn call_external(self: &Arc<Self>, name: &str, args: &Value) -> AppResult<Value> {
        if !crate::tools::external_definitions()
            .iter()
            .any(|tool| tool["name"] == name)
        {
            return Err("外部 MCP 工具未授权".into());
        }
        self.call(name, args, false)
    }

    pub(crate) fn mcp_method(self: &Arc<Self>, method: &str, params: &Value) -> AppResult<Value> {
        match method {
            "initialize" => Ok(
                json!({"protocolVersion":params["protocolVersion"].as_str().filter(|v| ["2025-11-25","2025-06-18","2025-03-26"].contains(v)).unwrap_or("2025-11-25"),
                "capabilities":{"tools":{},"resources":{},"prompts":{}},"serverInfo":{"name":"tomato-todo","version":env!("CARGO_PKG_VERSION")},
                "instructions":"先读 tomato://guide 或使用 take-over 提示词；get_control_status/get_context/list_skills 是接管入口。"}),
            ),
            "ping" => Ok(json!({})),
            "tools/list" => Ok(json!({"tools":crate::tools::external_definitions()})),
            "tools/call" => {
                match self.call_external(
                    params["name"].as_str().unwrap_or_default(),
                    &params["arguments"],
                ) {
                    Ok(value) => {
                        let mut result = json!({"content":[{"type":"text","text":serde_json::to_string(&value).map_err(|e|e.to_string())?}]});
                        if value.is_object() {
                            result["structuredContent"] = value;
                        }
                        Ok(result)
                    }
                    Err(error) => {
                        Ok(json!({"isError":true,"content":[{"type":"text","text":error}]}))
                    }
                }
            }
            "resources/list" => {
                let catalog = self.skill_catalog()?;
                let mut resources = vec![
                    json!({"uri":"tomato://guide","name":"接管指南","mimeType":"text/markdown","description":"当前实例、工具、教学、技能与归还自动执行的入口"}),
                ];
                for skill in catalog["skills"].as_array().into_iter().flatten() {
                    resources.push(json!({"uri":skill["uri"],"name":skill["name"],"description":skill["description"],"mimeType":"text/markdown"}));
                }
                Ok(json!({"resources":resources}))
            }
            "resources/templates/list" => Ok(
                json!({"resourceTemplates":[{"uriTemplate":"tomato://skills/{name}/{+reference}","name":"技能与参考文件","description":"reference 为 SKILL.md、contract.md、references/… 或 scripts/…；沿技能入口按需读取","mimeType":"text/plain"}]}),
            ),
            "resources/read" => {
                let uri = nonempty_text(params, "uri", 1024)?;
                let text = if uri == "tomato://guide" {
                    GUIDE.into()
                } else if let Some(path) = uri.strip_prefix("tomato://skills/") {
                    let (name, reference) = path.split_once('/').ok_or("技能URI缺少参考文件")?;
                    self.call(
                        "read_skill",
                        &json!({"name":name,"reference":reference}),
                        true,
                    )?["text"]
                        .as_str()
                        .unwrap_or_default()
                        .to_owned()
                } else {
                    return Err("未知资源URI".into());
                };
                Ok(json!({"contents":[{"uri":uri,"mimeType":"text/plain","text":text}]}))
            }
            "prompts/list" => Ok(
                json!({"prompts":[{"name":"take-over","title":"接管番茄 Todo","description":"让外部Agent使用当前软件与随包技能完成工作","arguments":[{"name":"task","description":"本次接管要完成的事","required":false}]}]}),
            ),
            "prompts/get" => {
                if params["name"] != "take-over" {
                    return Err("未知提示词".into());
                }
                Ok(
                    json!({"description":"接管番茄 Todo","messages":[{"role":"user","content":{"type":"text","text":format!("{}\n本次任务：{}",GUIDE,params["arguments"]["task"].as_str().unwrap_or("先查看当前状态与待处理事项，不擅自改变安排。"))}}]}),
                )
            }
            _ => Err("未知MCP方法".into()),
        }
    }
}
