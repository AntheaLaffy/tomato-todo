---
name: regex
description: >
  正则表达式速查：基本构件、示例、捕获组与引用、贪婪陷阱、局限性（非正则语言/前瞻反向引用）、
  学习路径与 LLM 辅助。手动点名使用。
disable-model-invocation: true
---

# 正则表达式

主线：regex 是描述字符串集合的语言，用于模式匹配/校验/解析——命令行（grep/sed 用法见 `shell-data-wrangling`）、IDE、代码里都有（测试运行器也能用 regex 选测试子集）。先学本讲基础，之后按需查参考资料，别背整门语言；用 regex101 开发调试（还能切换 Python/JavaScript 等不同 flavor 试语法差异）。

## 示例

- `abc` 字面量；`missing|semester` 或；`\d{4}-\d{2}-\d{2}` YYYY-MM-DD 形状（不验日期合法性，"2026-01-99" 也匹配）；`.+@.+` 最弱的 email 形状；`\bdef\b` 只匹配函数定义里的 def、不匹配 define 里的。

## 基本构件

- 字面量字符；`.` 任意单字符；`[abc]` / `[^abc]` / `[a-f]` 字符集；`a|b` 或；`\d` 数字、`\w` 单词字符、`\b` 单词边界；`(...)` 分组；`?` / `*` / `+` / `{N}` 量词（零或一 / 任意 / 一或多 / 精确 N）；`\.` 字面量点、`\\` 字面量反斜杠；`^` 行首、`$` 行尾。

## 捕获组与引用

- 提取：`re.match(r"\d{4}-(\d{2})-\d{2}", "2026-01-14").group(1)` → `'01'`。Python 用 `r''` 原始字符串省去转义的痛苦。
- 替换里引用分组语法随工具不同：VS Code 用 `$1`/`$2`，Vim 用 `\1`/`\2`；Vim 连量词和分组都要反斜杠（`\d\+`、`\(\d\+\)`），而 ag/Python 里是 `\d+`、`(...)`——这就是「flavor 差异」。
- 贪婪陷阱：量词默认贪婪，`.*` 会吞到最后一个可能位置——从 JSON 字符串里提取字段时极易吞多；按需换非贪婪 `.*?` 或更精确的字符集。

## 局限性

- 标准正则表达不了 {aⁿbⁿ | n≥0} 这类语言；HTML 不是正则语言——别用 regex 解析复杂结构，用解析器（pyparsing/PEG）或语言自带的 JSON 库。
- 现代引擎的前瞻、反向引用等已超出正则语言，实用但要知道边界。
- LLM 生成 regex 很有效（给它样例行，如 nginx 日志行），产物拿 regex101 验证再上线。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 9: Code Quality（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=XBiLUNx84CQ
