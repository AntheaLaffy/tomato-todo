# 皮肤与界面规范（SKIN.md）

目标：插件加载后，整个 DSH 就是「番茄 Todo · 学习空间」——不是打开一个面板，
而是打开就进入慢慢的学习氛围；对话（学习助手）仍在，但外壳、配色、背景、
状态提示、专注沉浸全部由番茄接管。

本文是 UI 工作流的唯一视觉与集成基准。动手前先读本文 + [LEGACY_FEATURES.md](LEGACY_FEATURES.md)
（功能面）+ [API.md](../API.md)（数据面）。实现分支的组件不得自造色值、字号或圆角。

---

## 0. DSH 集成点（已确认可用）

| 位置 | slot / API | 用途 |
| --- | --- | --- |
| 主视图 | `main` keyed，register key `tomato` | 番茄应用页（九页导航）占据中央栏，像 DSH 自带的插件页 |
| 侧栏图标 | `sidebar.panellist` id=`tomato`（owner props `{size, active}`） | 点击进入主视图；id 即 main 的 key |
| 会话内常驻 | `shell.overlay`（list，order 升序） | 背景氛围层、专注 HUD、沉浸层、toast |
| 输入框上方 | `conversation.composer.dock` | 极简「今日专注」入口卡（保留，不做主界面） |
| 主题 | `ctx.theme.register({id, colorScheme, tokens})` + `ctx.theme.setTheme(id)` | 全 DSH 皮肤：注册 `tomato`（light）/`tomato-night`（dark），插件加载时按当前色彩方案选中对应项 |
| 消息链路 | `ctx.locale`、`ctx.layout.selectPanel("tomato")`、`ctx.timer` | 本地化、跳转、定时器 |

皮肤只在插件自身代码内生效：**不改 DSH 包、不写 profile**。

## 1. 气质与三条原则

1. **慢慢来**：一切动效缓慢（≥300ms，氛围循环 20–60s），没有弹跳、没有强对比闪动。
   加载用淡入 + 极轻微上浮（8px），页面切换 240ms 交叉淡入。
2. **纸与光**：奶油纸底、暖色纸纹、右上窗光、轻噪点；深色是「夜读灯下」而不是纯黑。
3. **留白优先**：大标题、少边框、分隔靠色块与留白；卡片圆角 16px、内边距 20–28px。

不做的：霓虹渐变、玻璃拟态堆叠、彩色阴影、纯装饰的浮动卡片。动效尊重
`prefers-reduced-motion`（关闭漂移与循环，保留 0–120ms 的必要过渡）。

## 2. 色板（CSS 变量，注入为全局样式；组件只用 `var(--tomato-*)`）

浅色（晨光 `tomato`）：

```
--tomato-paper:        #f7f1e5   /* 应用底色 */
--tomato-surface:      #fffdf7   /* 卡片 */
--tomato-surface-2:    #f1e9da   /* 次级面/表头/输入底色 */
--tomato-surface-3:    #e9dfcc   /* 悬浮、选中行 */
--tomato-ink:          #3b3128   /* 主文字 */
--tomato-ink-2:        #7c6c59   /* 次级文字 */
--tomato-ink-3:        #a2927d   /* 三级文字、占位 */
--tomato-line:         #00000014 /* 1px 线 */
--tomato-line-strong:  #00000024
--tomato-brand:        #d96d55   /* 番茄红：主按钮、进度、强调 */
--tomato-brand-deep:   #b9573f
--tomato-brand-soft:   #f6e0d6   /* 品牌浅底（选中/标签） */
--tomato-accent:       #e9a178   /* 暖橙（次强调、图表第二色） */
--tomato-leaf:         #7e9a6e   /* 完成、习惯 */
--tomato-sun:          #d5a553   /* 提醒、警示 */
--tomato-plum:         #a97c8f   /* 第四图表色 */
--tomato-shadow:       0 10px 30px -12px #6b4a2f2e
```

深色（夜读 `tomato-night`）：

```
--tomato-paper:        #1c1916
--tomato-surface:      #262019
--tomato-surface-2:    #2e2822
--tomato-surface-3:    #3a322a
--tomato-ink:          #f2eadf
--tomato-ink-2:        #b3a593
--tomato-ink-3:        #86796a
--tomato-line:         #ffffff14
--tomato-line-strong:  #ffffff24
--tomato-brand:        #e8886c
--tomato-brand-deep:   #d2705a
--tomato-brand-soft:   #4a2f28
--tomato-accent:       #d99a72
--tomato-leaf:         #93ab84
--tomato-sun:          #dcb06b
--tomato-plum:         #b98fa2
--tomato-shadow:       0 14px 34px -16px #00000078
```

顺延到 DSH 自带 token（`ctx.theme.register`，浅深各一套）的映射：

| DSH token | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-bg-base` | `#f7f1e5` | `#1c1916` |
| `--dsw-alias-bg-layer-1` | `#fffdf7` | `#262019` |
| `--dsw-alias-bg-layer-2` | `#f1e9da` | `#2e2822` |
| `--dsw-alias-bg-overlay` | `#fffdf7` | `#262019` |
| `--dsw-alias-bg-multi-select` | `#f1e9da` | `#2e2822` |
| `--dsw-alias-border-l1` | `#00000014` | `#ffffff14` |
| `--dsw-alias-border-l2` | `#0000001f` | `#ffffff1f` |
| `--dsw-alias-border-l3` | `#00000024` | `#ffffff24` |
| `--dsw-alias-border-l4` | `#00000033` | `#ffffff33` |
| `--dsw-alias-brand-primary` | `#d96d55` | `#e8886c` |
| `--dsw-alias-label-primary` | `#3b3128` | `#f2eadf` |
| `--dsw-alias-label-secondary` | `#7c6c59` | `#b3a593` |
| `--dsw-alias-state-success-primary` | `#6f8f60` | `#93ab84` |
| `--dsw-alias-state-warn-primary` | `#c2913f` | `#dcb06b` |
| `--dsw-alias-state-error-primary` | `#b8503f` | `#e07f6a` |
| `--dsw-alias-state-idle-primary` | `#a2927d` | `#86796a` |
| `--dsw-specific-sidebar-fill` | `#f4ecdd` | `#221d18` |

统一用固定值（不引用 `--tomato-*`），避免皮肤样式与 DSH 主题加载顺序耦合。

## 3. 氛围层（打开 DSH 就存在，非面板）

结构（从底到顶）：

1. **`html/body` 背景**：`--tomato-paper` + 右上角窗光（两个大半径 radial-gradient，
   暖白 `#fff6e4` 与品牌浅 `#f3d9c8`，透明度 0.55/0.35）+ 极轻纸纹
   （内联 SVG feTurbulence，opacity ≤ 0.035，`background-size: 180px`）。
2. **远景插画层**（注入 body 的固定层 `#tomato-ambient`，`z-index:0; pointer-events:none`）：
   右下角线描「书桌一角」——台灯 + 摊开的书 + 一株番茄苗，笔触 1.5px、颜色
   `--tomato-ink-3` 30% 透明度，约 520×360，随视口缩放；左侧一条淡淡的竖排小字
   「今天，也要慢慢向前。」（竖排 12px，`--tomato-ink-3`，32% 透明度）。
3. **悬浮微粒层**：同一层内 8–12 个 2–4px 的暖白圆点，`opacity .25–.5`，
   `animation: tomato-drift` 24–48s 线性无限、错开延时，向上缓慢漂移并轻微左右摆动。
4. **内容栏**：DSH 三栏照常，背景用 `--dsw-alias-bg-base`（已换成纸色），
   中心栏不透明以保证对话可读；侧栏 `--dsw-specific-sidebar-fill` 偏暖。
5. **窗光洗层**（`shell.overlay`，order -1000，pointer-events:none）：一层
   `linear-gradient(160deg, #fff2dbb3, transparent 42%, #e7b98f14)`，mix-blend-mode
   `soft-light`，「光落在屏幕上」的细微层次；深色改为 `#ffd9a712` 的左上暖光。

时间感知：06–11 晨光（默认）；11–17 暖白；17–22 琥珀（`--tomato-ambient-hue` 滤镜）；
22–06 夜读（低饱和 + 更暗）。用 `data-tomato-daypart` 属性切 CSS，不做 JS 重绘。

**实现现状（天空层）**：DSH 的 AppFrame 用不透明 `--dsw-alias-bg-base` 铺满视口，
注入 body 的地面层会被整块盖住。因此氛围实际分两层：
`#tomato-ambient`（body 地面层，结构同上，壳层透明化时可见）+ `#tomato-sky`
（注册到 `shell.overlay`、order −1000 的天空层：窗光洗层、漂移微尘、右下角线描插画，
`pointer-events:none`、透明度 ≤ .10/.07、插画用 radial mask 从右下渐隐，中心栏不落笔触）。
天空层叠在内容之上，是「屏幕反光」而非不透明度遮挡；正文对比度实测仍 ≥ 8:1（浅）/12:1（深）。
两个可调参数：`--tomato-wash`（洗层）与 `--tomato-sky-art`（插画）；`prefers-reduced-motion`、
`data-tomato-motion=lite`、`forced-colors` 全部降级。

**对比度约定**：正文承载面上的文字必须 AA（≥4.5:1）。亮番茄 `#d96d55` 只用于图标/进度/链接，
按钮底色用 `--tomato-btn-fill`（浅 `#b9573f` / 深 `#e8886c`），强调文字用 `--tomato-accent-fg`
（浅 `#a0442f` / 深 `#e8886c`）。

**渲染策略**：注入层用原生 DOM（不占 React 树），插件 dispose 时移除；CSS 集中在
`skin/styles.js` 生成的一支 `<style id="tomato-skin">`（含 keyframes、纸纹、滚动条、
`::selection`、`#root` 入场淡入 520ms）。**不改 DSH 类名**：所有选择器只允许
`html`/`body`/`#root`/`#tomato-*`/`[data-tomato-*]`。

## 4. 界面结构

### 4.1 主视图（`main` key `tomato`）

```
┌ 左导航 232px ──────────┬ 内容区（max 1180px，padding 36–48px）────────────┐
│ 番茄标志 + 「番茄 Todo」│ 页头：eyebrow（日期/星期）+ 大标题 + 副标题 + 右侧动作 │
│ 「慢慢来，比较快」      │ 页面内容（见 4.3）                                  │
│ 今日专注 / 全部任务 /   │                                                   │
│ 习惯愿景 / 数据统计 /   │                                                   │
│ 本周日程 / 应试教育 /   │                                                   │
│ 专注保护 / 定时锁机 /   │                                                   │
│ 偏好设置                │                                                   │
│ 今日进度小环 3/8        │                                                   │
│ 所有更改已保存到本机     │                                                   │
└────────────────────────┴────────────────────────────────────────────────────┘
```

- 导航项：24px 线性图标 + 14px 标签 + 右侧计数（今日待办/未完成数）；选中用
  `--tomato-brand-soft` 底 + 左侧 3px 品牌竖条；hover 用 `--tomato-surface-3`。
- **全屏接管**：进入番茄页时主视图 `position: fixed; inset: 0`（不设 z-index，
  让 `shell.overlay` 的 HUD/提醒/沉浸仍在页面之上），并收起 DSH 侧栏（离开时还原）；
  导航底部「学习助手」切回对话面板，DSH 界面随之恢复。番茄页里不应再看到 DSH 的
  侧栏与对话头部。
- 主视图背景就是纸色（不透明度 100%），氛围层在 DSH 外壳可见；用户切回对话时
  仍有氛围与 HUD。
- 宽度 < 960px 时导航折叠为顶部横向滚动 chips。

### 4.2 对话中的常驻组件

- **番茄预计/实际**：只放在**工作区列表下方的左侧栏底部**入口条目（`sidebar.footer.action`，
  满宽一行、上方分隔线）：番茄图标 + 「番茄 Todo」+ 右侧 N/目标 + →；与番茄页导航底部的
  「学习助手 →」行位置对称。左上角面板列表（`sidebar.panellist`）不再重复放图标——
  该槽位只能渲染在工作区之上，无法下移，保留会造成两个入口，
  样式与番茄页里的「学习助手」入口一致：番茄图标 + 「番茄 Todo」+ 右侧计数标签
  「N / 目标」（专注中显示倒计时）；侧栏收起成窄条时只留图标 + 计数。点击进入番茄页。
  不放在输入框下方那条最底部的面板里（不显眼），也不放右上角。番茄页导航底部同样显示进度。
  右上角 HUD 空闲时不出现，只在专注/暂停/保护生效时显示倒计时。
- **到点提醒 + 开始专注**：放在**对话顶栏**（`conversation.header.leading`，会话标题左侧）：
  「🍅 番茄 Todo · N」入口胶囊旁边一条紧凑提醒「现在 09:40 · 项目 · 任务名 · [稍后][开始专注]」；
  番茄页内则显示在内容顶部（不进浮层）。
- **专注 HUD**（`shell.overlay` 右上角，页头下方 12px，右 20px）：46px 圆角胶囊，
  `--tomato-surface` 底 + 细边 + `--tomato-shadow`；含小番茄进度环（今日分钟/目标）、
  计时状态文字（「专注中 44:59」/「未开始」）、可点开迷你控制（开始/暂停/结束/进入主视图）。
  专注进行中时环缓慢呼吸（4s），数字每分钟更新；沉浸模式时隐藏。
- **入口卡**（`conversation.composer.dock`）：沿用现有 DockCard 的位置与信息，
  改成一句话 + 两个 chip：「现在专注 45 分钟」/「查看今天」。hover 上浮 1px。
- **Toast**：底部居中、纸色卡、8s 淡出；同一时刻最多 1 条。

### 4.3 九个页面（功能清单见 LEGACY_FEATURES.md）

| 页面 | 关键视觉 |
| --- | --- |
| 今日专注 | 问候语大字（「今天，也要慢慢向前。」）+ 日期；3 张统计卡；左侧 300px 计时环卡（环 12px 粗、进度端点小圆、中央 64px 等宽数字、下方模式 segmented + 任务选择 + 开始按钮）；右列今日待办卡（tab 待完成/已完成，行内提醒/项目/专注时长）+ 本周节奏条形卡 |
| 全部任务 | 工具条（搜索、项目筛选、排序、优先级、多选）+ 按项目分组的任务列表（行高 56px，勾选框为 20px 圆环，完成后标题划线 + `--tomato-ink-3`）+ 底部内联「添加一个想完成的任务」 |
| 习惯愿景 | 习惯卡（名称 + 7 日点阵 + 连续 N 天 + 缺勤计数）；愿景卡（无完成态，只有方向箭头与一句话） |
| 数据统计 | 4 数字卡 + 近 7 天条形图（品牌色，圆角顶）+ 项目时间分布（横条，配色板顺延）+ 近两周每日记录表 + 专注足迹列表 |
| 本周日程 | 周切换 + 7 列网格（时间轴 07:00–24:00，60px/小时）+ 课程/考试/阻塞时段色块（项目色 12% 底 + 3px 左边）+ 冲突红点提示 |
| 应试教育 | 项目卡（目标倒计时大字）+ 今日学习任务 + 需要处理（待交/待订正/待复核）+ 接下来一周 + 最近学情；点卡片进项目详情 |
| 专注保护 | 三张模式卡（自由专注/界面锁定/应用白名单，选中态品牌描边）+ 严格模式开关 + 白名单编辑器（应用 chip + 手动输入 app id + 刷新）+ 语义说明段 |
| 定时锁机 | 「现在休息一会儿」分钟 chips（2/5/10/25/60/自定义）+ 严格开关 + 开始按钮；固定休息时段列表 + 时段编辑对话框（跨午夜校验） |
| 偏好设置 | 分区卡片：专注与休息 / 学习计划（导入导出计划）/ 体验与提醒（主题、背景板、音效、通知）/ 桌面集成 / 网络代理 / 数据与备份；字段行式布局，离开时统一保存 |

### 4.4 沉浸式专注（`shell.overlay` order 900，全屏）

- 底：同一套纸色 → 深一档的暖色渐变 + 极慢的呼吸光斑（8s 各向）。
- 顶部居中状态徽章（「应用白名单保护中」/「界面锁定中」/「休息锁机中」）。
- 中央：44:59 巨型等宽计时（clamp 96–160px）、下方「此刻，只做这一件事。」、
  当前任务名（品牌色，20px）。
- 下方：白名单提示（允许使用 N 个应用）、`查看今天日程`、`选择背景音`、
  `有急事，提前结束`。
- 右下角：`退出沉浸模式`（minimize 图标）。ESC 不直接退出（严格模式需确认）。
- 结束确认对话框（Legacy 2b）：标题、说明、输入「结束专注」确认、「提前完成」/「结束并解锁」。

## 5. 组件与代码约定

- 客户端源码在 `plugin/src/client/`，用 esbuild 打包成 `plugin/client.js`
  （`pnpm build:client`）。**禁止手改 client.js**。
- 共享件（只由 lead 修改）：`runtime.js`（React/hooks/token 桥）、`shared/ui.js`
  （Card/Button/Chip/Ring/Bar/Field/Toggle/Segmented/Modal/Menu/Empty/Skeleton/Toast）、
  `shared/icons.js`、`shared/copy.js`（`registerCopy(ns,{zh,en})` + `t(ns,key,vars)`）、
  `shared/store.js`（快照 + dispatch + 订阅）、`shared/api.js`。
- 页面模块导出 `{ id, order, titleKey, icon, Component }` 并 `registerPage(...)` 自注册；
  只改自己的文件。样式全部 inline style + `var(--tomato-*)`，不写 CSS 文件、
  不引用 DSH client 包、不写死中文（走 copy）。
- 颜色只用第 2 节变量；作品图形（计时环、番茄标记）可以用品牌色实色。
- 数字用 `font-variant-numeric: tabular-nums`；等宽数字用 `'JetBrains Mono', ui-monospace`。
- 可访问性：按钮 ≥32px 触摸区、`aria-label`、可见 focus ring（2px `--tomato-brand` 40%）。
- 深色主题：变量自动切换，组件不得用 `#fff`/`#000` 之类绝对色（作品图形除外）。
