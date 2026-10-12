---
name: shell-conventions
description: >
  CLI 约定参考：参数（-/-/--、-- 终止选项、变长参数与 glob 展开）、三条标准流与重定向、
  环境变量（export/命令替换/进程替换）、返回码与 &&/||/if/while、AI 在管道中的用法（llm）。
  手动点名使用。
disable-model-invocation: true
---

# 命令行约定

主线：Shell 语言本身几乎不强制任何语法，程序之间的默契全靠约定——参数、流、环境变量、返回码。懂约定才能读懂别人写的脚本，也才能写出与其他程序良好协作的命令。

## 参数

- 参数是纯字符串，由程序决定怎么解析。`$1`–`$9` 逐个访问，`$@` 全部，`$#` 个数，`$0` 程序名。
- 选项以 `-` 或 `--` 开头：`-a` 单字母（可合并成 `ls -la`）、`--all` 长名称（通常等价）；顺序无所谓；`--help`/`--verbose`/`--version` 先试。
- 选项解析是程序自己的事，Shell 并不替你解析——写 CLI 程序时用现成解析库（如 Python 的 argparse），别手写。
- `--` 终止选项解析：后面全是位置参数——文件名以 `-` 开头时必需（`touch -- -myfile`，删除时 `rm -- -myfile`）。
- 同一命令常接受多个同类参数（`mkdir src docs`），配合 glob 威力最大：`*` 匹配任意字符、`?` 恰好一个、`{a,b}` 花括号展开——Shell 在调用程序前就展开，`rm *.py` 传给 rm 的是文件列表而不是字符串 `*.py`；zsh 还支持 `**` 递归匹配（`rm **/*.py`）。

## 流

- stdin/stdout/stderr 三条流；管道只传 stdout，stderr 直接上终端——错误信息不污染管道数据。
- 管道是并行的：所有程序同时启动、流先接好，数据边产出边消费——不是「前一个跑完才跑下一个」。注意程序可能缓冲输出（Python 默认缓冲），慢速管道里「数字迟迟不出现」多半是缓冲，可用 `python -u` 关掉。
- `-` 作为文件名常表示 stdin（`echo hi | grep hi -` 与不加 `-` 等价）。
- 重定向：`>` 覆盖、`>>` 追加、`2>` 接 stderr、`&>` 两流同文件、`<` 读文件、`cmd > /dev/null 2>&1` 全丢弃。
- `fzf` 从 stdin 读行、交互筛选：`ls | fzf`、`cat ~/.bash_history | fzf`；配置 shell 集成后 Ctrl-R 的历史搜索也用它。

## 环境变量

- `foo=bar` 赋值、`$foo` 读取；`foo = bar` 会被解析成调用程序 foo 并传参 `['=', 'bar']`——等号两边不能有空格。
- 变量全是字符串；`'...'` 字面量不展开变量，`"..."` 会展开。
- 命令替换 `$(...)`：`files=$(ls)` 把 stdout 存进变量（保留换行，grep 等仍能按行处理）。
- 进程替换 `<( CMD )`：把命令输出变成临时文件路径，喂给只收文件参数的命令——`diff <(ls src) <(ls docs)`。
- 环境变量随子进程传递：`TZ=Asia/Tokyo date` 只对这一次生效；`export DEBUG=1` 之后所有子进程继承；`unset DEBUG` 删除。export 是把变量标记为「可继承」，标记之后再改值，子进程拿到的也是新值。按约定环境变量全大写（HOME、PATH、DEBUG），与本地变量区分。

## 返回码

- 0 = 成功，非 0 = 失败；`exit NUM` 主动返回，`$?` 取上一条的返回码。
- `&&`/`||` 按返回码短路：「成功才执行」「失败才执行」——`grep -q p f && echo found`。`grep -q`（quiet）不打印匹配、只用返回码表示找没找到，正是给这种判断用的。
- `if cmd; then ...; fi` 与 `while cmd; do ...; done` 以返回码为条件，不是布尔值。
- `true` 恒成功、`false` 恒失败，适合占位。

## AI in Shell

- 生成命令：`llm cmd "find all python files modified in the last week"` → 给出 shell 命令，运行前会征求确认——先读懂再同意。
- 管道集成：`llm "$INSTRUCTIONS" < users.txt` 从 stdin 读数据、按指令转换——格式不一致的文本提取比正则省事；含空格的指令变量要加引号。
- 元 Shell：Claude Code 这类工具把英文指令翻译成 shell 操作、文件编辑和多步任务——编程语言是英文，适合「知道要什么、不想记中间步骤」的场景；它生成的命令仍要审查后再接受。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 2: Command-line Environment（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=ccBGsPedE9Q
