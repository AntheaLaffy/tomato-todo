// 文案注册表：每个模块自注册命名空间，键形如 `任务中心.title`。
//
// 为什么不用 DSH 的 locale service 注册字典：插件客户端半拿不到稳定类型，
// 而页面文案量大、命名空间多；这里的 t() 只依赖本模块状态，语言选择由
// DSH locale 持久化，本模块订阅后让各个独立槽位及时重渲染。
import { useEffect, useState } from "../runtime.js";
import { japaneseCopy } from "./ja.js";

const REG = new Map();
const listeners = new Set();

let current = "zh";

const ZH = "zh";
const EN = "en";
const JA = "ja";

/** 注册一个命名空间的字典；重复注册按 key 覆盖（HMR 安全）。 */
export function registerCopy(ns, dicts) {
  const entry = REG.get(ns) ?? { zh: {}, en: {}, ja: {} };
  Object.assign(entry.zh, dicts.zh ?? {});
  Object.assign(entry.en, dicts.en ?? {});
  Object.assign(entry.ja, japaneseCopy[ns] ?? {}, dicts.ja ?? {});
  REG.set(ns, entry);
}

/** DSH locale id → 本插件语言。 */
export function setLocale(id) {
  const next = typeof id === "string" && /^zh/i.test(id)
    ? ZH
    : typeof id === "string" && /^ja/i.test(id) ? JA : EN;
  if (next === current) return;
  current = next;
  for (const fn of Array.from(listeners)) fn(current);
}

export function getLocale() {
  return current;
}

export function subscribeLocale(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 独立 DSH 槽位都订阅同一语言状态，避免等待下一轮 runtime 轮询才换文案。 */
export function useLocale() {
  const [language, update] = useState(current);
  useEffect(() => subscribeLocale(update), []);
  return language;
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
    const fallback = entry ? entry[EN] : undefined;
    text = fallback && fallback[name] !== undefined ? fallback[name] : undefined;
    if (text === undefined) text = entry && entry[ZH][name] !== undefined ? entry[ZH][name] : key;
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
