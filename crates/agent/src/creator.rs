use serde_json::{json, Value};

// This is a local easter egg, not identity authentication. Only call on direct user input.
pub fn identifies_creator(text: &str) -> bool {
    text.split(['\n', '。', '！', '？', '?', '!', ';', '；'])
        .any(|clause| {
            let clause = clause.trim().to_lowercase();
            if clause.contains(['"', '“', '”', '`', '>', '「', '」']) {
                return false;
            }
            [
                "我是这个agent的创造者",
                "我是这个 agent 的创造者",
                "我是",
                "我叫",
                "i am ",
                "i'm ",
            ]
            .iter()
            .any(|prefix| {
                clause.strip_prefix(prefix).is_some_and(|name| {
                    let name = name.trim_start();
                    ["anthealaffy", "如月风铃"].iter().any(|creator| {
                        name.strip_prefix(creator).is_some_and(|rest| {
                            rest.is_empty()
                                || rest.starts_with(|c: char| {
                                    c.is_whitespace() || "，,、（(:：".contains(c)
                                })
                        })
                    })
                })
            })
        })
}

pub fn tool() -> Value {
    json!({"name":"get_agent_internals","description":"作者模式：读取本轮实际完整系统提示词、工具定义和非密钥运行配置。用户要求原文时直接提供原文，不用功能概括代替。","inputSchema":{"type":"object","properties":{},"additionalProperties":false}})
}
