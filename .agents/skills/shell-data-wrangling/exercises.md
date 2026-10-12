# 练习：管道与文本处理

对应课程第 1 讲的练习（节选，按主题归入本 skill），复习用。

1. **重定向三条流**。运行 `ls /nonexistent /tmp`，把 stdout 和 stderr 分别重定向到两个文件；如何把两者都重定向到同一个文件？（参见 Redirections）
2. **最常见的 5 种扩展名**。用管道找出 home 目录下最常见的 5 种文件扩展名。（提示：组合 `find`、`grep`/`sed`/`awk`、`sort`、`uniq -c`、`head`）
3. **xargs**。xargs 把 stdin 每行变成命令参数。结合 `find` 与 `xargs`（不用 `-exec`）找出目录中所有 `.sh` 文件并用 `wc -l` 统计行数。加分项：正确处理文件名中的空格（`-print0` 与 `-0`）。
4. **curl + grep**。用 `curl -s` 获取课程网站 HTML，用 `grep` 统计一共列出了多少讲（先找出每讲课程名在 HTML 里的共性）。
5. **jq**。`curl` 获取 https://microsoftedge.github.io/Demos/json-dummy-data/64KB.json，用 `jq` 提取 version 大于 6 的人名。（先 `jq .` 看结构）
6. **awk 过滤与改写**。写一条 awk：只输出第二列大于 100 的行，并交换第一列和第三列。测试数据：`printf 'a 50 x\nb 150 y\nc 200 z\n'`
7. **拆解 SSH 管道**。讲义中 `ssh myserver 'journalctl ...' | sed -E ... | sort | uniq -c | sort -nk1,1 | tail -n10 | awk ... | paste -sd,` 每一步做了什么？然后仿照它从 `~/.bash_history`（或 `~/.zsh_history`）找出你最常用的 Shell 命令。

> 改编自 MIT The Missing Semester 课程 Lecture 1: Course overview + the shell（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=MSgoeuMqUmU
