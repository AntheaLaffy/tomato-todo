---
name: shell-scripting
description: >
  Bash 脚本语言：shebang、set -euo pipefail、变量与 "$var" 引号、test/[ 与 [[ 条件、while/for 循环、
  命令替换 $()、退出码 $? 与 &&/||、后台任务 &、重定向。Use when the user asks to write, debug,
  or port a shell/bash script. 触发于「帮我写/改/修 shell 脚本」。
---

# Shell 脚本

主线：Shell 本身是一门编程语言（变量、条件、循环、函数俱全），提示符里敲的每行都是「一小段代码」；但 bash 坑极多，脚本超过 ~100 行就应迁往 Python。严格模式 + shellcheck 是底线。

## 操作契约

- **头两行是标配**：`#!/bin/bash`（shebang，决定用哪个解释器执行）+ `set -euo pipefail`（`-e` 命令失败即退、`-u` 未定义变量报错、`-o pipefail` 管道任一段失败即退）。
- **变量要引号**：`"$var"`，防止值里的空格被拆成多个参数。
- **条件**：`if cmd; then ...; fi` 以退出码判断（0 = 成功）；`test` 简写 `[`（`[ -f file ]` 文件存在、`[ "$a" = "b" ]` 相等）；优先用内置 `[[ ]]`，引号怪异行为更少。
- **循环**：`while cmd; do ...; done`（cmd 成功就一直循环）；`for v in a b c; do ...; done`。
- **命令替换用 `$()`**：`for i in $(seq 1 10)`；不用反引号，`$()` 可嵌套。
- **退出码与短路**：`$?` 上一条的退出码；`a && b` 前成功后执行，`a || b` 前失败后执行。
- **后台与重定向**：`cmd &` 后台运行（`$!` 是其 PID）；`cmd > log 2>&1` 把 stdout+stderr 都写进文件。
- **调试三板斧**：`set -x` 打印每条执行命令；`bash -n script.sh` 查语法；写脚本必用 shellcheck。
- **太长就升级**：超过 ~100 行，或数据结构复杂时，迁到 Python 等正式语言——LLM 很适合做这种迁移。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 1: Course overview + the shell（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=MSgoeuMqUmU
