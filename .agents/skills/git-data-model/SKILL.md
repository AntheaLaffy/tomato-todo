---
name: git-data-model
description: >
  Git 数据模型：blob/tree/commit、快照 DAG、内容寻址（SHA-1）、引用与 HEAD、暂存区——
  先理解模型再记命令，每条命令都只是对提交 DAG 的操作。手动点名使用。
disable-model-invocation: true
---

# Git 数据模型

主线：Git 的界面是漏水的抽象，自顶向下背命令只会得到一堆「魔法咒语」，出问题就抓瞎；但底层设计是美的——丑陋的接口只能死记，美丽的设计可以被理解。本 skill 自底向上讲模型：懂了模型，命令就只是对模型的机械操作。

## 快照：blob、tree、commit

- 文件 = blob（一堆字节）；目录 = tree（名字 → blob 或 tree 的映射）；快照 = 被跟踪的顶层 tree。伪代码：

  ```
  type blob = array<byte>
  type tree = map<string, tree | blob>
  type commit = struct {
      parents: array<commit>
      author: string
      message: string
      snapshot: tree
  }
  ```

- 每个提交对应一个完整快照——Git 的模型是「整张照片」而非增量；`git diff` 只是把两个快照算出来的差异视图。

## 历史：提交 DAG

- 历史不是线性列表，而是有向无环图（DAG）：每个快照（commit）指向它的父快照集合。因为有 merge，一个提交可以有多个父提交——两条并行开发线合并出含双方特性的新快照。
- 提交不可变：改历史其实是造新提交，再把引用指过去。

## 对象与内容寻址

- blob、tree、commit 统一为 object；仓库 = objects + references，仅此而已。
- 所有对象按 SHA-1 哈希内容寻址：`objects = map<string, object>`——树里存的不是内容而是哈希指针（`git cat-file -p` 看内容、`-t` 看类型，可传引用名或哈希）。SHA-1 把任意字节串确定性地压成 160 位定长值：内容相同哈希必同，不同内容几乎必不同。
- 内容相同只存一份、可校验。不可变的深层原因：节点按内容哈希互指，改中间任何对象，它的哈希就变，所有指向它的节点全部失效——所以只能追加，不能改。

## 引用与 HEAD

- 人记不住 40 位十六进制哈希 → references：人类可读的名字指向 commit。对象不可变，引用是唯一可变的入口。master/main 只是约定名，叫什么都可以（旧默认 master，GitHub 现默认 main）。
- 分支 = 一个指向 commit 的引用，仅此而已：它不跟踪世系（世系由 commit 的 parent 链表达）。删掉分支名，历史还在。
- 「我现在在哪」= 特殊引用 HEAD：新提交的 parents 由它决定。HEAD 直接指向 commit（而非分支）时是 detached HEAD 状态——此时的新提交没有分支跟随，可能被垃圾回收。
- 活跃历史 = 从所有引用可达的提交图；不可达对象会被自动垃圾回收。近期误删误移可以用 `git reflog`（引用的历史日志）找回。

## 暂存区

- 快照不直接取自工作目录，而是经暂存区挑选要进下一个快照的修改：两个特性可拆两个提交；调试 print 可与 bugfix 分离，只提交后者——想干净快照，就需要它。

## 心法

- 敲任何命令时想它加了什么对象、更新了什么引用；反过来，想对 DAG 做某种改动（「丢弃未提交改动、让 master 指到 5d83f9e」），就有对应命令（`git checkout master; git reset --hard 5d83f9e`）。
- Git 的高层命令集叫 porcelain（瓷器），直接操作对象的底层命令叫 plumbing（管道）——后者日常不用，但 `cat-file` 这类命令能验证你对模型的理解。
- 深入阅读：[Git for Computer Scientists](https://eagain.net/articles/git-for-computer-scientists/)（图多、代码少）、[Git from the Bottom Up](https://jwiegley.github.io/git-from-the-bottom-up/)（实现细节）。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 5: Version Control and Git（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=9K8lB61dl3Y
