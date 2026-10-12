# 练习：命令行约定

对应课程第 2 讲的练习（节选，按主题归入本 skill），复习用。

1. **`--` 终止选项**。`cmd --flag -- --notaflag` 里的 `--` 告诉程序后面不再解析选项，全部当作位置参数。这有什么用？试着 `touch -- -myfile`，然后在不使用 `--` 的情况下把它删掉。
2. **ls 组合选项**。读 `man ls`，写出一个 ls 命令：包含所有文件（含隐藏文件）、文件大小易读格式（如 454M）、按最近修改时间排序、输出带颜色。
3. **进程替换**。`<(command)` 把命令输出当文件用。用 `diff` 配合进程替换比较 `printenv` 与 `export` 的输出——它们为什么不一样？（提示：试试 `diff <(printenv | sort) <(export | sort)`）
4. **marco/polo**。写两个 bash 函数：执行 `marco` 时保存当前工作目录；之后无论切到哪个目录，执行 `polo` 都 cd 回当时所在的目录。调试时可把代码写进 marco.sh，用 `source marco.sh` 加载到当前 shell。
5. **跑挂为止**。写一个脚本，不断运行下面这个很少失败的脚本直到它失败，把 stdout 和 stderr 分别保存到文件，最后把结果打印出来；加分项：报告它跑了多少次才失败。

   ```bash
   #!/usr/bin/env bash

   n=$(( RANDOM % 100 ))

   if [[ n -eq 42 ]]; then
       echo "Something went wrong"
       >&2 echo "The error was using magic numbers"
       exit 1
   fi

   echo "Everything went according to plan"
   ```

6. **最近修改的文件**。（进阶）写一个命令或脚本，递归找出某个目录中最近修改过的文件；更一般地，按「最近修改时间」列出所有文件。

> 改编自 MIT The Missing Semester 课程 Lecture 2: Command-line Environment（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=ccBGsPedE9Q
