# 练习：信号与作业控制

对应课程第 2 讲的练习（节选，按主题归入本 skill），复习用。

1. **挂起、后台、再杀掉**。在终端里启动 `sleep 10000`，用 Ctrl-Z 挂起，再用 `bg` 让它后台继续运行。然后用 `pgrep` 找到它的 pid，用 `pkill` 把它杀掉——整个过程都不要手动输入这个 pid。（提示：试试 `-af` 参数）
2. **wait**。假设你不想在某个进程完成之前启动另一个进程，限制条件始终是 `sleep 60 &`。一种做法是用 `wait` 命令：启动这个 sleep，然后让一个 `ls` 等到后台进程结束后再执行。
3. **pidwait**。如果是在另一个 bash 会话里启动的进程，`wait` 就失效了（它只对当前 shell 的子进程有效）。`kill -0` 不会真的发送信号，但进程不存在时会返回非 0。写一个 bash 函数 `pidwait`：接收一个 pid，一直等到该进程结束；用 `sleep` 避免空转浪费 CPU。

> 改编自 MIT The Missing Semester 课程 Lecture 2: Command-line Environment（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=ccBGsPedE9Q
