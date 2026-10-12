---
name: shell-job-control
description: >
  信号与作业控制：Ctrl-C/Ctrl-Z、SIGINT/SIGQUIT/SIGTERM/SIGKILL、& 后台任务、jobs/fg/bg、
  nohup/disown、trap 清理、wait/pgrep/pkill。Use when the user asks to run a command in the
  background, stop or kill a process, write a trap/cleanup script, or wait for a job.
  触发于「放后台跑/杀掉这个进程/写清理脚本/等它跑完」。
---

# 信号与作业控制

主线：信号是「软件中断」——Ctrl-C 不是魔法，是 Shell 给前台进程发 SIGINT。进程可以捕获并忽略大多数信号（SIGKILL 除外）；作业控制只是这套机制在终端里的组织方式。

## 操作契约

- **打断**：Ctrl-C 发 SIGINT（可被程序忽略）；Ctrl-\ 发 SIGQUIT（更强硬）；`kill -TERM PID` 是通用的「请优雅退出」。`kill` 本质是发任意信号，不只杀进程——`kill -CONT PID` 发继续信号，把挂起的进程恢复运行（bg 的底层动作）。
- **挂起与前后台**：Ctrl-Z 发 SIGTSTP 挂起前台任务；`jobs` 列出会话里的作业（用 `%1` 引用作业号）；`fg %1` 拉回前台、`bg %1` 转后台继续；`cmd &` 直接后台启动，`$!` 是它的 PID。
- **后台任务依赖终端**：关终端会发 SIGHUP 把子进程一起带走；`nohup cmd &` 忽略 SIGHUP；已启动的用 `disown` 摘除。要真正持久，用终端复用器（见 `tmux`）。
- **SIGKILL 是最后手段**：不可捕获、立即终止，可能留下孤儿进程；先 SIGTERM，不行再 SIGKILL。
- **trap 做清理**：`trap cleanup EXIT` 退出时收尾（删临时文件、释放资源）；`trap cleanup SIGINT SIGTERM` 覆盖 Ctrl-C 和 kill。不处理中断的程序可能留下半写的文件——清理逻辑要用 trap 兜底，而不是只依赖正常路径。
- **等待进程**：`wait` 等当前 shell 的子进程结束；跨 shell 用 `kill -0 PID` 探测存活（不发信号，进程不存在时返回非 0），配 sleep 轮询避免空转。
- **找 PID**：`pgrep -af <模式>` 先查再杀，`pkill` 按名终止——避免手输 PID 抄错。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 2: Command-line Environment（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=ccBGsPedE9Q
