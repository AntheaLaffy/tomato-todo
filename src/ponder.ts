// 概念讲解（Ponder）：把指针停在任意已登记的概念上，按住 G 就能看到它是什么、
// 为什么这样设计、以及做错了会怎样。
//
// 参考 folia-major 的 Ponder 交互（悬停出胶囊、长按进入），但这里没有 React：
// 应用每次 accept 都会重写 #app.innerHTML，所以胶囊与讲解层挂在 body 上，
// 目标只按选择器登记，页面重绘不会把它们弄丢。

export type PonderSection = { heading?: string; text: string };

export type PonderTarget = {
  id: string;
  title: string;
  category: string;
  /** 命中即算悬停在该概念上；子目标优先于页面级目标。 */
  selectors: string[];
  /** 页面级目标：不参与悬停提示（整页都是它，会一直弹胶囊），只在列表与 Ctrl+G 出现。 */
  page?: boolean;
  sections: PonderSection[];
  related?: string[];
};

const FOCUS = "今日专注";
const CONTAINER = "目标 · 习惯 · 愿景";
const PROTECT = "专注与锁机";
const FILES = "计划与备份";
const ASSISTANT = "学习助手";

export const PONDER_TARGETS: PonderTarget[] = [
  {
    id: "focus",
    title: FOCUS,
    category: "页面",
    page: true,
    selectors: ['main[data-ponder="focus"]'],
    sections: [
      {
        text: "这里只放今天该做的事，以及一个可以随时开始的番茄钟。不选任务也能「自由专注」。",
      },
      {
        heading: "计时由本机管理",
        text: "重启后按真实的截止时间恢复，不会把应用关闭的那段时间虚构成连续完成的番茄。系统休眠也不计入学习时长。",
      },
      {
        heading: "快捷键",
        text: "空格开始或暂停；N 新建任务；Ctrl+K 搜索。键盘快捷键在「帮助」里可以再查。",
      },
    ],
    related: ["catch-up", "timer", "audio"],
  },
  {
    id: "timer",
    title: "番茄钟与单次时长",
    category: "专注",
    selectors: [".focus-card", ".timer-center", ".timer-controls"],
    sections: [
      {
        text: "专注、短休息、长休息的时长在偏好设置里调整；一轮结束后可以自动进入休息或下一轮。",
      },
      {
        heading: "不用自己算番茄数",
        text: "任务填「预计分钟数」就会自动安排专注；短任务自动缩短单次专注，其它任务向上预留完整时段，并预览含休息的总计划块。",
      },
      {
        heading: "提前结束",
        text: "提前结束会保留实际用时，但不算完成一个番茄。严格模式下不能提前结束。",
      },
    ],
    related: ["focus", "audio", "strict"],
  },
  {
    id: "catch-up",
    title: "待补队列",
    category: "专注",
    selectors: ['[data-ponder="catch-up"]', ".catch-up-chip"],
    sections: [
      {
        text: "计划块结束了但还没做完时，普通组若仍在「重修窗口」内，就会进入待补队列，重新出现在今日专注里。",
      },
      {
        heading: "目标组不一样",
        text: "目标实例是否待补由配对节点的信号裁定决定：节点裁定后实例报废，不再补做。习惯过期后直接从今日待办移出并计一次缺勤。",
      },
      {
        heading: "超过窗口就报废",
        text: "超过重修窗口或节点已裁定，实例作废、不再提醒。跨日不补。",
      },
    ],
    related: ["focus", "mainline", "habits"],
  },
  {
    id: "tasks",
    title: "任务",
    category: "任务",
    page: true,
    selectors: ['main[data-ponder="tasks"]', ".task-toolbar", ".quick-add"],
    sections: [
      {
        text: "任务有优先级、截止日期、标签、备注和子步骤；点任务正文进编辑弹窗。",
      },
      {
        heading: "批量只适合粗调",
        text: "多选后可以整批「删除任务」或「移出」——移出只是把任务从项目/目标/习惯里摘掉，任务本身保留。一次改多个字段请进编辑弹窗。",
      },
      {
        heading: "类别是推导出来的",
        text: "属于目标＝主线管辖；不属目标、有提醒时间且重复＝习惯；其余＝普通番茄钟。类别不用手填。",
      },
    ],
    related: ["recurring", "goals", "projects"],
  },
  {
    id: "projects",
    title: "项目",
    category: "任务",
    page: true,
    selectors: ['main[data-ponder="project"]'],
    sections: [
      {
        text: "项目回答的是「做这件事时该处在什么环境里」：专属应用白名单挂在项目上，专注该项目的任务时替代通用白名单。",
      },
      {
        heading: "和目标、习惯是正交的",
        text: "目标/习惯管执行语义（漏了怎么办），项目管环境。一个任务可以同时属于某个项目和某个目标/习惯。",
      },
      {
        heading: "排序与菜单",
        text: "侧栏的项目可以拖拽排序，也可以点排序按钮；右键项目名可以重命名或删除。删除项目时任务会移到收件箱。",
      },
    ],
    related: ["tasks", "goals", "whitelist"],
  },
  {
    id: "recurring",
    title: "每周分时与重复",
    category: "任务",
    selectors: [".editor-details", ".editor-hint"],
    sections: [
      {
        text: "重复任务按每周周期单元印刷实例。一个开始时间可以对应多个日期或周期单元，也可以在一份模板里放多个开始时间。",
      },
      {
        heading: "实例不保存规则",
        text: "日期、完成、统计属于已印实例；完成实例不会生成下一条。改模板只影响未来，要用「同步到未完成实例」显式更新现有形状。",
      },
    ],
    related: ["tasks", "templates"],
  },
  {
    id: "goals",
    title: "目标",
    category: CONTAINER,
    page: true,
    selectors: ['main[data-ponder="goals"]'],
    sections: [
      {
        text: "目标把长期的事（例如一门课）收在一起，组内的听课、练习、实验等任务按「数量」或「时长」累计进度。",
      },
      {
        heading: "目标承载主线",
        text: "目标组里可以编辑主线节点；节点按实例的组标识与执行开始时间配对。目标的成败最终由信号裁定。",
      },
      {
        heading: "漏做会待补",
        text: "漏做的目标任务会作为「待补」出现在今日专注，直到补完或节点裁定。",
      },
    ],
    related: ["mainline", "habits", "vision"],
  },
  {
    id: "mainline",
    title: "主线节点与裁定",
    category: CONTAINER,
    selectors: [".mainline-card", ".goal-section", ".cross-section"],
    sections: [
      {
        text: "主线是目标组内按时间排列、互不重叠的节点。默认要求至少配对一条任务，且配对任务全部完成；没有实例不算完成。",
      },
      {
        heading: "完成 ≠ 成功",
        text: "完成只是过程信息。成功/失败由信号裁定：有权限的节点可以按时间或完成情况发出信号，方向可向头或向尾。裁定不可撤销。",
      },
      {
        heading: "阻断与检查",
        text: "有发信号权限的节点可以设置阻断，拒绝时传播停止。末节点的检查信号固定向头传播、不可阻断，把已完成且未裁定的节点判为成功。",
      },
      {
        heading: "裁定之后",
        text: "节点成功或失败后，所有配对实例都报废；已完成的记录保留，正在进行的专注会停止并记录实际用时。",
      },
    ],
    related: ["goals", "stats", "catch-up"],
  },
  {
    id: "habits",
    title: "习惯",
    category: CONTAINER,
    selectors: ['main[data-ponder="goals"] .list-tabs'],
    sections: [
      {
        text: "习惯是可以为不同星期设置不同时段的日常事（例如午饭随当天课表变化）。程序按预印范围生成各天的实例。",
      },
      {
        heading: "过期即缺勤",
        text: "过期未做会从今日待办移出并计一次缺勤；习惯不重修，也不参与目标主线。目标组与习惯组互斥。",
      },
    ],
    related: ["goals", "templates", "catch-up"],
  },
  {
    id: "vision",
    title: "愿景",
    category: CONTAINER,
    selectors: [".vision-card", ".vision-row", ".vision-head"],
    sections: [
      {
        text: "愿景是纯标记：不排期、不计进度、不计缺勤、不判成败。它只回答「以后想成为什么样的人」。",
      },
      {
        heading: "挂在哪里都行",
        text: "可以挂在项目下（英语一 → 80 分）、目标下（OpenCamp → 拿证），也可以放顶层当总愿景。",
      },
    ],
    related: ["goals", "projects"],
  },
  {
    id: "schedule",
    title: "本周日程",
    category: "日程",
    page: true,
    selectors: ['main[data-ponder="schedule"]', ".week-card"],
    sections: [
      {
        text: "二维周历：横轴周一到周日，纵轴按提醒时间定位任务块。块高按预计专注时长加休息估算，不吸附整点。",
      },
      {
        heading: "只读呈现",
        text: "点任务块直接打开编辑；翻周查看其它日期。这里不修改任务，改时间请进任务编辑弹窗。",
      },
    ],
    related: ["tasks", "reminder"],
  },
  {
    id: "reminder",
    title: "到点提醒",
    category: "日程",
    selectors: [".reminded", ".reminder-banner", ".timer-hint"],
    sections: [
      {
        text: "提醒只在计划块内有效：番茄数 × 单次时长，加上番茄之间的休息。超时未开始即作废，不挂一整天，也不跨日补。",
      },
      {
        heading: "会先排队",
        text: "正在计时、暂停计时或锁机时提醒会延后；回到空闲后再唤出窗口并高亮任务。程序需要保持运行，电脑休眠时不唤醒。",
      },
    ],
    related: ["schedule", "timer", "lock"],
  },
  {
    id: "stats",
    title: "统计与纵切面",
    category: "回顾",
    page: true,
    selectors: ['main[data-ponder="stats"]', ".stats-grid", ".history-card"],
    sections: [
      {
        text: "当天专注时间、完成番茄、连续天数、近七天趋势、项目分布与专注历史。提前结束也保留实际用时。",
      },
      {
        heading: "两块围绕成败的视图",
        text: "「主线」按整条线全部节点成功才算成功、任一失败即失败，给出每个目标组的结果与逐节点时序；「纵切面」把近两周每天的完成、缺勤、作废与主线结果并排。",
      },
      {
        heading: "成功很少见",
        text: "成功要求全线通过，所以更值得回看的是失败与未完成——它们通常指向估时或环境问题。",
      },
    ],
    related: ["mainline", "goals", "timer"],
  },
  {
    id: "templates",
    title: "模板与印刷",
    category: "安排",
    selectors: [".templates-card"],
    sections: [
      {
        text: "新建入口默认是「只做这一次」的临时任务，也可以保留为手动模板或自动模板。模板保存标题、备注、步骤、项目、单次时长、标签与默认优先级。",
      },
      {
        heading: "自动印刷是独立开关",
        text: "开启时按滚动窗口补齐近期安排（默认提前 7 天，可设 0–90 天）；关闭时保留静态模板，随时手动选起止日期整批印刷。",
      },
      {
        heading: "不重复、不回溯",
        text: "同模板同日期不会重复印刷，删除实例也不会重建。程序关闭期间不执行；运行后跳过已报废候选，可重修的进入待补。",
      },
    ],
    related: ["recurring", "habits", "tasks"],
  },
  {
    id: "guard",
    title: "专注保护",
    category: PROTECT,
    page: true,
    selectors: ['main[data-ponder="guard"]', ".guard-card"],
    sections: [
      {
        text: "在 niri / Wayland 上，保护会把不在白名单里的前台应用切回番茄 Todo。白名单按精确 app_id 匹配，可以直接添加当前打开的应用。",
      },
      {
        heading: "浏览器是一整个应用",
        text: "浏览器内所有网站共用一个应用标识，所以允许浏览器也会允许其中的娱乐网站。",
      },
      {
        heading: "这是自律辅助",
        text: "它不会结束其它进程，也挡不住系统快捷键、工作区总览、其它显示器或外部强退。GNOME、KDE、X11 上按钮会显示不可用。",
      },
    ],
    related: ["strict", "lock", "whitelist"],
  },
  {
    id: "whitelist",
    title: "应用白名单",
    category: PROTECT,
    selectors: [".whitelist-card"],
    sections: [
      {
        text: "通用白名单在「专注保护」页管理；每个项目还可以配一份专属白名单，专注该项目的任务时替代通用白名单。",
      },
      {
        heading: "用 AI 维护",
        text: "白名单随学习计划导出、导入即按项目覆盖：把「英语任务需要词典和浏览器」告诉助手，改完文件再导入即可。",
      },
    ],
    related: ["guard", "projects", "plan-file"],
  },
  {
    id: "strict",
    title: "严格模式",
    category: PROTECT,
    selectors: [".guard-strict-card", ".lock-strict-setting"],
    sections: [
      {
        text: "开启后，计时中不能暂停、提前结束或关闭保护，结束时自动解除。请在开始前确认所需应用都已加入白名单。",
      },
      {
        heading: "由核心拒绝，不是藏按钮",
        text: "严格模式由 Rust 拒绝提前退出，而不是只把按钮隐藏。IPC 故障时仍会解除当前保护并报错。",
      },
    ],
    related: ["guard", "lock", "timer"],
  },
  {
    id: "lock",
    title: "定时锁机",
    category: PROTECT,
    page: true,
    selectors: ['main[data-ponder="lock"]', ".lock-intro", ".lock-schedule"],
    sections: [
      {
        text: "独立的小憩 / 定时锁机页：1–720 分钟快速锁机，或跨午夜的每周重复时段。到点从托盘唤回全屏休息界面。",
      },
      {
        heading: "每个时段可独立严格",
        text: "星期按开始日期计算，启用的时段不能重叠；编辑弹窗里也能设置严格模式。规则默认不创建、不启用。",
      },
      {
        heading: "睡眠不算学习",
        text: "进入睡眠时会结束当前专注并保留实际用时；锁机结束不会自动重启专注。",
      },
    ],
    related: ["strict", "guard", "reminder"],
  },
  {
    id: "plan-file",
    title: "学习计划文件 v4",
    category: FILES,
    selectors: ['[data-ponder="plan-file"]', '[data-action="export-plan"]'],
    sections: [
      {
        text: "导出未完成实例、模板、主线与项目，方便编辑或交给 AI 维护。",
      },
      {
        heading: "导入是以文件为准的配置更新",
        text: "相同 ID 的任务、节点、模板与项目按文件更新，完成进度、专注历史与节点裁定一律保留。文件没提到的实体默认不动。",
      },
      {
        heading: "整份同步要显式声明",
        text: '在文件里加 "replace": true，才会做整份同步：移除文件未提及的未完成任务与容器。项目的 appWhitelist 随计划导出并按项目覆盖。',
      },
    ],
    related: ["backup", "whitelist", "tasks"],
  },
  {
    id: "backup",
    title: "完整备份 v3",
    category: FILES,
    selectors: ['[data-ponder="backup"]', '[data-action="export"]'],
    sections: [
      {
        text: "包含任务、设置、专注记录、模板、印刷记录、节点裁定、配对与永久 ID 历史，以及严格模式与锁机字段。",
      },
      {
        heading: "导入会替换当前数据",
        text: "恢复时暂停计时、清除当前锁机、停用导入的定时时段；规则和严格选项保留，需要在本机重新启用。旧版本备份不能直接导入。",
      },
      {
        heading: "不含助手私有数据",
        text: "完整备份不包含助手的认证、会话与记忆；迁移助手时要单独处理它的私有目录。",
      },
    ],
    related: ["plan-file", "agent"],
  },
  {
    id: "audio",
    title: "关键节点音效",
    category: "专注",
    selectors: ['[data-action="toggle-chime"]', '[data-action="test-sound"]'],
    sections: [
      {
        text: "开始/继续/暂停、提前结束、专注/休息切换、任务完成、到点提醒、锁机开始/结束时会播放一声简短提示；专注期间不循环打扰。",
      },
      {
        heading: "本地合成",
        text: "音效在本机合成，没有网络与额外音频依赖。可以关闭、调音量、逐项试听；背景音独立控制。浏览器与桌面 WebView 首次需要一次点击或按键激活音频。",
      },
    ],
    related: ["timer", "focus"],
  },
  {
    id: "settings",
    title: "偏好设置",
    category: "设置",
    page: true,
    selectors: ['main[data-ponder="settings"]'],
    sections: [
      {
        text: "专注与休息时长、每日目标、主题、音效、通知、桌面集成、学习计划与备份都在这里。",
      },
      {
        heading: "编辑时不写入",
        text: "输入只会标记为待保存；离开偏好页时统一自动保存，也可以手动保存。窗口失焦不保存，保存失败会保留你的修改并阻止离页。",
      },
    ],
    related: ["plan-file", "backup", "audio"],
  },
  {
    id: "agent",
    title: ASSISTANT,
    category: "智能体",
    page: true,
    selectors: ['main[data-ponder="agent"]'],
    sections: [
      {
        text: "默认用 DeepSeek API，也可以登录 Codex 账号。运行框架随应用打包，不需要另装 Node/Pi，也不读取你全局 Pi 的认证文件。",
      },
      {
        heading: "自动唤醒只在异常时发生",
        text: "本地检测计划超量/过松、习惯缺勤、主线停滞、深夜记录与投入下降等信号，受冷却、每日上限与安静时段约束。自动唤醒只分析、追问并生成待审阅文件。",
      },
      {
        heading: "它碰不到你的数据",
        text: "内嵌助手没有 dispatch 或 apply_file；任何修改都需要你审阅后点击应用。",
      },
    ],
    related: ["agent-memory", "agent-review", "agent-web"],
  },
  {
    id: "agent-memory",
    title: "助手记忆",
    category: "智能体",
    selectors: ["#agent-memories", '[id="agent-memory-add"]'],
    sections: [
      {
        text: "模型写入的记忆默认是「待确认」，你可以改写、确认、删除，也可以自己补充已确认的背景。",
      },
      {
        heading: "新对话保留记忆",
        text: "记忆与历史保存在本机；新对话不会被清空。每轮会先读最新学情，避免把旧对话当成当前事实。",
      },
    ],
    related: ["agent", "backup"],
  },
  {
    id: "agent-review",
    title: "审阅与应用",
    category: "智能体",
    selectors: ["#agent-review", '[data-agent="review"]', "#agent-files"],
    sections: [
      {
        text: "批量修改走文件流程：导出 → 分段读取 → JSON Patch → 审阅 → 你确认后应用。",
      },
      {
        heading: "应用前再核对一次",
        text: "应用时会再次核对文件哈希、导出来源与当前数据指纹，并在同一个 Engine 锁内执行，防止审阅到应用之间覆盖新数据。",
      },
      {
        heading: "数据变了就重新导出",
        text: "软件数据变化后旧来源文件会被拒绝，需要重新导出并重放修改意图。外部编辑器改过的文件也可以放回工作区再审阅。",
      },
    ],
    related: ["agent", "plan-file", "backup"],
  },
  {
    id: "agent-web",
    title: "联网搜索",
    category: "智能体",
    selectors: ['#agent-config-form label:has(input[name="exaKey"])'],
    sections: [
      {
        text: "搜索默认用免 Key 的 Exa；填自己的 Exa API Key 可以提升额度。Codex 后端使用账号服务端搜索。",
      },
      {
        heading: "网页不可信",
        text: "网页内容只是参考，不能覆盖工具权限与你的指令。网页读取会拦截本机、内网与保留地址。",
      },
    ],
    related: ["agent", "agent-review"],
  },
  {
    id: "agent-setup",
    title: "连接与设置",
    category: "智能体",
    selectors: ["#agent-config-form"],
    sections: [
      {
        text: "先选后端并填好连接信息，再勾选「启用」。启用后助手才能应答；「异常时自动唤醒」允许它在空闲时主动分析。",
      },
      {
        heading: "两种后端",
        text: "DeepSeek 用自己的 API Key，按用量付费；Codex 用「登录 Codex」走 ChatGPT 账号登录，用订阅额度。模型可以留空用默认。",
      },
    ],
    related: ["agent-backend", "agent-login", "agent-wake", "agent-key"],
  },
  {
    id: "agent-backend",
    title: "后端与模型",
    category: "智能体",
    selectors: [
      '#agent-config-form label:has(select[name="provider"])',
      '#agent-config-form label:has(input[name="model"])',
    ],
    sections: [
      {
        text: "DeepSeek 适合已有 API Key 的人；Codex 适合已有 ChatGPT Plus/Pro 订阅的人。切换后端后要重新保存。",
      },
      {
        heading: "模型",
        text: "留空使用后端默认模型；需要省 token 或要视觉能力时，再从下拉里指定。",
      },
    ],
    related: ["agent-setup", "agent-key", "agent-login"],
  },
  {
    id: "agent-key",
    title: "API Key",
    category: "智能体",
    selectors: ['#agent-config-form label:has(input[name="apiKey"])'],
    sections: [
      {
        text: "DeepSeek 的 Key 只保存在本机 agent/auth.json（权限 600），不会出现在状态接口、日志或任务备份里。",
      },
      {
        heading: "Exa 是另一回事",
        text: "Exa Key 是可选的：不填也能用免 Key 的搜索额度，填了只是额度更大。",
      },
    ],
    related: ["agent-setup", "agent-web", "agent-backend"],
  },
  {
    id: "agent-wake",
    title: "自动唤醒",
    category: "智能体",
    selectors: [
      '#agent-config-form label:has(input[name="maxAutoWakesPerDay"])',
      '#agent-config-form label:has(input[name="cooldownHours"])',
      '#agent-config-form label:has(input[name="quietStart"])',
    ],
    sections: [
      {
        text: "本地检测异常信号，只在启用、已连接且处于空闲时才唤醒助手；受每日上限、同一异常冷却与安静时段约束。",
      },
      {
        heading: "只分析，不改数据",
        text: "自动唤醒只分析、追问并生成待审阅文件；应用修改始终需要你点击。正在计时或锁机时先排队。",
      },
    ],
    related: ["agent-setup", "agent", "agent-review"],
  },
  {
    id: "agent-login",
    title: "登录 Codex",
    category: "智能体",
    selectors: ["#agent-auth", '[data-agent="login"]'],
    sections: [
      {
        text: "点「登录 Codex」会在系统浏览器打开官方登录页，完成后自动回来；登录凭据独立保存在本机。",
      },
      {
        heading: "登录页没自动完成",
        text: "如果 1455 端口被其它工具占用，页面会给出粘贴框，把浏览器回调链接或授权码贴进去也可继续。",
      },
    ],
    related: ["agent-setup", "agent-backend"],
  },
  {
    id: "mcp",
    title: "外部 MCP",
    category: "智能体",
    selectors: ["#agent-mcp"],
    sections: [
      {
        text: "把连接 JSON 复制到 MCP 客户端，它连接正在运行的实例、共享同一个 Engine，不启动第二份数据库。",
      },
      {
        heading: "外部客户端权限更大",
        text: "外部客户端除只读与文件工具外，可以使用 dispatch 直接执行单项操作，或在审阅后 apply_file。原生能力预检、严格保护、来源与哈希校验仍然执行。",
      },
      {
        heading: "关闭软件后不可用",
        text: "桥接仅监听 127.0.0.1，要求私有令牌并拒绝浏览器来源。",
      },
    ],
    related: ["agent", "agent-review"],
  },
];

const targetById = new Map(PONDER_TARGETS.map((target) => [target.id, target]));

const HOVER_DELAY_MS = 600;
const HOLD_DURATION_MS = 400;
const TOUCH_HOLD_MS = 600;
const CAPSULE_OFFSET = 14;
const TEXT_ENTRY = 'input,textarea,select,[contenteditable="true"]';

type Hovered = { target: PonderTarget; element: Element };

let initialized = false;
let hovered: Hovered | null = null;
let hoverTimer: number | null = null;
let touchTimer: number | null = null;
let touchStart: { x: number; y: number } | null = null;
let holdTimer: number | null = null;
let holdFrame: number | null = null;
let pointer = { x: 0, y: 0 };
let overlayOpen = false;

let hint: HTMLElement | null = null;
let hintName: HTMLElement | null = null;
let hintProgress: HTMLElement | null = null;
let layer: HTMLElement | null = null;
let layerBody: HTMLElement | null = null;
let layerTitle: HTMLElement | null = null;
let layerCategory: HTMLElement | null = null;
let layerSpot: HTMLElement | null = null;
let lastFocused: HTMLElement | null = null;

/** 从指针下的元素向上找最近的一个已登记概念；子目标先于页面级目标命中。 */
function resolveTarget(
  element: Element | null,
  includePages: boolean,
): Hovered | null {
  let node: Element | null = element;
  while (node && node !== document.body) {
    const explicit =
      node instanceof HTMLElement ? node.dataset.ponder : undefined;
    if (explicit) {
      const target = targetById.get(explicit);
      if (target && (includePages || !target.page))
        return { target, element: node };
    }
    for (const target of PONDER_TARGETS) {
      if (!includePages && target.page) continue;
      try {
        if (node.matches(target.selectors.join(",")))
          return { target, element: node };
      } catch {
        // 选择器写错时跳过这个目标，不影响其它概念。
      }
    }
    node = node.parentElement;
  }
  return null;
}

function buildHint() {
  hint = document.createElement("div");
  hint.id = "ponder-hint";
  hint.hidden = true;
  hint.setAttribute("aria-hidden", "true");
  const key = document.createElement("kbd");
  key.textContent = "G";
  const text = document.createElement("span");
  text.className = "ponder-hint-label";
  text.textContent = "按住讲解";
  hintName = document.createElement("b");
  hintName.className = "ponder-hint-name";
  hintProgress = document.createElement("i");
  hintProgress.className = "ponder-hint-progress";
  hint.append(key, text, hintName, hintProgress);
  document.body.appendChild(hint);
}

function buildLayer() {
  layer = document.createElement("div");
  layer.id = "ponder-layer";
  layer.hidden = true;
  layer.innerHTML =
    '<div class="ponder-scrim" data-ponder-close></div><div class="ponder-spot" hidden></div>' +
    '<section class="ponder-panel" role="dialog" aria-modal="true" aria-labelledby="ponder-title">' +
    '<header><span class="ponder-category"></span><h2 id="ponder-title"></h2>' +
    '<button class="icon-btn" data-ponder-close aria-label="关闭讲解">✕</button></header>' +
    '<div class="ponder-body"></div><footer class="ponder-foot"></footer></section>';
  layerCategory = layer.querySelector(".ponder-category");
  layerTitle = layer.querySelector("#ponder-title");
  layerBody = layer.querySelector(".ponder-body");
  layerSpot = layer.querySelector(".ponder-spot");
  layer.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target.closest("[data-ponder-close]")) {
      closePonder();
      return;
    }
    const jump = target.closest<HTMLElement>("[data-ponder-jump]");
    if (jump?.dataset.ponderJump) {
      openPonder(jump.dataset.ponderJump);
    }
  });
  document.body.appendChild(layer);
}

function showHint(next: Hovered) {
  if (!hint || !hintName) return;
  hintName.textContent = next.target.title;
  hint.hidden = false;
  positionHint();
}

function hideHint() {
  if (hint) hint.hidden = true;
  cancelHold();
}

function positionHint() {
  if (!hint || hint.hidden) return;
  const rect = hint.getBoundingClientRect();
  const x = Math.max(
    8,
    Math.min(window.innerWidth - rect.width - 8, pointer.x + CAPSULE_OFFSET),
  );
  const y = Math.max(
    8,
    Math.min(window.innerHeight - rect.height - 8, pointer.y + CAPSULE_OFFSET),
  );
  hint.style.transform = `translate(${x}px, ${y}px)`;
}

function armHold() {
  if (!hovered || holdTimer !== null) return;
  const started = performance.now();
  const tick = () => {
    if (hintProgress) {
      const progress = Math.min(
        1,
        (performance.now() - started) / HOLD_DURATION_MS,
      );
      hintProgress.style.transform = `scaleX(${progress})`;
    }
    holdFrame = requestAnimationFrame(tick);
  };
  holdFrame = requestAnimationFrame(tick);
  holdTimer = window.setTimeout(() => {
    holdTimer = null;
    if (holdFrame !== null) cancelAnimationFrame(holdFrame);
    holdFrame = null;
    if (hintProgress) hintProgress.style.transform = "scaleX(0)";
    const current = hovered;
    if (current) openPonder(current.target.id, current.element);
  }, HOLD_DURATION_MS);
}

function cancelHold() {
  if (holdTimer !== null) window.clearTimeout(holdTimer);
  holdTimer = null;
  if (holdFrame !== null) cancelAnimationFrame(holdFrame);
  holdFrame = null;
  if (hintProgress) hintProgress.style.transform = "scaleX(0)";
}

function clearHover() {
  if (hoverTimer !== null) window.clearTimeout(hoverTimer);
  hoverTimer = null;
  hovered = null;
  hideHint();
}

function placeSpotlight(element: Element | undefined) {
  if (!layerSpot) return;
  if (!element || !element.isConnected) {
    layerSpot.hidden = true;
    return;
  }
  const rect = element.getBoundingClientRect();
  const area = rect.width * rect.height;
  if (rect.width < 4 || area > window.innerWidth * window.innerHeight * 0.8) {
    layerSpot.hidden = true;
    return;
  }
  layerSpot.hidden = false;
  layerSpot.style.left = `${rect.left}px`;
  layerSpot.style.top = `${rect.top}px`;
  layerSpot.style.width = `${rect.width}px`;
  layerSpot.style.height = `${rect.height}px`;
}

function renderTarget(target: PonderTarget, element?: Element) {
  if (!layerTitle || !layerCategory || !layerBody || !layerSpot) return;
  layerCategory.textContent = target.category;
  layerTitle.textContent = target.title;
  layerBody.replaceChildren();
  for (const section of target.sections) {
    const block = document.createElement("div");
    block.className = "ponder-section";
    if (section.heading) {
      const heading = document.createElement("h3");
      heading.textContent = section.heading;
      block.appendChild(heading);
    }
    const text = document.createElement("p");
    text.textContent = section.text;
    block.appendChild(text);
    layerBody.appendChild(block);
  }
  const foot = layer?.querySelector<HTMLElement>(".ponder-foot");
  if (!foot) return;
  foot.replaceChildren();
  const related = (target.related ?? [])
    .map((id) => targetById.get(id))
    .filter((item): item is PonderTarget => Boolean(item));
  if (related.length) {
    const label = document.createElement("span");
    label.className = "ponder-related-label";
    label.textContent = "相关";
    foot.appendChild(label);
    for (const item of related) {
      const button = document.createElement("button");
      button.className = "ponder-chip";
      button.dataset.ponderJump = item.id;
      button.textContent = item.title;
      foot.appendChild(button);
    }
  }
  const done = document.createElement("button");
  done.className = "button primary";
  done.dataset.ponderClose = "";
  done.textContent = "知道了";
  foot.appendChild(done);
  placeSpotlight(element);
}

function renderList() {
  if (!layerBody || !layerTitle || !layerCategory || !layerSpot) return;
  layerCategory.textContent = "全部概念";
  layerTitle.textContent = "可以单独讲解的东西";
  layerSpot.hidden = true;
  layerBody.replaceChildren();
  const categories = [
    ...new Set(PONDER_TARGETS.map((target) => target.category)),
  ];
  for (const category of categories) {
    const heading = document.createElement("h3");
    heading.className = "ponder-list-heading";
    heading.textContent = category;
    layerBody.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "ponder-list-grid";
    for (const target of PONDER_TARGETS.filter(
      (item) => item.category === category,
    )) {
      const button = document.createElement("button");
      button.className = "ponder-list-item";
      button.dataset.ponderJump = target.id;
      const title = document.createElement("strong");
      title.textContent = target.title;
      const summary = document.createElement("small");
      summary.textContent = target.sections[0]?.text ?? "";
      button.append(title, summary);
      grid.appendChild(button);
    }
    layerBody.appendChild(grid);
  }
  const foot = layer?.querySelector<HTMLElement>(".ponder-foot");
  if (foot) {
    foot.replaceChildren();
    const done = document.createElement("button");
    done.className = "button primary";
    done.dataset.ponderClose = "";
    done.textContent = "知道了";
    foot.appendChild(done);
  }
}

function showLayer() {
  if (!layer) return;
  lastFocused = document.activeElement as HTMLElement | null;
  layer.hidden = false;
  overlayOpen = true;
  document.body.classList.add("ponder-open");
  requestAnimationFrame(() =>
    layer?.querySelector<HTMLElement>("[data-ponder-close]")?.focus(),
  );
}

export function openPonder(id: string, element?: Element) {
  const target = targetById.get(id);
  if (!target || !layer) return;
  hideHint();
  renderTarget(target, element);
  showLayer();
}

export function openPonderList() {
  if (!layer) return;
  hideHint();
  renderList();
  showLayer();
}

export function closePonder() {
  if (!layer) return;
  layer.hidden = true;
  overlayOpen = false;
  document.body.classList.remove("ponder-open");
  lastFocused?.focus?.();
}

function isTextEntry(element: Element | null) {
  return Boolean(element?.closest(TEXT_ENTRY));
}

export function initPonder() {
  if (initialized) return;
  initialized = true;
  buildHint();
  buildLayer();

  document.addEventListener(
    "pointerover",
    (event) => {
      const element = event.target instanceof Element ? event.target : null;
      const next = resolveTarget(element, false);
      if (!next) {
        if (hovered) clearHover();
        return;
      }
      if (hovered?.target.id === next.target.id) {
        hovered = next;
        return;
      }
      clearHover();
      hovered = next;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = null;
        if (hovered) showHint(hovered);
      }, HOVER_DELAY_MS);
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "pointermove",
    (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (hint && !hint.hidden) positionHint();
    },
    { passive: true },
  );

  document.addEventListener(
    "pointerout",
    (event) => {
      const related =
        event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (hovered && (!related || !hovered.element.contains(related)))
        clearHover();
    },
    { capture: true, passive: true },
  );

  // 触屏没有实体键盘：在概念上按住 600ms 也能打开。
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") return;
      const element = event.target instanceof Element ? event.target : null;
      const next = resolveTarget(element, false);
      if (!next) return;
      touchStart = { x: event.clientX, y: event.clientY };
      touchTimer = window.setTimeout(() => {
        touchTimer = null;
        openPonder(next.target.id, next.element);
      }, TOUCH_HOLD_MS);
    },
    { capture: true, passive: true },
  );
  const cancelTouch = () => {
    if (touchTimer !== null) window.clearTimeout(touchTimer);
    touchTimer = null;
    touchStart = null;
  };
  document.addEventListener(
    "pointermove",
    (event) => {
      if (touchTimer === null || !touchStart) return;
      if (
        Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) >
        10
      )
        cancelTouch();
    },
    { passive: true },
  );
  document.addEventListener("pointerup", cancelTouch, { passive: true });
  document.addEventListener("pointercancel", cancelTouch, { passive: true });

  window.addEventListener(
    "keydown",
    (event) => {
      if (overlayOpen && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePonder();
        return;
      }
      if (event.repeat || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        if (
          event.ctrlKey &&
          !event.altKey &&
          !event.metaKey &&
          event.key.toLowerCase() === "g"
        ) {
          event.preventDefault();
          event.stopPropagation();
          const next =
            hovered ??
            resolveTarget(
              document.elementFromPoint(pointer.x, pointer.y),
              true,
            );
          if (next) openPonder(next.target.id, next.element);
          else openPonderList();
        }
        return;
      }
      if (event.key.toLowerCase() !== "g") return;
      if (!(event.target instanceof Element) || isTextEntry(event.target))
        return;
      if (!hovered) return;
      event.preventDefault();
      event.stopPropagation();
      armHold();
    },
    { capture: true },
  );
  window.addEventListener(
    "keyup",
    (event) => {
      if (event.key.toLowerCase() === "g") cancelHold();
    },
    { capture: true },
  );
  window.addEventListener("blur", cancelHold);
  window.addEventListener("resize", () => {
    if (overlayOpen) closePonder();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelHold();
      if (overlayOpen) closePonder();
    }
  });
}
