# plugin/src/client — DSH 客户端半源码地图

`plugin/client.js` 是 esbuild 产物（`pnpm build:client`），本目录是唯一可改源码。
视觉基准 [docs/SKIN.md](../../../docs/SKIN.md)，数据面 [API.md](../../../API.md)「UI 数据面」，
功能面 [docs/LEGACY_FEATURES.md](../../../docs/LEGACY_FEATURES.md)。

## 入口与装配

| 文件 | 职责 |
| --- | --- |
| `entry.js` | `window.__ModuleLoader__.load({id, factory})`，只注册工厂 |
| `plugin.js` | `installRuntime(require)` → `registerSkin(ctx)` → `registerApp(ctx)`；声明 inject |
| `runtime.js` | React/hooks 活绑定（`h`/`useState`…），工厂只拿 `require` |
| `skin/main.js` | 皮肤装配：样式表 + 氛围层 + 主题令牌覆盖 + 品牌位替换 |
| `app/main.js` | 挂 main panel `tomato`、侧栏番茄入口、shell.overlay（HUD/沉浸）、composer dock |
| `app/immersive.js` | 沉浸视图与锁机倒计时；经 `shared/api.js` 请求 runtime 控制 DSH 原生全屏，锁机状态强制显示 |

## 目录

| 目录 | 内容 | 所有者 |
| --- | --- | --- |
| `skin/` | `theme.js`（`--dsw-alias-*` 覆盖）、`styles.js`（`--tomato-*` 变量/氛围 CSS/组件 CSS）、`ambient.js`（`#tomato-ambient` 地面层 + `#tomato-sky` 天空层/插画/微粒/时段）、`prefs.js`（氛围开关与手动时段）、`settings-row.js`（DSH 设置-通用的「番茄氛围」行） | 皮肤工作流 |
| `app/` | `frame.js` 主视图框架（导航+页面容器）、`registry.js` 页面注册表、`navigation.js` 唯一导航入口（`navigate({page, reason})`、`shouldGrab` 判定表、`restore()`、`{panel, page}` 持久化与旧 key 迁移、项目筛选信号）、`attention.js` 到点音效的纯跃迁判定、`hud.js` 常驻 HUD（播音效，一轮结束才切页，提醒不抢对话）、`immersive.js` 沉浸层与结束确认、`sound.js` WebAudio 背景音与节点音效、`reminders.js` 提醒横幅、`dock.js` 输入框入口卡、`overlay.js` 宿主（启动判定）、`nav-copy.js` 导航文案、`persona.js` 看板娘浮层与角色切换列、`sidebar-progress.js` DSH 左侧导航入口、`assistant-prompt.js` 作业动作的学习助手草稿（带稳定记录 ID，引 `tomato_*` Host 工具） | lead（HUD/沉浸/音效属沉浸工作流） |
| `pages/` | 九页：`focus` `tasks` `habits` `stats` `calendar` `education`（含共享库索引卡、项目资料目录浏览/预览/单条登记）`guard` `schedule` `preferences`，各自 `registerPage` 自注册；对话框 `task-dialog` `search` `template-dialog` `print-dialog`；`stub.js` 占位工厂 | 页面工作流 |
| `shared/` | `api.js` HTTP 数据面、`store.js` 快照/dispatch/轮询、`derive.js` 派生视图、`ui.js` 组件库、`ui.css.js` 状态样式、`icons.js` 线性图标、`copy.js` zh/en/ja 注册表（按 DSH locale 选语言并订阅切换）、`ja.js` 日语文案 | lead |

## 约定

- 页面组件：`function Page({state, dispatch, refresh})`；`state` = `/api/state` 快照；
  写操作 `tryDispatch(action)`；派生只从 `shared/derive.js` 取。
- 颜色只用 `var(--tomato-*)` / `var(--dsw-alias-*)`；文案经 `registerCopy` + `t()`；
  状态样式用 `t-` 类，布局用 inline style。
- 自检：`pnpm check:client`（构建 + 假 DOM/真 React 逐页渲染九页与全部 slot 组件）；
  `pnpm check:client:live` 用运行中 runtime 的真实 `/api/state` 渲染一遍。
