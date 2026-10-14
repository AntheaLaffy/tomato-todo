use super::*;

impl Agent {
    pub(super) fn conversation_operation(
        self: &Arc<Self>,
        op: &str,
        args: &Value,
    ) -> AppResult<Value> {
        if op == "search_conversations" {
            let query = args["query"]
                .as_str()
                .unwrap_or_default()
                .trim()
                .to_lowercase();
            if query.chars().count() > 200 {
                return Err("搜索词最多 200 字".into());
            }
            let inner = self.inner.lock().map_err(|e| e.to_string())?;
            let mut results = Vec::new();
            for mut view in inner.store.conversations_view() {
                let c = inner
                    .store
                    .conversations
                    .iter()
                    .find(|c| Some(c.id.as_str()) == view["id"].as_str())
                    .ok_or("会话不存在")?;
                let matched = c.messages.iter().find(|m| {
                    !query.is_empty() && {
                        m.text.to_lowercase().contains(&query)
                            || m.attachments
                                .iter()
                                .any(|a| a.name.to_lowercase().contains(&query))
                    }
                });
                if query.is_empty() || c.title.to_lowercase().contains(&query) || matched.is_some()
                {
                    if let Some(message) = matched {
                        let folded = message.text.to_lowercase();
                        let start = folded
                            .find(&query)
                            .map(|at| folded[..at].chars().count().saturating_sub(40))
                            .unwrap_or(0);
                        view["snippet"] = json!(message
                            .text
                            .chars()
                            .skip(start)
                            .take(140)
                            .collect::<String>());
                        view["messageId"] = json!(message.id);
                    }
                    results.push(view);
                }
            }
            return Ok(json!({"conversations":results}));
        }
        if matches!(op, "rename_conversation" | "pin_conversation") {
            let id = nonempty_text(args, "id", 100)?;
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.live.busy {
                return Err("请先停止当前分析".into());
            }
            let c = inner
                .store
                .conversations
                .iter_mut()
                .find(|c| c.id == id)
                .ok_or("会话不存在")?;
            if op == "rename_conversation" {
                c.title = nonempty_text(args, "title", 80)?;
            } else {
                c.pinned = args["pinned"].as_bool().ok_or("缺少置顶状态")?;
            }
            inner.store.save(&self.dir)?;
            drop(inner);
            return self.status();
        }
        let message_id = nonempty_text(args, "messageId", 100)?;
        let (session_file, entry_id, target_id, retry) = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.live.busy {
                return Err("请先停止当前分析".into());
            }
            let c = inner.store.active_conversation().ok_or("会话不存在")?;
            let index = c
                .messages
                .iter()
                .position(|m| m.id == message_id)
                .ok_or("消息不存在")?;
            let target = &c.messages[index];
            let (target, retry) = match op {
                "edit_message" if target.role == "user" && !target.automatic => (
                    target,
                    Some((
                        nonempty_text(args, "text", 32000)?,
                        target.attachments.clone(),
                    )),
                ),
                "retry_message" if target.role == "assistant" => {
                    let user = c.messages[..index]
                        .iter()
                        .rev()
                        .find(|m| m.role == "user")
                        .ok_or("这条回复没有可重试的用户消息")?;
                    if user.automatic {
                        return Err("自动任务不能作为用户请求重新生成".into());
                    }
                    (user, Some((user.text.clone(), user.attachments.clone())))
                }
                "retry_message" if target.role == "user" && !target.automatic => (
                    target,
                    Some((target.text.clone(), target.attachments.clone())),
                ),
                "branch_conversation" => (target, None),
                _ => return Err("这条消息不支持该操作".into()),
            };
            let retry = retry
                .map(|(text, files)| {
                    let ids = json!(files.iter().map(|a| &a.id).collect::<Vec<_>>());
                    let (files, images) = attachments::for_prompt(&self.dir, &ids)?;
                    Self::validate_prompt(&inner, false, &images)?;
                    Ok::<_, String>((text, files, images))
                })
                .transpose()?;
            let result = (
                c.session_file.clone().ok_or("此对话没有 Pi 会话文件")?,
                target
                    .entry_id
                    .clone()
                    .ok_or("这条旧消息没有 Pi 节点，请从新的消息创建分支")?,
                target.id.clone(),
                retry,
            );
            // Reserve the active conversation while the SDK forks its file, so a
            // second click or a scheduled turn cannot attach to the wrong history.
            inner.live.busy = true;
            result
        };
        let branched = self.ask_worker(json!({"op":"branch","sessionFile":session_file,"entryId":entry_id,"before":retry.is_some()}), 30);
        let command = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            inner.live.busy = false;
            let result = branched?;
            let path = result["sessionFile"].as_str().ok_or("Pi 未返回分支文件")?;
            if !Path::new(path).starts_with(self.dir.join("sessions")) {
                return Err("分支文件路径越界".into());
            }
            let mut next = inner.store.clone();
            next.fork_conversation(&target_id, retry.is_some(), path.into(), now())?;
            next.save(&self.dir)?;
            inner.store = next;
            inner.live.questions = Value::Null;
            inner.live.plan = Value::Null;
            inner.live.text.clear();
            inner.live.error = None;
            inner.live.tool.clear();
            if let Some((text, attachments, images)) = retry {
                let images = if attachments.is_empty() {
                    validated_images(&result["images"])?
                } else {
                    images
                };
                let text = if attachments.is_empty() && op == "retry_message" {
                    result["text"].as_str().unwrap_or(&text).to_owned()
                } else {
                    text
                };
                Some(self.prompt_command(&mut inner, text, false, false, images, attachments)?)
            } else {
                None
            }
        };
        if let Some(command) = command {
            self.send_prompt(command)?;
        }
        self.status()
    }
}
