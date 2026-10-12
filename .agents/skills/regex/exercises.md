# 练习：正则表达式

对应课程第 9 讲的练习（节选，按主题归入本 skill），复习用。

1. **grep 的正则 vs semgrep**。试着写一个正则表达式，用 grep 在你的代码里查找 `subprocess.Popen(..., shell=True)` 的出现位置；然后试着「破坏」这个 regex 模式（换行、改命名等）。semgrep 是否仍能匹配到那些让你的 grep 失效的危险代码？
2. **IDE 查找替换**。在你的 IDE 或文本编辑器里练习 regex 查找替换：把讲义中的 `-` Markdown 项目符号标记替换为 `*` 项目符号标记。注意直接替换所有 `-` 字符是不对的——该字符在文件里还有很多并非项目符号的用途。
3. **JSON 捕获与贪婪**。写一个 regex，从形如 `{"name": "Alyssa P. Hacker", "college": "MIT"}` 的 JSON 结构中捕获 name。提示：第一次尝试你很可能写出一个提取 `Alyssa P. Hacker", "college": "MIT` 的 regex——读一读 Python regex 文档里关于贪婪量词的内容，弄明白怎么修。
   - 让这个 regex 在 name 含 `"` 时也能工作（JSON 里双引号转义为 `\"`）。
   - 实践中不推荐用 regex 做复杂解析：用你所用语言的 JSON 解析器完成同一任务——写一个命令行程序，从 stdin 读入上述 JSON 结构、把 name 输出到 stdout，几行代码就够（Python 里除了 `import json`，一行就能做到）。

> 改编自 MIT The Missing Semester 课程 Lecture 9: Code Quality（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=XBiLUNx84CQ
