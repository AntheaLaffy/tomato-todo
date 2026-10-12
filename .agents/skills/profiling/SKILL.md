---
name: profiling
description: >
  性能分析：time 三值、资源监控（htop/btop/iotop/free/lsof/ss）、tidy 数据与绘图、
  CPU profiler（perf/火焰图/callgrind）、内存 profiler（massif）、hyperfine 基准。Use when
  the user asks to profile performance, find bottlenecks, benchmark tools, or investigate
  resource usage. 触发于「帮我分析性能/找瓶颈/benchmark/查内存占用」。
---

# 性能分析

主线：过早优化是万恶之源——先用测量找到真正的热点，再优化热点。算法课教大 O，不教怎么找热点；profiler 与监控工具就是干这个的。本 skill 只做 MIT 讲义的科学面（原理与工具）；与工程策略（艺术面）混合的版本见 dsh 的 `debugging-and-profiling`。

## Timing

- 最简测量：在代码里打印两点之间的耗时。
- 墙钟时间会骗人（别的进程在抢 CPU、在等事件）。`time` 区分三个值：Real 墙钟全程、User 用户态 CPU 时间、Sys 内核态 CPU 时间。例：`time curl` real 272ms，user+sys 只有 107ms——其余在等网络。

## 资源监控

- 慢常常是资源受限。htop（top 增强版）：F6 排序、t 树状层级、h 切换线程显示；btop 监控面更广。
- I/O：iotop 看实时 I/O；内存：free 看总量/使用；打开的文件：lsof 查哪个进程开了哪个文件；网络连接：`ss -tlnp | grep :8080` 查端口被谁占用；每进程网络流量：nethogs、iftop。

## 可视化性能数据

- 人对图形的模式识别远快于数字表。打日志就打成 tidy 数据：`时间戳,值` 的 CSV 或 JSON 结构化日志——事后几乎零成本就能画图。
- gnuplot 一行画 CSV：`gnuplot -e "set datafile separator ','; plot 'latency.csv' using 1:2 with lines"`。
- 深挖用 Python matplotlib / R ggplot2 迭代切片；ggplot2 的 facet 按维度拆子图（按 endpoint、时段拆延迟）最能暴露隐藏模式。
- 例子：延迟随时间图暴露周期卡顿（GC、cron、流量规律）；vector 插入耗时图暴露底层数组翻倍扩容的特征尖峰；按维度 facet 常发现「全局问题」其实只出在某一类。

## CPU Profiler

- 两类：tracing（记录每次函数调用，精确但开销大）与 sampling（约每毫秒采样一次栈，开销低）——生产环境普遍用 sampling。
- perf 是 Linux 标准采样 profiler：`perf stat ./prog` 看总览计数器（cycles、instructions、branch-misses 等）；`perf record -g ./prog` 采样记录调用栈。
- 人读不了大数字表——火焰图：Y 轴调用层级、X 轴耗时占比，可交互缩放。生成：`perf script | stackcollapse-perf.pl | flamegraph.pl > flamegraph.svg`；网页交互版 Speedscope，系统级 Perfetto。
- callgrind（Valgrind 家族）是 tracing profiler：精确调用次数与调用者/被调者关系——`valgrind --tool=callgrind ./prog` 后 `callgrind_annotate` 看文本、`kcachegrind` 看 GUI；比采样慢，可加 `--cache-sim=yes` 模拟缓存行为。
- 语言专属：Python cProfile / py-spy、Go `go tool pprof`、Rust cargo-flamegraph（其实任意编译语言都可用）。

## 内存 Profiler

- Valgrind 的 massif 画堆占用随时间变化：`valgrind --tool=massif ./prog` + `ms_print massif.out.<pid>`——找内存泄漏与过度分配。Python 用 memory-profiler 逐行看内存。

## Benchmark

- 对比两个实现/工具用 hyperfine：`hyperfine --warmup 3 'fd -e jpg' 'find . -iname "*.jpg"'`——自动热身、多次运行、报均值 ± σ 与倍率。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 4: Debugging and Profiling（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=8VYT9TcUmKs
