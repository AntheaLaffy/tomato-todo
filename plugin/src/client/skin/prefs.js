// 皮肤偏好（浏览器本地）：氛围总开关 + 时段手动覆盖。
//
// 为什么存在 localStorage 而不是 @tomato/core 的 Settings：
// 这是「这台设备上的观感」而不是学习数据（换设备不该被同步过来）；而角色背景板
// 是旧版数据语义（settings.personaBackdrop），由设置行通过 saveSettings 写回。
const KEY = "tomato-dsh.skin";

const DEFAULTS = { ambience: true, daypart: "auto" };

let current = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      ambience: parsed.ambience !== false,
      daypart:
        parsed.daypart === "morning" ||
        parsed.daypart === "day" ||
        parsed.daypart === "dusk" ||
        parsed.daypart === "night"
          ? parsed.daypart
          : "auto",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* 隐私模式：本次会话内仍生效 */
  }
}

/** 把偏好写进 DOM：氛围开关 + 手动时段。 */
export function applySkinPrefs() {
  const root = document.documentElement;
  root.setAttribute("data-tomato-skin", current.ambience ? "on" : "off");
  if (current.daypart === "auto") {
    root.removeAttribute("data-tomato-daypart-manual");
  } else {
    root.setAttribute("data-tomato-daypart", current.daypart);
    root.setAttribute("data-tomato-daypart-manual", "1");
  }
}

export function getSkinPrefs() {
  return { ...current };
}

export function setSkinPrefs(patch) {
  current = { ...current, ...patch };
  persist();
  applySkinPrefs();
  for (const fn of Array.from(listeners)) {
    try {
      fn(current);
    } catch {
      /* 订阅者异常不影响其他订阅者 */
    }
  }
}

export function subscribeSkinPrefs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 手动时段是否生效（ambient.applyDaypart 用它决定是否跳过自动判断）。 */
export function isManualDaypart() {
  return current.daypart !== "auto";
}
