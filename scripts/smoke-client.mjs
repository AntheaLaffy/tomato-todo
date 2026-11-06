// 客户端冒烟：在没有浏览器的环境里把 plugin/client.js 真正跑一遍。
//
// 为什么值得写：客户端的错误（slot 注册形状、渲染期 undefined、样式注入）
// 平时只能在浏览器 console 里看到；这里用「假 DOM + 真 React + 真 react-dom/server」
// 把插件工厂、apply、四个 slot 组件和九个页面渲染成字符串，能提前抓到崩溃，
// 也能让并行工作流在提交前自检（`pnpm check:client`）。
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "plugin/client.js"), "utf8");
const require = createRequire(join(root, "package.json"));

const REACT_PATHS = [
  join(root, "node_modules"),
  "/home/fuurin/node_modules",
  "/home/fuurin/.nvm/versions/node/v24.20.0/lib/node_modules/@deepseek-ai/dsh/node_modules",
];
function tryRequire(name) {
  for (const base of REACT_PATHS) {
    try {
      return createRequire(join(base, "noop.js"))(name);
    } catch {
      /* next path */
    }
  }
  return null;
}
const React = tryRequire("react");
const ReactDOMServer = tryRequire("react-dom/server");
if (!React || !ReactDOMServer) {
  console.error("smoke-client: 需要 react 与 react-dom（在 ~/node_modules 或 dsh 安装里）");
  process.exit(2);
}

// ---------- 假 DOM ----------
const nodes = new Map();
function makeNode(tag) {
  const node = {
    tagName: tag,
    id: "",
    style: { setProperty() {}, removeProperty() {} },
    attributes: {},
    children: [],
    textContent: "",
    innerHTML: "",
    dataset: {},
    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k.startsWith("data-") && this === globalDocument.documentElement) {
        this.dataset[k.slice(5).replace(/-([a-z])/g, (m) => m.toUpperCase())] = String(v);
      }
    },
    removeAttribute(k) {
      delete this.attributes[k];
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    insertBefore(child) {
      this.children.unshift(child);
      return child;
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
    get firstChild() {
      return this.children[0] ?? null;
    },
  };
  return node;
}
const head = makeNode("head");
const body = makeNode("body");
const documentElement = makeNode("html");
const globalDocument = {
  head,
  body,
  documentElement,
  createElement: (tag) => makeNode(tag),
  getElementById(id) {
    if (id === "tomato-skin-style") {
      const found = head.children.find((c) => c.id === id);
      return found ?? null;
    }
    if (id === "tomato-ambient") {
      const found = body.children.find((c) => c.id === id);
      return found ?? null;
    }
    return null;
  },
  querySelector() {
    return null;
  },
  addEventListener() {},
  removeEventListener() {},
};
const storage = new Map();
const fakeWindow = {
  innerWidth: 1280,
  __ModuleLoader__: null,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
};

const realSetTimeout = setTimeout;
const realSetInterval = setInterval;
let fastTimers = 12;

const context = {
  window: fakeWindow,
  document: globalDocument,
  localStorage: fakeWindow.localStorage,
  navigator: { userAgent: "smoke", language: "zh-CN" },
  location: { href: "http://127.0.0.1:3080/", origin: "http://127.0.0.1:3080" },
  // 加速 store 轮询等长延时（≤12 次，之后恢复真实时长），让冒烟在一拍内拿到数据。
  setTimeout: (fn, ms, ...args) => {
    if (fastTimers > 0 && ms >= 1000) {
      fastTimers -= 1;
      return realSetTimeout(fn, 20, ...args);
    }
    return realSetTimeout(fn, ms, ...args);
  },
  clearTimeout,
  setInterval: (fn, ms, ...args) => {
    if (fastTimers > 0 && ms >= 1000) {
      fastTimers -= 1;
      return realSetTimeout(fn, 20, ...args);
    }
    return realSetInterval(fn, ms, ...args);
  },
  clearInterval,
  console,
  fetch: () => Promise.reject(new Error("smoke: fetch disabled")),
  AbortController,
  URL,
};
context.self = context.window;
context.globalThis = context.window;
vm.createContext(context);

let registered = null;
fakeWindow.__ModuleLoader__ = {
  load(entry) {
    registered = entry;
  },
};

try {
  vm.runInContext(source, context, { filename: "plugin/client.js" });
} catch (e) {
  console.error("smoke-client: bundle 执行失败\n", e);
  process.exit(1);
}
if (!registered || typeof registered.factory !== "function") {
  console.error("smoke-client: 没有调用 __ModuleLoader__.load({factory})");
  process.exit(1);
}

const plugin = registered.factory((name) => {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return tryRequire("react/jsx-runtime");
  throw new Error("smoke: 未知的模块依赖 " + name);
});
const failures = [];
if (!Array.isArray(plugin.inject)) failures.push("plugin.inject 不是数组");
if (typeof plugin.apply !== "function") failures.push("plugin.apply 不是函数");

// ---------- 假 Client 上下文 ----------
const overrides = [];
const slotRegistrations = [];
const effects = [];
const services = {
  theme: {
    overrideTokens(source, tokens) {
      overrides.push({ source, tokens });
      return () => {};
    },
    getTheme() {
      return { preference: "light", active: { id: "light", colorScheme: "light", tokens: {} } };
    },
    register() {
      return () => {};
    },
  },
  locale: {
    getLocale: () => ({ active: "zh" }),
    subscribe: () => () => {},
  },
  layout: {
    selectPanel() {},
  },
};
const ctx = {
  get: (name) => services[name] ?? null,
  effect(fn) {
    effects.push(fn);
  },
  on() {},
  slots: {
    inject(key, callback) {
      const registration = callback();
      slotRegistrations.push({ key, registration });
      return () => {};
    },
    register(options, Component) {
      return { options, Component };
    },
  },
};
try {
  plugin.apply(ctx);
} catch (e) {
  console.error("smoke-client: apply 抛出异常\n", e);
  process.exit(1);
}

const expectedSlots = [
  "main",
  "sidebar.panellist",
  "shell.overlay",
  "conversation.composer.dock",
  "sidebar.brand.mark",
  "sidebar.brand.name",
  "conversation.hero.brand.mark",
];
const got = new Set(slotRegistrations.map((r) => r.key));
for (const key of expectedSlots) {
  if (!got.has(key)) failures.push(`缺少 slot 注册：${key}`);
}
if (overrides.length === 0) failures.push("没有调用 theme.overrideTokens");
if (!head.children.some((n) => n.id === "tomato-skin-style")) failures.push("没有注入皮肤样式表");
if (!body.children.some((n) => n.id === "tomato-ambient")) failures.push("没有注入氛围层");

// ---------- 渲染冒烟 ----------
const sampleState = {
  serverTime: Math.floor(Date.now() / 1000),
  today: new Date().toISOString().slice(0, 10),
  taskKinds: {},
  remainingSecs: 1200,
  data: {
    version: 4,
    identities: [],
    tasks: [
      { id: "t1", title: "语法加强 Day05（下）", completed: false, dueDate: new Date().toISOString().slice(0, 10), reminderTime: "20:00", projectId: "p1", tags: [], subtasks: [], notes: "", estimate: 45, focusMinutes: 25, priority: 1, scrapMinutes: 0, kind: "plain" },
    ],
    blocks: [],
    templates: [],
    prints: [],
    projects: [{ id: "p1", name: "数学一", color: "#df7561", appWhitelist: null }],
    habits: [
      { id: "h1", group: "晨间", name: "早起背单词", slots: [{ kind: "daily", minutes: 20 }], missedDates: [], createdAt: 1700000000 },
    ],
    visions: [
      { id: "v1", group: "方向", name: "把数学一学扎实", note: "不是周期任务，是方向" },
    ],
    blocks: [
      { id: "b1", kind: "class", title: "OS 训练营", start: "20:00", end: "22:00", days: [1, 3, 5], location: "线上" },
    ],
    templates: [
      { id: "tpl1", name: "每日英语", title: "英语精读 1 篇", shape: { mode: "daily" }, subtasks: [], createdAt: 1700000000 },
    ],
    sessions: [
      { id: "s1", source: "timer", taskId: "t1", taskTitle: "语法加强 Day05（下）", projectName: "数学一", startedAt: 1700000000, endedAt: 1700001500, durationSecs: 1500, completed: true },
    ],
    education: { projects: [], events: [], summaries: [] },
    settings: {
      focusMinutes: 45,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakEvery: 4,
      dailyGoal: 8,
      autoBreak: false,
      autoFocus: false,
      autoStartTasks: false,
      sound: true,
      soundVolume: 0.6,
      notifications: true,
      alwaysOnTop: false,
      theme: "light",
      personaBackdrop: true,
      protection: { mode: "whitelist", strict: false, allowedApps: ["firefox"] },
    },
    timer: {
      mode: "focus",
      running: false,
      taskId: "t1",
      durationSecs: 2700,
      remainingSecs: 2700,
      deadline: null,
      startedAt: null,
      cycle: 1,
      cycleDate: null,
      completionSerial: 0,
      lastFinishedMode: null,
      autoFocusBlocked: false,
    },
    sessions: [],
    lock: { schedules: [], active: null, suppressedUntil: 0 },
    education: {},
  },
  stats: { todaySeconds: 1200, todayPomodoros: 2, todayCompleted: 1, totalSeconds: 36000, totalPomodoros: 26, streak: 3, days: [] },
  guard: { available: true, backend: "niri / Wayland", locked: false, whitelist: [], pid: 1234 },
};

// 让 store 拿到样本：拦截 fetch 返回 /api/state。store 在 apply 时已启动轮询，
// 这里直接替换全局 fetch 再触发一次 refresh（refresh 在模块内已导出，用页面渲染的
// 空/离线态也能验证；这里主要验证「有数据」时的渲染）。
context.fetch = (url) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => (String(url).includes("/api/state") ? sampleState : { ok: true }),
  });
// 触发一次轮询刷新：等一拍让 fetch 结果落到 store，然后同步渲染。
await new Promise((resolve) => realSetTimeout(resolve, 250));

const renderedBy = {};
for (const { key, registration } of slotRegistrations) {
  if (!registration || typeof registration.Component !== "function") continue;
  const element = React.createElement(registration.Component, {});
  try {
    renderedBy[key] = ReactDOMServer.renderToStaticMarkup(element);
  } catch (e) {
    failures.push(`渲染 ${key} 失败：${e && e.message ? e.message : e}`);
  }
}

// 逐页渲染主视图：AppShell 的初始页读 localStorage，所以换 key 重挂即可覆盖九页。
const PAGE_IDS = ["focus", "tasks", "habits", "stats", "calendar", "education", "guard", "schedule", "preferences"];
const mainRegistration = slotRegistrations.find((r) => r.key === "main");
for (const pageId of PAGE_IDS) {
  storage.set("tomato-dsh.page", pageId);
  try {
    const markup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(mainRegistration.registration.Component, {}),
    );
    renderedBy[`page:${pageId}`] = markup;
    if (!markup || markup.length < 500) failures.push(`页面 ${pageId} 渲染为空`);
  } catch (e) {
    failures.push(`渲染页面 ${pageId} 失败：${e && e.message ? e.message : e}`);
  }
}
storage.delete("tomato-dsh.page");
// 渲染主视图里的九个页面：直接触发 main 组件即可（页面由注册表提供）。
const mainMarkup = renderedBy["main"] || "";
if (!mainMarkup.includes("番茄 Todo")) failures.push("主视图没有渲染品牌名");
for (const word of ["今日专注", "全部任务", "数据统计", "偏好设置"]) {
  if (!mainMarkup.includes(word)) failures.push(`主视图导航缺少「${word}」`);
}
if (!(renderedBy["shell.overlay"] || "").includes("番茄")) failures.push("overlay 渲染内容里没有番茄文案");
if (!(renderedBy["conversation.composer.dock"] || "").includes("现在专注")) failures.push("入口卡没有渲染开始专注按钮");
if (!(renderedBy["shell.overlay"] || "").includes("个番茄")) failures.push("HUD 没有渲染今日番茄计数");
if (!(renderedBy["conversation.composer.dock"] || "").includes("今日待办")) failures.push("入口卡没有渲染今日待办");

// 清理 effect（验证 dispose 路径不抛错）
for (const fn of effects) {
  try {
    const dispose = fn();
    if (typeof dispose === "function") dispose();
  } catch (e) {
    failures.push(`dispose 抛错：${e && e.message ? e.message : e}`);
  }
}

if (failures.length > 0) {
  console.error("smoke-client: 失败\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log(
  `smoke-client: OK — ${slotRegistrations.length} 个 slot 注册、${overrides.length} 层主题覆盖、` +
    `${Object.keys(renderedBy).length} 个组件渲染成功`,
);
