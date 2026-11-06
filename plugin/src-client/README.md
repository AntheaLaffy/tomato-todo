# plugin/src-client — client.js 部件源文件

`plugin/client.js` 是浏览器端唯一入口（`window.__ModuleLoader__.load`，无打包器）。
本目录是它的**拼接源**：把每个部件文件的全部内容原样复制进 client.js 工厂函数体内、
替换对应的占位组件函数，client.js 才算完整。`src-client/` 不在 package.json 的
`files` 白名单里，不随包分发；随包的是组装后的 `client.js`。

## 通用约定（所有部件必须遵守）

1. **不是模块**：无 `import`/`export`/顶层 `return`。整个文件 = 若干 `function`
   声明 + 若干 `const` 常量 + 最多两次 `Object.assign(COPY.zh, …)` / `(COPY.en, …)`。
   文件顶部写一行注释说明它是拼接源。
2. **只依赖工厂作用域已有名字**（见下），不得重新声明同名变量；部件之间不得互相引用。
3. **样式**：全部走 React `style` 内联对象；颜色只允许用 `T`（`--dsw-alias-*` token）。
   奶油白 `#faf8f4` 与番茄红 `#d96d55` **只允许**出现在作品类图形上（番茄标志、
   计时环、统计条形），禁止用作容器底色或文字色——主题继承优先，深色主题下也要能看。
4. **文案中英双语**：部件新增的每一条文案都带前缀（FocusTab/TasksTab 用 `fa_`/`ta_`，
   StatsTab/SettingsTab 用 `st_`/`se_`），经 `Object.assign(COPY.zh, {...})` 与
   `Object.assign(COPY.en, {...})` 并入后，用 `t(copy, key, vars)` 取用
   （`vars` 形如 `{n: 3}`，替换 `{n}` 占位）。不要复用既有 COPY key，前缀保证零冲突。
5. **辅助函数/常量前缀**：`fa_`、`ta_`、`st_`、`se_`，防命名冲突。
6. **网络**：读用 `fetchJson`（超时秒数传 `timeoutMs`），写用 `sendJson(path, method, body)`；
   写失败在组件里显示本地错误行（如 `t(copy, '…writeFailed')`），**事件处理器里不抛异常**；
   写成功后调 `props.refresh()`。轮询用 `props.every(fn, ms)`（返回清理函数），
   mount 时立即取一次，`useEffect` 返回清理函数。发请求前先过 normalizer，容忍多种字段名。

## 工厂作用域可用名字（client.js 提供）

`h`（= React.createElement）、`React`、`useState`、`useEffect`、`useMemo`、
`useRef`、`useCallback`、`T`（主题 token 表）、`t(copy, key, vars)`、
`API_BASE`（`http://127.0.0.1:43987`）、`fetchJson(url, {method, body, timeoutMs})`、
`sendJson(path, method, body)`、`COPY`（zh/en 文案表）、
`normalizeToday(p)`、`normalizeHealth(p)`、`normalizeSnapshot(s)`、
`TomatoIcon({size})`、`StatusDot({ok, size})`。

normalizer 返回值（字段未定稿，形状以 runtime 工作流为准，这里只做容忍式收窄）：

- `normalizeToday(p)` → `{ today, dueCount, focusMinutes, tasks, timer }`
  （`tasks` 为数组或 null，`timer` 为对象或 null）
- `normalizeHealth(p)` → `{ ok, version, service, dataDir, guard }`
  （`guard` → `{ available, backend, message, locked, whitelist, pid }` 或 null）
- `normalizeSnapshot(s)` → `{ tasks, projects, timer, stats, today }`

## 组件签名（props 驱动）

| 文件 | 必须定义 | props | 数据来源 |
| --- | --- | --- | --- |
| `tabs-a.js` | `FocusTab`、`TasksTab` | 见下 | 见下 |
| `tabs-b.js` | `StatsTab`、`SettingsTab` | 见下 | 见下 |

- `FocusTab({ copy, snap, refresh, every })` — 番茄计时 UI。自取 `GET /api/today`
  （mount 立即 + `every(…, 3000)` 轮询），渲染计时环（作品图形可用 `#d96d55`）、
  状态（running/paused/idle）、模式与轮次、今日待办清单与投入分钟数；
  控制按钮走 `POST /api/focus/start|pause|stop` 骨架（请求体 `{}`，成功后
  `refresh()` + 重取 today；失败显示错误行，按钮防重复提交）。
- `TasksTab({ copy, snap, refresh })` — 任务列表（`snap.tasks`）：未完成在前，
  按截止排序；勾选完成 → `POST /api/tasks/:id/complete`（体 `{}`），成功后 `refresh()`；
  新建任务 → 输入框回车或按钮 `POST /api/tasks`（体 `{ title }`），成功后清空并
  `refresh()`。完成行划线，行内防重复提交。
- `StatsTab({ copy, snap, every })` — 自取 `GET /api/stats`（mount 立即 +
  `every(…, 30000)`），`snap.stats` 仅作首屏回退。渲染数字卡（今日投入/今日番茄/
  今日完成/连续天数/累计投入）+ 近七天条形图（条形用 `#d96d55` 作品色，日期标签
  用 `copy.days` 的星期数组）。
- `SettingsTab({ copy, hlt, every })` — 只读状态展示：`GET /health` 数据
  （面板已轮询经 `hlt` 传入，本页签 mount 时自取一次 + `every(…, 30000)` 刷新）。
  分三张卡：运行时（service/version/连接状态）、专注保护 guard
  （available/backend/locked/白名单数/PID，未接入时显示说明）、数据目录 dataDir；
  底部一句「只读」说明。

## 数据形状假设（与 runtime 工作流对齐用，读入侧必须容忍）

```
GET /api/today → { today, dueCount, focusMinutes,
                   tasks: [{ id, title, completed, dueDate?, reminderTime? }],
                   timer: { status: 'running'|'paused'|'idle',
                            mode: 'focus'|'short'|'long',
                            remainingSeconds, totalSeconds, cycle? } }
GET /health    → { ok, service, version, dataDir,
                   guard: { available, backend, message?, locked, whitelist, pid } | null }
GET /api/stats → { todaySeconds, todayPomodoros, todayCompleted, streakDays, totalSeconds,
                   days: [{ date, seconds } × 7] }
```

## 流程

1. 写 `tabs-a.js` / `tabs-b.js`（只写自己的文件，不提交别的改动）。
2. 自检：`node --check plugin/src-client/tabs-a.js`（只查语法；作用域名字在拼接后才有）。
3. 在所在分支提交自己的文件，然后 `agent_message` 向 parent 汇报（含 commit hash
   与关键取舍）。

拼接由组长完成：把文件内容复制进 client.js 替换占位组件，再做整体 `node --check`。
