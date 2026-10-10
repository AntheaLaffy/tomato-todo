---
name: tomato-files
description: 安全批量编辑番茄 Todo 备份 v3 与计划 v4 文件；用于任务/模板/目标/愿景重排，通过导出、JSON Pointer、原子 Patch、校验与审阅保护稳定 ID 和学习进度。
---

需要变更软件数据时使用以下流程，不输出整份备份：
1. 调用 export_plan 或 export_backup，使用新的 ASCII .json 文件名。计划只管理安排配置，优先用于学习规划；备份包含历史、状态和设置。
2. 用 read_skill 读取 references/PLAN_FORMAT.md 或 references/BACKUP_FORMAT.md，必要时读对应 schema；节点调整读 references/NODE_DESIGN.md。参考文件随应用打包，不能凭记忆猜测字段。
3. read_file 按 /tasks、/goals、/templates 或具体数组位置分段读取。先匹配稳定 ID 再确定数组索引；不要重新编号、回收删除 ID、改写完成记录、虚构专注时长或覆盖成功/失败裁定。
4. patch_file 每次带最新 fileHash，先 test 关键 ID/旧值再 replace/add/remove，一次最多200项。所有编辑成功后才原子写入。插入/删除数组项后重新读取确认索引；不要使用旧位置继续改动。
5. review_file 带最新 fileHash。校验失败就修复候选文件；来源版本冲突则重新导出，将“变更意图”重放到最新文件，不能恢复旧软件状态。计时自然更新也可能使完整备份过时。
6. 向用户呈现文件名、具体变化、理由、未确认假设及导入影响。完整备份导入会暂停计时、解除导入的当前锁机并停用定时锁机；计划导入保留进度和裁定。应用由用户在界面确认，工具没有直接应用权限。

只改单项时也可以生成小文件方案。保护中不建议导入；不能紧急解锁、绕开严格模式、改变不可逆决定或把私人学习数据塞进默认种子。
