# 练习：Shell 脚本

对应课程第 1 讲的练习（节选，按主题归入本 skill），复习用。

1. **退出码与短路**。`$?` 保存上一条命令退出状态（0 = 成功）。写一条一行命令：仅当 `/tmp/mydir` 不存在时才创建它。（提示：`&&` 前成功后执行，`||` 前失败后执行）
2. **检查文件存在**。写脚本接收文件名参数（`$1`），用 `test -f` 或 `[ -f ... ]` 检查是否存在，按结果输出不同提示。
3. **chmod +x**。把上题脚本存为 `check.sh`。先运行 `./check.sh somefile` 会发生什么？执行 `chmod +x check.sh` 再试一次。为什么必须这步？（比较前后 `ls -l check.sh`）
4. **set -x**。给脚本的 set 选项加 `-x` 会发生什么？写个简单脚本试试。（参见 The Set Builtin）
5. **带日期的备份**。写一条命令把文件复制成带当天日期的备份名（`notes.txt` → `notes_2026-01-12.txt`）。（提示：`$(date +%Y-%m-%d)`）
6. **flaky 测试脚本参数化**。把讲义中「复现偶发失败」的脚本改成从命令行接收测试命令，而不是写死 `cargo test my_test`。（提示：`$1` 或 `$@`）

> 改编自 MIT The Missing Semester 课程 Lecture 1: Course overview + the shell（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=MSgoeuMqUmU
