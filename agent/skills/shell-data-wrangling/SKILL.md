---
name: shell-data-wrangling
description: >
  管道与文本工具组合：| 管道、> / < / 2>&1 重定向，cat/sort/uniq/head/tail/grep/sed/find/awk/xargs/tee/jq
  把日志、CSV、文件列表加工成答案。Use when the user asks to write a shell pipeline, parse or
  summarize logs/CSV/text, grep/sed/awk files, or compose command-line tools.
  触发于「帮我写条命令处理日志/文本/CSV」「这个管道怎么改」。
---

# 管道与文本处理

主线：`|` 把前一个程序的标准输出接给后一个的标准输入，让简单工具像乐高一样组合——抓日志 → 提取 → 统计 → 排序 → 取前 N，一条命令完成。

## 心智模型

- 三个标准流：stdin(0)、stdout(1)、stderr(2)。多数工具无文件参数时读 stdin、写 stdout。`> file` 覆盖写、`>> file` 追加、`< file` 读文件、`2> file` 只接 stderr、`2>&1` 合并两流。
- `grep` 的 pattern 是正则表达式；`sed` 是可编程流编辑器（`s/pattern/replacement/g` 替换每行所有匹配）；`awk` 按列解析（默认空白分隔，`-F,` 换分隔符）；`find` 按条件递归找文件（`-exec cmd {} \;` 对每个结果执行命令）。

## 操作契约

- **先看数据再写管道**：先 `head` / `curl -s` 看样本结构和分隔符，再定正则与列号——盲写的正则第一版几乎必错。
- **逐段构建、逐段验证**：管道每接一段就跑一次，确认中间输出符合预期；一步到位的长管道难以调试。
- **计数三连**：`sort | uniq -c | sort -nk1,1` 是「出现频率排序」的标准组合，日志分析高频出现。
- **tee 分叉**：`verbose cmd | tee full.log | grep CRITICAL`——全量日志落盘，终端只留关键行。
- **find 结果交给下一个命令**：`find ... -exec cmd {} \;` 或 `find ... -print0 | xargs -0 cmd`（文件名含空格用后者）。xargs 把 stdin 每行变成命令参数。
- **JSON 用 jq 不用 grep**：`curl -s URL | jq '.[] | select(.version > 6) | .name'`；先 `jq .` 看结构再写选择器。
- **awk 能过滤也能改写**：`awk '$3 ~ /pat/ {$4=""; print}'` 过滤行并删列；提取、求和、统计都行。
- **正则替换可引用捕获**：replacement 里 `\1` 等引用 pattern 的分组。
- **管道变长就升级**：超过 ~10 段或逻辑绕了，写成脚本或换 Python，见 `shell-scripting`。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 1: Course overview + the shell（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=MSgoeuMqUmU
