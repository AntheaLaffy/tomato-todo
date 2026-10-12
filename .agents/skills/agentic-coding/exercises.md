# 练习：智能体编程

对应课程第 7 讲的练习（节选，按主题归入本 skill），复习用。

1. **同一任务四种方式**。把同一个编程任务分别用手动编码、AI 自动补全、内联聊天和编程智能体各做一遍，比较体验差异。最佳选择是自己正在开发的项目里的一个小功能；没有合适的，可以考虑 GitHub 上的 good first issue，或 Advent of Code、LeetCode 的题目。
2. **用智能体浏览陌生代码库**。最好在调试或为自己在意的项目添加新功能的背景下进行。想不出合适的，可以试试用 AI 智能体理解 opencode 中安全相关功能的工作原理。
3. **从零氛围编程**。氛围编程一个小应用，不要手动写一行代码。
4. **正则练习 + 工具选择**。用编程智能体完成与代码质量一讲中 Markdown 无序列表正则表达式练习相同的目标。它是通过直接编辑文件来完成的吗？智能体直接编辑文件有什么缺点和局限？想办法提示它不通过直接编辑文件来完成（提示：让它使用第 1 讲里提到的某个命令行工具）。
5. **YOLO 沙箱**。大多数编程智能体都支持某种「YOLO 模式」（如 Claude Code 的 `--dangerously-skip-permissions`）。直接使用不安全；但在虚拟机或容器等隔离环境里运行智能体、再启用自主操作是可以接受的。在你的机器上搭一个这样的环境（Claude Code devcontainers 或 Docker Sandboxes 文档可参考；搭法不止一种）。

> 改编自 MIT The Missing Semester 课程 Lecture 7: Agentic Coding（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=sTdz6PZoAnw
