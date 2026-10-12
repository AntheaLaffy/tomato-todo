---
name: dev-environment
description: >
  开发环境：IDE vs 终端工作流取舍、语言服务器与 LSP（补全/跳转定义/查找引用）、AI 驱动开发
  （注释引导补全/内联聊天/代理）、扩展（dev containers/Remote SSH/Live Share）、推荐软件。
  Use when the user asks to set up or debug an IDE, language server, AI autocomplete, or editor
  extension. 触发于「帮我配 IDE/语言服务器/AI 补全/装扩展」。
---

# 开发环境

主线：开发环境 = 文本编辑 + 语法高亮、类型检查、代码格式化、自动补全。两条路：图形 IDE（如 VS Code）开箱易用、AI 集成完善；终端工作流（tmux + Vim + Zsh + 语言工具如 Ruff/Mypy）更轻量，无 GUI 或装不了软件的环境里甚至唯一可选。两者都建立基本熟悉度、至少精通一种；没有偏好的从 VS Code 开始。

## 语言服务器与 LSP

- 语义级语言功能靠扩展连接实现了 Language Server Protocol 的语言服务器：VS Code 的 Python 扩展依赖 Pylance，Go 扩展依赖官方 gopls。
- 装好扩展和语言服务器可得：补全（输入 `object.` 看到字段和方法）、悬停内联文档、跳转到定义、查找引用、导入辅助（整理/删未用/标缺失 imports）、代码质量（格式化、类型检查、linter——代码质量一讲展开）。
- 配置要点：有的语言装完即用；有的要把 IDE 指向你的环境（如 VS Code 选 Python 解释器），语言服务器才看得到已装包；个别语言服务器有专项设置（如无类型注解的项目可关静态类型检查）。

## AI 驱动的开发

- 三种形态：**自动补全**（光标处给出补全，可用代码注释、清晰的函数名+docstring 引导；局限是只能补光标之后——比如 `import re` 会补在函数内部，更好的实践是模块级导入）；**内联聊天**（选中一段代码发提示，能改已有代码）；**编程代理**（见 Agentic Coding 一讲）。
- 注释引导示例：`def extract(content: str) -> list[str]:` 加注释「从内容中提取所有 Markdown 链接」，模型会补出 `import re` + `re.findall(pattern, content)` 的正确版本。
- 推荐软件：VS Code + GitHub Copilot 扩展、Cursor；Copilot 对学生/教师/热门开源项目维护者免费。此领域变化极快，头部产品功能大致相当。**中国大陆注意**：Copilot/Cursor 存在网络与政策门槛，国内可用 DeepSeek Harness（dsh）。

## 扩展与远程/协作

- Dev containers：用容器跑开发工具，可移植、可隔离（容器在代码打包与发布一讲展开）。
- 远程开发：VS Code Remote SSH 在远程机器上开发——云上强 GPU 机器场景方便。
- 协作编辑：VS Code Live Share 像 Google Docs 一样同编辑一个文件。
- 逛扩展列表自己探索：[Vim Awesome](https://vimawesome.com/)（Vim 插件）、按安装量排序的 VS Code 扩展列表。

## 练习

学习材料在 `exercises.md`。

> 改编自 MIT The Missing Semester 课程 Lecture 3: Development Environment（讲义 + 口播稿，CC BY-NC-SA 4.0）：https://creativecommons.org/licenses/by-nc-sa/4.0/ · 课程站点：https://missing.csail.mit.edu/ · 讲座视频：https://www.youtube.com/watch?v=QnM1nVzrkx8
