use super::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasVersion {
    revision: u64,
    title: String,
    language: String,
    content: String,
    at: i64,
    source: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Canvas {
    id: String,
    versions: Vec<CanvasVersion>,
}
impl Canvas {
    fn view(&self, revision: Option<u64>) -> AppResult<Value> {
        let current = self.versions.last().ok_or("文档没有版本")?;
        let version = match revision {
            Some(revision) => self
                .versions
                .iter()
                .find(|v| v.revision == revision)
                .ok_or("文档版本不存在")?,
            None => current,
        };
        Ok(
            json!({"id": self.id, "title":version.title,"language":version.language,"content":version.content,"revision":version.revision,"currentRevision":current.revision,"versions":self.versions.iter().map(|v|json!({"revision":v.revision,"title":v.title,"at":v.at,"source":v.source})).collect::<Vec<_>>()}),
        )
    }
}
pub(super) fn summaries(store: &Store) -> Vec<Value> {
    store.active_conversation().map(|c|c.canvases.iter().map(|d| {
        let v = d.versions.last();
        json!({"id":d.id,"title":v.map(|v|&v.title),"language":v.map(|v|&v.language),"revision":v.map(|v|v.revision)})
    }).collect()).unwrap_or_default()
}
impl Agent {
    pub(super) fn canvas_operation(
        self: &Arc<Self>,
        op: &str,
        args: &Value,
        source: &str,
    ) -> AppResult<Value> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if op == "get_canvas" {
            if args["id"].is_null() {
                return Ok(json!({"canvases":summaries(&inner.store)}));
            }
            let id = nonempty_text(args, "id", 100)?;
            return inner
                .store
                .active_conversation()
                .and_then(|c| c.canvases.iter().find(|d| d.id == id))
                .ok_or("文档不存在")?
                .view(args["revision"].as_u64());
        }
        if inner.live.busy && source == "user" {
            return Err("请先停止当前分析再修改文档".into());
        }
        let base = args["baseRevision"]
            .as_u64()
            .ok_or("缺少文档版本，请重新读取")?;
        let mut next = inner.store.clone();
        if next.active_conversation().is_none() {
            next.new_conversation(now());
        }
        let active = next.active.clone();
        let conversation = next
            .conversations
            .iter_mut()
            .find(|c| Some(&c.id) == active.as_ref())
            .ok_or("会话不存在")?;
        let id = args["id"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        if uuid::Uuid::parse_str(&id).is_err() {
            return Err("文档 ID 无效".into());
        }
        let index = conversation.canvases.iter().position(|d| d.id == id);
        let latest = index.and_then(|i| conversation.canvases[i].versions.last());
        if latest.map(|v| v.revision).unwrap_or(0) != base {
            return Err("文档已有新版本，草稿已保留；请载入最新版本或另存为新文档".into());
        }
        if op == "canvas_delete" {
            conversation.canvases.remove(index.ok_or("文档不存在")?);
            next.save(&self.dir)?;
            inner.store = next;
            return Ok(json!({"deleted":id}));
        }
        let (title, language, content) = if op == "canvas_restore" {
            let revision = args["revision"].as_u64().ok_or("缺少恢复版本")?;
            let old = index
                .and_then(|i| {
                    conversation.canvases[i]
                        .versions
                        .iter()
                        .find(|v| v.revision == revision)
                })
                .ok_or("文档版本不存在")?;
            (old.title.clone(), old.language.clone(), old.content.clone())
        } else {
            let title = nonempty_text(args, "title", 100)?;
            let language = args["language"].as_str().unwrap_or("markdown");
            if ![
                "markdown",
                "text",
                "html",
                "css",
                "javascript",
                "typescript",
                "python",
                "rust",
                "json",
            ]
            .contains(&language)
            {
                return Err("文档语言无效".into());
            }
            let content = args["content"].as_str().ok_or("缺少文档正文")?;
            if content.len() > 256 * 1024 {
                return Err("单个 Canvas 文档最多 256 KB".into());
            }
            (title, language.into(), content.into())
        };
        if latest
            .is_some_and(|v| v.title == title && v.language == language && v.content == content)
        {
            return conversation.canvases[index.unwrap()].view(None);
        }
        let version = CanvasVersion {
            revision: base + 1,
            title,
            language,
            content,
            at: now(),
            source: source.into(),
        };
        let document = if let Some(i) = index {
            &mut conversation.canvases[i]
        } else {
            conversation.canvases.push(Canvas {
                id: id.clone(),
                versions: vec![],
            });
            conversation.canvases.last_mut().unwrap()
        };
        document.versions.push(version);
        let result = document.view(None)?;
        next.save(&self.dir)?;
        inner.store = next;
        Ok(result)
    }
}
