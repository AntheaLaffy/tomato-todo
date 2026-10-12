# 练习：性能分析

对应课程第 4 讲的练习（节选，按主题归入本 skill），复习用。

1. **perf stat**。对你选择的一个程序运行 `perf stat`，获取基本性能统计。各个计数器分别是什么意思？
2. **perf record + 火焰图**。把下面程序存为 slow.c，`gcc -g -O2 slow.c -o slow -lm` 编译。运行 `perf record -g ./slow`，再用 `perf report` 看时间花在哪；尝试用 flamegraph 脚本生成火焰图。

   ```c
   #include <math.h>
   #include <stdio.h>

   double slow_computation(int n) {
       double result = 0;
       for (int i = 0; i < n; i++) {
           for (int j = 0; j < 1000; j++) {
               result += sin(i * j) * cos(i + j);
           }
       }
       return result;
   }

   int main() {
       double r = 0;
       for (int i = 0; i < 100; i++) {
           r += slow_computation(1000);
       }
       printf("Result: %f\n", r);
       return 0;
   }
   ```

3. **hyperfine 对比**。用 hyperfine 对同一任务的两个不同实现做基准（例如 find vs fd、grep vs ripgrep，或你自己的两版代码）。
4. **htop + taskset**。运行一个资源密集程序时用 htop 监控系统；再用 `taskset --cpu-list 0,2 stress -c 3` 限制进程可用的 CPU。为什么 stress 没能用满三个 CPU？
5. **端口被谁占了**。先执行 `python -m http.server 4444` 在 4444 端口起一个最小 Web 服务器，在另一个终端运行 `ss -tlnp | grep 4444` 找到占用进程，用 `kill <PID>` 终止它。

> 改编自 MIT The Missing Semester 课程 Lecture 4: Debugging and Profiling（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=8VYT9TcUmKs
