// 文案注册表：每个模块自注册命名空间，键形如 `任务中心.title`。
//
// 为什么不用 DSH 的 locale service 注册字典：插件客户端半拿不到稳定类型，
// 而页面文案量大、命名空间多；这里的 t() 只依赖本模块状态，locale 切换由
// skin/main.js 订阅 DSH locale 后调用 setLocale，React 重渲染即生效。
const REG = new Map();

let current = "zh";

const ZH = "zh";
const EN = "en";

/** 注册一个命名空间的 zh/en 字典；重复注册按 key 覆盖（HMR 安全）。 */
export function registerCopy(ns, dicts) {
  const entry = REG.get(ns) ?? { zh: {}, en: {} };
  Object.assign(entry.zh, dicts.zh ?? {});
  Object.assign(entry.en, dicts.en ?? {});
  REG.set(ns, entry);
}

/** DSH locale id → 本插件语言（zh* 用中文，其余英文）。 */
export function setLocale(id) {
  current = typeof id === "string" && /^zh/i.test(id) ? ZH : EN;
}

export function getLocale() {
  return current;
}

/**
 * 取文案。key 可带命名空间前缀（`ns.key`），不带时用 `common`。
 * vars 形如 {n: 3}，替换 `{n}` 占位；缺失时返回 key 本身（便于发现漏翻）。
 */
export function t(key, vars) {
  const dot = key.indexOf(".");
  const ns = dot > 0 ? key.slice(0, dot) : "common";
  const name = dot > 0 ? key.slice(dot + 1) : key;
  const entry = REG.get(ns);
  const dict = entry ? entry[current] : undefined;
  let text = dict && dict[name] !== undefined ? dict[name] : undefined;
  if (text === undefined) {
    const fallback = entry ? entry[ZH] : undefined;
    text = fallback && fallback[name] !== undefined ? fallback[name] : key;
  }
  if (vars) {
    for (const k of Object.keys(vars)) {
      text = text.split("{" + k + "}").join(String(vars[k]));
    }
  }
  return text;
}

/** 是否有该文案（用于可选标签）。 */
export function hasCopy(key) {
  return t(key) !== key;
}

// 共享 UI 词汇：按钮、状态、空态。页面私有文案一律放各自命名空间。
registerCopy("common", {
  zh: {
    cancel: "取消",
    close: "关闭",
    save: "保存",
    saved: "已保存",
    delete: "删除",
    edit: "编辑",
    confirm: "确定",
    add: "添加",
    retry: "重试",
    loading: "加载中…",
    loadFailed: "读取失败，稍后自动重试",
    writeFailed: "写入失败，请确认运行时在线",
    empty: "这里还什么都没有",
    today: "今天",
    yesterday: "昨天",
    tomorrow: "明天",
    minutes: "{n} 分钟",
    hours: "{n} 小时",
    pomodoros: "{n} 个番茄",
    tasksCount: "{n} 件",
    itemsCount: "{n} 项",
    offline: "运行时离线",
    savedLocal: "所有更改已保存到本机",
    more: "更多",
    search: "搜索",
    all: "全部",
    none: "无",
    week: ["一", "二", "三", "四", "五", "六", "日"],
    weekFull: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    monthDay: "{m}月{d}日",
    daypartMorning: "早上好",
    daypartNoon: "中午好",
    daypartAfternoon: "下午好",
    daypartEvening: "晚上好",
    daypartNight: "夜深了",
  },
  en: {
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    saved: "Saved",
    delete: "Delete",
    edit: "Edit",
    confirm: "Confirm",
    add: "Add",
    retry: "Retry",
    loading: "Loading…",
    loadFailed: "Couldn't load; retrying automatically",
    writeFailed: "Write failed; check the runtime is online",
    empty: "Nothing here yet",
    today: "Today",
    yesterday: "Yesterday",
    tomorrow: "Tomorrow",
    minutes: "{n} min",
    hours: "{n} h",
    pomodoros: "{n} pomodoros",
    tasksCount: "{n} tasks",
    itemsCount: "{n} items",
    offline: "Runtime offline",
    savedLocal: "All changes saved to this device",
    more: "More",
    search: "Search",
    all: "All",
    none: "None",
    week: ["M", "T", "W", "T", "F", "S", "S"],
    weekFull: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    monthDay: "{m}/{d}",
    daypartMorning: "Good morning",
    daypartNoon: "Good noon",
    daypartAfternoon: "Good afternoon",
    daypartEvening: "Good evening",
    daypartNight: "Late night",
  },
});
