## CODEMAP Navigation Protocol

Mode: maintenance. 从 [CODEMAP.md](CODEMAP.md) 开始导航。

- 先匹配任务指南中的 Target；仅在任务相关或接口影响明确时读 Also Check。
- 无匹配时沿 Domain 和子目录地图定位；大文件使用 `.analysis.md` 的功能索引。
- 修改公开接口时核对 Rust 核心、桌面/预览适配层和 TypeScript 消费方。
- 批量读取独立目标，核对过期路径与行号；新增、删除和改动后同步局部地图。
- 地图范围遵循根 Scope and Exclusions；每个纳入的文件或目录只有一个局部所有者。
- 专注保护测试必须使用独立嵌套桌面，不得在用户当前桌面自动启用保护。
- 不把私人课表、备考资料或测试数据库写入默认种子和安装包。
- 个人学习计划、课表与作息在 `/home/fuurin/study/考研时间规划/`（不入库）；规划学习任务前先读该目录的 `我的情况-给智能体.md` 与 `课表补充-时间说明.md`。
