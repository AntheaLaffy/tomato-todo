// packages/core/src/errors.ts
var AppError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AppError";
  }
};
function ensure(ok, message) {
  if (!ok) throw new AppError(message);
}
function require2(value, message) {
  if (value === null || value === void 0) throw new AppError(message);
  return value;
}
function charCount(s) {
  return Array.from(s).length;
}
function utf8Len(s) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s).length;
  }
  return charCount(s) * 3;
}
function clone(value) {
  if (Array.isArray(value)) {
    return value.map((v) => clone(v));
  }
  if (value !== null && typeof value === "object") {
    const out = Object.create(Object.getPrototypeOf(value));
    for (const key of Object.keys(value)) {
      out[key] = clone(value[key]);
    }
    return out;
  }
  return value;
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(
      (k) => deepEqual(
        a[k],
        b[k]
      )
    );
  }
  return false;
}

// packages/core/src/ids.ts
function id() {
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    ""
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// packages/core/src/time.ts
var DAY_MS = 864e5;
var pad2 = (n) => n < 10 ? `0${n}` : String(n);
var pad4 = (n) => String(n).padStart(4, "0");
function localDateOf(at) {
  const d = new Date(at * 1e3);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
function dateAt(at) {
  const { year, month, day } = localDateOf(at);
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}
function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}
function validDate(value) {
  return parseDate(value) !== null;
}
function addDays(date, days) {
  const t = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate()
  };
}
function weekdayMonday(date) {
  const day = new Date(
    Date.UTC(date.year, date.month - 1, date.day)
  ).getUTCDay();
  return day === 0 ? 7 : day;
}
function weekStart(date) {
  return addDays(date, -(weekdayMonday(date) - 1));
}
function daysBetween(from, to) {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.floor((b - a) / DAY_MS);
}
function formatDate(date) {
  return `${pad4(date.year)}-${pad2(date.month)}-${pad2(date.day)}`;
}
function atLocal(year, month, day, hour, minute, second = 0) {
  return Math.floor(
    new Date(year, month - 1, day, hour, minute, second).getTime() / 1e3
  );
}
function atLocalDate(date, hour = 0, minute = 0) {
  return atLocal(date.year, date.month, date.day, hour, minute);
}
function atLocalDateString(date) {
  const parsed = parseDate(date);
  if (parsed === null) return null;
  return atLocalDate(parsed);
}
function hourMinuteString(at) {
  const d = new Date(at * 1e3);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function secondsOfDay(at) {
  const d = new Date(at * 1e3);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}
function hourMinuteOf(at) {
  const d = new Date(at * 1e3);
  return { hour: d.getHours(), minute: d.getMinutes() };
}
function validTime(value) {
  return value.length === 5 && value.charCodeAt(2) === 58 && value.slice(0, 2) >= "00" && value.slice(0, 2) <= "23" && value.slice(3) >= "00" && value.slice(3) <= "59";
}
function minutesOf(value) {
  if (value.length !== 5 || value.charCodeAt(2) !== 58) return null;
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3));
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}
function now() {
  return Math.floor(Date.now() / 1e3);
}

// packages/core/src/model.ts
function kindOf(task) {
  return task.reminderTime !== null && (task.habitId !== null || task.recurring) ? "habit" : "ordinary";
}
function isHabit(task) {
  return kindOf(task) === "habit";
}

// packages/core/src/json.ts
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejectUnknown(obj, allowed2, what) {
  for (const key of Object.keys(obj)) {
    if (!allowed2.includes(key)) {
      throw new AppError(`\u672A\u77E5\u5B57\u6BB5\uFF1A${what} \u4E0D\u63A5\u53D7 "${key}"`);
    }
  }
}
function asStr(value, what) {
  if (typeof value !== "string") throw new AppError(`${what}\u5FC5\u987B\u662F\u5B57\u7B26\u4E32`);
  return value;
}
function asBool(value, what) {
  if (typeof value !== "boolean") throw new AppError(`${what}\u5FC5\u987B\u662F\u5E03\u5C14\u503C`);
  return value;
}
function asInt(value, what) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError(`${what}\u5FC5\u987B\u662F\u6574\u6570`);
  }
  return value;
}
function asArray(value, what) {
  if (!Array.isArray(value)) throw new AppError(`${what}\u5FC5\u987B\u662F\u6570\u7EC4`);
  return value;
}
function asOpt(value, what, parse) {
  if (value === null) return null;
  return parse(value, what);
}
function field(obj, key, what, parse, def) {
  const value = obj[key];
  if (value === void 0) return def;
  return parse(value, what);
}
function requiredField(obj, key, what, parse) {
  const value = obj[key];
  if (value === void 0) throw new AppError(`${what}\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5 ${key}`);
  return parse(value, what);
}
function oneOf(value, what, allowed2) {
  const s = asStr(value, what);
  if (!allowed2.includes(s))
    throw new AppError(`${what}\u53D6\u503C\u65E0\u6548\uFF1A${s}`);
  return s;
}

// packages/core/src/lock.ts
var SCHEDULE_KEYS = [
  "id",
  "name",
  "start",
  "end",
  "days",
  "enabled",
  "strict"
];
var ACTIVE_KEYS = ["name", "startedAt", "endsAt", "strict"];
var STATE_KEYS = ["schedules", "active", "suppressedUntil"];
function parseLockSchedule(raw) {
  if (!isObject(raw)) throw new AppError("\u9501\u673A\u89C4\u5219\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...SCHEDULE_KEYS], "\u9501\u673A\u89C4\u5219");
  return {
    id: requiredField(raw, "id", "\u9501\u673A\u89C4\u5219", asStr),
    name: requiredField(raw, "name", "\u9501\u673A\u89C4\u5219", asStr),
    start: requiredField(raw, "start", "\u9501\u673A\u89C4\u5219", asStr),
    end: requiredField(raw, "end", "\u9501\u673A\u89C4\u5219", asStr),
    days: asArray(
      requiredField(raw, "days", "\u9501\u673A\u89C4\u5219", (v) => v),
      "days"
    ).map((d) => asInt(d, "\u9501\u673A\u661F\u671F")),
    enabled: requiredField(raw, "enabled", "\u9501\u673A\u89C4\u5219", asBool),
    strict: field(raw, "strict", "\u9501\u673A\u89C4\u5219", asBool, false)
  };
}
function serializeLockSchedule(s) {
  return {
    id: s.id,
    name: s.name,
    start: s.start,
    end: s.end,
    days: s.days,
    enabled: s.enabled,
    strict: s.strict
  };
}
function parseActiveLock(raw) {
  if (!isObject(raw)) throw new AppError("\u9501\u673A\u72B6\u6001\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...ACTIVE_KEYS], "\u9501\u673A\u72B6\u6001");
  return {
    name: requiredField(raw, "name", "\u9501\u673A\u72B6\u6001", asStr),
    startedAt: requiredField(raw, "startedAt", "\u9501\u673A\u72B6\u6001", asInt),
    endsAt: requiredField(raw, "endsAt", "\u9501\u673A\u72B6\u6001", asInt),
    strict: requiredField(raw, "strict", "\u9501\u673A\u72B6\u6001", asBool)
  };
}
function serializeActiveLock(a) {
  return {
    name: a.name,
    startedAt: a.startedAt,
    endsAt: a.endsAt,
    strict: a.strict
  };
}
function parseLockState(raw) {
  if (!isObject(raw)) throw new AppError("\u9501\u673A\u914D\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...STATE_KEYS], "\u9501\u673A\u914D\u7F6E");
  return {
    schedules: field(
      raw,
      "schedules",
      "\u9501\u673A\u914D\u7F6E",
      (v) => asArray(v, "schedules").map(parseLockSchedule),
      []
    ),
    active: field(
      raw,
      "active",
      "\u9501\u673A\u914D\u7F6E",
      (v) => v === null ? null : parseActiveLock(v),
      null
    ),
    suppressedUntil: field(raw, "suppressedUntil", "\u9501\u673A\u914D\u7F6E", asInt, 0)
  };
}
function serializeLockState(s) {
  return {
    schedules: s.schedules.map(serializeLockSchedule),
    // 与 Rust 一致：Option 直接序列化，None 显式写 "active": null（serde 两端接受）。
    active: s.active === null ? null : serializeActiveLock(s.active),
    suppressedUntil: s.suppressedUntil
  };
}
function validateLock(state) {
  if (state.schedules.length > 20) {
    throw new AppError("\u6700\u591A\u8BBE\u7F6E 20 \u4E2A\u9501\u673A\u65F6\u6BB5");
  }
  const ids = /* @__PURE__ */ new Set();
  const occupied = new Array(7 * 1440).fill(false);
  for (const s of state.schedules) {
    if (s.id.length === 0 || ids.has(s.id) || s.name.trim().length === 0 || Array.from(s.name).length > 40) {
      throw new AppError("\u9501\u673A\u540D\u79F0\u9700\u4E3A 1\u201340 \u5B57\u7B26\uFF0CID \u9700\u552F\u4E00\u4E14\u975E\u7A7A");
    }
    ids.add(s.id);
    if (minutesOf(s.start) === null || minutesOf(s.end) === null || s.start === s.end) {
      throw new AppError("\u9501\u673A\u65F6\u95F4\u9700\u4E3A\u6709\u6548 HH:MM\uFF0C\u5F00\u59CB\u4E0E\u7ED3\u675F\u4E0D\u80FD\u76F8\u540C");
    }
    const unique = new Set(s.days);
    if (s.days.length === 0 || s.days.length > 7 || unique.size !== s.days.length || s.days.some((d) => d < 1 || d > 7)) {
      throw new AppError("\u8BF7\u9009\u62E9\u4E0D\u91CD\u590D\u7684\u661F\u671F\uFF08\u5468\u4E00\u4E3A 1\uFF0C\u5468\u65E5\u4E3A 7\uFF09");
    }
    if (s.enabled) {
      const start = minutesOf(s.start);
      const end = minutesOf(s.end);
      const duration = (end + 1440 - start) % 1440;
      for (const day of s.days) {
        for (let offset = 0; offset < duration; offset += 1) {
          const minute = ((day - 1) * 1440 + start + offset) % (7 * 1440);
          if (occupied[minute]) {
            throw new AppError("\u542F\u7528\u7684\u9501\u673A\u65F6\u6BB5\u4E0D\u80FD\u91CD\u53E0\uFF0C\u8BF7\u8C03\u6574\u65E5\u671F\u6216\u65F6\u95F4");
          }
          occupied[minute] = true;
        }
      }
    }
  }
  if (state.active !== null) {
    const a = state.active;
    if (a.name.trim().length === 0 || Array.from(a.name).length > 40 || a.endsAt <= a.startedAt || a.endsAt - a.startedAt > 8 * 86400) {
      throw new AppError("\u65E0\u6548\u7684\u9501\u673A\u72B6\u6001");
    }
  }
}
function scheduledAt(state, at) {
  if (at < state.suppressedUntil) return null;
  const today = localDateOf(at);
  let result = null;
  for (const date of [addDays(today, -1), today]) {
    const weekday = weekdayMonday(date);
    for (const s of state.schedules) {
      if (!s.enabled || !s.days.includes(weekday)) continue;
      const startTime = minutesOf(s.start);
      const endTime = minutesOf(s.end);
      if (startTime === null || endTime === null) continue;
      const endDate = endTime <= startTime ? addDays(date, 1) : date;
      const start = atLocalDate(
        date,
        Math.floor(startTime / 60),
        startTime % 60
      );
      const end = atLocalDate(endDate, Math.floor(endTime / 60), endTime % 60);
      if (at >= start && at < end) {
        if (result !== null) {
          result.startedAt = Math.min(result.startedAt, start);
          result.endsAt = Math.max(result.endsAt, end);
          result.strict = result.strict || s.strict;
        } else {
          result = {
            name: s.name,
            startedAt: start,
            endsAt: end,
            strict: s.strict
          };
        }
      }
    }
  }
  return result;
}
function releaseLock(state, at) {
  const scheduled = scheduledAt(state, at);
  if (scheduled !== null) {
    state.suppressedUntil = Math.max(state.suppressedUntil, scheduled.endsAt);
  }
  state.active = null;
}

// packages/core/src/blocks.ts
var BLOCK_KEYS = [
  "id",
  "title",
  "days",
  "start",
  "end",
  "attention",
  "notes"
];
function parseBlock(raw) {
  if (!isObject(raw)) throw new AppError("\u963B\u585E\u65F6\u6BB5\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...BLOCK_KEYS], "\u963B\u585E\u65F6\u6BB5");
  return {
    id: requiredField(raw, "id", "\u963B\u585E\u65F6\u6BB5", asStr),
    title: requiredField(raw, "title", "\u963B\u585E\u65F6\u6BB5", asStr),
    days: asArray(
      requiredField(raw, "days", "\u963B\u585E\u65F6\u6BB5", (v) => v),
      "days"
    ).map((d) => asInt(d, "\u963B\u585E\u65F6\u6BB5\u661F\u671F")),
    start: requiredField(raw, "start", "\u963B\u585E\u65F6\u6BB5", asStr),
    end: requiredField(raw, "end", "\u963B\u585E\u65F6\u6BB5", asStr),
    attention: field(
      raw,
      "attention",
      "\u963B\u585E\u65F6\u6BB5",
      (v) => oneOf(v, "attention", ["required", "light"]),
      "required"
    ),
    notes: field(raw, "notes", "\u963B\u585E\u65F6\u6BB5", asStr, "")
  };
}
function serializeBlock(b) {
  return {
    id: b.id,
    title: b.title,
    days: b.days,
    start: b.start,
    end: b.end,
    attention: b.attention,
    notes: b.notes
  };
}
function band(block, date) {
  const parsed = parseDate(date);
  if (parsed === null) return null;
  if (!block.days.includes(weekdayMonday(parsed))) return null;
  const start = minutesOf(block.start);
  const end = minutesOf(block.end);
  if (start === null || end === null) return null;
  return { start, end: end <= start ? end + 1440 : end };
}
function overlapMinutes(block, date, start, end) {
  const b = band(block, date);
  if (b === null) return 0;
  return Math.min(end, b.end) - Math.max(start, b.start) > 0 ? Math.min(end, b.end) - Math.max(start, b.start) : 0;
}
function validateBlock(block) {
  if (block.id.length === 0) {
    throw new AppError("\u963B\u585E\u65F6\u6BB5 ID \u4E0D\u80FD\u4E3A\u7A7A");
  }
  if (block.title.trim().length === 0 || Array.from(block.title).length > 40) {
    throw new AppError("\u963B\u585E\u65F6\u6BB5\u540D\u79F0\u9700\u4E3A 1\u201340 \u4E2A\u5B57\u7B26");
  }
  if (minutesOf(block.start) === null || minutesOf(block.end) === null) {
    throw new AppError("\u963B\u585E\u65F6\u6BB5\u9700\u4E3A\u6709\u6548\u7684 HH:MM \u65F6\u95F4");
  }
  if (block.start === block.end) {
    throw new AppError("\u963B\u585E\u65F6\u6BB5\u7684\u5F00\u59CB\u4E0E\u7ED3\u675F\u4E0D\u80FD\u76F8\u540C");
  }
  const unique = new Set(block.days);
  if (block.days.length === 0 || block.days.length > 7 || unique.size !== block.days.length || block.days.some((d) => d < 1 || d > 7)) {
    throw new AppError("\u8BF7\u9009\u62E9\u4E0D\u91CD\u590D\u7684\u661F\u671F\uFF08\u5468\u4E00\u4E3A 1\uFF0C\u5468\u65E5\u4E3A 7\uFF09");
  }
  if (Array.from(block.notes).length > 2e3) {
    throw new AppError("\u963B\u585E\u65F6\u6BB5\u5907\u6CE8\u8FC7\u957F");
  }
}
function validateBlocks(blocks) {
  if (blocks.length > 60) {
    throw new AppError("\u8BFE\u8868\u963B\u585E\u65F6\u6BB5\u6700\u591A 60 \u9879");
  }
  const ids = /* @__PURE__ */ new Set();
  for (const block of blocks) {
    validateBlock(block);
    if (ids.has(block.id)) {
      throw new AppError("\u963B\u585E\u65F6\u6BB5 ID \u91CD\u590D");
    }
    ids.add(block.id);
  }
}
function blocksOnDate(blocks, date) {
  if (parseDate(date) === null) return [];
  return blocks.filter((b) => band(b, date) !== null).slice().sort(
    (a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : a.title < b.title ? -1 : a.title > b.title ? 1 : 0
  );
}
function requiredMinutes(blocks, date) {
  if (parseDate(date) === null) return 0;
  let total = 0;
  for (const b of blocks) {
    if (b.attention !== "required") continue;
    const bandValue = band(b, date);
    if (bandValue !== null) total += bandValue.end - bandValue.start;
  }
  return total;
}

// packages/core/src/habits.ts
var HABIT_KEYS = ["id", "name"];
function parseHabit(raw) {
  if (!isObject(raw)) throw new AppError("\u4E60\u60EF\u7EC4\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...HABIT_KEYS], "\u4E60\u60EF\u7EC4");
  return {
    id: requiredField(raw, "id", "\u4E60\u60EF\u7EC4", asStr),
    name: requiredField(raw, "name", "\u4E60\u60EF\u7EC4", asStr)
  };
}
function serializeHabit(h) {
  return { id: h.id, name: h.name };
}
function validateHabit(habit) {
  if (habit.name.trim().length === 0 || Array.from(habit.name).length > 40) {
    throw new AppError("\u4E60\u60EF\u540D\u79F0\u9700\u4E3A 1\u201340 \u4E2A\u5B57\u7B26");
  }
}

// packages/core/src/reminders.ts
function validateReminderTask(task) {
  if (task.dueDate === null || !validDate(task.dueDate)) {
    throw new AppError("\u4EFB\u52A1\u5FC5\u987B\u6307\u5B9A\u6709\u6548\u7684\u8BA1\u5212\u65E5\u671F");
  }
  if (task.focusMinutes !== null && (task.focusMinutes < 1 || task.focusMinutes > 180)) {
    throw new AppError("\u5355\u6B21\u4E13\u6CE8\u65F6\u957F\u9700\u4E3A1\u2014180\u5206\u949F");
  }
  if (task.reminderTime !== null) {
    if (task.dueDate === null || minutesOf(task.reminderTime) === null) {
      throw new AppError("\u63D0\u9192\u9700\u8981\u8BA1\u5212\u65E5\u671F\u548C\u6709\u6548\u7684 HH:MM \u65F6\u95F4");
    }
  }
}
function windowMinutes(task, settings) {
  const focus = task.focusMinutes ?? settings.focusMinutes;
  const sessions = Math.max(1, task.estimate);
  const every = Math.max(1, settings.longBreakEvery);
  let breaks = 0;
  for (let i = 1; i < sessions; i += 1) {
    breaks += i % every === 0 ? settings.longBreakMinutes : settings.shortBreakMinutes;
  }
  return sessions * focus + breaks;
}
function reminderIdle(data) {
  return !data.timer.running && data.timer.startedAt === null && data.timer.remainingSecs === data.timer.durationSecs && data.lock.active === null;
}
function pendingReminder(data) {
  if (!reminderIdle(data)) return null;
  let best = null;
  for (const t of data.tasks) {
    if (t.completed || !t.reminderPending) continue;
    if (best === null || `${t.dueDate}|${t.reminderTime}|${t.id}` < `${best.dueDate}|${best.reminderTime}|${best.id}`) {
      best = t;
    }
  }
  return best;
}
function dueAutoTask(data) {
  let best = null;
  for (const t of data.tasks) {
    if (!t.reminderPending || !taskHasRoundsLeft(data, t)) continue;
    if (best === null || `${t.dueDate}|${t.reminderTime}|${t.id}` < `${best.dueDate}|${best.reminderTime}|${best.id}`) {
      best = t;
    }
  }
  return best;
}
function taskHasRoundsLeft(data, task) {
  if (task.completed || task.reminderExpired) return false;
  const completedRounds = data.sessions.filter(
    (s) => s.source === "timer" && s.completed && s.taskId === task.id
  ).length;
  return completedRounds < task.estimate;
}
function startDueTask(data, at) {
  if (!data.settings.autoStartTasks || !reminderIdle(data) || data.education.assessments.some(
    (a) => a.startedAt !== null && a.stoppedAt === null
  )) {
    return false;
  }
  const task = dueAutoTask(data);
  if (task === null) return false;
  data.timer.taskId = task.id;
  resetTo(data, "focus");
  startTimer(data, at);
  return true;
}
function tickReminders(data, at) {
  const today = dateAt(at);
  const nowMinutes = Math.floor(secondsOfDay(at) / 60);
  const nowSeconds = secondsOfDay(at);
  const settings = data.settings;
  let changed = false;
  for (const t of data.tasks) {
    const isToday = t.dueDate === today;
    const past = t.dueDate !== null && t.dueDate < today;
    const start = t.reminderTime !== null ? minutesOf(t.reminderTime) : null;
    const expired = !t.completed && (start !== null ? (() => {
      const spentAt = start + windowMinutes(t, settings) + (isHabit(t) ? 0 : t.scrapMinutes);
      return past || isToday && nowSeconds >= spentAt * 60;
    })() : false);
    if (expired && !t.reminderExpired) {
      t.reminderExpired = true;
      changed = true;
    }
    if ((t.completed || expired || !isToday) && t.reminderPending) {
      t.reminderPending = false;
      changed = true;
    }
    if (expired && !t.reminderFired) {
      t.reminderFired = true;
      changed = true;
    }
    if (!t.completed && !t.reminderFired && isToday && !expired && start !== null && start <= nowMinutes) {
      t.reminderFired = true;
      t.reminderPending = true;
      changed = true;
    }
  }
  return changed;
}
function timerRemaining(timer, at) {
  if (timer.running && timer.deadline !== null) {
    const remaining = timer.deadline - at;
    return Math.min(Math.max(remaining, 0), timer.durationSecs);
  }
  return timer.remainingSecs;
}
function recordSession(data, at, completed) {
  const elapsed = data.timer.durationSecs - timerRemaining(data.timer, at);
  if (data.timer.mode !== "focus" || elapsed === 0) return;
  const task = data.tasks.find((t) => t.id === data.timer.taskId);
  const project = task !== void 0 && task.projectId !== null ? data.projects.find((p) => p.id === task.projectId) : void 0;
  data.sessions.push({
    id: id(),
    source: "timer",
    taskId: data.timer.taskId,
    taskTitle: task?.title ?? "\u81EA\u7531\u4E13\u6CE8",
    projectName: project?.name ?? "\u672A\u5206\u7C7B",
    startedAt: data.timer.startedAt ?? at - elapsed,
    endedAt: at,
    durationSecs: elapsed,
    completed
  });
}
function resetTo(data, mode) {
  data.timer.autoFocusBlocked = false;
  data.timer.mode = mode;
  data.timer.running = false;
  data.timer.durationSecs = durationOf(data, mode);
  data.timer.remainingSecs = data.timer.durationSecs;
  data.timer.deadline = null;
  data.timer.startedAt = null;
}
function durationOf(data, mode) {
  const minutes = mode === "focus" ? data.tasks.find((t) => t.id === data.timer.taskId)?.focusMinutes ?? data.settings.focusMinutes : mode === "shortBreak" ? data.settings.shortBreakMinutes : data.settings.longBreakMinutes;
  return 60 * minutes;
}
function startTimer(data, at) {
  if (data.timer.mode === "focus") {
    if (data.timer.startedAt === null && !data.timer.running && data.timer.remainingSecs === data.timer.durationSecs) {
      resetTo(data, "focus");
    }
    const task = data.tasks.find((t) => t.id === data.timer.taskId);
    if (task !== void 0) task.reminderPending = false;
  }
  if (!data.timer.running) {
    if (data.timer.startedAt === null) data.timer.startedAt = at;
    data.timer.deadline = at + data.timer.remainingSecs;
    data.timer.running = true;
  }
}

// packages/core/src/templates.ts
var TEMPLATE_SUBTASK_KEYS = ["id", "title"];
var SHAPE_KEYS = [
  "title",
  "notes",
  "projectId",
  "habitId",
  "focusMinutes",
  "scrapMinutes",
  "priority",
  "estimate",
  "tags",
  "subtasks"
];
var PRINT_SLOT_KEYS = ["days", "time"];
var CALENDAR_SLOT_KEYS = ["dates", "time"];
var TEMPLATE_KEYS = [
  "id",
  "shape",
  "printing",
  "automatic",
  "printAheadDays"
];
var PRINT_RECORD_KEYS = ["templateId", "date"];
function parseTemplateSubtask(raw) {
  if (!isObject(raw)) throw new AppError("\u6A21\u677F\u5B50\u4EFB\u52A1\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...TEMPLATE_SUBTASK_KEYS], "\u6A21\u677F\u5B50\u4EFB\u52A1");
  return {
    id: requiredField(raw, "id", "\u6A21\u677F\u5B50\u4EFB\u52A1", asStr),
    title: requiredField(raw, "title", "\u6A21\u677F\u5B50\u4EFB\u52A1", asStr)
  };
}
function parseShape(raw) {
  if (!isObject(raw)) throw new AppError("\u6A21\u677F\u5F62\u72B6\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...SHAPE_KEYS], "\u6A21\u677F\u5F62\u72B6");
  return {
    title: requiredField(raw, "title", "\u6A21\u677F\u5F62\u72B6", asStr),
    notes: field(raw, "notes", "\u6A21\u677F\u5F62\u72B6", asStr, ""),
    projectId: field(
      raw,
      "projectId",
      "\u6A21\u677F\u5F62\u72B6",
      (v) => asOpt(v, "projectId", asStr),
      null
    ),
    habitId: field(
      raw,
      "habitId",
      "\u6A21\u677F\u5F62\u72B6",
      (v) => asOpt(v, "habitId", asStr),
      null
    ),
    focusMinutes: field(
      raw,
      "focusMinutes",
      "\u6A21\u677F\u5F62\u72B6",
      (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
      null
    ),
    scrapMinutes: field(raw, "scrapMinutes", "\u6A21\u677F\u5F62\u72B6", asInt, 0),
    priority: field(raw, "priority", "\u6A21\u677F\u5F62\u72B6", asInt, 0),
    estimate: field(raw, "estimate", "\u6A21\u677F\u5F62\u72B6", asInt, 1),
    tags: field(
      raw,
      "tags",
      "\u6A21\u677F\u5F62\u72B6",
      (v) => asArray(v, "tags").map((t) => asStr(t, "\u6807\u7B7E")),
      []
    ),
    subtasks: field(
      raw,
      "subtasks",
      "\u6A21\u677F\u5F62\u72B6",
      (v) => asArray(v, "subtasks").map(parseTemplateSubtask),
      []
    )
  };
}
function serializeShape(s) {
  return {
    title: s.title,
    notes: s.notes,
    projectId: s.projectId,
    habitId: s.habitId,
    focusMinutes: s.focusMinutes,
    scrapMinutes: s.scrapMinutes,
    priority: s.priority,
    estimate: s.estimate,
    tags: s.tags,
    subtasks: s.subtasks.map((sub) => ({ id: sub.id, title: sub.title }))
  };
}
function parsePrintSlot(raw) {
  if (!isObject(raw)) throw new AppError("\u5468\u671F\u65F6\u6BB5\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...PRINT_SLOT_KEYS], "\u5468\u671F\u65F6\u6BB5");
  return {
    days: asArray(
      requiredField(raw, "days", "\u5468\u671F\u65F6\u6BB5", (v) => v),
      "days"
    ).map((d) => asInt(d, "\u5468\u671F\u661F\u671F")),
    time: field(
      raw,
      "time",
      "\u5468\u671F\u65F6\u6BB5",
      (v) => asOpt(v, "time", asStr),
      null
    )
  };
}
function parseCalendarSlot(raw) {
  if (!isObject(raw)) throw new AppError("\u65E5\u7A0B\u65F6\u6BB5\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...CALENDAR_SLOT_KEYS], "\u65E5\u7A0B\u65F6\u6BB5");
  return {
    dates: asArray(
      requiredField(raw, "dates", "\u65E5\u7A0B\u65F6\u6BB5", (v) => v),
      "dates"
    ).map((d) => asStr(d, "\u65E5\u7A0B\u65E5\u671F")),
    time: field(
      raw,
      "time",
      "\u65E5\u7A0B\u65F6\u6BB5",
      (v) => asOpt(v, "time", asStr),
      null
    )
  };
}
function parsePrinting(raw) {
  if (!isObject(raw)) throw new AppError("\u5370\u5237\u89C4\u5219\u5FC5\u987B\u662F\u5BF9\u8C61");
  const kind = oneOf(
    requiredField(raw, "kind", "\u5370\u5237\u89C4\u5219", (v) => v),
    "\u5370\u5237\u89C4\u5219 kind",
    ["once", "calendar", "weekly"]
  );
  if (kind === "once") {
    rejectUnknown(raw, ["kind", "date", "time"], "\u4E00\u6B21\u6027\u5370\u5237\u89C4\u5219");
    return {
      kind,
      date: field(
        raw,
        "date",
        "\u4E00\u6B21\u6027\u5370\u5237\u89C4\u5219",
        (v) => asOpt(v, "date", asStr),
        null
      ),
      time: field(
        raw,
        "time",
        "\u4E00\u6B21\u6027\u5370\u5237\u89C4\u5219",
        (v) => asOpt(v, "time", asStr),
        null
      )
    };
  }
  if (kind === "calendar") {
    rejectUnknown(raw, ["kind", "slots"], "\u65E5\u7A0B\u5370\u5237\u89C4\u5219");
    return {
      kind,
      slots: asArray(
        requiredField(raw, "slots", "\u65E5\u7A0B\u5370\u5237\u89C4\u5219", (v) => v),
        "slots"
      ).map(parseCalendarSlot)
    };
  }
  rejectUnknown(raw, ["kind", "slots"], "\u5468\u671F\u5370\u5237\u89C4\u5219");
  return {
    kind,
    slots: asArray(
      requiredField(raw, "slots", "\u5468\u671F\u5370\u5237\u89C4\u5219", (v) => v),
      "slots"
    ).map(parsePrintSlot)
  };
}
function serializePrinting(p) {
  if (p.kind === "once") {
    return { kind: "once", date: p.date, time: p.time };
  }
  if (p.kind === "calendar") {
    return {
      kind: "calendar",
      slots: p.slots.map((s) => ({ dates: s.dates, time: s.time }))
    };
  }
  return {
    kind: "weekly",
    slots: p.slots.map((s) => ({ days: s.days, time: s.time }))
  };
}
function parseTemplate(raw) {
  if (!isObject(raw)) throw new AppError("\u6A21\u677F\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...TEMPLATE_KEYS], "\u6A21\u677F");
  return {
    id: requiredField(raw, "id", "\u6A21\u677F", asStr),
    shape: parseShape(requiredField(raw, "shape", "\u6A21\u677F", (v) => v)),
    printing: parsePrinting(requiredField(raw, "printing", "\u6A21\u677F", (v) => v)),
    automatic: field(raw, "automatic", "\u6A21\u677F", asBool, false),
    printAheadDays: field(raw, "printAheadDays", "\u6A21\u677F", asInt, 7)
  };
}
function serializeTemplate(t) {
  return {
    id: t.id,
    shape: serializeShape(t.shape),
    printing: serializePrinting(t.printing),
    automatic: t.automatic,
    printAheadDays: t.printAheadDays
  };
}
function parsePrintRecord(raw) {
  if (!isObject(raw)) throw new AppError("\u5370\u5237\u8BB0\u5F55\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...PRINT_RECORD_KEYS], "\u5370\u5237\u8BB0\u5F55");
  return {
    templateId: requiredField(raw, "templateId", "\u5370\u5237\u8BB0\u5F55", asStr),
    date: field(
      raw,
      "date",
      "\u5370\u5237\u8BB0\u5F55",
      (v) => asOpt(v, "date", asStr),
      null
    )
  };
}
function serializePrintRecord(p) {
  return { templateId: p.templateId, date: p.date };
}
function templateRecurring(template) {
  return template.printing.kind === "weekly";
}
function templateTimes(template, date) {
  if (date === null || !validDate(date)) {
    throw new AppError("\u65E0\u6548\u7684\u5370\u5237\u65E5\u671F");
  }
  const printing = template.printing;
  if (printing.kind === "once") {
    if (printing.time !== null && date === null) {
      throw new AppError("\u5B9A\u65F6\u5B9E\u4F8B\u9700\u8981\u65E5\u671F");
    }
    return [printing.time];
  }
  if (printing.kind === "calendar") {
    const times2 = printing.slots.filter((s) => s.dates.includes(date)).map((s) => s.time);
    if (times2.length === 0) {
      throw new AppError("\u8BE5\u65E5\u671F\u4E0D\u5728\u65E5\u7A0B\u8868\u4E2D");
    }
    return times2;
  }
  const weekday = weekdayMonday(parseDate(date));
  const times = printing.slots.filter((s) => s.days.includes(weekday)).map((s) => s.time);
  if (times.length === 0) {
    throw new AppError("\u8BE5\u65E5\u671F\u4E0D\u5728\u672C\u5468\u5B89\u6392\u4E2D");
  }
  return times;
}
function templateInstance(template, date, time, at) {
  const task = {
    id: id(),
    templateId: template.id,
    recurring: templateRecurring(template),
    title: "",
    notes: "",
    projectId: null,
    habitId: null,
    dueDate: date,
    reminderTime: time,
    focusMinutes: null,
    scrapMinutes: 0,
    priority: 0,
    estimate: 1,
    reminderFired: false,
    reminderPending: false,
    reminderExpired: false,
    completed: false,
    completedAt: null,
    createdAt: at,
    tags: [],
    subtasks: []
  };
  copyShape(template.shape, task);
  return task;
}
function copyShape(shape, task) {
  task.title = shape.title;
  task.notes = shape.notes;
  task.projectId = shape.projectId;
  task.habitId = shape.habitId;
  task.focusMinutes = shape.focusMinutes;
  task.scrapMinutes = isHabit(task) ? 0 : shape.scrapMinutes;
  task.priority = shape.priority;
  task.estimate = shape.estimate;
  task.tags = [...shape.tags];
  task.subtasks = shape.subtasks.map((sub) => ({
    id: sub.id,
    title: sub.title,
    done: task.subtasks.some((old) => old.id === sub.id && old.done)
  }));
}
function validateTemplates(data) {
  if (data.templates.length > 5e3 || data.prints.length > 2e5) {
    throw new AppError("\u6A21\u677F\u6216\u5370\u5237\u8BB0\u5F55\u8D85\u51FA\u9650\u5236");
  }
  const ids = /* @__PURE__ */ new Set();
  for (const t of data.templates) {
    if (t.id.length === 0 || ids.has(t.id)) {
      throw new AppError("\u6A21\u677F ID \u91CD\u590D\u6216\u4E3A\u7A7A");
    }
    ids.add(t.id);
    const s = t.shape;
    if (t.printAheadDays > 90) {
      throw new AppError("\u9884\u5370\u5929\u6570\u9700\u4E3A 0\u201390 \u5929");
    }
    if (s.title.trim().length === 0 || Array.from(s.title).length > 200 || s.notes.length > 5e4 || s.priority > 3 || s.estimate < 1 || s.estimate > 99 || s.scrapMinutes > 10080 || s.focusMinutes !== null && (s.focusMinutes < 1 || s.focusMinutes > 180) || s.tags.length > 20 || s.tags.some((tag) => Array.from(tag).length > 40)) {
      throw new AppError("\u65E0\u6548\u7684\u6A21\u677F\u5F62\u72B6");
    }
    const subs = /* @__PURE__ */ new Set();
    if (s.subtasks.length > 200 || s.subtasks.some(
      (sub) => sub.id.length === 0 || subs.has(sub.id) || sub.title.trim().length === 0 || Array.from(sub.title).length > 200
    )) {
      throw new AppError("\u65E0\u6548\u7684\u6A21\u677F\u5B50\u4EFB\u52A1");
    }
    for (const sub of s.subtasks) subs.add(sub.id);
    if (s.projectId !== null && !data.projects.some((p) => p.id === s.projectId) || s.habitId !== null && !data.habits.some((h) => h.id === s.habitId)) {
      throw new AppError("\u6A21\u677F\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5BB9\u5668");
    }
    const printing = t.printing;
    if (printing.kind === "once") {
      if (printing.date === null || !validDate(printing.date) || printing.time !== null && !validTime(printing.time)) {
        throw new AppError("\u65E0\u6548\u7684\u4E00\u6B21\u5370\u5237\u65E5\u671F\u6216\u65F6\u95F4");
      }
      if (s.habitId !== null) {
        throw new AppError("\u4E60\u60EF\u6A21\u677F\u5FC5\u987B\u91CD\u590D\u5370\u5237");
      }
    } else if (printing.kind === "calendar") {
      if (printing.slots.length === 0 || printing.slots.length > 49 || s.habitId !== null) {
        throw new AppError("\u975E\u91CD\u590D\u65E5\u7A0B\u9700\u8981 1\u201349 \u4E2A\u65F6\u6BB5\uFF0C\u4E0D\u80FD\u5C5E\u4E8E\u4E60\u60EF\u7EC4");
      }
      const seen = /* @__PURE__ */ new Set();
      const times = /* @__PURE__ */ new Set();
      for (const slot of printing.slots) {
        const timeKey = slot.time ?? "null";
        if (slot.dates.length === 0 || slot.dates.length > 366 || slot.time !== null && !validTime(slot.time) || (times.has(timeKey) ? true : (times.add(timeKey), false)) || slot.dates.some((date) => {
          const key = `${date}|${timeKey}`;
          return !validDate(date) || (seen.has(key) ? true : (seen.add(key), false));
        })) {
          throw new AppError(
            "\u65E0\u6548\u6216\u91CD\u590D\u7684\u65E5\u7A0B\u65F6\u6BB5\uFF0C\u8BF7\u628A\u540C\u4E00\u5F00\u59CB\u65F6\u95F4\u7684\u65E5\u671F\u5408\u5E76"
          );
        }
      }
      if (seen.size > 366) {
        throw new AppError("\u4E00\u6B21\u65E5\u7A0B\u8868\u6700\u591A 366 \u9879");
      }
    } else {
      if (printing.slots.length === 0 || printing.slots.length > 49) {
        throw new AppError("\u6BCF\u5468\u5FAA\u73AF\u9700\u8981 1\u201349 \u4E2A\u65F6\u6BB5");
      }
      const seen = /* @__PURE__ */ new Set();
      for (const slot of printing.slots) {
        const unique = new Set(slot.days);
        if (slot.days.length === 0 || slot.days.length > 7 || unique.size !== slot.days.length || slot.days.some((d) => d < 1 || d > 7) || slot.time !== null && !validTime(slot.time) || s.habitId !== null && slot.time === null || slot.days.some((day) => seen.has(`${day}|${slot.time ?? "null"}`))) {
          throw new AppError("\u65E0\u6548\u6216\u91CD\u590D\u7684\u5468\u671F\u65F6\u6BB5");
        }
        for (const day of slot.days) seen.add(`${day}|${slot.time ?? "null"}`);
      }
      if (printing.slots.some((s2) => s2.time !== null) && printing.slots.some((s2) => s2.time === null)) {
        throw new AppError("\u4E00\u4E2A\u5468\u671F\u4E0D\u80FD\u6DF7\u7528\u5B9A\u65F6\u4E0E\u4E0D\u5B9A\u65F6\u5355\u5143");
      }
    }
  }
  const prints = /* @__PURE__ */ new Set();
  for (const p of data.prints) {
    if (!ids.has(p.templateId) || p.date === null || !validDate(p.date) || prints.has(`${p.templateId}|${p.date}`)) {
      throw new AppError("\u65E0\u6548\u6216\u91CD\u590D\u7684\u5370\u5237\u8BB0\u5F55");
    }
    prints.add(`${p.templateId}|${p.date}`);
  }
  if (data.tasks.some((t) => t.templateId !== null && !ids.has(t.templateId))) {
    throw new AppError("\u5B9E\u4F8B\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u6A21\u677F");
  }
}
function printInstances(data, shape, printing, at) {
  if (printing.kind === "weekly") {
    throw new AppError("\u5FAA\u73AF\u89C4\u5219\u9700\u8981\u4FDD\u7559\u4E3A\u6A21\u677F");
  }
  const dates = printing.kind === "once" ? [printing.date] : [...new Set(printing.slots.flatMap((s) => s.dates))].sort();
  const templateId = id();
  data.templates.push({
    id: templateId,
    shape,
    printing,
    automatic: false,
    printAheadDays: 0
  });
  data.validate();
  printTemplate(data, templateId, dates, at);
  deleteTemplate(data, templateId);
}
function saveTemplate(data, template) {
  template.shape.title = template.shape.title.trim();
  if (template.shape.habitId === null && template.printing.kind === "weekly" && template.printing.slots.every((s) => s.time !== null)) {
    const existingHabit = data.templates.find((t) => t.id === template.id)?.shape.habitId ?? null;
    const hid = existingHabit ?? id();
    if (!data.habits.some((h) => h.id === hid)) {
      data.habits.push({
        id: hid,
        name: Array.from(template.shape.title).slice(0, 40).join("")
      });
    }
    template.shape.habitId = hid;
  }
  const index = data.templates.findIndex((t) => t.id === template.id);
  if (index >= 0) {
    data.templates[index] = template;
  } else {
    data.templates.push(template);
  }
}
function deleteTemplate(data, id2) {
  data.templates = data.templates.filter((t) => t.id !== id2);
  data.prints = data.prints.filter((p) => p.templateId !== id2);
  for (const task of data.tasks) {
    if (task.templateId === id2) task.templateId = null;
  }
}
function printTemplate(data, id2, dates, at) {
  if (dates.length === 0 || dates.length > 366) {
    throw new AppError("\u6BCF\u6B21\u5370\u5237\u9700\u8981 1\u2013366 \u4E2A\u65E5\u671F");
  }
  const templateIndex = data.templates.findIndex((t) => t.id === id2);
  if (templateIndex < 0) {
    throw new AppError("\u6A21\u677F\u4E0D\u5B58\u5728");
  }
  const template = data.templates[templateIndex];
  let resolved;
  if (template.printing.kind === "weekly") {
    const days = [
      ...new Set(template.printing.slots.flatMap((s) => s.days))
    ].sort((a, b) => a - b);
    const expanded = /* @__PURE__ */ new Set();
    for (const date of dates) {
      if (date === null) throw new AppError("\u5468\u671F\u5370\u5237\u9700\u8981\u65E5\u671F");
      if (!validDate(date)) throw new AppError("\u65E0\u6548\u7684\u5468\u671F\u65E5\u671F");
      const parsed = parseDate(date);
      const monday = weekStart(parsed);
      for (const day of days) {
        const d = addDays(monday, day - 1);
        expanded.add(
          `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
        );
      }
    }
    if (expanded.size > 366) {
      throw new AppError("\u4E00\u6B21\u5370\u5237\u8303\u56F4\u8FC7\u5927\uFF0C\u8BF7\u62C6\u5206\u5468\u671F");
    }
    resolved = [...expanded].sort();
  } else {
    resolved = [...dates];
  }
  const batches = resolved.map((date) => ({
    date,
    times: templateTimes(template, date)
  }));
  const printedDates = new Set(
    data.prints.filter((p) => p.templateId === id2).map((p) => p.date)
  );
  for (const { date, times } of batches) {
    if (printedDates.has(date)) continue;
    let printed = false;
    for (const time of times) {
      const task = templateInstance(template, date, time, at);
      if (printingExpired(data, task, at)) continue;
      data.tasks.push(task);
      printed = true;
    }
    if (printed) {
      printedDates.add(date);
      data.prints.push({ templateId: id2, date });
    }
  }
}
function printingExpired(data, task, at) {
  if (task.reminderTime === null) return false;
  if (task.dueDate === null) return false;
  const today = dateAt(at);
  if (task.dueDate < today) return true;
  if (task.dueDate > today) return false;
  const start = minutesOf(task.reminderTime);
  const grace = isHabit(task) ? 0 : task.scrapMinutes;
  const end = start + windowMinutes(task, data.settings) + grace;
  return secondsOfDay(at) >= end * 60;
}
function syncTemplate(data, id2) {
  const template = data.templates.find((t) => t.id === id2);
  if (template === void 0) {
    throw new AppError("\u6A21\u677F\u4E0D\u5B58\u5728");
  }
  const voidIds = new Set(
    data.tasks.filter((t) => taskIsVoid(t)).map((t) => t.id)
  );
  for (const task of data.tasks) {
    if (!voidIds.has(task.id) && !task.completed && task.templateId === id2) {
      const shape = { ...template.shape };
      shape.habitId = task.habitId;
      copyShape(shape, task);
    }
  }
}
function taskIsVoid(task) {
  return !task.completed && task.reminderTime !== null && task.reminderExpired;
}
function materializeTemplates(data, at) {
  const today = parseDate(dateAt(at));
  const printed = new Set(
    data.prints.map((p) => `${p.templateId}|${p.date ?? "null"}`)
  );
  const requests = [];
  for (const template of data.templates) {
    if (!template.automatic) continue;
    const end = addDays(today, template.printAheadDays);
    const endStr = `${end.year}-${String(end.month).padStart(2, "0")}-${String(end.day).padStart(2, "0")}`;
    let dates = [];
    const printing = template.printing;
    if (printing.kind === "once") {
      if (printing.date !== null && printing.date <= endStr)
        dates = [printing.date];
    } else if (printing.kind === "calendar") {
      dates = [
        ...new Set(
          printing.slots.flatMap((s) => s.dates).filter((d) => d <= endStr)
        )
      ].sort();
    } else {
      const days = [...new Set(printing.slots.flatMap((s) => s.days))].sort(
        (a, b) => a - b
      );
      let monday = weekStart(today);
      const last = weekStart(end);
      while (compareIso(monday) <= compareIso(last)) {
        for (const day of days) {
          const d = addDays(monday, day - 1);
          dates.push(
            `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
          );
        }
        monday = addDays(monday, 7);
      }
    }
    const missing = dates.filter((d) => !printed.has(`${template.id}|${d}`));
    if (missing.length > 0) {
      requests.push({ id: template.id, dates: missing });
    }
  }
  let changed = false;
  for (const { id: templateId, dates } of requests) {
    const candidate = clone(data);
    try {
      printTemplate(candidate, templateId, dates, at);
      if (candidate.tasks.length !== data.tasks.length) {
        candidate.validate();
        replaceAppData(data, candidate);
        changed = true;
      }
    } catch {
    }
  }
  return changed;
}
function compareIso(date) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
function replaceAppData(target, source) {
  for (const key of Object.keys(source)) {
    target[key] = source[key];
  }
}
function fromTask(task, repeat, at) {
  const date = task.dueDate ?? dateAt(at);
  const weekday = (() => {
    const parsed = parseDate(date);
    return parsed === null ? 1 : weekdayMonday(parsed);
  })();
  const days = repeat === "daily" ? [1, 2, 3, 4, 5, 6, 7] : repeat === "weekdays" ? [1, 2, 3, 4, 5] : [weekday];
  return {
    id: id(),
    automatic: true,
    printAheadDays: 0,
    printing: { kind: "weekly", slots: [{ days, time: task.reminderTime }] },
    shape: {
      title: task.title,
      notes: task.notes,
      projectId: task.projectId,
      habitId: task.habitId,
      focusMinutes: task.focusMinutes,
      scrapMinutes: task.scrapMinutes,
      priority: task.priority,
      estimate: task.estimate,
      tags: [...task.tags],
      subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title }))
    }
  };
}

// packages/core/src/learning.ts
function parseCompletedStudyTask(raw) {
  if (!isObject(raw)) throw new AppError("\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    ["id", "projectId", "title", "notes", "topics", "completedAt"],
    "\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167"
  );
  return {
    id: requiredField(raw, "id", "\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167", asStr),
    projectId: requiredField(raw, "projectId", "\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167", asStr),
    title: requiredField(raw, "title", "\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167", asStr),
    notes: requiredField(raw, "notes", "\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167", asStr),
    topics: field(
      raw,
      "topics",
      "\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167",
      (v) => asArray(v, "topics").map((x) => asStr(x, "\u77E5\u8BC6\u70B9")),
      []
    ),
    completedAt: requiredField(raw, "completedAt", "\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167", asInt)
  };
}
function serializeCompletedStudyTask(t) {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    notes: t.notes,
    topics: t.topics,
    completedAt: t.completedAt
  };
}
function text(s, max) {
  return s.trim().length > 0 && Array.from(s).length <= max;
}
function validateLearning(data) {
  const e = data.education;
  ensure(
    e.progress.length + e.completedTasks.length + e.corrections.length <= 1e5,
    "\u5B66\u4E60\u8BC1\u636E\u6570\u91CF\u8D85\u51FA\u9650\u5236"
  );
  const ids = /* @__PURE__ */ new Set();
  for (const task of e.completedTasks) {
    ensure(
      !ids.has(`task|${task.id}`) && task.id.length > 0 && data.projects.some((p) => p.id === task.projectId) && text(task.title, 200) && task.notes.length <= 5e4 && task.topics.length <= 20,
      "\u65E0\u6548\u7684\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1\u5FEB\u7167"
    );
    ids.add(`task|${task.id}`);
  }
  for (const record of e.progress) {
    ensure(
      !ids.has(`progress|${record.id}`) && record.id.length > 0 && data.projects.some((p) => p.id === record.projectId) && text(record.topic, 200) && text(record.position, 2e3) && text(record.evidence, 8e3) && Array.from(record.nextAction).length <= 2e3,
      "\u5B66\u4E60\u8FDB\u5EA6\u9700\u8981\u9879\u76EE\u3001\u77E5\u8BC6\u70B9\u3001\u5B9E\u9645\u4F4D\u7F6E\u548C\u4F9D\u636E"
    );
    ids.add(`progress|${record.id}`);
  }
  for (const correction of e.corrections) {
    const grade = require2(e.grades.find(
      (g) => g.id === correction.gradeId
    ), "\u8BA2\u6B63\u7F3A\u5C11\u6279\u6539\u8BB0\u5F55");
    const assessment = require2((() => {
      const sub = e.submissions.find((s) => s.id === grade.submissionId);
      return sub === void 0 ? void 0 : e.assessments.find((a) => a.id === sub.assessmentId);
    })(), "\u8BA2\u6B63\u7F3A\u5C11\u8BD5\u9898");
    ensure(
      !ids.has(`correction|${correction.id}`) && correction.id.length > 0 && assessment.questions.some((q) => q.id === correction.questionId) && Array.from(correction.explanation).length <= 8e3 && (text(correction.explanation, 8e3) || correction.resourceIds.length > 0) && correction.resourceIds.every(
        (id2) => e.resources.some(
          (r) => r.id === id2 && r.projectId === assessment.projectId
        )
      ) && correction.accepted !== null === (correction.reviewedAt !== null) && (correction.reviewedAt === null || correction.reviewedAt >= correction.submittedAt && text(correction.feedback, 8e3)),
      "\u8BA2\u6B63\u9700\u8981\u539F\u9898\u3001\u89E3\u91CA\u6216\u672C\u9879\u76EE\u9644\u4EF6\uFF1B\u68C0\u67E5\u7ED3\u679C\u5FC5\u987B\u6709\u53CD\u9988"
    );
    ids.add(`correction|${correction.id}`);
  }
}
function validateLearningTransition(before, after) {
  for (const record of before.progress) {
    ensure(
      after.progress.some((r) => r.id === record.id),
      "\u8FDB\u5EA6\u5386\u53F2\u4E0D\u80FD\u5220\u9664\uFF0C\u8BF7\u65B0\u589E\u66F4\u6B63\u8BB0\u5F55"
    );
    const next = after.progress.find((r) => r.id === record.id);
    if (next !== void 0) {
      const old = { ...record };
      old.confirmed = next.confirmed;
      ensure(progressEquals(old, next), "\u8FDB\u5EA6\u5386\u53F2\u4E0D\u53EF\u6539\u5199\uFF0C\u8BF7\u65B0\u589E\u4E00\u6761\u66F4\u6B63\u8BB0\u5F55");
    }
  }
  for (const record of before.completedTasks) {
    ensure(
      after.completedTasks.find((r) => r.id === record.id) !== void 0 && completedTaskEquals(
        after.completedTasks.find((r) => r.id === record.id),
        record
      ),
      "\u5DF2\u5B8C\u6210\u4EFB\u52A1\u7684\u5B66\u4E60\u5185\u5BB9\u5FEB\u7167\u4E0D\u53EF\u6539\u5199"
    );
  }
  for (const record of before.corrections) {
    ensure(
      after.corrections.some((r) => r.id === record.id),
      "\u8BA2\u6B63\u5386\u53F2\u4E0D\u80FD\u5220\u9664"
    );
    const next = after.corrections.find((r) => r.id === record.id);
    if (next !== void 0) {
      const old = { ...record, resourceIds: [...record.resourceIds] };
      if (old.reviewedAt === null) {
        old.accepted = next.accepted;
        old.feedback = next.feedback;
        old.reviewedAt = next.reviewedAt;
      }
      ensure(
        correctionEquals(old, next),
        "\u8BA2\u6B63\u4E0E\u68C0\u67E5\u5386\u53F2\u4E0D\u53EF\u6539\u5199\uFF0C\u8BF7\u65B0\u589E\u4E00\u6B21\u8BA2\u6B63"
      );
    }
  }
}
function progressEquals(a, b) {
  return a.id === b.id && a.projectId === b.projectId && a.topic === b.topic && a.position === b.position && a.state === b.state && a.evidence === b.evidence && a.nextAction === b.nextAction && a.source === b.source && a.confirmed === b.confirmed && a.recordedAt === b.recordedAt;
}
function completedTaskEquals(a, b) {
  return a.id === b.id && a.projectId === b.projectId && a.title === b.title && a.notes === b.notes && a.topics.length === b.topics.length && a.topics.every((t, i) => b.topics[i] === t) && a.completedAt === b.completedAt;
}
function correctionEquals(a, b) {
  return a.id === b.id && a.gradeId === b.gradeId && a.questionId === b.questionId && a.explanation === b.explanation && a.resourceIds.length === b.resourceIds.length && a.resourceIds.every((r, i) => b.resourceIds[i] === r) && a.submittedAt === b.submittedAt && a.accepted === b.accepted && a.feedback === b.feedback && a.reviewedAt === b.reviewedAt;
}
function buildSummaryIndex(e) {
  const index = {
    submissions: /* @__PURE__ */ new Map(),
    grades: /* @__PURE__ */ new Map(),
    assessmentGrades: /* @__PURE__ */ new Map(),
    accepted: /* @__PURE__ */ new Set(),
    retests: /* @__PURE__ */ new Map()
  };
  const parents = /* @__PURE__ */ new Map();
  for (const s of e.submissions) {
    parents.set(s.id, s.assessmentId);
    const old = index.submissions.get(s.assessmentId);
    if (old === void 0 || s.submittedAt >= old.submittedAt) {
      index.submissions.set(s.assessmentId, s);
    }
  }
  for (const g of e.grades) {
    const old = index.grades.get(g.submissionId);
    if (old === void 0 || g.gradedAt >= old.gradedAt) {
      index.grades.set(g.submissionId, g);
    }
    const assessment = parents.get(g.submissionId);
    if (assessment !== void 0) {
      const oldA = index.assessmentGrades.get(assessment);
      if (oldA === void 0 || g.gradedAt >= oldA.gradedAt) {
        index.assessmentGrades.set(assessment, g);
      }
    }
  }
  for (const c of e.corrections) {
    if (c.accepted === true) {
      index.accepted.add(`${c.gradeId}|${c.questionId}`);
    }
  }
  for (const a of e.assessments) {
    if (a.retestOfGradeId !== null) {
      const list = index.retests.get(a.retestOfGradeId) ?? [];
      list.push(a);
      index.retests.set(a.retestOfGradeId, list);
    }
  }
  return index;
}
function assessmentSummary(index, a, at) {
  const submission = index.submissions.get(a.id) ?? null;
  const grade = submission !== null ? index.grades.get(submission.id) ?? null : null;
  const status = (() => {
    if (grade !== null) {
      if (grade.needsReview) return "needsReview";
      if (grade.errors.some(
        (error) => !index.accepted.has(`${grade.id}|${error.questionId}`)
      )) {
        return "correctionDue";
      }
      return "graded";
    }
    if (submission !== null) return "submitted";
    if (a.kind !== "homework" && a.startedAt === null && dateAt(at) > dateAt(a.startsAt)) {
      return "missed";
    }
    if (a.kind !== "homework" && a.startedAt !== null && a.stoppedAt === null && at < examDeadline(a)) {
      return "inProgress";
    }
    if (a.kind !== "homework" && a.startedAt !== null && (a.stoppedAt !== null || at >= examDeadline(a))) {
      return "awaitingSubmission";
    }
    if (a.kind === "homework" && at >= a.endsAt) return "overdue";
    if (at < a.startsAt || a.kind !== "homework" && a.startedAt === null)
      return "upcoming";
    return "awaitingSubmission";
  })();
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    submissionId: submission?.id ?? null,
    submittedAt: submission?.submittedAt ?? null,
    unfinished: submission !== null && submission.unfinished,
    late: a.kind === "homework" && submission !== null && submission.submittedAt > a.endsAt,
    gradeId: grade?.id ?? null,
    gradedAt: grade?.gradedAt ?? null,
    score: grade !== null && !grade.needsReview ? grade.awards.reduce((n, p) => n + p.awarded, 0) : null,
    total: a.questions.reduce(
      (n, q) => n + q.scoring.reduce((m, p) => m + p.points, 0),
      0
    ),
    needsReview: grade !== null && grade.needsReview
  };
}
function examDeadline(a) {
  return a.startedAt === null ? a.endsAt : a.startedAt + (a.endsAt - a.startsAt);
}
function summaries(data, at) {
  const e = data.education;
  const index = buildSummaryIndex(e);
  const out = [];
  for (const project of data.projects.filter(
    (p) => e.projects.some((s) => s.projectId === p.id) || e.progress.some((r) => r.projectId === p.id)
  )) {
    const progress = e.progress.filter((r) => r.projectId === project.id).slice().sort((a, b) => a.recordedAt - b.recordedAt);
    const topics = /* @__PURE__ */ new Set();
    const latest = progress.slice().reverse().filter((r) => {
      if (topics.has(r.topic)) return false;
      topics.add(r.topic);
      return true;
    });
    const assessments = e.assessments.filter((a) => a.projectId === project.id).map((a) => assessmentSummary(index, a, at)).sort((a, b) => b.startsAt - a.startsAt);
    const retests = [];
    const grades = e.assessments.filter((a) => a.projectId === project.id).map((a) => index.assessmentGrades.get(a.id)).filter((g) => g !== void 0);
    for (const grade of grades) {
      const attempts = (index.retests.get(grade.id) ?? []).map(
        (a) => assessmentSummary(index, a, at)
      );
      for (const error of grade.errors) {
        retests.push({
          gradeId: grade.id,
          questionId: error.questionId,
          cause: error.cause,
          confirmed: error.confirmed,
          retestDate: error.retestDate,
          nextCheck: error.nextCheck,
          correctionAccepted: index.accepted.has(
            `${grade.id}|${error.questionId}`
          ),
          attempts
        });
      }
    }
    retests.sort(
      (a, b) => String(a["retestDate"]).localeCompare(String(b["retestDate"]))
    );
    const recentTasks = e.completedTasks.slice().reverse().filter((t) => t.projectId === project.id).slice(0, 5);
    const lessons = e.lessons.filter((l) => l.projectId === project.id);
    const lastLesson = lessons.filter((l) => l.attended).reduce(
      (best, l) => best === null || l.startsAt > best.startsAt ? l : best,
      null
    );
    const latestReview = e.reviews.filter((r) => r.projectId === project.id).reduce(
      (best, r) => best === null || r.date > best.date ? r : best,
      null
    );
    const reviewTime = latestReview === null ? null : atLocalDateString(latestReview.date);
    const updated = Math.max(
      ...[
        ...latest.map((r) => r.recordedAt),
        ...recentTasks.map((r) => r.completedAt),
        ...lastLesson !== null ? [lastLesson.startsAt] : [],
        ...reviewTime !== null ? [reviewTime] : [],
        ...assessments.filter((a) => typeof a["submittedAt"] === "number").map((a) => a["submittedAt"]),
        ...assessments.filter((a) => typeof a["gradedAt"] === "number").map((a) => a["gradedAt"]),
        ...e.corrections.filter((c) => assessments.some((a) => a["gradeId"] === c.gradeId)).map((c) => c.reviewedAt ?? c.submittedAt)
      ].filter((n) => typeof n === "number"),
      -Infinity
    );
    const taskIds = /* @__PURE__ */ new Set([
      ...data.tasks.filter((t) => t.projectId === project.id).map((t) => t.id),
      ...e.completedTasks.filter((t) => t.projectId === project.id).map((t) => t.id)
    ]);
    const actualSeconds = data.sessions.filter(
      (s) => s.source === "timer" && s.endedAt >= at - 7 * 86400 && s.endedAt <= at && s.taskId !== null && taskIds.has(s.taskId)
    ).reduce((n, s) => n + s.durationSecs, 0);
    const assessmentCount = assessments.length;
    const retestCount = retests.length;
    out.push({
      projectId: project.id,
      projectName: project.name,
      updatedAt: Number.isFinite(updated) ? updated : null,
      progress: latest.slice(0, 12),
      progressCount: e.progress.filter((r) => r.projectId === project.id).length,
      recentCompletedTasks: recentTasks,
      lastAttendedLesson: lastLesson === null ? null : {
        id: lastLesson.id,
        title: lastLesson.title,
        progress: lastLesson.progress,
        state: lastLesson.state
      },
      lessons: {
        planned: lessons.filter((l) => l.state === "planned").length,
        attended: lessons.filter((l) => l.attended).length,
        missed: lessons.filter((l) => l.state === "missed").length
      },
      actualFocusSeconds7d: actualSeconds,
      assessments: assessments.slice(0, 20),
      assessmentCount,
      retests: retests.slice(0, 20),
      retestCount,
      latestReview,
      pendingEvents: e.events.filter(
        (r) => r.projectId === project.id && r.state !== "done"
      ).length,
      note: "\u8BA1\u65F6\u4E0E\u4EFB\u52A1\u5B8C\u6210\u53EA\u8BF4\u660E\u6295\u5165\u6216\u81EA\u62A5\u5B8C\u6210\uFF1B\u638C\u63E1\u987B\u67E5\u770B\u7B54\u5377\u3001\u6279\u6539\u4E0E\u72EC\u7ACB\u590D\u6D4B\u3002\u7A7A\u8BB0\u5F55\u8868\u793A\u672A\u77E5\u3002"
    });
  }
  return out;
}

// packages/core/src/education.ts
var COMMAND_KEYS = {
  saveProject: ["op", "project"],
  saveResource: ["op", "resource"],
  saveResources: ["op", "resources"],
  removeResources: ["op", "ids"],
  saveSemester: ["op", "semester"],
  saveLesson: ["op", "lesson"],
  setLessonResources: ["op", "id", "resourceIds"],
  attendLesson: ["op", "id", "progress"],
  publishAssessment: ["op", "assessment"],
  confirmPrinted: ["op", "id"],
  startExam: ["op", "id"],
  endExam: ["op", "id"],
  submit: ["op", "submission"],
  recordQuestionTimes: ["op", "id", "questionTimes"],
  grade: ["op", "grade"],
  saveReview: ["op", "review"],
  claimEvent: ["op", "id"],
  finishEvent: ["op", "id"],
  retryEvent: ["op", "id"],
  recordProgress: ["op", "record"],
  confirmProgress: ["op", "id"],
  submitCorrection: ["op", "correction"],
  reviewCorrection: ["op", "id", "accepted", "feedback"]
};
function parseCommand(raw) {
  if (!isObject(raw)) throw new AppError("\u6559\u5B66\u547D\u4EE4\u5FC5\u987B\u662F\u5BF9\u8C61");
  const op = oneOf(
    requiredField(raw, "op", "\u6559\u5B66\u547D\u4EE4", (v) => v),
    "\u6559\u5B66\u547D\u4EE4 op",
    Object.keys(COMMAND_KEYS)
  );
  rejectUnknown(raw, COMMAND_KEYS[op], "\u6559\u5B66\u547D\u4EE4");
  switch (op) {
    case "saveProject":
      return {
        op,
        project: parseProjectStudy(
          requiredField(raw, "project", "\u6559\u5B66\u547D\u4EE4", (v) => v)
        )
      };
    case "saveResource":
      return {
        op,
        resource: parseResource(
          requiredField(raw, "resource", "\u6559\u5B66\u547D\u4EE4", (v) => v)
        )
      };
    case "saveResources": {
      const list = asArray(
        requiredField(raw, "resources", "\u6559\u5B66\u547D\u4EE4", (v) => v),
        "resources"
      );
      ensure(
        list.length > 0 && list.length <= 5e3,
        "\u6279\u91CF\u767B\u8BB0\u9700\u8981 1\u20135000 \u6761\u8D44\u6E90"
      );
      return { op, resources: list.map((item) => parseResource(item)) };
    }
    case "removeResources":
      return {
        op,
        ids: asArray(
          requiredField(raw, "ids", "\u6559\u5B66\u547D\u4EE4", (v) => v),
          "ids"
        ).map((x) => asStr(x, "\u8D44\u6E90 ID"))
      };
    case "saveSemester":
      return {
        op,
        semester: parseSemester(
          requiredField(raw, "semester", "\u6559\u5B66\u547D\u4EE4", (v) => v)
        )
      };
    case "saveLesson":
      return {
        op,
        lesson: parseLesson(requiredField(raw, "lesson", "\u6559\u5B66\u547D\u4EE4", (v) => v))
      };
    case "setLessonResources":
      return {
        op,
        id: requiredField(raw, "id", "\u6559\u5B66\u547D\u4EE4", asStr),
        resourceIds: asArray(
          requiredField(raw, "resourceIds", "\u6559\u5B66\u547D\u4EE4", (v) => v),
          "resourceIds"
        ).map((x) => asStr(x, "\u8D44\u6E90 ID"))
      };
    case "attendLesson":
      return {
        op,
        id: requiredField(raw, "id", "\u6559\u5B66\u547D\u4EE4", asStr),
        progress: requiredField(raw, "progress", "\u6559\u5B66\u547D\u4EE4", asStr)
      };
    case "publishAssessment":
      return {
        op,
        assessment: parseAssessment(
          requiredField(raw, "assessment", "\u6559\u5B66\u547D\u4EE4", (v) => v)
        )
      };
    case "confirmPrinted":
    case "startExam":
    case "endExam":
    case "claimEvent":
    case "finishEvent":
    case "retryEvent":
    case "confirmProgress":
      return { op, id: requiredField(raw, "id", "\u6559\u5B66\u547D\u4EE4", asStr) };
    case "submit":
      return {
        op,
        submission: parseSubmission(
          requiredField(raw, "submission", "\u6559\u5B66\u547D\u4EE4", (v) => v)
        )
      };
    case "recordQuestionTimes":
      return {
        op,
        id: requiredField(raw, "id", "\u6559\u5B66\u547D\u4EE4", asStr),
        questionTimes: asArray(
          requiredField(raw, "questionTimes", "\u6559\u5B66\u547D\u4EE4", (v) => v),
          "questionTimes"
        ).map(parseQuestionTime)
      };
    case "grade":
      return {
        op,
        grade: parseGrade(requiredField(raw, "grade", "\u6559\u5B66\u547D\u4EE4", (v) => v))
      };
    case "saveReview":
      return {
        op,
        review: parseReview(requiredField(raw, "review", "\u6559\u5B66\u547D\u4EE4", (v) => v))
      };
    case "recordProgress":
      return {
        op,
        record: parseProgressRecord(
          requiredField(raw, "record", "\u6559\u5B66\u547D\u4EE4", (v) => v)
        )
      };
    case "submitCorrection":
      return {
        op,
        correction: parseCorrection(
          requiredField(raw, "correction", "\u6559\u5B66\u547D\u4EE4", (v) => v)
        )
      };
    case "reviewCorrection":
      return {
        op,
        id: requiredField(raw, "id", "\u6559\u5B66\u547D\u4EE4", asStr),
        accepted: requiredField(raw, "accepted", "\u6559\u5B66\u547D\u4EE4", asBool),
        feedback: requiredField(raw, "feedback", "\u6559\u5B66\u547D\u4EE4", asStr)
      };
    default:
      throw new AppError(`\u6559\u5B66\u547D\u4EE4\u53D6\u503C\u65E0\u6548\uFF1A${op}`);
  }
}
function assistantOnly(command) {
  return [
    "saveSemester",
    "saveLesson",
    "publishAssessment",
    "grade",
    "recordQuestionTimes",
    "saveReview",
    "finishEvent",
    "claimEvent",
    "reviewCorrection"
  ].includes(command.op);
}
function parseProjectStudy(raw) {
  if (!isObject(raw)) throw new AppError("\u6559\u5B66\u9879\u76EE\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "projectId",
      "directory",
      "examMode",
      "visionId",
      "target",
      "examDate",
      "syllabusId",
      "pastPaperIds",
      "mockPaperIds"
    ],
    "\u6559\u5B66\u9879\u76EE"
  );
  return {
    projectId: requiredField(raw, "projectId", "\u6559\u5B66\u9879\u76EE", asStr),
    directory: requiredField(raw, "directory", "\u6559\u5B66\u9879\u76EE", asStr),
    examMode: requiredField(raw, "examMode", "\u6559\u5B66\u9879\u76EE", asBool),
    visionId: field(
      raw,
      "visionId",
      "\u6559\u5B66\u9879\u76EE",
      (v) => asOpt(v, "visionId", asStr),
      null
    ),
    target: requiredField(raw, "target", "\u6559\u5B66\u9879\u76EE", asStr),
    examDate: field(
      raw,
      "examDate",
      "\u6559\u5B66\u9879\u76EE",
      (v) => asOpt(v, "examDate", asStr),
      null
    ),
    syllabusId: field(
      raw,
      "syllabusId",
      "\u6559\u5B66\u9879\u76EE",
      (v) => asOpt(v, "syllabusId", asStr),
      null
    ),
    pastPaperIds: field(
      raw,
      "pastPaperIds",
      "\u6559\u5B66\u9879\u76EE",
      (v) => asArray(v, "pastPaperIds").map((x) => asStr(x, "\u771F\u9898 ID")),
      []
    ),
    mockPaperIds: field(
      raw,
      "mockPaperIds",
      "\u6559\u5B66\u9879\u76EE",
      (v) => asArray(v, "mockPaperIds").map((x) => asStr(x, "\u6A21\u62DF\u9898 ID")),
      []
    )
  };
}
function serializeProjectStudy(p) {
  return {
    projectId: p.projectId,
    directory: p.directory,
    examMode: p.examMode,
    visionId: p.visionId,
    target: p.target,
    examDate: p.examDate,
    syllabusId: p.syllabusId,
    pastPaperIds: p.pastPaperIds,
    mockPaperIds: p.mockPaperIds
  };
}
function parseResource(raw) {
  if (!isObject(raw)) throw new AppError("\u8D44\u6E90\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    ["id", "projectId", "title", "kind", "path", "source", "edition", "topics"],
    "\u8D44\u6E90"
  );
  return {
    id: requiredField(raw, "id", "\u8D44\u6E90", asStr),
    projectId: requiredField(raw, "projectId", "\u8D44\u6E90", asStr),
    title: requiredField(raw, "title", "\u8D44\u6E90", asStr),
    kind: oneOf(
      requiredField(raw, "kind", "\u8D44\u6E90", (v) => v),
      "\u8D44\u6E90 kind",
      [
        "syllabus",
        "course",
        "book",
        "pastPaper",
        "mockPaper",
        "reference",
        "attachment",
        "answerSheet"
      ]
    ),
    path: requiredField(raw, "path", "\u8D44\u6E90", asStr),
    source: requiredField(raw, "source", "\u8D44\u6E90", asStr),
    edition: requiredField(raw, "edition", "\u8D44\u6E90", asStr),
    topics: field(
      raw,
      "topics",
      "\u8D44\u6E90",
      (v) => asArray(v, "topics").map((x) => asStr(x, "\u77E5\u8BC6\u70B9")),
      []
    )
  };
}
function serializeResource(r) {
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    kind: r.kind,
    path: r.path,
    source: r.source,
    edition: r.edition,
    topics: r.topics
  };
}
function parseMilestone(raw) {
  if (!isObject(raw)) throw new AppError("\u9636\u6BB5\u8FDB\u5EA6\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    ["week", "topics", "resourceIds", "objective", "lessonCount"],
    "\u9636\u6BB5\u8FDB\u5EA6"
  );
  return {
    week: requiredField(raw, "week", "\u9636\u6BB5\u8FDB\u5EA6", asInt),
    topics: field(
      raw,
      "topics",
      "\u9636\u6BB5\u8FDB\u5EA6",
      (v) => asArray(v, "topics").map((x) => asStr(x, "\u77E5\u8BC6\u70B9")),
      []
    ),
    resourceIds: field(
      raw,
      "resourceIds",
      "\u9636\u6BB5\u8FDB\u5EA6",
      (v) => asArray(v, "resourceIds").map((x) => asStr(x, "\u8D44\u6E90 ID")),
      []
    ),
    objective: requiredField(raw, "objective", "\u9636\u6BB5\u8FDB\u5EA6", asStr),
    lessonCount: requiredField(raw, "lessonCount", "\u9636\u6BB5\u8FDB\u5EA6", asInt)
  };
}
function serializeMilestone(m) {
  return {
    week: m.week,
    topics: m.topics,
    resourceIds: m.resourceIds,
    objective: m.objective,
    lessonCount: m.lessonCount
  };
}
function parseSemester(raw) {
  if (!isObject(raw)) throw new AppError("\u5B66\u671F\u8BA1\u5212\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "projectId",
      "title",
      "startDate",
      "endDate",
      "revision",
      "baseline",
      "evidence",
      "rationale",
      "milestones"
    ],
    "\u5B66\u671F\u8BA1\u5212"
  );
  return {
    id: requiredField(raw, "id", "\u5B66\u671F\u8BA1\u5212", asStr),
    projectId: requiredField(raw, "projectId", "\u5B66\u671F\u8BA1\u5212", asStr),
    title: requiredField(raw, "title", "\u5B66\u671F\u8BA1\u5212", asStr),
    startDate: requiredField(raw, "startDate", "\u5B66\u671F\u8BA1\u5212", asStr),
    endDate: requiredField(raw, "endDate", "\u5B66\u671F\u8BA1\u5212", asStr),
    revision: requiredField(raw, "revision", "\u5B66\u671F\u8BA1\u5212", asInt),
    baseline: requiredField(raw, "baseline", "\u5B66\u671F\u8BA1\u5212", asStr),
    evidence: field(
      raw,
      "evidence",
      "\u5B66\u671F\u8BA1\u5212",
      (v) => asArray(v, "evidence").map((x) => asStr(x, "\u4F9D\u636E")),
      []
    ),
    rationale: requiredField(raw, "rationale", "\u5B66\u671F\u8BA1\u5212", asStr),
    milestones: requiredField(
      raw,
      "milestones",
      "\u5B66\u671F\u8BA1\u5212",
      (v) => asArray(v, "milestones").map(parseMilestone)
    )
  };
}
function serializeSemester(s) {
  return {
    id: s.id,
    projectId: s.projectId,
    title: s.title,
    startDate: s.startDate,
    endDate: s.endDate,
    revision: s.revision,
    baseline: s.baseline,
    evidence: s.evidence,
    rationale: s.rationale,
    milestones: s.milestones.map(serializeMilestone)
  };
}
function parseLesson(raw) {
  if (!isObject(raw)) throw new AppError("\u8BFE\u7A0B\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "projectId",
      "semesterId",
      "semesterRevision",
      "title",
      "topics",
      "resourceIds",
      "startsAt",
      "endsAt",
      "aiEnabled",
      "attended",
      "progress",
      "state"
    ],
    "\u8BFE\u7A0B"
  );
  return {
    id: requiredField(raw, "id", "\u8BFE\u7A0B", asStr),
    projectId: requiredField(raw, "projectId", "\u8BFE\u7A0B", asStr),
    semesterId: requiredField(raw, "semesterId", "\u8BFE\u7A0B", asStr),
    semesterRevision: field(raw, "semesterRevision", "\u8BFE\u7A0B", asInt, 1),
    title: requiredField(raw, "title", "\u8BFE\u7A0B", asStr),
    topics: field(
      raw,
      "topics",
      "\u8BFE\u7A0B",
      (v) => asArray(v, "topics").map((x) => asStr(x, "\u77E5\u8BC6\u70B9")),
      []
    ),
    resourceIds: field(
      raw,
      "resourceIds",
      "\u8BFE\u7A0B",
      (v) => asArray(v, "resourceIds").map((x) => asStr(x, "\u8D44\u6E90 ID")),
      []
    ),
    startsAt: requiredField(raw, "startsAt", "\u8BFE\u7A0B", asInt),
    endsAt: requiredField(raw, "endsAt", "\u8BFE\u7A0B", asInt),
    aiEnabled: requiredField(raw, "aiEnabled", "\u8BFE\u7A0B", asBool),
    attended: requiredField(raw, "attended", "\u8BFE\u7A0B", asBool),
    progress: requiredField(raw, "progress", "\u8BFE\u7A0B", asStr),
    state: oneOf(
      requiredField(raw, "state", "\u8BFE\u7A0B", (v) => v),
      "\u8BFE\u7A0B state",
      ["planned", "active", "ended", "missed"]
    )
  };
}
function serializeLesson(l) {
  return {
    id: l.id,
    projectId: l.projectId,
    semesterId: l.semesterId,
    semesterRevision: l.semesterRevision,
    title: l.title,
    topics: l.topics,
    resourceIds: l.resourceIds,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    aiEnabled: l.aiEnabled,
    attended: l.attended,
    progress: l.progress,
    state: l.state
  };
}
function parseScoringPoint(raw) {
  if (!isObject(raw)) throw new AppError("\u8BC4\u5206\u70B9\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, ["id", "description", "points"], "\u8BC4\u5206\u70B9");
  return {
    id: requiredField(raw, "id", "\u8BC4\u5206\u70B9", asStr),
    description: requiredField(raw, "description", "\u8BC4\u5206\u70B9", asStr),
    points: requiredField(raw, "points", "\u8BC4\u5206\u70B9", asInt)
  };
}
function serializeScoringPoint(p) {
  return { id: p.id, description: p.description, points: p.points };
}
function parseQuestion(raw) {
  if (!isObject(raw)) throw new AppError("\u9898\u76EE\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "prompt",
      "topics",
      "sourceIds",
      "extension",
      "estimatedMinutes",
      "answer",
      "acceptableAlternatives",
      "scoring"
    ],
    "\u9898\u76EE"
  );
  return {
    id: requiredField(raw, "id", "\u9898\u76EE", asStr),
    prompt: requiredField(raw, "prompt", "\u9898\u76EE", asStr),
    topics: field(
      raw,
      "topics",
      "\u9898\u76EE",
      (v) => asArray(v, "topics").map((x) => asStr(x, "\u77E5\u8BC6\u70B9")),
      []
    ),
    sourceIds: field(
      raw,
      "sourceIds",
      "\u9898\u76EE",
      (v) => asArray(v, "sourceIds").map((x) => asStr(x, "\u6765\u6E90 ID")),
      []
    ),
    extension: requiredField(raw, "extension", "\u9898\u76EE", asBool),
    estimatedMinutes: requiredField(raw, "estimatedMinutes", "\u9898\u76EE", asInt),
    answer: requiredField(raw, "answer", "\u9898\u76EE", asStr),
    acceptableAlternatives: requiredField(
      raw,
      "acceptableAlternatives",
      "\u9898\u76EE",
      asStr
    ),
    scoring: requiredField(
      raw,
      "scoring",
      "\u9898\u76EE",
      (v) => asArray(v, "scoring").map(parseScoringPoint)
    )
  };
}
function serializeQuestion(q) {
  return {
    id: q.id,
    prompt: q.prompt,
    topics: q.topics,
    sourceIds: q.sourceIds,
    extension: q.extension,
    estimatedMinutes: q.estimatedMinutes,
    answer: q.answer,
    acceptableAlternatives: q.acceptableAlternatives,
    scoring: q.scoring.map(serializeScoringPoint)
  };
}
function parseAssessment(raw) {
  if (!isObject(raw)) throw new AppError("\u8BD5\u9898\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "projectId",
      "semesterId",
      "semesterRevision",
      "lessonId",
      "taskId",
      "retestOfGradeId",
      "title",
      "kind",
      "revision",
      "startsAt",
      "endsAt",
      "instructions",
      "reviewEvidence",
      "questions",
      "publishedAt",
      "printedAt",
      "startedAt",
      "stoppedAt"
    ],
    "\u8BD5\u9898"
  );
  return {
    id: requiredField(raw, "id", "\u8BD5\u9898", asStr),
    projectId: requiredField(raw, "projectId", "\u8BD5\u9898", asStr),
    semesterId: requiredField(raw, "semesterId", "\u8BD5\u9898", asStr),
    semesterRevision: field(raw, "semesterRevision", "\u8BD5\u9898", asInt, 1),
    lessonId: field(
      raw,
      "lessonId",
      "\u8BD5\u9898",
      (v) => asOpt(v, "lessonId", asStr),
      null
    ),
    taskId: field(
      raw,
      "taskId",
      "\u8BD5\u9898",
      (v) => asOpt(v, "taskId", asStr),
      null
    ),
    retestOfGradeId: field(
      raw,
      "retestOfGradeId",
      "\u8BD5\u9898",
      (v) => asOpt(v, "retestOfGradeId", asStr),
      null
    ),
    title: requiredField(raw, "title", "\u8BD5\u9898", asStr),
    kind: oneOf(
      requiredField(raw, "kind", "\u8BD5\u9898", (v) => v),
      "\u8BD5\u9898 kind",
      ["homework", "weeklyExam", "mockExam", "retest"]
    ),
    revision: requiredField(raw, "revision", "\u8BD5\u9898", asInt),
    startsAt: requiredField(raw, "startsAt", "\u8BD5\u9898", asInt),
    endsAt: requiredField(raw, "endsAt", "\u8BD5\u9898", asInt),
    instructions: requiredField(raw, "instructions", "\u8BD5\u9898", asStr),
    reviewEvidence: requiredField(raw, "reviewEvidence", "\u8BD5\u9898", asStr),
    questions: requiredField(
      raw,
      "questions",
      "\u8BD5\u9898",
      (v) => asArray(v, "questions").map(parseQuestion)
    ),
    publishedAt: requiredField(raw, "publishedAt", "\u8BD5\u9898", asInt),
    printedAt: field(
      raw,
      "printedAt",
      "\u8BD5\u9898",
      (v) => asOpt(v, "printedAt", asInt),
      null
    ),
    startedAt: field(
      raw,
      "startedAt",
      "\u8BD5\u9898",
      (v) => asOpt(v, "startedAt", asInt),
      null
    ),
    stoppedAt: field(
      raw,
      "stoppedAt",
      "\u8BD5\u9898",
      (v) => asOpt(v, "stoppedAt", asInt),
      null
    )
  };
}
function serializeAssessment(a) {
  return {
    id: a.id,
    projectId: a.projectId,
    semesterId: a.semesterId,
    semesterRevision: a.semesterRevision,
    lessonId: a.lessonId,
    taskId: a.taskId,
    retestOfGradeId: a.retestOfGradeId,
    title: a.title,
    kind: a.kind,
    revision: a.revision,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    instructions: a.instructions,
    reviewEvidence: a.reviewEvidence,
    questions: a.questions.map(serializeQuestion),
    publishedAt: a.publishedAt,
    printedAt: a.printedAt,
    startedAt: a.startedAt,
    stoppedAt: a.stoppedAt
  };
}
function examDeadline2(a) {
  return a.startedAt === null ? a.endsAt : a.startedAt + (a.endsAt - a.startsAt);
}
function parseSubmission(raw) {
  if (!isObject(raw)) throw new AppError("\u63D0\u4EA4\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "assessmentId",
      "submittedAt",
      "resourceIds",
      "answers",
      "unfinished",
      "questionTimes"
    ],
    "\u63D0\u4EA4"
  );
  return {
    id: requiredField(raw, "id", "\u63D0\u4EA4", asStr),
    assessmentId: requiredField(raw, "assessmentId", "\u63D0\u4EA4", asStr),
    submittedAt: requiredField(raw, "submittedAt", "\u63D0\u4EA4", asInt),
    resourceIds: field(
      raw,
      "resourceIds",
      "\u63D0\u4EA4",
      (v) => asArray(v, "resourceIds").map((x) => asStr(x, "\u9644\u4EF6 ID")),
      []
    ),
    answers: requiredField(raw, "answers", "\u63D0\u4EA4", asStr),
    unfinished: requiredField(raw, "unfinished", "\u63D0\u4EA4", asBool),
    questionTimes: field(
      raw,
      "questionTimes",
      "\u63D0\u4EA4",
      (v) => asArray(v, "questionTimes").map(parseQuestionTime),
      []
    )
  };
}
function serializeSubmission(s) {
  return {
    id: s.id,
    assessmentId: s.assessmentId,
    submittedAt: s.submittedAt,
    resourceIds: s.resourceIds,
    answers: s.answers,
    unfinished: s.unfinished,
    questionTimes: s.questionTimes.map(serializeQuestionTime)
  };
}
function parseQuestionTime(raw) {
  if (!isObject(raw)) throw new AppError("\u5B8C\u6210\u65F6\u523B\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, ["questionId", "localTime"], "\u5B8C\u6210\u65F6\u523B");
  return {
    questionId: requiredField(raw, "questionId", "\u5B8C\u6210\u65F6\u523B", asStr),
    localTime: requiredField(raw, "localTime", "\u5B8C\u6210\u65F6\u523B", asStr)
  };
}
function serializeQuestionTime(t) {
  return { questionId: t.questionId, localTime: t.localTime };
}
function parsePointAward(raw) {
  if (!isObject(raw)) throw new AppError("\u8BC4\u5206\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, ["questionId", "pointId", "awarded", "evidence"], "\u8BC4\u5206");
  return {
    questionId: requiredField(raw, "questionId", "\u8BC4\u5206", asStr),
    pointId: requiredField(raw, "pointId", "\u8BC4\u5206", asStr),
    awarded: requiredField(raw, "awarded", "\u8BC4\u5206", asInt),
    evidence: requiredField(raw, "evidence", "\u8BC4\u5206", asStr)
  };
}
function serializePointAward(p) {
  return {
    questionId: p.questionId,
    pointId: p.pointId,
    awarded: p.awarded,
    evidence: p.evidence
  };
}
function parseErrorAnalysis(raw) {
  if (!isObject(raw)) throw new AppError("\u9519\u56E0\u5206\u6790\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "questionId",
      "cause",
      "evidence",
      "correction",
      "nextCheck",
      "retestDate",
      "confirmed"
    ],
    "\u9519\u56E0\u5206\u6790"
  );
  return {
    questionId: requiredField(raw, "questionId", "\u9519\u56E0\u5206\u6790", asStr),
    cause: requiredField(raw, "cause", "\u9519\u56E0\u5206\u6790", asStr),
    evidence: requiredField(raw, "evidence", "\u9519\u56E0\u5206\u6790", asStr),
    correction: requiredField(raw, "correction", "\u9519\u56E0\u5206\u6790", asStr),
    nextCheck: requiredField(raw, "nextCheck", "\u9519\u56E0\u5206\u6790", asStr),
    retestDate: requiredField(raw, "retestDate", "\u9519\u56E0\u5206\u6790", asStr),
    confirmed: requiredField(raw, "confirmed", "\u9519\u56E0\u5206\u6790", asBool)
  };
}
function serializeErrorAnalysis(e) {
  return {
    questionId: e.questionId,
    cause: e.cause,
    evidence: e.evidence,
    correction: e.correction,
    nextCheck: e.nextCheck,
    retestDate: e.retestDate,
    confirmed: e.confirmed
  };
}
function parseGrade(raw) {
  if (!isObject(raw)) throw new AppError("\u6279\u6539\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "submissionId",
      "assessmentRevision",
      "gradedAt",
      "awards",
      "errors",
      "needsReview",
      "feedback"
    ],
    "\u6279\u6539"
  );
  return {
    id: requiredField(raw, "id", "\u6279\u6539", asStr),
    submissionId: requiredField(raw, "submissionId", "\u6279\u6539", asStr),
    assessmentRevision: requiredField(raw, "assessmentRevision", "\u6279\u6539", asInt),
    gradedAt: requiredField(raw, "gradedAt", "\u6279\u6539", asInt),
    awards: requiredField(
      raw,
      "awards",
      "\u6279\u6539",
      (v) => asArray(v, "awards").map(parsePointAward)
    ),
    errors: requiredField(
      raw,
      "errors",
      "\u6279\u6539",
      (v) => asArray(v, "errors").map(parseErrorAnalysis)
    ),
    needsReview: requiredField(raw, "needsReview", "\u6279\u6539", asBool),
    feedback: requiredField(raw, "feedback", "\u6279\u6539", asStr)
  };
}
function serializeGrade(g) {
  return {
    id: g.id,
    submissionId: g.submissionId,
    assessmentRevision: g.assessmentRevision,
    gradedAt: g.gradedAt,
    awards: g.awards.map(serializePointAward),
    errors: g.errors.map(serializeErrorAnalysis),
    needsReview: g.needsReview,
    feedback: g.feedback
  };
}
function parseReview(raw) {
  if (!isObject(raw)) throw new AppError("\u590D\u76D8\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    ["id", "date", "projectId", "gradeIds", "findings", "actions"],
    "\u590D\u76D8"
  );
  return {
    id: requiredField(raw, "id", "\u590D\u76D8", asStr),
    date: requiredField(raw, "date", "\u590D\u76D8", asStr),
    projectId: requiredField(raw, "projectId", "\u590D\u76D8", asStr),
    gradeIds: field(
      raw,
      "gradeIds",
      "\u590D\u76D8",
      (v) => asArray(v, "gradeIds").map((x) => asStr(x, "\u6279\u6539 ID")),
      []
    ),
    findings: requiredField(raw, "findings", "\u590D\u76D8", asStr),
    actions: field(
      raw,
      "actions",
      "\u590D\u76D8",
      (v) => asArray(v, "actions").map((x) => asStr(x, "\u884C\u52A8")),
      []
    )
  };
}
function serializeReview(r) {
  return {
    id: r.id,
    date: r.date,
    projectId: r.projectId,
    gradeIds: r.gradeIds,
    findings: r.findings,
    actions: r.actions
  };
}
function parseTeachingEvent(raw) {
  if (!isObject(raw)) throw new AppError("\u6559\u5B66\u4E8B\u4EF6\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    ["id", "projectId", "kind", "sourceId", "state", "createdAt"],
    "\u6559\u5B66\u4E8B\u4EF6"
  );
  return {
    id: requiredField(raw, "id", "\u6559\u5B66\u4E8B\u4EF6", asStr),
    projectId: requiredField(raw, "projectId", "\u6559\u5B66\u4E8B\u4EF6", asStr),
    kind: requiredField(raw, "kind", "\u6559\u5B66\u4E8B\u4EF6", asStr),
    sourceId: requiredField(raw, "sourceId", "\u6559\u5B66\u4E8B\u4EF6", asStr),
    state: requiredField(raw, "state", "\u6559\u5B66\u4E8B\u4EF6", asStr),
    createdAt: requiredField(raw, "createdAt", "\u6559\u5B66\u4E8B\u4EF6", asInt)
  };
}
function serializeTeachingEvent(e) {
  return {
    id: e.id,
    projectId: e.projectId,
    kind: e.kind,
    sourceId: e.sourceId,
    state: e.state,
    createdAt: e.createdAt
  };
}
function parseProgressRecord(raw) {
  if (!isObject(raw)) throw new AppError("\u8FDB\u5EA6\u8BB0\u5F55\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "projectId",
      "topic",
      "position",
      "state",
      "evidence",
      "nextAction",
      "source",
      "confirmed",
      "recordedAt"
    ],
    "\u8FDB\u5EA6\u8BB0\u5F55"
  );
  return {
    id: requiredField(raw, "id", "\u8FDB\u5EA6\u8BB0\u5F55", asStr),
    projectId: requiredField(raw, "projectId", "\u8FDB\u5EA6\u8BB0\u5F55", asStr),
    topic: requiredField(raw, "topic", "\u8FDB\u5EA6\u8BB0\u5F55", asStr),
    position: requiredField(raw, "position", "\u8FDB\u5EA6\u8BB0\u5F55", asStr),
    state: oneOf(
      requiredField(raw, "state", "\u8FDB\u5EA6\u8BB0\u5F55", (v) => v),
      "\u8FDB\u5EA6 state",
      ["studied", "practicing", "needsReview"]
    ),
    evidence: requiredField(raw, "evidence", "\u8FDB\u5EA6\u8BB0\u5F55", asStr),
    nextAction: requiredField(raw, "nextAction", "\u8FDB\u5EA6\u8BB0\u5F55", asStr),
    source: oneOf(
      requiredField(raw, "source", "\u8FDB\u5EA6\u8BB0\u5F55", (v) => v),
      "\u8FDB\u5EA6 source",
      ["user", "assistant"]
    ),
    confirmed: requiredField(raw, "confirmed", "\u8FDB\u5EA6\u8BB0\u5F55", asBool),
    recordedAt: requiredField(raw, "recordedAt", "\u8FDB\u5EA6\u8BB0\u5F55", asInt)
  };
}
function serializeProgressRecord(r) {
  return {
    id: r.id,
    projectId: r.projectId,
    topic: r.topic,
    position: r.position,
    state: r.state,
    evidence: r.evidence,
    nextAction: r.nextAction,
    source: r.source,
    confirmed: r.confirmed,
    recordedAt: r.recordedAt
  };
}
function parseCorrection(raw) {
  if (!isObject(raw)) throw new AppError("\u8BA2\u6B63\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "id",
      "gradeId",
      "questionId",
      "explanation",
      "resourceIds",
      "submittedAt",
      "accepted",
      "feedback",
      "reviewedAt"
    ],
    "\u8BA2\u6B63"
  );
  return {
    id: requiredField(raw, "id", "\u8BA2\u6B63", asStr),
    gradeId: requiredField(raw, "gradeId", "\u8BA2\u6B63", asStr),
    questionId: requiredField(raw, "questionId", "\u8BA2\u6B63", asStr),
    explanation: requiredField(raw, "explanation", "\u8BA2\u6B63", asStr),
    resourceIds: field(
      raw,
      "resourceIds",
      "\u8BA2\u6B63",
      (v) => asArray(v, "resourceIds").map((x) => asStr(x, "\u9644\u4EF6 ID")),
      []
    ),
    submittedAt: requiredField(raw, "submittedAt", "\u8BA2\u6B63", asInt),
    accepted: field(
      raw,
      "accepted",
      "\u8BA2\u6B63",
      (v) => asOpt(v, "accepted", asBool),
      null
    ),
    feedback: field(raw, "feedback", "\u8BA2\u6B63", asStr, ""),
    reviewedAt: field(
      raw,
      "reviewedAt",
      "\u8BA2\u6B63",
      (v) => asOpt(v, "reviewedAt", asInt),
      null
    )
  };
}
function serializeCorrection(c) {
  return {
    id: c.id,
    gradeId: c.gradeId,
    questionId: c.questionId,
    explanation: c.explanation,
    resourceIds: c.resourceIds,
    submittedAt: c.submittedAt,
    accepted: c.accepted,
    feedback: c.feedback,
    reviewedAt: c.reviewedAt
  };
}
function checkText(s, max) {
  return s.trim().length > 0 && Array.from(s).length <= max;
}
function validEducationDate(s) {
  return s.length === 10 && validDate(s);
}
function isRelativePath(path) {
  if (path.length === 0 || path.includes("\\") || isAbsolutePath(path))
    return false;
  const stripped = path.replace(/\/+$/, "");
  if (stripped.length === 0) return path.length > 0 && false;
  return stripped.split("/").every((seg) => seg !== "." && seg !== ".." && seg !== "");
}
function isAbsolutePath(path) {
  return /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(path);
}
var Education = class {
  focusTasks = [];
  projects = [];
  resources = [];
  semesters = [];
  semesterHistory = [];
  lessons = [];
  assessments = [];
  submissions = [];
  grades = [];
  reviews = [];
  events = [];
  completedTasks = [];
  progress = [];
  corrections = [];
  /** 每次扫描或变更时重建：含停用配置与归档计划。 */
  resourceReferenceIndex() {
    const refs = /* @__PURE__ */ new Map();
    const add = (ids, label) => {
      for (const id2 of new Set(ids)) {
        const list = refs.get(id2) ?? [];
        list.push(label);
        refs.set(id2, list);
      }
    };
    for (const p of this.projects) {
      add(
        [p.syllabusId, ...p.pastPaperIds, ...p.mockPaperIds].filter(
          (x) => x !== null
        ),
        "\u9879\u76EE\u6559\u5B66\u914D\u7F6E"
      );
    }
    for (const s of [...this.semesters, ...this.semesterHistory]) {
      for (const m of s.milestones) {
        add(m.resourceIds, `${s.title} v${s.revision} \u7B2C${m.week}\u5468`);
      }
    }
    for (const l of this.lessons) {
      add(l.resourceIds, `\u8BFE\u7A0B\uFF1A${l.title}`);
    }
    for (const a of this.assessments) {
      for (const q of a.questions) {
        add(q.sourceIds, `${a.title} / ${q.id}`);
      }
    }
    for (const s of this.submissions) {
      add(s.resourceIds, `\u7B54\u5377\uFF1A${s.id}`);
    }
    for (const c of this.corrections) {
      add(c.resourceIds, `\u8BA2\u6B63\uFF1A${c.id}`);
    }
    return refs;
  }
  resourceReferences(id2) {
    return this.resourceReferenceIndex().get(id2) ?? [];
  }
  event(project, kind, source, at) {
    const eventId = `${kind}:${source}`;
    if (!this.events.some((e) => e.id === eventId)) {
      this.events.push({
        id: eventId,
        projectId: project,
        kind,
        sourceId: source,
        state: "pending",
        createdAt: at
      });
    }
  }
  taskCompleted(task, at) {
    const record = completedStudyTaskFromTask(task, at);
    if (record === null) return;
    if (this.projects.some(
      (p) => p.projectId === record.projectId && p.examMode
    ) && !this.completedTasks.some((t) => t.id === record.id)) {
      const link = this.focusTasks.find((l) => l.taskId === record.id);
      if (link !== void 0) {
        const lesson = this.lessons.find((l) => l.id === link.sourceId);
        if (lesson !== void 0) {
          record.topics = [...lesson.topics];
          record.notes = lesson.progress;
        }
      } else {
        this.event(record.projectId, "taskHomework", record.id, at);
      }
      this.completedTasks.push(record);
    }
  }
  /** 课程/考试到点推进、持久化教学事件。 */
  tick(at) {
    let changed = false;
    const events = [];
    for (const lesson of this.lessons) {
      if ((lesson.state === "planned" || lesson.state === "active") && at >= lesson.endsAt) {
        lesson.state = lesson.attended ? "ended" : "missed";
        if (lesson.aiEnabled && lesson.attended) {
          events.push({
            project: lesson.projectId,
            kind: "homework",
            source: lesson.id
          });
        }
        changed = true;
      } else if (lesson.state === "planned" && at >= lesson.startsAt) {
        lesson.state = "active";
        changed = true;
      }
    }
    for (const a of this.assessments) {
      if ((a.kind === "homework" || a.startedAt !== null) && a.stoppedAt === null && at >= examDeadline2(a)) {
        a.stoppedAt = examDeadline2(a);
        changed = true;
      }
    }
    for (const { project, kind, source } of events) {
      this.event(project, kind, source, at);
    }
    const grades = /* @__PURE__ */ new Set();
    for (const g of this.grades) {
      const nowMinutes = minutesOf(hourMinuteNow(at)) ?? -1;
      if (dateAt(g.gradedAt) < dateAt(at) && nowMinutes >= 510) {
        const sub = this.submissions.find((s) => s.id === g.submissionId);
        if (sub === void 0) continue;
        const a = this.assessments.find((x) => x.id === sub.assessmentId);
        if (a === void 0) continue;
        grades.add(`${a.projectId}|${dateAt(g.gradedAt)}`);
      }
    }
    for (const pair of grades) {
      const [p, d] = pair.split("|");
      const n = this.events.length;
      this.event(p, "review", `${p}:${d}`, at);
      if (this.events.length !== n) changed = true;
    }
    const today = localDateOf(at);
    if (weekdayMonday(today) >= 5) {
      const terms = [];
      for (const s of this.semesters) {
        if (s.startDate <= dateAt(at) && s.endDate >= dateAt(at) && this.projects.some((p) => p.projectId === s.projectId && p.examMode)) {
          const start = parseDate(s.startDate);
          const week = Math.floor(daysBetween(start, today) / 7) + 1;
          terms.push({ project: s.projectId, source: `${s.id}:week${week}` });
        }
      }
      for (const { project, source } of terms) {
        const n = this.events.length;
        this.event(project, "weeklyExam", source, at);
        if (this.events.length !== n) changed = true;
      }
    }
    return changed;
  }
  /** 教学命令执行：校验 → 变更，全部成功后由上层统一 validate。 */
  apply(command, at) {
    switch (command.op) {
      case "recordProgress": {
        ensure(
          !this.progress.some((r) => r.id === command.record.id),
          "\u8FDB\u5EA6\u8BB0\u5F55\u4E0D\u53EF\u8986\u76D6\uFF0C\u8BF7\u65B0\u589E\u4E00\u6761\u66F4\u6B63\u8BB0\u5F55"
        );
        command.record.recordedAt = at;
        command.record.confirmed = command.record.source === "user";
        this.progress.push(command.record);
        break;
      }
      case "confirmProgress": {
        const record = this.progress.find((r) => r.id === command.id);
        ensure(record !== void 0, "\u8FDB\u5EA6\u8BB0\u5F55\u4E0D\u5B58\u5728");
        record.confirmed = true;
        break;
      }
      case "submitCorrection": {
        ensure(
          !this.corrections.some((c) => c.id === command.correction.id),
          "\u8BA2\u6B63\u7248\u672C\u4E0D\u53EF\u8986\u76D6"
        );
        command.correction.submittedAt = at;
        command.correction.accepted = null;
        command.correction.feedback = "";
        command.correction.reviewedAt = null;
        const project = (() => {
          const grade = this.grades.find(
            (g) => g.id === command.correction.gradeId
          );
          if (grade === void 0) return null;
          const sub = this.submissions.find((s) => s.id === grade.submissionId);
          if (sub === void 0) return null;
          const a = this.assessments.find((x) => x.id === sub.assessmentId);
          return a?.projectId ?? null;
        })();
        ensure(project !== null, "\u8BA2\u6B63\u7F3A\u5C11\u539F\u59CB\u6279\u6539");
        this.event(project, "correction", command.correction.id, at);
        this.corrections.push(command.correction);
        break;
      }
      case "reviewCorrection": {
        const correction = this.corrections.find(
          (c) => c.id === command.id && c.reviewedAt === null
        );
        ensure(correction !== void 0, "\u8BA2\u6B63\u5DF2\u68C0\u67E5\u6216\u4E0D\u5B58\u5728");
        ensure(checkText(command.feedback, 5e4), "\u8BA2\u6B63\u68C0\u67E5\u9700\u8981\u53CD\u9988");
        correction.accepted = command.accepted;
        correction.feedback = command.feedback;
        correction.reviewedAt = at;
        break;
      }
      case "saveProject": {
        upsertBy(this.projects, command.project, (x) => x.projectId);
        break;
      }
      case "saveResource": {
        upsertBy(this.resources, command.resource, (x) => x.id);
        break;
      }
      case "saveResources": {
        for (const resource of command.resources) {
          upsertBy(this.resources, resource, (x) => x.id);
        }
        break;
      }
      case "removeResources": {
        ensure(command.ids.length > 0, "\u8BF7\u9009\u62E9\u8981\u6E05\u7406\u7684\u8D44\u6E90\u767B\u8BB0");
        const referenced = this.resourceReferenceIndex();
        const known = new Set(this.resources.map((r) => r.id));
        for (const id2 of command.ids) {
          ensure(known.has(id2), "\u8D44\u6E90\u767B\u8BB0\u4E0D\u5B58\u5728");
          ensure(
            !referenced.has(id2),
            "\u8D44\u6E90\u4ECD\u88AB\u6559\u5B66\u914D\u7F6E\u6216\u5386\u53F2\u8BB0\u5F55\u5F15\u7528\uFF0C\u8BF7\u4FEE\u590D\u8DEF\u5F84\u5E76\u4FDD\u7559\u767B\u8BB0"
          );
        }
        const ids = new Set(command.ids);
        this.resources = this.resources.filter((r) => !ids.has(r.id));
        break;
      }
      case "saveSemester": {
        const old = this.semesters.find((s) => s.id === command.semester.id);
        if (old !== void 0) {
          ensure(
            command.semester.revision === old.revision + 1,
            "\u5B66\u671F\u8BA1\u5212\u66F4\u65B0\u5FC5\u987B\u9012\u589E\u7248\u672C"
          );
          this.semesterHistory.push({
            ...old,
            milestones: old.milestones.map((m) => ({
              ...m,
              topics: [...m.topics],
              resourceIds: [...m.resourceIds]
            }))
          });
        }
        upsertBy(this.semesters, command.semester, (x) => x.id);
        break;
      }
      case "saveLesson": {
        const semester = this.semesters.find(
          (s) => s.id === command.lesson.semesterId
        );
        ensure(semester !== void 0, "\u5B66\u671F\u8BA1\u5212\u4E0D\u5B58\u5728");
        command.lesson.semesterRevision = semester.revision;
        ensure(command.lesson.startsAt > at, "\u8BFE\u7A0B\u5FC5\u987B\u5B89\u6392\u5728\u672A\u6765");
        ensure(
          !this.lessons.some(
            (l) => l.id === command.lesson.id && (l.state !== "planned" || l.attended)
          ),
          "\u5DF2\u5F00\u59CB\u8BFE\u7A0B\u4FDD\u7559\u5386\u53F2\uFF0C\u4E0D\u80FD\u6539\u5199"
        );
        command.lesson.state = "planned";
        command.lesson.attended = false;
        upsertBy(this.lessons, command.lesson, (x) => x.id);
        break;
      }
      case "setLessonResources": {
        const lesson = this.lessons.find((l) => l.id === command.id);
        ensure(lesson !== void 0, "\u8BFE\u7A0B\u4E0D\u5B58\u5728");
        ensure(
          lesson.state === "planned" && !lesson.attended && lesson.startsAt > at,
          "\u8BFE\u7A0B\u5DF2\u5F00\u59CB\uFF0C\u4E0D\u80FD\u4FEE\u6539\u6307\u5B9A\u8D44\u6599"
        );
        ensure(
          command.resourceIds.every(
            (id2) => this.resources.some(
              (r) => r.id === id2 && r.projectId === lesson.projectId
            )
          ),
          "\u53EA\u80FD\u6307\u5B9A\u672C\u9879\u76EE\u767B\u8BB0\u7684\u8D44\u6599"
        );
        ensure(
          new Set(command.resourceIds).size === command.resourceIds.length,
          "\u8BFE\u7A0B\u8D44\u6599\u4E0D\u80FD\u91CD\u590D\u6307\u5B9A"
        );
        lesson.resourceIds = [...command.resourceIds];
        break;
      }
      case "attendLesson": {
        const lesson = this.lessons.find((l) => l.id === command.id);
        ensure(lesson !== void 0, "\u8BFE\u7A0B\u4E0D\u5B58\u5728");
        ensure(
          at >= lesson.startsAt && at < lesson.endsAt,
          "\u53EA\u80FD\u5728\u4E0A\u8BFE\u65F6\u786E\u8BA4\u53C2\u4E0E"
        );
        lesson.attended = true;
        lesson.progress = command.progress;
        break;
      }
      case "publishAssessment": {
        ensure(
          this.projects.some(
            (p) => p.projectId === command.assessment.projectId && p.examMode
          ),
          "\u53D1\u5E03\u4F5C\u4E1A\u548C\u8BD5\u5377\u524D\u8BF7\u542F\u7528\u5E94\u8BD5\u6A21\u5F0F"
        );
        ensure(
          !this.assessments.some((a) => a.id === command.assessment.id),
          "\u5DF2\u53D1\u5E03\u9898\u76EE\u548C\u8BC4\u5206\u6807\u51C6\u4E0D\u53EF\u4FEE\u6539\uFF1B\u8BF7\u53D1\u5E03\u65B0 ID \u7684\u4FEE\u8BA2\u7248"
        );
        ensure(
          command.assessment.kind === "homework" ? command.assessment.endsAt > at : dateAt(command.assessment.startsAt) >= dateAt(at),
          "\u4E0D\u80FD\u53D1\u5E03\u5DF2\u622A\u6B62\u7684\u4F5C\u4E1A\u6216\u5DF2\u8FC7\u8003\u8BD5\u65E5\u671F\u7684\u8BD5\u5377"
        );
        const semester = this.semesters.find(
          (s) => s.id === command.assessment.semesterId
        );
        ensure(semester !== void 0, "\u5B66\u671F\u8BA1\u5212\u4E0D\u5B58\u5728");
        command.assessment.semesterRevision = semester.revision;
        command.assessment.publishedAt = at;
        command.assessment.printedAt = null;
        command.assessment.startedAt = null;
        command.assessment.stoppedAt = null;
        this.assessments.push(command.assessment);
        break;
      }
      case "confirmPrinted": {
        const a = this.assessments.find((x) => x.id === command.id);
        ensure(a !== void 0, "\u8BD5\u5377\u4E0D\u5B58\u5728");
        a.printedAt = at;
        break;
      }
      case "startExam": {
        ensure(
          !this.assessments.some(
            (a2) => a2.startedAt !== null && a2.stoppedAt === null
          ),
          "\u8BF7\u5148\u7ED3\u675F\u5F53\u524D\u8003\u8BD5"
        );
        const a = this.assessments.find((x) => x.id === command.id);
        ensure(a !== void 0, "\u8BD5\u5377\u4E0D\u5B58\u5728");
        ensure(
          a.kind !== "homework" && a.printedAt !== null && a.startedAt === null && dateAt(at) === dateAt(a.startsAt),
          "\u8BF7\u5148\u6253\u5370\u8BD5\u5377\u4E0E\u7B54\u9898\u5361\uFF0C\u5E76\u5728\u8003\u8BD5\u5B89\u6392\u5F53\u5929\u5F00\u59CB\u8003\u8BD5"
        );
        a.startedAt = at;
        break;
      }
      case "endExam": {
        const a = this.assessments.find((x) => x.id === command.id);
        ensure(a !== void 0, "\u8003\u8BD5\u4E0D\u5B58\u5728");
        ensure(
          a.kind !== "homework" && a.startedAt !== null && a.stoppedAt === null,
          "\u8003\u8BD5\u5C1A\u672A\u5F00\u59CB\u6216\u5DF2\u7ECF\u505C\u7B14"
        );
        a.stoppedAt = at;
        break;
      }
      case "submit": {
        ensure(
          !this.submissions.some((s) => s.id === command.submission.id),
          "\u63D0\u4EA4\u7248\u672C\u4E0D\u53EF\u8986\u76D6"
        );
        const a = this.assessments.find(
          (x) => x.id === command.submission.assessmentId
        );
        ensure(a !== void 0, "\u4F5C\u4E1A/\u8003\u8BD5\u4E0D\u5B58\u5728");
        ensure(at >= a.startsAt, "\u5C1A\u672A\u5F00\u59CB\uFF0C\u4E0D\u80FD\u63D0\u4EA4");
        if (a.kind !== "homework") {
          ensure(
            a.startedAt !== null && a.stoppedAt !== null,
            "\u8003\u8BD5\u7ED3\u675F\u505C\u7B14\u540E\u624D\u80FD\u4E0A\u4F20\u7B54\u9898\u5361"
          );
          ensure(
            command.submission.resourceIds.length > 0,
            "\u8003\u8BD5\u9700\u8981\u4E0A\u4F20\u7EB8\u8D28\u7B54\u9898\u5361"
          );
        }
        ensure(
          checkText(command.submission.answers, 5e4) || command.submission.resourceIds.length > 0 || command.submission.unfinished,
          "\u8BF7\u63D0\u4F9B\u7B54\u6848\u3001\u9644\u4EF6\u6216\u6807\u8BB0\u672A\u5B8C\u6210"
        );
        command.submission.submittedAt = at;
        const project = a.projectId;
        const source = command.submission.id;
        this.submissions.push(command.submission);
        this.event(project, "grade", source, at);
        break;
      }
      case "recordQuestionTimes": {
        ensure(command.questionTimes.length > 0, "\u6CA1\u6709\u9700\u8981\u8865\u5F55\u7684\u5B8C\u6210\u65F6\u523B");
        ensure(
          !this.grades.some((g) => g.submissionId === command.id),
          "\u5DF2\u6279\u6539\u7684\u7B54\u5377\u4E0D\u80FD\u8865\u5F55\u5B8C\u6210\u65F6\u523B"
        );
        const submission = this.submissions.find((s) => s.id === command.id);
        ensure(submission !== void 0, "\u63D0\u4EA4\u7248\u672C\u4E0D\u5B58\u5728");
        ensure(
          command.questionTimes.every(
            (t) => !submission.questionTimes.some(
              (existing) => existing.questionId === t.questionId
            )
          ),
          "\u5DF2\u6709\u7684\u5B8C\u6210\u65F6\u523B\u4E0D\u80FD\u8986\u76D6"
        );
        submission.questionTimes.push(...command.questionTimes);
        break;
      }
      case "grade": {
        ensure(
          !this.grades.some((g) => g.id === command.grade.id),
          "\u6279\u6539\u5386\u53F2\u4E0D\u53EF\u8986\u76D6\uFF0C\u590D\u6838\u8BF7\u65B0\u589E\u6279\u6539\u8BB0\u5F55"
        );
        command.grade.gradedAt = at;
        this.grades.push(command.grade);
        break;
      }
      case "saveReview": {
        ensure(
          !this.reviews.some((r) => r.id === command.review.id),
          "\u590D\u76D8\u5386\u53F2\u4E0D\u53EF\u8986\u76D6"
        );
        this.reviews.push(command.review);
        break;
      }
      case "claimEvent": {
        const event = this.events.find(
          (e) => e.id === command.id && e.state === "pending"
        );
        ensure(event !== void 0, "\u4E8B\u4EF6\u5DF2\u5904\u7406");
        event.state = "running";
        break;
      }
      case "finishEvent": {
        const event = this.events.find((e) => e.id === command.id);
        ensure(event !== void 0, "\u6559\u5B66\u4E8B\u4EF6\u4E0D\u5B58\u5728");
        const produced = (() => {
          switch (event.kind) {
            case "homework":
              return this.assessments.some(
                (a) => a.projectId === event.projectId && a.kind === "homework" && a.lessonId === event.sourceId
              );
            case "taskHomework":
              return this.assessments.some(
                (a) => a.kind === "homework" && a.projectId === event.projectId && a.taskId === event.sourceId
              );
            case "correction":
              return this.corrections.some(
                (c) => c.id === event.sourceId && c.reviewedAt !== null
              );
            case "weeklyExam":
              return this.assessments.some(
                (a) => a.projectId === event.projectId && a.kind === "weeklyExam" && a.publishedAt >= event.createdAt
              );
            case "grade":
              return this.grades.some((g) => g.submissionId === event.sourceId);
            case "review":
              return this.reviews.some(
                (r) => r.projectId === event.projectId && event.sourceId.endsWith(r.date)
              );
            default:
              return false;
          }
        })();
        ensure(produced, "\u8BF7\u5148\u4FDD\u5B58\u672C\u6B21\u6559\u5B66\u4E8B\u4EF6\u7684\u5B9E\u9645\u4EA7\u7269");
        event.state = "done";
        break;
      }
      case "retryEvent": {
        const event = this.events.find(
          (e) => e.id === command.id && e.state !== "done"
        );
        ensure(event !== void 0, "\u6CA1\u6709\u53EF\u91CD\u8BD5\u7684\u6559\u5B66\u4E8B\u4EF6");
        event.state = "pending";
        break;
      }
    }
  }
};
function upsertBy(list, value, key) {
  const k = key(value);
  const index = list.findIndex((x) => key(x) === k);
  if (index >= 0) {
    list[index] = value;
  } else {
    list.push(value);
  }
}
function completedStudyTaskFromTask(task, at) {
  if (task.projectId === null) return null;
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    notes: task.notes,
    topics: [...task.tags],
    completedAt: at
  };
}
function hourMinuteNow(at) {
  const d = new Date(at * 1e3);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function validateEducation(data) {
  const e = data.education;
  uniqueEducationIds([
    ...e.resources.map((x) => x.id),
    ...e.semesters.map((x) => x.id),
    ...e.lessons.map((x) => x.id),
    ...e.assessments.map((x) => x.id),
    ...e.submissions.map((x) => x.id),
    ...e.grades.map((x) => x.id),
    ...e.reviews.map((x) => x.id)
  ]);
  uniqueEducationIds(e.projects.map((p) => p.projectId));
  uniqueEducationIds(e.events.map((p) => p.id));
  const projectExists = (id2) => data.projects.some((p) => p.id === id2);
  const resource = (id2, p) => e.resources.find((r) => r.id === id2 && r.projectId === p);
  ensure(
    e.lessons.length + e.assessments.length + e.submissions.length + e.grades.length <= 1e5,
    "\u6559\u5B66\u8BB0\u5F55\u6570\u91CF\u8D85\u51FA\u9650\u5236"
  );
  for (const p of e.projects) {
    ensure(
      projectExists(p.projectId) && isAbsolutePath(p.directory),
      "\u9879\u76EE\u5FC5\u987B\u7ED1\u5B9A\u7EDD\u5BF9\u76EE\u5F55"
    );
    ensure(
      p.examDate === null || validEducationDate(p.examDate),
      "\u65E0\u6548\u7684\u8003\u8BD5\u65E5\u671F"
    );
    if (p.examMode) {
      ensure(
        p.visionId !== null && data.visions.some((v) => v.id === p.visionId) && checkText(p.target, 5e4),
        "\u5E94\u8BD5\u6A21\u5F0F\u5FC5\u987B\u7ED1\u5B9A\u613F\u666F\u5E76\u660E\u786E\u9662\u6821\u3001\u4E13\u4E1A\u3001\u5E74\u4EFD\u548C\u79D1\u76EE\u76EE\u6807"
      );
      ensure(
        p.syllabusId !== null && resource(p.syllabusId, p.projectId)?.kind === "syllabus",
        "\u5E94\u8BD5\u6A21\u5F0F\u5FC5\u987B\u7ED1\u5B9A\u8003\u7EB2"
      );
      ensure(
        p.pastPaperIds.length > 0 && p.pastPaperIds.every(
          (id2) => resource(id2, p.projectId)?.kind === "pastPaper"
        ),
        "\u5E94\u8BD5\u6A21\u5F0F\u5FC5\u987B\u7ED1\u5B9A\u771F\u9898"
      );
      ensure(
        p.mockPaperIds.length > 0 && p.mockPaperIds.every(
          (id2) => resource(id2, p.projectId)?.kind === "mockPaper"
        ),
        "\u5E94\u8BD5\u6A21\u5F0F\u5FC5\u987B\u7ED1\u5B9A\u6A21\u62DF\u9898"
      );
    }
  }
  for (const r of e.resources) {
    ensure(
      e.projects.some((p) => p.projectId === r.projectId) && checkText(r.title, 5e4) && isRelativePath(r.path),
      "\u8D44\u6E90\u9700\u8981\u6240\u5C5E\u9879\u76EE\u3001\u540D\u79F0\u548C\u5B89\u5168\u7684\u76F8\u5BF9\u8DEF\u5F84"
    );
  }
  for (const s of e.semesters) {
    ensure(
      e.projects.some((p) => p.projectId === s.projectId) && checkText(s.title, 5e4) && validEducationDate(s.startDate) && validEducationDate(s.endDate) && s.startDate <= s.endDate && s.revision > 0 && checkText(s.baseline, 5e4) && checkText(s.rationale, 5e4) && s.evidence.length > 0 && s.milestones.length > 0,
      "\u5B66\u671F\u8BA1\u5212\u7F3A\u5C11\u65E5\u671F\u3001\u5B66\u60C5\u8BCA\u65AD\u3001\u4F9D\u636E\u6216\u9636\u6BB5\u8FDB\u5EA6"
    );
    for (const m of s.milestones) {
      ensure(
        m.week > 0 && m.topics.length > 0 && checkText(m.objective, 5e4) && m.lessonCount > 0 && m.resourceIds.every((id2) => resource(id2, s.projectId) !== void 0),
        "\u65E0\u6548\u7684\u5468\u8FDB\u5EA6\u6216\u5B66\u4E60\u8D44\u6E90"
      );
    }
  }
  for (const l of e.lessons) {
    const s = [...e.semesters, ...e.semesterHistory].find(
      (x) => x.id === l.semesterId && x.projectId === l.projectId && x.revision === l.semesterRevision
    );
    ensure(s !== void 0, "\u8BFE\u7A0B\u5FC5\u987B\u7ED1\u5B9A\u672C\u9879\u76EE\u5B66\u671F\u8BA1\u5212");
    ensure(
      checkText(l.title, 5e4) && l.topics.length > 0 && l.endsAt - l.startsAt === 45 * 60 && dateAt(l.startsAt) >= s.startDate && dateAt(l.endsAt) <= s.endDate && l.resourceIds.every((id2) => resource(id2, l.projectId) !== void 0),
      "\u8BFE\u7A0B\u9700\u898145\u5206\u949F\u3001\u77E5\u8BC6\u70B9\u548C\u6709\u6548\u8D44\u6E90\uFF0C\u4E14\u5728\u5B66\u671F\u8303\u56F4\u5185"
    );
    const minute = Math.floor(minutesOf(hourMinuteNow(l.startsAt)) ?? 0);
    ensure(
      minute >= 8 * 60 && minute < 12 * 60 + 40 || minute >= 14 * 60 && minute < 18 * 60 + 15,
      "\u8BFE\u7A0B\u987B\u5728\u4E0A\u5348\u6216\u4E0B\u5348\uFF0C\u665A\u95F419\u201322\u70B9\u7559\u7ED9\u4F5C\u4E1A"
    );
    const same = e.lessons.filter(
      (x) => dateAt(x.startsAt) === dateAt(l.startsAt)
    );
    let morning = 0;
    let afternoon = 0;
    for (const x of same) {
      const h = new Date(x.startsAt * 1e3).getHours();
      if (h < 12) morning += 1;
      else afternoon += 1;
    }
    ensure(morning <= 4 && afternoon <= 4, "\u8DE8\u9879\u76EE\u6BCF\u5929\u6700\u591A\u4E0A\u53484\u8282\u3001\u4E0B\u53484\u8282");
    ensure(
      !e.lessons.some(
        (x) => x.id !== l.id && x.startsAt < l.endsAt && x.endsAt > l.startsAt
      ),
      "\u8DE8\u9879\u76EE\u8BFE\u7A0B\u65F6\u95F4\u51B2\u7A81"
    );
    const date = dateAt(l.startsAt);
    for (const b of data.blocks) {
      if (b.attention === "required") {
        ensure(
          overlapMinutes(b, date, minute, minute + 45) === 0,
          "\u8BFE\u7A0B\u4E0E\u9700\u4E13\u5FC3\u7684\u56FA\u5B9A\u5360\u7528\u51B2\u7A81"
        );
      }
    }
  }
  for (const a of e.assessments) {
    ensure(
      e.projects.some((p) => p.projectId === a.projectId),
      "AI\u4F5C\u4E1A\u548C\u8003\u8BD5\u9700\u8981\u542F\u7528\u5E94\u8BD5\u6A21\u5F0F"
    );
    ensure(
      [...e.semesters, ...e.semesterHistory].some(
        (s) => s.id === a.semesterId && s.projectId === a.projectId && s.revision === a.semesterRevision
      ),
      "\u8BD5\u9898\u5FC5\u987B\u7ED1\u5B9A\u5B66\u671F\u8BA1\u5212"
    );
    ensure(
      a.revision > 0 && a.startsAt < a.endsAt && checkText(a.title, 5e4) && checkText(a.reviewEvidence, 5e4) && checkText(a.instructions, 5e4) && a.questions.length > 0,
      "\u53D1\u5E03\u524D\u5FC5\u987B\u51C6\u5907\u9898\u76EE\u3001\u8003\u8BD5\u8BF4\u660E\u3001\u7B54\u6848\u548C\u72EC\u7ACB\u590D\u6838\u8BB0\u5F55"
    );
    if (a.kind === "homework") {
      ensure(
        a.taskId === null && a.lessonId !== null && e.lessons.some(
          (l) => l.id === a.lessonId && l.projectId === a.projectId && l.aiEnabled && l.state === "ended"
        ) || a.lessonId === null && a.taskId !== null && e.completedTasks.some(
          (t) => t.id === a.taskId && t.projectId === a.projectId
        ),
        "\u4F5C\u4E1A\u5FC5\u987B\u6765\u81EA\u672C\u9879\u76EE\u5DF2\u7ED3\u675F\u7684AI\u8BFE\u7A0B\u6216\u5DF2\u5B8C\u6210\u5B66\u4E60\u4EFB\u52A1"
      );
    }
    if (a.kind === "retest") {
      ensure(
        a.retestOfGradeId !== null && e.grades.some((g) => {
          if (g.id !== a.retestOfGradeId) return false;
          return e.submissions.some((s) => {
            if (s.id !== g.submissionId) return false;
            return e.assessments.some(
              (original) => original.id === s.assessmentId && original.projectId === a.projectId
            );
          });
        }),
        "\u590D\u6D4B\u5FC5\u987B\u5173\u8054\u672C\u9879\u76EE\u539F\u59CB\u6279\u6539"
      );
    } else {
      ensure(a.retestOfGradeId === null, "\u53EA\u6709\u590D\u6D4B\u53EF\u4EE5\u5F15\u7528\u539F\u59CB\u6279\u6539");
    }
    if (a.kind === "weeklyExam") {
      ensure(weekdayMonday(localDateOf(a.startsAt)) >= 6, "\u5468\u8003\u5B89\u6392\u5728\u5468\u672B");
    }
    if (a.kind !== "homework") {
      ensure(
        !e.lessons.some(
          (l) => l.startsAt < a.endsAt && l.endsAt > a.startsAt
        ) && !e.assessments.some(
          (b) => b.id !== a.id && b.kind !== "homework" && b.startsAt < a.endsAt && b.endsAt > a.startsAt
        ),
        "\u8003\u8BD5\u4E0E\u8BFE\u7A0B\u6216\u5176\u4ED6\u8003\u8BD5\u51B2\u7A81"
      );
    }
    uniqueEducationIds(a.questions.map((q) => q.id));
    for (const q of a.questions) {
      ensure(
        checkText(q.prompt, 5e4) && checkText(q.answer, 5e4) && q.topics.length > 0 && q.estimatedMinutes > 0 && q.scoring.length > 0 && q.sourceIds.length > 0 && q.sourceIds.every((id2) => resource(id2, a.projectId) !== void 0),
        "\u6BCF\u9898\u5FC5\u987B\u6709\u6765\u6E90\u3001\u77E5\u8BC6\u70B9\u3001\u4F30\u65F6\u3001\u7B54\u6848\u548C\u8BC4\u5206\u70B9"
      );
      uniqueEducationIds(q.scoring.map((p) => p.id));
      for (const p of q.scoring) {
        ensure(
          p.points > 0 && checkText(p.description, 5e4),
          "\u8BC4\u5206\u70B9\u9700\u8981\u5206\u503C\u4E0E\u5224\u5206\u4F9D\u636E"
        );
      }
      if (!q.extension && a.kind !== "mockExam" && a.kind !== "retest") {
        ensure(
          q.topics.every(
            (t) => e.lessons.some(
              (l) => l.projectId === a.projectId && l.state === "ended" && l.topics.includes(t)
            ) || e.completedTasks.some(
              (task) => task.projectId === a.projectId && task.topics.includes(t)
            ) || e.progress.some(
              (r) => r.projectId === a.projectId && r.confirmed && r.topic === t
            )
          ),
          "\u57FA\u7840\u7EC3\u4E60\u4E0D\u80FD\u5305\u542B\u5C1A\u672A\u6388\u8BFE\u7684\u77E5\u8BC6\u70B9\uFF1B\u62D3\u5C55\u9898\u987B\u660E\u786E\u6807\u8BB0"
        );
      }
    }
  }
  for (const s of e.submissions) {
    const a = e.assessments.find((x) => x.id === s.assessmentId);
    ensure(a !== void 0, "\u63D0\u4EA4\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u8BD5\u9898");
    ensure(
      s.resourceIds.every((id2) => resource(id2, a.projectId) !== void 0),
      "\u7B54\u5377\u9644\u4EF6\u5FC5\u987B\u5C5E\u4E8E\u672C\u9879\u76EE"
    );
    uniqueEducationIds(s.questionTimes.map((t) => t.questionId));
    for (const t of s.questionTimes) {
      ensure(
        a.questions.some((q) => q.id === t.questionId) && t.localTime.length === 5 && minutesOf(t.localTime) !== null,
        "\u6BCF\u9898\u8BB0\u5F55\u672C\u673AHH:MM\u5B8C\u6210\u65F6\u523B"
      );
    }
  }
  for (const g of e.grades) {
    const s = e.submissions.find((x) => x.id === g.submissionId);
    ensure(s !== void 0, "\u6279\u6539\u7F3A\u5C11\u63D0\u4EA4\u7248\u672C");
    const a = e.assessments.find((x) => x.id === s.assessmentId);
    ensure(a !== void 0, "\u8BD5\u9898\u4E0D\u5B58\u5728");
    ensure(
      g.assessmentRevision === a.revision && checkText(g.feedback, 5e4),
      "\u6279\u6539\u5FC5\u987B\u5F15\u7528\u53D1\u5E03\u65F6\u7684\u8BC4\u5206\u7248\u672C\u5E76\u7ED9\u51FA\u53CD\u9988"
    );
    const seen = /* @__PURE__ */ new Set();
    for (const award of g.awards) {
      const point = a.questions.find((q) => q.id === award.questionId)?.scoring.find((p) => p.id === award.pointId);
      ensure(point !== void 0, "\u6279\u6539\u4E0D\u80FD\u4E34\u65F6\u589E\u52A0\u8BC4\u5206\u70B9");
      ensure(
        award.awarded <= point.points && checkText(award.evidence, 5e4) && !seen.has(`${award.questionId}|${award.pointId}`),
        "\u8BC4\u5206\u8D85\u8303\u56F4\u3001\u91CD\u590D\u6216\u7F3A\u5C11\u7B54\u5377\u8BC1\u636E"
      );
      seen.add(`${award.questionId}|${award.pointId}`);
    }
    const totalPoints = a.questions.reduce((n, q) => n + q.scoring.length, 0);
    ensure(
      g.needsReview || g.awards.length === totalPoints,
      "\u6B63\u5F0F\u6279\u6539\u5FC5\u987B\u8986\u76D6\u5168\u90E8\u8BC4\u5206\u70B9\uFF1B\u8BC6\u522B\u4E0D\u6E05\u8BF7\u6807\u8BB0\u5F85\u590D\u6838"
    );
    for (const error of g.errors) {
      ensure(
        a.questions.some((q) => q.id === error.questionId) && checkText(error.cause, 5e4) && checkText(error.evidence, 5e4) && checkText(error.correction, 5e4) && checkText(error.nextCheck, 5e4) && validEducationDate(error.retestDate),
        "\u9519\u56E0\u5206\u6790\u9700\u8981\u8BC1\u636E\u3001\u7EA0\u6B63\u52A8\u4F5C\u548C\u590D\u6D4B\u65E5\u671F"
      );
    }
  }
  for (const r of e.reviews) {
    ensure(
      projectExists(r.projectId) && validEducationDate(r.date) && checkText(r.findings, 5e4) && r.actions.length > 0 && r.gradeIds.length > 0 && r.gradeIds.every(
        (id2) => e.grades.some((g) => {
          if (g.id !== id2) return false;
          return e.submissions.some((s) => {
            if (s.id !== g.submissionId) return false;
            return e.assessments.some(
              (a) => a.id === s.assessmentId && a.projectId === r.projectId
            );
          });
        })
      ),
      "\u590D\u76D8\u5FC5\u987B\u5F15\u7528\u672C\u9879\u76EE\u6279\u6539\u5E76\u7ED9\u51FA\u540E\u7EED\u884C\u52A8"
    );
  }
  for (const event of e.events) {
    ensure(
      projectExists(event.projectId) && ["pending", "running", "done"].includes(event.state) && [
        "homework",
        "taskHomework",
        "grade",
        "correction",
        "review",
        "weeklyExam"
      ].includes(event.kind),
      "\u65E0\u6548\u7684\u6559\u5B66\u4E8B\u4EF6"
    );
  }
  validateLearning(data);
}
function uniqueEducationIds(ids) {
  const seen = /* @__PURE__ */ new Set();
  for (const id2 of ids) {
    ensure(
      id2.trim().length > 0 && id2.length <= 200 && !seen.has(id2),
      "\u6559\u5B66\u5B9E\u4F53 ID \u4E3A\u7A7A\u3001\u8FC7\u957F\u6216\u91CD\u590D"
    );
    seen.add(id2);
  }
}
function validateEducationTransition(before, after) {
  validateLearningTransition(before, after);
  for (const link of before.focusTasks) {
    ensure(
      after.focusTasks.some(
        (x) => x.taskId === link.taskId && x.sourceId === link.sourceId && x.kind === link.kind
      ),
      "\u5DF2\u5EFA\u7ACB\u7684\u6559\u5B66\u5F85\u529E\u6765\u6E90\u5173\u8054\u4E0D\u80FD\u5220\u9664\u6216\u6539\u5199"
    );
  }
  const activeResources = new Set(after.resources.map((r) => r.id));
  const references = before.resourceReferenceIndex();
  for (const resource of before.resources) {
    if (!activeResources.has(resource.id)) {
      ensure(
        !references.has(resource.id),
        "\u6559\u5B66\u5386\u53F2\u5F15\u7528\u7684\u8D44\u6E90\u767B\u8BB0\u4E0D\u80FD\u5220\u9664\uFF0C\u8BF7\u4FEE\u590D\u8DEF\u5F84"
      );
    }
  }
  for (const a of before.assessments) {
    ensure(
      after.assessments.some((b2) => b2.id === a.id),
      "\u5DF2\u53D1\u5E03\u8BD5\u5377\u4E0D\u80FD\u5220\u9664"
    );
    const b = after.assessments.find((x) => x.id === a.id);
    if (b !== void 0) {
      const old = cloneAssessment(a);
      old.printedAt = b.printedAt;
      old.startedAt = b.startedAt;
      old.stoppedAt = b.stoppedAt;
      ensure(
        assessmentEquals(old, b),
        "\u5DF2\u53D1\u5E03\u9898\u76EE\u4E0E\u8BC4\u5206\u6807\u51C6\u4E0D\u53EF\u88AB\u5BFC\u5165\u6216\u8865\u4E01\u6539\u5199"
      );
    }
  }
  for (const s of before.submissions) {
    const b = after.submissions.find((x) => x.id === s.id);
    ensure(
      b !== void 0 && (() => {
        const old = cloneSubmission(s);
        old.questionTimes = b.questionTimes.map((t) => ({ ...t }));
        return submissionEquals(old, b) && startsWithQuestionTimes(b.questionTimes, s.questionTimes) && (b.questionTimes.length === s.questionTimes.length || !before.grades.some((g) => g.submissionId === s.id));
      })(),
      "\u63D0\u4EA4\u5386\u53F2\u4E0D\u53EF\u6539\u5199\uFF1B\u53EA\u80FD\u5728\u6279\u6539\u524D\u8865\u5145\u7F3A\u5931\u7684\u5B8C\u6210\u65F6\u523B"
    );
  }
  for (const g of before.grades) {
    const b = after.grades.find((x) => x.id === g.id);
    ensure(b !== void 0 && gradeEquals(b, g), "\u6279\u6539\u5386\u53F2\u4E0D\u53EF\u6539\u5199");
  }
}
function cloneAssessment(a) {
  return {
    ...a,
    questions: a.questions.map((q) => ({
      ...q,
      topics: [...q.topics],
      sourceIds: [...q.sourceIds],
      scoring: q.scoring.map((p) => ({ ...p }))
    }))
  };
}
function cloneSubmission(s) {
  return {
    ...s,
    resourceIds: [...s.resourceIds],
    questionTimes: s.questionTimes.map((t) => ({ ...t }))
  };
}
function assessmentEquals(a, b) {
  return JSON.stringify(serializeAssessment(a)) === JSON.stringify(serializeAssessment(b));
}
function submissionEquals(a, b) {
  return JSON.stringify(serializeSubmission(a)) === JSON.stringify(serializeSubmission(b));
}
function gradeEquals(a, b) {
  return JSON.stringify(serializeGrade(a)) === JSON.stringify(serializeGrade(b));
}
function startsWithQuestionTimes(list, prefix) {
  return prefix.every(
    (p, i) => list[i] !== void 0 && list[i].questionId === p.questionId && list[i].localTime === p.localTime
  );
}
var EDUCATION_KEYS = [
  "focusTasks",
  "projects",
  "resources",
  "semesters",
  "semesterHistory",
  "lessons",
  "assessments",
  "submissions",
  "grades",
  "reviews",
  "events",
  "completedTasks",
  "progress",
  "corrections"
];
function parseEducation(raw) {
  if (!isObject(raw)) throw new AppError("\u6559\u5B66\u6570\u636E\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...EDUCATION_KEYS], "\u6559\u5B66\u6570\u636E");
  const e = new Education();
  e.focusTasks = field(
    raw,
    "focusTasks",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "focusTasks").map((x) => {
      ensure(isObject(x), "\u6559\u5B66\u5F85\u529E\u5173\u8054\u5FC5\u987B\u662F\u5BF9\u8C61");
      rejectUnknown(x, ["taskId", "sourceId", "kind"], "\u6559\u5B66\u5F85\u529E\u5173\u8054");
      return {
        taskId: requiredField(x, "taskId", "\u6559\u5B66\u5F85\u529E\u5173\u8054", asStr),
        sourceId: requiredField(x, "sourceId", "\u6559\u5B66\u5F85\u529E\u5173\u8054", asStr),
        kind: oneOf(
          requiredField(x, "kind", "\u6559\u5B66\u5F85\u529E\u5173\u8054", (k) => k),
          "\u6559\u5B66\u5F85\u529E kind",
          ["lesson", "homework"]
        )
      };
    }),
    []
  );
  e.projects = field(
    raw,
    "projects",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "projects").map(parseProjectStudy),
    []
  );
  e.resources = field(
    raw,
    "resources",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "resources").map(parseResource),
    []
  );
  e.semesters = field(
    raw,
    "semesters",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "semesters").map(parseSemester),
    []
  );
  e.semesterHistory = field(
    raw,
    "semesterHistory",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "semesterHistory").map(parseSemester),
    []
  );
  e.lessons = field(
    raw,
    "lessons",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "lessons").map(parseLesson),
    []
  );
  e.assessments = field(
    raw,
    "assessments",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "assessments").map(parseAssessment),
    []
  );
  e.submissions = field(
    raw,
    "submissions",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "submissions").map(parseSubmission),
    []
  );
  e.grades = field(
    raw,
    "grades",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "grades").map(parseGrade),
    []
  );
  e.reviews = field(
    raw,
    "reviews",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "reviews").map(parseReview),
    []
  );
  e.events = field(
    raw,
    "events",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "events").map(parseTeachingEvent),
    []
  );
  e.completedTasks = field(
    raw,
    "completedTasks",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "completedTasks").map(parseCompletedStudyTask),
    []
  );
  e.progress = field(
    raw,
    "progress",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "progress").map(parseProgressRecord),
    []
  );
  e.corrections = field(
    raw,
    "corrections",
    "\u6559\u5B66\u6570\u636E",
    (v) => asArray(v, "corrections").map(parseCorrection),
    []
  );
  return e;
}
function serializeEducation(e) {
  return {
    focusTasks: e.focusTasks.map((t) => ({
      taskId: t.taskId,
      sourceId: t.sourceId,
      kind: t.kind
    })),
    projects: e.projects.map(serializeProjectStudy),
    resources: e.resources.map(serializeResource),
    semesters: e.semesters.map(serializeSemester),
    semesterHistory: e.semesterHistory.map(serializeSemester),
    lessons: e.lessons.map(serializeLesson),
    assessments: e.assessments.map(serializeAssessment),
    submissions: e.submissions.map(serializeSubmission),
    grades: e.grades.map(serializeGrade),
    reviews: e.reviews.map(serializeReview),
    events: e.events.map(serializeTeachingEvent),
    completedTasks: e.completedTasks.map(serializeCompletedStudyTask),
    progress: e.progress.map(serializeProgressRecord),
    corrections: e.corrections.map(serializeCorrection)
  };
}

// packages/core/src/teaching_tasks.ts
function teachingTask(data, taskId) {
  return data.education.focusTasks.find((link) => link.taskId === taskId);
}
function materializeTeachingTasks(data, at) {
  const enabled = new Set(
    data.education.projects.filter((p) => p.examMode).map((p) => p.projectId)
  );
  const sources = [];
  for (const lesson of data.education.lessons) {
    if (enabled.has(lesson.projectId) && dateAt(lesson.startsAt) >= dateAt(at)) {
      sources.push({
        kind: "lesson",
        sourceId: lesson.id,
        projectId: lesson.projectId,
        title: lesson.title,
        notes: lesson.topics.join("\u3001"),
        startsAt: lesson.startsAt,
        minutes: 45
      });
    }
  }
  for (const paper of data.education.assessments) {
    if (paper.kind === "homework" && enabled.has(paper.projectId)) {
      let minutes = 0;
      for (const q of paper.questions) {
        minutes = Math.min(4294967295, minutes + q.estimatedMinutes);
      }
      sources.push({
        kind: "homework",
        sourceId: paper.id,
        projectId: paper.projectId,
        title: paper.title,
        notes: paper.instructions,
        startsAt: paper.startsAt,
        minutes: Math.max(1, minutes)
      });
    }
  }
  const links = /* @__PURE__ */ new Map();
  for (const link of data.education.focusTasks) {
    links.set(link.sourceId, link);
  }
  const positions = /* @__PURE__ */ new Map();
  data.tasks.forEach((task, i) => positions.set(task.id, i));
  const submissions = /* @__PURE__ */ new Map();
  for (const submission of data.education.submissions) {
    const last = submissions.get(submission.assessmentId);
    if (last === void 0 || submission.submittedAt >= last.submittedAt) {
      submissions.set(submission.assessmentId, {
        submittedAt: submission.submittedAt,
        unfinished: submission.unfinished
      });
    }
  }
  let changed = false;
  for (const {
    kind,
    sourceId,
    projectId,
    title,
    notes,
    startsAt,
    minutes
  } of sources) {
    const link = links.get(sourceId);
    const taskId = link !== void 0 && link.kind === kind ? link.taskId : void 0;
    const position = taskId !== void 0 ? positions.get(taskId) : void 0;
    if (taskId !== void 0 && position === void 0) {
      continue;
    }
    const dueDate = dateAt(startsAt);
    const isLesson = kind === "lesson";
    const reminder = isLesson ? hourMinuteString(startsAt) : null;
    const focus = isLesson ? 45 : Math.min(minutes, data.settings.focusMinutes);
    const estimate = Math.max(1, Math.ceil(minutes / focus));
    const scrap = isLesson ? (() => {
      const d = new Date(startsAt * 1e3);
      return Math.max(0, 1440 - d.getHours() * 60 - d.getMinutes() - 45);
    })() : 0;
    let index;
    if (position !== void 0) {
      index = position;
    } else {
      const taskIdNew = id();
      data.education.focusTasks.push({ taskId: taskIdNew, sourceId, kind });
      data.tasks.push({
        id: taskIdNew,
        templateId: null,
        recurring: false,
        title,
        notes,
        projectId,
        habitId: null,
        dueDate,
        reminderTime: reminder,
        focusMinutes: focus,
        scrapMinutes: scrap,
        priority: 1,
        estimate,
        reminderFired: false,
        reminderPending: false,
        reminderExpired: false,
        completed: false,
        completedAt: null,
        createdAt: at,
        tags: [isLesson ? "\u8BFE\u7A0B" : "\u4F5C\u4E1A"],
        subtasks: []
      });
      changed = true;
      index = data.tasks.length - 1;
    }
    const task = data.tasks[index];
    if (!task.completed && (task.title !== title || task.notes !== notes || task.projectId !== projectId || task.dueDate !== dueDate || task.reminderTime !== reminder || task.focusMinutes !== focus || task.estimate !== estimate || task.scrapMinutes !== scrap)) {
      if (task.dueDate !== dueDate || task.reminderTime !== reminder) {
        task.reminderFired = false;
        task.reminderPending = false;
        task.reminderExpired = false;
      }
      task.title = title;
      task.notes = notes;
      task.projectId = projectId;
      task.dueDate = dueDate;
      task.reminderTime = reminder;
      task.focusMinutes = focus;
      task.estimate = estimate;
      task.scrapMinutes = scrap;
      changed = true;
    }
    if (kind === "homework") {
      const submitted = (() => {
        const last = submissions.get(sourceId);
        if (last === void 0 || last.unfinished) return null;
        return last.submittedAt;
      })();
      if (task.completed !== (submitted !== null) || task.completedAt !== submitted) {
        if (submitted !== null && data.timer.taskId === task.id) {
          recordSession(data, at, false);
          data.timer.taskId = null;
          resetTo(data, "focus");
        }
        task.completed = submitted !== null;
        task.completedAt = submitted;
        changed = true;
      }
    }
  }
  return changed;
}
function completeTeachingTask(data, taskId, at) {
  const link = teachingTask(data, taskId);
  if (link === void 0) return;
  if (link.kind === "homework") {
    throw new AppError("\u8BF7\u4ECE\u4F5C\u4E1A\u5165\u53E3\u63D0\u4EA4\u7B54\u5377\uFF0C\u63D0\u4EA4\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u5B8C\u6210\u5F85\u529E");
  }
  const lesson = data.education.lessons.find((l) => l.id === link.sourceId);
  ensure(lesson !== void 0, "\u8BFE\u7A0B\u4E0D\u5B58\u5728");
  lesson.attended = true;
  if (lesson.progress.trim().length === 0) {
    lesson.progress = "\u672C\u4EBA\u4ECE\u4ECA\u65E5\u4E13\u6CE8\u786E\u8BA4\u8BFE\u7A0B\u4EFB\u52A1\u5B8C\u6210\uFF0C\u5177\u4F53\u5B66\u4E60\u4F4D\u7F6E\u5F85\u8865\u5145\uFF1B\u638C\u63E1\u60C5\u51B5\u5F85\u590D\u6D4B";
  }
  if (at >= lesson.endsAt) {
    lesson.state = "ended";
    if (lesson.aiEnabled) {
      data.education.event(lesson.projectId, "homework", lesson.id, at);
    }
  }
}
function startTeachingTask(data, at) {
  if (data.timer.mode !== "focus") return;
  const link = data.timer.taskId !== null ? teachingTask(data, data.timer.taskId) : void 0;
  if (link === void 0 || link.kind !== "lesson") return;
  const lesson = data.education.lessons.find((l) => l.id === link.sourceId);
  if (lesson !== void 0) {
    if (at >= lesson.startsAt && at < lesson.endsAt) {
      lesson.attended = true;
    }
  }
}
function validateTeachingTasks(data) {
  const tasks = /* @__PURE__ */ new Set();
  const sources = /* @__PURE__ */ new Set();
  for (const link of data.education.focusTasks) {
    const task = data.tasks.find((t) => t.id === link.taskId);
    ensure(task !== void 0, "\u6559\u5B66\u5F85\u529E\u5173\u8054\u7684\u4EFB\u52A1\u4E0D\u5B58\u5728");
    const project = (() => {
      if (link.kind === "lesson") {
        return data.education.lessons.find((l) => l.id === link.sourceId)?.projectId ?? null;
      }
      return data.education.assessments.find(
        (a) => a.id === link.sourceId && a.kind === "homework"
      )?.projectId ?? null;
    })();
    ensure(project !== null, "\u6559\u5B66\u5F85\u529E\u6765\u6E90\u4E0D\u5B58\u5728\u6216\u7C7B\u578B\u4E0D\u7B26");
    if (task.projectId !== project || tasks.has(link.taskId) || sources.has(link.sourceId) || task.templateId !== null || task.habitId !== null || task.recurring) {
      throw new AppError("\u6559\u5B66\u6765\u6E90\u5FC5\u987B\u5173\u8054\u540C\u9879\u76EE\u7684\u552F\u4E00\u666E\u901A\u4EFB\u52A1");
    }
    tasks.add(link.taskId);
    sources.add(link.sourceId);
  }
}

// packages/core/src/identities.ts
var IDENTITY_KEYS = ["id", "kind", "retired", "restoreTask"];
function parseIdentity(raw) {
  if (!isObject(raw)) throw new AppError("ID \u767B\u8BB0\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...IDENTITY_KEYS], "ID \u767B\u8BB0");
  return {
    id: requiredField(raw, "id", "ID \u767B\u8BB0", asStr),
    kind: requiredField(raw, "kind", "ID \u767B\u8BB0", asStr),
    retired: requiredField(raw, "retired", "ID \u767B\u8BB0", (v) => {
      if (typeof v !== "boolean") throw new AppError("retired \u5FC5\u987B\u662F\u5E03\u5C14\u503C");
      return v;
    }),
    restoreTask: field(
      raw,
      "restoreTask",
      "ID \u767B\u8BB0",
      (v) => asOpt(v, "restoreTask", asStr),
      null
    )
  };
}
function serializeIdentity(i) {
  return {
    id: i.id,
    kind: i.kind,
    retired: i.retired,
    restoreTask: i.restoreTask
  };
}
function activeIdentities(data) {
  const ids = /* @__PURE__ */ new Map();
  const add = (id2, kind) => {
    if (id2.trim().length === 0 || utf8Len(id2) > 200 || ids.has(id2)) {
      throw new AppError("\u72EC\u7ACB\u5B9E\u4F53 ID \u4E3A\u7A7A\u3001\u8FC7\u957F\u6216\u91CD\u590D");
    }
    ids.set(id2, kind);
  };
  for (const x of data.projects) add(x.id, "project");
  for (const x of data.habits) add(x.id, "habit");
  for (const x of data.visions) add(x.id, "vision");
  for (const x of data.blocks) add(x.id, "block");
  for (const x of data.tasks) add(x.id, "task");
  for (const x of data.templates) add(x.id, "template");
  for (const x of data.sessions) add(x.id, "session");
  for (const x of data.education.resources) add(x.id, "resource");
  for (const x of data.education.semesters) add(x.id, "semester");
  for (const x of data.education.lessons) add(x.id, "lesson");
  for (const x of data.education.assessments) add(x.id, "assessment");
  for (const x of data.education.submissions) add(x.id, "submission");
  for (const x of data.education.grades) add(x.id, "grade");
  for (const x of data.education.reviews) add(x.id, "review");
  for (const x of data.education.progress) add(x.id, "progress");
  for (const x of data.education.corrections) add(x.id, "correction");
  return ids;
}
var ALLOWED_KINDS = [
  "project",
  "habit",
  "vision",
  "task",
  "template",
  "session",
  "block",
  "resource",
  "semester",
  "lesson",
  "assessment",
  "submission",
  "grade",
  "review",
  "progress",
  "correction"
];
function reconcileIdentities(before, after, restoreId) {
  const oldActive = activeIdentities(before);
  const newActive = activeIdentities(after);
  const entries = /* @__PURE__ */ new Map();
  for (const record of [...before.identities, ...after.identities]) {
    const old = entries.get(record.id);
    if (old !== void 0) {
      if (old.kind !== record.kind) {
        throw new AppError("\u5386\u53F2 ID \u4E0D\u80FD\u8F6C\u7528\u4E8E\u53E6\u4E00\u79CD\u5B9E\u4F53");
      }
      old.retired = old.retired || record.retired;
      if (old.restoreTask === null) {
        old.restoreTask = record.restoreTask;
      }
    } else {
      entries.set(record.id, { ...record, restoreTask: record.restoreTask });
    }
  }
  for (const [id2, kind] of oldActive) {
    if (!entries.has(id2)) {
      entries.set(id2, { id: id2, kind, retired: false, restoreTask: null });
    }
  }
  const visit = (source, live) => {
    for (const session of source.sessions) {
      const taskId = session.taskId;
      if (taskId === null) continue;
      const record = entries.get(taskId);
      if (record !== void 0) {
        if (record.kind !== "task") {
          throw new AppError("\u5386\u53F2\u4EFB\u52A1\u5F15\u7528\u7684 ID \u4E0E\u5176\u4ED6\u5B9E\u4F53\u51B2\u7A81");
        }
      } else {
        entries.set(taskId, {
          id: taskId,
          kind: "task",
          retired: !live.has(taskId),
          restoreTask: null
        });
      }
    }
  };
  visit(before, oldActive);
  visit(after, newActive);
  for (const [id2, kind] of newActive) {
    const record = entries.get(id2);
    if (record !== void 0) {
      if (record.kind !== kind) {
        throw new AppError("\u5386\u53F2 ID \u4E0D\u80FD\u88AB\u5176\u4ED6\u5B9E\u4F53\u590D\u7528");
      }
      if (record.retired) {
        const sameTask = restoreId === id2 && kind === "task";
        if (!sameTask) {
          throw new AppError(
            "\u5386\u53F2 ID \u5DF2\u88AB\u6C38\u4E45\u4FDD\u7559\uFF0C\u4E0D\u80FD\u7528\u4E8E\u65B0\u5EFA\u6216\u5BFC\u5165\u5176\u4ED6\u5B9E\u4F53"
          );
        }
        record.retired = false;
        record.restoreTask = null;
      }
    } else {
      entries.set(id2, { id: id2, kind, retired: false, restoreTask: null });
    }
  }
  for (const record of entries.values()) {
    if (!newActive.has(record.id)) {
      record.retired = true;
      if (record.kind === "task") {
        const task = before.tasks.find((t) => t.id === record.id);
        if (task !== void 0) {
          record.restoreTask = JSON.stringify(serializeTask(task));
        }
      }
    }
  }
  const records = [...entries.values()].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  after.identities = records;
}
function validateIdentities(data) {
  const current = activeIdentities(data);
  const seen = /* @__PURE__ */ new Map();
  if (data.identities.length > 1e6) {
    throw new AppError("ID \u5386\u53F2\u6570\u91CF\u8D85\u51FA\u9650\u5236");
  }
  for (const record of data.identities) {
    if (record.id.trim().length === 0 || utf8Len(record.id) > 200 || seen.has(record.id) || !ALLOWED_KINDS.includes(record.kind)) {
      throw new AppError("\u65E0\u6548\u7684 ID \u5386\u53F2\u767B\u8BB0");
    }
    seen.set(record.id, true);
    if (current.has(record.id) && current.get(record.id) !== record.kind) {
      throw new AppError("\u5386\u53F2 ID \u7C7B\u578B\u51B2\u7A81");
    }
    if (record.restoreTask !== null) {
      let task;
      try {
        task = parseTask(JSON.parse(record.restoreTask));
      } catch {
        throw new AppError("\u65E0\u6548\u7684\u4EFB\u52A1\u6062\u590D\u8BB0\u5F55");
      }
      if (record.kind !== "task" || task.id !== record.id || !record.retired) {
        throw new AppError("\u4EFB\u52A1\u6062\u590D\u8BB0\u5F55\u4E0E ID \u767B\u8BB0\u4E0D\u4E00\u81F4");
      }
    }
  }
}

// packages/core/src/plan.ts
var PLAN_FILE_KEYS = [
  "format",
  "version",
  "pomodoroMinutes",
  "projects",
  "tasks",
  "blocks",
  "templates",
  "prints",
  "habits",
  "replace"
];
var PLAN_PROJECT_KEYS = ["id", "name", "color", "appWhitelist"];
var PLAN_TASK_KEYS = [
  "id",
  "title",
  "templateId",
  "habitId",
  "recurring",
  "scrapMinutes",
  "notes",
  "projectId",
  "dueDate",
  "reminderTime",
  "focusMinutes",
  "priority",
  "estimate",
  "tags",
  "subtasks",
  "repeat"
];
var PLAN_SUBTASK_KEYS = ["id", "title"];
function parsePlanFile(raw) {
  if (!isObject(raw)) throw new AppError("\u8BA1\u5212\u6587\u4EF6\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...PLAN_FILE_KEYS], "\u8BA1\u5212\u6587\u4EF6");
  return {
    format: requiredField(raw, "format", "\u8BA1\u5212\u6587\u4EF6", asStr),
    version: requiredField(raw, "version", "\u8BA1\u5212\u6587\u4EF6", asInt),
    pomodoroMinutes: requiredField(raw, "pomodoroMinutes", "\u8BA1\u5212\u6587\u4EF6", asInt),
    projects: requiredField(
      raw,
      "projects",
      "\u8BA1\u5212\u6587\u4EF6",
      (v) => asArray(v, "projects").map(parsePlanProject)
    ),
    tasks: requiredField(
      raw,
      "tasks",
      "\u8BA1\u5212\u6587\u4EF6",
      (v) => asArray(v, "tasks").map(parsePlanTask)
    ),
    blocks: field(
      raw,
      "blocks",
      "\u8BA1\u5212\u6587\u4EF6",
      (v) => asArray(v, "blocks").map(parseBlock),
      []
    ),
    templates: field(
      raw,
      "templates",
      "\u8BA1\u5212\u6587\u4EF6",
      (v) => asArray(v, "templates").map(parseTemplate),
      []
    ),
    prints: field(
      raw,
      "prints",
      "\u8BA1\u5212\u6587\u4EF6",
      (v) => asArray(v, "prints").map(parsePrintRecord),
      []
    ),
    habits: field(
      raw,
      "habits",
      "\u8BA1\u5212\u6587\u4EF6",
      (v) => asArray(v, "habits").map(parseHabit),
      []
    ),
    replace: field(raw, "replace", "\u8BA1\u5212\u6587\u4EF6", asBool, false)
  };
}
function parsePlanProject(raw) {
  if (!isObject(raw)) throw new AppError("\u8BA1\u5212\u9879\u76EE\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...PLAN_PROJECT_KEYS], "\u8BA1\u5212\u9879\u76EE");
  return {
    id: requiredField(raw, "id", "\u8BA1\u5212\u9879\u76EE", asStr),
    name: requiredField(raw, "name", "\u8BA1\u5212\u9879\u76EE", asStr),
    color: requiredField(raw, "color", "\u8BA1\u5212\u9879\u76EE", asStr),
    appWhitelist: field(
      raw,
      "appWhitelist",
      "\u8BA1\u5212\u9879\u76EE",
      (v) => asOpt(
        v,
        "appWhitelist",
        (x) => asArray(x, "appWhitelist").map((a) => asStr(a, "\u5E94\u7528 ID"))
      ),
      null
    )
  };
}
function parsePlanSubtask(raw) {
  if (!isObject(raw)) throw new AppError("\u8BA1\u5212\u5B50\u6B65\u9AA4\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...PLAN_SUBTASK_KEYS], "\u8BA1\u5212\u5B50\u6B65\u9AA4");
  return {
    id: requiredField(raw, "id", "\u8BA1\u5212\u5B50\u6B65\u9AA4", asStr),
    title: requiredField(raw, "title", "\u8BA1\u5212\u5B50\u6B65\u9AA4", asStr)
  };
}
function parsePlanTask(raw) {
  if (!isObject(raw)) throw new AppError("\u8BA1\u5212\u4EFB\u52A1\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...PLAN_TASK_KEYS], "\u8BA1\u5212\u4EFB\u52A1");
  return {
    id: requiredField(raw, "id", "\u8BA1\u5212\u4EFB\u52A1", asStr),
    title: requiredField(raw, "title", "\u8BA1\u5212\u4EFB\u52A1", asStr),
    templateId: field(
      raw,
      "templateId",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asOpt(v, "templateId", asStr),
      null
    ),
    habitId: field(
      raw,
      "habitId",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asOpt(v, "habitId", asStr),
      null
    ),
    recurring: field(raw, "recurring", "\u8BA1\u5212\u4EFB\u52A1", asBool, false),
    scrapMinutes: field(raw, "scrapMinutes", "\u8BA1\u5212\u4EFB\u52A1", asInt, 0),
    notes: field(raw, "notes", "\u8BA1\u5212\u4EFB\u52A1", asStr, ""),
    projectId: field(
      raw,
      "projectId",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asOpt(v, "projectId", asStr),
      null
    ),
    dueDate: field(
      raw,
      "dueDate",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asOpt(v, "dueDate", asStr),
      null
    ),
    reminderTime: field(
      raw,
      "reminderTime",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asOpt(v, "reminderTime", asStr),
      null
    ),
    focusMinutes: field(
      raw,
      "focusMinutes",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
      null
    ),
    priority: field(raw, "priority", "\u8BA1\u5212\u4EFB\u52A1", asInt, 0),
    estimate: field(raw, "estimate", "\u8BA1\u5212\u4EFB\u52A1", asInt, 1),
    tags: field(
      raw,
      "tags",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asArray(v, "tags").map((t) => asStr(t, "\u6807\u7B7E")),
      []
    ),
    subtasks: field(
      raw,
      "subtasks",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => asArray(v, "subtasks").map(parsePlanSubtask),
      []
    ),
    repeat: field(
      raw,
      "repeat",
      "\u8BA1\u5212\u4EFB\u52A1",
      (v) => oneOf(v, "repeat", ["none", "daily", "weekdays", "weekly"]),
      "none"
    )
  };
}
function serializePlanFile(plan) {
  const out = {
    format: plan.format,
    version: plan.version,
    pomodoroMinutes: plan.pomodoroMinutes,
    projects: plan.projects.map((p) => {
      const o = {
        id: p.id,
        name: p.name,
        color: p.color
      };
      if (p.appWhitelist !== null) o["appWhitelist"] = p.appWhitelist;
      return o;
    }),
    tasks: plan.tasks.map((t) => {
      const o = {
        id: t.id,
        title: t.title,
        templateId: t.templateId,
        habitId: t.habitId,
        recurring: t.recurring,
        scrapMinutes: t.scrapMinutes,
        notes: t.notes,
        projectId: t.projectId,
        dueDate: t.dueDate,
        priority: t.priority,
        estimate: t.estimate,
        tags: t.tags,
        subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title })),
        repeat: t.repeat
      };
      if (t.reminderTime !== null) o["reminderTime"] = t.reminderTime;
      if (t.focusMinutes !== null) o["focusMinutes"] = t.focusMinutes;
      return o;
    }),
    blocks: plan.blocks.map(serializeBlock),
    templates: plan.templates.map(serializeTemplate),
    prints: plan.prints.map(serializePrintRecord),
    habits: plan.habits.map(serializeHabit)
  };
  if (plan.replace) out["replace"] = true;
  return out;
}
function planTaskToTask(t, at, estimate) {
  return {
    id: t.id,
    templateId: t.templateId,
    recurring: t.recurring || t.repeat !== "none",
    title: t.title,
    notes: t.notes,
    projectId: t.projectId,
    habitId: t.habitId,
    dueDate: t.dueDate,
    reminderTime: t.reminderTime,
    focusMinutes: t.focusMinutes,
    reminderFired: false,
    reminderPending: false,
    reminderExpired: false,
    scrapMinutes: t.scrapMinutes,
    priority: t.priority,
    estimate,
    completed: false,
    completedAt: null,
    createdAt: at,
    tags: [...t.tags],
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      done: false
    }))
  };
}
function planTaskMerge(t, old, at, estimate) {
  const task = planTaskToTask(t, at, estimate);
  task.createdAt = old.createdAt;
  task.completed = old.completed;
  task.completedAt = old.completedAt;
  if (old.dueDate === t.dueDate && old.reminderTime === t.reminderTime) {
    task.reminderFired = old.reminderFired;
    task.reminderPending = old.reminderPending;
    task.reminderExpired = old.reminderExpired;
  }
  for (const sub of task.subtasks) {
    const prev = old.subtasks.find((s) => s.id === sub.id);
    if (prev !== void 0) sub.done = prev.done;
  }
  return task;
}
function validatePlanFile(plan) {
  if (plan.format !== "tomato-todo-plan" || plan.version !== 6) {
    throw new AppError("\u4EC5\u652F\u6301\u8BA1\u5212 v6\uFF1B\u65E7\u8BA1\u5212\u8BF7\u6309\u65B0\u683C\u5F0F\u91CD\u65B0\u5BFC\u51FA");
  }
  if (plan.tasks.some((t) => t.repeat !== "none")) {
    throw new AppError("\u5B9E\u4F8B\u4E0D\u62E5\u6709\u91CD\u590D\u89C4\u5219\uFF0C\u8BF7\u4F7F\u7528\u5468\u671F\u6A21\u677F");
  }
  if (plan.pomodoroMinutes < 1 || plan.pomodoroMinutes > 180) {
    throw new AppError("\u8BA1\u5212\u7684\u756A\u8304\u65F6\u957F\u9700\u4E3A 1\u2013180 \u5206\u949F");
  }
  const data = new AppData({
    projects: plan.projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      appWhitelist: p.appWhitelist === null ? null : [...p.appWhitelist]
    })),
    tasks: plan.tasks.map((t) => planTaskToTask(t, 0, t.estimate)),
    blocks: plan.blocks.map((b) => ({ ...b, days: [...b.days] })),
    templates: plan.templates,
    prints: plan.prints,
    habits: plan.habits
  });
  data.validate();
}
function planEstimate(t, pomodoro, focus) {
  const estimate = t.focusMinutes !== null ? t.estimate : Math.ceil(t.estimate * pomodoro / focus);
  if (estimate > 99) {
    throw new AppError(`\u4EFB\u52A1\u201C${t.title}\u201D\u6362\u7B97\u540E\u8D85\u8FC7 99 \u4E2A\u756A\u8304\uFF0C\u8BF7\u5148\u62C6\u5206\u4EFB\u52A1`);
  }
  return estimate;
}
function convertedEstimate(estimate, focus, source, destination) {
  const converted = focus !== null ? estimate : Math.ceil(estimate * source / destination);
  if (converted > 99) {
    throw new AppError("\u6362\u7B97\u540E\u8D85\u8FC7 99 \u4E2A\u756A\u8304\uFF0C\u8BF7\u5148\u62C6\u5206\u6A21\u677F");
  }
  return converted;
}
function mergePlan(plan, data, at) {
  validatePlanFile(plan);
  const next = clone(data);
  for (const planProject of plan.projects) {
    const existing = next.projects.find((p) => p.id === planProject.id);
    if (existing !== void 0) {
      existing.name = planProject.name;
      existing.color = planProject.color;
      if (planProject.appWhitelist !== null) {
        existing.appWhitelist = [...planProject.appWhitelist];
      }
    } else {
      next.projects.push({
        id: planProject.id,
        name: planProject.name,
        color: planProject.color,
        appWhitelist: planProject.appWhitelist === null ? null : [...planProject.appWhitelist]
      });
    }
  }
  for (const habit of plan.habits) {
    const existing = next.habits.find((h) => h.id === habit.id);
    if (existing !== void 0) {
      existing.name = habit.name;
    } else {
      next.habits.push({ id: habit.id, name: habit.name });
    }
  }
  for (const block of plan.blocks) {
    const existing = next.blocks.find((b) => b.id === block.id);
    if (existing !== void 0) {
      next.blocks[next.blocks.indexOf(existing)] = {
        ...block,
        days: [...block.days]
      };
    } else {
      next.blocks.push({ ...block, days: [...block.days] });
    }
  }
  for (const planTemplate of plan.templates) {
    const template = clone(planTemplate);
    template.shape.estimate = convertedEstimate(
      template.shape.estimate,
      template.shape.focusMinutes,
      plan.pomodoroMinutes,
      data.settings.focusMinutes
    );
    const existing = next.templates.find((t) => t.id === template.id);
    if (existing !== void 0) {
      next.templates[next.templates.indexOf(existing)] = template;
    } else {
      next.templates.push(template);
    }
  }
  for (const print of plan.prints) {
    if (!next.prints.some(
      (p) => p.templateId === print.templateId && p.date === print.date
    )) {
      next.prints.push({ templateId: print.templateId, date: print.date });
    }
  }
  const incoming = /* @__PURE__ */ new Map();
  for (const t of plan.tasks) incoming.set(t.id, t);
  for (let i = 0; i < next.tasks.length; i += 1) {
    const task = next.tasks[i];
    const planTask = incoming.get(task.id);
    if (planTask === void 0) continue;
    if (data.teachingTask(task.id) !== void 0) {
      throw new AppError("\u8BA1\u5212\u6587\u4EF6\u4E0D\u80FD\u6539\u5199\u6559\u5B66\u5F85\u529E\uFF0C\u8BF7\u8C03\u6574\u5BF9\u5E94\u8BFE\u7A0B\u6216\u4F5C\u4E1A");
    }
    const estimate = planEstimate(
      planTask,
      plan.pomodoroMinutes,
      data.settings.focusMinutes
    );
    const old = clone(task);
    next.tasks[i] = planTaskMerge(planTask, old, at, estimate);
  }
  const localIds = new Set(next.tasks.map((t) => t.id));
  for (const planTask of plan.tasks) {
    if (localIds.has(planTask.id)) continue;
    const estimate = planEstimate(
      planTask,
      plan.pomodoroMinutes,
      data.settings.focusMinutes
    );
    const instance = planTaskToTask(planTask, at, estimate);
    if (instance.templateId !== null) {
      if (!next.prints.some(
        (p) => p.templateId === instance.templateId && p.date === instance.dueDate
      )) {
        next.prints.push({
          templateId: instance.templateId,
          date: instance.dueDate
        });
      }
    }
    next.tasks.push(instance);
  }
  if (plan.replace) {
    const plannedTasks = new Set(plan.tasks.map((t) => t.id));
    next.tasks = next.tasks.filter(
      (t) => t.completed || plannedTasks.has(t.id) || data.teachingTask(t.id) !== void 0
    );
    const plannedHabits = new Set(plan.habits.map((h) => h.id));
    const removedHabits = next.habits.filter((h) => !plannedHabits.has(h.id)).map((h) => h.id);
    if (removedHabits.length > 0) {
      next.habits = next.habits.filter((h) => !removedHabits.includes(h.id));
      for (const task of next.tasks) {
        if (task.habitId !== null && removedHabits.includes(task.habitId))
          task.habitId = null;
      }
      for (const template of next.templates) {
        if (template.shape.habitId !== null && removedHabits.includes(template.shape.habitId)) {
          template.shape.habitId = null;
        }
      }
    }
    const plannedTemplates = new Set(plan.templates.map((t) => t.id));
    const removedTemplates = next.templates.filter((t) => !plannedTemplates.has(t.id)).map((t) => t.id);
    for (const id2 of removedTemplates) {
      deleteTemplate(next, id2);
    }
    const plannedBlocks = new Set(plan.blocks.map((b) => b.id));
    next.blocks = next.blocks.filter((b) => plannedBlocks.has(b.id));
  }
  next.validate();
  replaceAppData(data, next);
}
function exportPlan(data) {
  const tasks = data.tasks.filter((t) => !t.completed && data.teachingTask(t.id) === void 0).map((t) => ({
    templateId: t.templateId,
    habitId: t.habitId,
    recurring: t.recurring,
    scrapMinutes: t.scrapMinutes,
    id: t.id,
    title: t.title,
    notes: t.notes,
    projectId: t.projectId,
    dueDate: t.dueDate,
    reminderTime: t.reminderTime,
    focusMinutes: t.focusMinutes,
    priority: t.priority,
    estimate: t.estimate,
    tags: [...t.tags],
    repeat: "none",
    subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title }))
  }));
  const used = /* @__PURE__ */ new Set([
    ...tasks.filter((t) => t.projectId !== null).map((t) => t.projectId),
    ...data.templates.filter((t) => t.shape.projectId !== null).map((t) => t.shape.projectId)
  ]);
  return {
    format: "tomato-todo-plan",
    version: 6,
    replace: false,
    blocks: data.blocks.map((b) => ({ ...b, days: [...b.days] })),
    templates: data.templates.map((t) => clone(t)),
    prints: data.prints.map((p) => ({ ...p })),
    habits: data.habits.map((h) => ({ ...h })),
    pomodoroMinutes: data.settings.focusMinutes,
    projects: data.projects.filter((p) => used.has(p.id)).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      appWhitelist: p.appWhitelist === null ? null : [...p.appWhitelist]
    })),
    tasks
  };
}

// packages/core/src/lib.ts
function parseProject(raw) {
  if (!isObject(raw)) throw new AppError("\u9879\u76EE\u5FC5\u987B\u662F\u5BF9\u8C61");
  return {
    id: requiredField(raw, "id", "\u9879\u76EE", asStr),
    name: requiredField(raw, "name", "\u9879\u76EE", asStr),
    color: requiredField(raw, "color", "\u9879\u76EE", asStr),
    appWhitelist: field(
      raw,
      "appWhitelist",
      "\u9879\u76EE",
      (v) => asOpt(
        v,
        "appWhitelist",
        (x) => asArray(x, "appWhitelist").map((a) => asStr(a, "\u5E94\u7528 ID"))
      ),
      null
    )
  };
}
function serializeProject(p) {
  const out = {
    id: p.id,
    name: p.name,
    color: p.color
  };
  if (p.appWhitelist !== null) out["appWhitelist"] = p.appWhitelist;
  return out;
}
function parseVision(raw) {
  if (!isObject(raw)) throw new AppError("\u613F\u666F\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, ["id", "name", "notes", "projectId"], "\u613F\u666F");
  return {
    id: requiredField(raw, "id", "\u613F\u666F", asStr),
    name: requiredField(raw, "name", "\u613F\u666F", asStr),
    notes: field(raw, "notes", "\u613F\u666F", asStr, ""),
    projectId: field(
      raw,
      "projectId",
      "\u613F\u666F",
      (v) => asOpt(v, "projectId", asStr),
      null
    )
  };
}
function serializeVision(v) {
  const out = {
    id: v.id,
    name: v.name,
    notes: v.notes
  };
  if (v.projectId !== null) out["projectId"] = v.projectId;
  return out;
}
function parseSubtask(raw) {
  if (!isObject(raw)) throw new AppError("\u5B50\u4EFB\u52A1\u5FC5\u987B\u662F\u5BF9\u8C61");
  return {
    id: requiredField(raw, "id", "\u5B50\u4EFB\u52A1", asStr),
    title: requiredField(raw, "title", "\u5B50\u4EFB\u52A1", asStr),
    done: requiredField(raw, "done", "\u5B50\u4EFB\u52A1", asBool)
  };
}
function serializeSubtask(s) {
  return { id: s.id, title: s.title, done: s.done };
}
var TASK_KEYS = [
  "id",
  "templateId",
  "recurring",
  "title",
  "notes",
  "projectId",
  "habitId",
  "dueDate",
  "reminderTime",
  "focusMinutes",
  "scrapMinutes",
  "priority",
  "estimate",
  "reminderFired",
  "reminderPending",
  "reminderExpired",
  "completed",
  "completedAt",
  "createdAt",
  "tags",
  "subtasks"
];
function parseTask(raw) {
  if (!isObject(raw)) throw new AppError("\u4EFB\u52A1\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...TASK_KEYS], "\u4EFB\u52A1");
  return {
    id: requiredField(raw, "id", "\u4EFB\u52A1", asStr),
    templateId: field(
      raw,
      "templateId",
      "\u4EFB\u52A1",
      (v) => asOpt(v, "templateId", asStr),
      null
    ),
    recurring: field(raw, "recurring", "\u4EFB\u52A1", asBool, false),
    title: requiredField(raw, "title", "\u4EFB\u52A1", asStr),
    notes: requiredField(raw, "notes", "\u4EFB\u52A1", asStr),
    projectId: field(
      raw,
      "projectId",
      "\u4EFB\u52A1",
      (v) => asOpt(v, "projectId", asStr),
      null
    ),
    habitId: field(
      raw,
      "habitId",
      "\u4EFB\u52A1",
      (v) => asOpt(v, "habitId", asStr),
      null
    ),
    dueDate: field(
      raw,
      "dueDate",
      "\u4EFB\u52A1",
      (v) => asOpt(v, "dueDate", asStr),
      null
    ),
    reminderTime: field(
      raw,
      "reminderTime",
      "\u4EFB\u52A1",
      (v) => asOpt(v, "reminderTime", asStr),
      null
    ),
    focusMinutes: field(
      raw,
      "focusMinutes",
      "\u4EFB\u52A1",
      (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
      null
    ),
    scrapMinutes: field(raw, "scrapMinutes", "\u4EFB\u52A1", asInt, 0),
    priority: requiredField(raw, "priority", "\u4EFB\u52A1", asInt),
    estimate: requiredField(raw, "estimate", "\u4EFB\u52A1", asInt),
    reminderFired: field(raw, "reminderFired", "\u4EFB\u52A1", asBool, false),
    reminderPending: field(raw, "reminderPending", "\u4EFB\u52A1", asBool, false),
    reminderExpired: field(raw, "reminderExpired", "\u4EFB\u52A1", asBool, false),
    completed: requiredField(raw, "completed", "\u4EFB\u52A1", asBool),
    completedAt: field(
      raw,
      "completedAt",
      "\u4EFB\u52A1",
      (v) => asOpt(v, "completedAt", asInt),
      null
    ),
    createdAt: requiredField(raw, "createdAt", "\u4EFB\u52A1", asInt),
    tags: field(
      raw,
      "tags",
      "\u4EFB\u52A1",
      (v) => asArray(v, "tags").map((t) => asStr(t, "\u6807\u7B7E")),
      []
    ),
    subtasks: field(
      raw,
      "subtasks",
      "\u4EFB\u52A1",
      (v) => asArray(v, "subtasks").map(parseSubtask),
      []
    )
  };
}
function serializeTask(t) {
  return {
    id: t.id,
    templateId: t.templateId,
    recurring: t.recurring,
    title: t.title,
    notes: t.notes,
    projectId: t.projectId,
    habitId: t.habitId,
    dueDate: t.dueDate,
    reminderTime: t.reminderTime,
    focusMinutes: t.focusMinutes,
    scrapMinutes: t.scrapMinutes,
    priority: t.priority,
    estimate: t.estimate,
    reminderFired: t.reminderFired,
    reminderPending: t.reminderPending,
    reminderExpired: t.reminderExpired,
    completed: t.completed,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    tags: t.tags,
    subtasks: t.subtasks.map(serializeSubtask)
  };
}
var TASK_DRAFT_KEYS = [
  "id",
  "title",
  "notes",
  "projectId",
  "dueDate",
  "reminderTime",
  "focusMinutes",
  "scrapMinutes",
  "priority",
  "estimate",
  "tags",
  "subtasks",
  "repeat"
];
function parseTaskDraft(raw) {
  if (!isObject(raw)) throw new AppError("\u4EFB\u52A1\u8349\u7A3F\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(raw, [...TASK_DRAFT_KEYS], "\u4EFB\u52A1\u8349\u7A3F");
  return {
    id: field(raw, "id", "\u4EFB\u52A1\u8349\u7A3F", (v) => asOpt(v, "id", asStr), null),
    title: requiredField(raw, "title", "\u4EFB\u52A1\u8349\u7A3F", asStr),
    notes: field(raw, "notes", "\u4EFB\u52A1\u8349\u7A3F", asStr, ""),
    projectId: field(
      raw,
      "projectId",
      "\u4EFB\u52A1\u8349\u7A3F",
      (v) => asOpt(v, "projectId", asStr),
      null
    ),
    dueDate: field(
      raw,
      "dueDate",
      "\u4EFB\u52A1\u8349\u7A3F",
      (v) => asOpt(v, "dueDate", asStr),
      null
    ),
    reminderTime: field(
      raw,
      "reminderTime",
      "\u4EFB\u52A1\u8349\u7A3F",
      (v) => asOpt(v, "reminderTime", asStr),
      null
    ),
    focusMinutes: field(
      raw,
      "focusMinutes",
      "\u4EFB\u52A1\u8349\u7A3F",
      (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
      null
    ),
    scrapMinutes: field(raw, "scrapMinutes", "\u4EFB\u52A1\u8349\u7A3F", asInt, 0),
    priority: field(raw, "priority", "\u4EFB\u52A1\u8349\u7A3F", asInt, 0),
    estimate: field(raw, "estimate", "\u4EFB\u52A1\u8349\u7A3F", asInt, 1),
    tags: field(
      raw,
      "tags",
      "\u4EFB\u52A1\u8349\u7A3F",
      (v) => asArray(v, "tags").map((t) => asStr(t, "\u6807\u7B7E")),
      []
    ),
    subtasks: field(
      raw,
      "subtasks",
      "\u4EFB\u52A1\u8349\u7A3F",
      (v) => asArray(v, "subtasks").map(parseSubtask),
      []
    ),
    repeat: field(
      raw,
      "repeat",
      "\u4EFB\u52A1\u8349\u7A3F",
      (v) => oneOf(v, "repeat", ["none", "daily", "weekdays", "weekly"]),
      "none"
    )
  };
}
function parseHabitSlot(raw) {
  if (!isObject(raw)) throw new AppError("\u4E60\u60EF\u65F6\u6BB5\u5FC5\u987B\u662F\u5BF9\u8C61");
  return {
    days: asArray(
      requiredField(raw, "days", "\u4E60\u60EF\u65F6\u6BB5", (v) => v),
      "days"
    ).map((d) => asInt(d, "\u4E60\u60EF\u661F\u671F")),
    time: requiredField(raw, "time", "\u4E60\u60EF\u65F6\u6BB5", asStr)
  };
}
function parseProtection(raw) {
  if (!isObject(raw)) throw new AppError("\u4FDD\u62A4\u8BBE\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61");
  return {
    mode: field(
      raw,
      "mode",
      "\u4FDD\u62A4\u8BBE\u7F6E",
      (v) => oneOf(v, "\u4FDD\u62A4 mode", ["off", "lock", "whitelist"]),
      "off"
    ),
    whitelist: field(
      raw,
      "whitelist",
      "\u4FDD\u62A4\u8BBE\u7F6E",
      (v) => asArray(v, "whitelist").map((a) => asStr(a, "\u5E94\u7528 ID")),
      []
    ),
    strict: field(raw, "strict", "\u4FDD\u62A4\u8BBE\u7F6E", asBool, false)
  };
}
function serializeProtection(p) {
  return { mode: p.mode, whitelist: p.whitelist, strict: p.strict };
}
function parseSettings(raw) {
  if (!isObject(raw)) throw new AppError("\u8BBE\u7F6E\u5FC5\u987B\u662F\u5BF9\u8C61");
  return {
    focusMinutes: requiredField(raw, "focusMinutes", "\u8BBE\u7F6E", asInt),
    shortBreakMinutes: requiredField(raw, "shortBreakMinutes", "\u8BBE\u7F6E", asInt),
    longBreakMinutes: requiredField(raw, "longBreakMinutes", "\u8BBE\u7F6E", asInt),
    longBreakEvery: requiredField(raw, "longBreakEvery", "\u8BBE\u7F6E", asInt),
    dailyGoal: requiredField(raw, "dailyGoal", "\u8BBE\u7F6E", asInt),
    autoBreak: requiredField(raw, "autoBreak", "\u8BBE\u7F6E", asBool),
    autoFocus: requiredField(raw, "autoFocus", "\u8BBE\u7F6E", asBool),
    autoStartTasks: field(raw, "autoStartTasks", "\u8BBE\u7F6E", asBool, false),
    sound: requiredField(raw, "sound", "\u8BBE\u7F6E", asBool),
    soundVolume: field(raw, "soundVolume", "\u8BBE\u7F6E", asInt, 100),
    notifications: requiredField(raw, "notifications", "\u8BBE\u7F6E", asBool),
    alwaysOnTop: requiredField(raw, "alwaysOnTop", "\u8BBE\u7F6E", asBool),
    theme: requiredField(raw, "theme", "\u8BBE\u7F6E", asStr),
    personaBackdrop: field(raw, "personaBackdrop", "\u8BBE\u7F6E", asBool, false),
    protection: field(raw, "protection", "\u8BBE\u7F6E", parseProtection, {
      mode: "off",
      whitelist: [],
      strict: false
    })
  };
}
function serializeSettings(s) {
  return {
    focusMinutes: s.focusMinutes,
    shortBreakMinutes: s.shortBreakMinutes,
    longBreakMinutes: s.longBreakMinutes,
    longBreakEvery: s.longBreakEvery,
    dailyGoal: s.dailyGoal,
    autoBreak: s.autoBreak,
    autoFocus: s.autoFocus,
    autoStartTasks: s.autoStartTasks,
    sound: s.sound,
    soundVolume: s.soundVolume,
    notifications: s.notifications,
    alwaysOnTop: s.alwaysOnTop,
    theme: s.theme,
    personaBackdrop: s.personaBackdrop,
    protection: serializeProtection(s.protection)
  };
}
function defaultSettings() {
  return {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    dailyGoal: 8,
    autoBreak: false,
    autoFocus: false,
    autoStartTasks: false,
    sound: true,
    soundVolume: 100,
    notifications: true,
    alwaysOnTop: false,
    theme: "light",
    personaBackdrop: false,
    protection: { mode: "off", whitelist: [], strict: false }
  };
}
function parseTimer(raw) {
  if (!isObject(raw)) throw new AppError("\u8BA1\u65F6\u5668\u5FC5\u987B\u662F\u5BF9\u8C61");
  return {
    mode: oneOf(
      requiredField(raw, "mode", "\u8BA1\u65F6\u5668", (v) => v),
      "\u8BA1\u65F6\u5668 mode",
      ["focus", "shortBreak", "longBreak"]
    ),
    running: requiredField(raw, "running", "\u8BA1\u65F6\u5668", asBool),
    taskId: field(
      raw,
      "taskId",
      "\u8BA1\u65F6\u5668",
      (v) => asOpt(v, "taskId", asStr),
      null
    ),
    durationSecs: requiredField(raw, "durationSecs", "\u8BA1\u65F6\u5668", asInt),
    remainingSecs: requiredField(raw, "remainingSecs", "\u8BA1\u65F6\u5668", asInt),
    deadline: field(
      raw,
      "deadline",
      "\u8BA1\u65F6\u5668",
      (v) => asOpt(v, "deadline", asInt),
      null
    ),
    startedAt: field(
      raw,
      "startedAt",
      "\u8BA1\u65F6\u5668",
      (v) => asOpt(v, "startedAt", asInt),
      null
    ),
    cycle: requiredField(raw, "cycle", "\u8BA1\u65F6\u5668", asInt),
    cycleDate: field(
      raw,
      "cycleDate",
      "\u8BA1\u65F6\u5668",
      (v) => asOpt(v, "cycleDate", asStr),
      null
    ),
    completionSerial: requiredField(raw, "completionSerial", "\u8BA1\u65F6\u5668", asInt),
    lastFinishedMode: field(
      raw,
      "lastFinishedMode",
      "\u8BA1\u65F6\u5668",
      (v) => asOpt(
        v,
        "lastFinishedMode",
        (x) => oneOf(x, "lastFinishedMode", ["focus", "shortBreak", "longBreak"])
      ),
      null
    ),
    autoFocusBlocked: field(raw, "autoFocusBlocked", "\u8BA1\u65F6\u5668", asBool, false)
  };
}
function serializeTimer(t) {
  return {
    mode: t.mode,
    running: t.running,
    taskId: t.taskId,
    durationSecs: t.durationSecs,
    remainingSecs: t.remainingSecs,
    deadline: t.deadline,
    startedAt: t.startedAt,
    cycle: t.cycle,
    cycleDate: t.cycleDate,
    completionSerial: t.completionSerial,
    lastFinishedMode: t.lastFinishedMode,
    autoFocusBlocked: t.autoFocusBlocked
  };
}
function defaultTimer() {
  return {
    mode: "focus",
    running: false,
    taskId: null,
    durationSecs: 1500,
    remainingSecs: 1500,
    deadline: null,
    startedAt: null,
    cycle: 0,
    cycleDate: null,
    completionSerial: 0,
    lastFinishedMode: null,
    autoFocusBlocked: false
  };
}
function parseSession(raw) {
  if (!isObject(raw)) throw new AppError("\u4E13\u6CE8\u8BB0\u5F55\u5FC5\u987B\u662F\u5BF9\u8C61");
  return {
    id: requiredField(raw, "id", "\u4E13\u6CE8\u8BB0\u5F55", asStr),
    source: field(
      raw,
      "source",
      "\u4E13\u6CE8\u8BB0\u5F55",
      (v) => oneOf(v, "source", ["timer", "taskEstimate"]),
      "timer"
    ),
    taskId: field(
      raw,
      "taskId",
      "\u4E13\u6CE8\u8BB0\u5F55",
      (v) => asOpt(v, "taskId", asStr),
      null
    ),
    taskTitle: requiredField(raw, "taskTitle", "\u4E13\u6CE8\u8BB0\u5F55", asStr),
    projectName: requiredField(raw, "projectName", "\u4E13\u6CE8\u8BB0\u5F55", asStr),
    startedAt: requiredField(raw, "startedAt", "\u4E13\u6CE8\u8BB0\u5F55", asInt),
    endedAt: requiredField(raw, "endedAt", "\u4E13\u6CE8\u8BB0\u5F55", asInt),
    durationSecs: requiredField(raw, "durationSecs", "\u4E13\u6CE8\u8BB0\u5F55", asInt),
    completed: requiredField(raw, "completed", "\u4E13\u6CE8\u8BB0\u5F55", asBool)
  };
}
function serializeSession(s) {
  return {
    id: s.id,
    source: s.source,
    taskId: s.taskId,
    taskTitle: s.taskTitle,
    projectName: s.projectName,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationSecs: s.durationSecs,
    completed: s.completed
  };
}
var AppData = class {
  education;
  version;
  identities;
  tasks;
  blocks;
  templates;
  prints;
  projects;
  habits;
  visions;
  settings;
  timer;
  sessions;
  lock;
  constructor(init) {
    this.education = init?.education ?? new Education();
    this.version = init?.version ?? 4;
    this.identities = init?.identities ?? [];
    this.tasks = init?.tasks ?? [];
    this.blocks = init?.blocks ?? [];
    this.templates = init?.templates ?? [];
    this.prints = init?.prints ?? [];
    this.projects = init?.projects ?? [
      { id: id(), name: "\u5DE5\u4F5C", color: "#df7561", appWhitelist: null },
      { id: id(), name: "\u5B66\u4E60", color: "#849b7d", appWhitelist: null },
      { id: id(), name: "\u751F\u6D3B", color: "#d5a553", appWhitelist: null }
    ];
    this.habits = init?.habits ?? [];
    this.visions = init?.visions ?? [];
    this.settings = init?.settings ?? defaultSettings();
    this.timer = init?.timer ?? defaultTimer();
    this.sessions = init?.sessions ?? [];
    this.lock = init?.lock ?? {
      schedules: [],
      active: null,
      suppressedUntil: 0
    };
  }
  protected() {
    return this.lock.active !== null || this.timer.running && this.timer.mode === "focus" && this.settings.protection.mode !== "off";
  }
  /** 白名单专注时生效的应用清单：项目专属清单替代通用清单。 */
  effectiveWhitelist() {
    const project = (() => {
      const taskId = this.timer.taskId;
      if (taskId === null) return void 0;
      const task = this.tasks.find((t) => t.id === taskId);
      if (task === void 0 || task.projectId === null) return void 0;
      return this.projects.find((p) => p.id === task.projectId);
    })();
    const list = project?.appWhitelist;
    return list !== null && list !== void 0 ? [...list] : [...this.settings.protection.whitelist];
  }
  taskIsVoid(task) {
    return taskIsVoid(task);
  }
  strictProtected() {
    return this.lock.active !== null && this.lock.active.strict || this.timer.running && this.timer.mode === "focus" && this.settings.protection.mode !== "off" && this.settings.protection.strict;
  }
  durationOf(mode) {
    return durationOf(this, mode);
  }
  taskHasRoundsLeft(task) {
    return taskHasRoundsLeft(this, task);
  }
  resetTo(mode) {
    resetTo(this, mode);
  }
  start(at) {
    startTimer(this, at);
  }
  record(at, completed) {
    recordSession(this, at, completed);
  }
  refreshCycle(at) {
    const date = dateAt(at);
    if (this.timer.cycleDate === date) return false;
    this.timer.cycle = this.sessions.filter(
      (s) => s.completed && dateAt(s.endedAt) === date
    ).length;
    this.timer.cycleDate = date;
    return true;
  }
  /** 停机后最多推进一个阶段：绝不伪造无人值守的专注会话。 */
  tick(at) {
    const teachingChanged = this.education.tick(at);
    const teachingTasksChanged = materializeTeachingTasks(this, at);
    const materialized = materializeTemplates(this, at) || teachingChanged || teachingTasksChanged;
    const remindersChanged = tickReminders(this, at);
    const changed = this.tickWithLock(at) || materialized;
    const cycleChanged = this.refreshCycle(at);
    if (cycleChanged && this.timer.cycle === 0 && this.timer.mode !== "focus" && !this.timer.running && this.timer.startedAt === null && this.timer.remainingSecs === this.timer.durationSecs) {
      this.resetTo("focus");
    }
    return startDueTask(this, at) || remindersChanged || changed || cycleChanged;
  }
  tickWithLock(at) {
    const previous = JSON.stringify(serializeLockState(this.lock));
    if (this.lock.active !== null && at >= this.lock.active.endsAt) {
      this.lock.active = null;
    }
    const scheduled = scheduledAt(this.lock, at);
    if (scheduled !== null) {
      if (this.lock.active !== null) {
        scheduled.startedAt = Math.min(
          this.lock.active.startedAt,
          scheduled.startedAt
        );
        scheduled.endsAt = Math.max(this.lock.active.endsAt, scheduled.endsAt);
        scheduled.strict = scheduled.strict || this.lock.active.strict;
      }
      this.lock.active = scheduled;
    }
    const changed = previous !== JSON.stringify(serializeLockState(this.lock));
    if (this.lock.active !== null) {
      const start = this.lock.active.startedAt;
      if (this.timer.running) {
        const stop = Math.min(
          Math.max(start, this.timer.startedAt ?? start),
          at
        );
        this.tickTimer(stop);
        this.record(stop, false);
        this.resetTo("focus");
        return true;
      }
      return changed;
    }
    return this.tickTimer(at) || changed;
  }
  tickTimer(at) {
    if (!this.timer.running || timerRemaining(this.timer, at) > 0) {
      return false;
    }
    const end = this.timer.deadline ?? at;
    this.finishTimer(end, at);
    return true;
  }
  finishTimer(end, at) {
    const finished = this.timer.mode;
    const continuationBlocked = this.timer.autoFocusBlocked;
    if (finished === "focus") {
      this.refreshCycle(end);
    }
    this.record(end, true);
    if (finished === "focus") {
      this.timer.cycle = Math.min(this.timer.cycle + 1, 4294967295);
    }
    const next = finished === "focus" ? this.timer.cycle % this.settings.longBreakEvery === 0 ? "longBreak" : "shortBreak" : "focus";
    this.resetTo(next);
    this.timer.completionSerial = Math.min(
      this.timer.completionSerial + 1,
      Number.MAX_SAFE_INTEGER
    );
    this.timer.lastFinishedMode = finished;
    const auto = next === "focus" ? this.settings.autoFocus && !continuationBlocked && (this.timer.taskId === null || (() => {
      const task = this.tasks.find((t) => t.id === this.timer.taskId);
      return task !== void 0 && this.taskHasRoundsLeft(task);
    })()) && !(this.settings.autoStartTasks && dueAutoTask(this) !== null) : this.settings.autoBreak;
    if (auto && at - end < 5) {
      this.start(at);
    }
  }
  /** 预检 + 执行 + 教学待办生成 + 全量校验。 */
  apply(action, at) {
    this.tick(at);
    if (this.strictProtected()) {
      throw new AppError("\u4E25\u683C\u6A21\u5F0F\u751F\u6548\u4E2D\uFF0C\u4E0D\u80FD\u63D0\u524D\u7ED3\u675F\u6216\u4FEE\u6539\uFF1B\u5230\u65F6\u81EA\u52A8\u89E3\u9664");
    }
    if (this.protected() && action.type !== "emergencyUnlock" && action.type !== "completeFocus") {
      throw new AppError(
        "\u4E13\u6CE8\u4FDD\u62A4\u4E2D\uFF0C\u7ED3\u675F\u524D\u4E0D\u80FD\u4FEE\u6539\u4EFB\u52A1\u6216\u8BA1\u65F6\uFF1B\u53EF\u63D0\u524D\u5B8C\u6210\u756A\u8304\u6216\u7D27\u6025\u9000\u51FA"
      );
    }
    switch (action.type) {
      case "education": {
        if (action.command.op === "startExam" && (!this.reminderIdle() || this.timer.mode !== "focus" || this.timer.remainingSecs !== this.timer.durationSecs)) {
          throw new AppError("\u8BF7\u5148\u7ED3\u675F\u5F53\u524D\u8BA1\u65F6\u6216\u9501\u673A\uFF0C\u518D\u5F00\u59CB\u8003\u8BD5");
        }
        this.education.apply(action.command, at);
        break;
      }
      case "printInstances":
        printInstances(this, action.shape, action.printing, at);
        break;
      case "saveTemplate": {
        const id2 = action.template.id;
        saveTemplate(this, action.template);
        this.validate();
        if (action.printDates.length > 0) {
          printTemplate(this, id2, action.printDates, at);
        }
        break;
      }
      case "deleteTemplate":
        deleteTemplate(this, action.id);
        break;
      case "printTemplate":
        printTemplate(this, action.id, action.dates, at);
        break;
      case "syncTemplate":
        syncTemplate(this, action.id);
        break;
      case "startReminder": {
        if (!this.reminderIdle()) {
          throw new AppError("\u8BF7\u5148\u7ED3\u675F\u5F53\u524D\u8BA1\u65F6");
        }
        const t = this.tasks.find(
          (x) => x.id === action.id && !x.completed && x.reminderPending
        );
        if (t === void 0) {
          throw new AppError("\u63D0\u9192\u5DF2\u5931\u6548");
        }
        t.reminderPending = false;
        this.timer.taskId = action.id;
        this.resetTo("focus");
        startTeachingTask(this, at);
        this.start(at);
        break;
      }
      case "emergencyUnlock": {
        this.record(at, false);
        this.resetTo("focus");
        releaseLock(this.lock, at);
        break;
      }
      case "completeFocus": {
        if (this.lock.active !== null || this.timer.mode !== "focus" || this.timer.startedAt === null) {
          throw new AppError("\u5F53\u524D\u6CA1\u6709\u53EF\u63D0\u524D\u5B8C\u6210\u7684\u4E13\u6CE8");
        }
        if (timerRemaining(this.timer, at) === this.timer.durationSecs) {
          throw new AppError("\u5C1A\u65E0\u4E13\u6CE8\u7528\u65F6\uFF0C\u8BF7\u7A0D\u540E\u518D\u5B8C\u6210");
        }
        this.finishTimer(at, at);
        break;
      }
      case "saveLockSchedule": {
        const index = this.lock.schedules.findIndex(
          (s) => s.id === action.schedule.id
        );
        if (index >= 0) {
          this.lock.schedules[index] = action.schedule;
        } else {
          this.lock.schedules.push(action.schedule);
        }
        validateLock(this.lock);
        this.tick(at);
        break;
      }
      case "deleteLockSchedule":
        this.lock.schedules = this.lock.schedules.filter(
          (s) => s.id !== action.id
        );
        break;
      case "startQuickLock": {
        if (action.minutes < 1 || action.minutes > 720) {
          throw new AppError("\u5FEB\u901F\u9501\u673A\u65F6\u957F\u9700\u4E3A 1\u2013720 \u5206\u949F");
        }
        this.record(at, false);
        this.resetTo("focus");
        this.lock.active = {
          name: "\u5C0F\u61A9",
          startedAt: at,
          endsAt: at + action.minutes * 60,
          strict: action.strict
        };
        break;
      }
      case "saveTask": {
        const d = action.task;
        if (d.id !== null && teachingTask(this, d.id) !== void 0) {
          throw new AppError(
            "\u6559\u5B66\u5F85\u529E\u968F\u8BFE\u7A0B\u6216\u4F5C\u4E1A\u5B89\u6392\u66F4\u65B0\uFF0C\u8BF7\u8C03\u6574\u5BF9\u5E94\u6559\u5B66\u5B89\u6392"
          );
        }
        const existingIndex = d.id !== null ? this.tasks.findIndex((t) => t.id === d.id) : -1;
        if (d.id !== null && existingIndex < 0) {
          throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728\uFF0C\u53EF\u80FD\u5DF2\u7ECF\u88AB\u5220\u9664");
        }
        const old = existingIndex >= 0 ? this.tasks[existingIndex] : void 0;
        const task = {
          templateId: old?.templateId ?? null,
          recurring: old?.recurring ?? false,
          id: d.id ?? id(),
          title: d.title.trim(),
          notes: d.notes,
          projectId: d.projectId,
          habitId: old?.habitId ?? null,
          reminderFired: old !== void 0 && old.dueDate === d.dueDate && old.reminderTime === d.reminderTime && old.reminderFired,
          reminderPending: old !== void 0 && old.dueDate === d.dueDate && old.reminderTime === d.reminderTime && old.reminderPending,
          reminderExpired: old !== void 0 && old.dueDate === d.dueDate && old.reminderTime === d.reminderTime && old.reminderExpired,
          scrapMinutes: d.scrapMinutes,
          focusMinutes: d.focusMinutes,
          reminderTime: d.reminderTime,
          dueDate: d.dueDate,
          priority: d.priority,
          estimate: d.estimate,
          completed: old?.completed ?? false,
          completedAt: old?.completedAt ?? null,
          createdAt: old?.createdAt ?? at,
          tags: d.tags.map((t) => t.trim()).filter((t) => t.length > 0),
          subtasks: d.subtasks.map((s) => ({
            id: s.id,
            title: s.title,
            done: s.done
          }))
        };
        if (d.repeat !== "none") {
          const template = fromTask(task, d.repeat, at);
          task.templateId = template.id;
          task.recurring = true;
          this.prints.push({ templateId: template.id, date: task.dueDate });
          this.templates.push(template);
        }
        if (existingIndex >= 0) {
          this.tasks[existingIndex] = task;
        } else {
          this.tasks.push(task);
        }
        break;
      }
      case "toggleTask": {
        const taskId = action.id;
        if (this.tasks.some((t2) => t2.id === taskId && this.taskIsVoid(t2))) {
          throw new AppError("\u4F5C\u5E9F\u5B9E\u4F8B\u4E0D\u80FD\u5B8C\u6210");
        }
        const task = this.tasks.find((t2) => t2.id === taskId);
        ensure(task !== void 0, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
        const taskCopy = {
          ...task,
          tags: [...task.tags],
          subtasks: task.subtasks.map((s) => ({ ...s }))
        };
        if (teachingTask(this, taskId) !== void 0 && !taskCopy.completed) {
          completeTeachingTask(this, taskId, at);
        }
        if (!taskCopy.completed && this.timer.taskId === taskId) {
          const focusing = this.timer.mode === "focus";
          if (focusing) {
            this.record(at, false);
          }
          this.timer.taskId = null;
          if (focusing) {
            this.resetTo("focus");
          } else {
            this.timer.autoFocusBlocked = true;
          }
        }
        this.sessions = this.sessions.filter(
          (s) => !(s.source === "taskEstimate" && s.taskId === taskId)
        );
        if (!taskCopy.completed) {
          const actual = this.sessions.filter((s) => s.taskId === taskId).reduce((n, s) => n + s.durationSecs, 0);
          const expected = taskCopy.estimate * (taskCopy.focusMinutes ?? this.settings.focusMinutes) * 60;
          const missing = Math.max(0, expected - actual);
          if (missing > 0) {
            const project = taskCopy.projectId !== null ? this.projects.find((p) => p.id === taskCopy.projectId) : void 0;
            this.sessions.push({
              id: id(),
              source: "taskEstimate",
              taskId,
              taskTitle: taskCopy.title,
              projectName: project?.name ?? "\u672A\u5206\u7C7B",
              startedAt: at,
              endedAt: at,
              durationSecs: missing,
              completed: false
            });
          }
        }
        const t = this.tasks.find((x) => x.id === taskId);
        t.completed = !t.completed;
        t.completedAt = t.completed ? at : null;
        if (t.completed) {
          this.education.taskCompleted(t, at);
        }
        break;
      }
      case "deleteTask": {
        if (teachingTask(this, action.id) !== void 0) {
          throw new AppError("\u6559\u5B66\u5F85\u529E\u7531\u5BF9\u5E94\u8BFE\u7A0B\u6216\u4F5C\u4E1A\u7EF4\u62A4\uFF0C\u4E0D\u80FD\u5355\u72EC\u5220\u9664");
        }
        if (!this.tasks.some((t) => t.id === action.id)) {
          throw new AppError("\u4EFB\u52A1\u4E0D\u5B58\u5728");
        }
        if (this.timer.taskId === action.id) {
          this.record(at, false);
          this.resetTo(this.timer.mode);
          this.timer.taskId = null;
        }
        this.tasks = this.tasks.filter((t) => t.id !== action.id);
        break;
      }
      case "restoreTask": {
        const task = action.task;
        if (this.tasks.some((t) => t.id === task.id)) {
          throw new AppError("\u4EFB\u52A1\u5DF2\u7ECF\u5B58\u5728");
        }
        if (task.projectId !== null && !this.projects.some((p) => p.id === task.projectId)) {
          task.projectId = null;
        }
        if (task.templateId !== null && !this.templates.some((t) => t.id === task.templateId)) {
          task.templateId = null;
        }
        if (task.habitId !== null && !this.habits.some((h) => h.id === task.habitId)) {
          task.habitId = null;
        }
        this.tasks.push(task);
        break;
      }
      case "toggleSubtask": {
        const sub = this.tasks.find((t) => t.id === action.taskId)?.subtasks.find((s) => s.id === action.subtaskId);
        ensure(sub !== void 0, "\u5B50\u4EFB\u52A1\u4E0D\u5B58\u5728");
        sub.done = !sub.done;
        break;
      }
      case "saveProject": {
        if (action.id !== null) {
          const p = this.projects.find((x) => x.id === action.id);
          ensure(p !== void 0, "\u9879\u76EE\u4E0D\u5B58\u5728");
          p.name = action.name.trim();
          p.color = action.color;
        } else {
          ensure(
            action.directory !== null && isAbsolutePath(action.directory),
            "\u65B0\u9879\u76EE\u5FC5\u987B\u7ED1\u5B9A\u8D44\u6599\u76EE\u5F55\uFF1B\u8BF7\u5728\u9879\u76EE\u9875\u9009\u62E9\u76EE\u5F55\u5E76\u6388\u6743"
          );
          const projectId = id();
          this.education.projects.push({
            projectId,
            directory: action.directory,
            examMode: false,
            visionId: null,
            target: "",
            examDate: null,
            syllabusId: null,
            pastPaperIds: [],
            mockPaperIds: []
          });
          this.projects.push({
            id: projectId,
            name: action.name.trim(),
            color: action.color,
            appWhitelist: null
          });
        }
        break;
      }
      case "renameProjectDirectory": {
        const project = this.projects.find((x) => x.id === action.id);
        ensure(project !== void 0, "\u9879\u76EE\u4E0D\u5B58\u5728");
        const profile = this.education.projects.find(
          (p) => p.projectId === action.id
        );
        ensure(profile !== void 0, "\u9879\u76EE\u6CA1\u6709\u7ED1\u5B9A\u8D44\u6599\u76EE\u5F55");
        ensure(isAbsolutePath(action.directory), "\u8D44\u6599\u76EE\u5F55\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84");
        project.name = action.name.trim();
        project.color = action.color;
        profile.directory = action.directory;
        break;
      }
      case "setProjectWhitelist": {
        const p = this.projects.find((x) => x.id === action.id);
        ensure(p !== void 0, "\u9879\u76EE\u4E0D\u5B58\u5728");
        p.appWhitelist = action.whitelist === null ? null : [...action.whitelist];
        break;
      }
      case "deleteProject": {
        if (this.education.semesters.some((s) => s.projectId === action.id)) {
          throw new AppError(
            "\u9879\u76EE\u5DF2\u6709\u6559\u5B66\u5386\u53F2\uFF0C\u8BF7\u4FDD\u7559\u8BB0\u5F55\u5E76\u505C\u7528\u5E94\u8BD5\u6A21\u5F0F\uFF1B\u8D44\u6599\u76EE\u5F55\u4E0D\u4F1A\u88AB\u5220\u9664"
          );
        }
        this.education.projects = this.education.projects.filter(
          (p) => p.projectId !== action.id
        );
        this.education.resources = this.education.resources.filter(
          (p) => p.projectId !== action.id
        );
        this.projects = this.projects.filter((p) => p.id !== action.id);
        for (const task of this.tasks) {
          if (task.projectId === action.id) task.projectId = null;
        }
        for (const template of this.templates) {
          if (template.shape.projectId === action.id)
            template.shape.projectId = null;
        }
        this.visions = this.visions.filter((a) => a.projectId !== action.id);
        break;
      }
      case "reorderProjects": {
        if (action.ids.length !== this.projects.length || !action.ids.every((pid) => this.projects.some((p) => p.id === pid))) {
          throw new AppError("\u9879\u76EE\u6392\u5E8F\u5217\u8868\u4E0E\u73B0\u6709\u9879\u76EE\u4E0D\u4E00\u81F4");
        }
        this.projects = action.ids.map(
          (pid) => this.projects.find((p) => p.id === pid)
        );
        break;
      }
      case "detachTasks": {
        if (action.ids.some((taskId) => teachingTask(this, taskId) !== void 0)) {
          throw new AppError("\u6559\u5B66\u5F85\u529E\u987B\u4FDD\u7559\u6765\u6E90\u9879\u76EE\uFF0C\u8BF7\u8C03\u6574\u5BF9\u5E94\u6559\u5B66\u5B89\u6392");
        }
        for (const t of this.tasks) {
          if (action.ids.includes(t.id)) {
            if (action.target === "project") t.projectId = null;
            else t.habitId = null;
          }
        }
        break;
      }
      case "saveHabitGroup": {
        if (action.id !== null) {
          const h = this.habits.find((x) => x.id === action.id);
          ensure(h !== void 0, "\u4E60\u60EF\u7EC4\u4E0D\u5B58\u5728");
          h.name = action.name.trim();
        } else {
          this.habits.push({ id: id(), name: action.name.trim() });
        }
        break;
      }
      case "saveHabit": {
        const hid = action.id ?? id();
        const existing = this.habits.find((h) => h.id === hid);
        if (existing !== void 0) {
          existing.name = action.name.trim();
        } else {
          this.habits.push({ id: hid, name: action.name.trim() });
        }
        saveTemplate(this, {
          id: `habit:${hid}`,
          automatic: true,
          printAheadDays: 0,
          printing: {
            kind: "weekly",
            slots: action.slots.map((s) => ({
              days: [...s.days],
              time: s.time
            }))
          },
          shape: {
            title: action.name.trim(),
            notes: "",
            projectId: action.projectId,
            habitId: hid,
            focusMinutes: action.focusMinutes,
            scrapMinutes: 0,
            priority: 0,
            estimate: 1,
            tags: [],
            subtasks: []
          }
        });
        break;
      }
      case "deleteHabit": {
        const tids = this.templates.filter((t) => t.shape.habitId === action.id).map((t) => t.id);
        for (const tid of tids) {
          deleteTemplate(this, tid);
        }
        this.habits = this.habits.filter((h) => h.id !== action.id);
        for (const task of this.tasks) {
          if (task.habitId === action.id) task.habitId = null;
        }
        break;
      }
      case "saveVision": {
        if (action.id !== null) {
          const a = this.visions.find((x) => x.id === action.id);
          ensure(a !== void 0, "\u613F\u666F\u4E0D\u5B58\u5728");
          a.name = action.name.trim();
          a.notes = action.notes;
          a.projectId = action.projectId;
        } else {
          this.visions.push({
            id: id(),
            name: action.name.trim(),
            notes: action.notes,
            projectId: action.projectId
          });
        }
        break;
      }
      case "deleteVision":
        this.visions = this.visions.filter((a) => a.id !== action.id);
        break;
      case "saveBlock": {
        const block = {
          id: action.id ?? id(),
          title: action.title.trim(),
          days: [...action.days],
          start: action.start,
          end: action.end,
          attention: action.attention,
          notes: action.notes
        };
        validateBlock(block);
        const index = this.blocks.findIndex((b) => b.id === block.id);
        if (index >= 0) {
          this.blocks[index] = block;
        } else {
          this.blocks.push(block);
        }
        break;
      }
      case "deleteBlock":
        this.blocks = this.blocks.filter((b) => b.id !== action.id);
        break;
      case "selectTask": {
        if (this.tasks.some((t) => t.id === action.id && this.taskIsVoid(t))) {
          throw new AppError("\u4F5C\u5E9F\u5B9E\u4F8B\u4E0D\u80FD\u4E13\u6CE8");
        }
        if (action.id !== null && !this.tasks.some((t) => t.id === action.id && !t.completed)) {
          throw new AppError("\u8BF7\u9009\u62E9\u4E00\u4E2A\u672A\u5B8C\u6210\u7684\u4EFB\u52A1");
        }
        if (this.timer.running || timerRemaining(this.timer, at) < this.timer.durationSecs) {
          throw new AppError("\u8BF7\u5148\u7ED3\u675F\u5F53\u524D\u8BA1\u65F6\uFF0C\u518D\u5207\u6362\u4E13\u6CE8\u4EFB\u52A1");
        }
        this.timer.taskId = action.id;
        this.resetTo(this.timer.mode);
        break;
      }
      case "startTimer": {
        if (this.tasks.some(
          (t) => t.id === this.timer.taskId && this.taskIsVoid(t)
        )) {
          throw new AppError("\u4F5C\u5E9F\u5B9E\u4F8B\u4E0D\u80FD\u5F00\u59CB\u4E13\u6CE8");
        }
        const override = action.minutes !== void 0 && action.minutes !== null ? action.minutes : null;
        if (override !== null) {
          if (this.timer.mode !== "focus" || this.timer.running || this.timer.startedAt !== null) {
            throw new AppError("\u53EA\u6709\u5C1A\u672A\u5F00\u59CB\u7684\u4E13\u6CE8\u53EF\u4EE5\u6307\u5B9A\u5355\u6B21\u65F6\u957F");
          }
          if (!Number.isInteger(override) || override < 1 || override > 180) {
            throw new AppError("\u5355\u6B21\u65F6\u957F\u9700\u4E3A1\u2014180\u5206\u949F");
          }
        }
        startTeachingTask(this, at);
        this.start(at);
        if (override !== null) {
          this.timer.durationSecs = override * 60;
          this.timer.remainingSecs = override * 60;
          this.timer.deadline = at + override * 60;
        }
        break;
      }
      case "pauseTimer": {
        this.timer.remainingSecs = timerRemaining(this.timer, at);
        this.timer.running = false;
        this.timer.deadline = null;
        break;
      }
      case "resetTimer": {
        this.record(at, false);
        this.resetTo(this.timer.mode);
        break;
      }
      case "skipTimer": {
        this.record(at, false);
        const next = this.timer.mode === "focus" ? "shortBreak" : "focus";
        this.resetTo(next);
        break;
      }
      case "setMode": {
        if (action.mode !== this.timer.mode) {
          this.record(at, false);
          this.resetTo(action.mode);
        }
        break;
      }
      case "saveSettings": {
        this.settings = action.settings;
        if (!this.timer.running && this.timer.remainingSecs === this.timer.durationSecs) {
          this.resetTo(this.timer.mode);
        }
        break;
      }
      case "importPlan":
        mergePlan(action.plan, this, at);
        break;
      case "import": {
        action.data.validate();
        const data = clone(action.data);
        data.lock.active = null;
        data.lock.suppressedUntil = 0;
        data.settings.autoStartTasks = false;
        for (const schedule of data.lock.schedules) {
          schedule.enabled = false;
        }
        data.timer.remainingSecs = Math.max(1, timerRemaining(data.timer, at));
        data.timer.running = false;
        data.timer.deadline = null;
        data.timer.completionSerial = this.timer.completionSerial;
        replaceAppData(this, data);
        break;
      }
      case "loadExample": {
        if (this.tasks.length > 0) {
          throw new AppError("\u53EA\u6709\u7A7A\u4EFB\u52A1\u5217\u8868\u53EF\u4EE5\u8F7D\u5165\u793A\u4F8B");
        }
        const today = dateAt(at);
        const examples = [
          [
            "\u68B3\u7406\u672C\u5468\u7684\u5DE5\u4F5C\u8BA1\u5212",
            "\u628A\u5927\u76EE\u6807\u62C6\u6210\u5C0F\u6B65\u9AA4\uFF0C\u8BA9\u6BCF\u4E00\u5929\u90FD\u66F4\u4ECE\u5BB9\u3002",
            3,
            2
          ],
          [
            "\u8BFB\u5B8C\u6B63\u5728\u770B\u7684\u90A3\u4E00\u7AE0",
            "\u5173\u6389\u6D88\u606F\u63D0\u9192\uFF0C\u7ED9\u9605\u8BFB\u7559\u4E00\u6BB5\u5B8C\u6574\u7684\u65F6\u95F4\u3002",
            2,
            1
          ],
          ["\u6574\u7406\u684C\u9762\uFF0C\u6574\u7406\u601D\u7EEA", "\u4E00\u4E2A\u8212\u670D\u7684\u73AF\u5883\uFF0C\u662F\u4E13\u6CE8\u7684\u5F00\u59CB\u3002", 1, 1]
        ];
        examples.forEach(([title, notes, priority, estimate], index) => {
          this.tasks.push({
            id: id(),
            templateId: null,
            recurring: false,
            title,
            notes,
            projectId: this.projects[index]?.id ?? null,
            habitId: null,
            dueDate: today,
            reminderTime: null,
            focusMinutes: null,
            reminderFired: false,
            reminderPending: false,
            reminderExpired: false,
            scrapMinutes: 0,
            priority,
            estimate,
            completed: false,
            completedAt: null,
            createdAt: at + index,
            tags: ["\u793A\u4F8B"],
            subtasks: []
          });
        });
        break;
      }
    }
    materializeTeachingTasks(this, at);
    this.validate();
  }
  validate() {
    this.educationValidate();
    validateTeachingTasks(this);
    validateLock(this.lock);
    validateTemplates(this);
    validateIdentities(this);
    validateBlocks(this.blocks);
    ensure(this.version === 4, "\u4E0D\u652F\u6301\u6B64\u6570\u636E\u7248\u672C");
    ensure(
      this.tasks.length <= 5e4 && this.sessions.length <= 2e5 && this.projects.length <= 500,
      "\u6570\u636E\u8D85\u51FA\u6570\u91CF\u9650\u5236"
    );
    const s = this.settings;
    ensure(s.soundVolume <= 100, "\u97F3\u6548\u97F3\u91CF\u9700\u4E3A 0\u2013100");
    ensure(
      s.focusMinutes >= 1 && s.focusMinutes <= 180 && s.shortBreakMinutes >= 1 && s.shortBreakMinutes <= 60 && s.longBreakMinutes >= 1 && s.longBreakMinutes <= 120 && s.longBreakEvery >= 2 && s.longBreakEvery <= 12 && s.dailyGoal >= 1 && s.dailyGoal <= 30,
      "\u8BA1\u65F6\u8BBE\u7F6E\u8D85\u51FA\u5141\u8BB8\u8303\u56F4"
    );
    ensure(["light", "dark", "system"].includes(s.theme), "\u65E0\u6548\u7684\u4E3B\u9898");
    ensure(validAppIds(s.protection.whitelist), "\u65E0\u6548\u7684\u5E94\u7528\u767D\u540D\u5355");
    const projectIds = /* @__PURE__ */ new Set();
    for (const p of this.projects) {
      ensure(p.id.length > 0 && !projectIds.has(p.id), "\u9879\u76EE ID \u91CD\u590D\u6216\u4E3A\u7A7A");
      projectIds.add(p.id);
      ensure(
        p.name.trim().length > 0 && charCount(p.name) <= 40,
        "\u9879\u76EE\u540D\u79F0\u9700\u4E3A 1\u201340 \u4E2A\u5B57\u7B26"
      );
      ensure(
        p.color.length === 7 && p.color.startsWith("#") && /^[0-9a-fA-F]{6}$/.test(p.color.slice(1)),
        "\u65E0\u6548\u7684\u9879\u76EE\u989C\u8272"
      );
      ensure(
        p.appWhitelist === null || validAppIds(p.appWhitelist),
        "\u65E0\u6548\u7684\u9879\u76EE\u5E94\u7528\u767D\u540D\u5355"
      );
    }
    const habitIds = /* @__PURE__ */ new Set();
    ensure(this.habits.length <= 500, "\u4E60\u60EF\u6570\u91CF\u8D85\u51FA\u9650\u5236");
    for (const h of this.habits) {
      ensure(h.id.length > 0 && !habitIds.has(h.id), "\u4E60\u60EF ID \u91CD\u590D\u6216\u4E3A\u7A7A");
      habitIds.add(h.id);
      validateHabit(h);
    }
    const visionIds = /* @__PURE__ */ new Set();
    ensure(this.visions.length <= 500, "\u613F\u666F\u6570\u91CF\u8D85\u51FA\u9650\u5236");
    for (const a of this.visions) {
      ensure(a.id.length > 0 && !visionIds.has(a.id), "\u613F\u666F ID \u91CD\u590D\u6216\u4E3A\u7A7A");
      visionIds.add(a.id);
      ensure(
        a.name.trim().length > 0 && charCount(a.name) <= 40,
        "\u613F\u666F\u540D\u79F0\u9700\u4E3A 1\u201340 \u4E2A\u5B57\u7B26"
      );
      ensure(utf8Len(a.notes) <= 5e4, "\u613F\u666F\u5185\u5BB9\u8FC7\u957F");
      ensure(
        a.projectId === null || projectIds.has(a.projectId),
        "\u613F\u666F\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u9879\u76EE"
      );
    }
    const taskIds = /* @__PURE__ */ new Set();
    for (const t2 of this.tasks) {
      this.validateReminderTask(t2);
      ensure(t2.id.length > 0 && !taskIds.has(t2.id), "\u4EFB\u52A1 ID \u91CD\u590D\u6216\u4E3A\u7A7A");
      taskIds.add(t2.id);
      ensure(
        t2.title.trim().length > 0 && charCount(t2.title) <= 200,
        "\u4EFB\u52A1\u540D\u79F0\u9700\u4E3A 1\u2013200 \u4E2A\u5B57\u7B26"
      );
      ensure(
        utf8Len(t2.notes) <= 5e4 && t2.tags.length <= 20 && t2.tags.every((tag) => charCount(tag) <= 40),
        "\u5907\u6CE8\u6216\u6807\u7B7E\u8FC7\u957F"
      );
      ensure(
        t2.priority <= 3 && t2.estimate >= 1 && t2.estimate <= 99,
        "\u65E0\u6548\u7684\u4F18\u5148\u7EA7\u6216\u9884\u8BA1\u756A\u8304\u6570"
      );
      ensure(t2.scrapMinutes <= 10080, "\u91CD\u4FEE\u7A97\u53E3\u8D85\u51FA\u8303\u56F4");
      ensure(
        t2.projectId === null || projectIds.has(t2.projectId),
        "\u4EFB\u52A1\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u9879\u76EE"
      );
      ensure(
        t2.habitId === null || habitIds.has(t2.habitId),
        "\u4EFB\u52A1\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u4E60\u60EF"
      );
      ensure(
        t2.habitId === null || t2.reminderTime !== null,
        "\u4E60\u60EF\u5B9E\u4F8B\u9700\u8981\u7CBE\u786E\u65F6\u95F4"
      );
      ensure(
        t2.dueDate === null || t2.dueDate.length === 10 && validDate(t2.dueDate),
        "\u65E0\u6548\u7684\u4EFB\u52A1\u65E5\u671F"
      );
      const subs = /* @__PURE__ */ new Set();
      ensure(
        t2.subtasks.length <= 200 && t2.subtasks.every((sub) => {
          if (sub.id.length === 0) return false;
          if (subs.has(sub.id)) return false;
          subs.add(sub.id);
          return sub.title.trim().length > 0 && charCount(sub.title) <= 200;
        }),
        "\u65E0\u6548\u7684\u5B50\u4EFB\u52A1"
      );
      ensure(
        t2.completed === (t2.completedAt !== null),
        "\u4EFB\u52A1\u5B8C\u6210\u72B6\u6001\u4E0E\u65E5\u671F\u4E0D\u4E00\u81F4"
      );
    }
    const t = this.timer;
    ensure(
      t.cycleDate === null || t.cycleDate.length === 10 && validDate(t.cycleDate),
      "\u65E0\u6548\u7684\u756A\u8304\u5468\u671F\u65E5\u671F"
    );
    ensure(
      t.durationSecs >= 1 && t.durationSecs <= 10800 && t.remainingSecs <= t.durationSecs && t.running === (t.deadline !== null),
      "\u8BA1\u65F6\u5668\u6570\u636E\u4E0D\u6B63\u786E"
    );
    ensure(t.taskId === null || taskIds.has(t.taskId), "\u8BA1\u65F6\u5668\u4EFB\u52A1\u4E0D\u5B58\u5728");
    const sessionIds = /* @__PURE__ */ new Set();
    const estimatedTasks = /* @__PURE__ */ new Set();
    for (const session of this.sessions) {
      const maxDuration = session.source === "timer" ? 10800 : 99 * 180 * 60;
      ensure(
        session.id.length > 0 && !sessionIds.has(session.id) && session.endedAt >= session.startedAt && session.durationSecs >= 1 && session.durationSecs <= maxDuration && (session.source !== "taskEstimate" || !session.completed && session.taskId !== null && session.taskId.length > 0 && !estimatedTasks.has(session.taskId) && session.startedAt === session.endedAt) && charCount(session.taskTitle) <= 200 && charCount(session.projectName) <= 40,
        "\u65E0\u6548\u7684\u4E13\u6CE8\u8BB0\u5F55"
      );
      sessionIds.add(session.id);
      if (session.source === "taskEstimate" && session.taskId !== null) {
        estimatedTasks.add(session.taskId);
      }
    }
  }
  stats(at) {
    const today = dateAt(at);
    const current = parseLocalDate(today);
    const byDay = /* @__PURE__ */ new Map();
    for (const session of this.sessions) {
      const entry = byDay.get(dateAt(session.endedAt)) ?? {
        seconds: 0,
        pomodoros: 0
      };
      entry.seconds += session.durationSecs;
      entry.pomodoros += session.completed ? 1 : 0;
      byDay.set(dateAt(session.endedAt), entry);
    }
    const completedByDay = /* @__PURE__ */ new Map();
    const voidedByDay = /* @__PURE__ */ new Map();
    const missedByDay = /* @__PURE__ */ new Map();
    for (const t of this.tasks) {
      if (t.completedAt !== null) {
        completedByDay.set(
          dateAt(t.completedAt),
          (completedByDay.get(dateAt(t.completedAt)) ?? 0) + 1
        );
      }
      if (t.reminderExpired && !t.completed && t.dueDate !== null) {
        if (kindOf(t) === "habit") {
          missedByDay.set(t.dueDate, (missedByDay.get(t.dueDate) ?? 0) + 1);
        } else {
          voidedByDay.set(t.dueDate, (voidedByDay.get(t.dueDate) ?? 0) + 1);
        }
      }
    }
    const days = [];
    for (let n = 27; n >= 0; n -= 1) {
      const date = formatLocalDate(addDays(current, -n));
      const entry = byDay.get(date) ?? { seconds: 0, pomodoros: 0 };
      days.push({
        date,
        seconds: entry.seconds,
        pomodoros: entry.pomodoros,
        missed: missedByDay.get(date) ?? 0,
        completed: completedByDay.get(date) ?? 0,
        voided: voidedByDay.get(date) ?? 0
      });
    }
    const focused = /* @__PURE__ */ new Set();
    for (const s of this.sessions) {
      if (s.completed || s.source === "taskEstimate") {
        focused.add(dateAt(s.endedAt));
      }
    }
    let day = current;
    if (!focused.has(today)) {
      day = addDays(day, -1);
    }
    let streak = 0;
    while (focused.has(formatLocalDate(day))) {
      streak += 1;
      day = addDays(day, -1);
    }
    const last = days[days.length - 1];
    return {
      todaySeconds: last.seconds,
      todayPomodoros: last.pomodoros,
      todayCompleted: this.tasks.filter(
        (t) => t.completedAt !== null && dateAt(t.completedAt) === today
      ).length,
      totalSeconds: this.sessions.reduce((n, s) => n + s.durationSecs, 0),
      totalPomodoros: this.sessions.filter((s) => s.completed).length,
      streak,
      days
    };
  }
  // ---- reminders 包装 ----
  reminderIdle() {
    return reminderIdle(this);
  }
  pendingReminder() {
    return pendingReminder(this);
  }
  dueAutoTask() {
    return dueAutoTask(this);
  }
  // ---- plan 包装 ----
  exportPlan() {
    return exportPlan(this);
  }
  // ---- teaching 包装 ----
  teachingTask(taskId) {
    return teachingTask(this, taskId);
  }
  completeTeachingTask(taskId, at) {
    completeTeachingTask(this, taskId, at);
  }
  // ---- education 校验包装 ----
  educationValidate() {
    validateEducation(this);
  }
  validateReminderTask(task) {
    validateReminderTask(task);
  }
};
function validAppIds(list) {
  return list.length <= 100 && list.every(
    (a) => a.trim().length > 0 && charCount(a) <= 32768 && !Array.from(a).some((c) => isControlChar(c))
  );
}
function isControlChar(c) {
  const code = c.codePointAt(0);
  return code < 32 || code >= 127 && code <= 159;
}
function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}
function formatLocalDate(date) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
function checkUserAction(action) {
  if (action.type === "education" && assistantOnly(action.command)) {
    throw new AppError(
      "\u8BFE\u7A0B\u3001\u4F5C\u4E1A\u3001\u8BD5\u5377\u548C\u6279\u6539\u7531\u5B66\u4E60\u52A9\u624B\u751F\u6210\uFF0C\u8BF7\u5728\u5BF9\u8BDD\u4E2D\u63D0\u51FA\u8981\u6C42"
    );
  }
}
var ACTION_KEYS = {
  education: ["type", "command"],
  printInstances: ["type", "shape", "printing"],
  saveTemplate: ["type", "template", "printDates"],
  deleteTemplate: ["type", "id"],
  printTemplate: ["type", "id", "dates"],
  syncTemplate: ["type", "id"],
  startReminder: ["type", "id"],
  saveTask: ["type", "task"],
  toggleTask: ["type", "id"],
  deleteTask: ["type", "id"],
  restoreTask: ["type", "task"],
  toggleSubtask: ["type", "taskId", "subtaskId"],
  saveProject: ["type", "id", "name", "color", "directory"],
  renameProjectDirectory: ["type", "id", "name", "color", "directory"],
  setProjectWhitelist: ["type", "id", "whitelist"],
  deleteProject: ["type", "id"],
  reorderProjects: ["type", "ids"],
  detachTasks: ["type", "ids", "target"],
  saveHabitGroup: ["type", "id", "name"],
  saveHabit: ["type", "id", "name", "projectId", "focusMinutes", "slots"],
  deleteHabit: ["type", "id"],
  saveVision: ["type", "id", "name", "notes", "projectId"],
  deleteVision: ["type", "id"],
  saveBlock: [
    "type",
    "id",
    "title",
    "days",
    "start",
    "end",
    "attention",
    "notes"
  ],
  deleteBlock: ["type", "id"],
  selectTask: ["type", "id"],
  startTimer: ["type", "minutes"],
  completeFocus: ["type"],
  pauseTimer: ["type"],
  resetTimer: ["type"],
  skipTimer: ["type"],
  setMode: ["type", "mode"],
  saveSettings: ["type", "settings"],
  loadExample: ["type"],
  import: ["type", "data"],
  importPlan: ["type", "plan"],
  emergencyUnlock: ["type"],
  saveLockSchedule: ["type", "schedule"],
  deleteLockSchedule: ["type", "id"],
  startQuickLock: ["type", "minutes", "strict"]
};
var ACTION_NAMES = Object.keys(ACTION_KEYS);
function parseAction(raw) {
  if (!isObject(raw)) throw new AppError("\u52A8\u4F5C\u5FC5\u987B\u662F\u5BF9\u8C61");
  const type = oneOf(
    requiredField(raw, "type", "\u52A8\u4F5C", (v) => v),
    "\u52A8\u4F5C type",
    ACTION_NAMES
  );
  rejectUnknown(raw, ACTION_KEYS[type], "\u52A8\u4F5C");
  const str = (key) => requiredField(raw, key, "\u52A8\u4F5C", asStr);
  const optStr = (key) => field(raw, key, "\u52A8\u4F5C", (v) => asOpt(v, key, asStr), null);
  const strs = (key) => asArray(
    requiredField(raw, key, "\u52A8\u4F5C", (v) => v),
    key
  ).map((x) => asStr(x, key));
  switch (type) {
    case "education":
      return {
        type,
        command: parseCommand(requiredField(raw, "command", "\u52A8\u4F5C", (v) => v))
      };
    case "printInstances":
      return {
        type,
        shape: parseShape(requiredField(raw, "shape", "\u52A8\u4F5C", (v) => v)),
        printing: parsePrinting(
          requiredField(raw, "printing", "\u52A8\u4F5C", (v) => v)
        )
      };
    case "saveTemplate":
      return {
        type,
        template: parseTemplate(
          requiredField(raw, "template", "\u52A8\u4F5C", (v) => v)
        ),
        printDates: field(
          raw,
          "printDates",
          "\u52A8\u4F5C",
          (v) => asArray(v, "printDates").map(
            (d) => d === null ? null : asStr(d, "printDates")
          ),
          []
        )
      };
    case "deleteTemplate":
    case "syncTemplate":
    case "startReminder":
    case "toggleTask":
    case "deleteTask":
    case "deleteProject":
    case "deleteHabit":
    case "deleteVision":
    case "deleteBlock":
    case "deleteLockSchedule":
      return { type, id: str("id") };
    case "printTemplate":
      return {
        type,
        id: str("id"),
        dates: asArray(
          requiredField(raw, "dates", "\u52A8\u4F5C", (v) => v),
          "dates"
        ).map((d) => d === null ? null : asStr(d, "dates"))
      };
    case "saveTask":
      return {
        type,
        task: parseTaskDraft(requiredField(raw, "task", "\u52A8\u4F5C", (v) => v))
      };
    case "restoreTask":
      return {
        type,
        task: parseTask(requiredField(raw, "task", "\u52A8\u4F5C", (v) => v))
      };
    case "toggleSubtask":
      return { type, taskId: str("taskId"), subtaskId: str("subtaskId") };
    case "saveProject":
      return {
        type,
        id: optStr("id"),
        name: str("name"),
        color: str("color"),
        directory: optStr("directory")
      };
    case "renameProjectDirectory":
      return {
        type,
        id: str("id"),
        name: str("name"),
        color: str("color"),
        directory: str("directory")
      };
    case "setProjectWhitelist":
      return {
        type,
        id: str("id"),
        whitelist: field(
          raw,
          "whitelist",
          "\u52A8\u4F5C",
          (v) => asOpt(
            v,
            "whitelist",
            (x) => asArray(x, "whitelist").map((a) => asStr(a, "whitelist"))
          ),
          null
        )
      };
    case "reorderProjects":
      return { type, ids: strs("ids") };
    case "detachTasks":
      return {
        type,
        ids: strs("ids"),
        target: oneOf(
          requiredField(raw, "target", "\u52A8\u4F5C", (v) => v),
          "detach target",
          ["project", "habit"]
        )
      };
    case "saveHabitGroup":
      return { type, id: optStr("id"), name: str("name") };
    case "saveHabit":
      return {
        type,
        id: optStr("id"),
        name: str("name"),
        projectId: optStr("projectId"),
        focusMinutes: field(
          raw,
          "focusMinutes",
          "\u52A8\u4F5C",
          (v) => asOpt(v, "focusMinutes", (x) => asInt(x, "focusMinutes")),
          null
        ),
        slots: asArray(
          requiredField(raw, "slots", "\u52A8\u4F5C", (v) => v),
          "slots"
        ).map(parseHabitSlot)
      };
    case "saveVision":
      return {
        type,
        id: optStr("id"),
        name: str("name"),
        notes: field(raw, "notes", "\u52A8\u4F5C", asStr, ""),
        projectId: optStr("projectId")
      };
    case "saveBlock":
      return {
        type,
        id: optStr("id"),
        title: str("title"),
        days: asArray(
          requiredField(raw, "days", "\u52A8\u4F5C", (v) => v),
          "days"
        ).map((d) => asInt(d, "days")),
        start: str("start"),
        end: str("end"),
        attention: field(
          raw,
          "attention",
          "\u52A8\u4F5C",
          (v) => oneOf(v, "attention", ["required", "light"]),
          "required"
        ),
        notes: field(raw, "notes", "\u52A8\u4F5C", asStr, "")
      };
    case "selectTask":
      return { type, id: optStr("id") };
    case "startTimer":
      return {
        type,
        minutes: field(
          raw,
          "minutes",
          "\u52A8\u4F5C",
          (v) => asOpt(v, "minutes", (x) => asInt(x, "minutes")),
          null
        )
      };
    case "completeFocus":
    case "pauseTimer":
    case "resetTimer":
    case "skipTimer":
    case "loadExample":
    case "emergencyUnlock":
      return { type };
    case "setMode":
      return {
        type,
        mode: oneOf(
          requiredField(raw, "mode", "\u52A8\u4F5C", (v) => v),
          "mode",
          ["focus", "shortBreak", "longBreak"]
        )
      };
    case "saveSettings":
      return {
        type,
        settings: parseSettings(
          requiredField(raw, "settings", "\u52A8\u4F5C", (v) => v)
        )
      };
    case "import":
      return {
        type,
        data: parseAppData(requiredField(raw, "data", "\u52A8\u4F5C", (v) => v))
      };
    case "importPlan":
      return {
        type,
        plan: parsePlanFile(requiredField(raw, "plan", "\u52A8\u4F5C", (v) => v))
      };
    case "saveLockSchedule":
      return {
        type,
        schedule: parseLockSchedule(
          requiredField(raw, "schedule", "\u52A8\u4F5C", (v) => v)
        )
      };
    case "startQuickLock":
      return {
        type,
        minutes: requiredField(raw, "minutes", "\u52A8\u4F5C", asInt),
        strict: requiredField(raw, "strict", "\u52A8\u4F5C", asBool)
      };
    default:
      throw new AppError(`\u52A8\u4F5C type \u53D6\u503C\u65E0\u6548\uFF1A${type}`);
  }
}
function parseAppData(raw) {
  if (!isObject(raw)) throw new AppError("\u6570\u636E\u5FC5\u987B\u662F\u5BF9\u8C61");
  rejectUnknown(
    raw,
    [
      "education",
      "version",
      "identities",
      "tasks",
      "blocks",
      "templates",
      "prints",
      "projects",
      "habits",
      "visions",
      "settings",
      "timer",
      "sessions",
      "lock"
    ],
    "\u6570\u636E"
  );
  return new AppData({
    education: field(raw, "education", "\u6570\u636E", parseEducation, new Education()),
    version: requiredField(raw, "version", "\u6570\u636E", asInt),
    identities: field(
      raw,
      "identities",
      "\u6570\u636E",
      (v) => asArray(v, "identities").map(parseIdentity),
      []
    ),
    tasks: field(
      raw,
      "tasks",
      "\u6570\u636E",
      (v) => asArray(v, "tasks").map(parseTask),
      []
    ),
    blocks: field(
      raw,
      "blocks",
      "\u6570\u636E",
      (v) => asArray(v, "blocks").map(parseBlock),
      []
    ),
    templates: field(
      raw,
      "templates",
      "\u6570\u636E",
      (v) => asArray(v, "templates").map(parseTemplate),
      []
    ),
    prints: field(
      raw,
      "prints",
      "\u6570\u636E",
      (v) => asArray(v, "prints").map((p) => {
        ensure(isObject(p), "\u5370\u5237\u8BB0\u5F55\u5FC5\u987B\u662F\u5BF9\u8C61");
        rejectUnknown(p, ["templateId", "date"], "\u5370\u5237\u8BB0\u5F55");
        return {
          templateId: requiredField(p, "templateId", "\u5370\u5237\u8BB0\u5F55", asStr),
          date: field(
            p,
            "date",
            "\u5370\u5237\u8BB0\u5F55",
            (d) => asOpt(d, "date", asStr),
            null
          )
        };
      }),
      []
    ),
    projects: requiredField(
      raw,
      "projects",
      "\u6570\u636E",
      (v) => asArray(v, "projects").map(parseProject)
    ),
    habits: field(
      raw,
      "habits",
      "\u6570\u636E",
      (v) => asArray(v, "habits").map(parseHabit),
      []
    ),
    visions: field(
      raw,
      "visions",
      "\u6570\u636E",
      (v) => asArray(v, "visions").map(parseVision),
      []
    ),
    settings: requiredField(raw, "settings", "\u6570\u636E", parseSettings),
    timer: requiredField(raw, "timer", "\u6570\u636E", parseTimer),
    sessions: requiredField(
      raw,
      "sessions",
      "\u6570\u636E",
      (v) => asArray(v, "sessions").map(parseSession)
    ),
    lock: field(raw, "lock", "\u6570\u636E", parseLockState, {
      schedules: [],
      active: null,
      suppressedUntil: 0
    })
  });
}
function serializeAppData(data) {
  return {
    education: serializeEducation(data.education),
    version: data.version,
    identities: data.identities.map(serializeIdentity),
    tasks: data.tasks.map(serializeTask),
    blocks: data.blocks.map(serializeBlock),
    templates: data.templates.map(serializeTemplate),
    prints: data.prints.map(serializePrintRecord),
    projects: data.projects.map(serializeProject),
    habits: data.habits.map(serializeHabit),
    visions: data.visions.map(serializeVision),
    settings: serializeSettings(data.settings),
    timer: serializeTimer(data.timer),
    sessions: data.sessions.map(serializeSession),
    lock: serializeLockState(data.lock)
  };
}

// packages/core/src/migration.ts
function upgradeTaskValue(task, today) {
  const date = typeof task["createdAt"] === "number" ? dateAt(task["createdAt"]) : today;
  delete task["goalId"];
  delete task["nodeId"];
  if (task["dueDate"] === void 0 || task["dueDate"] === null) {
    task["dueDate"] = date;
  }
}
function readLocalData(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    throw new AppError(`\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF0C\u539F\u6587\u4EF6\u5DF2\u4FDD\u7559\uFF1A${String(e)}`);
  }
  if (!isObject2(value)) {
    throw new AppError("\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF0C\u539F\u6587\u4EF6\u5DF2\u4FDD\u7559\uFF1A\u65E0\u6548\u7684\u672C\u5730\u6570\u636E");
  }
  if (value["version"] === 3) {
    const today = dateAt(now());
    value["version"] = 4;
    delete value["goals"];
    delete value["nodeBindings"];
    delete value["signalEvents"];
    const tasks = value["tasks"];
    if (Array.isArray(tasks)) {
      for (const task of tasks) {
        if (isObject2(task)) upgradeTaskValue(task, today);
      }
    }
    const templates = value["templates"];
    if (Array.isArray(templates)) {
      for (const template of templates) {
        if (!isObject2(template)) continue;
        const shape = template["shape"];
        if (isObject2(shape)) delete shape["goalId"];
        const printing = template["printing"];
        if (isObject2(printing) && printing["kind"] === "once" && (printing["date"] === null || printing["date"] === void 0)) {
          printing["date"] = today;
        }
      }
    }
    const prints = value["prints"];
    if (Array.isArray(prints)) {
      value["prints"] = prints.filter((p) => isObject2(p) && p["date"] !== null);
    }
    const visions = value["visions"];
    if (Array.isArray(visions)) {
      for (const vision of visions) {
        if (isObject2(vision)) delete vision["goalId"];
      }
    }
    const ids = value["identities"];
    if (Array.isArray(ids)) {
      value["identities"] = ids.filter(
        (r) => isObject2(r) && !["goal", "node", "signal"].includes(r["kind"])
      );
      for (const record of value["identities"]) {
        if (typeof record["restoreTask"] === "string") {
          let task;
          try {
            task = JSON.parse(record["restoreTask"]);
          } catch (e) {
            throw new AppError(`\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF0C\u539F\u6587\u4EF6\u5DF2\u4FDD\u7559\uFF1A${String(e)}`);
          }
          if (!isObject2(task)) {
            throw new AppError(
              "\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF0C\u539F\u6587\u4EF6\u5DF2\u4FDD\u7559\uFF1A\u65E0\u6548\u7684\u4EFB\u52A1\u6062\u590D\u8BB0\u5F55"
            );
          }
          upgradeTaskValue(task, today);
          record["restoreTask"] = JSON.stringify(
            serializeTask(parseTask(task))
          );
        }
      }
    }
  }
  try {
    return parseAppData(value);
  } catch (e) {
    throw new AppError(
      `\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF0C\u539F\u6587\u4EF6\u5DF2\u4FDD\u7559\uFF1A${e instanceof Error ? e.message : String(e)}`
    );
  }
}
function isObject2(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// packages/core/src/diagnostics.ts
function signal(key, kind, title, severity, evidence, question) {
  return { key, kind, title, severity, evidence, question };
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
function diagnose(snapshot, capacityMinutes) {
  const data = snapshot.data;
  const at = snapshot.serverTime;
  const today = parseDate(snapshot.today);
  const weekStart2 = formatDate(addDays(today, -7));
  const monthStart = formatDate(addDays(today, -28));
  const byDay = /* @__PURE__ */ new Map();
  for (const s of data.sessions) {
    const date = dateAt(s.endedAt);
    if (date >= monthStart && date < snapshot.today) {
      byDay.set(date, (byDay.get(date) ?? 0) + Math.floor(s.durationSecs / 60));
    }
  }
  const activeMinutes = [...byDay.values()].filter((m) => m >= 20);
  const historical = activeMinutes.length >= 5 ? median(activeMinutes) : null;
  const capacity = capacityMinutes !== null ? capacityMinutes : historical !== null ? Math.max(30, historical) : data.settings.dailyGoal * data.settings.focusMinutes;
  const capacitySource = capacityMinutes !== null ? "\u7528\u6237\u8BBE\u7F6E\u7684\u65E5\u9884\u7B97" : historical !== null ? "\u8FD128\u5929\u81F3\u5C115\u4E2A\u6D3B\u8DC3\u65E5\u7684\u4E2D\u4F4D\u6570\uFF08\u5E76\u975E\u53EF\u7528\u65F6\u95F4\uFF09" : "\u6BCF\u65E5\u756A\u8304\u76EE\u6807\u9884\u7B97\uFF08\u5E76\u975E\u53EF\u7528\u65F6\u95F4\uFF09";
  const completedRounds = /* @__PURE__ */ new Map();
  for (const s of data.sessions) {
    if (s.completed && s.taskId !== null) {
      completedRounds.set(s.taskId, (completedRounds.get(s.taskId) ?? 0) + 1);
    }
  }
  const result = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const date = formatDate(addDays(today, offset));
    const tasks = data.tasks.filter(
      (t) => t.dueDate === date && !t.completed && !data.taskIsVoid(t)
    );
    const minutes = tasks.reduce(
      (n, t) => n + Math.max(0, t.estimate - (completedRounds.get(t.id) ?? 0)) * (t.focusMinutes ?? data.settings.focusMinutes),
      0
    );
    const day = parseDate(date);
    const blockedMinutes = requiredMinutes(data.blocks, date);
    if (capacity > 0 && minutes * 100 > capacity * 130) {
      result.push(
        signal(
          `overload/${date}`,
          "overload",
          "\u8BA1\u5212\u7528\u65F6\u9AD8\u4E8E\u5F53\u524D\u9884\u7B97",
          "warning",
          {
            date,
            remainingPlannedMinutes: minutes,
            budgetMinutes: capacity,
            budgetSource: capacitySource,
            blockedMinutes,
            taskIds: tasks.slice(0, 30).map((t) => t.id)
          },
          "\u8FD9\u4E9B\u4EFB\u52A1\u7684\u9884\u8BA1\u7528\u65F6\u662F\u5426\u51C6\u786E\uFF1F\u8FD9\u4E00\u5929\u6709\u989D\u5916\u53EF\u7528\u65F6\u95F4\uFF0C\u8FD8\u662F\u9700\u8981\u51CF\u91CF\u6216\u632A\u52A8\uFF1F"
        )
      );
    }
    if (offset === 1 && historical !== null && tasks.length > 0 && minutes * 100 < capacity * 30) {
      result.push(
        signal(
          `underload/${date}`,
          "underload",
          "\u660E\u65E5\u5B89\u6392\u660E\u663E\u4F4E\u4E8E\u8FD1\u671F\u6295\u5165",
          "notice",
          {
            date,
            plannedMinutes: minutes,
            baselineMinutes: capacity,
            baselineSource: capacitySource,
            blockedMinutes
          },
          "\u660E\u5929\u662F\u6709\u610F\u4F11\u606F\u3001\u8BFE\u7A0B\u5360\u7528\uFF0C\u8FD8\u662F\u8BA1\u5212\u5C1A\u672A\u8865\u9F50\uFF1F\u4E0D\u8981\u4EC5\u51ED\u7A7A\u95F2\u63A8\u65AD\u5E94\u8BE5\u52A0\u4EFB\u52A1\u3002"
        )
      );
    }
    const timed = tasks.map((t) => ({
      start: t.reminderTime !== null ? minutesOf(t.reminderTime) ?? -1 : -1,
      task: t
    })).filter((x) => x.start >= 0).sort(
      (a, b) => a.start - b.start || (a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0)
    );
    if (day !== null) {
      const required = blocksOnDate(data.blocks, date).filter(
        (b) => b.attention === "required"
      );
      for (const { start, task } of timed) {
        const end = start + windowMinutes(task, data.settings);
        for (const band2 of required) {
          const overlap = overlapMinutes(band2, date, start, end);
          if (overlap > 0) {
            result.push(
              signal(
                `block/${date}/${task.id}/${band2.id}`,
                "blockConflict",
                "\u8BA1\u5212\u65F6\u6BB5\u843D\u5728\u9700\u4E13\u5FC3\u7684\u8BFE\u7A0B\u5185",
                "warning",
                {
                  date,
                  taskId: task.id,
                  taskTitle: task.title,
                  blockId: band2.id,
                  blockTitle: band2.title,
                  blockStart: band2.start,
                  blockEnd: band2.end,
                  overlapMinutes: overlap
                },
                "\u8FD9\u6BB5\u5B89\u6392\u548C\u8981\u4E13\u5FC3\u542C\u7684\u8BFE\u91CD\u53E0\uFF1A\u80FD\u632A\u5230\u6C34\u8BFE\u65F6\u6BB5\u6216\u8BFE\u540E\u5417\uFF1F\u5982\u679C\u786E\u5B9E\u8981\u8BFE\u4E0A\u505A\uFF0C\u8BF4\u660E\u540E\u6211\u4E0D\u4F1A\u518D\u628A\u5B83\u5F53\u51B2\u7A81\u3002"
              )
            );
          }
        }
      }
    }
    let previous = null;
    for (const { start, task } of timed) {
      const end = start + windowMinutes(task, data.settings);
      if (previous !== null) {
        const prev = previous;
        if (start < prev.end) {
          const ids = [prev.task.id, task.id].sort();
          const band2 = day === null ? null : data.blocks.find(
            (b) => b.attention === "light" && overlapMinutes(b, date, start, Math.min(prev.end, end)) > 0
          );
          result.push(
            signal(
              `collision/${date}/${ids[0]}/${ids[1]}`,
              "collision",
              "\u4E24\u4E2A\u8BA1\u5212\u65F6\u6BB5\u91CD\u53E0",
              "warning",
              {
                date,
                taskIds: ids,
                titles: [prev.task.title, task.title],
                overlapMinutes: Math.min(prev.end, end) - start,
                includesBreaks: true,
                blockTitle: band2?.title ?? null
              },
              "\u8FD9\u4E24\u4E2A\u5B89\u6392\u80FD\u5426\u540C\u65F6\u5B8C\u6210\uFF1F\u5982\u679C\u662F\u5728\u540C\u4E00\u8BFE\u7A0B\u5185\u505A\u4F5C\u4E1A\uFF0C\u8BF7\u8BF4\u660E\uFF0C\u907F\u514D\u628A\u5141\u8BB8\u7684\u5E76\u884C\u8BEF\u5224\u4E3A\u51B2\u7A81\u3002"
            )
          );
        }
        if (end <= previous.end) {
          continue;
        }
      }
      previous = { end, task };
    }
  }
  const habits = /* @__PURE__ */ new Map();
  for (const t of data.tasks) {
    if (!isHabit(t) || t.dueDate === null || !(t.dueDate >= weekStart2 && t.dueDate < snapshot.today)) {
      continue;
    }
    const key = t.habitId ?? t.templateId ?? t.id;
    const entry = habits.get(key) ?? { scheduled: 0, missed: 0, ids: [] };
    entry.scheduled += 1;
    if (!t.completed && t.reminderExpired) {
      entry.missed += 1;
      entry.ids.push(t.id);
    }
    habits.set(key, entry);
  }
  for (const [id2, { scheduled, missed, ids }] of habits) {
    if (scheduled >= 4 && missed >= 3 && missed * 100 >= scheduled * 50) {
      result.push(
        signal(
          `habit/${id2}`,
          "habitAbsence",
          "\u8FD1\u4E00\u5468\u4E60\u60EF\u591A\u6B21\u672A\u5B8C\u6210",
          "warning",
          {
            habitId: id2,
            observedOccurrences: scheduled,
            missedOccurrences: missed,
            windowStart: weekStart2,
            windowEnd: snapshot.today,
            taskIds: ids
          },
          "\u662F\u65F6\u95F4\u5B89\u6392\u4E0D\u5408\u9002\u3001\u4EFB\u52A1\u592A\u96BE\u3001\u5916\u90E8\u5360\u7528\uFF0C\u8FD8\u662F\u5DF2\u7ECF\u4E0D\u60F3\u7EE7\u7EED\u8FD9\u4E2A\u4E60\u60EF\uFF1F\u5148\u786E\u8BA4\u539F\u56E0\u518D\u6539\u8BA1\u5212\u3002"
        )
      );
    }
  }
  const recentSessions = data.sessions.filter(
    (s) => s.source === "timer" && s.endedAt >= at - 7 * 86400
  );
  const late = recentSessions.filter((s) => {
    const hour = new Date(s.endedAt * 1e3).getHours();
    return !(hour >= 6 && hour < 23);
  });
  const distinctLate = new Set(late.map((s) => dateAt(s.endedAt)));
  if (distinctLate.size >= 3) {
    result.push(
      signal(
        "rhythm/late",
        "rhythmDrift",
        "\u8FD1\u4E00\u5468\u591A\u5929\u6709\u6DF1\u591C\u4E13\u6CE8\u8BB0\u5F55",
        "notice",
        {
          lateDates: [...distinctLate],
          lateSessionCount: late.length,
          window: "23:00\u201306:00 \u672C\u673A\u65F6\u95F4",
          sampleSessions: recentSessions.length
        },
        "\u8FD9\u662F\u4E34\u65F6\u5B89\u6392\u8FD8\u662F\u7B26\u5408\u4F60\u7684\u4F5C\u606F\uFF1F\u7ED3\u5408\u4F60\u786E\u8BA4\u7684\u7761\u7720\u548C\u8BFE\u7A0B\u4FE1\u606F\u5224\u65AD\uFF0C\u4E0D\u4EE5\u7EDF\u4E00\u4F5C\u606F\u8BC4\u4EF7\u7528\u6237\u3002"
      )
    );
  }
  const recentDays = [...byDay.keys()].filter((d) => d >= weekStart2).length;
  if (historical !== null && recentDays >= 3) {
    const recent = [...byDay.entries()].filter(([d]) => d >= weekStart2).map(([, m]) => m);
    if (recent.reduce((n, m) => n + m, 0) * 100 < historical * recent.length * 40) {
      result.push(
        signal(
          "engagement/drop",
          "engagementDrop",
          "\u8FD1\u671F\u8BB0\u5F55\u7684\u6295\u5165\u660E\u663E\u4E0B\u964D",
          "notice",
          {
            recentActiveDays: recent.length,
            recentMeanMinutes: recent.length > 0 ? Math.floor(recent.reduce((n, m) => n + m, 0) / recent.length) : 0,
            baselineMinutes: historical
          },
          "\u662F\u5426\u6709\u8003\u8BD5\u3001\u8BFE\u7A0B\u3001\u8EAB\u4F53\u72B6\u6001\u6216\u7EBF\u4E0B\u5B66\u4E60\u53D8\u5316\uFF1F\u5148\u8865\u5168\u8BB0\u5F55\u80CC\u666F\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u8C03\u6574\u8282\u594F\u3002"
        )
      );
    }
  }
  result.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  return result.slice(0, 30);
}

// packages/core/src/guard.ts
function allowed(window, ownPid, protection) {
  if (window.pid !== null && window.pid === ownPid) {
    return true;
  }
  return protection.mode === "off" || protection.mode === "whitelist" && window.appId !== null && protection.whitelist.some((allowedId) => allowedId === window.appId);
}
function formatAumid(id2) {
  return `aumid:${id2}`;
}
function isApplicationFrameHost(processPath) {
  const name = processPath.split(/[\\/]/).pop() ?? "";
  return name.toLowerCase() === "applicationframehost.exe";
}
function selectFrameContentPid(hostPid, children) {
  for (const child of children) {
    if (child.className === "Windows.UI.Core.CoreWindow" && child.pid !== 0 && child.pid !== hostPid) {
      return child.pid;
    }
  }
  return null;
}

// packages/core/src/engine.ts
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
function writeAtomic(path, data) {
  const raw = JSON.stringify(serializeAppData(data), null, 2);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, raw, "utf8");
  renameSync(tmp, path);
}
var Engine = class _Engine {
  path;
  data;
  save;
  constructor(path, data, save) {
    this.path = path;
    this.data = data;
    this.save = save;
  }
  /** 桌面适配层专用：合成器故障后强制解除保护；不是对外 Action。 */
  releaseFailedProtection(at) {
    const next = clone(this.data);
    next.record(at, false);
    next.resetTo("focus");
    releaseLock(next.lock, at);
    next.validate();
    this.persist(next);
    this.data = next;
  }
  /**
   * 旧 runtime 的「放弃当前番茄」：不写专注记录，只回到空闲专注。
   * 保护生效时拒绝（与其它写动作同一规则：不能借放弃绕开锁定）。
   */
  discardTimer() {
    if (this.data.strictProtected()) {
      throw new AppError("\u4E25\u683C\u6A21\u5F0F\u751F\u6548\u4E2D\uFF0C\u4E0D\u80FD\u63D0\u524D\u7ED3\u675F\u6216\u4FEE\u6539\uFF1B\u5230\u65F6\u81EA\u52A8\u89E3\u9664");
    }
    if (this.data.protected()) {
      throw new AppError(
        "\u4E13\u6CE8\u4FDD\u62A4\u4E2D\uFF0C\u7ED3\u675F\u524D\u4E0D\u80FD\u4FEE\u6539\u4EFB\u52A1\u6216\u8BA1\u65F6\uFF1B\u53EF\u63D0\u524D\u5B8C\u6210\u756A\u8304\u6216\u7D27\u6025\u9000\u51FA"
      );
    }
    const next = clone(this.data);
    next.resetTo("focus");
    next.validate();
    this.persist(next);
    this.data = next;
  }
  static open(path) {
    let raw = null;
    if (path !== ":memory:") {
      const parent = dirname(path);
      if (parent !== "." && parent !== "") {
        try {
          mkdirSync(parent, { recursive: true });
        } catch (e) {
          throw new AppError(String(e));
        }
      }
      try {
        raw = readFileSync(path, "utf8");
      } catch (e) {
        if (e.code !== "ENOENT") {
          throw new AppError(String(e));
        }
        raw = null;
      }
    }
    let data;
    if (raw !== null) {
      data = readLocalData(raw);
    } else {
      data = new AppData();
    }
    reconcileIdentities(clone(data), data, null);
    data.validate();
    const engine = new _Engine(
      path,
      data,
      path === ":memory:" ? () => {
      } : (next) => writeAtomic(path, next)
    );
    engine.persist(engine.data);
    return engine;
  }
  /**
   * 用调用方加载好的数据建引擎，并以调用方给的 `save` 落盘。
   * 数据仍走同一套身份登记与全量校验；`save` 抛错会原样传出，加载失败时
   * 调用方因此不会覆盖旧文件。
   */
  static fromData(data, save, path = ":memory:") {
    const next = clone(data);
    reconcileIdentities(clone(data), next, null);
    next.validate();
    const engine = new _Engine(path, next, save);
    engine.persist(engine.data);
    return engine;
  }
  persist(data) {
    this.save(data);
  }
  /** 与 dispatch 相同的身份/历史规则，但不持久化：用于审阅文件。 */
  previewAction(action, at) {
    const restoreId = (() => {
      if (action.type === "restoreTask") {
        const record = this.data.identities.find(
          (r) => r.id === action.task.id && r.retired && r.kind === "task"
        );
        if (record === void 0) {
          throw new AppError("\u6CA1\u6709\u5BF9\u5E94\u7684\u539F\u4EFB\u52A1\u6062\u590D\u8BB0\u5F55");
        }
        if (record.restoreTask !== JSON.stringify(serializeTask(action.task))) {
          throw new AppError("\u6062\u590D\u5185\u5BB9\u4E0E\u539F\u4EFB\u52A1\u4E0D\u4E00\u81F4\uFF0C\u5386\u53F2 ID \u4E0D\u80FD\u590D\u7528");
        }
        return action.task.id;
      }
      return null;
    })();
    const next = clone(this.data);
    next.apply(action, at);
    validateEducationTransition(this.data.education, next.education);
    reconcileIdentities(this.data, next, restoreId);
    validateIdentities(next);
    return next;
  }
  /** 只推进时间（计时/提醒/锁机/自动开工），不生成快照统计；每秒 tick 用。 */
  tick(at) {
    const next = clone(this.data);
    if (!next.tick(at)) return false;
    reconcileIdentities(this.data, next, null);
    next.validate();
    this.persist(next);
    this.data = clone(next);
    return true;
  }
  dispatch(action, at) {
    const next = this.previewAction(action, at);
    this.persist(next);
    this.data = next;
    return this.snapshot(at);
  }
  snapshot(at) {
    const next = clone(this.data);
    if (next.tick(at)) {
      reconcileIdentities(this.data, next, null);
      next.validate();
      this.persist(next);
      this.data = clone(next);
    }
    const kinds = {};
    for (const t of this.data.tasks) {
      kinds[t.id] = kindOf(t);
    }
    return {
      taskKinds: kinds,
      remainingSecs: timerRemaining(this.data.timer, at),
      stats: this.data.stats(at),
      studyProgress: summaries(next, at),
      data: next,
      today: dateAt(at),
      serverTime: at
    };
  }
  export(at) {
    this.snapshot(at);
    return JSON.stringify(serializeAppData(this.data), null, 2);
  }
};
export {
  AppData,
  AppError,
  Education,
  Engine,
  addDays,
  allowed,
  assistantOnly,
  atLocal,
  atLocalDate,
  atLocalDateString,
  band,
  blocksOnDate,
  charCount,
  checkText,
  checkUserAction,
  clone,
  completeTeachingTask,
  dateAt,
  daysBetween,
  deepEqual,
  defaultSettings,
  defaultTimer,
  deleteTemplate,
  diagnose,
  dueAutoTask,
  durationOf,
  ensure,
  examDeadline2 as examDeadline,
  exportPlan,
  formatAumid,
  formatDate,
  fromTask,
  hourMinuteOf,
  hourMinuteString,
  id,
  isAbsolutePath,
  isApplicationFrameHost,
  isHabit,
  isRelativePath,
  kindOf,
  localDateOf,
  materializeTeachingTasks,
  materializeTemplates,
  mergePlan,
  minutesOf,
  now,
  overlapMinutes,
  parseAction,
  parseActiveLock,
  parseAppData,
  parseAssessment,
  parseBlock,
  parseCalendarSlot,
  parseCommand,
  parseCompletedStudyTask,
  parseCorrection,
  parseDate,
  parseEducation,
  parseErrorAnalysis,
  parseGrade,
  parseHabit,
  parseIdentity,
  parseLesson,
  parseLockSchedule,
  parseLockState,
  parseMilestone,
  parsePlanFile,
  parsePointAward,
  parsePrintRecord,
  parsePrintSlot,
  parsePrinting,
  parseProgressRecord,
  parseProject,
  parseProjectStudy,
  parseProtection,
  parseQuestion,
  parseQuestionTime,
  parseResource,
  parseReview,
  parseScoringPoint,
  parseSemester,
  parseSession,
  parseSettings,
  parseShape,
  parseSubmission,
  parseSubtask,
  parseTask,
  parseTaskDraft,
  parseTeachingEvent,
  parseTemplate,
  parseTemplateSubtask,
  parseTimer,
  parseVision,
  pendingReminder,
  planEstimate,
  printInstances,
  printTemplate,
  readLocalData,
  reconcileIdentities,
  recordSession,
  releaseLock,
  reminderIdle,
  replaceAppData,
  require2 as require,
  requiredMinutes,
  resetTo,
  saveTemplate,
  scheduledAt,
  secondsOfDay,
  selectFrameContentPid,
  serializeActiveLock,
  serializeAppData,
  serializeAssessment,
  serializeBlock,
  serializeCompletedStudyTask,
  serializeCorrection,
  serializeEducation,
  serializeErrorAnalysis,
  serializeGrade,
  serializeHabit,
  serializeIdentity,
  serializeLesson,
  serializeLockSchedule,
  serializeLockState,
  serializeMilestone,
  serializePlanFile,
  serializePointAward,
  serializePrintRecord,
  serializePrinting,
  serializeProgressRecord,
  serializeProject,
  serializeProjectStudy,
  serializeProtection,
  serializeQuestion,
  serializeQuestionTime,
  serializeResource,
  serializeReview,
  serializeScoringPoint,
  serializeSemester,
  serializeSession,
  serializeSettings,
  serializeShape,
  serializeSubmission,
  serializeSubtask,
  serializeTask,
  serializeTeachingEvent,
  serializeTemplate,
  serializeTimer,
  serializeVision,
  startDueTask,
  startTeachingTask,
  startTimer,
  summaries,
  syncTemplate,
  taskHasRoundsLeft,
  taskIsVoid,
  teachingTask,
  templateInstance,
  templateRecurring,
  templateTimes,
  tickReminders,
  timerRemaining,
  utf8Len,
  validAppIds,
  validDate,
  validEducationDate,
  validTime,
  validateBlock,
  validateBlocks,
  validateEducation,
  validateEducationTransition,
  validateHabit,
  validateIdentities,
  validateLearning,
  validateLearningTransition,
  validateLock,
  validatePlanFile,
  validateReminderTask,
  validateTeachingTasks,
  validateTemplates,
  weekStart,
  weekdayMonday,
  windowMinutes
};
//! 错误约定：Rust 侧 `AppResult<T> = Result<T, String>`，这里统一改为抛出
//! `AppError`（message 即 Rust 的中文错误文案，测试逐字断言）。
//! 对应 Rust 的 `ok_or(msg)` 即 `throw new AppError(msg)`。
//! 实体 ID：UUID v4（对应 Rust `Uuid::new_v4().to_string()`）。
//! 优先用平台 `crypto.randomUUID`，退化时用 Math.random 实现 RFC 4122 v4。
//! 本地日历与时刻工具。
//!
//! 契约（docs/PLAN_FORMAT.md、docs/BACKUP_FORMAT.md、API.md）：
//! 所有时间戳都是 Unix 秒，按**本机时区**解读（对应 Rust `chrono::Local`）；
//! 日期为 `YYYY-MM-DD`，时间为 `HH:MM`。日历运算按「自然日」进行，不受夏令时影响
//! （对应 Rust `NaiveDate` 的 `checked_add_days`）。
//! 领域数据模型：与 crates/core 的 serde 结构一一对应。
//! 命名规则：TS 内部字段名即 JSON camelCase 名（对应 `#[serde(rename_all="camelCase")]`）。
//! 枚举是字符串字面量联合（serde camelCase 取值），序列化即直接输出。
//! 可选 JSON 字段（serde `Option` / `#[serde(default)]`）解析后统一为 `T | null` 或缺省值；
//! 序列化时按 Rust 的 `skip_serializing_if` 决定是否省略键。
//! JSON 严格解码助手：模拟 serde 的 `deny_unknown_fields`、`#[serde(default)]`
//! 与 camelCase 命名。序列化由各模块手写（键序固定、与 Rust 声明序一致），
//! 保证导出 JSON 形状与旧引擎逐字节可比。
//! 定时锁机：数据模型、跨午夜本地周历、重叠检查与本轮抑制。
//! 对应 crates/core/src/lock.rs。**纯计算**——桌面锁屏执行由原生 guard 负责，
//! runtime 用本模块算出 active 状态后指挥 guard。
//! 课表阻塞时段：计划之外的每周固定占用（课程、实验）。纯描述：不带进度、不管辖实例、不锁机。
//! 对应 crates/core/src/blocks.rs。
//! 习惯组：只带管辖；形状与印刷规则由 templates 管理。
//! 对应 crates/core/src/habits.rs。
//! 时间安排：日期/时间与单次时长校验、当天待处理队列、计时/锁机延后、跨日清理。
//! 对应 crates/core/src/reminders.rs。
//! 模板与印刷：形状印时复制，账本独立于实例，删了不会重现。
//! 对应 crates/core/src/templates.rs。AppData 方法以自由函数 + lib.ts 薄包装提供。
//! 学情证据：已完成任务快照、来源可审计且不可覆写的进度历史、订正检查，
//! 按提交/批改/订正索引计算动态学情摘要及掌握/计时/订正/复测分层。
//! 对应 crates/core/src/learning.rs。
//! 教学实体、持久化事件、资源引用与历史保护。
//! 对应 crates/core/src/education.rs。
//! 教学执行：课程/作业到普通待办的一对一来源关联、改期更新、明确参与、
//! 提交完成与重复作业抑制；计划导出排除并保留教学待办。
//! 对应 crates/core/src/teaching_tasks.rs。
//! 实体身份：删除后仍保留登记；撤销恢复同一任务；跨类型唯一。
//! 对应 crates/core/src/identities.rs。
//! 学习计划 v6：便携计划刻意不含执行历史与本机偏好。
//! 对应 crates/core/src/plan.rs。
//! 共享模型、计时状态机与校验入口。
//! 对应 crates/core/src/lib.rs（Engine 在 engine.ts，桌面 guard 原生保留）。
//! 仅本地 v3→v4 转换：交换文件按当前版本严格校验，不走迁移路径。
//! 对应 crates/core/src/migration.rs（仅文件格式语义）。
//! 可解释的本地信号。不调模型、不猜缺失数据、不自动下结论。
//! 对应 crates/core/src/diagnostics.rs。
//! 专注保护的纯计算部分：窗口集合与白名单判定。
//! 对应 crates/core/src/guard.rs 的 `allowed` 与 guard_windows.rs 的
//! app-id 解析（AUMID / ApplicationFrameHost 共享 UWP 框架 / 完整进程路径）。
//! 不做任何桌面调用——枚举、聚焦与锁屏执行由原生 guard 负责。
//! Engine：预检/提交/持久化/快照。对应 crates/core/src/lib.rs 的 Engine。
//! 持久化：旧引擎用 SQLite；新架构（MIGRATION.md/API.md）以 JSON 文件为唯一数据源。
//! 本实现有两种存储入口：
//! - `Engine.open(path)`：单 JSON 文件（原子写），对应旧 Engine::open(path)；
//! - `Engine.fromData(data, save)`：调用方自带存储（runtime 用它把同一份 AppData
//!   拆成 plan.json/state.json 两个文件）。存储策略只影响落盘方式，校验、身份登记、
//!   教学转移与保护规则完全共用。
//! @tomato/core —— 番茄 Todo 领域核心（crates/core 的语义级 TypeScript 移植）。
//! 零运行时依赖、纯 ESM、可在 Node 直接 import。外部 JSON 形状与旧引擎一致：
//! camelCase、日期 `YYYY-MM-DD`、时间 `HH:MM`、时间戳 Unix 秒
//! （见 docs/PLAN_FORMAT.md 与 docs/BACKUP_FORMAT.md）。
//! 模块索引见 packages/core/CODEMAP.md。
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZXJyb3JzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2lkcy50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy90aW1lLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL21vZGVsLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2pzb24udHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvbG9jay50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9ibG9ja3MudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvaGFiaXRzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbWluZGVycy50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy90ZW1wbGF0ZXMudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvbGVhcm5pbmcudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZWR1Y2F0aW9uLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3RlYWNoaW5nX3Rhc2tzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2lkZW50aXRpZXMudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcGxhbi50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9saWIudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvbWlncmF0aW9uLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2RpYWdub3N0aWNzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2d1YXJkLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2VuZ2luZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8hIFx1OTUxOVx1OEJFRlx1N0VBNlx1NUI5QVx1RkYxQVJ1c3QgXHU0RkE3IGBBcHBSZXN1bHQ8VD4gPSBSZXN1bHQ8VCwgU3RyaW5nPmBcdUZGMENcdThGRDlcdTkxQ0NcdTdFREZcdTRFMDBcdTY1MzlcdTRFM0FcdTYyOUJcdTUxRkFcbi8vISBgQXBwRXJyb3JgXHVGRjA4bWVzc2FnZSBcdTUzNzMgUnVzdCBcdTc2ODRcdTRFMkRcdTY1ODdcdTk1MTlcdThCRUZcdTY1ODdcdTY4NDhcdUZGMENcdTZENEJcdThCRDVcdTkwMTBcdTVCNTdcdTY1QURcdThBMDBcdUZGMDlcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgUnVzdCBcdTc2ODQgYG9rX29yKG1zZylgIFx1NTM3MyBgdGhyb3cgbmV3IEFwcEVycm9yKG1zZylgXHUzMDAyXG5cbmV4cG9ydCBjbGFzcyBBcHBFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJBcHBFcnJvclwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbnN1cmUob2s6IGJvb2xlYW4sIG1lc3NhZ2U6IHN0cmluZyk6IGFzc2VydHMgb2sge1xuICBpZiAoIW9rKSB0aHJvdyBuZXcgQXBwRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKiBcdTVCRjkgZmluZC9tYXAuZ2V0IFx1N0I0OVx1NTNFRlx1N0E3QVx1N0VEM1x1Njc5Q1x1NTA1QVx1NjUzNlx1N0E4NFx1RkYxQVJ1c3QgYG9rX29yKG1zZyk/YCBcdTc2ODRcdTc2RjRcdTYzQTVcdTVCRjlcdTVFOTRcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlPFQ+KHZhbHVlOiBUIHwgbnVsbCB8IHVuZGVmaW5lZCwgbWVzc2FnZTogc3RyaW5nKTogVCB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgQXBwRXJyb3IobWVzc2FnZSk7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqIFx1NUI1N1x1N0IyNlx1NjU3MFx1RkYwOFVuaWNvZGUgXHU3ODAxXHU3MEI5XHVGRjA5XHVGRjBDXHU1QkY5XHU1RTk0IFJ1c3QgYHMuY2hhcnMoKS5jb3VudCgpYFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoYXJDb3VudChzOiBzdHJpbmcpOiBudW1iZXIge1xuICByZXR1cm4gQXJyYXkuZnJvbShzKS5sZW5ndGg7XG59XG5cbi8qKiBVVEYtOCBcdTVCNTdcdTgyODJcdTY1NzBcdUZGMENcdTVCRjlcdTVFOTQgUnVzdCBgcy5sZW4oKWBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB1dGY4TGVuKHM6IHN0cmluZyk6IG51bWJlciB7XG4gIGlmICh0eXBlb2YgVGV4dEVuY29kZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXR1cm4gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHMpLmxlbmd0aDtcbiAgfVxuICAvLyBcdTRGRERcdTVCODhcdTU2REVcdTkwMDBcdUZGMUFcdTYzMDkgMyBcdTVCNTdcdTgyODIvXHU3ODAxXHU3MEI5XHU0RjMwXHU3Qjk3XHVGRjA4QVNDSUkgXHU0RUU1XHU0RTBCXHU0RjMwXHU5QUQ4XHU0RTBEXHU0RjFBXHU2NTNFXHU4RkM3XHU4RDg1XHU5NTdGXHU4RjkzXHU1MTY1XHVGRjA5XHUzMDAyXG4gIHJldHVybiBjaGFyQ291bnQocykgKiAzO1xufVxuXG4vKiogXHU2REYxXHU1RUE2XHU1MTRCXHU5Njg2XHU1RTc2XHU0RkREXHU3NTU5XHU1MzlGXHU1NzhCXHVGRjA4QXBwRGF0YS9FZHVjYXRpb24gXHU3QjQ5XHU3QzdCXHU1QjlFXHU0RjhCXHU1MTRCXHU5Njg2XHU1NDBFXHU2NUI5XHU2Q0Q1XHU0RUNEXHU1M0VGXHU3NTI4XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gY2xvbmU8VD4odmFsdWU6IFQpOiBUIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlLm1hcCgodikgPT4gY2xvbmUodikpIGFzIHVua25vd24gYXMgVDtcbiAgfVxuICBpZiAodmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgY29uc3Qgb3V0ID0gT2JqZWN0LmNyZWF0ZShPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpKSBhcyBSZWNvcmQ8XG4gICAgICBzdHJpbmcsXG4gICAgICB1bmtub3duXG4gICAgPjtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyh2YWx1ZSkpIHtcbiAgICAgIG91dFtrZXldID0gY2xvbmUoKHZhbHVlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrZXldKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dCBhcyBUO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqIFx1N0VEM1x1Njc4NFx1NTMxNlx1NzZGOFx1N0I0OVx1RkYxQUpTT04gXHU1MDNDXHU3RUE3XHU1MjJCXHU3Njg0XHU2REYxXHU1RUE2XHU2QkQ0XHU4RjgzXHVGRjA4XHU1NDJCXHU1QjU3XHU2QkI1XHU5ODdBXHU1RThGXHU2NUUwXHU1MTczXHU3Njg0XHU5NTJFXHU2QkQ0XHU4RjgzXHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gZGVlcEVxdWFsKGE6IHVua25vd24sIGI6IHVua25vd24pOiBib29sZWFuIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoQXJyYXkuaXNBcnJheShhKSAmJiBBcnJheS5pc0FycmF5KGIpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoID09PSBiLmxlbmd0aCAmJiBhLmV2ZXJ5KCh2LCBpKSA9PiBkZWVwRXF1YWwodiwgYltpXSkpO1xuICB9XG4gIGlmIChcbiAgICB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiAmJlxuICAgIGEgIT09IG51bGwgJiZcbiAgICB0eXBlb2YgYiA9PT0gXCJvYmplY3RcIiAmJlxuICAgIGIgIT09IG51bGwgJiZcbiAgICAhQXJyYXkuaXNBcnJheShhKSAmJlxuICAgICFBcnJheS5pc0FycmF5KGIpXG4gICkge1xuICAgIGNvbnN0IGthID0gT2JqZWN0LmtleXMoYSk7XG4gICAgY29uc3Qga2IgPSBPYmplY3Qua2V5cyhiKTtcbiAgICBpZiAoa2EubGVuZ3RoICE9PSBrYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4ga2EuZXZlcnkoKGspID0+XG4gICAgICBkZWVwRXF1YWwoXG4gICAgICAgIChhIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrXSxcbiAgICAgICAgKGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW2tdLFxuICAgICAgKSxcbiAgICApO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbiIsICIvLyEgXHU1QjlFXHU0RjUzIElEXHVGRjFBVVVJRCB2NFx1RkYwOFx1NUJGOVx1NUU5NCBSdXN0IGBVdWlkOjpuZXdfdjQoKS50b19zdHJpbmcoKWBcdUZGMDlcdTMwMDJcbi8vISBcdTRGMThcdTUxNDhcdTc1MjhcdTVFNzNcdTUzRjAgYGNyeXB0by5yYW5kb21VVUlEYFx1RkYwQ1x1OTAwMFx1NTMxNlx1NjVGNlx1NzUyOCBNYXRoLnJhbmRvbSBcdTVCOUVcdTczQjAgUkZDIDQxMjIgdjRcdTMwMDJcblxuZXhwb3J0IGZ1bmN0aW9uIGlkKCk6IHN0cmluZyB7XG4gIGNvbnN0IGNyeXB0byA9IGdsb2JhbFRoaXMuY3J5cHRvIGFzIHsgcmFuZG9tVVVJRD86ICgpID0+IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuICBpZiAoY3J5cHRvICYmIHR5cGVvZiBjcnlwdG8ucmFuZG9tVVVJRCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIGNyeXB0by5yYW5kb21VVUlEKCk7XG4gIH1cbiAgLy8gUkZDIDQxMjIgdjQgXHU5MDAwXHU1MzE2XHU1QjlFXHU3M0IwXHVGRjA4XHU0RUM1XHU3NTI4XHU0RThFXHU2NUUwIGNyeXB0byBcdTc2ODRcdTczQUZcdTU4ODNcdUZGMDlcdTMwMDJcbiAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgMTY7IGkgKz0gMSkgYnl0ZXNbaV0gPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAyNTYpO1xuICBieXRlc1s2XSA9IChieXRlc1s2XSEgJiAweDBmKSB8IDB4NDA7XG4gIGJ5dGVzWzhdID0gKGJ5dGVzWzhdISAmIDB4M2YpIHwgMHg4MDtcbiAgY29uc3QgaGV4ID0gQXJyYXkuZnJvbShieXRlcywgKGIpID0+IGIudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsIFwiMFwiKSkuam9pbihcbiAgICBcIlwiLFxuICApO1xuICByZXR1cm4gYCR7aGV4LnNsaWNlKDAsIDgpfS0ke2hleC5zbGljZSg4LCAxMil9LSR7aGV4LnNsaWNlKDEyLCAxNil9LSR7aGV4LnNsaWNlKDE2LCAyMCl9LSR7aGV4LnNsaWNlKDIwKX1gO1xufVxuIiwgIi8vISBcdTY3MkNcdTU3MzBcdTY1RTVcdTUzODZcdTRFMEVcdTY1RjZcdTUyM0JcdTVERTVcdTUxNzdcdTMwMDJcbi8vIVxuLy8hIFx1NTk1MVx1N0VBNlx1RkYwOGRvY3MvUExBTl9GT1JNQVQubWRcdTMwMDFkb2NzL0JBQ0tVUF9GT1JNQVQubWRcdTMwMDFBUEkubWRcdUZGMDlcdUZGMUFcbi8vISBcdTYyNDBcdTY3MDlcdTY1RjZcdTk1RjRcdTYyMzNcdTkwRkRcdTY2MkYgVW5peCBcdTc5RDJcdUZGMENcdTYzMDkqKlx1NjcyQ1x1NjczQVx1NjVGNlx1NTMzQSoqXHU4OUUzXHU4QkZCXHVGRjA4XHU1QkY5XHU1RTk0IFJ1c3QgYGNocm9ubzo6TG9jYWxgXHVGRjA5XHVGRjFCXG4vLyEgXHU2NUU1XHU2NzFGXHU0RTNBIGBZWVlZLU1NLUREYFx1RkYwQ1x1NjVGNlx1OTVGNFx1NEUzQSBgSEg6TU1gXHUzMDAyXHU2NUU1XHU1Mzg2XHU4RkQwXHU3Qjk3XHU2MzA5XHUzMDBDXHU4MUVBXHU3MTM2XHU2NUU1XHUzMDBEXHU4RkRCXHU4ODRDXHVGRjBDXHU0RTBEXHU1M0Q3XHU1OTBGXHU0RUU0XHU2NUY2XHU1RjcxXHU1NENEXG4vLyEgXHVGRjA4XHU1QkY5XHU1RTk0IFJ1c3QgYE5haXZlRGF0ZWAgXHU3Njg0IGBjaGVja2VkX2FkZF9kYXlzYFx1RkYwOVx1MzAwMlxuXG5leHBvcnQgaW50ZXJmYWNlIENhbGVuZGFyRGF0ZSB7XG4gIHllYXI6IG51bWJlcjtcbiAgbW9udGg6IG51bWJlcjtcbiAgZGF5OiBudW1iZXI7XG59XG5cbmNvbnN0IERBWV9NUyA9IDg2NDAwMDAwO1xuXG5jb25zdCBwYWQyID0gKG46IG51bWJlcik6IHN0cmluZyA9PiAobiA8IDEwID8gYDAke259YCA6IFN0cmluZyhuKSk7XG5jb25zdCBwYWQ0ID0gKG46IG51bWJlcik6IHN0cmluZyA9PiBTdHJpbmcobikucGFkU3RhcnQoNCwgXCIwXCIpO1xuXG4vKiogVW5peCBcdTc5RDIgXHUyMTkyIFx1NjcyQ1x1NjczQVx1NjVFNVx1NTM4Nlx1NjVFNVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvY2FsRGF0ZU9mKGF0OiBudW1iZXIpOiBDYWxlbmRhckRhdGUge1xuICBjb25zdCBkID0gbmV3IERhdGUoYXQgKiAxMDAwKTtcbiAgcmV0dXJuIHsgeWVhcjogZC5nZXRGdWxsWWVhcigpLCBtb250aDogZC5nZXRNb250aCgpICsgMSwgZGF5OiBkLmdldERhdGUoKSB9O1xufVxuXG4vKiogVW5peCBcdTc5RDIgXHUyMTkyIFx1NjcyQ1x1NjczQVx1NjVFNVx1NjcxRiBgWVlZWS1NTS1ERGBcdUZGMDhcdTVCRjlcdTVFOTQgYGNyYXRlOjpkYXRlX2F0YFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRhdGVBdChhdDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgeyB5ZWFyLCBtb250aCwgZGF5IH0gPSBsb2NhbERhdGVPZihhdCk7XG4gIHJldHVybiBgJHtwYWQ0KHllYXIpfS0ke3BhZDIobW9udGgpfS0ke3BhZDIoZGF5KX1gO1xufVxuXG4vKipcbiAqIFx1ODlFM1x1Njc5MCBgWVlZWS1NTS1ERGBcdUZGMUJcdTY1RTBcdTY1NDhcdTYyMTZcdTk3NUVcdTc3MUZcdTVCOUVcdTY1RTVcdTY3MUZcdUZGMDhcdTU5ODIgMjAyNi0wMi0zMFx1RkYwOVx1OEZENFx1NTZERSBudWxsXHUzMDAyXG4gKiBcdTVCRjlcdTVFOTQgYE5haXZlRGF0ZTo6cGFyc2VfZnJvbV9zdHIocywgXCIlWS0lbS0lZFwiKWBcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRGF0ZSh2YWx1ZTogc3RyaW5nKTogQ2FsZW5kYXJEYXRlIHwgbnVsbCB7XG4gIGlmICghL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QodmFsdWUpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgeWVhciA9IE51bWJlcih2YWx1ZS5zbGljZSgwLCA0KSk7XG4gIGNvbnN0IG1vbnRoID0gTnVtYmVyKHZhbHVlLnNsaWNlKDUsIDcpKTtcbiAgY29uc3QgZGF5ID0gTnVtYmVyKHZhbHVlLnNsaWNlKDgsIDEwKSk7XG4gIGNvbnN0IHByb2JlID0gbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgbW9udGggLSAxLCBkYXkpKTtcbiAgaWYgKFxuICAgIHByb2JlLmdldFVUQ0Z1bGxZZWFyKCkgIT09IHllYXIgfHxcbiAgICBwcm9iZS5nZXRVVENNb250aCgpICE9PSBtb250aCAtIDEgfHxcbiAgICBwcm9iZS5nZXRVVENEYXRlKCkgIT09IGRheVxuICApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4geyB5ZWFyLCBtb250aCwgZGF5IH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZERhdGUodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gcGFyc2VEYXRlKHZhbHVlKSAhPT0gbnVsbDtcbn1cblxuLyoqIFx1ODFFQVx1NzEzNlx1NjVFNVx1NTJBMFx1NkNENVx1RkYwOFx1NTNFRlx1OEQxRlx1RkYwOVx1RkYwQ1x1NEUwRVx1NTkwRlx1NEVFNFx1NjVGNlx1NjVFMFx1NTE3M1x1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFkZERheXMoZGF0ZTogQ2FsZW5kYXJEYXRlLCBkYXlzOiBudW1iZXIpOiBDYWxlbmRhckRhdGUge1xuICBjb25zdCB0ID0gbmV3IERhdGUoRGF0ZS5VVEMoZGF0ZS55ZWFyLCBkYXRlLm1vbnRoIC0gMSwgZGF0ZS5kYXkgKyBkYXlzKSk7XG4gIHJldHVybiB7XG4gICAgeWVhcjogdC5nZXRVVENGdWxsWWVhcigpLFxuICAgIG1vbnRoOiB0LmdldFVUQ01vbnRoKCkgKyAxLFxuICAgIGRheTogdC5nZXRVVENEYXRlKCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wYXJlRGF0ZXMoYTogQ2FsZW5kYXJEYXRlLCBiOiBDYWxlbmRhckRhdGUpOiBudW1iZXIge1xuICByZXR1cm4gYS55ZWFyIC0gYi55ZWFyIHx8IGEubW9udGggLSBiLm1vbnRoIHx8IGEuZGF5IC0gYi5kYXk7XG59XG5cbi8qKiAxID0gXHU1NDY4XHU0RTAwIFx1MjAyNiA3ID0gXHU1NDY4XHU2NUU1XHVGRjA4XHU1QkY5XHU1RTk0IGB3ZWVrZGF5KCkubnVtYmVyX2Zyb21fbW9uZGF5KClgXHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gd2Vla2RheU1vbmRheShkYXRlOiBDYWxlbmRhckRhdGUpOiBudW1iZXIge1xuICBjb25zdCBkYXkgPSBuZXcgRGF0ZShcbiAgICBEYXRlLlVUQyhkYXRlLnllYXIsIGRhdGUubW9udGggLSAxLCBkYXRlLmRheSksXG4gICkuZ2V0VVRDRGF5KCk7IC8vIDAgPSBTdW5kYXlcbiAgcmV0dXJuIGRheSA9PT0gMCA/IDcgOiBkYXk7XG59XG5cbi8qKiBcdTYyNDBcdTU3MjhcdTU0NjhcdTc2ODRcdTU0NjhcdTRFMDBcdUZGMDhcdTVCRjlcdTVFOTQgdGVtcGxhdGVzOjp3ZWVrX3N0YXJ0XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gd2Vla1N0YXJ0KGRhdGU6IENhbGVuZGFyRGF0ZSk6IENhbGVuZGFyRGF0ZSB7XG4gIHJldHVybiBhZGREYXlzKGRhdGUsIC0od2Vla2RheU1vbmRheShkYXRlKSAtIDEpKTtcbn1cblxuLyoqIFx1NEUyNFx1NEUyQVx1NjVFNVx1NTM4Nlx1NjVFNVx1NzZGOFx1NURFRVx1NzY4NFx1ODFFQVx1NzEzNlx1NjVFNVx1NjU3MFx1RkYwOHRvIC0gZnJvbVx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRheXNCZXR3ZWVuKGZyb206IENhbGVuZGFyRGF0ZSwgdG86IENhbGVuZGFyRGF0ZSk6IG51bWJlciB7XG4gIGNvbnN0IGEgPSBEYXRlLlVUQyhmcm9tLnllYXIsIGZyb20ubW9udGggLSAxLCBmcm9tLmRheSk7XG4gIGNvbnN0IGIgPSBEYXRlLlVUQyh0by55ZWFyLCB0by5tb250aCAtIDEsIHRvLmRheSk7XG4gIHJldHVybiBNYXRoLmZsb29yKChiIC0gYSkgLyBEQVlfTVMpO1xufVxuXG4vKiogXHU2NUU1XHU1Mzg2XHU2NUU1IFx1MjE5MiBgWVlZWS1NTS1ERGBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXREYXRlKGRhdGU6IENhbGVuZGFyRGF0ZSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwYWQ0KGRhdGUueWVhcil9LSR7cGFkMihkYXRlLm1vbnRoKX0tJHtwYWQyKGRhdGUuZGF5KX1gO1xufVxuXG4vKiogXHU2NzJDXHU2NzNBXHU2NUU1XHU2NzFGXHU2NUY2XHU1MjNCIFx1MjE5MiBVbml4IFx1NzlEMlx1RkYwOFx1NUJGOVx1NUU5NCBgTG9jYWwud2l0aF95bWRfYW5kX2htcyguLi4pLnRpbWVzdGFtcCgpYFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGF0TG9jYWwoXG4gIHllYXI6IG51bWJlcixcbiAgbW9udGg6IG51bWJlcixcbiAgZGF5OiBudW1iZXIsXG4gIGhvdXI6IG51bWJlcixcbiAgbWludXRlOiBudW1iZXIsXG4gIHNlY29uZCA9IDAsXG4pOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5mbG9vcihcbiAgICBuZXcgRGF0ZSh5ZWFyLCBtb250aCAtIDEsIGRheSwgaG91ciwgbWludXRlLCBzZWNvbmQpLmdldFRpbWUoKSAvIDEwMDAsXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdExvY2FsRGF0ZShkYXRlOiBDYWxlbmRhckRhdGUsIGhvdXIgPSAwLCBtaW51dGUgPSAwKTogbnVtYmVyIHtcbiAgcmV0dXJuIGF0TG9jYWwoZGF0ZS55ZWFyLCBkYXRlLm1vbnRoLCBkYXRlLmRheSwgaG91ciwgbWludXRlKTtcbn1cblxuLyoqIGBZWVlZLU1NLUREYCBcdTIxOTIgXHU4QkU1XHU2NUU1XHU2NzJDXHU2NzNBIDAwOjAwIFx1NzY4NCBVbml4IFx1NzlEMlx1RkYxQlx1NjVFMFx1NjU0OFx1NjVFNVx1NjcxRlx1OEZENFx1NTZERSBudWxsXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gYXRMb2NhbERhdGVTdHJpbmcoZGF0ZTogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIGNvbnN0IHBhcnNlZCA9IHBhcnNlRGF0ZShkYXRlKTtcbiAgaWYgKHBhcnNlZCA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBhdExvY2FsRGF0ZShwYXJzZWQpO1xufVxuXG4vKiogVW5peCBcdTc5RDIgXHUyMTkyIFx1NjcyQ1x1NjczQSBgSEg6TU1gXHVGRjA4XHU1QkY5XHU1RTk0IGB0LmZvcm1hdChcIiVIOiVNXCIpYFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhvdXJNaW51dGVTdHJpbmcoYXQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShhdCAqIDEwMDApO1xuICByZXR1cm4gYCR7cGFkMihkLmdldEhvdXJzKCkpfToke3BhZDIoZC5nZXRNaW51dGVzKCkpfWA7XG59XG5cbi8qKiBVbml4IFx1NzlEMiBcdTIxOTIgXHU2NzJDXHU2NzNBXHU1RjUzXHU1OTI5XHU1REYyXHU4RkM3XHU3OUQyXHU2NTcwXHVGRjA4MFx1MjAxMzg2Mzk5XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gc2Vjb25kc09mRGF5KGF0OiBudW1iZXIpOiBudW1iZXIge1xuICBjb25zdCBkID0gbmV3IERhdGUoYXQgKiAxMDAwKTtcbiAgcmV0dXJuIGQuZ2V0SG91cnMoKSAqIDM2MDAgKyBkLmdldE1pbnV0ZXMoKSAqIDYwICsgZC5nZXRTZWNvbmRzKCk7XG59XG5cbi8qKiBVbml4IFx1NzlEMiBcdTIxOTIgXHU2NzJDXHU2NzNBIGAoaG91ciwgbWludXRlKWBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBob3VyTWludXRlT2YoYXQ6IG51bWJlcik6IHsgaG91cjogbnVtYmVyOyBtaW51dGU6IG51bWJlciB9IHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKGF0ICogMTAwMCk7XG4gIHJldHVybiB7IGhvdXI6IGQuZ2V0SG91cnMoKSwgbWludXRlOiBkLmdldE1pbnV0ZXMoKSB9O1xufVxuXG4vKipcbiAqIFx1NjgyMVx1OUE4QyBgSEg6TU1gXHVGRjFBXHU5NTdGXHU1RUE2IDVcdTMwMDFcdTdCMkMgMyBcdTRGNERcdTY2MkYgYDpgXHUzMDAxXHU2NTcwXHU1QjU3XHU0RTE0IFx1NUMwRlx1NjVGNiBcdTIyNjQgMjNcdTMwMDFcdTUyMDZcdTk0OUYgXHUyMjY0IDU5XHUzMDAyXG4gKiBcdTVCRjlcdTVFOTQgdGVtcGxhdGVzOjp2YWxpZF90aW1lXHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZFRpbWUodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIHZhbHVlLmxlbmd0aCA9PT0gNSAmJlxuICAgIHZhbHVlLmNoYXJDb2RlQXQoMikgPT09IDU4IC8qICc6JyAqLyAmJlxuICAgIHZhbHVlLnNsaWNlKDAsIDIpID49IFwiMDBcIiAmJlxuICAgIHZhbHVlLnNsaWNlKDAsIDIpIDw9IFwiMjNcIiAmJlxuICAgIHZhbHVlLnNsaWNlKDMpID49IFwiMDBcIiAmJlxuICAgIHZhbHVlLnNsaWNlKDMpIDw9IFwiNTlcIlxuICApO1xufVxuXG4vKiogYEhIOk1NYCBcdTIxOTIgXHU1MjA2XHU5NDlGXHU2NTcwXHVGRjFCXHU2NUUwXHU2NTQ4XHU4RkQ0XHU1NkRFIG51bGxcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW51dGVzT2YodmFsdWU6IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICBpZiAodmFsdWUubGVuZ3RoICE9PSA1IHx8IHZhbHVlLmNoYXJDb2RlQXQoMikgIT09IDU4KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgaG91ciA9IE51bWJlcih2YWx1ZS5zbGljZSgwLCAyKSk7XG4gIGNvbnN0IG1pbnV0ZSA9IE51bWJlcih2YWx1ZS5zbGljZSgzKSk7XG4gIGlmIChcbiAgICAhTnVtYmVyLmlzSW50ZWdlcihob3VyKSB8fFxuICAgICFOdW1iZXIuaXNJbnRlZ2VyKG1pbnV0ZSkgfHxcbiAgICBob3VyID4gMjMgfHxcbiAgICBtaW51dGUgPiA1OVxuICApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4gaG91ciAqIDYwICsgbWludXRlO1xufVxuXG4vKiogXHU1RjUzXHU1MjREIFVuaXggXHU3OUQyXHVGRjA4XHU1QkY5XHU1RTk0IGBjcmF0ZTo6bm93YFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vdygpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG59XG4iLCAiLy8hIFx1OTg4Nlx1NTdERlx1NjU3MFx1NjM2RVx1NkEyMVx1NTc4Qlx1RkYxQVx1NEUwRSBjcmF0ZXMvY29yZSBcdTc2ODQgc2VyZGUgXHU3RUQzXHU2Nzg0XHU0RTAwXHU0RTAwXHU1QkY5XHU1RTk0XHUzMDAyXG4vLyFcbi8vISBcdTU0N0RcdTU0MERcdTg5QzRcdTUyMTlcdUZGMUFUUyBcdTUxODVcdTkwRThcdTVCNTdcdTZCQjVcdTU0MERcdTUzNzMgSlNPTiBjYW1lbENhc2UgXHU1NDBEXHVGRjA4XHU1QkY5XHU1RTk0IGAjW3NlcmRlKHJlbmFtZV9hbGw9XCJjYW1lbENhc2VcIildYFx1RkYwOVx1MzAwMlxuLy8hIFx1Njc5QVx1NEUzRVx1NjYyRlx1NUI1N1x1N0IyNlx1NEUzMlx1NUI1N1x1OTc2Mlx1OTFDRlx1ODA1NFx1NTQwOFx1RkYwOHNlcmRlIGNhbWVsQ2FzZSBcdTUzRDZcdTUwM0NcdUZGMDlcdUZGMENcdTVFOEZcdTUyMTdcdTUzMTZcdTUzNzNcdTc2RjRcdTYzQTVcdThGOTNcdTUxRkFcdTMwMDJcbi8vISBcdTUzRUZcdTkwMDkgSlNPTiBcdTVCNTdcdTZCQjVcdUZGMDhzZXJkZSBgT3B0aW9uYCAvIGAjW3NlcmRlKGRlZmF1bHQpXWBcdUZGMDlcdTg5RTNcdTY3OTBcdTU0MEVcdTdFREZcdTRFMDBcdTRFM0EgYFQgfCBudWxsYCBcdTYyMTZcdTdGM0FcdTc3MDFcdTUwM0NcdUZGMUJcbi8vISBcdTVFOEZcdTUyMTdcdTUzMTZcdTY1RjZcdTYzMDkgUnVzdCBcdTc2ODQgYHNraXBfc2VyaWFsaXppbmdfaWZgIFx1NTFCM1x1NUI5QVx1NjYyRlx1NTQyNlx1NzcwMVx1NzU2NVx1OTUyRVx1MzAwMlxuXG5leHBvcnQgaW50ZXJmYWNlIFByb2plY3Qge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbG9yOiBzdHJpbmc7XG4gIC8qKiBcdTYzRDBcdTRGOUJcdTY1RjZcdTY2RkZcdTRFRTNcdTkwMUFcdTc1MjhcdTc2N0RcdTU0MERcdTUzNTVcdUZGMUJcdTVFOEZcdTUyMTdcdTUzMTZcdTY1RjYgbnVsbCBcdTc3MDFcdTc1NjVcdUZGMDhza2lwX3NlcmlhbGl6aW5nX2lmXHVGRjA5XHUzMDAyICovXG4gIGFwcFdoaXRlbGlzdDogc3RyaW5nW10gfCBudWxsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhhYml0U2xvdCB7XG4gIC8qKiAxID0gXHU1NDY4XHU0RTAwIFx1MjAyNiA3ID0gXHU1NDY4XHU2NUU1XHUzMDAyICovXG4gIGRheXM6IG51bWJlcltdO1xuICB0aW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFiaXQge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlzaW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICAvKiogXHU1RThGXHU1MjE3XHU1MzE2XHU2NUY2IG51bGwgXHU3NzAxXHU3NTY1XHUzMDAyICovXG4gIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJ0YXNrIHtcbiAgaWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgZG9uZTogYm9vbGVhbjtcbn1cblxuLyoqIFx1N0JBMVx1OEY5Nlx1NTIwNlx1N0M3Qlx1RkYxQVx1NzUzMVx1NTFCQlx1N0VEM1x1NUI1N1x1NkJCNVx1NjNBOFx1NUJGQ1x1RkYwQ1x1NkMzOFx1NEUwRFx1NEY1Q1x1NEUzQVx1NzUyOFx1NjIzN1x1NjU3MFx1NjM2RVx1NUI1OFx1NTBBOFx1MzAwMiAqL1xuZXhwb3J0IHR5cGUgVGFza0tpbmQgPSBcIm9yZGluYXJ5XCIgfCBcImhhYml0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFzayB7XG4gIGlkOiBzdHJpbmc7XG4gIHRlbXBsYXRlSWQ6IHN0cmluZyB8IG51bGw7XG4gIC8qKiBcdTUzNzBcdTUyMzdcdTY1RjZcdTUxQkJcdTdFRDNcdTc2ODRcdTkxQ0RcdTU5MERcdTY3NjVcdTZFOTBcdUZGMUJcdTY1MzlcdTZBMjFcdTY3N0ZcdTRFMERcdTkxQ0RcdTUxOTlcdTUzODZcdTUzRjJcdTUyMDZcdTdDN0JcdTMwMDIgKi9cbiAgcmVjdXJyaW5nOiBib29sZWFuO1xuICB0aXRsZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGhhYml0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGR1ZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIHJlbWluZGVyVGltZTogc3RyaW5nIHwgbnVsbDtcbiAgZm9jdXNNaW51dGVzOiBudW1iZXIgfCBudWxsO1xuICAvKiogXHU2NjZFXHU5MDFBXHU0RUZCXHU1MkExXHU4QkExXHU1MjEyXHU1NzU3XHU3RUQzXHU2NzVGXHU1NDBFXHU3Njg0XHU5NzU5XHU2MDAxXHU5MUNEXHU0RkVFXHU3QTk3XHU1M0UzXHVGRjA4XHU1MjA2XHU5NDlGXHVGRjA5XHVGRjFCMCBcdTUzNzNcdTUyMzBcdTcwQjlcdTRGNUNcdTVFOUZcdTMwMDIgKi9cbiAgc2NyYXBNaW51dGVzOiBudW1iZXI7XG4gIHByaW9yaXR5OiBudW1iZXI7XG4gIGVzdGltYXRlOiBudW1iZXI7XG4gIHJlbWluZGVyRmlyZWQ6IGJvb2xlYW47XG4gIHJlbWluZGVyUGVuZGluZzogYm9vbGVhbjtcbiAgcmVtaW5kZXJFeHBpcmVkOiBib29sZWFuO1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGNvbXBsZXRlZEF0OiBudW1iZXIgfCBudWxsO1xuICBjcmVhdGVkQXQ6IG51bWJlcjtcbiAgdGFnczogc3RyaW5nW107XG4gIHN1YnRhc2tzOiBTdWJ0YXNrW107XG59XG5cbi8qKiBcdTRFRkJcdTUyQTFcdTc2ODRcdTdCQTFcdThGOTZcdTUyMDZcdTdDN0JcdUZGMDhcdTUzNTVcdTRFMDBcdTY3NDNcdTVBMDFcdTVCOUFcdTRFNDlcdUZGMENcdThCRkJcdTUxQkJcdTdFRDNcdTVCNTdcdTZCQjVcdUZGMDlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBraW5kT2YoXG4gIHRhc2s6IFBpY2s8VGFzaywgXCJyZW1pbmRlclRpbWVcIiB8IFwiaGFiaXRJZFwiIHwgXCJyZWN1cnJpbmdcIj4sXG4pOiBUYXNrS2luZCB7XG4gIHJldHVybiB0YXNrLnJlbWluZGVyVGltZSAhPT0gbnVsbCAmJiAodGFzay5oYWJpdElkICE9PSBudWxsIHx8IHRhc2sucmVjdXJyaW5nKVxuICAgID8gXCJoYWJpdFwiXG4gICAgOiBcIm9yZGluYXJ5XCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0hhYml0KFxuICB0YXNrOiBQaWNrPFRhc2ssIFwicmVtaW5kZXJUaW1lXCIgfCBcImhhYml0SWRcIiB8IFwicmVjdXJyaW5nXCI+LFxuKTogYm9vbGVhbiB7XG4gIHJldHVybiBraW5kT2YodGFzaykgPT09IFwiaGFiaXRcIjtcbn1cblxuZXhwb3J0IHR5cGUgUmVwZWF0ID0gXCJub25lXCIgfCBcImRhaWx5XCIgfCBcIndlZWtkYXlzXCIgfCBcIndlZWtseVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRhc2tEcmFmdCB7XG4gIGlkOiBzdHJpbmcgfCBudWxsO1xuICB0aXRsZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGR1ZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIHJlbWluZGVyVGltZTogc3RyaW5nIHwgbnVsbDtcbiAgZm9jdXNNaW51dGVzOiBudW1iZXIgfCBudWxsO1xuICBzY3JhcE1pbnV0ZXM6IG51bWJlcjtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgZXN0aW1hdGU6IG51bWJlcjtcbiAgdGFnczogc3RyaW5nW107XG4gIHN1YnRhc2tzOiBTdWJ0YXNrW107XG4gIHJlcGVhdDogUmVwZWF0O1xufVxuXG5leHBvcnQgdHlwZSBHdWFyZE1vZGUgPSBcIm9mZlwiIHwgXCJsb2NrXCIgfCBcIndoaXRlbGlzdFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb3RlY3Rpb24ge1xuICBtb2RlOiBHdWFyZE1vZGU7XG4gIHdoaXRlbGlzdDogc3RyaW5nW107XG4gIHN0cmljdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTZXR0aW5ncyB7XG4gIGZvY3VzTWludXRlczogbnVtYmVyO1xuICBzaG9ydEJyZWFrTWludXRlczogbnVtYmVyO1xuICBsb25nQnJlYWtNaW51dGVzOiBudW1iZXI7XG4gIGxvbmdCcmVha0V2ZXJ5OiBudW1iZXI7XG4gIGRhaWx5R29hbDogbnVtYmVyO1xuICBhdXRvQnJlYWs6IGJvb2xlYW47XG4gIGF1dG9Gb2N1czogYm9vbGVhbjtcbiAgYXV0b1N0YXJ0VGFza3M6IGJvb2xlYW47XG4gIHNvdW5kOiBib29sZWFuO1xuICBzb3VuZFZvbHVtZTogbnVtYmVyO1xuICBub3RpZmljYXRpb25zOiBib29sZWFuO1xuICBhbHdheXNPblRvcDogYm9vbGVhbjtcbiAgdGhlbWU6IHN0cmluZztcbiAgcGVyc29uYUJhY2tkcm9wOiBib29sZWFuO1xuICBwcm90ZWN0aW9uOiBQcm90ZWN0aW9uO1xufVxuXG5leHBvcnQgdHlwZSBNb2RlID0gXCJmb2N1c1wiIHwgXCJzaG9ydEJyZWFrXCIgfCBcImxvbmdCcmVha1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVyIHtcbiAgbW9kZTogTW9kZTtcbiAgcnVubmluZzogYm9vbGVhbjtcbiAgdGFza0lkOiBzdHJpbmcgfCBudWxsO1xuICBkdXJhdGlvblNlY3M6IG51bWJlcjtcbiAgcmVtYWluaW5nU2VjczogbnVtYmVyO1xuICBkZWFkbGluZTogbnVtYmVyIHwgbnVsbDtcbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xuICBjeWNsZTogbnVtYmVyO1xuICBjeWNsZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIGNvbXBsZXRpb25TZXJpYWw6IG51bWJlcjtcbiAgbGFzdEZpbmlzaGVkTW9kZTogTW9kZSB8IG51bGw7XG4gIGF1dG9Gb2N1c0Jsb2NrZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFNlc3Npb25Tb3VyY2UgPSBcInRpbWVyXCIgfCBcInRhc2tFc3RpbWF0ZVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlc3Npb24ge1xuICBpZDogc3RyaW5nO1xuICBzb3VyY2U6IFNlc3Npb25Tb3VyY2U7XG4gIHRhc2tJZDogc3RyaW5nIHwgbnVsbDtcbiAgdGFza1RpdGxlOiBzdHJpbmc7XG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIHN0YXJ0ZWRBdDogbnVtYmVyO1xuICBlbmRlZEF0OiBudW1iZXI7XG4gIGR1cmF0aW9uU2VjczogbnVtYmVyO1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIERldGFjaFRhcmdldCA9IFwicHJvamVjdFwiIHwgXCJoYWJpdFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIERheVN0YXQge1xuICBkYXRlOiBzdHJpbmc7XG4gIHNlY29uZHM6IG51bWJlcjtcbiAgcG9tb2Rvcm9zOiBudW1iZXI7XG4gIC8qKiBcdTVCOUFcdTY1RjZcdTkxQ0RcdTU5MERcdTRFNjBcdTYwRUZcdTVGNTNcdTU5MjlcdTUyMzBcdTY3MUZcdTY3MkFcdTVCOENcdTYyMTBcdTMwMDIgKi9cbiAgbWlzc2VkOiBudW1iZXI7XG4gIGNvbXBsZXRlZDogbnVtYmVyO1xuICAvKiogXHU2NjZFXHU5MDFBXHU1QjlBXHU2NUY2XHU1QjlFXHU0RjhCXHU1RjUzXHU1OTI5XHU0RjVDXHU1RTlGXHU2NzJBXHU1QjhDXHU2MjEwXHUzMDAyICovXG4gIHZvaWRlZDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRzIHtcbiAgdG9kYXlTZWNvbmRzOiBudW1iZXI7XG4gIHRvZGF5UG9tb2Rvcm9zOiBudW1iZXI7XG4gIHRvZGF5Q29tcGxldGVkOiBudW1iZXI7XG4gIHRvdGFsU2Vjb25kczogbnVtYmVyO1xuICB0b3RhbFBvbW9kb3JvczogbnVtYmVyO1xuICBzdHJlYWs6IG51bWJlcjtcbiAgZGF5czogRGF5U3RhdFtdO1xufVxuXG4vLyAtLS0tLS0tLS0tIFx1NUI5QVx1NjVGNlx1OTUwMVx1NjczQVx1RkYwOFx1NjU3MFx1NjM2RVx1NkEyMVx1NTc4QiArIFx1N0VBRlx1OEMwM1x1NUVBNlx1OTAzQlx1OEY5MVx1RkYxQlx1Njg0Q1x1OTc2Mlx1NjI2N1x1ODg0Q1x1NzU1OVx1NTM5Rlx1NzUxRiBndWFyZFx1RkYwOSAtLS0tLS0tLS0tXG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9ja1NjaGVkdWxlIHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBzdGFydDogc3RyaW5nO1xuICBlbmQ6IHN0cmluZztcbiAgZGF5czogbnVtYmVyW107XG4gIGVuYWJsZWQ6IGJvb2xlYW47XG4gIHN0cmljdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBY3RpdmVMb2NrIHtcbiAgbmFtZTogc3RyaW5nO1xuICBzdGFydGVkQXQ6IG51bWJlcjtcbiAgZW5kc0F0OiBudW1iZXI7XG4gIHN0cmljdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NrU3RhdGUge1xuICBzY2hlZHVsZXM6IExvY2tTY2hlZHVsZVtdO1xuICBhY3RpdmU6IEFjdGl2ZUxvY2sgfCBudWxsO1xuICBzdXBwcmVzc2VkVW50aWw6IG51bWJlcjtcbn1cblxuLy8gLS0tLS0tLS0tLSBcdThCRkVcdTg4NjhcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjUgLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBBdHRlbnRpb24gPSBcInJlcXVpcmVkXCIgfCBcImxpZ2h0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmxvY2sge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICAvKiogMSA9IFx1NTQ2OFx1NEUwMCBcdTIwMjYgNyA9IFx1NTQ2OFx1NjVFNVx1MzAwMiAqL1xuICBkYXlzOiBudW1iZXJbXTtcbiAgLyoqIFx1NjcyQ1x1NjczQSBISDpNTVx1RkYxQmVuZCBcdTRFMERcdTY2NUFcdTRFOEUgc3RhcnQgXHU4ODY4XHU3OTNBXHU4REU4XHU1MzQ4XHU1OTFDXHUzMDAyICovXG4gIHN0YXJ0OiBzdHJpbmc7XG4gIGVuZDogc3RyaW5nO1xuICBhdHRlbnRpb246IEF0dGVudGlvbjtcbiAgbm90ZXM6IHN0cmluZztcbn1cblxuLy8gLS0tLS0tLS0tLSBcdTZBMjFcdTY3N0ZcdTRFMEVcdTUzNzBcdTUyMzcgLS0tLS0tLS0tLVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlbXBsYXRlU3VidGFzayB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2hhcGUge1xuICB0aXRsZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGhhYml0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGZvY3VzTWludXRlczogbnVtYmVyIHwgbnVsbDtcbiAgc2NyYXBNaW51dGVzOiBudW1iZXI7XG4gIHByaW9yaXR5OiBudW1iZXI7XG4gIGVzdGltYXRlOiBudW1iZXI7XG4gIHRhZ3M6IHN0cmluZ1tdO1xuICBzdWJ0YXNrczogVGVtcGxhdGVTdWJ0YXNrW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpbnRTbG90IHtcbiAgZGF5czogbnVtYmVyW107XG4gIHRpbWU6IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FsZW5kYXJTbG90IHtcbiAgZGF0ZXM6IHN0cmluZ1tdO1xuICB0aW1lOiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgdHlwZSBQcmludGluZyA9XG4gIHwgeyBraW5kOiBcIm9uY2VcIjsgZGF0ZTogc3RyaW5nIHwgbnVsbDsgdGltZTogc3RyaW5nIHwgbnVsbCB9XG4gIHwgeyBraW5kOiBcImNhbGVuZGFyXCI7IHNsb3RzOiBDYWxlbmRhclNsb3RbXSB9XG4gIHwgeyBraW5kOiBcIndlZWtseVwiOyBzbG90czogUHJpbnRTbG90W10gfTtcblxuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHNoYXBlOiBTaGFwZTtcbiAgcHJpbnRpbmc6IFByaW50aW5nO1xuICBhdXRvbWF0aWM6IGJvb2xlYW47XG4gIHByaW50QWhlYWREYXlzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpbnRSZWNvcmQge1xuICB0ZW1wbGF0ZUlkOiBzdHJpbmc7XG4gIGRhdGU6IHN0cmluZyB8IG51bGw7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU2QzM4XHU0RTQ1IElEIFx1NzY3Qlx1OEJCMCAtLS0tLS0tLS0tXG5cbmV4cG9ydCBpbnRlcmZhY2UgSWRlbnRpdHkge1xuICBpZDogc3RyaW5nO1xuICBraW5kOiBzdHJpbmc7XG4gIHJldGlyZWQ6IGJvb2xlYW47XG4gIC8qKiBcdTUzOUZcdTRFRkJcdTUyQTFcdTYwNjJcdTU5MERcdThCQjBcdTVGNTVcdUZGMUFjYW5vbmljYWwgXHU1RThGXHU1MjE3XHU1MzE2XHU1NDBFXHU3Njg0IFRhc2sgSlNPTiBcdTVCNTdcdTdCMjZcdTRFMzJcdTMwMDIgKi9cbiAgcmVzdG9yZVRhc2s6IHN0cmluZyB8IG51bGw7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU4QkExXHU1MjEyXHU2NTg3XHU0RUY2IHY2IC0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBQbGFuUHJvamVjdCB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgY29sb3I6IHN0cmluZztcbiAgLyoqIFx1NUU4Rlx1NTIxN1x1NTMxNlx1NjVGNiBudWxsIFx1NzcwMVx1NzU2NVx1RkYxQlx1NjNEMFx1NEY5Qlx1NjVGNlx1NUJGQ1x1NTE2NVx1NEYxQVx1ODk4Nlx1NzZENlx1NjcyQ1x1NjczQVx1NkUwNVx1NTM1NVx1MzAwMiAqL1xuICBhcHBXaGl0ZWxpc3Q6IHN0cmluZ1tdIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbGFuU3VidGFzayB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGxhblRhc2sge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICB0ZW1wbGF0ZUlkOiBzdHJpbmcgfCBudWxsO1xuICBoYWJpdElkOiBzdHJpbmcgfCBudWxsO1xuICByZWN1cnJpbmc6IGJvb2xlYW47XG4gIHNjcmFwTWludXRlczogbnVtYmVyO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGR1ZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIC8qKiBcdTVFOEZcdTUyMTdcdTUzMTZcdTY1RjYgbnVsbCBcdTc3MDFcdTc1NjVcdTMwMDIgKi9cbiAgcmVtaW5kZXJUaW1lOiBzdHJpbmcgfCBudWxsO1xuICAvKiogXHU1RThGXHU1MjE3XHU1MzE2XHU2NUY2IG51bGwgXHU3NzAxXHU3NTY1XHUzMDAyICovXG4gIGZvY3VzTWludXRlczogbnVtYmVyIHwgbnVsbDtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgZXN0aW1hdGU6IG51bWJlcjtcbiAgdGFnczogc3RyaW5nW107XG4gIHN1YnRhc2tzOiBQbGFuU3VidGFza1tdO1xuICByZXBlYXQ6IFJlcGVhdDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbGFuRmlsZSB7XG4gIGZvcm1hdDogc3RyaW5nO1xuICB2ZXJzaW9uOiBudW1iZXI7XG4gIHBvbW9kb3JvTWludXRlczogbnVtYmVyO1xuICBwcm9qZWN0czogUGxhblByb2plY3RbXTtcbiAgdGFza3M6IFBsYW5UYXNrW107XG4gIGJsb2NrczogQmxvY2tbXTtcbiAgdGVtcGxhdGVzOiBUZW1wbGF0ZVtdO1xuICBwcmludHM6IFByaW50UmVjb3JkW107XG4gIGhhYml0czogSGFiaXRbXTtcbiAgLyoqIFx1NUU4Rlx1NTIxN1x1NTMxNlx1NjVGNiBmYWxzZSBcdTc3MDFcdTc1NjVcdTMwMDIgKi9cbiAgcmVwbGFjZTogYm9vbGVhbjtcbn1cblxuLy8gLS0tLS0tLS0tLSBcdTY1NTlcdTVCNjYgLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBSZXNvdXJjZUtpbmQgPVxuICB8IFwic3lsbGFidXNcIlxuICB8IFwiY291cnNlXCJcbiAgfCBcImJvb2tcIlxuICB8IFwicGFzdFBhcGVyXCJcbiAgfCBcIm1vY2tQYXBlclwiXG4gIHwgXCJyZWZlcmVuY2VcIlxuICB8IFwiYXR0YWNobWVudFwiXG4gIHwgXCJhbnN3ZXJTaGVldFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2plY3RTdHVkeSB7XG4gIHByb2plY3RJZDogc3RyaW5nO1xuICBkaXJlY3Rvcnk6IHN0cmluZztcbiAgZXhhbU1vZGU6IGJvb2xlYW47XG4gIHZpc2lvbklkOiBzdHJpbmcgfCBudWxsO1xuICB0YXJnZXQ6IHN0cmluZztcbiAgZXhhbURhdGU6IHN0cmluZyB8IG51bGw7XG4gIHN5bGxhYnVzSWQ6IHN0cmluZyB8IG51bGw7XG4gIHBhc3RQYXBlcklkczogc3RyaW5nW107XG4gIG1vY2tQYXBlcklkczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb3VyY2Uge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAga2luZDogUmVzb3VyY2VLaW5kO1xuICAvKiogXHU3NkY4XHU1QkY5XHU5ODc5XHU3NkVFXHU2Mzg4XHU2NzQzXHU3NkVFXHU1RjU1XHVGRjFCXHU2QzM4XHU0RTBEXHU2Mzg4XHU0RTg4XHU2NTg3XHU0RUY2XHU3Q0ZCXHU3RURGXHU4QkJGXHU5NUVFXHUzMDAyICovXG4gIHBhdGg6IHN0cmluZztcbiAgc291cmNlOiBzdHJpbmc7XG4gIGVkaXRpb246IHN0cmluZztcbiAgdG9waWNzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNaWxlc3RvbmUge1xuICB3ZWVrOiBudW1iZXI7XG4gIHRvcGljczogc3RyaW5nW107XG4gIHJlc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgb2JqZWN0aXZlOiBzdHJpbmc7XG4gIGxlc3NvbkNvdW50OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VtZXN0ZXIge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgc3RhcnREYXRlOiBzdHJpbmc7XG4gIGVuZERhdGU6IHN0cmluZztcbiAgcmV2aXNpb246IG51bWJlcjtcbiAgYmFzZWxpbmU6IHN0cmluZztcbiAgZXZpZGVuY2U6IHN0cmluZ1tdO1xuICByYXRpb25hbGU6IHN0cmluZztcbiAgbWlsZXN0b25lczogTWlsZXN0b25lW107XG59XG5cbmV4cG9ydCB0eXBlIExlc3NvblN0YXRlID0gXCJwbGFubmVkXCIgfCBcImFjdGl2ZVwiIHwgXCJlbmRlZFwiIHwgXCJtaXNzZWRcIjtcblxuZXhwb3J0IGludGVyZmFjZSBMZXNzb24ge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgc2VtZXN0ZXJJZDogc3RyaW5nO1xuICBzZW1lc3RlclJldmlzaW9uOiBudW1iZXI7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHRvcGljczogc3RyaW5nW107XG4gIHJlc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgc3RhcnRzQXQ6IG51bWJlcjtcbiAgZW5kc0F0OiBudW1iZXI7XG4gIGFpRW5hYmxlZDogYm9vbGVhbjtcbiAgYXR0ZW5kZWQ6IGJvb2xlYW47XG4gIHByb2dyZXNzOiBzdHJpbmc7XG4gIHN0YXRlOiBMZXNzb25TdGF0ZTtcbn1cblxuZXhwb3J0IHR5cGUgQXNzZXNzbWVudEtpbmQgPSBcImhvbWV3b3JrXCIgfCBcIndlZWtseUV4YW1cIiB8IFwibW9ja0V4YW1cIiB8IFwicmV0ZXN0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NvcmluZ1BvaW50IHtcbiAgaWQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgcG9pbnRzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlc3Rpb24ge1xuICBpZDogc3RyaW5nO1xuICBwcm9tcHQ6IHN0cmluZztcbiAgdG9waWNzOiBzdHJpbmdbXTtcbiAgc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgZXh0ZW5zaW9uOiBib29sZWFuO1xuICBlc3RpbWF0ZWRNaW51dGVzOiBudW1iZXI7XG4gIGFuc3dlcjogc3RyaW5nO1xuICBhY2NlcHRhYmxlQWx0ZXJuYXRpdmVzOiBzdHJpbmc7XG4gIHNjb3Jpbmc6IFNjb3JpbmdQb2ludFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFzc2Vzc21lbnQge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgc2VtZXN0ZXJJZDogc3RyaW5nO1xuICBzZW1lc3RlclJldmlzaW9uOiBudW1iZXI7XG4gIGxlc3NvbklkOiBzdHJpbmcgfCBudWxsO1xuICB0YXNrSWQ6IHN0cmluZyB8IG51bGw7XG4gIHJldGVzdE9mR3JhZGVJZDogc3RyaW5nIHwgbnVsbDtcbiAgdGl0bGU6IHN0cmluZztcbiAga2luZDogQXNzZXNzbWVudEtpbmQ7XG4gIHJldmlzaW9uOiBudW1iZXI7XG4gIHN0YXJ0c0F0OiBudW1iZXI7XG4gIGVuZHNBdDogbnVtYmVyO1xuICBpbnN0cnVjdGlvbnM6IHN0cmluZztcbiAgcmV2aWV3RXZpZGVuY2U6IHN0cmluZztcbiAgcXVlc3Rpb25zOiBRdWVzdGlvbltdO1xuICBwdWJsaXNoZWRBdDogbnVtYmVyO1xuICBwcmludGVkQXQ6IG51bWJlciB8IG51bGw7XG4gIHN0YXJ0ZWRBdDogbnVtYmVyIHwgbnVsbDtcbiAgc3RvcHBlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1Ym1pc3Npb24ge1xuICBpZDogc3RyaW5nO1xuICBhc3Nlc3NtZW50SWQ6IHN0cmluZztcbiAgc3VibWl0dGVkQXQ6IG51bWJlcjtcbiAgcmVzb3VyY2VJZHM6IHN0cmluZ1tdO1xuICBhbnN3ZXJzOiBzdHJpbmc7XG4gIHVuZmluaXNoZWQ6IGJvb2xlYW47XG4gIC8qKiBcdTY3MkNcdTY3M0FcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcdUZGMENcdTRFMERcdTY2MkZcdTY1RjZcdTk1N0ZcdTMwMDIgKi9cbiAgcXVlc3Rpb25UaW1lczogUXVlc3Rpb25UaW1lW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlc3Rpb25UaW1lIHtcbiAgcXVlc3Rpb25JZDogc3RyaW5nO1xuICBsb2NhbFRpbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQb2ludEF3YXJkIHtcbiAgcXVlc3Rpb25JZDogc3RyaW5nO1xuICBwb2ludElkOiBzdHJpbmc7XG4gIGF3YXJkZWQ6IG51bWJlcjtcbiAgZXZpZGVuY2U6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFcnJvckFuYWx5c2lzIHtcbiAgcXVlc3Rpb25JZDogc3RyaW5nO1xuICBjYXVzZTogc3RyaW5nO1xuICBldmlkZW5jZTogc3RyaW5nO1xuICBjb3JyZWN0aW9uOiBzdHJpbmc7XG4gIG5leHRDaGVjazogc3RyaW5nO1xuICByZXRlc3REYXRlOiBzdHJpbmc7XG4gIGNvbmZpcm1lZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHcmFkZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHN1Ym1pc3Npb25JZDogc3RyaW5nO1xuICBhc3Nlc3NtZW50UmV2aXNpb246IG51bWJlcjtcbiAgZ3JhZGVkQXQ6IG51bWJlcjtcbiAgYXdhcmRzOiBQb2ludEF3YXJkW107XG4gIGVycm9yczogRXJyb3JBbmFseXNpc1tdO1xuICBuZWVkc1JldmlldzogYm9vbGVhbjtcbiAgZmVlZGJhY2s6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXZpZXcge1xuICBpZDogc3RyaW5nO1xuICBkYXRlOiBzdHJpbmc7XG4gIHByb2plY3RJZDogc3RyaW5nO1xuICBncmFkZUlkczogc3RyaW5nW107XG4gIGZpbmRpbmdzOiBzdHJpbmc7XG4gIGFjdGlvbnM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlYWNoaW5nRXZlbnQge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAga2luZDogc3RyaW5nO1xuICBzb3VyY2VJZDogc3RyaW5nO1xuICBzdGF0ZTogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgVGVhY2hpbmdUYXNrS2luZCA9IFwibGVzc29uXCIgfCBcImhvbWV3b3JrXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVhY2hpbmdUYXNrIHtcbiAgdGFza0lkOiBzdHJpbmc7XG4gIHNvdXJjZUlkOiBzdHJpbmc7XG4gIGtpbmQ6IFRlYWNoaW5nVGFza0tpbmQ7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU1QjY2XHU2MEM1XHU4QkMxXHU2MzZFIC0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBDb21wbGV0ZWRTdHVkeVRhc2sge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgbm90ZXM6IHN0cmluZztcbiAgdG9waWNzOiBzdHJpbmdbXTtcbiAgY29tcGxldGVkQXQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgUHJvZ3Jlc3NTb3VyY2UgPSBcInVzZXJcIiB8IFwiYXNzaXN0YW50XCI7XG5leHBvcnQgdHlwZSBQcm9ncmVzc1N0YXRlID0gXCJzdHVkaWVkXCIgfCBcInByYWN0aWNpbmdcIiB8IFwibmVlZHNSZXZpZXdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcm9ncmVzc1JlY29yZCB7XG4gIGlkOiBzdHJpbmc7XG4gIHByb2plY3RJZDogc3RyaW5nO1xuICB0b3BpYzogc3RyaW5nO1xuICBwb3NpdGlvbjogc3RyaW5nO1xuICBzdGF0ZTogUHJvZ3Jlc3NTdGF0ZTtcbiAgZXZpZGVuY2U6IHN0cmluZztcbiAgbmV4dEFjdGlvbjogc3RyaW5nO1xuICBzb3VyY2U6IFByb2dyZXNzU291cmNlO1xuICBjb25maXJtZWQ6IGJvb2xlYW47XG4gIHJlY29yZGVkQXQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb3JyZWN0aW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgZ3JhZGVJZDogc3RyaW5nO1xuICBxdWVzdGlvbklkOiBzdHJpbmc7XG4gIGV4cGxhbmF0aW9uOiBzdHJpbmc7XG4gIHJlc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgc3VibWl0dGVkQXQ6IG51bWJlcjtcbiAgYWNjZXB0ZWQ6IGJvb2xlYW4gfCBudWxsO1xuICBmZWVkYmFjazogc3RyaW5nO1xuICByZXZpZXdlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG4vLyAtLS0tLS0tLS0tIFx1NUI4OFx1NjJBNFx1N0VBRlx1OEJBMVx1N0I5N1x1OTBFOFx1NTIwNlx1RkYwOFx1N0E5N1x1NTNFM1x1OTZDNlx1NTQwOC9cdTc2N0RcdTU0MERcdTUzNTVcdTUyMjRcdTVCOUFcdUZGMUJcdTY1RTBcdTY4NENcdTk3NjJcdThDMDNcdTc1MjhcdUZGMDkgLS0tLS0tLS0tLVxuXG5leHBvcnQgaW50ZXJmYWNlIFdpbmRvdyB7XG4gIGlkOiBudW1iZXI7XG4gIGFwcElkOiBzdHJpbmcgfCBudWxsO1xuICB0aXRsZTogc3RyaW5nIHwgbnVsbDtcbiAgcGlkOiBudW1iZXIgfCBudWxsO1xuICBpc0ZvY3VzZWQ6IGJvb2xlYW47XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU1RkVCXHU3MTY3IC0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBTbmFwc2hvdCB7XG4gIHRhc2tLaW5kczogUmVjb3JkPHN0cmluZywgVGFza0tpbmQ+O1xuICBkYXRhOiBpbXBvcnQoXCIuL2xpYlwiKS5BcHBEYXRhO1xuICBzdHVkeVByb2dyZXNzOiB1bmtub3duW107XG4gIHN0YXRzOiBTdGF0cztcbiAgcmVtYWluaW5nU2VjczogbnVtYmVyO1xuICB0b2RheTogc3RyaW5nO1xuICBzZXJ2ZXJUaW1lOiBudW1iZXI7XG59XG4iLCAiLy8hIEpTT04gXHU0RTI1XHU2ODNDXHU4OUUzXHU3ODAxXHU1MkE5XHU2MjRCXHVGRjFBXHU2QTIxXHU2MkRGIHNlcmRlIFx1NzY4NCBgZGVueV91bmtub3duX2ZpZWxkc2BcdTMwMDFgI1tzZXJkZShkZWZhdWx0KV1gXG4vLyEgXHU0RTBFIGNhbWVsQ2FzZSBcdTU0N0RcdTU0MERcdTMwMDJcdTVFOEZcdTUyMTdcdTUzMTZcdTc1MzFcdTU0MDRcdTZBMjFcdTU3NTdcdTYyNEJcdTUxOTlcdUZGMDhcdTk1MkVcdTVFOEZcdTU2RkFcdTVCOUFcdTMwMDFcdTRFMEUgUnVzdCBcdTU4RjBcdTY2MEVcdTVFOEZcdTRFMDBcdTgxRjRcdUZGMDlcdUZGMENcbi8vISBcdTRGRERcdThCQzFcdTVCRkNcdTUxRkEgSlNPTiBcdTVGNjJcdTcyQjZcdTRFMEVcdTY1RTdcdTVGMTVcdTY0Q0VcdTkwMTBcdTVCNTdcdTgyODJcdTUzRUZcdTZCRDRcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi9lcnJvcnNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cblxuLyoqIGRlbnlfdW5rbm93bl9maWVsZHNcdUZGMUFcdTY3MkFcdTc3RTVcdTk1MkVcdTc2RjRcdTYzQTVcdTYyRDJcdTdFRERcdUZGMDhSdXN0IFx1NEYxQVx1NjJBNSB1bmtub3duIGZpZWxkXHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gcmVqZWN0VW5rbm93bihcbiAgb2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgYWxsb3dlZDogc3RyaW5nW10sXG4gIHdoYXQ6IHN0cmluZyxcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG4gICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihgXHU2NzJBXHU3N0U1XHU1QjU3XHU2QkI1XHVGRjFBJHt3aGF0fSBcdTRFMERcdTYzQTVcdTUzRDcgXCIke2tleX1cImApO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNTdHIodmFsdWU6IHVua25vd24sIHdoYXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHRocm93IG5ldyBBcHBFcnJvcihgJHt3aGF0fVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUI1N1x1N0IyNlx1NEUzMmApO1xuICByZXR1cm4gdmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc0Jvb2wodmFsdWU6IHVua25vd24sIHdoYXQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSBcImJvb2xlYW5cIikgdGhyb3cgbmV3IEFwcEVycm9yKGAke3doYXR9XHU1RkM1XHU5ODdCXHU2NjJGXHU1RTAzXHU1QzE0XHU1MDNDYCk7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzSW50KHZhbHVlOiB1bmtub3duLCB3aGF0OiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm51bWJlclwiIHx8ICFOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihgJHt3aGF0fVx1NUZDNVx1OTg3Qlx1NjYyRlx1NjU3NFx1NjU3MGApO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzQXJyYXkodmFsdWU6IHVua25vd24sIHdoYXQ6IHN0cmluZyk6IHVua25vd25bXSB7XG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHRocm93IG5ldyBBcHBFcnJvcihgJHt3aGF0fVx1NUZDNVx1OTg3Qlx1NjYyRlx1NjU3MFx1N0VDNGApO1xuICByZXR1cm4gdmFsdWU7XG59XG5cbi8qKiBwYXJzZSBcdTdFREZcdTRFMDBcdTVFMjYgd2hhdFx1RkYwOFx1NEY5QiBhc1N0ci9hc0ludCBcdTdCNDlcdTc2RjRcdTYzQTVcdTRGMjBcdTUxNjVcdUZGMDlcdUZGMENcdTUzNTVcdTUzQzJcdTY1NzAgbGFtYmRhIFx1NTQwQ1x1NjgzN1x1NTE3Q1x1NUJCOVx1MzAwMiAqL1xuZXhwb3J0IHR5cGUgUGFyc2VyPFQ+ID0gKHY6IHVua25vd24sIHdoYXQ6IHN0cmluZykgPT4gVDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFzT3B0PFQ+KFxuICB2YWx1ZTogdW5rbm93bixcbiAgd2hhdDogc3RyaW5nLFxuICBwYXJzZTogUGFyc2VyPFQ+LFxuKTogVCB8IG51bGwge1xuICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiBudWxsO1xuICByZXR1cm4gcGFyc2UodmFsdWUsIHdoYXQpO1xufVxuXG4vKiogXHU4QkZCXHU1M0Q2XHU1QjU3XHU2QkI1XHVGRjFBXHU3RjNBXHU3NzAxXHU2NUY2XHU1RTk0XHU3NTI4IGRlZmF1bHRcdUZGMUJcdTVCNThcdTU3MjhcdUZGMDhcdTU0MkIgbnVsbFx1RkYwOVx1NjVGNlx1NjMwOSBwYXJzZSBcdTg5RTNcdTY3OTBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBmaWVsZDxUPihcbiAgb2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAga2V5OiBzdHJpbmcsXG4gIHdoYXQ6IHN0cmluZyxcbiAgcGFyc2U6IFBhcnNlcjxUPixcbiAgZGVmOiBULFxuKTogVCB7XG4gIGNvbnN0IHZhbHVlID0gb2JqW2tleV07XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZGVmO1xuICByZXR1cm4gcGFyc2UodmFsdWUsIHdoYXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZWRGaWVsZDxUPihcbiAgb2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAga2V5OiBzdHJpbmcsXG4gIHdoYXQ6IHN0cmluZyxcbiAgcGFyc2U6IFBhcnNlcjxUPixcbik6IFQge1xuICBjb25zdCB2YWx1ZSA9IG9ialtrZXldO1xuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEFwcEVycm9yKGAke3doYXR9XHU3RjNBXHU1QzExXHU1RkM1XHU1ODZCXHU1QjU3XHU2QkI1ICR7a2V5fWApO1xuICByZXR1cm4gcGFyc2UodmFsdWUsIHdoYXQpO1xufVxuXG4vKiogXHU2NzlBXHU0RTNFXHU1QjU3XHU3QjI2XHU0RTMyXHU4OUUzXHU2NzkwXHVGRjA4c2VyZGUgcmVuYW1lX2FsbCA9IFwiY2FtZWxDYXNlXCIgXHU3Njg0XHU1M0Q2XHU1MDNDXHVGRjA5XHVGRjFCXHU2Q0RCXHU1NzhCXHU0RkREXHU3NTU5XHU1QjU3XHU5NzYyXHU5MUNGXHU4MDU0XHU1NDA4XHU0RUU1XHU0RkJGXHU1MjA2XHU2NTJGXHU2NTM2XHU3QTg0XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gb25lT2Y8VCBleHRlbmRzIHN0cmluZz4oXG4gIHZhbHVlOiB1bmtub3duLFxuICB3aGF0OiBzdHJpbmcsXG4gIGFsbG93ZWQ6IHJlYWRvbmx5IFRbXSxcbik6IFQge1xuICBjb25zdCBzID0gYXNTdHIodmFsdWUsIHdoYXQpO1xuICBpZiAoIShhbGxvd2VkIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhzKSlcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoYCR7d2hhdH1cdTUzRDZcdTUwM0NcdTY1RTBcdTY1NDhcdUZGMUEke3N9YCk7XG4gIHJldHVybiBzIGFzIFQ7XG59XG5cbi8qKiBcdTVCNTdcdTdCMjZcdTRFMzJcdTY1NzBcdTdFQzRcdUZGMDhcdTYzMDlcdTUxNDNcdTdEMjBcdTg5RTNcdTY3OTBcdUZGMDlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBhc1N0ckFycmF5KFxuICB2YWx1ZTogdW5rbm93bixcbiAgd2hhdDogc3RyaW5nLFxuICBwYXJzZTogUGFyc2VyPHN0cmluZz4sXG4pOiBzdHJpbmdbXSB7XG4gIHJldHVybiBhc0FycmF5KHZhbHVlLCB3aGF0KS5tYXAoKHYpID0+IHBhcnNlKHYsIHdoYXQpKTtcbn1cbiIsICIvLyEgXHU1QjlBXHU2NUY2XHU5NTAxXHU2NzNBXHVGRjFBXHU2NTcwXHU2MzZFXHU2QTIxXHU1NzhCXHUzMDAxXHU4REU4XHU1MzQ4XHU1OTFDXHU2NzJDXHU1NzMwXHU1NDY4XHU1Mzg2XHUzMDAxXHU5MUNEXHU1M0UwXHU2OEMwXHU2N0U1XHU0RTBFXHU2NzJDXHU4RjZFXHU2MjkxXHU1MjM2XHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9sb2NrLnJzXHUzMDAyKipcdTdFQUZcdThCQTFcdTdCOTcqKlx1MjAxNFx1MjAxNFx1Njg0Q1x1OTc2Mlx1OTUwMVx1NUM0Rlx1NjI2N1x1ODg0Q1x1NzUzMVx1NTM5Rlx1NzUxRiBndWFyZCBcdThEMUZcdThEMjNcdUZGMENcbi8vISBydW50aW1lIFx1NzUyOFx1NjcyQ1x1NkEyMVx1NTc1N1x1N0I5N1x1NTFGQSBhY3RpdmUgXHU3MkI2XHU2MDAxXHU1NDBFXHU2MzA3XHU2MzI1IGd1YXJkXHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yLCBlbnN1cmUgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7XG4gIGFzQXJyYXksXG4gIGFzQm9vbCxcbiAgYXNJbnQsXG4gIGFzT3B0LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICBvbmVPZixcbiAgcmVqZWN0VW5rbm93bixcbiAgcmVxdWlyZWRGaWVsZCxcbn0gZnJvbSBcIi4vanNvblwiO1xuaW1wb3J0IHR5cGUgeyBBY3RpdmVMb2NrLCBMb2NrU2NoZWR1bGUsIExvY2tTdGF0ZSB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQge1xuICBhZGREYXlzLFxuICBhdExvY2FsRGF0ZSxcbiAgbG9jYWxEYXRlT2YsXG4gIG1pbnV0ZXNPZixcbiAgcGFyc2VEYXRlLFxuICB3ZWVrZGF5TW9uZGF5LFxufSBmcm9tIFwiLi90aW1lXCI7XG5cbmNvbnN0IFNDSEVEVUxFX0tFWVMgPSBbXG4gIFwiaWRcIixcbiAgXCJuYW1lXCIsXG4gIFwic3RhcnRcIixcbiAgXCJlbmRcIixcbiAgXCJkYXlzXCIsXG4gIFwiZW5hYmxlZFwiLFxuICBcInN0cmljdFwiLFxuXSBhcyBjb25zdDtcbmNvbnN0IEFDVElWRV9LRVlTID0gW1wibmFtZVwiLCBcInN0YXJ0ZWRBdFwiLCBcImVuZHNBdFwiLCBcInN0cmljdFwiXSBhcyBjb25zdDtcbmNvbnN0IFNUQVRFX0tFWVMgPSBbXCJzY2hlZHVsZXNcIiwgXCJhY3RpdmVcIiwgXCJzdXBwcmVzc2VkVW50aWxcIl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUxvY2tTY2hlZHVsZShyYXc6IHVua25vd24pOiBMb2NrU2NoZWR1bGUge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTUwMVx1NjczQVx1ODlDNFx1NTIxOVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5TQ0hFRFVMRV9LRVlTXSwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU5NTAxXHU2NzNBXHU4OUM0XHU1MjE5XCIsIGFzU3RyKSxcbiAgICBuYW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJuYW1lXCIsIFwiXHU5NTAxXHU2NzNBXHU4OUM0XHU1MjE5XCIsIGFzU3RyKSxcbiAgICBzdGFydDogcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhcnRcIiwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIiwgYXNTdHIpLFxuICAgIGVuZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZW5kXCIsIFwiXHU5NTAxXHU2NzNBXHU4OUM0XHU1MjE5XCIsIGFzU3RyKSxcbiAgICBkYXlzOiBhc0FycmF5KFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwiZGF5c1wiLCBcIlx1OTUwMVx1NjczQVx1ODlDNFx1NTIxOVwiLCAodikgPT4gdiksXG4gICAgICBcImRheXNcIixcbiAgICApLm1hcCgoZCkgPT4gYXNJbnQoZCwgXCJcdTk1MDFcdTY3M0FcdTY2MUZcdTY3MUZcIikpLFxuICAgIGVuYWJsZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImVuYWJsZWRcIiwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIiwgYXNCb29sKSxcbiAgICBzdHJpY3Q6IGZpZWxkKHJhdywgXCJzdHJpY3RcIiwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIiwgYXNCb29sLCBmYWxzZSksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVMb2NrU2NoZWR1bGUoXG4gIHM6IExvY2tTY2hlZHVsZSxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogcy5pZCxcbiAgICBuYW1lOiBzLm5hbWUsXG4gICAgc3RhcnQ6IHMuc3RhcnQsXG4gICAgZW5kOiBzLmVuZCxcbiAgICBkYXlzOiBzLmRheXMsXG4gICAgZW5hYmxlZDogcy5lbmFibGVkLFxuICAgIHN0cmljdDogcy5zdHJpY3QsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFjdGl2ZUxvY2socmF3OiB1bmtub3duKTogQWN0aXZlTG9jayB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NTAxXHU2NzNBXHU3MkI2XHU2MDAxXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLkFDVElWRV9LRVlTXSwgXCJcdTk1MDFcdTY3M0FcdTcyQjZcdTYwMDFcIik7XG4gIHJldHVybiB7XG4gICAgbmFtZTogcmVxdWlyZWRGaWVsZChyYXcsIFwibmFtZVwiLCBcIlx1OTUwMVx1NjczQVx1NzJCNlx1NjAwMVwiLCBhc1N0ciksXG4gICAgc3RhcnRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdGFydGVkQXRcIiwgXCJcdTk1MDFcdTY3M0FcdTcyQjZcdTYwMDFcIiwgYXNJbnQpLFxuICAgIGVuZHNBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZW5kc0F0XCIsIFwiXHU5NTAxXHU2NzNBXHU3MkI2XHU2MDAxXCIsIGFzSW50KSxcbiAgICBzdHJpY3Q6IHJlcXVpcmVkRmllbGQocmF3LCBcInN0cmljdFwiLCBcIlx1OTUwMVx1NjczQVx1NzJCNlx1NjAwMVwiLCBhc0Jvb2wpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQWN0aXZlTG9jayhhOiBBY3RpdmVMb2NrKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGEubmFtZSxcbiAgICBzdGFydGVkQXQ6IGEuc3RhcnRlZEF0LFxuICAgIGVuZHNBdDogYS5lbmRzQXQsXG4gICAgc3RyaWN0OiBhLnN0cmljdCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTG9ja1N0YXRlKHJhdzogdW5rbm93bik6IExvY2tTdGF0ZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NTAxXHU2NzNBXHU5MTREXHU3RjZFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlNUQVRFX0tFWVNdLCBcIlx1OTUwMVx1NjczQVx1OTE0RFx1N0Y2RVwiKTtcbiAgcmV0dXJuIHtcbiAgICBzY2hlZHVsZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzY2hlZHVsZXNcIixcbiAgICAgIFwiXHU5NTAxXHU2NzNBXHU5MTREXHU3RjZFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInNjaGVkdWxlc1wiKS5tYXAocGFyc2VMb2NrU2NoZWR1bGUpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBhY3RpdmU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJhY3RpdmVcIixcbiAgICAgIFwiXHU5NTAxXHU2NzNBXHU5MTREXHU3RjZFXCIsXG4gICAgICAodikgPT4gKHYgPT09IG51bGwgPyBudWxsIDogcGFyc2VBY3RpdmVMb2NrKHYpKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBBY3RpdmVMb2NrIHwgbnVsbCxcbiAgICBzdXBwcmVzc2VkVW50aWw6IGZpZWxkKHJhdywgXCJzdXBwcmVzc2VkVW50aWxcIiwgXCJcdTk1MDFcdTY3M0FcdTkxNERcdTdGNkVcIiwgYXNJbnQsIDApLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplTG9ja1N0YXRlKHM6IExvY2tTdGF0ZSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBzY2hlZHVsZXM6IHMuc2NoZWR1bGVzLm1hcChzZXJpYWxpemVMb2NrU2NoZWR1bGUpLFxuICAgIC8vIFx1NEUwRSBSdXN0IFx1NEUwMFx1ODFGNFx1RkYxQU9wdGlvbiBcdTc2RjRcdTYzQTVcdTVFOEZcdTUyMTdcdTUzMTZcdUZGMENOb25lIFx1NjYzRVx1NUYwRlx1NTE5OSBcImFjdGl2ZVwiOiBudWxsXHVGRjA4c2VyZGUgXHU0RTI0XHU3QUVGXHU2M0E1XHU1M0Q3XHVGRjA5XHUzMDAyXG4gICAgYWN0aXZlOiBzLmFjdGl2ZSA9PT0gbnVsbCA/IG51bGwgOiBzZXJpYWxpemVBY3RpdmVMb2NrKHMuYWN0aXZlKSxcbiAgICBzdXBwcmVzc2VkVW50aWw6IHMuc3VwcHJlc3NlZFVudGlsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVMb2NrKHN0YXRlOiBMb2NrU3RhdGUpOiB2b2lkIHtcbiAgaWYgKHN0YXRlLnNjaGVkdWxlcy5sZW5ndGggPiAyMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjcwMFx1NTkxQVx1OEJCRVx1N0Y2RSAyMCBcdTRFMkFcdTk1MDFcdTY3M0FcdTY1RjZcdTZCQjVcIik7XG4gIH1cbiAgY29uc3QgaWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IG9jY3VwaWVkID0gbmV3IEFycmF5PGJvb2xlYW4+KDcgKiAxNDQwKS5maWxsKGZhbHNlKTtcbiAgZm9yIChjb25zdCBzIG9mIHN0YXRlLnNjaGVkdWxlcykge1xuICAgIGlmIChcbiAgICAgIHMuaWQubGVuZ3RoID09PSAwIHx8XG4gICAgICBpZHMuaGFzKHMuaWQpIHx8XG4gICAgICBzLm5hbWUudHJpbSgpLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgQXJyYXkuZnJvbShzLm5hbWUpLmxlbmd0aCA+IDQwXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk1MDFcdTY3M0FcdTU0MERcdTc5RjBcdTk3MDBcdTRFM0EgMVx1MjAxMzQwIFx1NUI1N1x1N0IyNlx1RkYwQ0lEIFx1OTcwMFx1NTUyRlx1NEUwMFx1NEUxNFx1OTc1RVx1N0E3QVwiKTtcbiAgICB9XG4gICAgaWRzLmFkZChzLmlkKTtcbiAgICBpZiAoXG4gICAgICBtaW51dGVzT2Yocy5zdGFydCkgPT09IG51bGwgfHxcbiAgICAgIG1pbnV0ZXNPZihzLmVuZCkgPT09IG51bGwgfHxcbiAgICAgIHMuc3RhcnQgPT09IHMuZW5kXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk1MDFcdTY3M0FcdTY1RjZcdTk1RjRcdTk3MDBcdTRFM0FcdTY3MDlcdTY1NDggSEg6TU1cdUZGMENcdTVGMDBcdTU5Q0JcdTRFMEVcdTdFRDNcdTY3NUZcdTRFMERcdTgwRkRcdTc2RjhcdTU0MENcIik7XG4gICAgfVxuICAgIGNvbnN0IHVuaXF1ZSA9IG5ldyBTZXQocy5kYXlzKTtcbiAgICBpZiAoXG4gICAgICBzLmRheXMubGVuZ3RoID09PSAwIHx8XG4gICAgICBzLmRheXMubGVuZ3RoID4gNyB8fFxuICAgICAgdW5pcXVlLnNpemUgIT09IHMuZGF5cy5sZW5ndGggfHxcbiAgICAgIHMuZGF5cy5zb21lKChkKSA9PiBkIDwgMSB8fCBkID4gNylcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGN1x1OTAwOVx1NjJFOVx1NEUwRFx1OTFDRFx1NTkwRFx1NzY4NFx1NjYxRlx1NjcxRlx1RkYwOFx1NTQ2OFx1NEUwMFx1NEUzQSAxXHVGRjBDXHU1NDY4XHU2NUU1XHU0RTNBIDdcdUZGMDlcIik7XG4gICAgfVxuICAgIGlmIChzLmVuYWJsZWQpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gbWludXRlc09mKHMuc3RhcnQpITtcbiAgICAgIGNvbnN0IGVuZCA9IG1pbnV0ZXNPZihzLmVuZCkhO1xuICAgICAgY29uc3QgZHVyYXRpb24gPSAoZW5kICsgMTQ0MCAtIHN0YXJ0KSAlIDE0NDA7XG4gICAgICBmb3IgKGNvbnN0IGRheSBvZiBzLmRheXMpIHtcbiAgICAgICAgZm9yIChsZXQgb2Zmc2V0ID0gMDsgb2Zmc2V0IDwgZHVyYXRpb247IG9mZnNldCArPSAxKSB7XG4gICAgICAgICAgY29uc3QgbWludXRlID0gKChkYXkgLSAxKSAqIDE0NDAgKyBzdGFydCArIG9mZnNldCkgJSAoNyAqIDE0NDApO1xuICAgICAgICAgIGlmIChvY2N1cGllZFttaW51dGVdKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTU0MkZcdTc1MjhcdTc2ODRcdTk1MDFcdTY3M0FcdTY1RjZcdTZCQjVcdTRFMERcdTgwRkRcdTkxQ0RcdTUzRTBcdUZGMENcdThCRjdcdThDMDNcdTY1NzRcdTY1RTVcdTY3MUZcdTYyMTZcdTY1RjZcdTk1RjRcIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9jY3VwaWVkW21pbnV0ZV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChzdGF0ZS5hY3RpdmUgIT09IG51bGwpIHtcbiAgICBjb25zdCBhID0gc3RhdGUuYWN0aXZlO1xuICAgIGlmIChcbiAgICAgIGEubmFtZS50cmltKCkubGVuZ3RoID09PSAwIHx8XG4gICAgICBBcnJheS5mcm9tKGEubmFtZSkubGVuZ3RoID4gNDAgfHxcbiAgICAgIGEuZW5kc0F0IDw9IGEuc3RhcnRlZEF0IHx8XG4gICAgICBhLmVuZHNBdCAtIGEuc3RhcnRlZEF0ID4gOCAqIDg2NDAwXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTk1MDFcdTY3M0FcdTcyQjZcdTYwMDFcIik7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogXHU1RjUzXHU1MjREXHU2NUY2XHU1MjNCXHU1NDdEXHU0RTJEXHU3Njg0XHU1NDJGXHU3NTI4XHU4OUM0XHU1MjE5IFx1MjE5MiBcdTU0MDhcdTVFNzZcdTU0MEVcdTc2ODQgQWN0aXZlTG9ja1x1RkYxQlx1ODhBQlx1NjI5MVx1NTIzNlx1NjIxNlx1NjcyQVx1NTQ3RFx1NEUyRFx1OEZENFx1NTZERSBudWxsXHUzMDAyXG4gKiBcdTY2MUZcdTY3MUZcdTVGNTJcdTVDNUVcdTVGMDBcdTU5Q0JcdTY1RTVcdTY3MUZcdUZGMUFcdThERThcdTUzNDhcdTU5MUNcdTg5QzRcdTUyMTlcdTYzMDlcdTVGMDBcdTU5Q0JcdTY1RTVcdTUzQzJcdTRFMEVcdTUzMzlcdTkxNERcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNjaGVkdWxlZEF0KHN0YXRlOiBMb2NrU3RhdGUsIGF0OiBudW1iZXIpOiBBY3RpdmVMb2NrIHwgbnVsbCB7XG4gIGlmIChhdCA8IHN0YXRlLnN1cHByZXNzZWRVbnRpbCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHRvZGF5ID0gbG9jYWxEYXRlT2YoYXQpO1xuICBsZXQgcmVzdWx0OiBBY3RpdmVMb2NrIHwgbnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3QgZGF0ZSBvZiBbYWRkRGF5cyh0b2RheSwgLTEpLCB0b2RheV0pIHtcbiAgICBjb25zdCB3ZWVrZGF5ID0gd2Vla2RheU1vbmRheShkYXRlKTtcbiAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGUuc2NoZWR1bGVzKSB7XG4gICAgICBpZiAoIXMuZW5hYmxlZCB8fCAhcy5kYXlzLmluY2x1ZGVzKHdlZWtkYXkpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG1pbnV0ZXNPZihzLnN0YXJ0KTtcbiAgICAgIGNvbnN0IGVuZFRpbWUgPSBtaW51dGVzT2Yocy5lbmQpO1xuICAgICAgaWYgKHN0YXJ0VGltZSA9PT0gbnVsbCB8fCBlbmRUaW1lID09PSBudWxsKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGVuZERhdGUgPSBlbmRUaW1lIDw9IHN0YXJ0VGltZSA/IGFkZERheXMoZGF0ZSwgMSkgOiBkYXRlO1xuICAgICAgY29uc3Qgc3RhcnQgPSBhdExvY2FsRGF0ZShcbiAgICAgICAgZGF0ZSxcbiAgICAgICAgTWF0aC5mbG9vcihzdGFydFRpbWUgLyA2MCksXG4gICAgICAgIHN0YXJ0VGltZSAlIDYwLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGVuZCA9IGF0TG9jYWxEYXRlKGVuZERhdGUsIE1hdGguZmxvb3IoZW5kVGltZSAvIDYwKSwgZW5kVGltZSAlIDYwKTtcbiAgICAgIGlmIChhdCA+PSBzdGFydCAmJiBhdCA8IGVuZCkge1xuICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmVzdWx0LnN0YXJ0ZWRBdCA9IE1hdGgubWluKHJlc3VsdC5zdGFydGVkQXQsIHN0YXJ0KTtcbiAgICAgICAgICByZXN1bHQuZW5kc0F0ID0gTWF0aC5tYXgocmVzdWx0LmVuZHNBdCwgZW5kKTtcbiAgICAgICAgICByZXN1bHQuc3RyaWN0ID0gcmVzdWx0LnN0cmljdCB8fCBzLnN0cmljdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSB7XG4gICAgICAgICAgICBuYW1lOiBzLm5hbWUsXG4gICAgICAgICAgICBzdGFydGVkQXQ6IHN0YXJ0LFxuICAgICAgICAgICAgZW5kc0F0OiBlbmQsXG4gICAgICAgICAgICBzdHJpY3Q6IHMuc3RyaWN0LFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIFx1NjNEMFx1NTI0RFx1N0VEM1x1Njc1Rlx1NUMwRlx1NjFBOVx1NEUwRFx1NUY5N1x1NTQxRVx1NjM4OVx1NjVFMFx1NTE3M1x1NzY4NFx1NTQwRVx1N0VFRFx1Nzc2MVx1NzcyMFx1NjVGNlx1NkJCNVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2VMb2NrKHN0YXRlOiBMb2NrU3RhdGUsIGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgY29uc3Qgc2NoZWR1bGVkID0gc2NoZWR1bGVkQXQoc3RhdGUsIGF0KTtcbiAgaWYgKHNjaGVkdWxlZCAhPT0gbnVsbCkge1xuICAgIHN0YXRlLnN1cHByZXNzZWRVbnRpbCA9IE1hdGgubWF4KHN0YXRlLnN1cHByZXNzZWRVbnRpbCwgc2NoZWR1bGVkLmVuZHNBdCk7XG4gIH1cbiAgc3RhdGUuYWN0aXZlID0gbnVsbDtcbn1cbiIsICIvLyEgXHU4QkZFXHU4ODY4XHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHVGRjFBXHU4QkExXHU1MjEyXHU0RTRCXHU1OTE2XHU3Njg0XHU2QkNGXHU1NDY4XHU1NkZBXHU1QjlBXHU1MzYwXHU3NTI4XHVGRjA4XHU4QkZFXHU3QTBCXHUzMDAxXHU1QjlFXHU5QThDXHVGRjA5XHUzMDAyXHU3RUFGXHU2M0NGXHU4RkYwXHVGRjFBXHU0RTBEXHU1RTI2XHU4RkRCXHU1RUE2XHUzMDAxXHU0RTBEXHU3QkExXHU4Rjk2XHU1QjlFXHU0RjhCXHUzMDAxXHU0RTBEXHU5NTAxXHU2NzNBXHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9ibG9ja3MucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7XG4gIGFzQXJyYXksXG4gIGFzSW50LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICBvbmVPZixcbiAgcmVqZWN0VW5rbm93bixcbiAgcmVxdWlyZWRGaWVsZCxcbn0gZnJvbSBcIi4vanNvblwiO1xuaW1wb3J0IHR5cGUgeyBBdHRlbnRpb24sIEJsb2NrIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IG1pbnV0ZXNPZiwgcGFyc2VEYXRlLCB3ZWVrZGF5TW9uZGF5IH0gZnJvbSBcIi4vdGltZVwiO1xuXG5jb25zdCBCTE9DS19LRVlTID0gW1xuICBcImlkXCIsXG4gIFwidGl0bGVcIixcbiAgXCJkYXlzXCIsXG4gIFwic3RhcnRcIixcbiAgXCJlbmRcIixcbiAgXCJhdHRlbnRpb25cIixcbiAgXCJub3Rlc1wiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQmxvY2socmF3OiB1bmtub3duKTogQmxvY2sge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5CTE9DS19LRVlTXSwgXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcIiwgYXNTdHIpLFxuICAgIGRheXM6IGFzQXJyYXkoXG4gICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJkYXlzXCIsIFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XCIsICh2KSA9PiB2KSxcbiAgICAgIFwiZGF5c1wiLFxuICAgICkubWFwKChkKSA9PiBhc0ludChkLCBcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVx1NjYxRlx1NjcxRlwiKSksXG4gICAgc3RhcnQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInN0YXJ0XCIsIFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XCIsIGFzU3RyKSxcbiAgICBlbmQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImVuZFwiLCBcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVwiLCBhc1N0ciksXG4gICAgYXR0ZW50aW9uOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiYXR0ZW50aW9uXCIsXG4gICAgICBcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVwiLFxuICAgICAgKHYpID0+IG9uZU9mKHYsIFwiYXR0ZW50aW9uXCIsIFtcInJlcXVpcmVkXCIsIFwibGlnaHRcIl0pLFxuICAgICAgXCJyZXF1aXJlZFwiLFxuICAgICkgYXMgQXR0ZW50aW9uLFxuICAgIG5vdGVzOiBmaWVsZChyYXcsIFwibm90ZXNcIiwgXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcIiwgYXNTdHIsIFwiXCIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQmxvY2soYjogQmxvY2spOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGIuaWQsXG4gICAgdGl0bGU6IGIudGl0bGUsXG4gICAgZGF5czogYi5kYXlzLFxuICAgIHN0YXJ0OiBiLnN0YXJ0LFxuICAgIGVuZDogYi5lbmQsXG4gICAgYXR0ZW50aW9uOiBiLmF0dGVudGlvbixcbiAgICBub3RlczogYi5ub3RlcyxcbiAgfTtcbn1cblxuLyoqIFx1OEJFNVx1NjVFNVx1NjcxRlx1NTM0OFx1NTkxQ1x1OEQ3N1x1N0I5N1x1NzY4NCBgW3N0YXJ0LCBlbmQpYCBcdTUyMDZcdTk0OUZcdTdBOTdcdTUzRTNcdUZGMUJcdThERThcdTUzNDhcdTU5MUNcdTY1RjYgZW5kIFx1OEQ4NVx1OEZDNyAxNDQwXHVGRjFCXHU4QkU1XHU2NjFGXHU2NzFGXHU2NUUwXHU2QjY0XHU1MzYwXHU3NTI4XHU4RkQ0XHU1NkRFIG51bGxcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBiYW5kKFxuICBibG9jazogQmxvY2ssXG4gIGRhdGU6IHN0cmluZyxcbik6IHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfSB8IG51bGwge1xuICBjb25zdCBwYXJzZWQgPSBwYXJzZURhdGUoZGF0ZSk7XG4gIGlmIChwYXJzZWQgPT09IG51bGwpIHJldHVybiBudWxsO1xuICBpZiAoIWJsb2NrLmRheXMuaW5jbHVkZXMod2Vla2RheU1vbmRheShwYXJzZWQpKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHN0YXJ0ID0gbWludXRlc09mKGJsb2NrLnN0YXJ0KTtcbiAgY29uc3QgZW5kID0gbWludXRlc09mKGJsb2NrLmVuZCk7XG4gIGlmIChzdGFydCA9PT0gbnVsbCB8fCBlbmQgPT09IG51bGwpIHJldHVybiBudWxsO1xuICByZXR1cm4geyBzdGFydCwgZW5kOiBlbmQgPD0gc3RhcnQgPyBlbmQgKyAxNDQwIDogZW5kIH07XG59XG5cbi8qKiBcdTRFMEVcdTU0MENcdTY1RTUgYFtzdGFydCwgZW5kKWAgXHU3QTk3XHU1M0UzXHU5MUNEXHU1M0UwXHU3Njg0XHU1MjA2XHU5NDlGXHU2NTcwXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gb3ZlcmxhcE1pbnV0ZXMoXG4gIGJsb2NrOiBCbG9jayxcbiAgZGF0ZTogc3RyaW5nLFxuICBzdGFydDogbnVtYmVyLFxuICBlbmQ6IG51bWJlcixcbik6IG51bWJlciB7XG4gIGNvbnN0IGIgPSBiYW5kKGJsb2NrLCBkYXRlKTtcbiAgaWYgKGIgPT09IG51bGwpIHJldHVybiAwO1xuICByZXR1cm4gTWF0aC5taW4oZW5kLCBiLmVuZCkgLSBNYXRoLm1heChzdGFydCwgYi5zdGFydCkgPiAwXG4gICAgPyBNYXRoLm1pbihlbmQsIGIuZW5kKSAtIE1hdGgubWF4KHN0YXJ0LCBiLnN0YXJ0KVxuICAgIDogMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQmxvY2soYmxvY2s6IEJsb2NrKTogdm9pZCB7XG4gIGlmIChibG9jay5pZC5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjUgSUQgXHU0RTBEXHU4MEZEXHU0RTNBXHU3QTdBXCIpO1xuICB9XG4gIGlmIChibG9jay50aXRsZS50cmltKCkubGVuZ3RoID09PSAwIHx8IEFycmF5LmZyb20oYmxvY2sudGl0bGUpLmxlbmd0aCA+IDQwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHU1NDBEXHU3OUYwXHU5NzAwXHU0RTNBIDFcdTIwMTM0MCBcdTRFMkFcdTVCNTdcdTdCMjZcIik7XG4gIH1cbiAgaWYgKG1pbnV0ZXNPZihibG9jay5zdGFydCkgPT09IG51bGwgfHwgbWludXRlc09mKGJsb2NrLmVuZCkgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcdTk3MDBcdTRFM0FcdTY3MDlcdTY1NDhcdTc2ODQgSEg6TU0gXHU2NUY2XHU5NUY0XCIpO1xuICB9XG4gIGlmIChibG9jay5zdGFydCA9PT0gYmxvY2suZW5kKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHU3Njg0XHU1RjAwXHU1OUNCXHU0RTBFXHU3RUQzXHU2NzVGXHU0RTBEXHU4MEZEXHU3NkY4XHU1NDBDXCIpO1xuICB9XG4gIGNvbnN0IHVuaXF1ZSA9IG5ldyBTZXQoYmxvY2suZGF5cyk7XG4gIGlmIChcbiAgICBibG9jay5kYXlzLmxlbmd0aCA9PT0gMCB8fFxuICAgIGJsb2NrLmRheXMubGVuZ3RoID4gNyB8fFxuICAgIHVuaXF1ZS5zaXplICE9PSBibG9jay5kYXlzLmxlbmd0aCB8fFxuICAgIGJsb2NrLmRheXMuc29tZSgoZCkgPT4gZCA8IDEgfHwgZCA+IDcpXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGN1x1OTAwOVx1NjJFOVx1NEUwRFx1OTFDRFx1NTkwRFx1NzY4NFx1NjYxRlx1NjcxRlx1RkYwOFx1NTQ2OFx1NEUwMFx1NEUzQSAxXHVGRjBDXHU1NDY4XHU2NUU1XHU0RTNBIDdcdUZGMDlcIik7XG4gIH1cbiAgaWYgKEFycmF5LmZyb20oYmxvY2subm90ZXMpLmxlbmd0aCA+IDIwMDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcdTU5MDdcdTZDRThcdThGQzdcdTk1N0ZcIik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQmxvY2tzKGJsb2NrczogQmxvY2tbXSk6IHZvaWQge1xuICBpZiAoYmxvY2tzLmxlbmd0aCA+IDYwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkZFXHU4ODY4XHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHU2NzAwXHU1OTFBIDYwIFx1OTg3OVwiKTtcbiAgfVxuICBjb25zdCBpZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcbiAgICB2YWxpZGF0ZUJsb2NrKGJsb2NrKTtcbiAgICBpZiAoaWRzLmhhcyhibG9jay5pZCkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNSBJRCBcdTkxQ0RcdTU5MERcIik7XG4gICAgfVxuICAgIGlkcy5hZGQoYmxvY2suaWQpO1xuICB9XG59XG5cbi8qKiBcdTg5ODZcdTc2RDYgYGRhdGVgIFx1NzY4NFx1NjVGNlx1NkJCNVx1RkYwQ1x1NjMwOVx1NUYwMFx1NTlDQlx1NjVGNlx1OTVGNFx1MzAwMVx1NTE4RFx1NjMwOVx1NjgwN1x1OTg5OFx1NjM5Mlx1NUU4Rlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJsb2Nrc09uRGF0ZShibG9ja3M6IEJsb2NrW10sIGRhdGU6IHN0cmluZyk6IEJsb2NrW10ge1xuICBpZiAocGFyc2VEYXRlKGRhdGUpID09PSBudWxsKSByZXR1cm4gW107XG4gIHJldHVybiBibG9ja3NcbiAgICAuZmlsdGVyKChiKSA9PiBiYW5kKGIsIGRhdGUpICE9PSBudWxsKVxuICAgIC5zbGljZSgpXG4gICAgLnNvcnQoKGEsIGIpID0+XG4gICAgICBhLnN0YXJ0IDwgYi5zdGFydFxuICAgICAgICA/IC0xXG4gICAgICAgIDogYS5zdGFydCA+IGIuc3RhcnRcbiAgICAgICAgICA/IDFcbiAgICAgICAgICA6IGEudGl0bGUgPCBiLnRpdGxlXG4gICAgICAgICAgICA/IC0xXG4gICAgICAgICAgICA6IGEudGl0bGUgPiBiLnRpdGxlXG4gICAgICAgICAgICAgID8gMVxuICAgICAgICAgICAgICA6IDAsXG4gICAgKTtcbn1cblxuLyoqIGBkYXRlYCBcdTVGNTNcdTU5MjlcdTk3MDBcdTRFMTNcdTVGQzNcdTY1RjZcdTZCQjVcdTUzNjBcdTc1MjhcdTc2ODRcdTUyMDZcdTk0OUZcdTY1NzBcdUZGMDhcdTUzNjBcdTc1MjhcdThCQzFcdTYzNkVcdUZGMENcdTkxQ0RcdTUzRTBcdTRGMUFcdTkxQ0RcdTU5MERcdThCQTFcdTY1NzBcdUZGMDlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlZE1pbnV0ZXMoYmxvY2tzOiBCbG9ja1tdLCBkYXRlOiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAocGFyc2VEYXRlKGRhdGUpID09PSBudWxsKSByZXR1cm4gMDtcbiAgbGV0IHRvdGFsID0gMDtcbiAgZm9yIChjb25zdCBiIG9mIGJsb2Nrcykge1xuICAgIGlmIChiLmF0dGVudGlvbiAhPT0gXCJyZXF1aXJlZFwiKSBjb250aW51ZTtcbiAgICBjb25zdCBiYW5kVmFsdWUgPSBiYW5kKGIsIGRhdGUpO1xuICAgIGlmIChiYW5kVmFsdWUgIT09IG51bGwpIHRvdGFsICs9IGJhbmRWYWx1ZS5lbmQgLSBiYW5kVmFsdWUuc3RhcnQ7XG4gIH1cbiAgcmV0dXJuIHRvdGFsO1xufVxuIiwgIi8vISBcdTRFNjBcdTYwRUZcdTdFQzRcdUZGMUFcdTUzRUFcdTVFMjZcdTdCQTFcdThGOTZcdUZGMUJcdTVGNjJcdTcyQjZcdTRFMEVcdTUzNzBcdTUyMzdcdTg5QzRcdTUyMTlcdTc1MzEgdGVtcGxhdGVzIFx1N0JBMVx1NzQwNlx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvaGFiaXRzLnJzXHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yLCBlbnN1cmUgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7IGFzU3RyLCBpc09iamVjdCwgcmVqZWN0VW5rbm93biwgcmVxdWlyZWRGaWVsZCB9IGZyb20gXCIuL2pzb25cIjtcbmltcG9ydCB0eXBlIHsgSGFiaXQgfSBmcm9tIFwiLi9tb2RlbFwiO1xuXG5jb25zdCBIQUJJVF9LRVlTID0gW1wiaWRcIiwgXCJuYW1lXCJdIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIYWJpdChyYXc6IHVua25vd24pOiBIYWJpdCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTYwXHU2MEVGXHU3RUM0XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLkhBQklUX0tFWVNdLCBcIlx1NEU2MFx1NjBFRlx1N0VDNFwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTRFNjBcdTYwRUZcdTdFQzRcIiwgYXNTdHIpLFxuICAgIG5hbWU6IHJlcXVpcmVkRmllbGQocmF3LCBcIm5hbWVcIiwgXCJcdTRFNjBcdTYwRUZcdTdFQzRcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSGFiaXQoaDogSGFiaXQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IGlkOiBoLmlkLCBuYW1lOiBoLm5hbWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlSGFiaXQoaGFiaXQ6IEhhYml0KTogdm9pZCB7XG4gIGlmIChoYWJpdC5uYW1lLnRyaW0oKS5sZW5ndGggPT09IDAgfHwgQXJyYXkuZnJvbShoYWJpdC5uYW1lKS5sZW5ndGggPiA0MCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEU2MFx1NjBFRlx1NTQwRFx1NzlGMFx1OTcwMFx1NEUzQSAxXHUyMDEzNDAgXHU0RTJBXHU1QjU3XHU3QjI2XCIpO1xuICB9XG59XG4iLCAiLy8hIFx1NjVGNlx1OTVGNFx1NUI4OVx1NjM5Mlx1RkYxQVx1NjVFNVx1NjcxRi9cdTY1RjZcdTk1RjRcdTRFMEVcdTUzNTVcdTZCMjFcdTY1RjZcdTk1N0ZcdTY4MjFcdTlBOENcdTMwMDFcdTVGNTNcdTU5MjlcdTVGODVcdTU5MDRcdTc0MDZcdTk2MUZcdTUyMTdcdTMwMDFcdThCQTFcdTY1RjYvXHU5NTAxXHU2NzNBXHU1RUY2XHU1NDBFXHUzMDAxXHU4REU4XHU2NUU1XHU2RTA1XHU3NDA2XHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9yZW1pbmRlcnMucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7IGlkIH0gZnJvbSBcIi4vaWRzXCI7XG5pbXBvcnQgdHlwZSB7IEFwcERhdGEgfSBmcm9tIFwiLi9saWJcIjtcbmltcG9ydCB0eXBlIHsgU2V0dGluZ3MsIFRhc2ssIFRpbWVyIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IGlzSGFiaXQgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgZGF0ZUF0LCBtaW51dGVzT2YsIHNlY29uZHNPZkRheSwgdmFsaWREYXRlIH0gZnJvbSBcIi4vdGltZVwiO1xuXG4vKiogXHU0RUZCXHU1MkExXHU2NUU1XHU2NzFGXHU1RkM1XHU1ODZCXHUzMDAxXHU2M0QwXHU5MTkyXHU5NzAwXHU4OTgxXHU2NzA5XHU2NTQ4IEhIOk1NXHUzMDAxXHU1MzU1XHU2QjIxXHU2NUY2XHU5NTdGIDFcdTIwMTMxODBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVJlbWluZGVyVGFzayh0YXNrOiBUYXNrKTogdm9pZCB7XG4gIGlmICh0YXNrLmR1ZURhdGUgPT09IG51bGwgfHwgIXZhbGlkRGF0ZSh0YXNrLmR1ZURhdGUpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RUZCXHU1MkExXHU1RkM1XHU5ODdCXHU2MzA3XHU1QjlBXHU2NzA5XHU2NTQ4XHU3Njg0XHU4QkExXHU1MjEyXHU2NUU1XHU2NzFGXCIpO1xuICB9XG4gIGlmIChcbiAgICB0YXNrLmZvY3VzTWludXRlcyAhPT0gbnVsbCAmJlxuICAgICh0YXNrLmZvY3VzTWludXRlcyA8IDEgfHwgdGFzay5mb2N1c01pbnV0ZXMgPiAxODApXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTM1NVx1NkIyMVx1NEUxM1x1NkNFOFx1NjVGNlx1OTU3Rlx1OTcwMFx1NEUzQTFcdTIwMTQxODBcdTUyMDZcdTk0OUZcIik7XG4gIH1cbiAgaWYgKHRhc2sucmVtaW5kZXJUaW1lICE9PSBudWxsKSB7XG4gICAgaWYgKHRhc2suZHVlRGF0ZSA9PT0gbnVsbCB8fCBtaW51dGVzT2YodGFzay5yZW1pbmRlclRpbWUpID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTYzRDBcdTkxOTJcdTk3MDBcdTg5ODFcdThCQTFcdTUyMTJcdTY1RTVcdTY3MUZcdTU0OENcdTY3MDlcdTY1NDhcdTc2ODQgSEg6TU0gXHU2NUY2XHU5NUY0XCIpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFx1OEJBMVx1NTIxMlx1NTc1N1x1NjAzQlx1OTU3Rlx1RkYxQVx1NTE2OFx1OTBFOFx1NEUxM1x1NkNFOFx1NkJCNVx1NTJBMFx1NkJCNVx1OTVGNFx1NEYxMVx1NjA2Rlx1RkYwQ1x1NTkxQVx1NzU2QVx1ODMwNFx1NEVGQlx1NTJBMVx1OERFOFx1NEYxMVx1NjA2Rlx1OTVGNFx1OTY5OVx1NEVDRFx1NjcwOVx1NjU0OFx1MzAwMlxuICogXHU1QkY5XHU1RTk0IHJlbWluZGVyczo6d2luZG93X21pbnV0ZXNcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpbmRvd01pbnV0ZXModGFzazogVGFzaywgc2V0dGluZ3M6IFNldHRpbmdzKTogbnVtYmVyIHtcbiAgY29uc3QgZm9jdXMgPSB0YXNrLmZvY3VzTWludXRlcyA/PyBzZXR0aW5ncy5mb2N1c01pbnV0ZXM7XG4gIGNvbnN0IHNlc3Npb25zID0gTWF0aC5tYXgoMSwgdGFzay5lc3RpbWF0ZSk7XG4gIGNvbnN0IGV2ZXJ5ID0gTWF0aC5tYXgoMSwgc2V0dGluZ3MubG9uZ0JyZWFrRXZlcnkpO1xuICBsZXQgYnJlYWtzID0gMDtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBzZXNzaW9uczsgaSArPSAxKSB7XG4gICAgYnJlYWtzICs9XG4gICAgICBpICUgZXZlcnkgPT09IDAgPyBzZXR0aW5ncy5sb25nQnJlYWtNaW51dGVzIDogc2V0dGluZ3Muc2hvcnRCcmVha01pbnV0ZXM7XG4gIH1cbiAgcmV0dXJuIHNlc3Npb25zICogZm9jdXMgKyBicmVha3M7XG59XG5cbi8qKiBcdTdBN0FcdTk1RjJcdUZGMUFcdTY3MkFcdThGRDBcdTg4NENcdTMwMDFcdTY3MkFcdTVGMDBcdTU5Q0JcdTMwMDFcdTUyNjlcdTRGNTlcdTZFRTFcdTk4OURcdTMwMDFcdTY1RTBcdTk1MDFcdTY3M0FcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1pbmRlcklkbGUoZGF0YTogQXBwRGF0YSk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgICFkYXRhLnRpbWVyLnJ1bm5pbmcgJiZcbiAgICBkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgIGRhdGEudGltZXIucmVtYWluaW5nU2VjcyA9PT0gZGF0YS50aW1lci5kdXJhdGlvblNlY3MgJiZcbiAgICBkYXRhLmxvY2suYWN0aXZlID09PSBudWxsXG4gICk7XG59XG5cbi8qKiBcdTVGNTNcdTU5MjlcdTVGODVcdTU5MDRcdTc0MDZcdTYzRDBcdTkxOTJcdUZGMDhcdTYzMDkgXHU2NUU1XHU2NzFGXHUzMDAxXHU2NUY2XHU5NUY0XHUzMDAxSUQgXHU2MzkyXHU1RThGXHU1M0Q2XHU2NzAwXHU2NUU5XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gcGVuZGluZ1JlbWluZGVyKGRhdGE6IEFwcERhdGEpOiBUYXNrIHwgbnVsbCB7XG4gIGlmICghcmVtaW5kZXJJZGxlKGRhdGEpKSByZXR1cm4gbnVsbDtcbiAgbGV0IGJlc3Q6IFRhc2sgfCBudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCB0IG9mIGRhdGEudGFza3MpIHtcbiAgICBpZiAodC5jb21wbGV0ZWQgfHwgIXQucmVtaW5kZXJQZW5kaW5nKSBjb250aW51ZTtcbiAgICBpZiAoXG4gICAgICBiZXN0ID09PSBudWxsIHx8XG4gICAgICBgJHt0LmR1ZURhdGV9fCR7dC5yZW1pbmRlclRpbWV9fCR7dC5pZH1gIDxcbiAgICAgICAgYCR7YmVzdC5kdWVEYXRlfXwke2Jlc3QucmVtaW5kZXJUaW1lfXwke2Jlc3QuaWR9YFxuICAgICkge1xuICAgICAgYmVzdCA9IHQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBiZXN0O1xufVxuXG4vKiogXHU4MUVBXHU1MkE4XHU1RjAwXHU1REU1XHU1MDE5XHU5MDA5XHVGRjFBXHU2M0QwXHU5MTkyXHU1Rjg1XHU1OTA0XHU3NDA2XHU0RTE0XHU0RUNEXHU2NzA5XHU1MjY5XHU0RjU5XHU4RjZFXHU2QjIxXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gZHVlQXV0b1Rhc2soZGF0YTogQXBwRGF0YSk6IFRhc2sgfCBudWxsIHtcbiAgbGV0IGJlc3Q6IFRhc2sgfCBudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCB0IG9mIGRhdGEudGFza3MpIHtcbiAgICBpZiAoIXQucmVtaW5kZXJQZW5kaW5nIHx8ICF0YXNrSGFzUm91bmRzTGVmdChkYXRhLCB0KSkgY29udGludWU7XG4gICAgaWYgKFxuICAgICAgYmVzdCA9PT0gbnVsbCB8fFxuICAgICAgYCR7dC5kdWVEYXRlfXwke3QucmVtaW5kZXJUaW1lfXwke3QuaWR9YCA8XG4gICAgICAgIGAke2Jlc3QuZHVlRGF0ZX18JHtiZXN0LnJlbWluZGVyVGltZX18JHtiZXN0LmlkfWBcbiAgICApIHtcbiAgICAgIGJlc3QgPSB0O1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmVzdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhc2tIYXNSb3VuZHNMZWZ0KGRhdGE6IEFwcERhdGEsIHRhc2s6IFRhc2spOiBib29sZWFuIHtcbiAgaWYgKHRhc2suY29tcGxldGVkIHx8IHRhc2sucmVtaW5kZXJFeHBpcmVkKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNvbXBsZXRlZFJvdW5kcyA9IGRhdGEuc2Vzc2lvbnMuZmlsdGVyKFxuICAgIChzKSA9PiBzLnNvdXJjZSA9PT0gXCJ0aW1lclwiICYmIHMuY29tcGxldGVkICYmIHMudGFza0lkID09PSB0YXNrLmlkLFxuICApLmxlbmd0aDtcbiAgcmV0dXJuIGNvbXBsZXRlZFJvdW5kcyA8IHRhc2suZXN0aW1hdGU7XG59XG5cbi8qKiBcdTVCOUFcdTY1RjZcdTVGMDBcdTVERTVcdUZGMUFcdThCQTFcdTY1RjYvXHU2NjgyXHU1MDVDL1x1OTUwMVx1NjczQS9cdTgwMDNcdThCRDVcdTRFMkRcdTRFMERcdTYyQTJcdTUzNjBcdUZGMENcdThEODVcdThGQzdcdTRFRkJcdTUyQTFcdTY1RjZcdTZCQjVcdTRFMERcdTg4NjVcdTVGMDBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFydER1ZVRhc2soZGF0YTogQXBwRGF0YSwgYXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICBpZiAoXG4gICAgIWRhdGEuc2V0dGluZ3MuYXV0b1N0YXJ0VGFza3MgfHxcbiAgICAhcmVtaW5kZXJJZGxlKGRhdGEpIHx8XG4gICAgZGF0YS5lZHVjYXRpb24uYXNzZXNzbWVudHMuc29tZShcbiAgICAgIChhKSA9PiBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJiBhLnN0b3BwZWRBdCA9PT0gbnVsbCxcbiAgICApXG4gICkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXNrID0gZHVlQXV0b1Rhc2soZGF0YSk7XG4gIGlmICh0YXNrID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGRhdGEudGltZXIudGFza0lkID0gdGFzay5pZDtcbiAgcmVzZXRUbyhkYXRhLCBcImZvY3VzXCIpO1xuICBzdGFydFRpbWVyKGRhdGEsIGF0KTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKiBcdTYzRDBcdTkxOTJcdTcyQjZcdTYwMDFcdTYzQThcdThGREJcdUZGMUFcdTUyMzBcdTY3MUYvXHU0RjVDXHU1RTlGL1x1NUY4NVx1NTkwNFx1NzQwNlx1RkYwQ1x1OERFOFx1NjVFNVx1NkUwNVx1NzQwNlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRpY2tSZW1pbmRlcnMoZGF0YTogQXBwRGF0YSwgYXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICBjb25zdCB0b2RheSA9IGRhdGVBdChhdCk7XG4gIGNvbnN0IG5vd01pbnV0ZXMgPSBNYXRoLmZsb29yKHNlY29uZHNPZkRheShhdCkgLyA2MCk7XG4gIGNvbnN0IG5vd1NlY29uZHMgPSBzZWNvbmRzT2ZEYXkoYXQpO1xuICBjb25zdCBzZXR0aW5ncyA9IGRhdGEuc2V0dGluZ3M7XG4gIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gIGZvciAoY29uc3QgdCBvZiBkYXRhLnRhc2tzKSB7XG4gICAgY29uc3QgaXNUb2RheSA9IHQuZHVlRGF0ZSA9PT0gdG9kYXk7XG4gICAgY29uc3QgcGFzdCA9IHQuZHVlRGF0ZSAhPT0gbnVsbCAmJiB0LmR1ZURhdGUgPCB0b2RheTtcbiAgICBjb25zdCBzdGFydCA9IHQucmVtaW5kZXJUaW1lICE9PSBudWxsID8gbWludXRlc09mKHQucmVtaW5kZXJUaW1lKSA6IG51bGw7XG4gICAgLy8gXHU1QjlBXHU2NUY2XHU0RUZCXHU1MkExXHU1NzI4XHU1MTc2XHU2NUU1XHU2NzFGXHU4RkM3XHU1M0JCXHU1NDBFXHUzMDAxXHU2MjE2XHU4QkExXHU1MjEyXHU1NzU3XHU3RUQzXHU2NzVGXHU1NDBFXHU0RjVDXHU1RTlGXHVGRjFCXHU2QjY0XHU1NDBFXHU2NUUyXHU0RTBEXHU2M0QwXHU5MTkyXHU0RTVGXHU0RTBEXHU5ODdBXHU1RUY2XHUzMDAyXG4gICAgY29uc3QgZXhwaXJlZCA9XG4gICAgICAhdC5jb21wbGV0ZWQgJiZcbiAgICAgIChzdGFydCAhPT0gbnVsbFxuICAgICAgICA/ICgoKSA9PiB7XG4gICAgICAgICAgICAvLyBcdTY2NkVcdTkwMUFcdTRFRkJcdTUyQTFcdTU3MjhcdThCQTFcdTUyMTJcdTU3NTdcdTdFRDNcdTY3NUZcdTU0MEVcdTc2ODRcdTk3NTlcdTYwMDFcdTkxQ0RcdTRGRUVcdTdBOTdcdTUzRTNcdTUxODVcdTRFQ0RcdTUzRUZcdTg4NjVcdTUwNUFcdUZGMUJcdTRFNjBcdTYwRUZcdTdBOTdcdTUzRTNcdTRFM0EgMFx1MzAwMlxuICAgICAgICAgICAgY29uc3Qgc3BlbnRBdCA9XG4gICAgICAgICAgICAgIHN0YXJ0ICtcbiAgICAgICAgICAgICAgd2luZG93TWludXRlcyh0LCBzZXR0aW5ncykgK1xuICAgICAgICAgICAgICAoaXNIYWJpdCh0KSA/IDAgOiB0LnNjcmFwTWludXRlcyk7XG4gICAgICAgICAgICByZXR1cm4gcGFzdCB8fCAoaXNUb2RheSAmJiBub3dTZWNvbmRzID49IHNwZW50QXQgKiA2MCk7XG4gICAgICAgICAgfSkoKVxuICAgICAgICA6IGZhbHNlKTtcbiAgICBpZiAoZXhwaXJlZCAmJiAhdC5yZW1pbmRlckV4cGlyZWQpIHtcbiAgICAgIHQucmVtaW5kZXJFeHBpcmVkID0gdHJ1ZTtcbiAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoKHQuY29tcGxldGVkIHx8IGV4cGlyZWQgfHwgIWlzVG9kYXkpICYmIHQucmVtaW5kZXJQZW5kaW5nKSB7XG4gICAgICB0LnJlbWluZGVyUGVuZGluZyA9IGZhbHNlO1xuICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmIChleHBpcmVkICYmICF0LnJlbWluZGVyRmlyZWQpIHtcbiAgICAgIHQucmVtaW5kZXJGaXJlZCA9IHRydWU7XG4gICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgIXQuY29tcGxldGVkICYmXG4gICAgICAhdC5yZW1pbmRlckZpcmVkICYmXG4gICAgICBpc1RvZGF5ICYmXG4gICAgICAhZXhwaXJlZCAmJlxuICAgICAgc3RhcnQgIT09IG51bGwgJiZcbiAgICAgIHN0YXJ0IDw9IG5vd01pbnV0ZXNcbiAgICApIHtcbiAgICAgIHQucmVtaW5kZXJGaXJlZCA9IHRydWU7XG4gICAgICB0LnJlbWluZGVyUGVuZGluZyA9IHRydWU7XG4gICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZWQ7XG59XG5cbi8vIGxpYi50cyBcdTU5MERcdTc1MjhcdTc2ODRcdThCQTFcdTY1RjZcdTUzOUZcdThCRURcdUZGMDhcdTVCRjlcdTVFOTQgQXBwRGF0YSBcdTc2ODRcdTc5QzFcdTY3MDlcdTY1QjlcdTZDRDVcdUZGMDlcdTMwMDJcblxuZXhwb3J0IGZ1bmN0aW9uIHRpbWVyUmVtYWluaW5nKHRpbWVyOiBUaW1lciwgYXQ6IG51bWJlcik6IG51bWJlciB7XG4gIGlmICh0aW1lci5ydW5uaW5nICYmIHRpbWVyLmRlYWRsaW5lICE9PSBudWxsKSB7XG4gICAgY29uc3QgcmVtYWluaW5nID0gdGltZXIuZGVhZGxpbmUgLSBhdDtcbiAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgocmVtYWluaW5nLCAwKSwgdGltZXIuZHVyYXRpb25TZWNzKTtcbiAgfVxuICByZXR1cm4gdGltZXIucmVtYWluaW5nU2Vjcztcbn1cblxuLyoqIFx1N0VEM1x1NkUwNVx1NUY1M1x1NTI0RFx1OEJBMVx1NjVGNlx1NEUzQVx1NEUwMFx1Njc2MSBUaW1lciBcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcdUZGMUJcdTk3NUVcdTRFMTNcdTZDRThcdTYyMTZcdTk2RjZcdTc1MjhcdTY1RjZcdTRFMERcdTUwNUFcdTRFRkJcdTRGNTVcdTRFOEJcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZWNvcmRTZXNzaW9uKFxuICBkYXRhOiBBcHBEYXRhLFxuICBhdDogbnVtYmVyLFxuICBjb21wbGV0ZWQ6IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgY29uc3QgZWxhcHNlZCA9IGRhdGEudGltZXIuZHVyYXRpb25TZWNzIC0gdGltZXJSZW1haW5pbmcoZGF0YS50aW1lciwgYXQpO1xuICBpZiAoZGF0YS50aW1lci5tb2RlICE9PSBcImZvY3VzXCIgfHwgZWxhcHNlZCA9PT0gMCkgcmV0dXJuO1xuICBjb25zdCB0YXNrID0gZGF0YS50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSBkYXRhLnRpbWVyLnRhc2tJZCk7XG4gIGNvbnN0IHByb2plY3QgPVxuICAgIHRhc2sgIT09IHVuZGVmaW5lZCAmJiB0YXNrLnByb2plY3RJZCAhPT0gbnVsbFxuICAgICAgPyBkYXRhLnByb2plY3RzLmZpbmQoKHApID0+IHAuaWQgPT09IHRhc2sucHJvamVjdElkKVxuICAgICAgOiB1bmRlZmluZWQ7XG4gIGRhdGEuc2Vzc2lvbnMucHVzaCh7XG4gICAgaWQ6IGlkKCksXG4gICAgc291cmNlOiBcInRpbWVyXCIsXG4gICAgdGFza0lkOiBkYXRhLnRpbWVyLnRhc2tJZCxcbiAgICB0YXNrVGl0bGU6IHRhc2s/LnRpdGxlID8/IFwiXHU4MUVBXHU3NTMxXHU0RTEzXHU2Q0U4XCIsXG4gICAgcHJvamVjdE5hbWU6IHByb2plY3Q/Lm5hbWUgPz8gXCJcdTY3MkFcdTUyMDZcdTdDN0JcIixcbiAgICBzdGFydGVkQXQ6IGRhdGEudGltZXIuc3RhcnRlZEF0ID8/IGF0IC0gZWxhcHNlZCxcbiAgICBlbmRlZEF0OiBhdCxcbiAgICBkdXJhdGlvblNlY3M6IGVsYXBzZWQsXG4gICAgY29tcGxldGVkLFxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0VG8oXG4gIGRhdGE6IEFwcERhdGEsXG4gIG1vZGU6IFwiZm9jdXNcIiB8IFwic2hvcnRCcmVha1wiIHwgXCJsb25nQnJlYWtcIixcbik6IHZvaWQge1xuICBkYXRhLnRpbWVyLmF1dG9Gb2N1c0Jsb2NrZWQgPSBmYWxzZTtcbiAgZGF0YS50aW1lci5tb2RlID0gbW9kZTtcbiAgZGF0YS50aW1lci5ydW5uaW5nID0gZmFsc2U7XG4gIGRhdGEudGltZXIuZHVyYXRpb25TZWNzID0gZHVyYXRpb25PZihkYXRhLCBtb2RlKTtcbiAgZGF0YS50aW1lci5yZW1haW5pbmdTZWNzID0gZGF0YS50aW1lci5kdXJhdGlvblNlY3M7XG4gIGRhdGEudGltZXIuZGVhZGxpbmUgPSBudWxsO1xuICBkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkdXJhdGlvbk9mKFxuICBkYXRhOiBBcHBEYXRhLFxuICBtb2RlOiBcImZvY3VzXCIgfCBcInNob3J0QnJlYWtcIiB8IFwibG9uZ0JyZWFrXCIsXG4pOiBudW1iZXIge1xuICBjb25zdCBtaW51dGVzID1cbiAgICBtb2RlID09PSBcImZvY3VzXCJcbiAgICAgID8gKGRhdGEudGFza3MuZmluZCgodCkgPT4gdC5pZCA9PT0gZGF0YS50aW1lci50YXNrSWQpPy5mb2N1c01pbnV0ZXMgPz9cbiAgICAgICAgZGF0YS5zZXR0aW5ncy5mb2N1c01pbnV0ZXMpXG4gICAgICA6IG1vZGUgPT09IFwic2hvcnRCcmVha1wiXG4gICAgICAgID8gZGF0YS5zZXR0aW5ncy5zaG9ydEJyZWFrTWludXRlc1xuICAgICAgICA6IGRhdGEuc2V0dGluZ3MubG9uZ0JyZWFrTWludXRlcztcbiAgcmV0dXJuIDYwICogbWludXRlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0VGltZXIoZGF0YTogQXBwRGF0YSwgYXQ6IG51bWJlcik6IHZvaWQge1xuICBpZiAoZGF0YS50aW1lci5tb2RlID09PSBcImZvY3VzXCIpIHtcbiAgICBpZiAoXG4gICAgICBkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgICAgIWRhdGEudGltZXIucnVubmluZyAmJlxuICAgICAgZGF0YS50aW1lci5yZW1haW5pbmdTZWNzID09PSBkYXRhLnRpbWVyLmR1cmF0aW9uU2Vjc1xuICAgICkge1xuICAgICAgcmVzZXRUbyhkYXRhLCBcImZvY3VzXCIpO1xuICAgIH1cbiAgICBjb25zdCB0YXNrID0gZGF0YS50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSBkYXRhLnRpbWVyLnRhc2tJZCk7XG4gICAgaWYgKHRhc2sgIT09IHVuZGVmaW5lZCkgdGFzay5yZW1pbmRlclBlbmRpbmcgPSBmYWxzZTtcbiAgfVxuICBpZiAoIWRhdGEudGltZXIucnVubmluZykge1xuICAgIGlmIChkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbCkgZGF0YS50aW1lci5zdGFydGVkQXQgPSBhdDtcbiAgICBkYXRhLnRpbWVyLmRlYWRsaW5lID0gYXQgKyBkYXRhLnRpbWVyLnJlbWFpbmluZ1NlY3M7XG4gICAgZGF0YS50aW1lci5ydW5uaW5nID0gdHJ1ZTtcbiAgfVxufVxuIiwgIi8vISBcdTZBMjFcdTY3N0ZcdTRFMEVcdTUzNzBcdTUyMzdcdUZGMUFcdTVGNjJcdTcyQjZcdTUzNzBcdTY1RjZcdTU5MERcdTUyMzZcdUZGMENcdThEMjZcdTY3MkNcdTcyRUNcdTdBQ0JcdTRFOEVcdTVCOUVcdTRGOEJcdUZGMENcdTUyMjBcdTRFODZcdTRFMERcdTRGMUFcdTkxQ0RcdTczQjBcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgY3JhdGVzL2NvcmUvc3JjL3RlbXBsYXRlcy5yc1x1MzAwMkFwcERhdGEgXHU2NUI5XHU2Q0Q1XHU0RUU1XHU4MUVBXHU3NTMxXHU1MUZEXHU2NTcwICsgbGliLnRzIFx1ODU4NFx1NTMwNVx1ODhDNVx1NjNEMFx1NEY5Qlx1MzAwMlxuXG5pbXBvcnQgeyBBcHBFcnJvciwgY2xvbmUsIGVuc3VyZSB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHsgaWQgfSBmcm9tIFwiLi9pZHNcIjtcbmltcG9ydCB7XG4gIGFzQXJyYXksXG4gIGFzQm9vbCxcbiAgYXNJbnQsXG4gIGFzT3B0LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICBvbmVPZixcbiAgcmVqZWN0VW5rbm93bixcbiAgcmVxdWlyZWRGaWVsZCxcbn0gZnJvbSBcIi4vanNvblwiO1xuaW1wb3J0IHR5cGUge1xuICBDYWxlbmRhclNsb3QsXG4gIFByaW50UmVjb3JkLFxuICBQcmludGluZyxcbiAgUHJpbnRTbG90LFxuICBTaGFwZSxcbiAgVGFzayxcbiAgVGVtcGxhdGUsXG4gIFRlbXBsYXRlU3VidGFzayxcbn0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB0eXBlIHsgQXBwRGF0YSB9IGZyb20gXCIuL2xpYlwiO1xuaW1wb3J0IHsgaXNIYWJpdCwga2luZE9mIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IHdpbmRvd01pbnV0ZXMgfSBmcm9tIFwiLi9yZW1pbmRlcnNcIjtcbmltcG9ydCB7XG4gIGFkZERheXMsXG4gIGRhdGVBdCxcbiAgbWludXRlc09mLFxuICBwYXJzZURhdGUsXG4gIHNlY29uZHNPZkRheSxcbiAgdmFsaWREYXRlLFxuICB2YWxpZFRpbWUsXG4gIHdlZWtTdGFydCxcbiAgd2Vla2RheU1vbmRheSxcbn0gZnJvbSBcIi4vdGltZVwiO1xuXG5jb25zdCBURU1QTEFURV9TVUJUQVNLX0tFWVMgPSBbXCJpZFwiLCBcInRpdGxlXCJdIGFzIGNvbnN0O1xuY29uc3QgU0hBUEVfS0VZUyA9IFtcbiAgXCJ0aXRsZVwiLFxuICBcIm5vdGVzXCIsXG4gIFwicHJvamVjdElkXCIsXG4gIFwiaGFiaXRJZFwiLFxuICBcImZvY3VzTWludXRlc1wiLFxuICBcInNjcmFwTWludXRlc1wiLFxuICBcInByaW9yaXR5XCIsXG4gIFwiZXN0aW1hdGVcIixcbiAgXCJ0YWdzXCIsXG4gIFwic3VidGFza3NcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBQUklOVF9TTE9UX0tFWVMgPSBbXCJkYXlzXCIsIFwidGltZVwiXSBhcyBjb25zdDtcbmNvbnN0IENBTEVOREFSX1NMT1RfS0VZUyA9IFtcImRhdGVzXCIsIFwidGltZVwiXSBhcyBjb25zdDtcbmNvbnN0IFRFTVBMQVRFX0tFWVMgPSBbXG4gIFwiaWRcIixcbiAgXCJzaGFwZVwiLFxuICBcInByaW50aW5nXCIsXG4gIFwiYXV0b21hdGljXCIsXG4gIFwicHJpbnRBaGVhZERheXNcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBQUklOVF9SRUNPUkRfS0VZUyA9IFtcInRlbXBsYXRlSWRcIiwgXCJkYXRlXCJdIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZVN1YnRhc2socmF3OiB1bmtub3duKTogVGVtcGxhdGVTdWJ0YXNrIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTZBMjFcdTY3N0ZcdTVCNTBcdTRFRkJcdTUyQTFcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uVEVNUExBVEVfU1VCVEFTS19LRVlTXSwgXCJcdTZBMjFcdTY3N0ZcdTVCNTBcdTRFRkJcdTUyQTFcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2QTIxXHU2NzdGXHU1QjUwXHU0RUZCXHU1MkExXCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTZBMjFcdTY3N0ZcdTVCNTBcdTRFRkJcdTUyQTFcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTaGFwZShyYXc6IHVua25vd24pOiBTaGFwZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QTIxXHU2NzdGXHU1RjYyXHU3MkI2XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlNIQVBFX0tFWVNdLCBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiKTtcbiAgcmV0dXJuIHtcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNTdHIpLFxuICAgIG5vdGVzOiBmaWVsZChyYXcsIFwibm90ZXNcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNTdHIsIFwiXCIpLFxuICAgIHByb2plY3RJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInByb2plY3RJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBoYWJpdElkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiaGFiaXRJZFwiLFxuICAgICAgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImhhYml0SWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZm9jdXNNaW51dGVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiZm9jdXNNaW51dGVzXCIsXG4gICAgICBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZm9jdXNNaW51dGVzXCIsICh4KSA9PiBhc0ludCh4LCBcImZvY3VzTWludXRlc1wiKSksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBzY3JhcE1pbnV0ZXM6IGZpZWxkKHJhdywgXCJzY3JhcE1pbnV0ZXNcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNJbnQsIDApLFxuICAgIHByaW9yaXR5OiBmaWVsZChyYXcsIFwicHJpb3JpdHlcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNJbnQsIDApLFxuICAgIGVzdGltYXRlOiBmaWVsZChyYXcsIFwiZXN0aW1hdGVcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNJbnQsIDEpLFxuICAgIHRhZ3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YWdzXCIsXG4gICAgICBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0YWdzXCIpLm1hcCgodCkgPT4gYXNTdHIodCwgXCJcdTY4MDdcdTdCN0VcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBzdWJ0YXNrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInN1YnRhc2tzXCIsXG4gICAgICBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJzdWJ0YXNrc1wiKS5tYXAocGFyc2VUZW1wbGF0ZVN1YnRhc2spLFxuICAgICAgW10sXG4gICAgKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVNoYXBlKHM6IFNoYXBlKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIHRpdGxlOiBzLnRpdGxlLFxuICAgIG5vdGVzOiBzLm5vdGVzLFxuICAgIHByb2plY3RJZDogcy5wcm9qZWN0SWQsXG4gICAgaGFiaXRJZDogcy5oYWJpdElkLFxuICAgIGZvY3VzTWludXRlczogcy5mb2N1c01pbnV0ZXMsXG4gICAgc2NyYXBNaW51dGVzOiBzLnNjcmFwTWludXRlcyxcbiAgICBwcmlvcml0eTogcy5wcmlvcml0eSxcbiAgICBlc3RpbWF0ZTogcy5lc3RpbWF0ZSxcbiAgICB0YWdzOiBzLnRhZ3MsXG4gICAgc3VidGFza3M6IHMuc3VidGFza3MubWFwKChzdWIpID0+ICh7IGlkOiBzdWIuaWQsIHRpdGxlOiBzdWIudGl0bGUgfSkpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcmludFNsb3QocmF3OiB1bmtub3duKTogUHJpbnRTbG90IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uUFJJTlRfU0xPVF9LRVlTXSwgXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcIik7XG4gIHJldHVybiB7XG4gICAgZGF5czogYXNBcnJheShcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImRheXNcIiwgXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcIiwgKHYpID0+IHYpLFxuICAgICAgXCJkYXlzXCIsXG4gICAgKS5tYXAoKGQpID0+IGFzSW50KGQsIFwiXHU1NDY4XHU2NzFGXHU2NjFGXHU2NzFGXCIpKSxcbiAgICB0aW1lOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGltZVwiLFxuICAgICAgXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInRpbWVcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNhbGVuZGFyU2xvdChyYXc6IHVua25vd24pOiBDYWxlbmRhclNsb3Qge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5DQUxFTkRBUl9TTE9UX0tFWVNdLCBcIlx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVwiKTtcbiAgcmV0dXJuIHtcbiAgICBkYXRlczogYXNBcnJheShcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImRhdGVzXCIsIFwiXHU2NUU1XHU3QTBCXHU2NUY2XHU2QkI1XCIsICh2KSA9PiB2KSxcbiAgICAgIFwiZGF0ZXNcIixcbiAgICApLm1hcCgoZCkgPT4gYXNTdHIoZCwgXCJcdTY1RTVcdTdBMEJcdTY1RTVcdTY3MUZcIikpLFxuICAgIHRpbWU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0aW1lXCIsXG4gICAgICBcIlx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwidGltZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJpbnRpbmcocmF3OiB1bmtub3duKTogUHJpbnRpbmcge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTM3MFx1NTIzN1x1ODlDNFx1NTIxOVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgY29uc3Qga2luZCA9IG9uZU9mKFxuICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImtpbmRcIiwgXCJcdTUzNzBcdTUyMzdcdTg5QzRcdTUyMTlcIiwgKHYpID0+IHYpLFxuICAgIFwiXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5IGtpbmRcIixcbiAgICBbXCJvbmNlXCIsIFwiY2FsZW5kYXJcIiwgXCJ3ZWVrbHlcIl0sXG4gICk7XG4gIGlmIChraW5kID09PSBcIm9uY2VcIikge1xuICAgIHJlamVjdFVua25vd24ocmF3LCBbXCJraW5kXCIsIFwiZGF0ZVwiLCBcInRpbWVcIl0sIFwiXHU0RTAwXHU2QjIxXHU2MDI3XHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIpO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kLFxuICAgICAgZGF0ZTogZmllbGQoXG4gICAgICAgIHJhdyxcbiAgICAgICAgXCJkYXRlXCIsXG4gICAgICAgIFwiXHU0RTAwXHU2QjIxXHU2MDI3XHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsXG4gICAgICAgICh2KSA9PiBhc09wdCh2LCBcImRhdGVcIiwgYXNTdHIpLFxuICAgICAgICBudWxsLFxuICAgICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgICAgdGltZTogZmllbGQoXG4gICAgICAgIHJhdyxcbiAgICAgICAgXCJ0aW1lXCIsXG4gICAgICAgIFwiXHU0RTAwXHU2QjIxXHU2MDI3XHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsXG4gICAgICAgICh2KSA9PiBhc09wdCh2LCBcInRpbWVcIiwgYXNTdHIpLFxuICAgICAgICBudWxsLFxuICAgICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIH07XG4gIH1cbiAgaWYgKGtpbmQgPT09IFwiY2FsZW5kYXJcIikge1xuICAgIHJlamVjdFVua25vd24ocmF3LCBbXCJraW5kXCIsIFwic2xvdHNcIl0sIFwiXHU2NUU1XHU3QTBCXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIpO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kLFxuICAgICAgc2xvdHM6IGFzQXJyYXkoXG4gICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNsb3RzXCIsIFwiXHU2NUU1XHU3QTBCXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsICh2KSA9PiB2KSxcbiAgICAgICAgXCJzbG90c1wiLFxuICAgICAgKS5tYXAocGFyc2VDYWxlbmRhclNsb3QpLFxuICAgIH07XG4gIH1cbiAgcmVqZWN0VW5rbm93bihyYXcsIFtcImtpbmRcIiwgXCJzbG90c1wiXSwgXCJcdTU0NjhcdTY3MUZcdTUzNzBcdTUyMzdcdTg5QzRcdTUyMTlcIik7XG4gIHJldHVybiB7XG4gICAga2luZCxcbiAgICBzbG90czogYXNBcnJheShcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNsb3RzXCIsIFwiXHU1NDY4XHU2NzFGXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsICh2KSA9PiB2KSxcbiAgICAgIFwic2xvdHNcIixcbiAgICApLm1hcChwYXJzZVByaW50U2xvdCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVQcmludGluZyhwOiBQcmludGluZyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgaWYgKHAua2luZCA9PT0gXCJvbmNlXCIpIHtcbiAgICByZXR1cm4geyBraW5kOiBcIm9uY2VcIiwgZGF0ZTogcC5kYXRlLCB0aW1lOiBwLnRpbWUgfTtcbiAgfVxuICBpZiAocC5raW5kID09PSBcImNhbGVuZGFyXCIpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogXCJjYWxlbmRhclwiLFxuICAgICAgc2xvdHM6IHAuc2xvdHMubWFwKChzKSA9PiAoeyBkYXRlczogcy5kYXRlcywgdGltZTogcy50aW1lIH0pKSxcbiAgICB9O1xuICB9XG4gIHJldHVybiB7XG4gICAga2luZDogXCJ3ZWVrbHlcIixcbiAgICBzbG90czogcC5zbG90cy5tYXAoKHMpID0+ICh7IGRheXM6IHMuZGF5cywgdGltZTogcy50aW1lIH0pKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUocmF3OiB1bmtub3duKTogVGVtcGxhdGUge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NkEyMVx1Njc3Rlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5URU1QTEFURV9LRVlTXSwgXCJcdTZBMjFcdTY3N0ZcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2QTIxXHU2NzdGXCIsIGFzU3RyKSxcbiAgICBzaGFwZTogcGFyc2VTaGFwZShyZXF1aXJlZEZpZWxkKHJhdywgXCJzaGFwZVwiLCBcIlx1NkEyMVx1Njc3RlwiLCAodikgPT4gdikpLFxuICAgIHByaW50aW5nOiBwYXJzZVByaW50aW5nKHJlcXVpcmVkRmllbGQocmF3LCBcInByaW50aW5nXCIsIFwiXHU2QTIxXHU2NzdGXCIsICh2KSA9PiB2KSksXG4gICAgYXV0b21hdGljOiBmaWVsZChyYXcsIFwiYXV0b21hdGljXCIsIFwiXHU2QTIxXHU2NzdGXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIHByaW50QWhlYWREYXlzOiBmaWVsZChyYXcsIFwicHJpbnRBaGVhZERheXNcIiwgXCJcdTZBMjFcdTY3N0ZcIiwgYXNJbnQsIDcpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplVGVtcGxhdGUodDogVGVtcGxhdGUpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHQuaWQsXG4gICAgc2hhcGU6IHNlcmlhbGl6ZVNoYXBlKHQuc2hhcGUpLFxuICAgIHByaW50aW5nOiBzZXJpYWxpemVQcmludGluZyh0LnByaW50aW5nKSxcbiAgICBhdXRvbWF0aWM6IHQuYXV0b21hdGljLFxuICAgIHByaW50QWhlYWREYXlzOiB0LnByaW50QWhlYWREYXlzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcmludFJlY29yZChyYXc6IHVua25vd24pOiBQcmludFJlY29yZCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlBSSU5UX1JFQ09SRF9LRVlTXSwgXCJcdTUzNzBcdTUyMzdcdThCQjBcdTVGNTVcIik7XG4gIHJldHVybiB7XG4gICAgdGVtcGxhdGVJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwidGVtcGxhdGVJZFwiLCBcIlx1NTM3MFx1NTIzN1x1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgZGF0ZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImRhdGVcIixcbiAgICAgIFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJkYXRlXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUHJpbnRSZWNvcmQocDogUHJpbnRSZWNvcmQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IHRlbXBsYXRlSWQ6IHAudGVtcGxhdGVJZCwgZGF0ZTogcC5kYXRlIH07XG59XG5cbi8qKiBcdTU0NjhcdTY3MUZcdTZBMjFcdTY3N0ZcdTYyNERcdTY2MkZcdTkxQ0RcdTU5MERcdTY3NjVcdTZFOTBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZVJlY3VycmluZyh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIHRlbXBsYXRlLnByaW50aW5nLmtpbmQgPT09IFwid2Vla2x5XCI7XG59XG5cbi8qKiBcdTRFMDBcdTRFMkFcdTY1RTVcdTY3MUZcdTVCRjlcdTVFOTRcdTc2ODRcdTUxNjhcdTkwRThcdTVGMDBcdTU5Q0JcdTY1RjZcdTUyM0JcdUZGMUJcdTY1RTVcdTY3MUZcdTY1RTBcdTY1NDhcdTYyMTZcdTRFMERcdTU3MjhcdTVCODlcdTYzOTJcdTUxODVcdTYyQTVcdTk1MTlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZVRpbWVzKFxuICB0ZW1wbGF0ZTogVGVtcGxhdGUsXG4gIGRhdGU6IHN0cmluZyB8IG51bGwsXG4pOiAoc3RyaW5nIHwgbnVsbClbXSB7XG4gIGlmIChkYXRlID09PSBudWxsIHx8ICF2YWxpZERhdGUoZGF0ZSkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTUzNzBcdTUyMzdcdTY1RTVcdTY3MUZcIik7XG4gIH1cbiAgY29uc3QgcHJpbnRpbmcgPSB0ZW1wbGF0ZS5wcmludGluZztcbiAgaWYgKHByaW50aW5nLmtpbmQgPT09IFwib25jZVwiKSB7XG4gICAgaWYgKHByaW50aW5nLnRpbWUgIT09IG51bGwgJiYgZGF0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QjlBXHU2NUY2XHU1QjlFXHU0RjhCXHU5NzAwXHU4OTgxXHU2NUU1XHU2NzFGXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW3ByaW50aW5nLnRpbWVdO1xuICB9XG4gIGlmIChwcmludGluZy5raW5kID09PSBcImNhbGVuZGFyXCIpIHtcbiAgICBjb25zdCB0aW1lcyA9IHByaW50aW5nLnNsb3RzXG4gICAgICAuZmlsdGVyKChzKSA9PiBzLmRhdGVzLmluY2x1ZGVzKGRhdGUpKVxuICAgICAgLm1hcCgocykgPT4gcy50aW1lKTtcbiAgICBpZiAodGltZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCRTVcdTY1RTVcdTY3MUZcdTRFMERcdTU3MjhcdTY1RTVcdTdBMEJcdTg4NjhcdTRFMkRcIik7XG4gICAgfVxuICAgIHJldHVybiB0aW1lcztcbiAgfVxuICBjb25zdCB3ZWVrZGF5ID0gd2Vla2RheU1vbmRheShwYXJzZURhdGUoZGF0ZSkhKTtcbiAgY29uc3QgdGltZXMgPSBwcmludGluZy5zbG90c1xuICAgIC5maWx0ZXIoKHMpID0+IHMuZGF5cy5pbmNsdWRlcyh3ZWVrZGF5KSlcbiAgICAubWFwKChzKSA9PiBzLnRpbWUpO1xuICBpZiAodGltZXMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkU1XHU2NUU1XHU2NzFGXHU0RTBEXHU1NzI4XHU2NzJDXHU1NDY4XHU1Qjg5XHU2MzkyXHU0RTJEXCIpO1xuICB9XG4gIHJldHVybiB0aW1lcztcbn1cblxuLyoqIFx1NTM3MFx1NTFGQVx1NUI5RVx1NEY4Qlx1RkYxQVx1NUY2Mlx1NzJCNlx1NTcyOFx1NTM3MFx1NTIzN1x1NjVGNlx1NTIzQlx1NTkwRFx1NTIzNlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlSW5zdGFuY2UoXG4gIHRlbXBsYXRlOiBUZW1wbGF0ZSxcbiAgZGF0ZTogc3RyaW5nIHwgbnVsbCxcbiAgdGltZTogc3RyaW5nIHwgbnVsbCxcbiAgYXQ6IG51bWJlcixcbik6IFRhc2sge1xuICBjb25zdCB0YXNrOiBUYXNrID0ge1xuICAgIGlkOiBpZCgpLFxuICAgIHRlbXBsYXRlSWQ6IHRlbXBsYXRlLmlkLFxuICAgIHJlY3VycmluZzogdGVtcGxhdGVSZWN1cnJpbmcodGVtcGxhdGUpLFxuICAgIHRpdGxlOiBcIlwiLFxuICAgIG5vdGVzOiBcIlwiLFxuICAgIHByb2plY3RJZDogbnVsbCxcbiAgICBoYWJpdElkOiBudWxsLFxuICAgIGR1ZURhdGU6IGRhdGUsXG4gICAgcmVtaW5kZXJUaW1lOiB0aW1lLFxuICAgIGZvY3VzTWludXRlczogbnVsbCxcbiAgICBzY3JhcE1pbnV0ZXM6IDAsXG4gICAgcHJpb3JpdHk6IDAsXG4gICAgZXN0aW1hdGU6IDEsXG4gICAgcmVtaW5kZXJGaXJlZDogZmFsc2UsXG4gICAgcmVtaW5kZXJQZW5kaW5nOiBmYWxzZSxcbiAgICByZW1pbmRlckV4cGlyZWQ6IGZhbHNlLFxuICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgY29tcGxldGVkQXQ6IG51bGwsXG4gICAgY3JlYXRlZEF0OiBhdCxcbiAgICB0YWdzOiBbXSxcbiAgICBzdWJ0YXNrczogW10sXG4gIH07XG4gIGNvcHlTaGFwZSh0ZW1wbGF0ZS5zaGFwZSwgdGFzayk7XG4gIHJldHVybiB0YXNrO1xufVxuXG5mdW5jdGlvbiBjb3B5U2hhcGUoc2hhcGU6IFNoYXBlLCB0YXNrOiBUYXNrKTogdm9pZCB7XG4gIHRhc2sudGl0bGUgPSBzaGFwZS50aXRsZTtcbiAgdGFzay5ub3RlcyA9IHNoYXBlLm5vdGVzO1xuICB0YXNrLnByb2plY3RJZCA9IHNoYXBlLnByb2plY3RJZDtcbiAgdGFzay5oYWJpdElkID0gc2hhcGUuaGFiaXRJZDtcbiAgdGFzay5mb2N1c01pbnV0ZXMgPSBzaGFwZS5mb2N1c01pbnV0ZXM7XG4gIHRhc2suc2NyYXBNaW51dGVzID0gaXNIYWJpdCh0YXNrKSA/IDAgOiBzaGFwZS5zY3JhcE1pbnV0ZXM7XG4gIHRhc2sucHJpb3JpdHkgPSBzaGFwZS5wcmlvcml0eTtcbiAgdGFzay5lc3RpbWF0ZSA9IHNoYXBlLmVzdGltYXRlO1xuICB0YXNrLnRhZ3MgPSBbLi4uc2hhcGUudGFnc107XG4gIC8vIFx1NjYzRVx1NUYwRlx1NTQwQ1x1NkI2NVx1NjVGNlx1NEZERFx1NzU1OVx1NTMzOVx1OTE0RFx1NkI2NVx1OUFBNFx1NzY4NFx1NUI4Q1x1NjIxMFx1NzJCNlx1NjAwMVx1MzAwMlxuICB0YXNrLnN1YnRhc2tzID0gc2hhcGUuc3VidGFza3MubWFwKChzdWIpID0+ICh7XG4gICAgaWQ6IHN1Yi5pZCxcbiAgICB0aXRsZTogc3ViLnRpdGxlLFxuICAgIGRvbmU6IHRhc2suc3VidGFza3Muc29tZSgob2xkKSA9PiBvbGQuaWQgPT09IHN1Yi5pZCAmJiBvbGQuZG9uZSksXG4gIH0pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlVGVtcGxhdGVzKGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgaWYgKGRhdGEudGVtcGxhdGVzLmxlbmd0aCA+IDUwMDAgfHwgZGF0YS5wcmludHMubGVuZ3RoID4gMjAwMDAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QTIxXHU2NzdGXHU2MjE2XHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XHU4RDg1XHU1MUZBXHU5NjUwXHU1MjM2XCIpO1xuICB9XG4gIGNvbnN0IGlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IHQgb2YgZGF0YS50ZW1wbGF0ZXMpIHtcbiAgICBpZiAodC5pZC5sZW5ndGggPT09IDAgfHwgaWRzLmhhcyh0LmlkKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QTIxXHU2NzdGIElEIFx1OTFDRFx1NTkwRFx1NjIxNlx1NEUzQVx1N0E3QVwiKTtcbiAgICB9XG4gICAgaWRzLmFkZCh0LmlkKTtcbiAgICBjb25zdCBzID0gdC5zaGFwZTtcbiAgICBpZiAodC5wcmludEFoZWFkRGF5cyA+IDkwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk4ODRcdTUzNzBcdTU5MjlcdTY1NzBcdTk3MDBcdTRFM0EgMFx1MjAxMzkwIFx1NTkyOVwiKTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgcy50aXRsZS50cmltKCkubGVuZ3RoID09PSAwIHx8XG4gICAgICBBcnJheS5mcm9tKHMudGl0bGUpLmxlbmd0aCA+IDIwMCB8fFxuICAgICAgcy5ub3Rlcy5sZW5ndGggPiA1MDAwMCB8fFxuICAgICAgcy5wcmlvcml0eSA+IDMgfHxcbiAgICAgIHMuZXN0aW1hdGUgPCAxIHx8XG4gICAgICBzLmVzdGltYXRlID4gOTkgfHxcbiAgICAgIHMuc2NyYXBNaW51dGVzID4gMTAwODAgfHxcbiAgICAgIChzLmZvY3VzTWludXRlcyAhPT0gbnVsbCAmJlxuICAgICAgICAocy5mb2N1c01pbnV0ZXMgPCAxIHx8IHMuZm9jdXNNaW51dGVzID4gMTgwKSkgfHxcbiAgICAgIHMudGFncy5sZW5ndGggPiAyMCB8fFxuICAgICAgcy50YWdzLnNvbWUoKHRhZykgPT4gQXJyYXkuZnJvbSh0YWcpLmxlbmd0aCA+IDQwKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU2QTIxXHU2NzdGXHU1RjYyXHU3MkI2XCIpO1xuICAgIH1cbiAgICBjb25zdCBzdWJzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgaWYgKFxuICAgICAgcy5zdWJ0YXNrcy5sZW5ndGggPiAyMDAgfHxcbiAgICAgIHMuc3VidGFza3Muc29tZShcbiAgICAgICAgKHN1YikgPT5cbiAgICAgICAgICBzdWIuaWQubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICAgc3Vicy5oYXMoc3ViLmlkKSB8fFxuICAgICAgICAgIHN1Yi50aXRsZS50cmltKCkubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICAgQXJyYXkuZnJvbShzdWIudGl0bGUpLmxlbmd0aCA+IDIwMCxcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NkEyMVx1Njc3Rlx1NUI1MFx1NEVGQlx1NTJBMVwiKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBzdWIgb2Ygcy5zdWJ0YXNrcykgc3Vicy5hZGQoc3ViLmlkKTtcbiAgICBpZiAoXG4gICAgICAocy5wcm9qZWN0SWQgIT09IG51bGwgJiZcbiAgICAgICAgIWRhdGEucHJvamVjdHMuc29tZSgocCkgPT4gcC5pZCA9PT0gcy5wcm9qZWN0SWQpKSB8fFxuICAgICAgKHMuaGFiaXRJZCAhPT0gbnVsbCAmJiAhZGF0YS5oYWJpdHMuc29tZSgoaCkgPT4gaC5pZCA9PT0gcy5oYWJpdElkKSlcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NkEyMVx1Njc3Rlx1NUYxNVx1NzUyOFx1NEU4Nlx1NEUwRFx1NUI1OFx1NTcyOFx1NzY4NFx1NUJCOVx1NTY2OFwiKTtcbiAgICB9XG4gICAgY29uc3QgcHJpbnRpbmcgPSB0LnByaW50aW5nO1xuICAgIGlmIChwcmludGluZy5raW5kID09PSBcIm9uY2VcIikge1xuICAgICAgaWYgKFxuICAgICAgICBwcmludGluZy5kYXRlID09PSBudWxsIHx8XG4gICAgICAgICF2YWxpZERhdGUocHJpbnRpbmcuZGF0ZSkgfHxcbiAgICAgICAgKHByaW50aW5nLnRpbWUgIT09IG51bGwgJiYgIXZhbGlkVGltZShwcmludGluZy50aW1lKSlcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTRFMDBcdTZCMjFcdTUzNzBcdTUyMzdcdTY1RTVcdTY3MUZcdTYyMTZcdTY1RjZcdTk1RjRcIik7XG4gICAgICB9XG4gICAgICBpZiAocy5oYWJpdElkICE9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEU2MFx1NjBFRlx1NkEyMVx1Njc3Rlx1NUZDNVx1OTg3Qlx1OTFDRFx1NTkwRFx1NTM3MFx1NTIzN1wiKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHByaW50aW5nLmtpbmQgPT09IFwiY2FsZW5kYXJcIikge1xuICAgICAgaWYgKFxuICAgICAgICBwcmludGluZy5zbG90cy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgcHJpbnRpbmcuc2xvdHMubGVuZ3RoID4gNDkgfHxcbiAgICAgICAgcy5oYWJpdElkICE9PSBudWxsXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NzVFXHU5MUNEXHU1OTBEXHU2NUU1XHU3QTBCXHU5NzAwXHU4OTgxIDFcdTIwMTM0OSBcdTRFMkFcdTY1RjZcdTZCQjVcdUZGMENcdTRFMERcdTgwRkRcdTVDNUVcdTRFOEVcdTRFNjBcdTYwRUZcdTdFQzRcIik7XG4gICAgICB9XG4gICAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBjb25zdCB0aW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgZm9yIChjb25zdCBzbG90IG9mIHByaW50aW5nLnNsb3RzKSB7XG4gICAgICAgIGNvbnN0IHRpbWVLZXkgPSBzbG90LnRpbWUgPz8gXCJudWxsXCI7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBzbG90LmRhdGVzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAgIHNsb3QuZGF0ZXMubGVuZ3RoID4gMzY2IHx8XG4gICAgICAgICAgKHNsb3QudGltZSAhPT0gbnVsbCAmJiAhdmFsaWRUaW1lKHNsb3QudGltZSkpIHx8XG4gICAgICAgICAgKHRpbWVzLmhhcyh0aW1lS2V5KSA/IHRydWUgOiAodGltZXMuYWRkKHRpbWVLZXkpLCBmYWxzZSkpIHx8XG4gICAgICAgICAgc2xvdC5kYXRlcy5zb21lKChkYXRlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBrZXkgPSBgJHtkYXRlfXwke3RpbWVLZXl9YDtcbiAgICAgICAgICAgIC8vIFx1NEUwRSBSdXN0IFx1NEUwMFx1ODFGNFx1RkYxQVx1NjhDMFx1NjdFNVx1NTM3M1x1NjNEMlx1NTE2NVx1MjAxNFx1MjAxNFx1NTQwQ1x1NEUwMFx1NjVGNlx1NkJCNVx1NTE4NVx1NzY4NFx1OTFDRFx1NTkwRFx1NjVFNVx1NjcxRlx1NEU1Rlx1NEYxQVx1ODhBQlx1NjJEMlx1MzAwMlxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgIXZhbGlkRGF0ZShkYXRlKSB8fFxuICAgICAgICAgICAgICAoc2Vlbi5oYXMoa2V5KSA/IHRydWUgOiAoc2Vlbi5hZGQoa2V5KSwgZmFsc2UpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KVxuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgICBcIlx1NjVFMFx1NjU0OFx1NjIxNlx1OTFDRFx1NTkwRFx1NzY4NFx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVx1RkYwQ1x1OEJGN1x1NjI4QVx1NTQwQ1x1NEUwMFx1NUYwMFx1NTlDQlx1NjVGNlx1OTVGNFx1NzY4NFx1NjVFNVx1NjcxRlx1NTQwOFx1NUU3NlwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZWVuLnNpemUgPiAzNjYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTAwXHU2QjIxXHU2NUU1XHU3QTBCXHU4ODY4XHU2NzAwXHU1OTFBIDM2NiBcdTk4NzlcIik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwcmludGluZy5zbG90cy5sZW5ndGggPT09IDAgfHwgcHJpbnRpbmcuc2xvdHMubGVuZ3RoID4gNDkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QkNGXHU1NDY4XHU1RkFBXHU3M0FGXHU5NzAwXHU4OTgxIDFcdTIwMTM0OSBcdTRFMkFcdTY1RjZcdTZCQjVcIik7XG4gICAgICB9XG4gICAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBmb3IgKGNvbnN0IHNsb3Qgb2YgcHJpbnRpbmcuc2xvdHMpIHtcbiAgICAgICAgY29uc3QgdW5pcXVlID0gbmV3IFNldChzbG90LmRheXMpO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2xvdC5kYXlzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAgIHNsb3QuZGF5cy5sZW5ndGggPiA3IHx8XG4gICAgICAgICAgdW5pcXVlLnNpemUgIT09IHNsb3QuZGF5cy5sZW5ndGggfHxcbiAgICAgICAgICBzbG90LmRheXMuc29tZSgoZCkgPT4gZCA8IDEgfHwgZCA+IDcpIHx8XG4gICAgICAgICAgKHNsb3QudGltZSAhPT0gbnVsbCAmJiAhdmFsaWRUaW1lKHNsb3QudGltZSkpIHx8XG4gICAgICAgICAgKHMuaGFiaXRJZCAhPT0gbnVsbCAmJiBzbG90LnRpbWUgPT09IG51bGwpIHx8XG4gICAgICAgICAgc2xvdC5kYXlzLnNvbWUoKGRheSkgPT4gc2Vlbi5oYXMoYCR7ZGF5fXwke3Nsb3QudGltZSA/PyBcIm51bGxcIn1gKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU2MjE2XHU5MUNEXHU1OTBEXHU3Njg0XHU1NDY4XHU2NzFGXHU2NUY2XHU2QkI1XCIpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZGF5IG9mIHNsb3QuZGF5cykgc2Vlbi5hZGQoYCR7ZGF5fXwke3Nsb3QudGltZSA/PyBcIm51bGxcIn1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgcHJpbnRpbmcuc2xvdHMuc29tZSgocykgPT4gcy50aW1lICE9PSBudWxsKSAmJlxuICAgICAgICBwcmludGluZy5zbG90cy5zb21lKChzKSA9PiBzLnRpbWUgPT09IG51bGwpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTAwXHU0RTJBXHU1NDY4XHU2NzFGXHU0RTBEXHU4MEZEXHU2REY3XHU3NTI4XHU1QjlBXHU2NUY2XHU0RTBFXHU0RTBEXHU1QjlBXHU2NUY2XHU1MzU1XHU1MTQzXCIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCBwcmludHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBwIG9mIGRhdGEucHJpbnRzKSB7XG4gICAgaWYgKFxuICAgICAgIWlkcy5oYXMocC50ZW1wbGF0ZUlkKSB8fFxuICAgICAgcC5kYXRlID09PSBudWxsIHx8XG4gICAgICAhdmFsaWREYXRlKHAuZGF0ZSkgfHxcbiAgICAgIHByaW50cy5oYXMoYCR7cC50ZW1wbGF0ZUlkfXwke3AuZGF0ZX1gKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU2MjE2XHU5MUNEXHU1OTBEXHU3Njg0XHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XCIpO1xuICAgIH1cbiAgICBwcmludHMuYWRkKGAke3AudGVtcGxhdGVJZH18JHtwLmRhdGV9YCk7XG4gIH1cbiAgaWYgKGRhdGEudGFza3Muc29tZSgodCkgPT4gdC50ZW1wbGF0ZUlkICE9PSBudWxsICYmICFpZHMuaGFzKHQudGVtcGxhdGVJZCkpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QjlFXHU0RjhCXHU1RjE1XHU3NTI4XHU0RTg2XHU0RTBEXHU1QjU4XHU1NzI4XHU3Njg0XHU2QTIxXHU2NzdGXCIpO1xuICB9XG59XG5cbi8qKiBcdTRFMzRcdTY1RjZcdUZGMDhcdTRFMERcdTc1NTlcdTZBMjFcdTY3N0ZcdUZGMDlcdTYyNzlcdTkxQ0ZcdTUzNzBcdTUyMzdcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmludEluc3RhbmNlcyhcbiAgZGF0YTogQXBwRGF0YSxcbiAgc2hhcGU6IFNoYXBlLFxuICBwcmludGluZzogUHJpbnRpbmcsXG4gIGF0OiBudW1iZXIsXG4pOiB2b2lkIHtcbiAgaWYgKHByaW50aW5nLmtpbmQgPT09IFwid2Vla2x5XCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTVGQUFcdTczQUZcdTg5QzRcdTUyMTlcdTk3MDBcdTg5ODFcdTRGRERcdTc1NTlcdTRFM0FcdTZBMjFcdTY3N0ZcIik7XG4gIH1cbiAgY29uc3QgZGF0ZXM6IChzdHJpbmcgfCBudWxsKVtdID1cbiAgICBwcmludGluZy5raW5kID09PSBcIm9uY2VcIlxuICAgICAgPyBbcHJpbnRpbmcuZGF0ZV1cbiAgICAgIDogWy4uLm5ldyBTZXQocHJpbnRpbmcuc2xvdHMuZmxhdE1hcCgocykgPT4gcy5kYXRlcykpXS5zb3J0KCk7XG4gIGNvbnN0IHRlbXBsYXRlSWQgPSBpZCgpO1xuICBkYXRhLnRlbXBsYXRlcy5wdXNoKHtcbiAgICBpZDogdGVtcGxhdGVJZCxcbiAgICBzaGFwZSxcbiAgICBwcmludGluZyxcbiAgICBhdXRvbWF0aWM6IGZhbHNlLFxuICAgIHByaW50QWhlYWREYXlzOiAwLFxuICB9KTtcbiAgZGF0YS52YWxpZGF0ZSgpO1xuICBwcmludFRlbXBsYXRlKGRhdGEsIHRlbXBsYXRlSWQsIGRhdGVzLCBhdCk7XG4gIGRlbGV0ZVRlbXBsYXRlKGRhdGEsIHRlbXBsYXRlSWQpO1xufVxuXG4vKiogXHU0RkREXHU1QjU4XHU2QTIxXHU2NzdGXHVGRjFBXHU1NDY4XHU2NzFGXHU1MTY4XHU1QjlBXHU2NUY2XHU3Njg0XHU2NjZFXHU5MDFBXHU2QTIxXHU2NzdGXHU4MUVBXHU1MkE4XHU1RUZBXHU3QUNCXHU0RTYwXHU2MEVGXHU3RUM0XHVGRjA4XHU1NDBDXHU1NDBEXHU1OTBEXHU3NTI4XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gc2F2ZVRlbXBsYXRlKGRhdGE6IEFwcERhdGEsIHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQge1xuICB0ZW1wbGF0ZS5zaGFwZS50aXRsZSA9IHRlbXBsYXRlLnNoYXBlLnRpdGxlLnRyaW0oKTtcbiAgaWYgKFxuICAgIHRlbXBsYXRlLnNoYXBlLmhhYml0SWQgPT09IG51bGwgJiZcbiAgICB0ZW1wbGF0ZS5wcmludGluZy5raW5kID09PSBcIndlZWtseVwiICYmXG4gICAgdGVtcGxhdGUucHJpbnRpbmcuc2xvdHMuZXZlcnkoKHMpID0+IHMudGltZSAhPT0gbnVsbClcbiAgKSB7XG4gICAgY29uc3QgZXhpc3RpbmdIYWJpdCA9XG4gICAgICBkYXRhLnRlbXBsYXRlcy5maW5kKCh0KSA9PiB0LmlkID09PSB0ZW1wbGF0ZS5pZCk/LnNoYXBlLmhhYml0SWQgPz8gbnVsbDtcbiAgICBjb25zdCBoaWQgPSBleGlzdGluZ0hhYml0ID8/IGlkKCk7XG4gICAgaWYgKCFkYXRhLmhhYml0cy5zb21lKChoKSA9PiBoLmlkID09PSBoaWQpKSB7XG4gICAgICBkYXRhLmhhYml0cy5wdXNoKHtcbiAgICAgICAgaWQ6IGhpZCxcbiAgICAgICAgbmFtZTogQXJyYXkuZnJvbSh0ZW1wbGF0ZS5zaGFwZS50aXRsZSkuc2xpY2UoMCwgNDApLmpvaW4oXCJcIiksXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGVtcGxhdGUuc2hhcGUuaGFiaXRJZCA9IGhpZDtcbiAgfVxuICBjb25zdCBpbmRleCA9IGRhdGEudGVtcGxhdGVzLmZpbmRJbmRleCgodCkgPT4gdC5pZCA9PT0gdGVtcGxhdGUuaWQpO1xuICBpZiAoaW5kZXggPj0gMCkge1xuICAgIGRhdGEudGVtcGxhdGVzW2luZGV4XSA9IHRlbXBsYXRlO1xuICB9IGVsc2Uge1xuICAgIGRhdGEudGVtcGxhdGVzLnB1c2godGVtcGxhdGUpO1xuICB9XG59XG5cbi8qKiBcdTUyMjBcdTk2NjRcdTZBMjFcdTY3N0ZcdTRGRERcdTc1NTlcdTVCOUVcdTRGOEJcdTVFNzZcdTZFMDUgdGVtcGxhdGVJZFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZVRlbXBsYXRlKGRhdGE6IEFwcERhdGEsIGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgZGF0YS50ZW1wbGF0ZXMgPSBkYXRhLnRlbXBsYXRlcy5maWx0ZXIoKHQpID0+IHQuaWQgIT09IGlkKTtcbiAgZGF0YS5wcmludHMgPSBkYXRhLnByaW50cy5maWx0ZXIoKHApID0+IHAudGVtcGxhdGVJZCAhPT0gaWQpO1xuICBmb3IgKGNvbnN0IHRhc2sgb2YgZGF0YS50YXNrcykge1xuICAgIGlmICh0YXNrLnRlbXBsYXRlSWQgPT09IGlkKSB0YXNrLnRlbXBsYXRlSWQgPSBudWxsO1xuICB9XG59XG5cbi8qKiBcdTYyNEJcdTUyQThcdTUzNzBcdTUyMzdcdUZGMUFcdTU0NjhcdTY3MUZcdTg5QzRcdTUyMTlcdTYzMDlcdTk1MUFcdTVCOUFcdTY1RTVcdTY3MUZcdTVDNTVcdTVGMDBcdTY1NzRcdTU0NjhcdUZGMUJcdTU0MENcdTZBMjFcdTY3N0ZcdTU0MENcdTY1RTVcdTY3MUZcdTk2MzJcdTkxQ0RcdUZGMUJcdTRFMDBcdTU5MjlcdTUxODVcdTRGNUNcdTVFOUZcdTY1RjZcdTZCQjVcdThERjNcdThGQzdcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmludFRlbXBsYXRlKFxuICBkYXRhOiBBcHBEYXRhLFxuICBpZDogc3RyaW5nLFxuICBkYXRlczogKHN0cmluZyB8IG51bGwpW10sXG4gIGF0OiBudW1iZXIsXG4pOiB2b2lkIHtcbiAgaWYgKGRhdGVzLmxlbmd0aCA9PT0gMCB8fCBkYXRlcy5sZW5ndGggPiAzNjYpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTZCQ0ZcdTZCMjFcdTUzNzBcdTUyMzdcdTk3MDBcdTg5ODEgMVx1MjAxMzM2NiBcdTRFMkFcdTY1RTVcdTY3MUZcIik7XG4gIH1cbiAgY29uc3QgdGVtcGxhdGVJbmRleCA9IGRhdGEudGVtcGxhdGVzLmZpbmRJbmRleCgodCkgPT4gdC5pZCA9PT0gaWQpO1xuICBpZiAodGVtcGxhdGVJbmRleCA8IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTZBMjFcdTY3N0ZcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gIH1cbiAgY29uc3QgdGVtcGxhdGUgPSBkYXRhLnRlbXBsYXRlc1t0ZW1wbGF0ZUluZGV4XSE7XG4gIGxldCByZXNvbHZlZDogKHN0cmluZyB8IG51bGwpW107XG4gIGlmICh0ZW1wbGF0ZS5wcmludGluZy5raW5kID09PSBcIndlZWtseVwiKSB7XG4gICAgY29uc3QgZGF5cyA9IFtcbiAgICAgIC4uLm5ldyBTZXQodGVtcGxhdGUucHJpbnRpbmcuc2xvdHMuZmxhdE1hcCgocykgPT4gcy5kYXlzKSksXG4gICAgXS5zb3J0KChhLCBiKSA9PiBhIC0gYik7XG4gICAgY29uc3QgZXhwYW5kZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IGRhdGUgb2YgZGF0ZXMpIHtcbiAgICAgIGlmIChkYXRlID09PSBudWxsKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTU0NjhcdTY3MUZcdTUzNzBcdTUyMzdcdTk3MDBcdTg5ODFcdTY1RTVcdTY3MUZcIik7XG4gICAgICBpZiAoIXZhbGlkRGF0ZShkYXRlKSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU1NDY4XHU2NzFGXHU2NUU1XHU2NzFGXCIpO1xuICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VEYXRlKGRhdGUpITtcbiAgICAgIGNvbnN0IG1vbmRheSA9IHdlZWtTdGFydChwYXJzZWQpO1xuICAgICAgZm9yIChjb25zdCBkYXkgb2YgZGF5cykge1xuICAgICAgICBjb25zdCBkID0gYWRkRGF5cyhtb25kYXksIGRheSAtIDEpO1xuICAgICAgICBleHBhbmRlZC5hZGQoXG4gICAgICAgICAgYCR7ZC55ZWFyfS0ke1N0cmluZyhkLm1vbnRoKS5wYWRTdGFydCgyLCBcIjBcIil9LSR7U3RyaW5nKGQuZGF5KS5wYWRTdGFydCgyLCBcIjBcIil9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGV4cGFuZGVkLnNpemUgPiAzNjYpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEUwMFx1NkIyMVx1NTM3MFx1NTIzN1x1ODMwM1x1NTZGNFx1OEZDN1x1NTkyN1x1RkYwQ1x1OEJGN1x1NjJDNlx1NTIwNlx1NTQ2OFx1NjcxRlwiKTtcbiAgICB9XG4gICAgcmVzb2x2ZWQgPSBbLi4uZXhwYW5kZWRdLnNvcnQoKTtcbiAgfSBlbHNlIHtcbiAgICByZXNvbHZlZCA9IFsuLi5kYXRlc107XG4gIH1cbiAgLy8gXHU1MTQ4XHU1QjhDXHU2NTc0XHU4OUUzXHU2NzkwXHU1NDY4XHU2NzFGL1x1NjVFNVx1N0EwQlx1NjI3OVx1NkIyMVx1RkYwQ1x1NTE4RFx1NTJBOFx1NzJCNlx1NjAwMVx1RkYwOFx1NTM5Rlx1NUI1MFx1RkYwOVx1MzAwMlxuICBjb25zdCBiYXRjaGVzOiB7IGRhdGU6IHN0cmluZyB8IG51bGw7IHRpbWVzOiAoc3RyaW5nIHwgbnVsbClbXSB9W10gPVxuICAgIHJlc29sdmVkLm1hcCgoZGF0ZSkgPT4gKHtcbiAgICAgIGRhdGUsXG4gICAgICB0aW1lczogdGVtcGxhdGVUaW1lcyh0ZW1wbGF0ZSwgZGF0ZSksXG4gICAgfSkpO1xuICBjb25zdCBwcmludGVkRGF0ZXMgPSBuZXcgU2V0KFxuICAgIGRhdGEucHJpbnRzLmZpbHRlcigocCkgPT4gcC50ZW1wbGF0ZUlkID09PSBpZCkubWFwKChwKSA9PiBwLmRhdGUgYXMgc3RyaW5nKSxcbiAgKTtcbiAgZm9yIChjb25zdCB7IGRhdGUsIHRpbWVzIH0gb2YgYmF0Y2hlcykge1xuICAgIGlmIChwcmludGVkRGF0ZXMuaGFzKGRhdGUgYXMgc3RyaW5nKSkgY29udGludWU7XG4gICAgbGV0IHByaW50ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IHRpbWUgb2YgdGltZXMpIHtcbiAgICAgIGNvbnN0IHRhc2sgPSB0ZW1wbGF0ZUluc3RhbmNlKHRlbXBsYXRlLCBkYXRlLCB0aW1lLCBhdCk7XG4gICAgICBpZiAocHJpbnRpbmdFeHBpcmVkKGRhdGEsIHRhc2ssIGF0KSkgY29udGludWU7XG4gICAgICBkYXRhLnRhc2tzLnB1c2godGFzayk7XG4gICAgICBwcmludGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gXHU0RTAwXHU1OTI5XHU3Njg0XHU2Mjc5XHU2QjIxXHU0RTAwXHU2NUU2XHU0RUE3XHU3NTFGXHU1QjlFXHU0RjhCXHU1MzczXHU4QkIwXHU4RDI2XHVGRjFBXHU3RjE2XHU4RjkxL1x1NTIyMFx1OTY2NFx1NEUwRFx1NUY5N1x1OTc1OVx1OUVEOFx1ODg2NVx1NkVFMVx1NUY1M1x1NTkyOVx1NTM4Nlx1NTNGMlx1MzAwMlxuICAgIGlmIChwcmludGVkKSB7XG4gICAgICBwcmludGVkRGF0ZXMuYWRkKGRhdGUgYXMgc3RyaW5nKTtcbiAgICAgIGRhdGEucHJpbnRzLnB1c2goeyB0ZW1wbGF0ZUlkOiBpZCwgZGF0ZSB9KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIFx1NURGMlx1OEZDN1x1OTc1OVx1NjAwMVx1NjVGNlx1OTVGNFx1N0E5N1x1NTNFM1x1NzY4NFx1NUI5QVx1NjVGNlx1NUI5RVx1NEY4Qlx1OERGM1x1OEZDN1x1NTM3MFx1NTIzN1x1MzAwMiAqL1xuZnVuY3Rpb24gcHJpbnRpbmdFeHBpcmVkKGRhdGE6IEFwcERhdGEsIHRhc2s6IFRhc2ssIGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgaWYgKHRhc2sucmVtaW5kZXJUaW1lID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0YXNrLmR1ZURhdGUgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgdG9kYXkgPSBkYXRlQXQoYXQpO1xuICBpZiAodGFzay5kdWVEYXRlIDwgdG9kYXkpIHJldHVybiB0cnVlO1xuICBpZiAodGFzay5kdWVEYXRlID4gdG9kYXkpIHJldHVybiBmYWxzZTtcbiAgY29uc3Qgc3RhcnQgPSBtaW51dGVzT2YodGFzay5yZW1pbmRlclRpbWUpITtcbiAgY29uc3QgZ3JhY2UgPSBpc0hhYml0KHRhc2spID8gMCA6IHRhc2suc2NyYXBNaW51dGVzO1xuICBjb25zdCBlbmQgPSBzdGFydCArIHdpbmRvd01pbnV0ZXModGFzaywgZGF0YS5zZXR0aW5ncykgKyBncmFjZTtcbiAgcmV0dXJuIHNlY29uZHNPZkRheShhdCkgPj0gZW5kICogNjA7XG59XG5cbi8qKiBcdTY2M0VcdTVGMEZcdTVGNjJcdTcyQjZcdTU0MENcdTZCNjVcdUZGMUFcdTUzRUFcdTU0MENcdTZCNjVcdTY3MkFcdTVCOENcdTYyMTBcdTMwMDFcdTY3MkFcdTRGNUNcdTVFOUZcdTVCOUVcdTRGOEJcdTc2ODRcdTVGNjJcdTcyQjZcdUZGMUJcdTY1RTVcdTY3MUYvXHU3QkExXHU4Rjk2L1x1NUI4Q1x1NjIxMFx1NzJCNlx1NjAwMVx1NEUwRFx1NTJBOFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN5bmNUZW1wbGF0ZShkYXRhOiBBcHBEYXRhLCBpZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHRlbXBsYXRlID0gZGF0YS50ZW1wbGF0ZXMuZmluZCgodCkgPT4gdC5pZCA9PT0gaWQpO1xuICBpZiAodGVtcGxhdGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NkEyMVx1Njc3Rlx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgfVxuICBjb25zdCB2b2lkSWRzID0gbmV3IFNldChcbiAgICBkYXRhLnRhc2tzLmZpbHRlcigodCkgPT4gdGFza0lzVm9pZCh0KSkubWFwKCh0KSA9PiB0LmlkKSxcbiAgKTtcbiAgZm9yIChjb25zdCB0YXNrIG9mIGRhdGEudGFza3MpIHtcbiAgICBpZiAoIXZvaWRJZHMuaGFzKHRhc2suaWQpICYmICF0YXNrLmNvbXBsZXRlZCAmJiB0YXNrLnRlbXBsYXRlSWQgPT09IGlkKSB7XG4gICAgICBjb25zdCBzaGFwZSA9IHsgLi4udGVtcGxhdGUuc2hhcGUgfTtcbiAgICAgIHNoYXBlLmhhYml0SWQgPSB0YXNrLmhhYml0SWQ7XG4gICAgICBjb3B5U2hhcGUoc2hhcGUsIHRhc2spO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFza0lzVm9pZCh0YXNrOiBUYXNrKTogYm9vbGVhbiB7XG4gIHJldHVybiAhdGFzay5jb21wbGV0ZWQgJiYgdGFzay5yZW1pbmRlclRpbWUgIT09IG51bGwgJiYgdGFzay5yZW1pbmRlckV4cGlyZWQ7XG59XG5cbi8qKiBcdTgxRUFcdTUyQThcdTZFREFcdTUyQThcdTk4ODRcdTUzNzBcdUZGMUFcdTg4NjVcdTlGNTBcdTMwMENcdTRFQ0FcdTU5MjkgKyBcdTk4ODRcdTUzNzBcdTU5MjlcdTY1NzBcdTMwMERcdTgzMDNcdTU2RjRcdTUxODVcdTc2ODRcdTkwNTdcdTZGMEZcdUZGMENcdTdBMEJcdTVFOEZcdTUxNzNcdTk1RURcdTY3MUZcdTk1RjRcdTRFMERcdTYyNjdcdTg4NENcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXRlcmlhbGl6ZVRlbXBsYXRlcyhkYXRhOiBBcHBEYXRhLCBhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRvZGF5ID0gcGFyc2VEYXRlKGRhdGVBdChhdCkpITtcbiAgY29uc3QgcHJpbnRlZCA9IG5ldyBTZXQoXG4gICAgZGF0YS5wcmludHMubWFwKChwKSA9PiBgJHtwLnRlbXBsYXRlSWR9fCR7cC5kYXRlID8/IFwibnVsbFwifWApLFxuICApO1xuICBjb25zdCByZXF1ZXN0czogeyBpZDogc3RyaW5nOyBkYXRlczogKHN0cmluZyB8IG51bGwpW10gfVtdID0gW107XG4gIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgZGF0YS50ZW1wbGF0ZXMpIHtcbiAgICBpZiAoIXRlbXBsYXRlLmF1dG9tYXRpYykgY29udGludWU7XG4gICAgY29uc3QgZW5kID0gYWRkRGF5cyh0b2RheSwgdGVtcGxhdGUucHJpbnRBaGVhZERheXMpO1xuICAgIGNvbnN0IGVuZFN0ciA9IGAke2VuZC55ZWFyfS0ke1N0cmluZyhlbmQubW9udGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZW5kLmRheSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG4gICAgbGV0IGRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHByaW50aW5nID0gdGVtcGxhdGUucHJpbnRpbmc7XG4gICAgaWYgKHByaW50aW5nLmtpbmQgPT09IFwib25jZVwiKSB7XG4gICAgICBpZiAocHJpbnRpbmcuZGF0ZSAhPT0gbnVsbCAmJiBwcmludGluZy5kYXRlIDw9IGVuZFN0cilcbiAgICAgICAgZGF0ZXMgPSBbcHJpbnRpbmcuZGF0ZV07XG4gICAgfSBlbHNlIGlmIChwcmludGluZy5raW5kID09PSBcImNhbGVuZGFyXCIpIHtcbiAgICAgIGRhdGVzID0gW1xuICAgICAgICAuLi5uZXcgU2V0KFxuICAgICAgICAgIHByaW50aW5nLnNsb3RzLmZsYXRNYXAoKHMpID0+IHMuZGF0ZXMpLmZpbHRlcigoZCkgPT4gZCA8PSBlbmRTdHIpLFxuICAgICAgICApLFxuICAgICAgXS5zb3J0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGRheXMgPSBbLi4ubmV3IFNldChwcmludGluZy5zbG90cy5mbGF0TWFwKChzKSA9PiBzLmRheXMpKV0uc29ydChcbiAgICAgICAgKGEsIGIpID0+IGEgLSBiLFxuICAgICAgKTtcbiAgICAgIGxldCBtb25kYXkgPSB3ZWVrU3RhcnQodG9kYXkpO1xuICAgICAgY29uc3QgbGFzdCA9IHdlZWtTdGFydChlbmQpO1xuICAgICAgd2hpbGUgKGNvbXBhcmVJc28obW9uZGF5KSA8PSBjb21wYXJlSXNvKGxhc3QpKSB7XG4gICAgICAgIGZvciAoY29uc3QgZGF5IG9mIGRheXMpIHtcbiAgICAgICAgICBjb25zdCBkID0gYWRkRGF5cyhtb25kYXksIGRheSAtIDEpO1xuICAgICAgICAgIGRhdGVzLnB1c2goXG4gICAgICAgICAgICBgJHtkLnllYXJ9LSR7U3RyaW5nKGQubW9udGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZC5kYXkpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgbW9uZGF5ID0gYWRkRGF5cyhtb25kYXksIDcpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBtaXNzaW5nID0gZGF0ZXMuZmlsdGVyKChkKSA9PiAhcHJpbnRlZC5oYXMoYCR7dGVtcGxhdGUuaWR9fCR7ZH1gKSk7XG4gICAgaWYgKG1pc3NpbmcubGVuZ3RoID4gMCkge1xuICAgICAgcmVxdWVzdHMucHVzaCh7IGlkOiB0ZW1wbGF0ZS5pZCwgZGF0ZXM6IG1pc3NpbmcgfSk7XG4gICAgfVxuICB9XG4gIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gIGZvciAoY29uc3QgeyBpZDogdGVtcGxhdGVJZCwgZGF0ZXMgfSBvZiByZXF1ZXN0cykge1xuICAgIC8vIFx1NTM3MFx1NTIzN1x1NTM5Rlx1NUI1MFx1RkYxQVx1OEZCRVx1NTIzMFx1NUJCOVx1OTFDRlx1NEUwQVx1OTY1MFx1NjVGNlx1NjU3NFx1NTQ2OFx1NjcxRlx1NTE2OFx1NzU1OVx1NjIxNlx1NTE2OFx1NUYwM1x1MzAwMlxuICAgIGNvbnN0IGNhbmRpZGF0ZSA9IGNsb25lKGRhdGEpO1xuICAgIHRyeSB7XG4gICAgICBwcmludFRlbXBsYXRlKGNhbmRpZGF0ZSwgdGVtcGxhdGVJZCwgZGF0ZXMsIGF0KTtcbiAgICAgIGlmIChjYW5kaWRhdGUudGFza3MubGVuZ3RoICE9PSBkYXRhLnRhc2tzLmxlbmd0aCkge1xuICAgICAgICBjYW5kaWRhdGUudmFsaWRhdGUoKTtcbiAgICAgICAgcmVwbGFjZUFwcERhdGEoZGF0YSwgY2FuZGlkYXRlKTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBcdTRGRERcdTc1NTlcdTUzOUZcdTcyQjZcdTYwMDFcdTMwMDJcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZWQ7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVJc28oZGF0ZToge1xuICB5ZWFyOiBudW1iZXI7XG4gIG1vbnRoOiBudW1iZXI7XG4gIGRheTogbnVtYmVyO1xufSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtkYXRlLnllYXJ9LSR7U3RyaW5nKGRhdGUubW9udGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZGF0ZS5kYXkpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwbGFjZUFwcERhdGEodGFyZ2V0OiBBcHBEYXRhLCBzb3VyY2U6IEFwcERhdGEpOiB2b2lkIHtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoc291cmNlKSkge1xuICAgICh0YXJnZXQgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XSA9IChcbiAgICAgIHNvdXJjZSBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICAgKVtrZXldO1xuICB9XG59XG5cbi8qKiBcdThCQTFcdTUyMTIvXHU4RjkzXHU1MTY1XHU4RkI5XHU3NTRDXHVGRjFBXHU2MjhBXHU2NUU3XHU1RjBGXHU5MUNEXHU1OTBEXHU4OUM0XHU1MjE5XHU4RjZDXHU2MjEwXHU1MzcwXHU1MjM3XHU2QTIxXHU1NzhCXHVGRjBDXHU0RTBEXHU3RUQ5XHU1QjlFXHU0RjhCXHU2MzAyXHU4OUM0XHU1MjE5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbVRhc2soXG4gIHRhc2s6IFRhc2ssXG4gIHJlcGVhdDogXCJub25lXCIgfCBcImRhaWx5XCIgfCBcIndlZWtkYXlzXCIgfCBcIndlZWtseVwiLFxuICBhdDogbnVtYmVyLFxuKTogVGVtcGxhdGUge1xuICBjb25zdCBkYXRlID0gdGFzay5kdWVEYXRlID8/IGRhdGVBdChhdCk7XG4gIGNvbnN0IHdlZWtkYXkgPSAoKCkgPT4ge1xuICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlRGF0ZShkYXRlKTtcbiAgICByZXR1cm4gcGFyc2VkID09PSBudWxsID8gMSA6IHdlZWtkYXlNb25kYXkocGFyc2VkKTtcbiAgfSkoKTtcbiAgY29uc3QgZGF5cyA9XG4gICAgcmVwZWF0ID09PSBcImRhaWx5XCJcbiAgICAgID8gWzEsIDIsIDMsIDQsIDUsIDYsIDddXG4gICAgICA6IHJlcGVhdCA9PT0gXCJ3ZWVrZGF5c1wiXG4gICAgICAgID8gWzEsIDIsIDMsIDQsIDVdXG4gICAgICAgIDogW3dlZWtkYXldO1xuICByZXR1cm4ge1xuICAgIGlkOiBpZCgpLFxuICAgIGF1dG9tYXRpYzogdHJ1ZSxcbiAgICBwcmludEFoZWFkRGF5czogMCxcbiAgICBwcmludGluZzogeyBraW5kOiBcIndlZWtseVwiLCBzbG90czogW3sgZGF5cywgdGltZTogdGFzay5yZW1pbmRlclRpbWUgfV0gfSxcbiAgICBzaGFwZToge1xuICAgICAgdGl0bGU6IHRhc2sudGl0bGUsXG4gICAgICBub3RlczogdGFzay5ub3RlcyxcbiAgICAgIHByb2plY3RJZDogdGFzay5wcm9qZWN0SWQsXG4gICAgICBoYWJpdElkOiB0YXNrLmhhYml0SWQsXG4gICAgICBmb2N1c01pbnV0ZXM6IHRhc2suZm9jdXNNaW51dGVzLFxuICAgICAgc2NyYXBNaW51dGVzOiB0YXNrLnNjcmFwTWludXRlcyxcbiAgICAgIHByaW9yaXR5OiB0YXNrLnByaW9yaXR5LFxuICAgICAgZXN0aW1hdGU6IHRhc2suZXN0aW1hdGUsXG4gICAgICB0YWdzOiBbLi4udGFzay50YWdzXSxcbiAgICAgIHN1YnRhc2tzOiB0YXNrLnN1YnRhc2tzLm1hcCgocykgPT4gKHsgaWQ6IHMuaWQsIHRpdGxlOiBzLnRpdGxlIH0pKSxcbiAgICB9LFxuICB9O1xufVxuIiwgIi8vISBcdTVCNjZcdTYwQzVcdThCQzFcdTYzNkVcdUZGMUFcdTVERjJcdTVCOENcdTYyMTBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcdTMwMDFcdTY3NjVcdTZFOTBcdTUzRUZcdTVCQTFcdThCQTFcdTRFMTRcdTRFMERcdTUzRUZcdTg5ODZcdTUxOTlcdTc2ODRcdThGREJcdTVFQTZcdTUzODZcdTUzRjJcdTMwMDFcdThCQTJcdTZCNjNcdTY4QzBcdTY3RTVcdUZGMENcbi8vISBcdTYzMDlcdTYzRDBcdTRFQTQvXHU2Mjc5XHU2NTM5L1x1OEJBMlx1NkI2M1x1N0QyMlx1NUYxNVx1OEJBMVx1N0I5N1x1NTJBOFx1NjAwMVx1NUI2Nlx1NjBDNVx1NjQ1OFx1ODk4MVx1NTNDQVx1NjM4Q1x1NjNFMS9cdThCQTFcdTY1RjYvXHU4QkEyXHU2QjYzL1x1NTkwRFx1NkQ0Qlx1NTIwNlx1NUM0Mlx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvbGVhcm5pbmcucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IsIGVuc3VyZSwgcmVxdWlyZSB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHtcbiAgYXNBcnJheSxcbiAgYXNCb29sLFxuICBhc0ludCxcbiAgYXNPcHQsXG4gIGFzU3RyLFxuICBmaWVsZCxcbiAgaXNPYmplY3QsXG4gIG9uZU9mLFxuICByZWplY3RVbmtub3duLFxuICByZXF1aXJlZEZpZWxkLFxufSBmcm9tIFwiLi9qc29uXCI7XG5pbXBvcnQgdHlwZSB7IEVkdWNhdGlvbiB9IGZyb20gXCIuL2VkdWNhdGlvblwiO1xuaW1wb3J0IHR5cGUgeyBBcHBEYXRhIH0gZnJvbSBcIi4vbGliXCI7XG5pbXBvcnQgdHlwZSB7XG4gIEFzc2Vzc21lbnQsXG4gIENvbXBsZXRlZFN0dWR5VGFzayxcbiAgQ29ycmVjdGlvbixcbiAgR3JhZGUsXG4gIExlc3NvbixcbiAgUHJvZ3Jlc3NSZWNvcmQsXG4gIFJldmlldyxcbiAgU3VibWlzc2lvbixcbn0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IGF0TG9jYWxEYXRlU3RyaW5nLCBkYXRlQXQgfSBmcm9tIFwiLi90aW1lXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNvbXBsZXRlZFN0dWR5VGFzayhyYXc6IHVua25vd24pOiBDb21wbGV0ZWRTdHVkeVRhc2sge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1x1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1wiaWRcIiwgXCJwcm9qZWN0SWRcIiwgXCJ0aXRsZVwiLCBcIm5vdGVzXCIsIFwidG9waWNzXCIsIFwiY29tcGxldGVkQXRcIl0sXG4gICAgXCJcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU1REYyXHU1QjhDXHU2MjEwXHU1QjY2XHU0RTYwXHU0RUZCXHU1MkExXHU1RkVCXHU3MTY3XCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIiwgYXNTdHIpLFxuICAgIG5vdGVzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJub3Rlc1wiLCBcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1wiLCBhc1N0ciksXG4gICAgdG9waWNzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidG9waWNzXCIsXG4gICAgICBcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1wiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0b3BpY3NcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NzdFNVx1OEJDNlx1NzBCOVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIGNvbXBsZXRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb21wbGV0ZWRBdFwiLCBcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1wiLCBhc0ludCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVDb21wbGV0ZWRTdHVkeVRhc2soXG4gIHQ6IENvbXBsZXRlZFN0dWR5VGFzayxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdC5pZCxcbiAgICBwcm9qZWN0SWQ6IHQucHJvamVjdElkLFxuICAgIHRpdGxlOiB0LnRpdGxlLFxuICAgIG5vdGVzOiB0Lm5vdGVzLFxuICAgIHRvcGljczogdC50b3BpY3MsXG4gICAgY29tcGxldGVkQXQ6IHQuY29tcGxldGVkQXQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHRleHQoczogc3RyaW5nLCBtYXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gcy50cmltKCkubGVuZ3RoID4gMCAmJiBBcnJheS5mcm9tKHMpLmxlbmd0aCA8PSBtYXg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUxlYXJuaW5nKGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgY29uc3QgZSA9IGRhdGEuZWR1Y2F0aW9uO1xuICBlbnN1cmUoXG4gICAgZS5wcm9ncmVzcy5sZW5ndGggKyBlLmNvbXBsZXRlZFRhc2tzLmxlbmd0aCArIGUuY29ycmVjdGlvbnMubGVuZ3RoIDw9XG4gICAgICAxMDAwMDAsXG4gICAgXCJcdTVCNjZcdTRFNjBcdThCQzFcdTYzNkVcdTY1NzBcdTkxQ0ZcdThEODVcdTUxRkFcdTk2NTBcdTUyMzZcIixcbiAgKTtcbiAgY29uc3QgaWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgdGFzayBvZiBlLmNvbXBsZXRlZFRhc2tzKSB7XG4gICAgZW5zdXJlKFxuICAgICAgIWlkcy5oYXMoYHRhc2t8JHt0YXNrLmlkfWApICYmXG4gICAgICAgIHRhc2suaWQubGVuZ3RoID4gMCAmJlxuICAgICAgICBkYXRhLnByb2plY3RzLnNvbWUoKHApID0+IHAuaWQgPT09IHRhc2sucHJvamVjdElkKSAmJlxuICAgICAgICB0ZXh0KHRhc2sudGl0bGUsIDIwMCkgJiZcbiAgICAgICAgdGFzay5ub3Rlcy5sZW5ndGggPD0gNTAwMDAgJiZcbiAgICAgICAgdGFzay50b3BpY3MubGVuZ3RoIDw9IDIwLFxuICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIixcbiAgICApO1xuICAgIGlkcy5hZGQoYHRhc2t8JHt0YXNrLmlkfWApO1xuICB9XG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIGUucHJvZ3Jlc3MpIHtcbiAgICBlbnN1cmUoXG4gICAgICAhaWRzLmhhcyhgcHJvZ3Jlc3N8JHtyZWNvcmQuaWR9YCkgJiZcbiAgICAgICAgcmVjb3JkLmlkLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgZGF0YS5wcm9qZWN0cy5zb21lKChwKSA9PiBwLmlkID09PSByZWNvcmQucHJvamVjdElkKSAmJlxuICAgICAgICB0ZXh0KHJlY29yZC50b3BpYywgMjAwKSAmJlxuICAgICAgICB0ZXh0KHJlY29yZC5wb3NpdGlvbiwgMjAwMCkgJiZcbiAgICAgICAgdGV4dChyZWNvcmQuZXZpZGVuY2UsIDgwMDApICYmXG4gICAgICAgIEFycmF5LmZyb20ocmVjb3JkLm5leHRBY3Rpb24pLmxlbmd0aCA8PSAyMDAwLFxuICAgICAgXCJcdTVCNjZcdTRFNjBcdThGREJcdTVFQTZcdTk3MDBcdTg5ODFcdTk4NzlcdTc2RUVcdTMwMDFcdTc3RTVcdThCQzZcdTcwQjlcdTMwMDFcdTVCOUVcdTk2NDVcdTRGNERcdTdGNkVcdTU0OENcdTRGOURcdTYzNkVcIixcbiAgICApO1xuICAgIGlkcy5hZGQoYHByb2dyZXNzfCR7cmVjb3JkLmlkfWApO1xuICB9XG4gIGZvciAoY29uc3QgY29ycmVjdGlvbiBvZiBlLmNvcnJlY3Rpb25zKSB7XG4gICAgY29uc3QgZ3JhZGUgPSByZXF1aXJlKGUuZ3JhZGVzLmZpbmQoXG4gICAgICAoZykgPT4gZy5pZCA9PT0gY29ycmVjdGlvbi5ncmFkZUlkLFxuICAgICksIFwiXHU4QkEyXHU2QjYzXHU3RjNBXHU1QzExXHU2Mjc5XHU2NTM5XHU4QkIwXHU1RjU1XCIpO1xuICAgIGNvbnN0IGFzc2Vzc21lbnQgPSByZXF1aXJlKCgoKSA9PiB7XG4gICAgICBjb25zdCBzdWIgPSBlLnN1Ym1pc3Npb25zLmZpbmQoKHMpID0+IHMuaWQgPT09IGdyYWRlLnN1Ym1pc3Npb25JZCk7XG4gICAgICByZXR1cm4gc3ViID09PSB1bmRlZmluZWRcbiAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgOiBlLmFzc2Vzc21lbnRzLmZpbmQoKGEpID0+IGEuaWQgPT09IHN1Yi5hc3Nlc3NtZW50SWQpO1xuICAgIH0pKCksIFwiXHU4QkEyXHU2QjYzXHU3RjNBXHU1QzExXHU4QkQ1XHU5ODk4XCIpO1xuICAgIGVuc3VyZShcbiAgICAgICFpZHMuaGFzKGBjb3JyZWN0aW9ufCR7Y29ycmVjdGlvbi5pZH1gKSAmJlxuICAgICAgICBjb3JyZWN0aW9uLmlkLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgYXNzZXNzbWVudC5xdWVzdGlvbnMuc29tZSgocSkgPT4gcS5pZCA9PT0gY29ycmVjdGlvbi5xdWVzdGlvbklkKSAmJlxuICAgICAgICBBcnJheS5mcm9tKGNvcnJlY3Rpb24uZXhwbGFuYXRpb24pLmxlbmd0aCA8PSA4MDAwICYmXG4gICAgICAgICh0ZXh0KGNvcnJlY3Rpb24uZXhwbGFuYXRpb24sIDgwMDApIHx8XG4gICAgICAgICAgY29ycmVjdGlvbi5yZXNvdXJjZUlkcy5sZW5ndGggPiAwKSAmJlxuICAgICAgICBjb3JyZWN0aW9uLnJlc291cmNlSWRzLmV2ZXJ5KChpZCkgPT5cbiAgICAgICAgICBlLnJlc291cmNlcy5zb21lKFxuICAgICAgICAgICAgKHIpID0+IHIuaWQgPT09IGlkICYmIHIucHJvamVjdElkID09PSBhc3Nlc3NtZW50LnByb2plY3RJZCxcbiAgICAgICAgICApLFxuICAgICAgICApICYmXG4gICAgICAgIChjb3JyZWN0aW9uLmFjY2VwdGVkICE9PSBudWxsKSA9PT0gKGNvcnJlY3Rpb24ucmV2aWV3ZWRBdCAhPT0gbnVsbCkgJiZcbiAgICAgICAgKGNvcnJlY3Rpb24ucmV2aWV3ZWRBdCA9PT0gbnVsbCB8fFxuICAgICAgICAgIChjb3JyZWN0aW9uLnJldmlld2VkQXQgPj0gY29ycmVjdGlvbi5zdWJtaXR0ZWRBdCAmJlxuICAgICAgICAgICAgdGV4dChjb3JyZWN0aW9uLmZlZWRiYWNrLCA4MDAwKSkpLFxuICAgICAgXCJcdThCQTJcdTZCNjNcdTk3MDBcdTg5ODFcdTUzOUZcdTk4OThcdTMwMDFcdTg5RTNcdTkxQ0FcdTYyMTZcdTY3MkNcdTk4NzlcdTc2RUVcdTk2NDRcdTRFRjZcdUZGMUJcdTY4QzBcdTY3RTVcdTdFRDNcdTY3OUNcdTVGQzVcdTk4N0JcdTY3MDlcdTUzQ0RcdTk5ODhcIixcbiAgICApO1xuICAgIGlkcy5hZGQoYGNvcnJlY3Rpb258JHtjb3JyZWN0aW9uLmlkfWApO1xuICB9XG59XG5cbi8qKiBcdThGREJcdTVFQTYvXHU1RkVCXHU3MTY3L1x1OEJBMlx1NkI2M1x1NTM4Nlx1NTNGMlx1NEUwRFx1NTNFRlx1NTIyMFx1OTY2NFx1MzAwMVx1NEUwRFx1NTNFRlx1NjUzOVx1NTE5OVx1RkYxQlx1Nzg2RVx1OEJBNFx1NEUwRVx1NjhDMFx1NjdFNVx1NzJCNlx1NjAwMVx1NTE0MVx1OEJCOFx1NTM1NVx1NTQxMVx1NjNBOFx1OEZEQlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlTGVhcm5pbmdUcmFuc2l0aW9uKFxuICBiZWZvcmU6IEVkdWNhdGlvbixcbiAgYWZ0ZXI6IEVkdWNhdGlvbixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHJlY29yZCBvZiBiZWZvcmUucHJvZ3Jlc3MpIHtcbiAgICBlbnN1cmUoXG4gICAgICBhZnRlci5wcm9ncmVzcy5zb21lKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpLFxuICAgICAgXCJcdThGREJcdTVFQTZcdTUzODZcdTUzRjJcdTRFMERcdTgwRkRcdTUyMjBcdTk2NjRcdUZGMENcdThCRjdcdTY1QjBcdTU4OUVcdTY2RjRcdTZCNjNcdThCQjBcdTVGNTVcIixcbiAgICApO1xuICAgIGNvbnN0IG5leHQgPSBhZnRlci5wcm9ncmVzcy5maW5kKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpO1xuICAgIGlmIChuZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG9sZCA9IHsgLi4ucmVjb3JkIH07XG4gICAgICBvbGQuY29uZmlybWVkID0gbmV4dC5jb25maXJtZWQ7XG4gICAgICBlbnN1cmUocHJvZ3Jlc3NFcXVhbHMob2xkLCBuZXh0KSwgXCJcdThGREJcdTVFQTZcdTUzODZcdTUzRjJcdTRFMERcdTUzRUZcdTY1MzlcdTUxOTlcdUZGMENcdThCRjdcdTY1QjBcdTU4OUVcdTRFMDBcdTY3NjFcdTY2RjRcdTZCNjNcdThCQjBcdTVGNTVcIik7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIGJlZm9yZS5jb21wbGV0ZWRUYXNrcykge1xuICAgIGVuc3VyZShcbiAgICAgIGFmdGVyLmNvbXBsZXRlZFRhc2tzLmZpbmQoKHIpID0+IHIuaWQgPT09IHJlY29yZC5pZCkgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICBjb21wbGV0ZWRUYXNrRXF1YWxzKFxuICAgICAgICAgIGFmdGVyLmNvbXBsZXRlZFRhc2tzLmZpbmQoKHIpID0+IHIuaWQgPT09IHJlY29yZC5pZCkhLFxuICAgICAgICAgIHJlY29yZCxcbiAgICAgICAgKSxcbiAgICAgIFwiXHU1REYyXHU1QjhDXHU2MjEwXHU0RUZCXHU1MkExXHU3Njg0XHU1QjY2XHU0RTYwXHU1MTg1XHU1QkI5XHU1RkVCXHU3MTY3XHU0RTBEXHU1M0VGXHU2NTM5XHU1MTk5XCIsXG4gICAgKTtcbiAgfVxuICBmb3IgKGNvbnN0IHJlY29yZCBvZiBiZWZvcmUuY29ycmVjdGlvbnMpIHtcbiAgICBlbnN1cmUoXG4gICAgICBhZnRlci5jb3JyZWN0aW9ucy5zb21lKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpLFxuICAgICAgXCJcdThCQTJcdTZCNjNcdTUzODZcdTUzRjJcdTRFMERcdTgwRkRcdTUyMjBcdTk2NjRcIixcbiAgICApO1xuICAgIGNvbnN0IG5leHQgPSBhZnRlci5jb3JyZWN0aW9ucy5maW5kKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpO1xuICAgIGlmIChuZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG9sZCA9IHsgLi4ucmVjb3JkLCByZXNvdXJjZUlkczogWy4uLnJlY29yZC5yZXNvdXJjZUlkc10gfTtcbiAgICAgIGlmIChvbGQucmV2aWV3ZWRBdCA9PT0gbnVsbCkge1xuICAgICAgICBvbGQuYWNjZXB0ZWQgPSBuZXh0LmFjY2VwdGVkO1xuICAgICAgICBvbGQuZmVlZGJhY2sgPSBuZXh0LmZlZWRiYWNrO1xuICAgICAgICBvbGQucmV2aWV3ZWRBdCA9IG5leHQucmV2aWV3ZWRBdDtcbiAgICAgIH1cbiAgICAgIGVuc3VyZShcbiAgICAgICAgY29ycmVjdGlvbkVxdWFscyhvbGQsIG5leHQpLFxuICAgICAgICBcIlx1OEJBMlx1NkI2M1x1NEUwRVx1NjhDMFx1NjdFNVx1NTM4Nlx1NTNGMlx1NEUwRFx1NTNFRlx1NjUzOVx1NTE5OVx1RkYwQ1x1OEJGN1x1NjVCMFx1NTg5RVx1NEUwMFx1NkIyMVx1OEJBMlx1NkI2M1wiLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvZ3Jlc3NFcXVhbHMoYTogUHJvZ3Jlc3NSZWNvcmQsIGI6IFByb2dyZXNzUmVjb3JkKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgYS5pZCA9PT0gYi5pZCAmJlxuICAgIGEucHJvamVjdElkID09PSBiLnByb2plY3RJZCAmJlxuICAgIGEudG9waWMgPT09IGIudG9waWMgJiZcbiAgICBhLnBvc2l0aW9uID09PSBiLnBvc2l0aW9uICYmXG4gICAgYS5zdGF0ZSA9PT0gYi5zdGF0ZSAmJlxuICAgIGEuZXZpZGVuY2UgPT09IGIuZXZpZGVuY2UgJiZcbiAgICBhLm5leHRBY3Rpb24gPT09IGIubmV4dEFjdGlvbiAmJlxuICAgIGEuc291cmNlID09PSBiLnNvdXJjZSAmJlxuICAgIGEuY29uZmlybWVkID09PSBiLmNvbmZpcm1lZCAmJlxuICAgIGEucmVjb3JkZWRBdCA9PT0gYi5yZWNvcmRlZEF0XG4gICk7XG59XG5cbmZ1bmN0aW9uIGNvbXBsZXRlZFRhc2tFcXVhbHMoXG4gIGE6IENvbXBsZXRlZFN0dWR5VGFzayxcbiAgYjogQ29tcGxldGVkU3R1ZHlUYXNrLFxuKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgYS5pZCA9PT0gYi5pZCAmJlxuICAgIGEucHJvamVjdElkID09PSBiLnByb2plY3RJZCAmJlxuICAgIGEudGl0bGUgPT09IGIudGl0bGUgJiZcbiAgICBhLm5vdGVzID09PSBiLm5vdGVzICYmXG4gICAgYS50b3BpY3MubGVuZ3RoID09PSBiLnRvcGljcy5sZW5ndGggJiZcbiAgICBhLnRvcGljcy5ldmVyeSgodCwgaSkgPT4gYi50b3BpY3NbaV0gPT09IHQpICYmXG4gICAgYS5jb21wbGV0ZWRBdCA9PT0gYi5jb21wbGV0ZWRBdFxuICApO1xufVxuXG5mdW5jdGlvbiBjb3JyZWN0aW9uRXF1YWxzKGE6IENvcnJlY3Rpb24sIGI6IENvcnJlY3Rpb24pOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICBhLmlkID09PSBiLmlkICYmXG4gICAgYS5ncmFkZUlkID09PSBiLmdyYWRlSWQgJiZcbiAgICBhLnF1ZXN0aW9uSWQgPT09IGIucXVlc3Rpb25JZCAmJlxuICAgIGEuZXhwbGFuYXRpb24gPT09IGIuZXhwbGFuYXRpb24gJiZcbiAgICBhLnJlc291cmNlSWRzLmxlbmd0aCA9PT0gYi5yZXNvdXJjZUlkcy5sZW5ndGggJiZcbiAgICBhLnJlc291cmNlSWRzLmV2ZXJ5KChyLCBpKSA9PiBiLnJlc291cmNlSWRzW2ldID09PSByKSAmJlxuICAgIGEuc3VibWl0dGVkQXQgPT09IGIuc3VibWl0dGVkQXQgJiZcbiAgICBhLmFjY2VwdGVkID09PSBiLmFjY2VwdGVkICYmXG4gICAgYS5mZWVkYmFjayA9PT0gYi5mZWVkYmFjayAmJlxuICAgIGEucmV2aWV3ZWRBdCA9PT0gYi5yZXZpZXdlZEF0XG4gICk7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU1QjY2XHU2MEM1XHU2NDU4XHU4OTgxIC0tLS0tLS0tLS1cblxuaW50ZXJmYWNlIFN1bW1hcnlJbmRleCB7XG4gIHN1Ym1pc3Npb25zOiBNYXA8c3RyaW5nLCBTdWJtaXNzaW9uPjtcbiAgZ3JhZGVzOiBNYXA8c3RyaW5nLCBHcmFkZT47XG4gIGFzc2Vzc21lbnRHcmFkZXM6IE1hcDxzdHJpbmcsIEdyYWRlPjtcbiAgYWNjZXB0ZWQ6IFNldDxzdHJpbmc+O1xuICByZXRlc3RzOiBNYXA8c3RyaW5nLCBBc3Nlc3NtZW50W10+O1xufVxuXG5mdW5jdGlvbiBidWlsZFN1bW1hcnlJbmRleChlOiBFZHVjYXRpb24pOiBTdW1tYXJ5SW5kZXgge1xuICBjb25zdCBpbmRleDogU3VtbWFyeUluZGV4ID0ge1xuICAgIHN1Ym1pc3Npb25zOiBuZXcgTWFwKCksXG4gICAgZ3JhZGVzOiBuZXcgTWFwKCksXG4gICAgYXNzZXNzbWVudEdyYWRlczogbmV3IE1hcCgpLFxuICAgIGFjY2VwdGVkOiBuZXcgU2V0KCksXG4gICAgcmV0ZXN0czogbmV3IE1hcCgpLFxuICB9O1xuICBjb25zdCBwYXJlbnRzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBzIG9mIGUuc3VibWlzc2lvbnMpIHtcbiAgICBwYXJlbnRzLnNldChzLmlkLCBzLmFzc2Vzc21lbnRJZCk7XG4gICAgY29uc3Qgb2xkID0gaW5kZXguc3VibWlzc2lvbnMuZ2V0KHMuYXNzZXNzbWVudElkKTtcbiAgICBpZiAob2xkID09PSB1bmRlZmluZWQgfHwgcy5zdWJtaXR0ZWRBdCA+PSBvbGQuc3VibWl0dGVkQXQpIHtcbiAgICAgIGluZGV4LnN1Ym1pc3Npb25zLnNldChzLmFzc2Vzc21lbnRJZCwgcyk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgZyBvZiBlLmdyYWRlcykge1xuICAgIGNvbnN0IG9sZCA9IGluZGV4LmdyYWRlcy5nZXQoZy5zdWJtaXNzaW9uSWQpO1xuICAgIGlmIChvbGQgPT09IHVuZGVmaW5lZCB8fCBnLmdyYWRlZEF0ID49IG9sZC5ncmFkZWRBdCkge1xuICAgICAgaW5kZXguZ3JhZGVzLnNldChnLnN1Ym1pc3Npb25JZCwgZyk7XG4gICAgfVxuICAgIGNvbnN0IGFzc2Vzc21lbnQgPSBwYXJlbnRzLmdldChnLnN1Ym1pc3Npb25JZCk7XG4gICAgaWYgKGFzc2Vzc21lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3Qgb2xkQSA9IGluZGV4LmFzc2Vzc21lbnRHcmFkZXMuZ2V0KGFzc2Vzc21lbnQpO1xuICAgICAgaWYgKG9sZEEgPT09IHVuZGVmaW5lZCB8fCBnLmdyYWRlZEF0ID49IG9sZEEuZ3JhZGVkQXQpIHtcbiAgICAgICAgaW5kZXguYXNzZXNzbWVudEdyYWRlcy5zZXQoYXNzZXNzbWVudCwgZyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgYyBvZiBlLmNvcnJlY3Rpb25zKSB7XG4gICAgaWYgKGMuYWNjZXB0ZWQgPT09IHRydWUpIHtcbiAgICAgIGluZGV4LmFjY2VwdGVkLmFkZChgJHtjLmdyYWRlSWR9fCR7Yy5xdWVzdGlvbklkfWApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IGEgb2YgZS5hc3Nlc3NtZW50cykge1xuICAgIGlmIChhLnJldGVzdE9mR3JhZGVJZCAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgbGlzdCA9IGluZGV4LnJldGVzdHMuZ2V0KGEucmV0ZXN0T2ZHcmFkZUlkKSA/PyBbXTtcbiAgICAgIGxpc3QucHVzaChhKTtcbiAgICAgIGluZGV4LnJldGVzdHMuc2V0KGEucmV0ZXN0T2ZHcmFkZUlkLCBsaXN0KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBhc3Nlc3NtZW50U3VtbWFyeShcbiAgaW5kZXg6IFN1bW1hcnlJbmRleCxcbiAgYTogQXNzZXNzbWVudCxcbiAgYXQ6IG51bWJlcixcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3Qgc3VibWlzc2lvbiA9IGluZGV4LnN1Ym1pc3Npb25zLmdldChhLmlkKSA/PyBudWxsO1xuICBjb25zdCBncmFkZSA9XG4gICAgc3VibWlzc2lvbiAhPT0gbnVsbCA/IChpbmRleC5ncmFkZXMuZ2V0KHN1Ym1pc3Npb24uaWQpID8/IG51bGwpIDogbnVsbDtcbiAgY29uc3Qgc3RhdHVzID0gKCgpID0+IHtcbiAgICBpZiAoZ3JhZGUgIT09IG51bGwpIHtcbiAgICAgIGlmIChncmFkZS5uZWVkc1JldmlldykgcmV0dXJuIFwibmVlZHNSZXZpZXdcIjtcbiAgICAgIGlmIChcbiAgICAgICAgZ3JhZGUuZXJyb3JzLnNvbWUoXG4gICAgICAgICAgKGVycm9yKSA9PiAhaW5kZXguYWNjZXB0ZWQuaGFzKGAke2dyYWRlLmlkfXwke2Vycm9yLnF1ZXN0aW9uSWR9YCksXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gXCJjb3JyZWN0aW9uRHVlXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gXCJncmFkZWRcIjtcbiAgICB9XG4gICAgaWYgKHN1Ym1pc3Npb24gIT09IG51bGwpIHJldHVybiBcInN1Ym1pdHRlZFwiO1xuICAgIGlmIChcbiAgICAgIGEua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICBhLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgICAgZGF0ZUF0KGF0KSA+IGRhdGVBdChhLnN0YXJ0c0F0KVxuICAgICkge1xuICAgICAgcmV0dXJuIFwibWlzc2VkXCI7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIGEua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJlxuICAgICAgYS5zdG9wcGVkQXQgPT09IG51bGwgJiZcbiAgICAgIGF0IDwgZXhhbURlYWRsaW5lKGEpXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJpblByb2dyZXNzXCI7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIGEua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJlxuICAgICAgKGEuc3RvcHBlZEF0ICE9PSBudWxsIHx8IGF0ID49IGV4YW1EZWFkbGluZShhKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBcImF3YWl0aW5nU3VibWlzc2lvblwiO1xuICAgIH1cbiAgICBpZiAoYS5raW5kID09PSBcImhvbWV3b3JrXCIgJiYgYXQgPj0gYS5lbmRzQXQpIHJldHVybiBcIm92ZXJkdWVcIjtcbiAgICBpZiAoYXQgPCBhLnN0YXJ0c0F0IHx8IChhLmtpbmQgIT09IFwiaG9tZXdvcmtcIiAmJiBhLnN0YXJ0ZWRBdCA9PT0gbnVsbCkpXG4gICAgICByZXR1cm4gXCJ1cGNvbWluZ1wiO1xuICAgIHJldHVybiBcImF3YWl0aW5nU3VibWlzc2lvblwiO1xuICB9KSgpO1xuICByZXR1cm4ge1xuICAgIGlkOiBhLmlkLFxuICAgIHRpdGxlOiBhLnRpdGxlLFxuICAgIGtpbmQ6IGEua2luZCxcbiAgICBzdGF0dXMsXG4gICAgc3RhcnRzQXQ6IGEuc3RhcnRzQXQsXG4gICAgZW5kc0F0OiBhLmVuZHNBdCxcbiAgICBzdWJtaXNzaW9uSWQ6IHN1Ym1pc3Npb24/LmlkID8/IG51bGwsXG4gICAgc3VibWl0dGVkQXQ6IHN1Ym1pc3Npb24/LnN1Ym1pdHRlZEF0ID8/IG51bGwsXG4gICAgdW5maW5pc2hlZDogc3VibWlzc2lvbiAhPT0gbnVsbCAmJiBzdWJtaXNzaW9uLnVuZmluaXNoZWQsXG4gICAgbGF0ZTpcbiAgICAgIGEua2luZCA9PT0gXCJob21ld29ya1wiICYmXG4gICAgICBzdWJtaXNzaW9uICE9PSBudWxsICYmXG4gICAgICBzdWJtaXNzaW9uLnN1Ym1pdHRlZEF0ID4gYS5lbmRzQXQsXG4gICAgZ3JhZGVJZDogZ3JhZGU/LmlkID8/IG51bGwsXG4gICAgZ3JhZGVkQXQ6IGdyYWRlPy5ncmFkZWRBdCA/PyBudWxsLFxuICAgIHNjb3JlOlxuICAgICAgZ3JhZGUgIT09IG51bGwgJiYgIWdyYWRlLm5lZWRzUmV2aWV3XG4gICAgICAgID8gZ3JhZGUuYXdhcmRzLnJlZHVjZSgobiwgcCkgPT4gbiArIHAuYXdhcmRlZCwgMClcbiAgICAgICAgOiBudWxsLFxuICAgIHRvdGFsOiBhLnF1ZXN0aW9ucy5yZWR1Y2UoXG4gICAgICAobiwgcSkgPT4gbiArIHEuc2NvcmluZy5yZWR1Y2UoKG0sIHApID0+IG0gKyBwLnBvaW50cywgMCksXG4gICAgICAwLFxuICAgICksXG4gICAgbmVlZHNSZXZpZXc6IGdyYWRlICE9PSBudWxsICYmIGdyYWRlLm5lZWRzUmV2aWV3LFxuICB9O1xufVxuXG5mdW5jdGlvbiBleGFtRGVhZGxpbmUoYTogQXNzZXNzbWVudCk6IG51bWJlciB7XG4gIHJldHVybiBhLnN0YXJ0ZWRBdCA9PT0gbnVsbFxuICAgID8gYS5lbmRzQXRcbiAgICA6IGEuc3RhcnRlZEF0ICsgKGEuZW5kc0F0IC0gYS5zdGFydHNBdCk7XG59XG5cbi8qKiBcdTZCQ0ZcdTZCMjFcdTRFQ0VcdTVGNTNcdTUyNERcdThCQzFcdTYzNkVcdTYzQThcdTVCRkNcdUZGMUJcdTZDQTFcdTY3MDlcdTdCMkNcdTRFOENcdTRFRkRcdTRGMUFcdThGQzdcdTY3MUZcdTc2ODRcdTY0NThcdTg5ODFcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBzdW1tYXJpZXMoXG4gIGRhdGE6IEFwcERhdGEsXG4gIGF0OiBudW1iZXIsXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdIHtcbiAgY29uc3QgZSA9IGRhdGEuZWR1Y2F0aW9uO1xuICBjb25zdCBpbmRleCA9IGJ1aWxkU3VtbWFyeUluZGV4KGUpO1xuICBjb25zdCBvdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgZm9yIChjb25zdCBwcm9qZWN0IG9mIGRhdGEucHJvamVjdHMuZmlsdGVyKFxuICAgIChwKSA9PlxuICAgICAgZS5wcm9qZWN0cy5zb21lKChzKSA9PiBzLnByb2plY3RJZCA9PT0gcC5pZCkgfHxcbiAgICAgIGUucHJvZ3Jlc3Muc29tZSgocikgPT4gci5wcm9qZWN0SWQgPT09IHAuaWQpLFxuICApKSB7XG4gICAgY29uc3QgcHJvZ3Jlc3MgPSBlLnByb2dyZXNzXG4gICAgICAuZmlsdGVyKChyKSA9PiByLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZClcbiAgICAgIC5zbGljZSgpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5yZWNvcmRlZEF0IC0gYi5yZWNvcmRlZEF0KTtcbiAgICBjb25zdCB0b3BpY3MgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBsYXRlc3QgPSBwcm9ncmVzc1xuICAgICAgLnNsaWNlKClcbiAgICAgIC5yZXZlcnNlKClcbiAgICAgIC5maWx0ZXIoKHIpID0+IHtcbiAgICAgICAgaWYgKHRvcGljcy5oYXMoci50b3BpYykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgdG9waWNzLmFkZChyLnRvcGljKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgICBjb25zdCBhc3Nlc3NtZW50cyA9IGUuYXNzZXNzbWVudHNcbiAgICAgIC5maWx0ZXIoKGEpID0+IGEucHJvamVjdElkID09PSBwcm9qZWN0LmlkKVxuICAgICAgLm1hcCgoYSkgPT4gYXNzZXNzbWVudFN1bW1hcnkoaW5kZXgsIGEsIGF0KSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiAoYi5zdGFydHNBdCBhcyBudW1iZXIpIC0gKGEuc3RhcnRzQXQgYXMgbnVtYmVyKSk7XG4gICAgY29uc3QgcmV0ZXN0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICAgIGNvbnN0IGdyYWRlcyA9IGUuYXNzZXNzbWVudHNcbiAgICAgIC5maWx0ZXIoKGEpID0+IGEucHJvamVjdElkID09PSBwcm9qZWN0LmlkKVxuICAgICAgLm1hcCgoYSkgPT4gaW5kZXguYXNzZXNzbWVudEdyYWRlcy5nZXQoYS5pZCkpXG4gICAgICAuZmlsdGVyKChnKTogZyBpcyBHcmFkZSA9PiBnICE9PSB1bmRlZmluZWQpO1xuICAgIGZvciAoY29uc3QgZ3JhZGUgb2YgZ3JhZGVzKSB7XG4gICAgICBjb25zdCBhdHRlbXB0cyA9IChpbmRleC5yZXRlc3RzLmdldChncmFkZS5pZCkgPz8gW10pLm1hcCgoYSkgPT5cbiAgICAgICAgYXNzZXNzbWVudFN1bW1hcnkoaW5kZXgsIGEsIGF0KSxcbiAgICAgICk7XG4gICAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGdyYWRlLmVycm9ycykge1xuICAgICAgICByZXRlc3RzLnB1c2goe1xuICAgICAgICAgIGdyYWRlSWQ6IGdyYWRlLmlkLFxuICAgICAgICAgIHF1ZXN0aW9uSWQ6IGVycm9yLnF1ZXN0aW9uSWQsXG4gICAgICAgICAgY2F1c2U6IGVycm9yLmNhdXNlLFxuICAgICAgICAgIGNvbmZpcm1lZDogZXJyb3IuY29uZmlybWVkLFxuICAgICAgICAgIHJldGVzdERhdGU6IGVycm9yLnJldGVzdERhdGUsXG4gICAgICAgICAgbmV4dENoZWNrOiBlcnJvci5uZXh0Q2hlY2ssXG4gICAgICAgICAgY29ycmVjdGlvbkFjY2VwdGVkOiBpbmRleC5hY2NlcHRlZC5oYXMoXG4gICAgICAgICAgICBgJHtncmFkZS5pZH18JHtlcnJvci5xdWVzdGlvbklkfWAsXG4gICAgICAgICAgKSxcbiAgICAgICAgICBhdHRlbXB0cyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldGVzdHMuc29ydCgoYSwgYikgPT5cbiAgICAgIFN0cmluZyhhW1wicmV0ZXN0RGF0ZVwiXSkubG9jYWxlQ29tcGFyZShTdHJpbmcoYltcInJldGVzdERhdGVcIl0pKSxcbiAgICApO1xuICAgIGNvbnN0IHJlY2VudFRhc2tzID0gZS5jb21wbGV0ZWRUYXNrc1xuICAgICAgLnNsaWNlKClcbiAgICAgIC5yZXZlcnNlKClcbiAgICAgIC5maWx0ZXIoKHQpID0+IHQucHJvamVjdElkID09PSBwcm9qZWN0LmlkKVxuICAgICAgLnNsaWNlKDAsIDUpO1xuICAgIGNvbnN0IGxlc3NvbnMgPSBlLmxlc3NvbnMuZmlsdGVyKChsKSA9PiBsLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZCk7XG4gICAgY29uc3QgbGFzdExlc3NvbiA9IGxlc3NvbnNcbiAgICAgIC5maWx0ZXIoKGwpID0+IGwuYXR0ZW5kZWQpXG4gICAgICAucmVkdWNlPExlc3NvbiB8IG51bGw+KFxuICAgICAgICAoYmVzdCwgbCkgPT4gKGJlc3QgPT09IG51bGwgfHwgbC5zdGFydHNBdCA+IGJlc3Quc3RhcnRzQXQgPyBsIDogYmVzdCksXG4gICAgICAgIG51bGwsXG4gICAgICApO1xuICAgIGNvbnN0IGxhdGVzdFJldmlldyA9IGUucmV2aWV3c1xuICAgICAgLmZpbHRlcigocikgPT4gci5wcm9qZWN0SWQgPT09IHByb2plY3QuaWQpXG4gICAgICAucmVkdWNlPFJldmlldyB8IG51bGw+KFxuICAgICAgICAoYmVzdCwgcikgPT4gKGJlc3QgPT09IG51bGwgfHwgci5kYXRlID4gYmVzdC5kYXRlID8gciA6IGJlc3QpLFxuICAgICAgICBudWxsLFxuICAgICAgKTtcbiAgICBjb25zdCByZXZpZXdUaW1lID1cbiAgICAgIGxhdGVzdFJldmlldyA9PT0gbnVsbCA/IG51bGwgOiBhdExvY2FsRGF0ZVN0cmluZyhsYXRlc3RSZXZpZXcuZGF0ZSk7XG4gICAgY29uc3QgdXBkYXRlZCA9IE1hdGgubWF4KFxuICAgICAgLi4uW1xuICAgICAgICAuLi5sYXRlc3QubWFwKChyKSA9PiByLnJlY29yZGVkQXQpLFxuICAgICAgICAuLi5yZWNlbnRUYXNrcy5tYXAoKHIpID0+IHIuY29tcGxldGVkQXQpLFxuICAgICAgICAuLi4obGFzdExlc3NvbiAhPT0gbnVsbCA/IFtsYXN0TGVzc29uLnN0YXJ0c0F0XSA6IFtdKSxcbiAgICAgICAgLi4uKHJldmlld1RpbWUgIT09IG51bGwgPyBbcmV2aWV3VGltZV0gOiBbXSksXG4gICAgICAgIC4uLmFzc2Vzc21lbnRzXG4gICAgICAgICAgLmZpbHRlcigoYSkgPT4gdHlwZW9mIGFbXCJzdWJtaXR0ZWRBdFwiXSA9PT0gXCJudW1iZXJcIilcbiAgICAgICAgICAubWFwKChhKSA9PiBhW1wic3VibWl0dGVkQXRcIl0gYXMgbnVtYmVyKSxcbiAgICAgICAgLi4uYXNzZXNzbWVudHNcbiAgICAgICAgICAuZmlsdGVyKChhKSA9PiB0eXBlb2YgYVtcImdyYWRlZEF0XCJdID09PSBcIm51bWJlclwiKVxuICAgICAgICAgIC5tYXAoKGEpID0+IGFbXCJncmFkZWRBdFwiXSBhcyBudW1iZXIpLFxuICAgICAgICAuLi5lLmNvcnJlY3Rpb25zXG4gICAgICAgICAgLmZpbHRlcigoYykgPT4gYXNzZXNzbWVudHMuc29tZSgoYSkgPT4gYVtcImdyYWRlSWRcIl0gPT09IGMuZ3JhZGVJZCkpXG4gICAgICAgICAgLm1hcCgoYykgPT4gYy5yZXZpZXdlZEF0ID8/IGMuc3VibWl0dGVkQXQpLFxuICAgICAgXS5maWx0ZXIoKG4pID0+IHR5cGVvZiBuID09PSBcIm51bWJlclwiKSxcbiAgICAgIC1JbmZpbml0eSxcbiAgICApO1xuICAgIGNvbnN0IHRhc2tJZHMgPSBuZXcgU2V0PHN0cmluZz4oW1xuICAgICAgLi4uZGF0YS50YXNrcy5maWx0ZXIoKHQpID0+IHQucHJvamVjdElkID09PSBwcm9qZWN0LmlkKS5tYXAoKHQpID0+IHQuaWQpLFxuICAgICAgLi4uZS5jb21wbGV0ZWRUYXNrc1xuICAgICAgICAuZmlsdGVyKCh0KSA9PiB0LnByb2plY3RJZCA9PT0gcHJvamVjdC5pZClcbiAgICAgICAgLm1hcCgodCkgPT4gdC5pZCksXG4gICAgXSk7XG4gICAgY29uc3QgYWN0dWFsU2Vjb25kcyA9IGRhdGEuc2Vzc2lvbnNcbiAgICAgIC5maWx0ZXIoXG4gICAgICAgIChzKSA9PlxuICAgICAgICAgIHMuc291cmNlID09PSBcInRpbWVyXCIgJiZcbiAgICAgICAgICBzLmVuZGVkQXQgPj0gYXQgLSA3ICogODY0MDAgJiZcbiAgICAgICAgICBzLmVuZGVkQXQgPD0gYXQgJiZcbiAgICAgICAgICBzLnRhc2tJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgIHRhc2tJZHMuaGFzKHMudGFza0lkKSxcbiAgICAgIClcbiAgICAgIC5yZWR1Y2UoKG4sIHMpID0+IG4gKyBzLmR1cmF0aW9uU2VjcywgMCk7XG4gICAgY29uc3QgYXNzZXNzbWVudENvdW50ID0gYXNzZXNzbWVudHMubGVuZ3RoO1xuICAgIGNvbnN0IHJldGVzdENvdW50ID0gcmV0ZXN0cy5sZW5ndGg7XG4gICAgb3V0LnB1c2goe1xuICAgICAgcHJvamVjdElkOiBwcm9qZWN0LmlkLFxuICAgICAgcHJvamVjdE5hbWU6IHByb2plY3QubmFtZSxcbiAgICAgIHVwZGF0ZWRBdDogTnVtYmVyLmlzRmluaXRlKHVwZGF0ZWQpID8gdXBkYXRlZCA6IG51bGwsXG4gICAgICBwcm9ncmVzczogbGF0ZXN0LnNsaWNlKDAsIDEyKSxcbiAgICAgIHByb2dyZXNzQ291bnQ6IGUucHJvZ3Jlc3MuZmlsdGVyKChyKSA9PiByLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZClcbiAgICAgICAgLmxlbmd0aCxcbiAgICAgIHJlY2VudENvbXBsZXRlZFRhc2tzOiByZWNlbnRUYXNrcyxcbiAgICAgIGxhc3RBdHRlbmRlZExlc3NvbjpcbiAgICAgICAgbGFzdExlc3NvbiA9PT0gbnVsbFxuICAgICAgICAgID8gbnVsbFxuICAgICAgICAgIDoge1xuICAgICAgICAgICAgICBpZDogbGFzdExlc3Nvbi5pZCxcbiAgICAgICAgICAgICAgdGl0bGU6IGxhc3RMZXNzb24udGl0bGUsXG4gICAgICAgICAgICAgIHByb2dyZXNzOiBsYXN0TGVzc29uLnByb2dyZXNzLFxuICAgICAgICAgICAgICBzdGF0ZTogbGFzdExlc3Nvbi5zdGF0ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICBsZXNzb25zOiB7XG4gICAgICAgIHBsYW5uZWQ6IGxlc3NvbnMuZmlsdGVyKChsKSA9PiBsLnN0YXRlID09PSBcInBsYW5uZWRcIikubGVuZ3RoLFxuICAgICAgICBhdHRlbmRlZDogbGVzc29ucy5maWx0ZXIoKGwpID0+IGwuYXR0ZW5kZWQpLmxlbmd0aCxcbiAgICAgICAgbWlzc2VkOiBsZXNzb25zLmZpbHRlcigobCkgPT4gbC5zdGF0ZSA9PT0gXCJtaXNzZWRcIikubGVuZ3RoLFxuICAgICAgfSxcbiAgICAgIGFjdHVhbEZvY3VzU2Vjb25kczdkOiBhY3R1YWxTZWNvbmRzLFxuICAgICAgYXNzZXNzbWVudHM6IGFzc2Vzc21lbnRzLnNsaWNlKDAsIDIwKSxcbiAgICAgIGFzc2Vzc21lbnRDb3VudCxcbiAgICAgIHJldGVzdHM6IHJldGVzdHMuc2xpY2UoMCwgMjApLFxuICAgICAgcmV0ZXN0Q291bnQsXG4gICAgICBsYXRlc3RSZXZpZXcsXG4gICAgICBwZW5kaW5nRXZlbnRzOiBlLmV2ZW50cy5maWx0ZXIoXG4gICAgICAgIChyKSA9PiByLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZCAmJiByLnN0YXRlICE9PSBcImRvbmVcIixcbiAgICAgICkubGVuZ3RoLFxuICAgICAgbm90ZTogXCJcdThCQTFcdTY1RjZcdTRFMEVcdTRFRkJcdTUyQTFcdTVCOENcdTYyMTBcdTUzRUFcdThCRjRcdTY2MEVcdTYyOTVcdTUxNjVcdTYyMTZcdTgxRUFcdTYyQTVcdTVCOENcdTYyMTBcdUZGMUJcdTYzOENcdTYzRTFcdTk4N0JcdTY3RTVcdTc3MEJcdTdCNTRcdTUzNzdcdTMwMDFcdTYyNzlcdTY1MzlcdTRFMEVcdTcyRUNcdTdBQ0JcdTU5MERcdTZENEJcdTMwMDJcdTdBN0FcdThCQjBcdTVGNTVcdTg4NjhcdTc5M0FcdTY3MkFcdTc3RTVcdTMwMDJcIixcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuIiwgIi8vISBcdTY1NTlcdTVCNjZcdTVCOUVcdTRGNTNcdTMwMDFcdTYzMDFcdTRFNDVcdTUzMTZcdTRFOEJcdTRFRjZcdTMwMDFcdThENDRcdTZFOTBcdTVGMTVcdTc1MjhcdTRFMEVcdTUzODZcdTUzRjJcdTRGRERcdTYyQTRcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgY3JhdGVzL2NvcmUvc3JjL2VkdWNhdGlvbi5yc1x1MzAwMlxuXG5pbXBvcnQgeyBBcHBFcnJvciwgZW5zdXJlIH0gZnJvbSBcIi4vZXJyb3JzXCI7XG5pbXBvcnQge1xuICBhc0FycmF5LFxuICBhc0Jvb2wsXG4gIGFzSW50LFxuICBhc09wdCxcbiAgYXNTdHIsXG4gIGZpZWxkLFxuICBpc09iamVjdCxcbiAgb25lT2YsXG4gIHJlamVjdFVua25vd24sXG4gIHJlcXVpcmVkRmllbGQsXG59IGZyb20gXCIuL2pzb25cIjtcbmltcG9ydCB0eXBlIHtcbiAgQXNzZXNzbWVudCxcbiAgQXNzZXNzbWVudEtpbmQsXG4gIENvcnJlY3Rpb24sXG4gIEVycm9yQW5hbHlzaXMsXG4gIEdyYWRlLFxuICBMZXNzb24sXG4gIExlc3NvblN0YXRlLFxuICBNaWxlc3RvbmUsXG4gIFBvaW50QXdhcmQsXG4gIFByb2dyZXNzUmVjb3JkLFxuICBQcm9ncmVzc1NvdXJjZSxcbiAgUHJvamVjdFN0dWR5LFxuICBRdWVzdGlvbixcbiAgUXVlc3Rpb25UaW1lLFxuICBSZXNvdXJjZSxcbiAgUmVzb3VyY2VLaW5kLFxuICBSZXZpZXcsXG4gIFNjb3JpbmdQb2ludCxcbiAgU2VtZXN0ZXIsXG4gIFN1Ym1pc3Npb24sXG4gIFRlYWNoaW5nRXZlbnQsXG59IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgdHlwZSB7IEFwcERhdGEgfSBmcm9tIFwiLi9saWJcIjtcbmltcG9ydCB0eXBlIHsgQ29tcGxldGVkU3R1ZHlUYXNrLCBUYXNrIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7XG4gIGRheXNCZXR3ZWVuLFxuICBkYXRlQXQsXG4gIGxvY2FsRGF0ZU9mLFxuICBtaW51dGVzT2YsXG4gIHBhcnNlRGF0ZSxcbiAgdmFsaWREYXRlLFxuICB3ZWVrZGF5TW9uZGF5LFxufSBmcm9tIFwiLi90aW1lXCI7XG5pbXBvcnQge1xuICBwYXJzZUNvbXBsZXRlZFN0dWR5VGFzayxcbiAgc2VyaWFsaXplQ29tcGxldGVkU3R1ZHlUYXNrLFxuICB2YWxpZGF0ZUxlYXJuaW5nLFxuICB2YWxpZGF0ZUxlYXJuaW5nVHJhbnNpdGlvbixcbn0gZnJvbSBcIi4vbGVhcm5pbmdcIjtcbmltcG9ydCB7IG92ZXJsYXBNaW51dGVzIGFzIG92ZXJsYXBNaW51dGVzT2ZCbG9jayB9IGZyb20gXCIuL2Jsb2Nrc1wiO1xuXG4vLyAtLS0tLS0tLS0tIFx1NTQ3RFx1NEVFNCAtLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIENvbW1hbmQgPVxuICB8IHsgb3A6IFwic2F2ZVByb2plY3RcIjsgcHJvamVjdDogUHJvamVjdFN0dWR5IH1cbiAgfCB7IG9wOiBcInNhdmVSZXNvdXJjZVwiOyByZXNvdXJjZTogUmVzb3VyY2UgfVxuICB8IHsgb3A6IFwic2F2ZVJlc291cmNlc1wiOyByZXNvdXJjZXM6IFJlc291cmNlW10gfVxuICB8IHsgb3A6IFwicmVtb3ZlUmVzb3VyY2VzXCI7IGlkczogc3RyaW5nW10gfVxuICB8IHsgb3A6IFwic2F2ZVNlbWVzdGVyXCI7IHNlbWVzdGVyOiBTZW1lc3RlciB9XG4gIHwgeyBvcDogXCJzYXZlTGVzc29uXCI7IGxlc3NvbjogTGVzc29uIH1cbiAgfCB7IG9wOiBcInNldExlc3NvblJlc291cmNlc1wiOyBpZDogc3RyaW5nOyByZXNvdXJjZUlkczogc3RyaW5nW10gfVxuICB8IHsgb3A6IFwiYXR0ZW5kTGVzc29uXCI7IGlkOiBzdHJpbmc7IHByb2dyZXNzOiBzdHJpbmcgfVxuICB8IHsgb3A6IFwicHVibGlzaEFzc2Vzc21lbnRcIjsgYXNzZXNzbWVudDogQXNzZXNzbWVudCB9XG4gIHwgeyBvcDogXCJjb25maXJtUHJpbnRlZFwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcInN0YXJ0RXhhbVwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcImVuZEV4YW1cIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyBvcDogXCJzdWJtaXRcIjsgc3VibWlzc2lvbjogU3VibWlzc2lvbiB9XG4gIHwgeyBvcDogXCJyZWNvcmRRdWVzdGlvblRpbWVzXCI7IGlkOiBzdHJpbmc7IHF1ZXN0aW9uVGltZXM6IFF1ZXN0aW9uVGltZVtdIH1cbiAgfCB7IG9wOiBcImdyYWRlXCI7IGdyYWRlOiBHcmFkZSB9XG4gIHwgeyBvcDogXCJzYXZlUmV2aWV3XCI7IHJldmlldzogUmV2aWV3IH1cbiAgfCB7IG9wOiBcImNsYWltRXZlbnRcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyBvcDogXCJmaW5pc2hFdmVudFwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcInJldHJ5RXZlbnRcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyBvcDogXCJyZWNvcmRQcm9ncmVzc1wiOyByZWNvcmQ6IFByb2dyZXNzUmVjb3JkIH1cbiAgfCB7IG9wOiBcImNvbmZpcm1Qcm9ncmVzc1wiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcInN1Ym1pdENvcnJlY3Rpb25cIjsgY29ycmVjdGlvbjogQ29ycmVjdGlvbiB9XG4gIHwgeyBvcDogXCJyZXZpZXdDb3JyZWN0aW9uXCI7IGlkOiBzdHJpbmc7IGFjY2VwdGVkOiBib29sZWFuOyBmZWVkYmFjazogc3RyaW5nIH07XG5cbmNvbnN0IENPTU1BTkRfS0VZUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBzYXZlUHJvamVjdDogW1wib3BcIiwgXCJwcm9qZWN0XCJdLFxuICBzYXZlUmVzb3VyY2U6IFtcIm9wXCIsIFwicmVzb3VyY2VcIl0sXG4gIHNhdmVSZXNvdXJjZXM6IFtcIm9wXCIsIFwicmVzb3VyY2VzXCJdLFxuICByZW1vdmVSZXNvdXJjZXM6IFtcIm9wXCIsIFwiaWRzXCJdLFxuICBzYXZlU2VtZXN0ZXI6IFtcIm9wXCIsIFwic2VtZXN0ZXJcIl0sXG4gIHNhdmVMZXNzb246IFtcIm9wXCIsIFwibGVzc29uXCJdLFxuICBzZXRMZXNzb25SZXNvdXJjZXM6IFtcIm9wXCIsIFwiaWRcIiwgXCJyZXNvdXJjZUlkc1wiXSxcbiAgYXR0ZW5kTGVzc29uOiBbXCJvcFwiLCBcImlkXCIsIFwicHJvZ3Jlc3NcIl0sXG4gIHB1Ymxpc2hBc3Nlc3NtZW50OiBbXCJvcFwiLCBcImFzc2Vzc21lbnRcIl0sXG4gIGNvbmZpcm1QcmludGVkOiBbXCJvcFwiLCBcImlkXCJdLFxuICBzdGFydEV4YW06IFtcIm9wXCIsIFwiaWRcIl0sXG4gIGVuZEV4YW06IFtcIm9wXCIsIFwiaWRcIl0sXG4gIHN1Ym1pdDogW1wib3BcIiwgXCJzdWJtaXNzaW9uXCJdLFxuICByZWNvcmRRdWVzdGlvblRpbWVzOiBbXCJvcFwiLCBcImlkXCIsIFwicXVlc3Rpb25UaW1lc1wiXSxcbiAgZ3JhZGU6IFtcIm9wXCIsIFwiZ3JhZGVcIl0sXG4gIHNhdmVSZXZpZXc6IFtcIm9wXCIsIFwicmV2aWV3XCJdLFxuICBjbGFpbUV2ZW50OiBbXCJvcFwiLCBcImlkXCJdLFxuICBmaW5pc2hFdmVudDogW1wib3BcIiwgXCJpZFwiXSxcbiAgcmV0cnlFdmVudDogW1wib3BcIiwgXCJpZFwiXSxcbiAgcmVjb3JkUHJvZ3Jlc3M6IFtcIm9wXCIsIFwicmVjb3JkXCJdLFxuICBjb25maXJtUHJvZ3Jlc3M6IFtcIm9wXCIsIFwiaWRcIl0sXG4gIHN1Ym1pdENvcnJlY3Rpb246IFtcIm9wXCIsIFwiY29ycmVjdGlvblwiXSxcbiAgcmV2aWV3Q29ycmVjdGlvbjogW1wib3BcIiwgXCJpZFwiLCBcImFjY2VwdGVkXCIsIFwiZmVlZGJhY2tcIl0sXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb21tYW5kKHJhdzogdW5rbm93bik6IENvbW1hbmQge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgY29uc3Qgb3AgPSBvbmVPZihcbiAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJvcFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTQgb3BcIixcbiAgICBPYmplY3Qua2V5cyhDT01NQU5EX0tFWVMpLFxuICApO1xuICByZWplY3RVbmtub3duKHJhdywgQ09NTUFORF9LRVlTW29wXSEsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIpO1xuICBzd2l0Y2ggKG9wKSB7XG4gICAgY2FzZSBcInNhdmVQcm9qZWN0XCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgcHJvamVjdDogcGFyc2VQcm9qZWN0U3R1ZHkoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlUmVzb3VyY2VcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICByZXNvdXJjZTogcGFyc2VSZXNvdXJjZShcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJyZXNvdXJjZVwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlUmVzb3VyY2VzXCI6IHtcbiAgICAgIGNvbnN0IGxpc3QgPSBhc0FycmF5KFxuICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJyZXNvdXJjZXNcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpLFxuICAgICAgICBcInJlc291cmNlc1wiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgbGlzdC5sZW5ndGggPiAwICYmIGxpc3QubGVuZ3RoIDw9IDUwMDAsXG4gICAgICAgIFwiXHU2Mjc5XHU5MUNGXHU3NjdCXHU4QkIwXHU5NzAwXHU4OTgxIDFcdTIwMTM1MDAwIFx1Njc2MVx1OEQ0NFx1NkU5MFwiLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB7IG9wLCByZXNvdXJjZXM6IGxpc3QubWFwKChpdGVtKSA9PiBwYXJzZVJlc291cmNlKGl0ZW0pKSB9O1xuICAgIH1cbiAgICBjYXNlIFwicmVtb3ZlUmVzb3VyY2VzXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgaWRzOiBhc0FycmF5KFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImlkc1wiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgICAgICAgXCJpZHNcIixcbiAgICAgICAgKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU4RDQ0XHU2RTkwIElEXCIpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNhdmVTZW1lc3RlclwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIHNlbWVzdGVyOiBwYXJzZVNlbWVzdGVyKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNlbWVzdGVyXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNhdmVMZXNzb25cIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBsZXNzb246IHBhcnNlTGVzc29uKHJlcXVpcmVkRmllbGQocmF3LCBcImxlc3NvblwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdikpLFxuICAgICAgfTtcbiAgICBjYXNlIFwic2V0TGVzc29uUmVzb3VyY2VzXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsIGFzU3RyKSxcbiAgICAgICAgcmVzb3VyY2VJZHM6IGFzQXJyYXkoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwicmVzb3VyY2VJZHNcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwicmVzb3VyY2VJZHNcIixcbiAgICAgICAgKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU4RDQ0XHU2RTkwIElEXCIpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcImF0dGVuZExlc3NvblwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCBhc1N0ciksXG4gICAgICAgIHByb2dyZXNzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9ncmVzc1wiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCBhc1N0ciksXG4gICAgICB9O1xuICAgIGNhc2UgXCJwdWJsaXNoQXNzZXNzbWVudFwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIGFzc2Vzc21lbnQ6IHBhcnNlQXNzZXNzbWVudChcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJhc3Nlc3NtZW50XCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcImNvbmZpcm1QcmludGVkXCI6XG4gICAgY2FzZSBcInN0YXJ0RXhhbVwiOlxuICAgIGNhc2UgXCJlbmRFeGFtXCI6XG4gICAgY2FzZSBcImNsYWltRXZlbnRcIjpcbiAgICBjYXNlIFwiZmluaXNoRXZlbnRcIjpcbiAgICBjYXNlIFwicmV0cnlFdmVudFwiOlxuICAgIGNhc2UgXCJjb25maXJtUHJvZ3Jlc3NcIjpcbiAgICAgIHJldHVybiB7IG9wLCBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgYXNTdHIpIH07XG4gICAgY2FzZSBcInN1Ym1pdFwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIHN1Ym1pc3Npb246IHBhcnNlU3VibWlzc2lvbihcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJzdWJtaXNzaW9uXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInJlY29yZFF1ZXN0aW9uVGltZXNcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgYXNTdHIpLFxuICAgICAgICBxdWVzdGlvblRpbWVzOiBhc0FycmF5KFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInF1ZXN0aW9uVGltZXNcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwicXVlc3Rpb25UaW1lc1wiLFxuICAgICAgICApLm1hcChwYXJzZVF1ZXN0aW9uVGltZSksXG4gICAgICB9O1xuICAgIGNhc2UgXCJncmFkZVwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIGdyYWRlOiBwYXJzZUdyYWRlKHJlcXVpcmVkRmllbGQocmF3LCBcImdyYWRlXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlUmV2aWV3XCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgcmV2aWV3OiBwYXJzZVJldmlldyhyZXF1aXJlZEZpZWxkKHJhdywgXCJyZXZpZXdcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInJlY29yZFByb2dyZXNzXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgcmVjb3JkOiBwYXJzZVByb2dyZXNzUmVjb3JkKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInJlY29yZFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzdWJtaXRDb3JyZWN0aW9uXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgY29ycmVjdGlvbjogcGFyc2VDb3JyZWN0aW9uKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImNvcnJlY3Rpb25cIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpLFxuICAgICAgICApLFxuICAgICAgfTtcbiAgICBjYXNlIFwicmV2aWV3Q29ycmVjdGlvblwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCBhc1N0ciksXG4gICAgICAgIGFjY2VwdGVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhY2NlcHRlZFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCBhc0Jvb2wpLFxuICAgICAgICBmZWVkYmFjazogcmVxdWlyZWRGaWVsZChyYXcsIFwiZmVlZGJhY2tcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgYXNTdHIpLFxuICAgICAgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKGBcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcdTUzRDZcdTUwM0NcdTY1RTBcdTY1NDhcdUZGMUEke29wfWApO1xuICB9XG59XG5cbi8qKiBcdTUyQTlcdTYyNEJcdTRFMTNcdTVDNUVcdTU0N0RcdTRFRTRcdUZGMUFcdThCRkVcdTdBMEJcdTMwMDFcdTRGNUNcdTRFMUFcdTMwMDFcdThCRDVcdTUzNzdcdTU0OENcdTYyNzlcdTY1MzlcdTUzRUFcdTgwRkRcdTc1MzFcdTVCNjZcdTRFNjBcdTUyQTlcdTYyNEJcdTc1MUZcdTYyMTBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3Npc3RhbnRPbmx5KGNvbW1hbmQ6IENvbW1hbmQpOiBib29sZWFuIHtcbiAgcmV0dXJuIFtcbiAgICBcInNhdmVTZW1lc3RlclwiLFxuICAgIFwic2F2ZUxlc3NvblwiLFxuICAgIFwicHVibGlzaEFzc2Vzc21lbnRcIixcbiAgICBcImdyYWRlXCIsXG4gICAgXCJyZWNvcmRRdWVzdGlvblRpbWVzXCIsXG4gICAgXCJzYXZlUmV2aWV3XCIsXG4gICAgXCJmaW5pc2hFdmVudFwiLFxuICAgIFwiY2xhaW1FdmVudFwiLFxuICAgIFwicmV2aWV3Q29ycmVjdGlvblwiLFxuICBdLmluY2x1ZGVzKGNvbW1hbmQub3ApO1xufVxuXG4vLyAtLS0tLS0tLS0tIFx1NUI5RVx1NEY1M1x1ODlFM1x1Njc5MC9cdTVFOEZcdTUyMTdcdTUzMTYgLS0tLS0tLS0tLVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9qZWN0U3R1ZHkocmF3OiB1bmtub3duKTogUHJvamVjdFN0dWR5IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1NTlcdTVCNjZcdTk4NzlcdTc2RUVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24oXG4gICAgcmF3LFxuICAgIFtcbiAgICAgIFwicHJvamVjdElkXCIsXG4gICAgICBcImRpcmVjdG9yeVwiLFxuICAgICAgXCJleGFtTW9kZVwiLFxuICAgICAgXCJ2aXNpb25JZFwiLFxuICAgICAgXCJ0YXJnZXRcIixcbiAgICAgIFwiZXhhbURhdGVcIixcbiAgICAgIFwic3lsbGFidXNJZFwiLFxuICAgICAgXCJwYXN0UGFwZXJJZHNcIixcbiAgICAgIFwibW9ja1BhcGVySWRzXCIsXG4gICAgXSxcbiAgICBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLFxuICApO1xuICByZXR1cm4ge1xuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBkaXJlY3Rvcnk6IHJlcXVpcmVkRmllbGQocmF3LCBcImRpcmVjdG9yeVwiLCBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLCBhc1N0ciksXG4gICAgZXhhbU1vZGU6IHJlcXVpcmVkRmllbGQocmF3LCBcImV4YW1Nb2RlXCIsIFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXCIsIGFzQm9vbCksXG4gICAgdmlzaW9uSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ2aXNpb25JZFwiLFxuICAgICAgXCJcdTY1NTlcdTVCNjZcdTk4NzlcdTc2RUVcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInZpc2lvbklkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHRhcmdldDogcmVxdWlyZWRGaWVsZChyYXcsIFwidGFyZ2V0XCIsIFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBleGFtRGF0ZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImV4YW1EYXRlXCIsXG4gICAgICBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZXhhbURhdGVcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgc3lsbGFidXNJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInN5bGxhYnVzSWRcIixcbiAgICAgIFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJzeWxsYWJ1c0lkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHBhc3RQYXBlcklkczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInBhc3RQYXBlcklkc1wiLFxuICAgICAgXCJcdTY1NTlcdTVCNjZcdTk4NzlcdTc2RUVcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwicGFzdFBhcGVySWRzXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdTc3MUZcdTk4OTggSURcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBtb2NrUGFwZXJJZHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJtb2NrUGFwZXJJZHNcIixcbiAgICAgIFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcIm1vY2tQYXBlcklkc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU2QTIxXHU2MkRGXHU5ODk4IElEXCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVQcm9qZWN0U3R1ZHkoXG4gIHA6IFByb2plY3RTdHVkeSxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBwcm9qZWN0SWQ6IHAucHJvamVjdElkLFxuICAgIGRpcmVjdG9yeTogcC5kaXJlY3RvcnksXG4gICAgZXhhbU1vZGU6IHAuZXhhbU1vZGUsXG4gICAgdmlzaW9uSWQ6IHAudmlzaW9uSWQsXG4gICAgdGFyZ2V0OiBwLnRhcmdldCxcbiAgICBleGFtRGF0ZTogcC5leGFtRGF0ZSxcbiAgICBzeWxsYWJ1c0lkOiBwLnN5bGxhYnVzSWQsXG4gICAgcGFzdFBhcGVySWRzOiBwLnBhc3RQYXBlcklkcyxcbiAgICBtb2NrUGFwZXJJZHM6IHAubW9ja1BhcGVySWRzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VSZXNvdXJjZShyYXc6IHVua25vd24pOiBSZXNvdXJjZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4RDQ0XHU2RTkwXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXCJpZFwiLCBcInByb2plY3RJZFwiLCBcInRpdGxlXCIsIFwia2luZFwiLCBcInBhdGhcIiwgXCJzb3VyY2VcIiwgXCJlZGl0aW9uXCIsIFwidG9waWNzXCJdLFxuICAgIFwiXHU4RDQ0XHU2RTkwXCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU4RDQ0XHU2RTkwXCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb2plY3RJZFwiLCBcIlx1OEQ0NFx1NkU5MFwiLCBhc1N0ciksXG4gICAgdGl0bGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpdGxlXCIsIFwiXHU4RDQ0XHU2RTkwXCIsIGFzU3RyKSxcbiAgICBraW5kOiBvbmVPZihcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImtpbmRcIiwgXCJcdThENDRcdTZFOTBcIiwgKHYpID0+IHYpLFxuICAgICAgXCJcdThENDRcdTZFOTAga2luZFwiLFxuICAgICAgW1xuICAgICAgICBcInN5bGxhYnVzXCIsXG4gICAgICAgIFwiY291cnNlXCIsXG4gICAgICAgIFwiYm9va1wiLFxuICAgICAgICBcInBhc3RQYXBlclwiLFxuICAgICAgICBcIm1vY2tQYXBlclwiLFxuICAgICAgICBcInJlZmVyZW5jZVwiLFxuICAgICAgICBcImF0dGFjaG1lbnRcIixcbiAgICAgICAgXCJhbnN3ZXJTaGVldFwiLFxuICAgICAgXSxcbiAgICApIGFzIFJlc291cmNlS2luZCxcbiAgICBwYXRoOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwYXRoXCIsIFwiXHU4RDQ0XHU2RTkwXCIsIGFzU3RyKSxcbiAgICBzb3VyY2U6IHJlcXVpcmVkRmllbGQocmF3LCBcInNvdXJjZVwiLCBcIlx1OEQ0NFx1NkU5MFwiLCBhc1N0ciksXG4gICAgZWRpdGlvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwiZWRpdGlvblwiLCBcIlx1OEQ0NFx1NkU5MFwiLCBhc1N0ciksXG4gICAgdG9waWNzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidG9waWNzXCIsXG4gICAgICBcIlx1OEQ0NFx1NkU5MFwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0b3BpY3NcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NzdFNVx1OEJDNlx1NzBCOVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUmVzb3VyY2UocjogUmVzb3VyY2UpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHIuaWQsXG4gICAgcHJvamVjdElkOiByLnByb2plY3RJZCxcbiAgICB0aXRsZTogci50aXRsZSxcbiAgICBraW5kOiByLmtpbmQsXG4gICAgcGF0aDogci5wYXRoLFxuICAgIHNvdXJjZTogci5zb3VyY2UsXG4gICAgZWRpdGlvbjogci5lZGl0aW9uLFxuICAgIHRvcGljczogci50b3BpY3MsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU1pbGVzdG9uZShyYXc6IHVua25vd24pOiBNaWxlc3RvbmUge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTYzNlx1NkJCNVx1OEZEQlx1NUVBNlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1wid2Vla1wiLCBcInRvcGljc1wiLCBcInJlc291cmNlSWRzXCIsIFwib2JqZWN0aXZlXCIsIFwibGVzc29uQ291bnRcIl0sXG4gICAgXCJcdTk2MzZcdTZCQjVcdThGREJcdTVFQTZcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICB3ZWVrOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ3ZWVrXCIsIFwiXHU5NjM2XHU2QkI1XHU4RkRCXHU1RUE2XCIsIGFzSW50KSxcbiAgICB0b3BpY3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0b3BpY3NcIixcbiAgICAgIFwiXHU5NjM2XHU2QkI1XHU4RkRCXHU1RUE2XCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInRvcGljc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU3N0U1XHU4QkM2XHU3MEI5XCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgcmVzb3VyY2VJZHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZXNvdXJjZUlkc1wiLFxuICAgICAgXCJcdTk2MzZcdTZCQjVcdThGREJcdTVFQTZcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwicmVzb3VyY2VJZHNcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1OEQ0NFx1NkU5MCBJRFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIG9iamVjdGl2ZTogcmVxdWlyZWRGaWVsZChyYXcsIFwib2JqZWN0aXZlXCIsIFwiXHU5NjM2XHU2QkI1XHU4RkRCXHU1RUE2XCIsIGFzU3RyKSxcbiAgICBsZXNzb25Db3VudDogcmVxdWlyZWRGaWVsZChyYXcsIFwibGVzc29uQ291bnRcIiwgXCJcdTk2MzZcdTZCQjVcdThGREJcdTVFQTZcIiwgYXNJbnQpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplTWlsZXN0b25lKG06IE1pbGVzdG9uZSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICB3ZWVrOiBtLndlZWssXG4gICAgdG9waWNzOiBtLnRvcGljcyxcbiAgICByZXNvdXJjZUlkczogbS5yZXNvdXJjZUlkcyxcbiAgICBvYmplY3RpdmU6IG0ub2JqZWN0aXZlLFxuICAgIGxlc3NvbkNvdW50OiBtLmxlc3NvbkNvdW50LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTZW1lc3RlcihyYXc6IHVua25vd24pOiBTZW1lc3RlciB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJ0aXRsZVwiLFxuICAgICAgXCJzdGFydERhdGVcIixcbiAgICAgIFwiZW5kRGF0ZVwiLFxuICAgICAgXCJyZXZpc2lvblwiLFxuICAgICAgXCJiYXNlbGluZVwiLFxuICAgICAgXCJldmlkZW5jZVwiLFxuICAgICAgXCJyYXRpb25hbGVcIixcbiAgICAgIFwibWlsZXN0b25lc1wiLFxuICAgIF0sXG4gICAgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcIiwgYXNTdHIpLFxuICAgIHN0YXJ0RGF0ZTogcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhcnREYXRlXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsIGFzU3RyKSxcbiAgICBlbmREYXRlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJlbmREYXRlXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsIGFzU3RyKSxcbiAgICByZXZpc2lvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwicmV2aXNpb25cIiwgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcIiwgYXNJbnQpLFxuICAgIGJhc2VsaW5lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJiYXNlbGluZVwiLCBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiLCBhc1N0ciksXG4gICAgZXZpZGVuY2U6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJldmlkZW5jZVwiLFxuICAgICAgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwiZXZpZGVuY2VcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NEY5RFx1NjM2RVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHJhdGlvbmFsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwicmF0aW9uYWxlXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsIGFzU3RyKSxcbiAgICBtaWxlc3RvbmVzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJtaWxlc3RvbmVzXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcIm1pbGVzdG9uZXNcIikubWFwKHBhcnNlTWlsZXN0b25lKSxcbiAgICApLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU2VtZXN0ZXIoczogU2VtZXN0ZXIpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHMuaWQsXG4gICAgcHJvamVjdElkOiBzLnByb2plY3RJZCxcbiAgICB0aXRsZTogcy50aXRsZSxcbiAgICBzdGFydERhdGU6IHMuc3RhcnREYXRlLFxuICAgIGVuZERhdGU6IHMuZW5kRGF0ZSxcbiAgICByZXZpc2lvbjogcy5yZXZpc2lvbixcbiAgICBiYXNlbGluZTogcy5iYXNlbGluZSxcbiAgICBldmlkZW5jZTogcy5ldmlkZW5jZSxcbiAgICByYXRpb25hbGU6IHMucmF0aW9uYWxlLFxuICAgIG1pbGVzdG9uZXM6IHMubWlsZXN0b25lcy5tYXAoc2VyaWFsaXplTWlsZXN0b25lKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGVzc29uKHJhdzogdW5rbm93bik6IExlc3NvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkZFXHU3QTBCXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJzZW1lc3RlcklkXCIsXG4gICAgICBcInNlbWVzdGVyUmV2aXNpb25cIixcbiAgICAgIFwidGl0bGVcIixcbiAgICAgIFwidG9waWNzXCIsXG4gICAgICBcInJlc291cmNlSWRzXCIsXG4gICAgICBcInN0YXJ0c0F0XCIsXG4gICAgICBcImVuZHNBdFwiLFxuICAgICAgXCJhaUVuYWJsZWRcIixcbiAgICAgIFwiYXR0ZW5kZWRcIixcbiAgICAgIFwicHJvZ3Jlc3NcIixcbiAgICAgIFwic3RhdGVcIixcbiAgICBdLFxuICAgIFwiXHU4QkZFXHU3QTBCXCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU4QkZFXHU3QTBCXCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb2plY3RJZFwiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc1N0ciksXG4gICAgc2VtZXN0ZXJJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwic2VtZXN0ZXJJZFwiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc1N0ciksXG4gICAgc2VtZXN0ZXJSZXZpc2lvbjogZmllbGQocmF3LCBcInNlbWVzdGVyUmV2aXNpb25cIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNJbnQsIDEpLFxuICAgIHRpdGxlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aXRsZVwiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc1N0ciksXG4gICAgdG9waWNzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidG9waWNzXCIsXG4gICAgICBcIlx1OEJGRVx1N0EwQlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0b3BpY3NcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NzdFNVx1OEJDNlx1NzBCOVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHJlc291cmNlSWRzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicmVzb3VyY2VJZHNcIixcbiAgICAgIFwiXHU4QkZFXHU3QTBCXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInJlc291cmNlSWRzXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdThENDRcdTZFOTAgSURcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBzdGFydHNBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhcnRzQXRcIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNJbnQpLFxuICAgIGVuZHNBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZW5kc0F0XCIsIFwiXHU4QkZFXHU3QTBCXCIsIGFzSW50KSxcbiAgICBhaUVuYWJsZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImFpRW5hYmxlZFwiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc0Jvb2wpLFxuICAgIGF0dGVuZGVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhdHRlbmRlZFwiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc0Jvb2wpLFxuICAgIHByb2dyZXNzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9ncmVzc1wiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc1N0ciksXG4gICAgc3RhdGU6IG9uZU9mKFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhdGVcIiwgXCJcdThCRkVcdTdBMEJcIiwgKHYpID0+IHYpLFxuICAgICAgXCJcdThCRkVcdTdBMEIgc3RhdGVcIixcbiAgICAgIFtcInBsYW5uZWRcIiwgXCJhY3RpdmVcIiwgXCJlbmRlZFwiLCBcIm1pc3NlZFwiXSxcbiAgICApIGFzIExlc3NvblN0YXRlLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplTGVzc29uKGw6IExlc3Nvbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogbC5pZCxcbiAgICBwcm9qZWN0SWQ6IGwucHJvamVjdElkLFxuICAgIHNlbWVzdGVySWQ6IGwuc2VtZXN0ZXJJZCxcbiAgICBzZW1lc3RlclJldmlzaW9uOiBsLnNlbWVzdGVyUmV2aXNpb24sXG4gICAgdGl0bGU6IGwudGl0bGUsXG4gICAgdG9waWNzOiBsLnRvcGljcyxcbiAgICByZXNvdXJjZUlkczogbC5yZXNvdXJjZUlkcyxcbiAgICBzdGFydHNBdDogbC5zdGFydHNBdCxcbiAgICBlbmRzQXQ6IGwuZW5kc0F0LFxuICAgIGFpRW5hYmxlZDogbC5haUVuYWJsZWQsXG4gICAgYXR0ZW5kZWQ6IGwuYXR0ZW5kZWQsXG4gICAgcHJvZ3Jlc3M6IGwucHJvZ3Jlc3MsXG4gICAgc3RhdGU6IGwuc3RhdGUsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVNjb3JpbmdQb2ludChyYXc6IHVua25vd24pOiBTY29yaW5nUG9pbnQge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJDNFx1NTIwNlx1NzBCOVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFtcImlkXCIsIFwiZGVzY3JpcHRpb25cIiwgXCJwb2ludHNcIl0sIFwiXHU4QkM0XHU1MjA2XHU3MEI5XCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1OEJDNFx1NTIwNlx1NzBCOVwiLCBhc1N0ciksXG4gICAgZGVzY3JpcHRpb246IHJlcXVpcmVkRmllbGQocmF3LCBcImRlc2NyaXB0aW9uXCIsIFwiXHU4QkM0XHU1MjA2XHU3MEI5XCIsIGFzU3RyKSxcbiAgICBwb2ludHM6IHJlcXVpcmVkRmllbGQocmF3LCBcInBvaW50c1wiLCBcIlx1OEJDNFx1NTIwNlx1NzBCOVwiLCBhc0ludCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVTY29yaW5nUG9pbnQoXG4gIHA6IFNjb3JpbmdQb2ludCxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHsgaWQ6IHAuaWQsIGRlc2NyaXB0aW9uOiBwLmRlc2NyaXB0aW9uLCBwb2ludHM6IHAucG9pbnRzIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVF1ZXN0aW9uKHJhdzogdW5rbm93bik6IFF1ZXN0aW9uIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk4OThcdTc2RUVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24oXG4gICAgcmF3LFxuICAgIFtcbiAgICAgIFwiaWRcIixcbiAgICAgIFwicHJvbXB0XCIsXG4gICAgICBcInRvcGljc1wiLFxuICAgICAgXCJzb3VyY2VJZHNcIixcbiAgICAgIFwiZXh0ZW5zaW9uXCIsXG4gICAgICBcImVzdGltYXRlZE1pbnV0ZXNcIixcbiAgICAgIFwiYW5zd2VyXCIsXG4gICAgICBcImFjY2VwdGFibGVBbHRlcm5hdGl2ZXNcIixcbiAgICAgIFwic2NvcmluZ1wiLFxuICAgIF0sXG4gICAgXCJcdTk4OThcdTc2RUVcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTk4OThcdTc2RUVcIiwgYXNTdHIpLFxuICAgIHByb21wdDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvbXB0XCIsIFwiXHU5ODk4XHU3NkVFXCIsIGFzU3RyKSxcbiAgICB0b3BpY3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0b3BpY3NcIixcbiAgICAgIFwiXHU5ODk4XHU3NkVFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInRvcGljc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU3N0U1XHU4QkM2XHU3MEI5XCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgc291cmNlSWRzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwic291cmNlSWRzXCIsXG4gICAgICBcIlx1OTg5OFx1NzZFRVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJzb3VyY2VJZHNcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1Njc2NVx1NkU5MCBJRFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIGV4dGVuc2lvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwiZXh0ZW5zaW9uXCIsIFwiXHU5ODk4XHU3NkVFXCIsIGFzQm9vbCksXG4gICAgZXN0aW1hdGVkTWludXRlczogcmVxdWlyZWRGaWVsZChyYXcsIFwiZXN0aW1hdGVkTWludXRlc1wiLCBcIlx1OTg5OFx1NzZFRVwiLCBhc0ludCksXG4gICAgYW5zd2VyOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhbnN3ZXJcIiwgXCJcdTk4OThcdTc2RUVcIiwgYXNTdHIpLFxuICAgIGFjY2VwdGFibGVBbHRlcm5hdGl2ZXM6IHJlcXVpcmVkRmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImFjY2VwdGFibGVBbHRlcm5hdGl2ZXNcIixcbiAgICAgIFwiXHU5ODk4XHU3NkVFXCIsXG4gICAgICBhc1N0cixcbiAgICApLFxuICAgIHNjb3Jpbmc6IHJlcXVpcmVkRmllbGQocmF3LCBcInNjb3JpbmdcIiwgXCJcdTk4OThcdTc2RUVcIiwgKHYpID0+XG4gICAgICBhc0FycmF5KHYsIFwic2NvcmluZ1wiKS5tYXAocGFyc2VTY29yaW5nUG9pbnQpLFxuICAgICksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVRdWVzdGlvbihxOiBRdWVzdGlvbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogcS5pZCxcbiAgICBwcm9tcHQ6IHEucHJvbXB0LFxuICAgIHRvcGljczogcS50b3BpY3MsXG4gICAgc291cmNlSWRzOiBxLnNvdXJjZUlkcyxcbiAgICBleHRlbnNpb246IHEuZXh0ZW5zaW9uLFxuICAgIGVzdGltYXRlZE1pbnV0ZXM6IHEuZXN0aW1hdGVkTWludXRlcyxcbiAgICBhbnN3ZXI6IHEuYW5zd2VyLFxuICAgIGFjY2VwdGFibGVBbHRlcm5hdGl2ZXM6IHEuYWNjZXB0YWJsZUFsdGVybmF0aXZlcyxcbiAgICBzY29yaW5nOiBxLnNjb3JpbmcubWFwKHNlcmlhbGl6ZVNjb3JpbmdQb2ludCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFzc2Vzc21lbnQocmF3OiB1bmtub3duKTogQXNzZXNzbWVudCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkQ1XHU5ODk4XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJzZW1lc3RlcklkXCIsXG4gICAgICBcInNlbWVzdGVyUmV2aXNpb25cIixcbiAgICAgIFwibGVzc29uSWRcIixcbiAgICAgIFwidGFza0lkXCIsXG4gICAgICBcInJldGVzdE9mR3JhZGVJZFwiLFxuICAgICAgXCJ0aXRsZVwiLFxuICAgICAgXCJraW5kXCIsXG4gICAgICBcInJldmlzaW9uXCIsXG4gICAgICBcInN0YXJ0c0F0XCIsXG4gICAgICBcImVuZHNBdFwiLFxuICAgICAgXCJpbnN0cnVjdGlvbnNcIixcbiAgICAgIFwicmV2aWV3RXZpZGVuY2VcIixcbiAgICAgIFwicXVlc3Rpb25zXCIsXG4gICAgICBcInB1Ymxpc2hlZEF0XCIsXG4gICAgICBcInByaW50ZWRBdFwiLFxuICAgICAgXCJzdGFydGVkQXRcIixcbiAgICAgIFwic3RvcHBlZEF0XCIsXG4gICAgXSxcbiAgICBcIlx1OEJENVx1OTg5OFwiLFxuICApO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1OEJENVx1OTg5OFwiLCBhc1N0ciksXG4gICAgcHJvamVjdElkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9qZWN0SWRcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNTdHIpLFxuICAgIHNlbWVzdGVySWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInNlbWVzdGVySWRcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNTdHIpLFxuICAgIHNlbWVzdGVyUmV2aXNpb246IGZpZWxkKHJhdywgXCJzZW1lc3RlclJldmlzaW9uXCIsIFwiXHU4QkQ1XHU5ODk4XCIsIGFzSW50LCAxKSxcbiAgICBsZXNzb25JZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImxlc3NvbklkXCIsXG4gICAgICBcIlx1OEJENVx1OTg5OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwibGVzc29uSWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgdGFza0lkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGFza0lkXCIsXG4gICAgICBcIlx1OEJENVx1OTg5OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwidGFza0lkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHJldGVzdE9mR3JhZGVJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJldGVzdE9mR3JhZGVJZFwiLFxuICAgICAgXCJcdThCRDVcdTk4OThcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInJldGVzdE9mR3JhZGVJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNTdHIpLFxuICAgIGtpbmQ6IG9uZU9mKFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwia2luZFwiLCBcIlx1OEJENVx1OTg5OFwiLCAodikgPT4gdiksXG4gICAgICBcIlx1OEJENVx1OTg5OCBraW5kXCIsXG4gICAgICBbXCJob21ld29ya1wiLCBcIndlZWtseUV4YW1cIiwgXCJtb2NrRXhhbVwiLCBcInJldGVzdFwiXSxcbiAgICApIGFzIEFzc2Vzc21lbnRLaW5kLFxuICAgIHJldmlzaW9uOiByZXF1aXJlZEZpZWxkKHJhdywgXCJyZXZpc2lvblwiLCBcIlx1OEJENVx1OTg5OFwiLCBhc0ludCksXG4gICAgc3RhcnRzQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInN0YXJ0c0F0XCIsIFwiXHU4QkQ1XHU5ODk4XCIsIGFzSW50KSxcbiAgICBlbmRzQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImVuZHNBdFwiLCBcIlx1OEJENVx1OTg5OFwiLCBhc0ludCksXG4gICAgaW5zdHJ1Y3Rpb25zOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpbnN0cnVjdGlvbnNcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNTdHIpLFxuICAgIHJldmlld0V2aWRlbmNlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJyZXZpZXdFdmlkZW5jZVwiLCBcIlx1OEJENVx1OTg5OFwiLCBhc1N0ciksXG4gICAgcXVlc3Rpb25zOiByZXF1aXJlZEZpZWxkKHJhdywgXCJxdWVzdGlvbnNcIiwgXCJcdThCRDVcdTk4OThcIiwgKHYpID0+XG4gICAgICBhc0FycmF5KHYsIFwicXVlc3Rpb25zXCIpLm1hcChwYXJzZVF1ZXN0aW9uKSxcbiAgICApLFxuICAgIHB1Ymxpc2hlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJwdWJsaXNoZWRBdFwiLCBcIlx1OEJENVx1OTg5OFwiLCBhc0ludCksXG4gICAgcHJpbnRlZEF0OiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicHJpbnRlZEF0XCIsXG4gICAgICBcIlx1OEJENVx1OTg5OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwicHJpbnRlZEF0XCIsIGFzSW50KSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICAgIHN0YXJ0ZWRBdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInN0YXJ0ZWRBdFwiLFxuICAgICAgXCJcdThCRDVcdTk4OThcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInN0YXJ0ZWRBdFwiLCBhc0ludCksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBzdG9wcGVkQXQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzdG9wcGVkQXRcIixcbiAgICAgIFwiXHU4QkQ1XHU5ODk4XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJzdG9wcGVkQXRcIiwgYXNJbnQpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIG51bWJlciB8IG51bGwsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVBc3Nlc3NtZW50KGE6IEFzc2Vzc21lbnQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGEuaWQsXG4gICAgcHJvamVjdElkOiBhLnByb2plY3RJZCxcbiAgICBzZW1lc3RlcklkOiBhLnNlbWVzdGVySWQsXG4gICAgc2VtZXN0ZXJSZXZpc2lvbjogYS5zZW1lc3RlclJldmlzaW9uLFxuICAgIGxlc3NvbklkOiBhLmxlc3NvbklkLFxuICAgIHRhc2tJZDogYS50YXNrSWQsXG4gICAgcmV0ZXN0T2ZHcmFkZUlkOiBhLnJldGVzdE9mR3JhZGVJZCxcbiAgICB0aXRsZTogYS50aXRsZSxcbiAgICBraW5kOiBhLmtpbmQsXG4gICAgcmV2aXNpb246IGEucmV2aXNpb24sXG4gICAgc3RhcnRzQXQ6IGEuc3RhcnRzQXQsXG4gICAgZW5kc0F0OiBhLmVuZHNBdCxcbiAgICBpbnN0cnVjdGlvbnM6IGEuaW5zdHJ1Y3Rpb25zLFxuICAgIHJldmlld0V2aWRlbmNlOiBhLnJldmlld0V2aWRlbmNlLFxuICAgIHF1ZXN0aW9uczogYS5xdWVzdGlvbnMubWFwKHNlcmlhbGl6ZVF1ZXN0aW9uKSxcbiAgICBwdWJsaXNoZWRBdDogYS5wdWJsaXNoZWRBdCxcbiAgICBwcmludGVkQXQ6IGEucHJpbnRlZEF0LFxuICAgIHN0YXJ0ZWRBdDogYS5zdGFydGVkQXQsXG4gICAgc3RvcHBlZEF0OiBhLnN0b3BwZWRBdCxcbiAgfTtcbn1cblxuLyoqIFx1OEJBMVx1NTIxMlx1NTMzQVx1OTVGNFx1NEY5Qlx1NjVGNlx1OTU3Rlx1RkYxQlx1NUI5RVx1OTY0NVx1NUYwMFx1ODAwM1x1OEQ3N1x1OEJBMVx1NjVGNlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4YW1EZWFkbGluZShhOiBBc3Nlc3NtZW50KTogbnVtYmVyIHtcbiAgcmV0dXJuIGEuc3RhcnRlZEF0ID09PSBudWxsXG4gICAgPyBhLmVuZHNBdFxuICAgIDogYS5zdGFydGVkQXQgKyAoYS5lbmRzQXQgLSBhLnN0YXJ0c0F0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU3VibWlzc2lvbihyYXc6IHVua25vd24pOiBTdWJtaXNzaW9uIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTYzRDBcdTRFQTRcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24oXG4gICAgcmF3LFxuICAgIFtcbiAgICAgIFwiaWRcIixcbiAgICAgIFwiYXNzZXNzbWVudElkXCIsXG4gICAgICBcInN1Ym1pdHRlZEF0XCIsXG4gICAgICBcInJlc291cmNlSWRzXCIsXG4gICAgICBcImFuc3dlcnNcIixcbiAgICAgIFwidW5maW5pc2hlZFwiLFxuICAgICAgXCJxdWVzdGlvblRpbWVzXCIsXG4gICAgXSxcbiAgICBcIlx1NjNEMFx1NEVBNFwiLFxuICApO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NjNEMFx1NEVBNFwiLCBhc1N0ciksXG4gICAgYXNzZXNzbWVudElkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhc3Nlc3NtZW50SWRcIiwgXCJcdTYzRDBcdTRFQTRcIiwgYXNTdHIpLFxuICAgIHN1Ym1pdHRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdWJtaXR0ZWRBdFwiLCBcIlx1NjNEMFx1NEVBNFwiLCBhc0ludCksXG4gICAgcmVzb3VyY2VJZHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZXNvdXJjZUlkc1wiLFxuICAgICAgXCJcdTYzRDBcdTRFQTRcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwicmVzb3VyY2VJZHNcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1OTY0NFx1NEVGNiBJRFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIGFuc3dlcnM6IHJlcXVpcmVkRmllbGQocmF3LCBcImFuc3dlcnNcIiwgXCJcdTYzRDBcdTRFQTRcIiwgYXNTdHIpLFxuICAgIHVuZmluaXNoZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInVuZmluaXNoZWRcIiwgXCJcdTYzRDBcdTRFQTRcIiwgYXNCb29sKSxcbiAgICBxdWVzdGlvblRpbWVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicXVlc3Rpb25UaW1lc1wiLFxuICAgICAgXCJcdTYzRDBcdTRFQTRcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwicXVlc3Rpb25UaW1lc1wiKS5tYXAocGFyc2VRdWVzdGlvblRpbWUpLFxuICAgICAgW10sXG4gICAgKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVN1Ym1pc3Npb24oczogU3VibWlzc2lvbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogcy5pZCxcbiAgICBhc3Nlc3NtZW50SWQ6IHMuYXNzZXNzbWVudElkLFxuICAgIHN1Ym1pdHRlZEF0OiBzLnN1Ym1pdHRlZEF0LFxuICAgIHJlc291cmNlSWRzOiBzLnJlc291cmNlSWRzLFxuICAgIGFuc3dlcnM6IHMuYW5zd2VycyxcbiAgICB1bmZpbmlzaGVkOiBzLnVuZmluaXNoZWQsXG4gICAgcXVlc3Rpb25UaW1lczogcy5xdWVzdGlvblRpbWVzLm1hcChzZXJpYWxpemVRdWVzdGlvblRpbWUpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VRdWVzdGlvblRpbWUocmF3OiB1bmtub3duKTogUXVlc3Rpb25UaW1lIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbXCJxdWVzdGlvbklkXCIsIFwibG9jYWxUaW1lXCJdLCBcIlx1NUI4Q1x1NjIxMFx1NjVGNlx1NTIzQlwiKTtcbiAgcmV0dXJuIHtcbiAgICBxdWVzdGlvbklkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJxdWVzdGlvbklkXCIsIFwiXHU1QjhDXHU2MjEwXHU2NUY2XHU1MjNCXCIsIGFzU3RyKSxcbiAgICBsb2NhbFRpbWU6IHJlcXVpcmVkRmllbGQocmF3LCBcImxvY2FsVGltZVwiLCBcIlx1NUI4Q1x1NjIxMFx1NjVGNlx1NTIzQlwiLCBhc1N0ciksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVRdWVzdGlvblRpbWUoXG4gIHQ6IFF1ZXN0aW9uVGltZSxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHsgcXVlc3Rpb25JZDogdC5xdWVzdGlvbklkLCBsb2NhbFRpbWU6IHQubG9jYWxUaW1lIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBvaW50QXdhcmQocmF3OiB1bmtub3duKTogUG9pbnRBd2FyZCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkM0XHU1MjA2XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgW1wicXVlc3Rpb25JZFwiLCBcInBvaW50SWRcIiwgXCJhd2FyZGVkXCIsIFwiZXZpZGVuY2VcIl0sIFwiXHU4QkM0XHU1MjA2XCIpO1xuICByZXR1cm4ge1xuICAgIHF1ZXN0aW9uSWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInF1ZXN0aW9uSWRcIiwgXCJcdThCQzRcdTUyMDZcIiwgYXNTdHIpLFxuICAgIHBvaW50SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInBvaW50SWRcIiwgXCJcdThCQzRcdTUyMDZcIiwgYXNTdHIpLFxuICAgIGF3YXJkZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImF3YXJkZWRcIiwgXCJcdThCQzRcdTUyMDZcIiwgYXNJbnQpLFxuICAgIGV2aWRlbmNlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJldmlkZW5jZVwiLCBcIlx1OEJDNFx1NTIwNlwiLCBhc1N0ciksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVQb2ludEF3YXJkKHA6IFBvaW50QXdhcmQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgcXVlc3Rpb25JZDogcC5xdWVzdGlvbklkLFxuICAgIHBvaW50SWQ6IHAucG9pbnRJZCxcbiAgICBhd2FyZGVkOiBwLmF3YXJkZWQsXG4gICAgZXZpZGVuY2U6IHAuZXZpZGVuY2UsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUVycm9yQW5hbHlzaXMocmF3OiB1bmtub3duKTogRXJyb3JBbmFseXNpcyB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcInF1ZXN0aW9uSWRcIixcbiAgICAgIFwiY2F1c2VcIixcbiAgICAgIFwiZXZpZGVuY2VcIixcbiAgICAgIFwiY29ycmVjdGlvblwiLFxuICAgICAgXCJuZXh0Q2hlY2tcIixcbiAgICAgIFwicmV0ZXN0RGF0ZVwiLFxuICAgICAgXCJjb25maXJtZWRcIixcbiAgICBdLFxuICAgIFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgcXVlc3Rpb25JZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicXVlc3Rpb25JZFwiLCBcIlx1OTUxOVx1NTZFMFx1NTIwNlx1Njc5MFwiLCBhc1N0ciksXG4gICAgY2F1c2U6IHJlcXVpcmVkRmllbGQocmF3LCBcImNhdXNlXCIsIFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXCIsIGFzU3RyKSxcbiAgICBldmlkZW5jZTogcmVxdWlyZWRGaWVsZChyYXcsIFwiZXZpZGVuY2VcIiwgXCJcdTk1MTlcdTU2RTBcdTUyMDZcdTY3OTBcIiwgYXNTdHIpLFxuICAgIGNvcnJlY3Rpb246IHJlcXVpcmVkRmllbGQocmF3LCBcImNvcnJlY3Rpb25cIiwgXCJcdTk1MTlcdTU2RTBcdTUyMDZcdTY3OTBcIiwgYXNTdHIpLFxuICAgIG5leHRDaGVjazogcmVxdWlyZWRGaWVsZChyYXcsIFwibmV4dENoZWNrXCIsIFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXCIsIGFzU3RyKSxcbiAgICByZXRlc3REYXRlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJyZXRlc3REYXRlXCIsIFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXCIsIGFzU3RyKSxcbiAgICBjb25maXJtZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImNvbmZpcm1lZFwiLCBcIlx1OTUxOVx1NTZFMFx1NTIwNlx1Njc5MFwiLCBhc0Jvb2wpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplRXJyb3JBbmFseXNpcyhcbiAgZTogRXJyb3JBbmFseXNpcyxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBxdWVzdGlvbklkOiBlLnF1ZXN0aW9uSWQsXG4gICAgY2F1c2U6IGUuY2F1c2UsXG4gICAgZXZpZGVuY2U6IGUuZXZpZGVuY2UsXG4gICAgY29ycmVjdGlvbjogZS5jb3JyZWN0aW9uLFxuICAgIG5leHRDaGVjazogZS5uZXh0Q2hlY2ssXG4gICAgcmV0ZXN0RGF0ZTogZS5yZXRlc3REYXRlLFxuICAgIGNvbmZpcm1lZDogZS5jb25maXJtZWQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUdyYWRlKHJhdzogdW5rbm93bik6IEdyYWRlIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTYyNzlcdTY1MzlcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24oXG4gICAgcmF3LFxuICAgIFtcbiAgICAgIFwiaWRcIixcbiAgICAgIFwic3VibWlzc2lvbklkXCIsXG4gICAgICBcImFzc2Vzc21lbnRSZXZpc2lvblwiLFxuICAgICAgXCJncmFkZWRBdFwiLFxuICAgICAgXCJhd2FyZHNcIixcbiAgICAgIFwiZXJyb3JzXCIsXG4gICAgICBcIm5lZWRzUmV2aWV3XCIsXG4gICAgICBcImZlZWRiYWNrXCIsXG4gICAgXSxcbiAgICBcIlx1NjI3OVx1NjUzOVwiLFxuICApO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NjI3OVx1NjUzOVwiLCBhc1N0ciksXG4gICAgc3VibWlzc2lvbklkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdWJtaXNzaW9uSWRcIiwgXCJcdTYyNzlcdTY1MzlcIiwgYXNTdHIpLFxuICAgIGFzc2Vzc21lbnRSZXZpc2lvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwiYXNzZXNzbWVudFJldmlzaW9uXCIsIFwiXHU2Mjc5XHU2NTM5XCIsIGFzSW50KSxcbiAgICBncmFkZWRBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZ3JhZGVkQXRcIiwgXCJcdTYyNzlcdTY1MzlcIiwgYXNJbnQpLFxuICAgIGF3YXJkczogcmVxdWlyZWRGaWVsZChyYXcsIFwiYXdhcmRzXCIsIFwiXHU2Mjc5XHU2NTM5XCIsICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcImF3YXJkc1wiKS5tYXAocGFyc2VQb2ludEF3YXJkKSxcbiAgICApLFxuICAgIGVycm9yczogcmVxdWlyZWRGaWVsZChyYXcsIFwiZXJyb3JzXCIsIFwiXHU2Mjc5XHU2NTM5XCIsICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcImVycm9yc1wiKS5tYXAocGFyc2VFcnJvckFuYWx5c2lzKSxcbiAgICApLFxuICAgIG5lZWRzUmV2aWV3OiByZXF1aXJlZEZpZWxkKHJhdywgXCJuZWVkc1Jldmlld1wiLCBcIlx1NjI3OVx1NjUzOVwiLCBhc0Jvb2wpLFxuICAgIGZlZWRiYWNrOiByZXF1aXJlZEZpZWxkKHJhdywgXCJmZWVkYmFja1wiLCBcIlx1NjI3OVx1NjUzOVwiLCBhc1N0ciksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVHcmFkZShnOiBHcmFkZSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogZy5pZCxcbiAgICBzdWJtaXNzaW9uSWQ6IGcuc3VibWlzc2lvbklkLFxuICAgIGFzc2Vzc21lbnRSZXZpc2lvbjogZy5hc3Nlc3NtZW50UmV2aXNpb24sXG4gICAgZ3JhZGVkQXQ6IGcuZ3JhZGVkQXQsXG4gICAgYXdhcmRzOiBnLmF3YXJkcy5tYXAoc2VyaWFsaXplUG9pbnRBd2FyZCksXG4gICAgZXJyb3JzOiBnLmVycm9ycy5tYXAoc2VyaWFsaXplRXJyb3JBbmFseXNpcyksXG4gICAgbmVlZHNSZXZpZXc6IGcubmVlZHNSZXZpZXcsXG4gICAgZmVlZGJhY2s6IGcuZmVlZGJhY2ssXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJldmlldyhyYXc6IHVua25vd24pOiBSZXZpZXcge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTkwRFx1NzZEOFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1wiaWRcIiwgXCJkYXRlXCIsIFwicHJvamVjdElkXCIsIFwiZ3JhZGVJZHNcIiwgXCJmaW5kaW5nc1wiLCBcImFjdGlvbnNcIl0sXG4gICAgXCJcdTU5MERcdTc2RDhcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTU5MERcdTc2RDhcIiwgYXNTdHIpLFxuICAgIGRhdGU6IHJlcXVpcmVkRmllbGQocmF3LCBcImRhdGVcIiwgXCJcdTU5MERcdTc2RDhcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU1OTBEXHU3NkQ4XCIsIGFzU3RyKSxcbiAgICBncmFkZUlkczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImdyYWRlSWRzXCIsXG4gICAgICBcIlx1NTkwRFx1NzZEOFwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJncmFkZUlkc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU2Mjc5XHU2NTM5IElEXCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgZmluZGluZ3M6IHJlcXVpcmVkRmllbGQocmF3LCBcImZpbmRpbmdzXCIsIFwiXHU1OTBEXHU3NkQ4XCIsIGFzU3RyKSxcbiAgICBhY3Rpb25zOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiYWN0aW9uc1wiLFxuICAgICAgXCJcdTU5MERcdTc2RDhcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwiYWN0aW9uc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU4ODRDXHU1MkE4XCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVSZXZpZXcocjogUmV2aWV3KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiByLmlkLFxuICAgIGRhdGU6IHIuZGF0ZSxcbiAgICBwcm9qZWN0SWQ6IHIucHJvamVjdElkLFxuICAgIGdyYWRlSWRzOiByLmdyYWRlSWRzLFxuICAgIGZpbmRpbmdzOiByLmZpbmRpbmdzLFxuICAgIGFjdGlvbnM6IHIuYWN0aW9ucyxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVhY2hpbmdFdmVudChyYXc6IHVua25vd24pOiBUZWFjaGluZ0V2ZW50IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24oXG4gICAgcmF3LFxuICAgIFtcImlkXCIsIFwicHJvamVjdElkXCIsIFwia2luZFwiLCBcInNvdXJjZUlkXCIsIFwic3RhdGVcIiwgXCJjcmVhdGVkQXRcIl0sXG4gICAgXCJcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XCIsIGFzU3RyKSxcbiAgICBraW5kOiByZXF1aXJlZEZpZWxkKHJhdywgXCJraW5kXCIsIFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XCIsIGFzU3RyKSxcbiAgICBzb3VyY2VJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwic291cmNlSWRcIiwgXCJcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcIiwgYXNTdHIpLFxuICAgIHN0YXRlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdGF0ZVwiLCBcIlx1NjU1OVx1NUI2Nlx1NEU4Qlx1NEVGNlwiLCBhc1N0ciksXG4gICAgY3JlYXRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJjcmVhdGVkQXRcIiwgXCJcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcIiwgYXNJbnQpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplVGVhY2hpbmdFdmVudChcbiAgZTogVGVhY2hpbmdFdmVudCxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogZS5pZCxcbiAgICBwcm9qZWN0SWQ6IGUucHJvamVjdElkLFxuICAgIGtpbmQ6IGUua2luZCxcbiAgICBzb3VyY2VJZDogZS5zb3VyY2VJZCxcbiAgICBzdGF0ZTogZS5zdGF0ZSxcbiAgICBjcmVhdGVkQXQ6IGUuY3JlYXRlZEF0LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9ncmVzc1JlY29yZChyYXc6IHVua25vd24pOiBQcm9ncmVzc1JlY29yZCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJ0b3BpY1wiLFxuICAgICAgXCJwb3NpdGlvblwiLFxuICAgICAgXCJzdGF0ZVwiLFxuICAgICAgXCJldmlkZW5jZVwiLFxuICAgICAgXCJuZXh0QWN0aW9uXCIsXG4gICAgICBcInNvdXJjZVwiLFxuICAgICAgXCJjb25maXJtZWRcIixcbiAgICAgIFwicmVjb3JkZWRBdFwiLFxuICAgIF0sXG4gICAgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XCIsIGFzU3RyKSxcbiAgICB0b3BpYzogcmVxdWlyZWRGaWVsZChyYXcsIFwidG9waWNcIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgYXNTdHIpLFxuICAgIHBvc2l0aW9uOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwb3NpdGlvblwiLCBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgc3RhdGU6IG9uZU9mKFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhdGVcIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgKHYpID0+IHYpLFxuICAgICAgXCJcdThGREJcdTVFQTYgc3RhdGVcIixcbiAgICAgIFtcInN0dWRpZWRcIiwgXCJwcmFjdGljaW5nXCIsIFwibmVlZHNSZXZpZXdcIl0sXG4gICAgKSBhcyBQcm9ncmVzc1JlY29yZFtcInN0YXRlXCJdLFxuICAgIGV2aWRlbmNlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJldmlkZW5jZVwiLCBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgbmV4dEFjdGlvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwibmV4dEFjdGlvblwiLCBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgc291cmNlOiBvbmVPZihcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNvdXJjZVwiLCBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVwiLCAodikgPT4gdiksXG4gICAgICBcIlx1OEZEQlx1NUVBNiBzb3VyY2VcIixcbiAgICAgIFtcInVzZXJcIiwgXCJhc3Npc3RhbnRcIl0sXG4gICAgKSBhcyBQcm9ncmVzc1NvdXJjZSxcbiAgICBjb25maXJtZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImNvbmZpcm1lZFwiLCBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVwiLCBhc0Jvb2wpLFxuICAgIHJlY29yZGVkQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInJlY29yZGVkQXRcIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgYXNJbnQpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUHJvZ3Jlc3NSZWNvcmQoXG4gIHI6IFByb2dyZXNzUmVjb3JkLFxuKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiByLmlkLFxuICAgIHByb2plY3RJZDogci5wcm9qZWN0SWQsXG4gICAgdG9waWM6IHIudG9waWMsXG4gICAgcG9zaXRpb246IHIucG9zaXRpb24sXG4gICAgc3RhdGU6IHIuc3RhdGUsXG4gICAgZXZpZGVuY2U6IHIuZXZpZGVuY2UsXG4gICAgbmV4dEFjdGlvbjogci5uZXh0QWN0aW9uLFxuICAgIHNvdXJjZTogci5zb3VyY2UsXG4gICAgY29uZmlybWVkOiByLmNvbmZpcm1lZCxcbiAgICByZWNvcmRlZEF0OiByLnJlY29yZGVkQXQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNvcnJlY3Rpb24ocmF3OiB1bmtub3duKTogQ29ycmVjdGlvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkEyXHU2QjYzXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcImdyYWRlSWRcIixcbiAgICAgIFwicXVlc3Rpb25JZFwiLFxuICAgICAgXCJleHBsYW5hdGlvblwiLFxuICAgICAgXCJyZXNvdXJjZUlkc1wiLFxuICAgICAgXCJzdWJtaXR0ZWRBdFwiLFxuICAgICAgXCJhY2NlcHRlZFwiLFxuICAgICAgXCJmZWVkYmFja1wiLFxuICAgICAgXCJyZXZpZXdlZEF0XCIsXG4gICAgXSxcbiAgICBcIlx1OEJBMlx1NkI2M1wiLFxuICApO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1OEJBMlx1NkI2M1wiLCBhc1N0ciksXG4gICAgZ3JhZGVJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZ3JhZGVJZFwiLCBcIlx1OEJBMlx1NkI2M1wiLCBhc1N0ciksXG4gICAgcXVlc3Rpb25JZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicXVlc3Rpb25JZFwiLCBcIlx1OEJBMlx1NkI2M1wiLCBhc1N0ciksXG4gICAgZXhwbGFuYXRpb246IHJlcXVpcmVkRmllbGQocmF3LCBcImV4cGxhbmF0aW9uXCIsIFwiXHU4QkEyXHU2QjYzXCIsIGFzU3RyKSxcbiAgICByZXNvdXJjZUlkczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJlc291cmNlSWRzXCIsXG4gICAgICBcIlx1OEJBMlx1NkI2M1wiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJyZXNvdXJjZUlkc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU5NjQ0XHU0RUY2IElEXCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgc3VibWl0dGVkQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInN1Ym1pdHRlZEF0XCIsIFwiXHU4QkEyXHU2QjYzXCIsIGFzSW50KSxcbiAgICBhY2NlcHRlZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImFjY2VwdGVkXCIsXG4gICAgICBcIlx1OEJBMlx1NkI2M1wiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiYWNjZXB0ZWRcIiwgYXNCb29sKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBib29sZWFuIHwgbnVsbCxcbiAgICBmZWVkYmFjazogZmllbGQocmF3LCBcImZlZWRiYWNrXCIsIFwiXHU4QkEyXHU2QjYzXCIsIGFzU3RyLCBcIlwiKSxcbiAgICByZXZpZXdlZEF0OiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicmV2aWV3ZWRBdFwiLFxuICAgICAgXCJcdThCQTJcdTZCNjNcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInJldmlld2VkQXRcIiwgYXNJbnQpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIG51bWJlciB8IG51bGwsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVDb3JyZWN0aW9uKGM6IENvcnJlY3Rpb24pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGMuaWQsXG4gICAgZ3JhZGVJZDogYy5ncmFkZUlkLFxuICAgIHF1ZXN0aW9uSWQ6IGMucXVlc3Rpb25JZCxcbiAgICBleHBsYW5hdGlvbjogYy5leHBsYW5hdGlvbixcbiAgICByZXNvdXJjZUlkczogYy5yZXNvdXJjZUlkcyxcbiAgICBzdWJtaXR0ZWRBdDogYy5zdWJtaXR0ZWRBdCxcbiAgICBhY2NlcHRlZDogYy5hY2NlcHRlZCxcbiAgICBmZWVkYmFjazogYy5mZWVkYmFjayxcbiAgICByZXZpZXdlZEF0OiBjLnJldmlld2VkQXQsXG4gIH07XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU2ODIxXHU5QThDXHU4Rjg1XHU1MkE5IC0tLS0tLS0tLS1cblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrVGV4dChzOiBzdHJpbmcsIG1heDogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBzLnRyaW0oKS5sZW5ndGggPiAwICYmIEFycmF5LmZyb20ocykubGVuZ3RoIDw9IG1heDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkRWR1Y2F0aW9uRGF0ZShzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHMubGVuZ3RoID09PSAxMCAmJiB2YWxpZERhdGUocyk7XG59XG5cbi8qKiBcdTVCODlcdTUxNjhcdTc2ODRcdTk4NzlcdTc2RUVcdTUxODVcdTc2RjhcdTVCRjlcdThERUZcdTVGODRcdUZGMUFcdTk3NUVcdTdBN0FcdTMwMDFcdTY1RTBcdTUzQ0RcdTY1OUNcdTY3NjBcdTMwMDFcdTk3NUVcdTdFRERcdTVCRjlcdTMwMDFcdTY1RTAgYC4uYC9gLmAgXHU2QkI1XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gaXNSZWxhdGl2ZVBhdGgocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCB8fCBwYXRoLmluY2x1ZGVzKFwiXFxcXFwiKSB8fCBpc0Fic29sdXRlUGF0aChwYXRoKSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHN0cmlwcGVkID0gcGF0aC5yZXBsYWNlKC9cXC8rJC8sIFwiXCIpO1xuICBpZiAoc3RyaXBwZWQubGVuZ3RoID09PSAwKSByZXR1cm4gcGF0aC5sZW5ndGggPiAwICYmIGZhbHNlO1xuICByZXR1cm4gc3RyaXBwZWRcbiAgICAuc3BsaXQoXCIvXCIpXG4gICAgLmV2ZXJ5KChzZWcpID0+IHNlZyAhPT0gXCIuXCIgJiYgc2VnICE9PSBcIi4uXCIgJiYgc2VnICE9PSBcIlwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQWJzb2x1dGVQYXRoKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gL14oXFwvfFtBLVphLXpdOltcXFxcL118XFxcXFxcXFwpLy50ZXN0KHBhdGgpO1xufVxuXG4vLyAtLS0tLS0tLS0tIEVkdWNhdGlvbiBcdTY1NzBcdTYzNkVcdTdDN0IgLS0tLS0tLS0tLVxuXG5leHBvcnQgaW50ZXJmYWNlIEVkdWNhdGlvbkRhdGEge1xuICBmb2N1c1Rhc2tzOiBpbXBvcnQoXCIuL21vZGVsXCIpLlRlYWNoaW5nVGFza1tdO1xuICBwcm9qZWN0czogUHJvamVjdFN0dWR5W107XG4gIHJlc291cmNlczogUmVzb3VyY2VbXTtcbiAgc2VtZXN0ZXJzOiBTZW1lc3RlcltdO1xuICBzZW1lc3Rlckhpc3Rvcnk6IFNlbWVzdGVyW107XG4gIGxlc3NvbnM6IExlc3NvbltdO1xuICBhc3Nlc3NtZW50czogQXNzZXNzbWVudFtdO1xuICBzdWJtaXNzaW9uczogU3VibWlzc2lvbltdO1xuICBncmFkZXM6IEdyYWRlW107XG4gIHJldmlld3M6IFJldmlld1tdO1xuICBldmVudHM6IFRlYWNoaW5nRXZlbnRbXTtcbiAgY29tcGxldGVkVGFza3M6IENvbXBsZXRlZFN0dWR5VGFza1tdO1xuICBwcm9ncmVzczogUHJvZ3Jlc3NSZWNvcmRbXTtcbiAgY29ycmVjdGlvbnM6IENvcnJlY3Rpb25bXTtcbn1cblxuZXhwb3J0IGNsYXNzIEVkdWNhdGlvbiBpbXBsZW1lbnRzIEVkdWNhdGlvbkRhdGEge1xuICBmb2N1c1Rhc2tzOiBpbXBvcnQoXCIuL21vZGVsXCIpLlRlYWNoaW5nVGFza1tdID0gW107XG4gIHByb2plY3RzOiBQcm9qZWN0U3R1ZHlbXSA9IFtdO1xuICByZXNvdXJjZXM6IFJlc291cmNlW10gPSBbXTtcbiAgc2VtZXN0ZXJzOiBTZW1lc3RlcltdID0gW107XG4gIHNlbWVzdGVySGlzdG9yeTogU2VtZXN0ZXJbXSA9IFtdO1xuICBsZXNzb25zOiBMZXNzb25bXSA9IFtdO1xuICBhc3Nlc3NtZW50czogQXNzZXNzbWVudFtdID0gW107XG4gIHN1Ym1pc3Npb25zOiBTdWJtaXNzaW9uW10gPSBbXTtcbiAgZ3JhZGVzOiBHcmFkZVtdID0gW107XG4gIHJldmlld3M6IFJldmlld1tdID0gW107XG4gIGV2ZW50czogVGVhY2hpbmdFdmVudFtdID0gW107XG4gIGNvbXBsZXRlZFRhc2tzOiBDb21wbGV0ZWRTdHVkeVRhc2tbXSA9IFtdO1xuICBwcm9ncmVzczogUHJvZ3Jlc3NSZWNvcmRbXSA9IFtdO1xuICBjb3JyZWN0aW9uczogQ29ycmVjdGlvbltdID0gW107XG5cbiAgLyoqIFx1NkJDRlx1NkIyMVx1NjI2Qlx1NjNDRlx1NjIxNlx1NTNEOFx1NjZGNFx1NjVGNlx1OTFDRFx1NUVGQVx1RkYxQVx1NTQyQlx1NTA1Q1x1NzUyOFx1OTE0RFx1N0Y2RVx1NEUwRVx1NUY1Mlx1Njg2M1x1OEJBMVx1NTIxMlx1MzAwMiAqL1xuICByZXNvdXJjZVJlZmVyZW5jZUluZGV4KCk6IE1hcDxzdHJpbmcsIHN0cmluZ1tdPiB7XG4gICAgY29uc3QgcmVmcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcbiAgICBjb25zdCBhZGQgPSAoaWRzOiBzdHJpbmdbXSwgbGFiZWw6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgZm9yIChjb25zdCBpZCBvZiBuZXcgU2V0KGlkcykpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHJlZnMuZ2V0KGlkKSA/PyBbXTtcbiAgICAgICAgbGlzdC5wdXNoKGxhYmVsKTtcbiAgICAgICAgcmVmcy5zZXQoaWQsIGxpc3QpO1xuICAgICAgfVxuICAgIH07XG4gICAgZm9yIChjb25zdCBwIG9mIHRoaXMucHJvamVjdHMpIHtcbiAgICAgIGFkZChcbiAgICAgICAgW3Auc3lsbGFidXNJZCwgLi4ucC5wYXN0UGFwZXJJZHMsIC4uLnAubW9ja1BhcGVySWRzXS5maWx0ZXIoXG4gICAgICAgICAgKHgpOiB4IGlzIHN0cmluZyA9PiB4ICE9PSBudWxsLFxuICAgICAgICApLFxuICAgICAgICBcIlx1OTg3OVx1NzZFRVx1NjU1OVx1NUI2Nlx1OTE0RFx1N0Y2RVwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBzIG9mIFsuLi50aGlzLnNlbWVzdGVycywgLi4udGhpcy5zZW1lc3Rlckhpc3RvcnldKSB7XG4gICAgICBmb3IgKGNvbnN0IG0gb2Ygcy5taWxlc3RvbmVzKSB7XG4gICAgICAgIGFkZChtLnJlc291cmNlSWRzLCBgJHtzLnRpdGxlfSB2JHtzLnJldmlzaW9ufSBcdTdCMkMke20ud2Vla31cdTU0NjhgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBsIG9mIHRoaXMubGVzc29ucykge1xuICAgICAgYWRkKGwucmVzb3VyY2VJZHMsIGBcdThCRkVcdTdBMEJcdUZGMUEke2wudGl0bGV9YCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYSBvZiB0aGlzLmFzc2Vzc21lbnRzKSB7XG4gICAgICBmb3IgKGNvbnN0IHEgb2YgYS5xdWVzdGlvbnMpIHtcbiAgICAgICAgYWRkKHEuc291cmNlSWRzLCBgJHthLnRpdGxlfSAvICR7cS5pZH1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBzIG9mIHRoaXMuc3VibWlzc2lvbnMpIHtcbiAgICAgIGFkZChzLnJlc291cmNlSWRzLCBgXHU3QjU0XHU1Mzc3XHVGRjFBJHtzLmlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGMgb2YgdGhpcy5jb3JyZWN0aW9ucykge1xuICAgICAgYWRkKGMucmVzb3VyY2VJZHMsIGBcdThCQTJcdTZCNjNcdUZGMUEke2MuaWR9YCk7XG4gICAgfVxuICAgIHJldHVybiByZWZzO1xuICB9XG5cbiAgcmVzb3VyY2VSZWZlcmVuY2VzKGlkOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMucmVzb3VyY2VSZWZlcmVuY2VJbmRleCgpLmdldChpZCkgPz8gW107XG4gIH1cblxuICBldmVudChwcm9qZWN0OiBzdHJpbmcsIGtpbmQ6IHN0cmluZywgc291cmNlOiBzdHJpbmcsIGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBldmVudElkID0gYCR7a2luZH06JHtzb3VyY2V9YDtcbiAgICBpZiAoIXRoaXMuZXZlbnRzLnNvbWUoKGUpID0+IGUuaWQgPT09IGV2ZW50SWQpKSB7XG4gICAgICB0aGlzLmV2ZW50cy5wdXNoKHtcbiAgICAgICAgaWQ6IGV2ZW50SWQsXG4gICAgICAgIHByb2plY3RJZDogcHJvamVjdCxcbiAgICAgICAga2luZCxcbiAgICAgICAgc291cmNlSWQ6IHNvdXJjZSxcbiAgICAgICAgc3RhdGU6IFwicGVuZGluZ1wiLFxuICAgICAgICBjcmVhdGVkQXQ6IGF0LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgdGFza0NvbXBsZXRlZCh0YXNrOiBUYXNrLCBhdDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgcmVjb3JkID0gY29tcGxldGVkU3R1ZHlUYXNrRnJvbVRhc2sodGFzaywgYXQpO1xuICAgIGlmIChyZWNvcmQgPT09IG51bGwpIHJldHVybjtcbiAgICBpZiAoXG4gICAgICB0aGlzLnByb2plY3RzLnNvbWUoXG4gICAgICAgIChwKSA9PiBwLnByb2plY3RJZCA9PT0gcmVjb3JkLnByb2plY3RJZCAmJiBwLmV4YW1Nb2RlLFxuICAgICAgKSAmJlxuICAgICAgIXRoaXMuY29tcGxldGVkVGFza3Muc29tZSgodCkgPT4gdC5pZCA9PT0gcmVjb3JkLmlkKVxuICAgICkge1xuICAgICAgY29uc3QgbGluayA9IHRoaXMuZm9jdXNUYXNrcy5maW5kKChsKSA9PiBsLnRhc2tJZCA9PT0gcmVjb3JkLmlkKTtcbiAgICAgIGlmIChsaW5rICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgbGVzc29uID0gdGhpcy5sZXNzb25zLmZpbmQoKGwpID0+IGwuaWQgPT09IGxpbmsuc291cmNlSWQpO1xuICAgICAgICBpZiAobGVzc29uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZWNvcmQudG9waWNzID0gWy4uLmxlc3Nvbi50b3BpY3NdO1xuICAgICAgICAgIHJlY29yZC5ub3RlcyA9IGxlc3Nvbi5wcm9ncmVzcztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ldmVudChyZWNvcmQucHJvamVjdElkLCBcInRhc2tIb21ld29ya1wiLCByZWNvcmQuaWQsIGF0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY29tcGxldGVkVGFza3MucHVzaChyZWNvcmQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBcdThCRkVcdTdBMEIvXHU4MDAzXHU4QkQ1XHU1MjMwXHU3MEI5XHU2M0E4XHU4RkRCXHUzMDAxXHU2MzAxXHU0RTQ1XHU1MzE2XHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XHUzMDAyICovXG4gIHRpY2soYXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgY29uc3QgZXZlbnRzOiB7IHByb2plY3Q6IHN0cmluZzsga2luZDogc3RyaW5nOyBzb3VyY2U6IHN0cmluZyB9W10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGxlc3NvbiBvZiB0aGlzLmxlc3NvbnMpIHtcbiAgICAgIGlmIChcbiAgICAgICAgKGxlc3Nvbi5zdGF0ZSA9PT0gXCJwbGFubmVkXCIgfHwgbGVzc29uLnN0YXRlID09PSBcImFjdGl2ZVwiKSAmJlxuICAgICAgICBhdCA+PSBsZXNzb24uZW5kc0F0XG4gICAgICApIHtcbiAgICAgICAgbGVzc29uLnN0YXRlID0gbGVzc29uLmF0dGVuZGVkID8gXCJlbmRlZFwiIDogXCJtaXNzZWRcIjtcbiAgICAgICAgaWYgKGxlc3Nvbi5haUVuYWJsZWQgJiYgbGVzc29uLmF0dGVuZGVkKSB7XG4gICAgICAgICAgZXZlbnRzLnB1c2goe1xuICAgICAgICAgICAgcHJvamVjdDogbGVzc29uLnByb2plY3RJZCxcbiAgICAgICAgICAgIGtpbmQ6IFwiaG9tZXdvcmtcIixcbiAgICAgICAgICAgIHNvdXJjZTogbGVzc29uLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChsZXNzb24uc3RhdGUgPT09IFwicGxhbm5lZFwiICYmIGF0ID49IGxlc3Nvbi5zdGFydHNBdCkge1xuICAgICAgICBsZXNzb24uc3RhdGUgPSBcImFjdGl2ZVwiO1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBhIG9mIHRoaXMuYXNzZXNzbWVudHMpIHtcbiAgICAgIGlmIChcbiAgICAgICAgKGEua2luZCA9PT0gXCJob21ld29ya1wiIHx8IGEuc3RhcnRlZEF0ICE9PSBudWxsKSAmJlxuICAgICAgICBhLnN0b3BwZWRBdCA9PT0gbnVsbCAmJlxuICAgICAgICBhdCA+PSBleGFtRGVhZGxpbmUoYSlcbiAgICAgICkge1xuICAgICAgICBhLnN0b3BwZWRBdCA9IGV4YW1EZWFkbGluZShhKTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgeyBwcm9qZWN0LCBraW5kLCBzb3VyY2UgfSBvZiBldmVudHMpIHtcbiAgICAgIHRoaXMuZXZlbnQocHJvamVjdCwga2luZCwgc291cmNlLCBhdCk7XG4gICAgfVxuICAgIC8vIFx1NkJDRlx1NjVFNVx1NTkwRFx1NzZEOFx1NjMwMVx1NEU0NVx1RkYxQVx1NTMwNVx1NjJFQyAwODozMCBcdTVFOTRcdTc1MjhcdTY3MkFcdTVGMDBcdTc2ODRcdTY1RTVcdTY3MUZcdTMwMDJcbiAgICBjb25zdCBncmFkZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IGcgb2YgdGhpcy5ncmFkZXMpIHtcbiAgICAgIGNvbnN0IG5vd01pbnV0ZXMgPSBtaW51dGVzT2YoaG91ck1pbnV0ZU5vdyhhdCkpID8/IC0xO1xuICAgICAgaWYgKGRhdGVBdChnLmdyYWRlZEF0KSA8IGRhdGVBdChhdCkgJiYgbm93TWludXRlcyA+PSA1MTApIHtcbiAgICAgICAgY29uc3Qgc3ViID0gdGhpcy5zdWJtaXNzaW9ucy5maW5kKChzKSA9PiBzLmlkID09PSBnLnN1Ym1pc3Npb25JZCk7XG4gICAgICAgIGlmIChzdWIgPT09IHVuZGVmaW5lZCkgY29udGludWU7XG4gICAgICAgIGNvbnN0IGEgPSB0aGlzLmFzc2Vzc21lbnRzLmZpbmQoKHgpID0+IHguaWQgPT09IHN1Yi5hc3Nlc3NtZW50SWQpO1xuICAgICAgICBpZiAoYSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcbiAgICAgICAgZ3JhZGVzLmFkZChgJHthLnByb2plY3RJZH18JHtkYXRlQXQoZy5ncmFkZWRBdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFpciBvZiBncmFkZXMpIHtcbiAgICAgIGNvbnN0IFtwLCBkXSA9IHBhaXIuc3BsaXQoXCJ8XCIpO1xuICAgICAgY29uc3QgbiA9IHRoaXMuZXZlbnRzLmxlbmd0aDtcbiAgICAgIHRoaXMuZXZlbnQocCEsIFwicmV2aWV3XCIsIGAke3B9OiR7ZH1gLCBhdCk7XG4gICAgICBpZiAodGhpcy5ldmVudHMubGVuZ3RoICE9PSBuKSBjaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gXHU1NDY4XHU0RTk0XHU4RDc3XHVGRjA4XHU1NDJCXHU1NDY4XHU2NzJCXHVGRjA5XHU0RTNBXHU0RUNEXHU1NzI4XHU4RkRCXHU4ODRDXHU0RTJEXHU3Njg0XHU1RTk0XHU4QkQ1XHU1QjY2XHU2NzFGXHU3NjdCXHU4QkIwXHU1NDY4XHU4MDAzXHU0RThCXHU0RUY2XHUzMDAyXG4gICAgY29uc3QgdG9kYXkgPSBsb2NhbERhdGVPZihhdCk7XG4gICAgaWYgKHdlZWtkYXlNb25kYXkodG9kYXkpID49IDUpIHtcbiAgICAgIGNvbnN0IHRlcm1zOiB7IHByb2plY3Q6IHN0cmluZzsgc291cmNlOiBzdHJpbmcgfVtdID0gW107XG4gICAgICBmb3IgKGNvbnN0IHMgb2YgdGhpcy5zZW1lc3RlcnMpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHMuc3RhcnREYXRlIDw9IGRhdGVBdChhdCkgJiZcbiAgICAgICAgICBzLmVuZERhdGUgPj0gZGF0ZUF0KGF0KSAmJlxuICAgICAgICAgIHRoaXMucHJvamVjdHMuc29tZSgocCkgPT4gcC5wcm9qZWN0SWQgPT09IHMucHJvamVjdElkICYmIHAuZXhhbU1vZGUpXG4gICAgICAgICkge1xuICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gcGFyc2VEYXRlKHMuc3RhcnREYXRlKSE7XG4gICAgICAgICAgY29uc3Qgd2VlayA9IE1hdGguZmxvb3IoZGF5c0JldHdlZW4oc3RhcnQsIHRvZGF5KSAvIDcpICsgMTtcbiAgICAgICAgICB0ZXJtcy5wdXNoKHsgcHJvamVjdDogcy5wcm9qZWN0SWQsIHNvdXJjZTogYCR7cy5pZH06d2VlayR7d2Vla31gIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHsgcHJvamVjdCwgc291cmNlIH0gb2YgdGVybXMpIHtcbiAgICAgICAgY29uc3QgbiA9IHRoaXMuZXZlbnRzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5ldmVudChwcm9qZWN0LCBcIndlZWtseUV4YW1cIiwgc291cmNlLCBhdCk7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50cy5sZW5ndGggIT09IG4pIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY2hhbmdlZDtcbiAgfVxuXG4gIC8qKiBcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcdTYyNjdcdTg4NENcdUZGMUFcdTY4MjFcdTlBOEMgXHUyMTkyIFx1NTNEOFx1NjZGNFx1RkYwQ1x1NTE2OFx1OTBFOFx1NjIxMFx1NTI5Rlx1NTQwRVx1NzUzMVx1NEUwQVx1NUM0Mlx1N0VERlx1NEUwMCB2YWxpZGF0ZVx1MzAwMiAqL1xuICBhcHBseShjb21tYW5kOiBDb21tYW5kLCBhdDogbnVtYmVyKTogdm9pZCB7XG4gICAgc3dpdGNoIChjb21tYW5kLm9wKSB7XG4gICAgICBjYXNlIFwicmVjb3JkUHJvZ3Jlc3NcIjoge1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgIXRoaXMucHJvZ3Jlc3Muc29tZSgocikgPT4gci5pZCA9PT0gY29tbWFuZC5yZWNvcmQuaWQpLFxuICAgICAgICAgIFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XHU0RTBEXHU1M0VGXHU4OTg2XHU3NkQ2XHVGRjBDXHU4QkY3XHU2NUIwXHU1ODlFXHU0RTAwXHU2NzYxXHU2NkY0XHU2QjYzXHU4QkIwXHU1RjU1XCIsXG4gICAgICAgICk7XG4gICAgICAgIGNvbW1hbmQucmVjb3JkLnJlY29yZGVkQXQgPSBhdDtcbiAgICAgICAgY29tbWFuZC5yZWNvcmQuY29uZmlybWVkID0gY29tbWFuZC5yZWNvcmQuc291cmNlID09PSBcInVzZXJcIjtcbiAgICAgICAgdGhpcy5wcm9ncmVzcy5wdXNoKGNvbW1hbmQucmVjb3JkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiY29uZmlybVByb2dyZXNzXCI6IHtcbiAgICAgICAgY29uc3QgcmVjb3JkID0gdGhpcy5wcm9ncmVzcy5maW5kKChyKSA9PiByLmlkID09PSBjb21tYW5kLmlkKTtcbiAgICAgICAgZW5zdXJlKHJlY29yZCAhPT0gdW5kZWZpbmVkLCBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgcmVjb3JkLmNvbmZpcm1lZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInN1Ym1pdENvcnJlY3Rpb25cIjoge1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgIXRoaXMuY29ycmVjdGlvbnMuc29tZSgoYykgPT4gYy5pZCA9PT0gY29tbWFuZC5jb3JyZWN0aW9uLmlkKSxcbiAgICAgICAgICBcIlx1OEJBMlx1NkI2M1x1NzI0OFx1NjcyQ1x1NEUwRFx1NTNFRlx1ODk4Nlx1NzZENlwiLFxuICAgICAgICApO1xuICAgICAgICBjb21tYW5kLmNvcnJlY3Rpb24uc3VibWl0dGVkQXQgPSBhdDtcbiAgICAgICAgY29tbWFuZC5jb3JyZWN0aW9uLmFjY2VwdGVkID0gbnVsbDtcbiAgICAgICAgY29tbWFuZC5jb3JyZWN0aW9uLmZlZWRiYWNrID0gXCJcIjtcbiAgICAgICAgY29tbWFuZC5jb3JyZWN0aW9uLnJldmlld2VkQXQgPSBudWxsO1xuICAgICAgICBjb25zdCBwcm9qZWN0ID0gKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBncmFkZSA9IHRoaXMuZ3JhZGVzLmZpbmQoXG4gICAgICAgICAgICAoZykgPT4gZy5pZCA9PT0gY29tbWFuZC5jb3JyZWN0aW9uLmdyYWRlSWQsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoZ3JhZGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgY29uc3Qgc3ViID0gdGhpcy5zdWJtaXNzaW9ucy5maW5kKChzKSA9PiBzLmlkID09PSBncmFkZS5zdWJtaXNzaW9uSWQpO1xuICAgICAgICAgIGlmIChzdWIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgY29uc3QgYSA9IHRoaXMuYXNzZXNzbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gc3ViLmFzc2Vzc21lbnRJZCk7XG4gICAgICAgICAgcmV0dXJuIGE/LnByb2plY3RJZCA/PyBudWxsO1xuICAgICAgICB9KSgpO1xuICAgICAgICBlbnN1cmUocHJvamVjdCAhPT0gbnVsbCwgXCJcdThCQTJcdTZCNjNcdTdGM0FcdTVDMTFcdTUzOUZcdTU5Q0JcdTYyNzlcdTY1MzlcIik7XG4gICAgICAgIHRoaXMuZXZlbnQocHJvamVjdCwgXCJjb3JyZWN0aW9uXCIsIGNvbW1hbmQuY29ycmVjdGlvbi5pZCwgYXQpO1xuICAgICAgICB0aGlzLmNvcnJlY3Rpb25zLnB1c2goY29tbWFuZC5jb3JyZWN0aW9uKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicmV2aWV3Q29ycmVjdGlvblwiOiB7XG4gICAgICAgIGNvbnN0IGNvcnJlY3Rpb24gPSB0aGlzLmNvcnJlY3Rpb25zLmZpbmQoXG4gICAgICAgICAgKGMpID0+IGMuaWQgPT09IGNvbW1hbmQuaWQgJiYgYy5yZXZpZXdlZEF0ID09PSBudWxsLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoY29ycmVjdGlvbiAhPT0gdW5kZWZpbmVkLCBcIlx1OEJBMlx1NkI2M1x1NURGMlx1NjhDMFx1NjdFNVx1NjIxNlx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgZW5zdXJlKGNoZWNrVGV4dChjb21tYW5kLmZlZWRiYWNrLCA1MDAwMCksIFwiXHU4QkEyXHU2QjYzXHU2OEMwXHU2N0U1XHU5NzAwXHU4OTgxXHU1M0NEXHU5OTg4XCIpO1xuICAgICAgICBjb3JyZWN0aW9uLmFjY2VwdGVkID0gY29tbWFuZC5hY2NlcHRlZDtcbiAgICAgICAgY29ycmVjdGlvbi5mZWVkYmFjayA9IGNvbW1hbmQuZmVlZGJhY2s7XG4gICAgICAgIGNvcnJlY3Rpb24ucmV2aWV3ZWRBdCA9IGF0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlUHJvamVjdFwiOiB7XG4gICAgICAgIHVwc2VydEJ5KHRoaXMucHJvamVjdHMsIGNvbW1hbmQucHJvamVjdCwgKHgpID0+IHgucHJvamVjdElkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVJlc291cmNlXCI6IHtcbiAgICAgICAgdXBzZXJ0QnkodGhpcy5yZXNvdXJjZXMsIGNvbW1hbmQucmVzb3VyY2UsICh4KSA9PiB4LmlkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVJlc291cmNlc1wiOiB7XG4gICAgICAgIC8vIFx1NjI3OVx1OTFDRlx1NzY3Qlx1OEJCMFx1NTNFQVx1ODQzRFx1NEUwMFx1NkIyMVx1NzZEOFx1RkYxQVx1OTAxMFx1Njc2MSBzYXZlUmVzb3VyY2UgXHU0RjFBXHU4QkE5IHBsYW4uanNvbiBcdTg4QUJcdTkxQ0RcdTUxOTkgTiBcdTZCMjFcbiAgICAgICAgLy8gXHVGRjA4XHU4RDQ0XHU2NTk5XHU1RTkzXHU1MkE4XHU4Rjg0XHU0RTBBXHU1MzQzXHU2NzYxXHVGRjA5XHVGRjBDXHU4RkQ5XHU2NjJGXHUzMDBDXHU2MzA5XHU5ODc5XHU3NkVFXHU2NTc0XHU3NkVFXHU1RjU1XHU1QkZDXHU1MTY1XHUzMDBEXHU1RkM1XHU5ODdCXHU4RDcwXHU2Mjc5XHU5MUNGXHU3Njg0XHU1MzlGXHU1NkUwXHUzMDAyXG4gICAgICAgIGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgY29tbWFuZC5yZXNvdXJjZXMpIHtcbiAgICAgICAgICB1cHNlcnRCeSh0aGlzLnJlc291cmNlcywgcmVzb3VyY2UsICh4KSA9PiB4LmlkKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJyZW1vdmVSZXNvdXJjZXNcIjoge1xuICAgICAgICBlbnN1cmUoY29tbWFuZC5pZHMubGVuZ3RoID4gMCwgXCJcdThCRjdcdTkwMDlcdTYyRTlcdTg5ODFcdTZFMDVcdTc0MDZcdTc2ODRcdThENDRcdTZFOTBcdTc2N0JcdThCQjBcIik7XG4gICAgICAgIGNvbnN0IHJlZmVyZW5jZWQgPSB0aGlzLnJlc291cmNlUmVmZXJlbmNlSW5kZXgoKTtcbiAgICAgICAgY29uc3Qga25vd24gPSBuZXcgU2V0KHRoaXMucmVzb3VyY2VzLm1hcCgocikgPT4gci5pZCkpO1xuICAgICAgICBmb3IgKGNvbnN0IGlkIG9mIGNvbW1hbmQuaWRzKSB7XG4gICAgICAgICAgZW5zdXJlKGtub3duLmhhcyhpZCksIFwiXHU4RDQ0XHU2RTkwXHU3NjdCXHU4QkIwXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICAgIGVuc3VyZShcbiAgICAgICAgICAgICFyZWZlcmVuY2VkLmhhcyhpZCksXG4gICAgICAgICAgICBcIlx1OEQ0NFx1NkU5MFx1NEVDRFx1ODhBQlx1NjU1OVx1NUI2Nlx1OTE0RFx1N0Y2RVx1NjIxNlx1NTM4Nlx1NTNGMlx1OEJCMFx1NUY1NVx1NUYxNVx1NzUyOFx1RkYwQ1x1OEJGN1x1NEZFRVx1NTkwRFx1OERFRlx1NUY4NFx1NUU3Nlx1NEZERFx1NzU1OVx1NzY3Qlx1OEJCMFwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaWRzID0gbmV3IFNldChjb21tYW5kLmlkcyk7XG4gICAgICAgIHRoaXMucmVzb3VyY2VzID0gdGhpcy5yZXNvdXJjZXMuZmlsdGVyKChyKSA9PiAhaWRzLmhhcyhyLmlkKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNhdmVTZW1lc3RlclwiOiB7XG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuc2VtZXN0ZXJzLmZpbmQoKHMpID0+IHMuaWQgPT09IGNvbW1hbmQuc2VtZXN0ZXIuaWQpO1xuICAgICAgICBpZiAob2xkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgICBjb21tYW5kLnNlbWVzdGVyLnJldmlzaW9uID09PSBvbGQucmV2aXNpb24gKyAxLFxuICAgICAgICAgICAgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcdTY2RjRcdTY1QjBcdTVGQzVcdTk4N0JcdTkwMTJcdTU4OUVcdTcyNDhcdTY3MkNcIixcbiAgICAgICAgICApO1xuICAgICAgICAgIHRoaXMuc2VtZXN0ZXJIaXN0b3J5LnB1c2goe1xuICAgICAgICAgICAgLi4ub2xkLFxuICAgICAgICAgICAgbWlsZXN0b25lczogb2xkLm1pbGVzdG9uZXMubWFwKChtKSA9PiAoe1xuICAgICAgICAgICAgICAuLi5tLFxuICAgICAgICAgICAgICB0b3BpY3M6IFsuLi5tLnRvcGljc10sXG4gICAgICAgICAgICAgIHJlc291cmNlSWRzOiBbLi4ubS5yZXNvdXJjZUlkc10sXG4gICAgICAgICAgICB9KSksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdXBzZXJ0QnkodGhpcy5zZW1lc3RlcnMsIGNvbW1hbmQuc2VtZXN0ZXIsICh4KSA9PiB4LmlkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZUxlc3NvblwiOiB7XG4gICAgICAgIGNvbnN0IHNlbWVzdGVyID0gdGhpcy5zZW1lc3RlcnMuZmluZChcbiAgICAgICAgICAocykgPT4gcy5pZCA9PT0gY29tbWFuZC5sZXNzb24uc2VtZXN0ZXJJZCxcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKHNlbWVzdGVyICE9PSB1bmRlZmluZWQsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBjb21tYW5kLmxlc3Nvbi5zZW1lc3RlclJldmlzaW9uID0gc2VtZXN0ZXIucmV2aXNpb247XG4gICAgICAgIGVuc3VyZShjb21tYW5kLmxlc3Nvbi5zdGFydHNBdCA+IGF0LCBcIlx1OEJGRVx1N0EwQlx1NUZDNVx1OTg3Qlx1NUI4OVx1NjM5Mlx1NTcyOFx1NjcyQVx1Njc2NVwiKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICF0aGlzLmxlc3NvbnMuc29tZShcbiAgICAgICAgICAgIChsKSA9PlxuICAgICAgICAgICAgICBsLmlkID09PSBjb21tYW5kLmxlc3Nvbi5pZCAmJlxuICAgICAgICAgICAgICAobC5zdGF0ZSAhPT0gXCJwbGFubmVkXCIgfHwgbC5hdHRlbmRlZCksXG4gICAgICAgICAgKSxcbiAgICAgICAgICBcIlx1NURGMlx1NUYwMFx1NTlDQlx1OEJGRVx1N0EwQlx1NEZERFx1NzU1OVx1NTM4Nlx1NTNGMlx1RkYwQ1x1NEUwRFx1ODBGRFx1NjUzOVx1NTE5OVwiLFxuICAgICAgICApO1xuICAgICAgICBjb21tYW5kLmxlc3Nvbi5zdGF0ZSA9IFwicGxhbm5lZFwiO1xuICAgICAgICBjb21tYW5kLmxlc3Nvbi5hdHRlbmRlZCA9IGZhbHNlO1xuICAgICAgICB1cHNlcnRCeSh0aGlzLmxlc3NvbnMsIGNvbW1hbmQubGVzc29uLCAoeCkgPT4geC5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNldExlc3NvblJlc291cmNlc1wiOiB7XG4gICAgICAgIGNvbnN0IGxlc3NvbiA9IHRoaXMubGVzc29ucy5maW5kKChsKSA9PiBsLmlkID09PSBjb21tYW5kLmlkKTtcbiAgICAgICAgZW5zdXJlKGxlc3NvbiAhPT0gdW5kZWZpbmVkLCBcIlx1OEJGRVx1N0EwQlx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIGxlc3Nvbi5zdGF0ZSA9PT0gXCJwbGFubmVkXCIgJiZcbiAgICAgICAgICAgICFsZXNzb24uYXR0ZW5kZWQgJiZcbiAgICAgICAgICAgIGxlc3Nvbi5zdGFydHNBdCA+IGF0LFxuICAgICAgICAgIFwiXHU4QkZFXHU3QTBCXHU1REYyXHU1RjAwXHU1OUNCXHVGRjBDXHU0RTBEXHU4MEZEXHU0RkVFXHU2NTM5XHU2MzA3XHU1QjlBXHU4RDQ0XHU2NTk5XCIsXG4gICAgICAgICk7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICBjb21tYW5kLnJlc291cmNlSWRzLmV2ZXJ5KChpZCkgPT5cbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzLnNvbWUoXG4gICAgICAgICAgICAgIChyKSA9PiByLmlkID09PSBpZCAmJiByLnByb2plY3RJZCA9PT0gbGVzc29uLnByb2plY3RJZCxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKSxcbiAgICAgICAgICBcIlx1NTNFQVx1ODBGRFx1NjMwN1x1NUI5QVx1NjcyQ1x1OTg3OVx1NzZFRVx1NzY3Qlx1OEJCMFx1NzY4NFx1OEQ0NFx1NjU5OVwiLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgbmV3IFNldChjb21tYW5kLnJlc291cmNlSWRzKS5zaXplID09PSBjb21tYW5kLnJlc291cmNlSWRzLmxlbmd0aCxcbiAgICAgICAgICBcIlx1OEJGRVx1N0EwQlx1OEQ0NFx1NjU5OVx1NEUwRFx1ODBGRFx1OTFDRFx1NTkwRFx1NjMwN1x1NUI5QVwiLFxuICAgICAgICApO1xuICAgICAgICBsZXNzb24ucmVzb3VyY2VJZHMgPSBbLi4uY29tbWFuZC5yZXNvdXJjZUlkc107XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImF0dGVuZExlc3NvblwiOiB7XG4gICAgICAgIGNvbnN0IGxlc3NvbiA9IHRoaXMubGVzc29ucy5maW5kKChsKSA9PiBsLmlkID09PSBjb21tYW5kLmlkKTtcbiAgICAgICAgZW5zdXJlKGxlc3NvbiAhPT0gdW5kZWZpbmVkLCBcIlx1OEJGRVx1N0EwQlx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIGF0ID49IGxlc3Nvbi5zdGFydHNBdCAmJiBhdCA8IGxlc3Nvbi5lbmRzQXQsXG4gICAgICAgICAgXCJcdTUzRUFcdTgwRkRcdTU3MjhcdTRFMEFcdThCRkVcdTY1RjZcdTc4NkVcdThCQTRcdTUzQzJcdTRFMEVcIixcbiAgICAgICAgKTtcbiAgICAgICAgbGVzc29uLmF0dGVuZGVkID0gdHJ1ZTtcbiAgICAgICAgbGVzc29uLnByb2dyZXNzID0gY29tbWFuZC5wcm9ncmVzcztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicHVibGlzaEFzc2Vzc21lbnRcIjoge1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgdGhpcy5wcm9qZWN0cy5zb21lKFxuICAgICAgICAgICAgKHApID0+IHAucHJvamVjdElkID09PSBjb21tYW5kLmFzc2Vzc21lbnQucHJvamVjdElkICYmIHAuZXhhbU1vZGUsXG4gICAgICAgICAgKSxcbiAgICAgICAgICBcIlx1NTNEMVx1NUUwM1x1NEY1Q1x1NEUxQVx1NTQ4Q1x1OEJENVx1NTM3N1x1NTI0RFx1OEJGN1x1NTQyRlx1NzUyOFx1NUU5NFx1OEJENVx1NkEyMVx1NUYwRlwiLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgIXRoaXMuYXNzZXNzbWVudHMuc29tZSgoYSkgPT4gYS5pZCA9PT0gY29tbWFuZC5hc3Nlc3NtZW50LmlkKSxcbiAgICAgICAgICBcIlx1NURGMlx1NTNEMVx1NUUwM1x1OTg5OFx1NzZFRVx1NTQ4Q1x1OEJDNFx1NTIwNlx1NjgwN1x1NTFDNlx1NEUwRFx1NTNFRlx1NEZFRVx1NjUzOVx1RkYxQlx1OEJGN1x1NTNEMVx1NUUwM1x1NjVCMCBJRCBcdTc2ODRcdTRGRUVcdThCQTJcdTcyNDhcIixcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIGNvbW1hbmQuYXNzZXNzbWVudC5raW5kID09PSBcImhvbWV3b3JrXCJcbiAgICAgICAgICAgID8gY29tbWFuZC5hc3Nlc3NtZW50LmVuZHNBdCA+IGF0XG4gICAgICAgICAgICA6IGRhdGVBdChjb21tYW5kLmFzc2Vzc21lbnQuc3RhcnRzQXQpID49IGRhdGVBdChhdCksXG4gICAgICAgICAgXCJcdTRFMERcdTgwRkRcdTUzRDFcdTVFMDNcdTVERjJcdTYyMkFcdTZCNjJcdTc2ODRcdTRGNUNcdTRFMUFcdTYyMTZcdTVERjJcdThGQzdcdTgwMDNcdThCRDVcdTY1RTVcdTY3MUZcdTc2ODRcdThCRDVcdTUzNzdcIixcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3Qgc2VtZXN0ZXIgPSB0aGlzLnNlbWVzdGVycy5maW5kKFxuICAgICAgICAgIChzKSA9PiBzLmlkID09PSBjb21tYW5kLmFzc2Vzc21lbnQuc2VtZXN0ZXJJZCxcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKHNlbWVzdGVyICE9PSB1bmRlZmluZWQsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBjb21tYW5kLmFzc2Vzc21lbnQuc2VtZXN0ZXJSZXZpc2lvbiA9IHNlbWVzdGVyLnJldmlzaW9uO1xuICAgICAgICBjb21tYW5kLmFzc2Vzc21lbnQucHVibGlzaGVkQXQgPSBhdDtcbiAgICAgICAgY29tbWFuZC5hc3Nlc3NtZW50LnByaW50ZWRBdCA9IG51bGw7XG4gICAgICAgIGNvbW1hbmQuYXNzZXNzbWVudC5zdGFydGVkQXQgPSBudWxsO1xuICAgICAgICBjb21tYW5kLmFzc2Vzc21lbnQuc3RvcHBlZEF0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5hc3Nlc3NtZW50cy5wdXNoKGNvbW1hbmQuYXNzZXNzbWVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImNvbmZpcm1QcmludGVkXCI6IHtcbiAgICAgICAgY29uc3QgYSA9IHRoaXMuYXNzZXNzbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gY29tbWFuZC5pZCk7XG4gICAgICAgIGVuc3VyZShhICE9PSB1bmRlZmluZWQsIFwiXHU4QkQ1XHU1Mzc3XHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBhLnByaW50ZWRBdCA9IGF0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzdGFydEV4YW1cIjoge1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgIXRoaXMuYXNzZXNzbWVudHMuc29tZShcbiAgICAgICAgICAgIChhKSA9PiBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJiBhLnN0b3BwZWRBdCA9PT0gbnVsbCxcbiAgICAgICAgICApLFxuICAgICAgICAgIFwiXHU4QkY3XHU1MTQ4XHU3RUQzXHU2NzVGXHU1RjUzXHU1MjREXHU4MDAzXHU4QkQ1XCIsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGEgPSB0aGlzLmFzc2Vzc21lbnRzLmZpbmQoKHgpID0+IHguaWQgPT09IGNvbW1hbmQuaWQpO1xuICAgICAgICBlbnN1cmUoYSAhPT0gdW5kZWZpbmVkLCBcIlx1OEJENVx1NTM3N1x1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIGEua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICAgICAgICBhLnByaW50ZWRBdCAhPT0gbnVsbCAmJlxuICAgICAgICAgICAgYS5zdGFydGVkQXQgPT09IG51bGwgJiZcbiAgICAgICAgICAgIGRhdGVBdChhdCkgPT09IGRhdGVBdChhLnN0YXJ0c0F0KSxcbiAgICAgICAgICBcIlx1OEJGN1x1NTE0OFx1NjI1M1x1NTM3MFx1OEJENVx1NTM3N1x1NEUwRVx1N0I1NFx1OTg5OFx1NTM2MVx1RkYwQ1x1NUU3Nlx1NTcyOFx1ODAwM1x1OEJENVx1NUI4OVx1NjM5Mlx1NUY1M1x1NTkyOVx1NUYwMFx1NTlDQlx1ODAwM1x1OEJENVwiLFxuICAgICAgICApO1xuICAgICAgICBhLnN0YXJ0ZWRBdCA9IGF0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJlbmRFeGFtXCI6IHtcbiAgICAgICAgY29uc3QgYSA9IHRoaXMuYXNzZXNzbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gY29tbWFuZC5pZCk7XG4gICAgICAgIGVuc3VyZShhICE9PSB1bmRlZmluZWQsIFwiXHU4MDAzXHU4QkQ1XHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgYS5raW5kICE9PSBcImhvbWV3b3JrXCIgJiYgYS5zdGFydGVkQXQgIT09IG51bGwgJiYgYS5zdG9wcGVkQXQgPT09IG51bGwsXG4gICAgICAgICAgXCJcdTgwMDNcdThCRDVcdTVDMUFcdTY3MkFcdTVGMDBcdTU5Q0JcdTYyMTZcdTVERjJcdTdFQ0ZcdTUwNUNcdTdCMTRcIixcbiAgICAgICAgKTtcbiAgICAgICAgYS5zdG9wcGVkQXQgPSBhdDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic3VibWl0XCI6IHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICF0aGlzLnN1Ym1pc3Npb25zLnNvbWUoKHMpID0+IHMuaWQgPT09IGNvbW1hbmQuc3VibWlzc2lvbi5pZCksXG4gICAgICAgICAgXCJcdTYzRDBcdTRFQTRcdTcyNDhcdTY3MkNcdTRFMERcdTUzRUZcdTg5ODZcdTc2RDZcIixcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgYSA9IHRoaXMuYXNzZXNzbWVudHMuZmluZChcbiAgICAgICAgICAoeCkgPT4geC5pZCA9PT0gY29tbWFuZC5zdWJtaXNzaW9uLmFzc2Vzc21lbnRJZCxcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKGEgIT09IHVuZGVmaW5lZCwgXCJcdTRGNUNcdTRFMUEvXHU4MDAzXHU4QkQ1XHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBlbnN1cmUoYXQgPj0gYS5zdGFydHNBdCwgXCJcdTVDMUFcdTY3MkFcdTVGMDBcdTU5Q0JcdUZGMENcdTRFMERcdTgwRkRcdTYzRDBcdTRFQTRcIik7XG4gICAgICAgIGlmIChhLmtpbmQgIT09IFwiaG9tZXdvcmtcIikge1xuICAgICAgICAgIGVuc3VyZShcbiAgICAgICAgICAgIGEuc3RhcnRlZEF0ICE9PSBudWxsICYmIGEuc3RvcHBlZEF0ICE9PSBudWxsLFxuICAgICAgICAgICAgXCJcdTgwMDNcdThCRDVcdTdFRDNcdTY3NUZcdTUwNUNcdTdCMTRcdTU0MEVcdTYyNERcdTgwRkRcdTRFMEFcdTRGMjBcdTdCNTRcdTk4OThcdTUzNjFcIixcbiAgICAgICAgICApO1xuICAgICAgICAgIGVuc3VyZShcbiAgICAgICAgICAgIGNvbW1hbmQuc3VibWlzc2lvbi5yZXNvdXJjZUlkcy5sZW5ndGggPiAwLFxuICAgICAgICAgICAgXCJcdTgwMDNcdThCRDVcdTk3MDBcdTg5ODFcdTRFMEFcdTRGMjBcdTdFQjhcdThEMjhcdTdCNTRcdTk4OThcdTUzNjFcIixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICBjaGVja1RleHQoY29tbWFuZC5zdWJtaXNzaW9uLmFuc3dlcnMsIDUwMDAwKSB8fFxuICAgICAgICAgICAgY29tbWFuZC5zdWJtaXNzaW9uLnJlc291cmNlSWRzLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgIGNvbW1hbmQuc3VibWlzc2lvbi51bmZpbmlzaGVkLFxuICAgICAgICAgIFwiXHU4QkY3XHU2M0QwXHU0RjlCXHU3QjU0XHU2ODQ4XHUzMDAxXHU5NjQ0XHU0RUY2XHU2MjE2XHU2ODA3XHU4QkIwXHU2NzJBXHU1QjhDXHU2MjEwXCIsXG4gICAgICAgICk7XG4gICAgICAgIGNvbW1hbmQuc3VibWlzc2lvbi5zdWJtaXR0ZWRBdCA9IGF0O1xuICAgICAgICBjb25zdCBwcm9qZWN0ID0gYS5wcm9qZWN0SWQ7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGNvbW1hbmQuc3VibWlzc2lvbi5pZDtcbiAgICAgICAgdGhpcy5zdWJtaXNzaW9ucy5wdXNoKGNvbW1hbmQuc3VibWlzc2lvbik7XG4gICAgICAgIHRoaXMuZXZlbnQocHJvamVjdCwgXCJncmFkZVwiLCBzb3VyY2UsIGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicmVjb3JkUXVlc3Rpb25UaW1lc1wiOiB7XG4gICAgICAgIGVuc3VyZShjb21tYW5kLnF1ZXN0aW9uVGltZXMubGVuZ3RoID4gMCwgXCJcdTZDQTFcdTY3MDlcdTk3MDBcdTg5ODFcdTg4NjVcdTVGNTVcdTc2ODRcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcIik7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICAhdGhpcy5ncmFkZXMuc29tZSgoZykgPT4gZy5zdWJtaXNzaW9uSWQgPT09IGNvbW1hbmQuaWQpLFxuICAgICAgICAgIFwiXHU1REYyXHU2Mjc5XHU2NTM5XHU3Njg0XHU3QjU0XHU1Mzc3XHU0RTBEXHU4MEZEXHU4ODY1XHU1RjU1XHU1QjhDXHU2MjEwXHU2NUY2XHU1MjNCXCIsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHN1Ym1pc3Npb24gPSB0aGlzLnN1Ym1pc3Npb25zLmZpbmQoKHMpID0+IHMuaWQgPT09IGNvbW1hbmQuaWQpO1xuICAgICAgICBlbnN1cmUoc3VibWlzc2lvbiAhPT0gdW5kZWZpbmVkLCBcIlx1NjNEMFx1NEVBNFx1NzI0OFx1NjcyQ1x1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIGNvbW1hbmQucXVlc3Rpb25UaW1lcy5ldmVyeShcbiAgICAgICAgICAgICh0KSA9PlxuICAgICAgICAgICAgICAhc3VibWlzc2lvbi5xdWVzdGlvblRpbWVzLnNvbWUoXG4gICAgICAgICAgICAgICAgKGV4aXN0aW5nKSA9PiBleGlzdGluZy5xdWVzdGlvbklkID09PSB0LnF1ZXN0aW9uSWQsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgKSxcbiAgICAgICAgICBcIlx1NURGMlx1NjcwOVx1NzY4NFx1NUI4Q1x1NjIxMFx1NjVGNlx1NTIzQlx1NEUwRFx1ODBGRFx1ODk4Nlx1NzZENlwiLFxuICAgICAgICApO1xuICAgICAgICBzdWJtaXNzaW9uLnF1ZXN0aW9uVGltZXMucHVzaCguLi5jb21tYW5kLnF1ZXN0aW9uVGltZXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJncmFkZVwiOiB7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICAhdGhpcy5ncmFkZXMuc29tZSgoZykgPT4gZy5pZCA9PT0gY29tbWFuZC5ncmFkZS5pZCksXG4gICAgICAgICAgXCJcdTYyNzlcdTY1MzlcdTUzODZcdTUzRjJcdTRFMERcdTUzRUZcdTg5ODZcdTc2RDZcdUZGMENcdTU5MERcdTY4MzhcdThCRjdcdTY1QjBcdTU4OUVcdTYyNzlcdTY1MzlcdThCQjBcdTVGNTVcIixcbiAgICAgICAgKTtcbiAgICAgICAgY29tbWFuZC5ncmFkZS5ncmFkZWRBdCA9IGF0O1xuICAgICAgICB0aGlzLmdyYWRlcy5wdXNoKGNvbW1hbmQuZ3JhZGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlUmV2aWV3XCI6IHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICF0aGlzLnJldmlld3Muc29tZSgocikgPT4gci5pZCA9PT0gY29tbWFuZC5yZXZpZXcuaWQpLFxuICAgICAgICAgIFwiXHU1OTBEXHU3NkQ4XHU1Mzg2XHU1M0YyXHU0RTBEXHU1M0VGXHU4OTg2XHU3NkQ2XCIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMucmV2aWV3cy5wdXNoKGNvbW1hbmQucmV2aWV3KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiY2xhaW1FdmVudFwiOiB7XG4gICAgICAgIGNvbnN0IGV2ZW50ID0gdGhpcy5ldmVudHMuZmluZChcbiAgICAgICAgICAoZSkgPT4gZS5pZCA9PT0gY29tbWFuZC5pZCAmJiBlLnN0YXRlID09PSBcInBlbmRpbmdcIixcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKGV2ZW50ICE9PSB1bmRlZmluZWQsIFwiXHU0RThCXHU0RUY2XHU1REYyXHU1OTA0XHU3NDA2XCIpO1xuICAgICAgICBldmVudC5zdGF0ZSA9IFwicnVubmluZ1wiO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJmaW5pc2hFdmVudFwiOiB7XG4gICAgICAgIGNvbnN0IGV2ZW50ID0gdGhpcy5ldmVudHMuZmluZCgoZSkgPT4gZS5pZCA9PT0gY29tbWFuZC5pZCk7XG4gICAgICAgIGVuc3VyZShldmVudCAhPT0gdW5kZWZpbmVkLCBcIlx1NjU1OVx1NUI2Nlx1NEU4Qlx1NEVGNlx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgY29uc3QgcHJvZHVjZWQgPSAoKCkgPT4ge1xuICAgICAgICAgIHN3aXRjaCAoZXZlbnQua2luZCkge1xuICAgICAgICAgICAgY2FzZSBcImhvbWV3b3JrXCI6XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmFzc2Vzc21lbnRzLnNvbWUoXG4gICAgICAgICAgICAgICAgKGEpID0+XG4gICAgICAgICAgICAgICAgICBhLnByb2plY3RJZCA9PT0gZXZlbnQucHJvamVjdElkICYmXG4gICAgICAgICAgICAgICAgICBhLmtpbmQgPT09IFwiaG9tZXdvcmtcIiAmJlxuICAgICAgICAgICAgICAgICAgYS5sZXNzb25JZCA9PT0gZXZlbnQuc291cmNlSWQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjYXNlIFwidGFza0hvbWV3b3JrXCI6XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmFzc2Vzc21lbnRzLnNvbWUoXG4gICAgICAgICAgICAgICAgKGEpID0+XG4gICAgICAgICAgICAgICAgICBhLmtpbmQgPT09IFwiaG9tZXdvcmtcIiAmJlxuICAgICAgICAgICAgICAgICAgYS5wcm9qZWN0SWQgPT09IGV2ZW50LnByb2plY3RJZCAmJlxuICAgICAgICAgICAgICAgICAgYS50YXNrSWQgPT09IGV2ZW50LnNvdXJjZUlkLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgY2FzZSBcImNvcnJlY3Rpb25cIjpcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29ycmVjdGlvbnMuc29tZShcbiAgICAgICAgICAgICAgICAoYykgPT4gYy5pZCA9PT0gZXZlbnQuc291cmNlSWQgJiYgYy5yZXZpZXdlZEF0ICE9PSBudWxsLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgY2FzZSBcIndlZWtseUV4YW1cIjpcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXNzZXNzbWVudHMuc29tZShcbiAgICAgICAgICAgICAgICAoYSkgPT5cbiAgICAgICAgICAgICAgICAgIGEucHJvamVjdElkID09PSBldmVudC5wcm9qZWN0SWQgJiZcbiAgICAgICAgICAgICAgICAgIGEua2luZCA9PT0gXCJ3ZWVrbHlFeGFtXCIgJiZcbiAgICAgICAgICAgICAgICAgIGEucHVibGlzaGVkQXQgPj0gZXZlbnQuY3JlYXRlZEF0LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgY2FzZSBcImdyYWRlXCI6XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmdyYWRlcy5zb21lKChnKSA9PiBnLnN1Ym1pc3Npb25JZCA9PT0gZXZlbnQuc291cmNlSWQpO1xuICAgICAgICAgICAgY2FzZSBcInJldmlld1wiOlxuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXZpZXdzLnNvbWUoXG4gICAgICAgICAgICAgICAgKHIpID0+XG4gICAgICAgICAgICAgICAgICByLnByb2plY3RJZCA9PT0gZXZlbnQucHJvamVjdElkICYmXG4gICAgICAgICAgICAgICAgICBldmVudC5zb3VyY2VJZC5lbmRzV2l0aChyLmRhdGUpLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcbiAgICAgICAgZW5zdXJlKHByb2R1Y2VkLCBcIlx1OEJGN1x1NTE0OFx1NEZERFx1NUI1OFx1NjcyQ1x1NkIyMVx1NjU1OVx1NUI2Nlx1NEU4Qlx1NEVGNlx1NzY4NFx1NUI5RVx1OTY0NVx1NEVBN1x1NzI2OVwiKTtcbiAgICAgICAgZXZlbnQuc3RhdGUgPSBcImRvbmVcIjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicmV0cnlFdmVudFwiOiB7XG4gICAgICAgIGNvbnN0IGV2ZW50ID0gdGhpcy5ldmVudHMuZmluZChcbiAgICAgICAgICAoZSkgPT4gZS5pZCA9PT0gY29tbWFuZC5pZCAmJiBlLnN0YXRlICE9PSBcImRvbmVcIixcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKGV2ZW50ICE9PSB1bmRlZmluZWQsIFwiXHU2Q0ExXHU2NzA5XHU1M0VGXHU5MUNEXHU4QkQ1XHU3Njg0XHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XCIpO1xuICAgICAgICBldmVudC5zdGF0ZSA9IFwicGVuZGluZ1wiO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gdXBzZXJ0Qnk8VD4obGlzdDogVFtdLCB2YWx1ZTogVCwga2V5OiAoeDogVCkgPT4gc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGsgPSBrZXkodmFsdWUpO1xuICBjb25zdCBpbmRleCA9IGxpc3QuZmluZEluZGV4KCh4KSA9PiBrZXkoeCkgPT09IGspO1xuICBpZiAoaW5kZXggPj0gMCkge1xuICAgIGxpc3RbaW5kZXhdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21wbGV0ZWRTdHVkeVRhc2tGcm9tVGFzayhcbiAgdGFzazogVGFzayxcbiAgYXQ6IG51bWJlcixcbik6IENvbXBsZXRlZFN0dWR5VGFzayB8IG51bGwge1xuICBpZiAodGFzay5wcm9qZWN0SWQgPT09IG51bGwpIHJldHVybiBudWxsO1xuICByZXR1cm4ge1xuICAgIGlkOiB0YXNrLmlkLFxuICAgIHByb2plY3RJZDogdGFzay5wcm9qZWN0SWQsXG4gICAgdGl0bGU6IHRhc2sudGl0bGUsXG4gICAgbm90ZXM6IHRhc2subm90ZXMsXG4gICAgdG9waWNzOiBbLi4udGFzay50YWdzXSxcbiAgICBjb21wbGV0ZWRBdDogYXQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhvdXJNaW51dGVOb3coYXQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShhdCAqIDEwMDApO1xuICByZXR1cm4gYCR7U3RyaW5nKGQuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhkLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU2ODIxXHU5QThDIC0tLS0tLS0tLS1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlRWR1Y2F0aW9uKGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgY29uc3QgZSA9IGRhdGEuZWR1Y2F0aW9uO1xuICB1bmlxdWVFZHVjYXRpb25JZHMoW1xuICAgIC4uLmUucmVzb3VyY2VzLm1hcCgoeCkgPT4geC5pZCksXG4gICAgLi4uZS5zZW1lc3RlcnMubWFwKCh4KSA9PiB4LmlkKSxcbiAgICAuLi5lLmxlc3NvbnMubWFwKCh4KSA9PiB4LmlkKSxcbiAgICAuLi5lLmFzc2Vzc21lbnRzLm1hcCgoeCkgPT4geC5pZCksXG4gICAgLi4uZS5zdWJtaXNzaW9ucy5tYXAoKHgpID0+IHguaWQpLFxuICAgIC4uLmUuZ3JhZGVzLm1hcCgoeCkgPT4geC5pZCksXG4gICAgLi4uZS5yZXZpZXdzLm1hcCgoeCkgPT4geC5pZCksXG4gIF0pO1xuICB1bmlxdWVFZHVjYXRpb25JZHMoZS5wcm9qZWN0cy5tYXAoKHApID0+IHAucHJvamVjdElkKSk7XG4gIHVuaXF1ZUVkdWNhdGlvbklkcyhlLmV2ZW50cy5tYXAoKHApID0+IHAuaWQpKTtcbiAgY29uc3QgcHJvamVjdEV4aXN0cyA9IChpZDogc3RyaW5nKTogYm9vbGVhbiA9PlxuICAgIGRhdGEucHJvamVjdHMuc29tZSgocCkgPT4gcC5pZCA9PT0gaWQpO1xuICBjb25zdCByZXNvdXJjZSA9IChpZDogc3RyaW5nLCBwOiBzdHJpbmcpOiBSZXNvdXJjZSB8IHVuZGVmaW5lZCA9PlxuICAgIGUucmVzb3VyY2VzLmZpbmQoKHIpID0+IHIuaWQgPT09IGlkICYmIHIucHJvamVjdElkID09PSBwKTtcbiAgZW5zdXJlKFxuICAgIGUubGVzc29ucy5sZW5ndGggK1xuICAgICAgZS5hc3Nlc3NtZW50cy5sZW5ndGggK1xuICAgICAgZS5zdWJtaXNzaW9ucy5sZW5ndGggK1xuICAgICAgZS5ncmFkZXMubGVuZ3RoIDw9XG4gICAgICAxMDAwMDAsXG4gICAgXCJcdTY1NTlcdTVCNjZcdThCQjBcdTVGNTVcdTY1NzBcdTkxQ0ZcdThEODVcdTUxRkFcdTk2NTBcdTUyMzZcIixcbiAgKTtcbiAgZm9yIChjb25zdCBwIG9mIGUucHJvamVjdHMpIHtcbiAgICBlbnN1cmUoXG4gICAgICBwcm9qZWN0RXhpc3RzKHAucHJvamVjdElkKSAmJiBpc0Fic29sdXRlUGF0aChwLmRpcmVjdG9yeSksXG4gICAgICBcIlx1OTg3OVx1NzZFRVx1NUZDNVx1OTg3Qlx1N0VEMVx1NUI5QVx1N0VERFx1NUJGOVx1NzZFRVx1NUY1NVwiLFxuICAgICk7XG4gICAgZW5zdXJlKFxuICAgICAgcC5leGFtRGF0ZSA9PT0gbnVsbCB8fCB2YWxpZEVkdWNhdGlvbkRhdGUocC5leGFtRGF0ZSksXG4gICAgICBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1ODAwM1x1OEJENVx1NjVFNVx1NjcxRlwiLFxuICAgICk7XG4gICAgaWYgKHAuZXhhbU1vZGUpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgcC52aXNpb25JZCAhPT0gbnVsbCAmJlxuICAgICAgICAgIGRhdGEudmlzaW9ucy5zb21lKCh2KSA9PiB2LmlkID09PSBwLnZpc2lvbklkKSAmJlxuICAgICAgICAgIGNoZWNrVGV4dChwLnRhcmdldCwgNTAwMDApLFxuICAgICAgICBcIlx1NUU5NFx1OEJENVx1NkEyMVx1NUYwRlx1NUZDNVx1OTg3Qlx1N0VEMVx1NUI5QVx1NjEzRlx1NjY2Rlx1NUU3Nlx1NjYwRVx1Nzg2RVx1OTY2Mlx1NjgyMVx1MzAwMVx1NEUxM1x1NEUxQVx1MzAwMVx1NUU3NFx1NEVGRFx1NTQ4Q1x1NzlEMVx1NzZFRVx1NzZFRVx1NjgwN1wiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgcC5zeWxsYWJ1c0lkICE9PSBudWxsICYmXG4gICAgICAgICAgcmVzb3VyY2UocC5zeWxsYWJ1c0lkLCBwLnByb2plY3RJZCk/LmtpbmQgPT09IFwic3lsbGFidXNcIixcbiAgICAgICAgXCJcdTVFOTRcdThCRDVcdTZBMjFcdTVGMEZcdTVGQzVcdTk4N0JcdTdFRDFcdTVCOUFcdTgwMDNcdTdFQjJcIixcbiAgICAgICk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHAucGFzdFBhcGVySWRzLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICBwLnBhc3RQYXBlcklkcy5ldmVyeShcbiAgICAgICAgICAgIChpZCkgPT4gcmVzb3VyY2UoaWQsIHAucHJvamVjdElkKT8ua2luZCA9PT0gXCJwYXN0UGFwZXJcIixcbiAgICAgICAgICApLFxuICAgICAgICBcIlx1NUU5NFx1OEJENVx1NkEyMVx1NUYwRlx1NUZDNVx1OTg3Qlx1N0VEMVx1NUI5QVx1NzcxRlx1OTg5OFwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgcC5tb2NrUGFwZXJJZHMubGVuZ3RoID4gMCAmJlxuICAgICAgICAgIHAubW9ja1BhcGVySWRzLmV2ZXJ5KFxuICAgICAgICAgICAgKGlkKSA9PiByZXNvdXJjZShpZCwgcC5wcm9qZWN0SWQpPy5raW5kID09PSBcIm1vY2tQYXBlclwiLFxuICAgICAgICAgICksXG4gICAgICAgIFwiXHU1RTk0XHU4QkQ1XHU2QTIxXHU1RjBGXHU1RkM1XHU5ODdCXHU3RUQxXHU1QjlBXHU2QTIxXHU2MkRGXHU5ODk4XCIsXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHIgb2YgZS5yZXNvdXJjZXMpIHtcbiAgICBlbnN1cmUoXG4gICAgICBlLnByb2plY3RzLnNvbWUoKHApID0+IHAucHJvamVjdElkID09PSByLnByb2plY3RJZCkgJiZcbiAgICAgICAgY2hlY2tUZXh0KHIudGl0bGUsIDUwMDAwKSAmJlxuICAgICAgICBpc1JlbGF0aXZlUGF0aChyLnBhdGgpLFxuICAgICAgXCJcdThENDRcdTZFOTBcdTk3MDBcdTg5ODFcdTYyNDBcdTVDNUVcdTk4NzlcdTc2RUVcdTMwMDFcdTU0MERcdTc5RjBcdTU0OENcdTVCODlcdTUxNjhcdTc2ODRcdTc2RjhcdTVCRjlcdThERUZcdTVGODRcIixcbiAgICApO1xuICB9XG4gIGZvciAoY29uc3QgcyBvZiBlLnNlbWVzdGVycykge1xuICAgIGVuc3VyZShcbiAgICAgIGUucHJvamVjdHMuc29tZSgocCkgPT4gcC5wcm9qZWN0SWQgPT09IHMucHJvamVjdElkKSAmJlxuICAgICAgICBjaGVja1RleHQocy50aXRsZSwgNTAwMDApICYmXG4gICAgICAgIHZhbGlkRWR1Y2F0aW9uRGF0ZShzLnN0YXJ0RGF0ZSkgJiZcbiAgICAgICAgdmFsaWRFZHVjYXRpb25EYXRlKHMuZW5kRGF0ZSkgJiZcbiAgICAgICAgcy5zdGFydERhdGUgPD0gcy5lbmREYXRlICYmXG4gICAgICAgIHMucmV2aXNpb24gPiAwICYmXG4gICAgICAgIGNoZWNrVGV4dChzLmJhc2VsaW5lLCA1MDAwMCkgJiZcbiAgICAgICAgY2hlY2tUZXh0KHMucmF0aW9uYWxlLCA1MDAwMCkgJiZcbiAgICAgICAgcy5ldmlkZW5jZS5sZW5ndGggPiAwICYmXG4gICAgICAgIHMubWlsZXN0b25lcy5sZW5ndGggPiAwLFxuICAgICAgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcdTdGM0FcdTVDMTFcdTY1RTVcdTY3MUZcdTMwMDFcdTVCNjZcdTYwQzVcdThCQ0FcdTY1QURcdTMwMDFcdTRGOURcdTYzNkVcdTYyMTZcdTk2MzZcdTZCQjVcdThGREJcdTVFQTZcIixcbiAgICApO1xuICAgIGZvciAoY29uc3QgbSBvZiBzLm1pbGVzdG9uZXMpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgbS53ZWVrID4gMCAmJlxuICAgICAgICAgIG0udG9waWNzLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICBjaGVja1RleHQobS5vYmplY3RpdmUsIDUwMDAwKSAmJlxuICAgICAgICAgIG0ubGVzc29uQ291bnQgPiAwICYmXG4gICAgICAgICAgbS5yZXNvdXJjZUlkcy5ldmVyeSgoaWQpID0+IHJlc291cmNlKGlkLCBzLnByb2plY3RJZCkgIT09IHVuZGVmaW5lZCksXG4gICAgICAgIFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU1NDY4XHU4RkRCXHU1RUE2XHU2MjE2XHU1QjY2XHU0RTYwXHU4RDQ0XHU2RTkwXCIsXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IGwgb2YgZS5sZXNzb25zKSB7XG4gICAgY29uc3QgcyA9IFsuLi5lLnNlbWVzdGVycywgLi4uZS5zZW1lc3Rlckhpc3RvcnldLmZpbmQoXG4gICAgICAoeCkgPT5cbiAgICAgICAgeC5pZCA9PT0gbC5zZW1lc3RlcklkICYmXG4gICAgICAgIHgucHJvamVjdElkID09PSBsLnByb2plY3RJZCAmJlxuICAgICAgICB4LnJldmlzaW9uID09PSBsLnNlbWVzdGVyUmV2aXNpb24sXG4gICAgKTtcbiAgICBlbnN1cmUocyAhPT0gdW5kZWZpbmVkLCBcIlx1OEJGRVx1N0EwQlx1NUZDNVx1OTg3Qlx1N0VEMVx1NUI5QVx1NjcyQ1x1OTg3OVx1NzZFRVx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiKTtcbiAgICBlbnN1cmUoXG4gICAgICBjaGVja1RleHQobC50aXRsZSwgNTAwMDApICYmXG4gICAgICAgIGwudG9waWNzLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgbC5lbmRzQXQgLSBsLnN0YXJ0c0F0ID09PSA0NSAqIDYwICYmXG4gICAgICAgIGRhdGVBdChsLnN0YXJ0c0F0KSA+PSBzLnN0YXJ0RGF0ZSAmJlxuICAgICAgICBkYXRlQXQobC5lbmRzQXQpIDw9IHMuZW5kRGF0ZSAmJlxuICAgICAgICBsLnJlc291cmNlSWRzLmV2ZXJ5KChpZCkgPT4gcmVzb3VyY2UoaWQsIGwucHJvamVjdElkKSAhPT0gdW5kZWZpbmVkKSxcbiAgICAgIFwiXHU4QkZFXHU3QTBCXHU5NzAwXHU4OTgxNDVcdTUyMDZcdTk0OUZcdTMwMDFcdTc3RTVcdThCQzZcdTcwQjlcdTU0OENcdTY3MDlcdTY1NDhcdThENDRcdTZFOTBcdUZGMENcdTRFMTRcdTU3MjhcdTVCNjZcdTY3MUZcdTgzMDNcdTU2RjRcdTUxODVcIixcbiAgICApO1xuICAgIGNvbnN0IG1pbnV0ZSA9IE1hdGguZmxvb3IobWludXRlc09mKGhvdXJNaW51dGVOb3cobC5zdGFydHNBdCkpID8/IDApO1xuICAgIGVuc3VyZShcbiAgICAgIChtaW51dGUgPj0gOCAqIDYwICYmIG1pbnV0ZSA8IDEyICogNjAgKyA0MCkgfHxcbiAgICAgICAgKG1pbnV0ZSA+PSAxNCAqIDYwICYmIG1pbnV0ZSA8IDE4ICogNjAgKyAxNSksXG4gICAgICBcIlx1OEJGRVx1N0EwQlx1OTg3Qlx1NTcyOFx1NEUwQVx1NTM0OFx1NjIxNlx1NEUwQlx1NTM0OFx1RkYwQ1x1NjY1QVx1OTVGNDE5XHUyMDEzMjJcdTcwQjlcdTc1NTlcdTdFRDlcdTRGNUNcdTRFMUFcIixcbiAgICApO1xuICAgIGNvbnN0IHNhbWUgPSBlLmxlc3NvbnMuZmlsdGVyKFxuICAgICAgKHgpID0+IGRhdGVBdCh4LnN0YXJ0c0F0KSA9PT0gZGF0ZUF0KGwuc3RhcnRzQXQpLFxuICAgICk7XG4gICAgbGV0IG1vcm5pbmcgPSAwO1xuICAgIGxldCBhZnRlcm5vb24gPSAwO1xuICAgIGZvciAoY29uc3QgeCBvZiBzYW1lKSB7XG4gICAgICBjb25zdCBoID0gbmV3IERhdGUoeC5zdGFydHNBdCAqIDEwMDApLmdldEhvdXJzKCk7XG4gICAgICBpZiAoaCA8IDEyKSBtb3JuaW5nICs9IDE7XG4gICAgICBlbHNlIGFmdGVybm9vbiArPSAxO1xuICAgIH1cbiAgICBlbnN1cmUobW9ybmluZyA8PSA0ICYmIGFmdGVybm9vbiA8PSA0LCBcIlx1OERFOFx1OTg3OVx1NzZFRVx1NkJDRlx1NTkyOVx1NjcwMFx1NTkxQVx1NEUwQVx1NTM0ODRcdTgyODJcdTMwMDFcdTRFMEJcdTUzNDg0XHU4MjgyXCIpO1xuICAgIGVuc3VyZShcbiAgICAgICFlLmxlc3NvbnMuc29tZShcbiAgICAgICAgKHgpID0+IHguaWQgIT09IGwuaWQgJiYgeC5zdGFydHNBdCA8IGwuZW5kc0F0ICYmIHguZW5kc0F0ID4gbC5zdGFydHNBdCxcbiAgICAgICksXG4gICAgICBcIlx1OERFOFx1OTg3OVx1NzZFRVx1OEJGRVx1N0EwQlx1NjVGNlx1OTVGNFx1NTFCMlx1N0E4MVwiLFxuICAgICk7XG4gICAgY29uc3QgZGF0ZSA9IGRhdGVBdChsLnN0YXJ0c0F0KTtcbiAgICBmb3IgKGNvbnN0IGIgb2YgZGF0YS5ibG9ja3MpIHtcbiAgICAgIGlmIChiLmF0dGVudGlvbiA9PT0gXCJyZXF1aXJlZFwiKSB7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICBvdmVybGFwTWludXRlc09mQmxvY2soYiwgZGF0ZSwgbWludXRlLCBtaW51dGUgKyA0NSkgPT09IDAsXG4gICAgICAgICAgXCJcdThCRkVcdTdBMEJcdTRFMEVcdTk3MDBcdTRFMTNcdTVGQzNcdTc2ODRcdTU2RkFcdTVCOUFcdTUzNjBcdTc1MjhcdTUxQjJcdTdBODFcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBhIG9mIGUuYXNzZXNzbWVudHMpIHtcbiAgICBlbnN1cmUoXG4gICAgICBlLnByb2plY3RzLnNvbWUoKHApID0+IHAucHJvamVjdElkID09PSBhLnByb2plY3RJZCksXG4gICAgICBcIkFJXHU0RjVDXHU0RTFBXHU1NDhDXHU4MDAzXHU4QkQ1XHU5NzAwXHU4OTgxXHU1NDJGXHU3NTI4XHU1RTk0XHU4QkQ1XHU2QTIxXHU1RjBGXCIsXG4gICAgKTtcbiAgICBlbnN1cmUoXG4gICAgICBbLi4uZS5zZW1lc3RlcnMsIC4uLmUuc2VtZXN0ZXJIaXN0b3J5XS5zb21lKFxuICAgICAgICAocykgPT5cbiAgICAgICAgICBzLmlkID09PSBhLnNlbWVzdGVySWQgJiZcbiAgICAgICAgICBzLnByb2plY3RJZCA9PT0gYS5wcm9qZWN0SWQgJiZcbiAgICAgICAgICBzLnJldmlzaW9uID09PSBhLnNlbWVzdGVyUmV2aXNpb24sXG4gICAgICApLFxuICAgICAgXCJcdThCRDVcdTk4OThcdTVGQzVcdTk4N0JcdTdFRDFcdTVCOUFcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcIixcbiAgICApO1xuICAgIGVuc3VyZShcbiAgICAgIGEucmV2aXNpb24gPiAwICYmXG4gICAgICAgIGEuc3RhcnRzQXQgPCBhLmVuZHNBdCAmJlxuICAgICAgICBjaGVja1RleHQoYS50aXRsZSwgNTAwMDApICYmXG4gICAgICAgIGNoZWNrVGV4dChhLnJldmlld0V2aWRlbmNlLCA1MDAwMCkgJiZcbiAgICAgICAgY2hlY2tUZXh0KGEuaW5zdHJ1Y3Rpb25zLCA1MDAwMCkgJiZcbiAgICAgICAgYS5xdWVzdGlvbnMubGVuZ3RoID4gMCxcbiAgICAgIFwiXHU1M0QxXHU1RTAzXHU1MjREXHU1RkM1XHU5ODdCXHU1MUM2XHU1OTA3XHU5ODk4XHU3NkVFXHUzMDAxXHU4MDAzXHU4QkQ1XHU4QkY0XHU2NjBFXHUzMDAxXHU3QjU0XHU2ODQ4XHU1NDhDXHU3MkVDXHU3QUNCXHU1OTBEXHU2ODM4XHU4QkIwXHU1RjU1XCIsXG4gICAgKTtcbiAgICBpZiAoYS5raW5kID09PSBcImhvbWV3b3JrXCIpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgKGEudGFza0lkID09PSBudWxsICYmXG4gICAgICAgICAgYS5sZXNzb25JZCAhPT0gbnVsbCAmJlxuICAgICAgICAgIGUubGVzc29ucy5zb21lKFxuICAgICAgICAgICAgKGwpID0+XG4gICAgICAgICAgICAgIGwuaWQgPT09IGEubGVzc29uSWQgJiZcbiAgICAgICAgICAgICAgbC5wcm9qZWN0SWQgPT09IGEucHJvamVjdElkICYmXG4gICAgICAgICAgICAgIGwuYWlFbmFibGVkICYmXG4gICAgICAgICAgICAgIGwuc3RhdGUgPT09IFwiZW5kZWRcIixcbiAgICAgICAgICApKSB8fFxuICAgICAgICAgIChhLmxlc3NvbklkID09PSBudWxsICYmXG4gICAgICAgICAgICBhLnRhc2tJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgICAgZS5jb21wbGV0ZWRUYXNrcy5zb21lKFxuICAgICAgICAgICAgICAodCkgPT4gdC5pZCA9PT0gYS50YXNrSWQgJiYgdC5wcm9qZWN0SWQgPT09IGEucHJvamVjdElkLFxuICAgICAgICAgICAgKSksXG4gICAgICAgIFwiXHU0RjVDXHU0RTFBXHU1RkM1XHU5ODdCXHU2NzY1XHU4MUVBXHU2NzJDXHU5ODc5XHU3NkVFXHU1REYyXHU3RUQzXHU2NzVGXHU3Njg0QUlcdThCRkVcdTdBMEJcdTYyMTZcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcIixcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChhLmtpbmQgPT09IFwicmV0ZXN0XCIpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgYS5yZXRlc3RPZkdyYWRlSWQgIT09IG51bGwgJiZcbiAgICAgICAgICBlLmdyYWRlcy5zb21lKChnKSA9PiB7XG4gICAgICAgICAgICBpZiAoZy5pZCAhPT0gYS5yZXRlc3RPZkdyYWRlSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiBlLnN1Ym1pc3Npb25zLnNvbWUoKHMpID0+IHtcbiAgICAgICAgICAgICAgaWYgKHMuaWQgIT09IGcuc3VibWlzc2lvbklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgIHJldHVybiBlLmFzc2Vzc21lbnRzLnNvbWUoXG4gICAgICAgICAgICAgICAgKG9yaWdpbmFsKSA9PlxuICAgICAgICAgICAgICAgICAgb3JpZ2luYWwuaWQgPT09IHMuYXNzZXNzbWVudElkICYmXG4gICAgICAgICAgICAgICAgICBvcmlnaW5hbC5wcm9qZWN0SWQgPT09IGEucHJvamVjdElkLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSksXG4gICAgICAgIFwiXHU1OTBEXHU2RDRCXHU1RkM1XHU5ODdCXHU1MTczXHU4MDU0XHU2NzJDXHU5ODc5XHU3NkVFXHU1MzlGXHU1OUNCXHU2Mjc5XHU2NTM5XCIsXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbnN1cmUoYS5yZXRlc3RPZkdyYWRlSWQgPT09IG51bGwsIFwiXHU1M0VBXHU2NzA5XHU1OTBEXHU2RDRCXHU1M0VGXHU0RUU1XHU1RjE1XHU3NTI4XHU1MzlGXHU1OUNCXHU2Mjc5XHU2NTM5XCIpO1xuICAgIH1cbiAgICBpZiAoYS5raW5kID09PSBcIndlZWtseUV4YW1cIikge1xuICAgICAgZW5zdXJlKHdlZWtkYXlNb25kYXkobG9jYWxEYXRlT2YoYS5zdGFydHNBdCkpID49IDYsIFwiXHU1NDY4XHU4MDAzXHU1Qjg5XHU2MzkyXHU1NzI4XHU1NDY4XHU2NzJCXCIpO1xuICAgIH1cbiAgICBpZiAoYS5raW5kICE9PSBcImhvbWV3b3JrXCIpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgIWUubGVzc29ucy5zb21lKFxuICAgICAgICAgIChsKSA9PiBsLnN0YXJ0c0F0IDwgYS5lbmRzQXQgJiYgbC5lbmRzQXQgPiBhLnN0YXJ0c0F0LFxuICAgICAgICApICYmXG4gICAgICAgICAgIWUuYXNzZXNzbWVudHMuc29tZShcbiAgICAgICAgICAgIChiKSA9PlxuICAgICAgICAgICAgICBiLmlkICE9PSBhLmlkICYmXG4gICAgICAgICAgICAgIGIua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICAgICAgICAgIGIuc3RhcnRzQXQgPCBhLmVuZHNBdCAmJlxuICAgICAgICAgICAgICBiLmVuZHNBdCA+IGEuc3RhcnRzQXQsXG4gICAgICAgICAgKSxcbiAgICAgICAgXCJcdTgwMDNcdThCRDVcdTRFMEVcdThCRkVcdTdBMEJcdTYyMTZcdTUxNzZcdTRFRDZcdTgwMDNcdThCRDVcdTUxQjJcdTdBODFcIixcbiAgICAgICk7XG4gICAgfVxuICAgIHVuaXF1ZUVkdWNhdGlvbklkcyhhLnF1ZXN0aW9ucy5tYXAoKHEpID0+IHEuaWQpKTtcbiAgICBmb3IgKGNvbnN0IHEgb2YgYS5xdWVzdGlvbnMpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgY2hlY2tUZXh0KHEucHJvbXB0LCA1MDAwMCkgJiZcbiAgICAgICAgICBjaGVja1RleHQocS5hbnN3ZXIsIDUwMDAwKSAmJlxuICAgICAgICAgIHEudG9waWNzLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICBxLmVzdGltYXRlZE1pbnV0ZXMgPiAwICYmXG4gICAgICAgICAgcS5zY29yaW5nLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICBxLnNvdXJjZUlkcy5sZW5ndGggPiAwICYmXG4gICAgICAgICAgcS5zb3VyY2VJZHMuZXZlcnkoKGlkKSA9PiByZXNvdXJjZShpZCwgYS5wcm9qZWN0SWQpICE9PSB1bmRlZmluZWQpLFxuICAgICAgICBcIlx1NkJDRlx1OTg5OFx1NUZDNVx1OTg3Qlx1NjcwOVx1Njc2NVx1NkU5MFx1MzAwMVx1NzdFNVx1OEJDNlx1NzBCOVx1MzAwMVx1NEYzMFx1NjVGNlx1MzAwMVx1N0I1NFx1Njg0OFx1NTQ4Q1x1OEJDNFx1NTIwNlx1NzBCOVwiLFxuICAgICAgKTtcbiAgICAgIHVuaXF1ZUVkdWNhdGlvbklkcyhxLnNjb3JpbmcubWFwKChwKSA9PiBwLmlkKSk7XG4gICAgICBmb3IgKGNvbnN0IHAgb2YgcS5zY29yaW5nKSB7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICBwLnBvaW50cyA+IDAgJiYgY2hlY2tUZXh0KHAuZGVzY3JpcHRpb24sIDUwMDAwKSxcbiAgICAgICAgICBcIlx1OEJDNFx1NTIwNlx1NzBCOVx1OTcwMFx1ODk4MVx1NTIwNlx1NTAzQ1x1NEUwRVx1NTIyNFx1NTIwNlx1NEY5RFx1NjM2RVwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKCFxLmV4dGVuc2lvbiAmJiBhLmtpbmQgIT09IFwibW9ja0V4YW1cIiAmJiBhLmtpbmQgIT09IFwicmV0ZXN0XCIpIHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIHEudG9waWNzLmV2ZXJ5KFxuICAgICAgICAgICAgKHQpID0+XG4gICAgICAgICAgICAgIGUubGVzc29ucy5zb21lKFxuICAgICAgICAgICAgICAgIChsKSA9PlxuICAgICAgICAgICAgICAgICAgbC5wcm9qZWN0SWQgPT09IGEucHJvamVjdElkICYmXG4gICAgICAgICAgICAgICAgICBsLnN0YXRlID09PSBcImVuZGVkXCIgJiZcbiAgICAgICAgICAgICAgICAgIGwudG9waWNzLmluY2x1ZGVzKHQpLFxuICAgICAgICAgICAgICApIHx8XG4gICAgICAgICAgICAgIGUuY29tcGxldGVkVGFza3Muc29tZShcbiAgICAgICAgICAgICAgICAodGFzaykgPT5cbiAgICAgICAgICAgICAgICAgIHRhc2sucHJvamVjdElkID09PSBhLnByb2plY3RJZCAmJiB0YXNrLnRvcGljcy5pbmNsdWRlcyh0KSxcbiAgICAgICAgICAgICAgKSB8fFxuICAgICAgICAgICAgICBlLnByb2dyZXNzLnNvbWUoXG4gICAgICAgICAgICAgICAgKHIpID0+XG4gICAgICAgICAgICAgICAgICByLnByb2plY3RJZCA9PT0gYS5wcm9qZWN0SWQgJiYgci5jb25maXJtZWQgJiYgci50b3BpYyA9PT0gdCxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICApLFxuICAgICAgICAgIFwiXHU1N0ZBXHU3ODQwXHU3RUMzXHU0RTYwXHU0RTBEXHU4MEZEXHU1MzA1XHU1NDJCXHU1QzFBXHU2NzJBXHU2Mzg4XHU4QkZFXHU3Njg0XHU3N0U1XHU4QkM2XHU3MEI5XHVGRjFCXHU2MkQzXHU1QzU1XHU5ODk4XHU5ODdCXHU2NjBFXHU3ODZFXHU2ODA3XHU4QkIwXCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcyBvZiBlLnN1Ym1pc3Npb25zKSB7XG4gICAgY29uc3QgYSA9IGUuYXNzZXNzbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gcy5hc3Nlc3NtZW50SWQpO1xuICAgIGVuc3VyZShhICE9PSB1bmRlZmluZWQsIFwiXHU2M0QwXHU0RUE0XHU1RjE1XHU3NTI4XHU0RTg2XHU0RTBEXHU1QjU4XHU1NzI4XHU3Njg0XHU4QkQ1XHU5ODk4XCIpO1xuICAgIGVuc3VyZShcbiAgICAgIHMucmVzb3VyY2VJZHMuZXZlcnkoKGlkKSA9PiByZXNvdXJjZShpZCwgYS5wcm9qZWN0SWQpICE9PSB1bmRlZmluZWQpLFxuICAgICAgXCJcdTdCNTRcdTUzNzdcdTk2NDRcdTRFRjZcdTVGQzVcdTk4N0JcdTVDNUVcdTRFOEVcdTY3MkNcdTk4NzlcdTc2RUVcIixcbiAgICApO1xuICAgIHVuaXF1ZUVkdWNhdGlvbklkcyhzLnF1ZXN0aW9uVGltZXMubWFwKCh0KSA9PiB0LnF1ZXN0aW9uSWQpKTtcbiAgICBmb3IgKGNvbnN0IHQgb2Ygcy5xdWVzdGlvblRpbWVzKSB7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIGEucXVlc3Rpb25zLnNvbWUoKHEpID0+IHEuaWQgPT09IHQucXVlc3Rpb25JZCkgJiZcbiAgICAgICAgICB0LmxvY2FsVGltZS5sZW5ndGggPT09IDUgJiZcbiAgICAgICAgICBtaW51dGVzT2YodC5sb2NhbFRpbWUpICE9PSBudWxsLFxuICAgICAgICBcIlx1NkJDRlx1OTg5OFx1OEJCMFx1NUY1NVx1NjcyQ1x1NjczQUhIOk1NXHU1QjhDXHU2MjEwXHU2NUY2XHU1MjNCXCIsXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IGcgb2YgZS5ncmFkZXMpIHtcbiAgICBjb25zdCBzID0gZS5zdWJtaXNzaW9ucy5maW5kKCh4KSA9PiB4LmlkID09PSBnLnN1Ym1pc3Npb25JZCk7XG4gICAgZW5zdXJlKHMgIT09IHVuZGVmaW5lZCwgXCJcdTYyNzlcdTY1MzlcdTdGM0FcdTVDMTFcdTYzRDBcdTRFQTRcdTcyNDhcdTY3MkNcIik7XG4gICAgY29uc3QgYSA9IGUuYXNzZXNzbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gcy5hc3Nlc3NtZW50SWQpO1xuICAgIGVuc3VyZShhICE9PSB1bmRlZmluZWQsIFwiXHU4QkQ1XHU5ODk4XHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgIGVuc3VyZShcbiAgICAgIGcuYXNzZXNzbWVudFJldmlzaW9uID09PSBhLnJldmlzaW9uICYmIGNoZWNrVGV4dChnLmZlZWRiYWNrLCA1MDAwMCksXG4gICAgICBcIlx1NjI3OVx1NjUzOVx1NUZDNVx1OTg3Qlx1NUYxNVx1NzUyOFx1NTNEMVx1NUUwM1x1NjVGNlx1NzY4NFx1OEJDNFx1NTIwNlx1NzI0OFx1NjcyQ1x1NUU3Nlx1N0VEOVx1NTFGQVx1NTNDRFx1OTk4OFwiLFxuICAgICk7XG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGZvciAoY29uc3QgYXdhcmQgb2YgZy5hd2FyZHMpIHtcbiAgICAgIGNvbnN0IHBvaW50ID0gYS5xdWVzdGlvbnNcbiAgICAgICAgLmZpbmQoKHEpID0+IHEuaWQgPT09IGF3YXJkLnF1ZXN0aW9uSWQpXG4gICAgICAgID8uc2NvcmluZy5maW5kKChwKSA9PiBwLmlkID09PSBhd2FyZC5wb2ludElkKTtcbiAgICAgIGVuc3VyZShwb2ludCAhPT0gdW5kZWZpbmVkLCBcIlx1NjI3OVx1NjUzOVx1NEUwRFx1ODBGRFx1NEUzNFx1NjVGNlx1NTg5RVx1NTJBMFx1OEJDNFx1NTIwNlx1NzBCOVwiKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgYXdhcmQuYXdhcmRlZCA8PSBwb2ludC5wb2ludHMgJiZcbiAgICAgICAgICBjaGVja1RleHQoYXdhcmQuZXZpZGVuY2UsIDUwMDAwKSAmJlxuICAgICAgICAgICFzZWVuLmhhcyhgJHthd2FyZC5xdWVzdGlvbklkfXwke2F3YXJkLnBvaW50SWR9YCksXG4gICAgICAgIFwiXHU4QkM0XHU1MjA2XHU4RDg1XHU4MzAzXHU1NkY0XHUzMDAxXHU5MUNEXHU1OTBEXHU2MjE2XHU3RjNBXHU1QzExXHU3QjU0XHU1Mzc3XHU4QkMxXHU2MzZFXCIsXG4gICAgICApO1xuICAgICAgc2Vlbi5hZGQoYCR7YXdhcmQucXVlc3Rpb25JZH18JHthd2FyZC5wb2ludElkfWApO1xuICAgIH1cbiAgICBjb25zdCB0b3RhbFBvaW50cyA9IGEucXVlc3Rpb25zLnJlZHVjZSgobiwgcSkgPT4gbiArIHEuc2NvcmluZy5sZW5ndGgsIDApO1xuICAgIGVuc3VyZShcbiAgICAgIGcubmVlZHNSZXZpZXcgfHwgZy5hd2FyZHMubGVuZ3RoID09PSB0b3RhbFBvaW50cyxcbiAgICAgIFwiXHU2QjYzXHU1RjBGXHU2Mjc5XHU2NTM5XHU1RkM1XHU5ODdCXHU4OTg2XHU3NkQ2XHU1MTY4XHU5MEU4XHU4QkM0XHU1MjA2XHU3MEI5XHVGRjFCXHU4QkM2XHU1MjJCXHU0RTBEXHU2RTA1XHU4QkY3XHU2ODA3XHU4QkIwXHU1Rjg1XHU1OTBEXHU2ODM4XCIsXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGcuZXJyb3JzKSB7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIGEucXVlc3Rpb25zLnNvbWUoKHEpID0+IHEuaWQgPT09IGVycm9yLnF1ZXN0aW9uSWQpICYmXG4gICAgICAgICAgY2hlY2tUZXh0KGVycm9yLmNhdXNlLCA1MDAwMCkgJiZcbiAgICAgICAgICBjaGVja1RleHQoZXJyb3IuZXZpZGVuY2UsIDUwMDAwKSAmJlxuICAgICAgICAgIGNoZWNrVGV4dChlcnJvci5jb3JyZWN0aW9uLCA1MDAwMCkgJiZcbiAgICAgICAgICBjaGVja1RleHQoZXJyb3IubmV4dENoZWNrLCA1MDAwMCkgJiZcbiAgICAgICAgICB2YWxpZEVkdWNhdGlvbkRhdGUoZXJyb3IucmV0ZXN0RGF0ZSksXG4gICAgICAgIFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXHU5NzAwXHU4OTgxXHU4QkMxXHU2MzZFXHUzMDAxXHU3RUEwXHU2QjYzXHU1MkE4XHU0RjVDXHU1NDhDXHU1OTBEXHU2RDRCXHU2NUU1XHU2NzFGXCIsXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHIgb2YgZS5yZXZpZXdzKSB7XG4gICAgZW5zdXJlKFxuICAgICAgcHJvamVjdEV4aXN0cyhyLnByb2plY3RJZCkgJiZcbiAgICAgICAgdmFsaWRFZHVjYXRpb25EYXRlKHIuZGF0ZSkgJiZcbiAgICAgICAgY2hlY2tUZXh0KHIuZmluZGluZ3MsIDUwMDAwKSAmJlxuICAgICAgICByLmFjdGlvbnMubGVuZ3RoID4gMCAmJlxuICAgICAgICByLmdyYWRlSWRzLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgci5ncmFkZUlkcy5ldmVyeSgoaWQpID0+XG4gICAgICAgICAgZS5ncmFkZXMuc29tZSgoZykgPT4ge1xuICAgICAgICAgICAgaWYgKGcuaWQgIT09IGlkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gZS5zdWJtaXNzaW9ucy5zb21lKChzKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChzLmlkICE9PSBnLnN1Ym1pc3Npb25JZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICByZXR1cm4gZS5hc3Nlc3NtZW50cy5zb21lKFxuICAgICAgICAgICAgICAgIChhKSA9PiBhLmlkID09PSBzLmFzc2Vzc21lbnRJZCAmJiBhLnByb2plY3RJZCA9PT0gci5wcm9qZWN0SWQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKSxcbiAgICAgIFwiXHU1OTBEXHU3NkQ4XHU1RkM1XHU5ODdCXHU1RjE1XHU3NTI4XHU2NzJDXHU5ODc5XHU3NkVFXHU2Mjc5XHU2NTM5XHU1RTc2XHU3RUQ5XHU1MUZBXHU1NDBFXHU3RUVEXHU4ODRDXHU1MkE4XCIsXG4gICAgKTtcbiAgfVxuICBmb3IgKGNvbnN0IGV2ZW50IG9mIGUuZXZlbnRzKSB7XG4gICAgZW5zdXJlKFxuICAgICAgcHJvamVjdEV4aXN0cyhldmVudC5wcm9qZWN0SWQpICYmXG4gICAgICAgIFtcInBlbmRpbmdcIiwgXCJydW5uaW5nXCIsIFwiZG9uZVwiXS5pbmNsdWRlcyhldmVudC5zdGF0ZSkgJiZcbiAgICAgICAgW1xuICAgICAgICAgIFwiaG9tZXdvcmtcIixcbiAgICAgICAgICBcInRhc2tIb21ld29ya1wiLFxuICAgICAgICAgIFwiZ3JhZGVcIixcbiAgICAgICAgICBcImNvcnJlY3Rpb25cIixcbiAgICAgICAgICBcInJldmlld1wiLFxuICAgICAgICAgIFwid2Vla2x5RXhhbVwiLFxuICAgICAgICBdLmluY2x1ZGVzKGV2ZW50LmtpbmQpLFxuICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcIixcbiAgICApO1xuICB9XG4gIHZhbGlkYXRlTGVhcm5pbmcoZGF0YSk7XG59XG5cbmZ1bmN0aW9uIHVuaXF1ZUVkdWNhdGlvbklkcyhpZHM6IHN0cmluZ1tdKTogdm9pZCB7XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBpZCBvZiBpZHMpIHtcbiAgICBlbnN1cmUoXG4gICAgICBpZC50cmltKCkubGVuZ3RoID4gMCAmJiBpZC5sZW5ndGggPD0gMjAwICYmICFzZWVuLmhhcyhpZCksXG4gICAgICBcIlx1NjU1OVx1NUI2Nlx1NUI5RVx1NEY1MyBJRCBcdTRFM0FcdTdBN0FcdTMwMDFcdThGQzdcdTk1N0ZcdTYyMTZcdTkxQ0RcdTU5MERcIixcbiAgICApO1xuICAgIHNlZW4uYWRkKGlkKTtcbiAgfVxufVxuXG4vKiogXHU1QkZDXHU1MTY1XHU1M0VGXHU2MDYyXHU1OTBEXHU4QkIwXHU1RjU1XHVGRjBDXHU0RjQ2XHU0RTBEXHU1Rjk3XHU5NzU5XHU5RUQ4XHU2NTM5XHU1MTk5XHU1REYyXHU1M0QxXHU1RTAzXHU5ODk4XHU3NkVFXHU2MjE2XHU1Mzg2XHU1M0YyXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVFZHVjYXRpb25UcmFuc2l0aW9uKFxuICBiZWZvcmU6IEVkdWNhdGlvbixcbiAgYWZ0ZXI6IEVkdWNhdGlvbixcbik6IHZvaWQge1xuICB2YWxpZGF0ZUxlYXJuaW5nVHJhbnNpdGlvbihiZWZvcmUsIGFmdGVyKTtcbiAgZm9yIChjb25zdCBsaW5rIG9mIGJlZm9yZS5mb2N1c1Rhc2tzKSB7XG4gICAgZW5zdXJlKFxuICAgICAgYWZ0ZXIuZm9jdXNUYXNrcy5zb21lKFxuICAgICAgICAoeCkgPT5cbiAgICAgICAgICB4LnRhc2tJZCA9PT0gbGluay50YXNrSWQgJiZcbiAgICAgICAgICB4LnNvdXJjZUlkID09PSBsaW5rLnNvdXJjZUlkICYmXG4gICAgICAgICAgeC5raW5kID09PSBsaW5rLmtpbmQsXG4gICAgICApLFxuICAgICAgXCJcdTVERjJcdTVFRkFcdTdBQ0JcdTc2ODRcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTY3NjVcdTZFOTBcdTUxNzNcdTgwNTRcdTRFMERcdTgwRkRcdTUyMjBcdTk2NjRcdTYyMTZcdTY1MzlcdTUxOTlcIixcbiAgICApO1xuICB9XG4gIGNvbnN0IGFjdGl2ZVJlc291cmNlcyA9IG5ldyBTZXQoYWZ0ZXIucmVzb3VyY2VzLm1hcCgocikgPT4gci5pZCkpO1xuICBjb25zdCByZWZlcmVuY2VzID0gYmVmb3JlLnJlc291cmNlUmVmZXJlbmNlSW5kZXgoKTtcbiAgZm9yIChjb25zdCByZXNvdXJjZSBvZiBiZWZvcmUucmVzb3VyY2VzKSB7XG4gICAgaWYgKCFhY3RpdmVSZXNvdXJjZXMuaGFzKHJlc291cmNlLmlkKSkge1xuICAgICAgZW5zdXJlKFxuICAgICAgICAhcmVmZXJlbmNlcy5oYXMocmVzb3VyY2UuaWQpLFxuICAgICAgICBcIlx1NjU1OVx1NUI2Nlx1NTM4Nlx1NTNGMlx1NUYxNVx1NzUyOFx1NzY4NFx1OEQ0NFx1NkU5MFx1NzY3Qlx1OEJCMFx1NEUwRFx1ODBGRFx1NTIyMFx1OTY2NFx1RkYwQ1x1OEJGN1x1NEZFRVx1NTkwRFx1OERFRlx1NUY4NFwiLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBhIG9mIGJlZm9yZS5hc3Nlc3NtZW50cykge1xuICAgIGVuc3VyZShcbiAgICAgIGFmdGVyLmFzc2Vzc21lbnRzLnNvbWUoKGIpID0+IGIuaWQgPT09IGEuaWQpLFxuICAgICAgXCJcdTVERjJcdTUzRDFcdTVFMDNcdThCRDVcdTUzNzdcdTRFMERcdTgwRkRcdTUyMjBcdTk2NjRcIixcbiAgICApO1xuICAgIGNvbnN0IGIgPSBhZnRlci5hc3Nlc3NtZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBhLmlkKTtcbiAgICBpZiAoYiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBvbGQgPSBjbG9uZUFzc2Vzc21lbnQoYSk7XG4gICAgICBvbGQucHJpbnRlZEF0ID0gYi5wcmludGVkQXQ7XG4gICAgICBvbGQuc3RhcnRlZEF0ID0gYi5zdGFydGVkQXQ7XG4gICAgICBvbGQuc3RvcHBlZEF0ID0gYi5zdG9wcGVkQXQ7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIGFzc2Vzc21lbnRFcXVhbHMob2xkLCBiKSxcbiAgICAgICAgXCJcdTVERjJcdTUzRDFcdTVFMDNcdTk4OThcdTc2RUVcdTRFMEVcdThCQzRcdTUyMDZcdTY4MDdcdTUxQzZcdTRFMERcdTUzRUZcdTg4QUJcdTVCRkNcdTUxNjVcdTYyMTZcdTg4NjVcdTRFMDFcdTY1MzlcdTUxOTlcIixcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcyBvZiBiZWZvcmUuc3VibWlzc2lvbnMpIHtcbiAgICBjb25zdCBiID0gYWZ0ZXIuc3VibWlzc2lvbnMuZmluZCgoeCkgPT4geC5pZCA9PT0gcy5pZCk7XG4gICAgZW5zdXJlKFxuICAgICAgYiAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICgoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgb2xkID0gY2xvbmVTdWJtaXNzaW9uKHMpO1xuICAgICAgICAgIG9sZC5xdWVzdGlvblRpbWVzID0gYi5xdWVzdGlvblRpbWVzLm1hcCgodCkgPT4gKHsgLi4udCB9KSk7XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIHN1Ym1pc3Npb25FcXVhbHMob2xkLCBiKSAmJlxuICAgICAgICAgICAgc3RhcnRzV2l0aFF1ZXN0aW9uVGltZXMoYi5xdWVzdGlvblRpbWVzLCBzLnF1ZXN0aW9uVGltZXMpICYmXG4gICAgICAgICAgICAoYi5xdWVzdGlvblRpbWVzLmxlbmd0aCA9PT0gcy5xdWVzdGlvblRpbWVzLmxlbmd0aCB8fFxuICAgICAgICAgICAgICAhYmVmb3JlLmdyYWRlcy5zb21lKChnKSA9PiBnLnN1Ym1pc3Npb25JZCA9PT0gcy5pZCkpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSkoKSxcbiAgICAgIFwiXHU2M0QwXHU0RUE0XHU1Mzg2XHU1M0YyXHU0RTBEXHU1M0VGXHU2NTM5XHU1MTk5XHVGRjFCXHU1M0VBXHU4MEZEXHU1NzI4XHU2Mjc5XHU2NTM5XHU1MjREXHU4ODY1XHU1MTQ1XHU3RjNBXHU1OTMxXHU3Njg0XHU1QjhDXHU2MjEwXHU2NUY2XHU1MjNCXCIsXG4gICAgKTtcbiAgfVxuICBmb3IgKGNvbnN0IGcgb2YgYmVmb3JlLmdyYWRlcykge1xuICAgIGNvbnN0IGIgPSBhZnRlci5ncmFkZXMuZmluZCgoeCkgPT4geC5pZCA9PT0gZy5pZCk7XG4gICAgZW5zdXJlKGIgIT09IHVuZGVmaW5lZCAmJiBncmFkZUVxdWFscyhiLCBnKSwgXCJcdTYyNzlcdTY1MzlcdTUzODZcdTUzRjJcdTRFMERcdTUzRUZcdTY1MzlcdTUxOTlcIik7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xvbmVBc3Nlc3NtZW50KGE6IEFzc2Vzc21lbnQpOiBBc3Nlc3NtZW50IHtcbiAgcmV0dXJuIHtcbiAgICAuLi5hLFxuICAgIHF1ZXN0aW9uczogYS5xdWVzdGlvbnMubWFwKChxKSA9PiAoe1xuICAgICAgLi4ucSxcbiAgICAgIHRvcGljczogWy4uLnEudG9waWNzXSxcbiAgICAgIHNvdXJjZUlkczogWy4uLnEuc291cmNlSWRzXSxcbiAgICAgIHNjb3Jpbmc6IHEuc2NvcmluZy5tYXAoKHApID0+ICh7IC4uLnAgfSkpLFxuICAgIH0pKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY2xvbmVTdWJtaXNzaW9uKHM6IFN1Ym1pc3Npb24pOiBTdWJtaXNzaW9uIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5zLFxuICAgIHJlc291cmNlSWRzOiBbLi4ucy5yZXNvdXJjZUlkc10sXG4gICAgcXVlc3Rpb25UaW1lczogcy5xdWVzdGlvblRpbWVzLm1hcCgodCkgPT4gKHsgLi4udCB9KSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGFzc2Vzc21lbnRFcXVhbHMoYTogQXNzZXNzbWVudCwgYjogQXNzZXNzbWVudCk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZUFzc2Vzc21lbnQoYSkpID09PVxuICAgIEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZUFzc2Vzc21lbnQoYikpXG4gICk7XG59XG5cbmZ1bmN0aW9uIHN1Ym1pc3Npb25FcXVhbHMoYTogU3VibWlzc2lvbiwgYjogU3VibWlzc2lvbik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZVN1Ym1pc3Npb24oYSkpID09PVxuICAgIEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZVN1Ym1pc3Npb24oYikpXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdyYWRlRXF1YWxzKGE6IEdyYWRlLCBiOiBHcmFkZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZUdyYWRlKGEpKSA9PT0gSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplR3JhZGUoYikpXG4gICk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0c1dpdGhRdWVzdGlvblRpbWVzKFxuICBsaXN0OiBRdWVzdGlvblRpbWVbXSxcbiAgcHJlZml4OiBRdWVzdGlvblRpbWVbXSxcbik6IGJvb2xlYW4ge1xuICByZXR1cm4gcHJlZml4LmV2ZXJ5KFxuICAgIChwLCBpKSA9PlxuICAgICAgbGlzdFtpXSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICBsaXN0W2ldIS5xdWVzdGlvbklkID09PSBwLnF1ZXN0aW9uSWQgJiZcbiAgICAgIGxpc3RbaV0hLmxvY2FsVGltZSA9PT0gcC5sb2NhbFRpbWUsXG4gICk7XG59XG5cbi8vIC0tLS0tLS0tLS0gRWR1Y2F0aW9uIFx1ODlFM1x1Njc5MC9cdTVFOEZcdTUyMTdcdTUzMTYgLS0tLS0tLS0tLVxuXG5jb25zdCBFRFVDQVRJT05fS0VZUyA9IFtcbiAgXCJmb2N1c1Rhc2tzXCIsXG4gIFwicHJvamVjdHNcIixcbiAgXCJyZXNvdXJjZXNcIixcbiAgXCJzZW1lc3RlcnNcIixcbiAgXCJzZW1lc3Rlckhpc3RvcnlcIixcbiAgXCJsZXNzb25zXCIsXG4gIFwiYXNzZXNzbWVudHNcIixcbiAgXCJzdWJtaXNzaW9uc1wiLFxuICBcImdyYWRlc1wiLFxuICBcInJldmlld3NcIixcbiAgXCJldmVudHNcIixcbiAgXCJjb21wbGV0ZWRUYXNrc1wiLFxuICBcInByb2dyZXNzXCIsXG4gIFwiY29ycmVjdGlvbnNcIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUVkdWNhdGlvbihyYXc6IHVua25vd24pOiBFZHVjYXRpb24ge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5FRFVDQVRJT05fS0VZU10sIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIpO1xuICBjb25zdCBlID0gbmV3IEVkdWNhdGlvbigpO1xuICBlLmZvY3VzVGFza3MgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJmb2N1c1Rhc2tzXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT5cbiAgICAgIGFzQXJyYXkodiwgXCJmb2N1c1Rhc2tzXCIpLm1hcCgoeCkgPT4ge1xuICAgICAgICBlbnN1cmUoaXNPYmplY3QoeCksIFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHU1MTczXHU4MDU0XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICAgICAgICByZWplY3RVbmtub3duKHgsIFtcInRhc2tJZFwiLCBcInNvdXJjZUlkXCIsIFwia2luZFwiXSwgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTUxNzNcdTgwNTRcIik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdGFza0lkOiByZXF1aXJlZEZpZWxkKHgsIFwidGFza0lkXCIsIFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHU1MTczXHU4MDU0XCIsIGFzU3RyKSxcbiAgICAgICAgICBzb3VyY2VJZDogcmVxdWlyZWRGaWVsZCh4LCBcInNvdXJjZUlkXCIsIFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHU1MTczXHU4MDU0XCIsIGFzU3RyKSxcbiAgICAgICAgICBraW5kOiBvbmVPZihcbiAgICAgICAgICAgIHJlcXVpcmVkRmllbGQoeCwgXCJraW5kXCIsIFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHU1MTczXHU4MDU0XCIsIChrKSA9PiBrKSxcbiAgICAgICAgICAgIFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFIGtpbmRcIixcbiAgICAgICAgICAgIFtcImxlc3NvblwiLCBcImhvbWV3b3JrXCJdLFxuICAgICAgICAgICkgYXMgXCJsZXNzb25cIiB8IFwiaG9tZXdvcmtcIixcbiAgICAgICAgfTtcbiAgICAgIH0pLFxuICAgIFtdLFxuICApO1xuICBlLnByb2plY3RzID0gZmllbGQoXG4gICAgcmF3LFxuICAgIFwicHJvamVjdHNcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwicHJvamVjdHNcIikubWFwKHBhcnNlUHJvamVjdFN0dWR5KSxcbiAgICBbXSxcbiAgKTtcbiAgZS5yZXNvdXJjZXMgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJyZXNvdXJjZXNcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwicmVzb3VyY2VzXCIpLm1hcChwYXJzZVJlc291cmNlKSxcbiAgICBbXSxcbiAgKTtcbiAgZS5zZW1lc3RlcnMgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJzZW1lc3RlcnNcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwic2VtZXN0ZXJzXCIpLm1hcChwYXJzZVNlbWVzdGVyKSxcbiAgICBbXSxcbiAgKTtcbiAgZS5zZW1lc3Rlckhpc3RvcnkgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJzZW1lc3Rlckhpc3RvcnlcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwic2VtZXN0ZXJIaXN0b3J5XCIpLm1hcChwYXJzZVNlbWVzdGVyKSxcbiAgICBbXSxcbiAgKTtcbiAgZS5sZXNzb25zID0gZmllbGQoXG4gICAgcmF3LFxuICAgIFwibGVzc29uc1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJsZXNzb25zXCIpLm1hcChwYXJzZUxlc3NvbiksXG4gICAgW10sXG4gICk7XG4gIGUuYXNzZXNzbWVudHMgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJhc3Nlc3NtZW50c1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJhc3Nlc3NtZW50c1wiKS5tYXAocGFyc2VBc3Nlc3NtZW50KSxcbiAgICBbXSxcbiAgKTtcbiAgZS5zdWJtaXNzaW9ucyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcInN1Ym1pc3Npb25zXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT4gYXNBcnJheSh2LCBcInN1Ym1pc3Npb25zXCIpLm1hcChwYXJzZVN1Ym1pc3Npb24pLFxuICAgIFtdLFxuICApO1xuICBlLmdyYWRlcyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcImdyYWRlc1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJncmFkZXNcIikubWFwKHBhcnNlR3JhZGUpLFxuICAgIFtdLFxuICApO1xuICBlLnJldmlld3MgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJyZXZpZXdzXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT4gYXNBcnJheSh2LCBcInJldmlld3NcIikubWFwKHBhcnNlUmV2aWV3KSxcbiAgICBbXSxcbiAgKTtcbiAgZS5ldmVudHMgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJldmVudHNcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwiZXZlbnRzXCIpLm1hcChwYXJzZVRlYWNoaW5nRXZlbnQpLFxuICAgIFtdLFxuICApO1xuICBlLmNvbXBsZXRlZFRhc2tzID0gZmllbGQoXG4gICAgcmF3LFxuICAgIFwiY29tcGxldGVkVGFza3NcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwiY29tcGxldGVkVGFza3NcIikubWFwKHBhcnNlQ29tcGxldGVkU3R1ZHlUYXNrKSxcbiAgICBbXSxcbiAgKTtcbiAgZS5wcm9ncmVzcyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcInByb2dyZXNzXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT4gYXNBcnJheSh2LCBcInByb2dyZXNzXCIpLm1hcChwYXJzZVByb2dyZXNzUmVjb3JkKSxcbiAgICBbXSxcbiAgKTtcbiAgZS5jb3JyZWN0aW9ucyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcImNvcnJlY3Rpb25zXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT4gYXNBcnJheSh2LCBcImNvcnJlY3Rpb25zXCIpLm1hcChwYXJzZUNvcnJlY3Rpb24pLFxuICAgIFtdLFxuICApO1xuICByZXR1cm4gZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUVkdWNhdGlvbihlOiBFZHVjYXRpb24pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgZm9jdXNUYXNrczogZS5mb2N1c1Rhc2tzLm1hcCgodCkgPT4gKHtcbiAgICAgIHRhc2tJZDogdC50YXNrSWQsXG4gICAgICBzb3VyY2VJZDogdC5zb3VyY2VJZCxcbiAgICAgIGtpbmQ6IHQua2luZCxcbiAgICB9KSksXG4gICAgcHJvamVjdHM6IGUucHJvamVjdHMubWFwKHNlcmlhbGl6ZVByb2plY3RTdHVkeSksXG4gICAgcmVzb3VyY2VzOiBlLnJlc291cmNlcy5tYXAoc2VyaWFsaXplUmVzb3VyY2UpLFxuICAgIHNlbWVzdGVyczogZS5zZW1lc3RlcnMubWFwKHNlcmlhbGl6ZVNlbWVzdGVyKSxcbiAgICBzZW1lc3Rlckhpc3Rvcnk6IGUuc2VtZXN0ZXJIaXN0b3J5Lm1hcChzZXJpYWxpemVTZW1lc3RlciksXG4gICAgbGVzc29uczogZS5sZXNzb25zLm1hcChzZXJpYWxpemVMZXNzb24pLFxuICAgIGFzc2Vzc21lbnRzOiBlLmFzc2Vzc21lbnRzLm1hcChzZXJpYWxpemVBc3Nlc3NtZW50KSxcbiAgICBzdWJtaXNzaW9uczogZS5zdWJtaXNzaW9ucy5tYXAoc2VyaWFsaXplU3VibWlzc2lvbiksXG4gICAgZ3JhZGVzOiBlLmdyYWRlcy5tYXAoc2VyaWFsaXplR3JhZGUpLFxuICAgIHJldmlld3M6IGUucmV2aWV3cy5tYXAoc2VyaWFsaXplUmV2aWV3KSxcbiAgICBldmVudHM6IGUuZXZlbnRzLm1hcChzZXJpYWxpemVUZWFjaGluZ0V2ZW50KSxcbiAgICBjb21wbGV0ZWRUYXNrczogZS5jb21wbGV0ZWRUYXNrcy5tYXAoc2VyaWFsaXplQ29tcGxldGVkU3R1ZHlUYXNrKSxcbiAgICBwcm9ncmVzczogZS5wcm9ncmVzcy5tYXAoc2VyaWFsaXplUHJvZ3Jlc3NSZWNvcmQpLFxuICAgIGNvcnJlY3Rpb25zOiBlLmNvcnJlY3Rpb25zLm1hcChzZXJpYWxpemVDb3JyZWN0aW9uKSxcbiAgfTtcbn1cbiIsICIvLyEgXHU2NTU5XHU1QjY2XHU2MjY3XHU4ODRDXHVGRjFBXHU4QkZFXHU3QTBCL1x1NEY1Q1x1NEUxQVx1NTIzMFx1NjY2RVx1OTAxQVx1NUY4NVx1NTI5RVx1NzY4NFx1NEUwMFx1NUJGOVx1NEUwMFx1Njc2NVx1NkU5MFx1NTE3M1x1ODA1NFx1MzAwMVx1NjUzOVx1NjcxRlx1NjZGNFx1NjVCMFx1MzAwMVx1NjYwRVx1Nzg2RVx1NTNDMlx1NEUwRVx1MzAwMVxuLy8hIFx1NjNEMFx1NEVBNFx1NUI4Q1x1NjIxMFx1NEUwRVx1OTFDRFx1NTkwRFx1NEY1Q1x1NEUxQVx1NjI5MVx1NTIzNlx1RkYxQlx1OEJBMVx1NTIxMlx1NUJGQ1x1NTFGQVx1NjM5Mlx1OTY2NFx1NUU3Nlx1NEZERFx1NzU1OVx1NjU1OVx1NUI2Nlx1NUY4NVx1NTI5RVx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvdGVhY2hpbmdfdGFza3MucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IsIGVuc3VyZSB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHsgaWQgfSBmcm9tIFwiLi9pZHNcIjtcbmltcG9ydCB0eXBlIHsgQXBwRGF0YSB9IGZyb20gXCIuL2xpYlwiO1xuaW1wb3J0IHR5cGUgeyBUZWFjaGluZ1Rhc2ssIFRlYWNoaW5nVGFza0tpbmQgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgZGF0ZUF0LCBob3VyTWludXRlU3RyaW5nIH0gZnJvbSBcIi4vdGltZVwiO1xuaW1wb3J0IHsgcmVjb3JkU2Vzc2lvbiwgcmVzZXRUbywgc3RhcnRUaW1lciB9IGZyb20gXCIuL3JlbWluZGVyc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gdGVhY2hpbmdUYXNrKFxuICBkYXRhOiBBcHBEYXRhLFxuICB0YXNrSWQ6IHN0cmluZyxcbik6IFRlYWNoaW5nVGFzayB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBkYXRhLmVkdWNhdGlvbi5mb2N1c1Rhc2tzLmZpbmQoKGxpbmspID0+IGxpbmsudGFza0lkID09PSB0YXNrSWQpO1xufVxuXG4vKiogXHU2NTU5XHU1QjY2XHU2NzY1XHU2RTkwXHU2MkU1XHU2NzA5XHU1Qjg5XHU2MzkyXHVGRjFBXHU4QkZFXHU3QTBCL1x1NEY1Q1x1NEUxQVx1NzUxRlx1NjIxMFx1NjIxNlx1NjZGNFx1NjVCMFx1NjY2RVx1OTAxQVx1NUY4NVx1NTI5RVx1RkYwQ1x1NjUzOVx1NjcxRlx1NjUzOVx1NTE4NVx1NUJCOVx1OTY4Rlx1Njc2NVx1NkU5MFx1OEQ3MFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGVyaWFsaXplVGVhY2hpbmdUYXNrcyhkYXRhOiBBcHBEYXRhLCBhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gIGNvbnN0IGVuYWJsZWQgPSBuZXcgU2V0KFxuICAgIGRhdGEuZWR1Y2F0aW9uLnByb2plY3RzLmZpbHRlcigocCkgPT4gcC5leGFtTW9kZSkubWFwKChwKSA9PiBwLnByb2plY3RJZCksXG4gICk7XG4gIGNvbnN0IHNvdXJjZXM6IHtcbiAgICBraW5kOiBUZWFjaGluZ1Rhc2tLaW5kO1xuICAgIHNvdXJjZUlkOiBzdHJpbmc7XG4gICAgcHJvamVjdElkOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBub3Rlczogc3RyaW5nO1xuICAgIHN0YXJ0c0F0OiBudW1iZXI7XG4gICAgbWludXRlczogbnVtYmVyO1xuICB9W10gPSBbXTtcbiAgZm9yIChjb25zdCBsZXNzb24gb2YgZGF0YS5lZHVjYXRpb24ubGVzc29ucykge1xuICAgIGlmIChcbiAgICAgIGVuYWJsZWQuaGFzKGxlc3Nvbi5wcm9qZWN0SWQpICYmXG4gICAgICBkYXRlQXQobGVzc29uLnN0YXJ0c0F0KSA+PSBkYXRlQXQoYXQpXG4gICAgKSB7XG4gICAgICBzb3VyY2VzLnB1c2goe1xuICAgICAgICBraW5kOiBcImxlc3NvblwiLFxuICAgICAgICBzb3VyY2VJZDogbGVzc29uLmlkLFxuICAgICAgICBwcm9qZWN0SWQ6IGxlc3Nvbi5wcm9qZWN0SWQsXG4gICAgICAgIHRpdGxlOiBsZXNzb24udGl0bGUsXG4gICAgICAgIG5vdGVzOiBsZXNzb24udG9waWNzLmpvaW4oXCJcdTMwMDFcIiksXG4gICAgICAgIHN0YXJ0c0F0OiBsZXNzb24uc3RhcnRzQXQsXG4gICAgICAgIG1pbnV0ZXM6IDQ1LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcGFwZXIgb2YgZGF0YS5lZHVjYXRpb24uYXNzZXNzbWVudHMpIHtcbiAgICBpZiAocGFwZXIua2luZCA9PT0gXCJob21ld29ya1wiICYmIGVuYWJsZWQuaGFzKHBhcGVyLnByb2plY3RJZCkpIHtcbiAgICAgIGxldCBtaW51dGVzID0gMDtcbiAgICAgIGZvciAoY29uc3QgcSBvZiBwYXBlci5xdWVzdGlvbnMpIHtcbiAgICAgICAgbWludXRlcyA9IE1hdGgubWluKDQyOTQ5NjcyOTUsIG1pbnV0ZXMgKyBxLmVzdGltYXRlZE1pbnV0ZXMpO1xuICAgICAgfVxuICAgICAgc291cmNlcy5wdXNoKHtcbiAgICAgICAga2luZDogXCJob21ld29ya1wiLFxuICAgICAgICBzb3VyY2VJZDogcGFwZXIuaWQsXG4gICAgICAgIHByb2plY3RJZDogcGFwZXIucHJvamVjdElkLFxuICAgICAgICB0aXRsZTogcGFwZXIudGl0bGUsXG4gICAgICAgIG5vdGVzOiBwYXBlci5pbnN0cnVjdGlvbnMsXG4gICAgICAgIHN0YXJ0c0F0OiBwYXBlci5zdGFydHNBdCxcbiAgICAgICAgbWludXRlczogTWF0aC5tYXgoMSwgbWludXRlcyksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY29uc3QgbGlua3MgPSBuZXcgTWFwPHN0cmluZywgVGVhY2hpbmdUYXNrPigpO1xuICBmb3IgKGNvbnN0IGxpbmsgb2YgZGF0YS5lZHVjYXRpb24uZm9jdXNUYXNrcykge1xuICAgIGxpbmtzLnNldChsaW5rLnNvdXJjZUlkLCBsaW5rKTtcbiAgfVxuICBjb25zdCBwb3NpdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBkYXRhLnRhc2tzLmZvckVhY2goKHRhc2ssIGkpID0+IHBvc2l0aW9ucy5zZXQodGFzay5pZCwgaSkpO1xuICBjb25zdCBzdWJtaXNzaW9ucyA9IG5ldyBNYXA8XG4gICAgc3RyaW5nLFxuICAgIHsgc3VibWl0dGVkQXQ6IG51bWJlcjsgdW5maW5pc2hlZDogYm9vbGVhbiB9XG4gID4oKTtcbiAgZm9yIChjb25zdCBzdWJtaXNzaW9uIG9mIGRhdGEuZWR1Y2F0aW9uLnN1Ym1pc3Npb25zKSB7XG4gICAgY29uc3QgbGFzdCA9IHN1Ym1pc3Npb25zLmdldChzdWJtaXNzaW9uLmFzc2Vzc21lbnRJZCk7XG4gICAgaWYgKGxhc3QgPT09IHVuZGVmaW5lZCB8fCBzdWJtaXNzaW9uLnN1Ym1pdHRlZEF0ID49IGxhc3Quc3VibWl0dGVkQXQpIHtcbiAgICAgIHN1Ym1pc3Npb25zLnNldChzdWJtaXNzaW9uLmFzc2Vzc21lbnRJZCwge1xuICAgICAgICBzdWJtaXR0ZWRBdDogc3VibWlzc2lvbi5zdWJtaXR0ZWRBdCxcbiAgICAgICAgdW5maW5pc2hlZDogc3VibWlzc2lvbi51bmZpbmlzaGVkLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gIGZvciAoY29uc3Qge1xuICAgIGtpbmQsXG4gICAgc291cmNlSWQsXG4gICAgcHJvamVjdElkLFxuICAgIHRpdGxlLFxuICAgIG5vdGVzLFxuICAgIHN0YXJ0c0F0LFxuICAgIG1pbnV0ZXMsXG4gIH0gb2Ygc291cmNlcykge1xuICAgIGNvbnN0IGxpbmsgPSBsaW5rcy5nZXQoc291cmNlSWQpO1xuICAgIGNvbnN0IHRhc2tJZCA9XG4gICAgICBsaW5rICE9PSB1bmRlZmluZWQgJiYgbGluay5raW5kID09PSBraW5kID8gbGluay50YXNrSWQgOiB1bmRlZmluZWQ7XG4gICAgY29uc3QgcG9zaXRpb24gPSB0YXNrSWQgIT09IHVuZGVmaW5lZCA/IHBvc2l0aW9ucy5nZXQodGFza0lkKSA6IHVuZGVmaW5lZDtcbiAgICBpZiAodGFza0lkICE9PSB1bmRlZmluZWQgJiYgcG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGR1ZURhdGUgPSBkYXRlQXQoc3RhcnRzQXQpO1xuICAgIGNvbnN0IGlzTGVzc29uID0ga2luZCA9PT0gXCJsZXNzb25cIjtcbiAgICBjb25zdCByZW1pbmRlciA9IGlzTGVzc29uID8gaG91ck1pbnV0ZVN0cmluZyhzdGFydHNBdCkgOiBudWxsO1xuICAgIGNvbnN0IGZvY3VzID0gaXNMZXNzb24gPyA0NSA6IE1hdGgubWluKG1pbnV0ZXMsIGRhdGEuc2V0dGluZ3MuZm9jdXNNaW51dGVzKTtcbiAgICBjb25zdCBlc3RpbWF0ZSA9IE1hdGgubWF4KDEsIE1hdGguY2VpbChtaW51dGVzIC8gZm9jdXMpKTtcbiAgICBjb25zdCBzY3JhcCA9IGlzTGVzc29uXG4gICAgICA/ICgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKHN0YXJ0c0F0ICogMTAwMCk7XG4gICAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIDE0NDAgLSBkLmdldEhvdXJzKCkgKiA2MCAtIGQuZ2V0TWludXRlcygpIC0gNDUpO1xuICAgICAgICB9KSgpXG4gICAgICA6IDA7XG4gICAgbGV0IGluZGV4OiBudW1iZXI7XG4gICAgaWYgKHBvc2l0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGluZGV4ID0gcG9zaXRpb247XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRhc2tJZE5ldyA9IGlkKCk7XG4gICAgICBkYXRhLmVkdWNhdGlvbi5mb2N1c1Rhc2tzLnB1c2goeyB0YXNrSWQ6IHRhc2tJZE5ldywgc291cmNlSWQsIGtpbmQgfSk7XG4gICAgICBkYXRhLnRhc2tzLnB1c2goe1xuICAgICAgICBpZDogdGFza0lkTmV3LFxuICAgICAgICB0ZW1wbGF0ZUlkOiBudWxsLFxuICAgICAgICByZWN1cnJpbmc6IGZhbHNlLFxuICAgICAgICB0aXRsZSxcbiAgICAgICAgbm90ZXMsXG4gICAgICAgIHByb2plY3RJZCxcbiAgICAgICAgaGFiaXRJZDogbnVsbCxcbiAgICAgICAgZHVlRGF0ZSxcbiAgICAgICAgcmVtaW5kZXJUaW1lOiByZW1pbmRlcixcbiAgICAgICAgZm9jdXNNaW51dGVzOiBmb2N1cyxcbiAgICAgICAgc2NyYXBNaW51dGVzOiBzY3JhcCxcbiAgICAgICAgcHJpb3JpdHk6IDEsXG4gICAgICAgIGVzdGltYXRlLFxuICAgICAgICByZW1pbmRlckZpcmVkOiBmYWxzZSxcbiAgICAgICAgcmVtaW5kZXJQZW5kaW5nOiBmYWxzZSxcbiAgICAgICAgcmVtaW5kZXJFeHBpcmVkOiBmYWxzZSxcbiAgICAgICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICAgICAgY29tcGxldGVkQXQ6IG51bGwsXG4gICAgICAgIGNyZWF0ZWRBdDogYXQsXG4gICAgICAgIHRhZ3M6IFtpc0xlc3NvbiA/IFwiXHU4QkZFXHU3QTBCXCIgOiBcIlx1NEY1Q1x1NEUxQVwiXSxcbiAgICAgICAgc3VidGFza3M6IFtdLFxuICAgICAgfSk7XG4gICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIGluZGV4ID0gZGF0YS50YXNrcy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICBjb25zdCB0YXNrID0gZGF0YS50YXNrc1tpbmRleF0hO1xuICAgIGlmIChcbiAgICAgICF0YXNrLmNvbXBsZXRlZCAmJlxuICAgICAgKHRhc2sudGl0bGUgIT09IHRpdGxlIHx8XG4gICAgICAgIHRhc2subm90ZXMgIT09IG5vdGVzIHx8XG4gICAgICAgIHRhc2sucHJvamVjdElkICE9PSBwcm9qZWN0SWQgfHxcbiAgICAgICAgdGFzay5kdWVEYXRlICE9PSBkdWVEYXRlIHx8XG4gICAgICAgIHRhc2sucmVtaW5kZXJUaW1lICE9PSByZW1pbmRlciB8fFxuICAgICAgICB0YXNrLmZvY3VzTWludXRlcyAhPT0gZm9jdXMgfHxcbiAgICAgICAgdGFzay5lc3RpbWF0ZSAhPT0gZXN0aW1hdGUgfHxcbiAgICAgICAgdGFzay5zY3JhcE1pbnV0ZXMgIT09IHNjcmFwKVxuICAgICkge1xuICAgICAgaWYgKHRhc2suZHVlRGF0ZSAhPT0gZHVlRGF0ZSB8fCB0YXNrLnJlbWluZGVyVGltZSAhPT0gcmVtaW5kZXIpIHtcbiAgICAgICAgdGFzay5yZW1pbmRlckZpcmVkID0gZmFsc2U7XG4gICAgICAgIHRhc2sucmVtaW5kZXJQZW5kaW5nID0gZmFsc2U7XG4gICAgICAgIHRhc2sucmVtaW5kZXJFeHBpcmVkID0gZmFsc2U7XG4gICAgICB9XG4gICAgICB0YXNrLnRpdGxlID0gdGl0bGU7XG4gICAgICB0YXNrLm5vdGVzID0gbm90ZXM7XG4gICAgICB0YXNrLnByb2plY3RJZCA9IHByb2plY3RJZDtcbiAgICAgIHRhc2suZHVlRGF0ZSA9IGR1ZURhdGU7XG4gICAgICB0YXNrLnJlbWluZGVyVGltZSA9IHJlbWluZGVyO1xuICAgICAgdGFzay5mb2N1c01pbnV0ZXMgPSBmb2N1cztcbiAgICAgIHRhc2suZXN0aW1hdGUgPSBlc3RpbWF0ZTtcbiAgICAgIHRhc2suc2NyYXBNaW51dGVzID0gc2NyYXA7XG4gICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGtpbmQgPT09IFwiaG9tZXdvcmtcIikge1xuICAgICAgY29uc3Qgc3VibWl0dGVkID0gKCgpID0+IHtcbiAgICAgICAgY29uc3QgbGFzdCA9IHN1Ym1pc3Npb25zLmdldChzb3VyY2VJZCk7XG4gICAgICAgIGlmIChsYXN0ID09PSB1bmRlZmluZWQgfHwgbGFzdC51bmZpbmlzaGVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIGxhc3Quc3VibWl0dGVkQXQ7XG4gICAgICB9KSgpO1xuICAgICAgaWYgKFxuICAgICAgICB0YXNrLmNvbXBsZXRlZCAhPT0gKHN1Ym1pdHRlZCAhPT0gbnVsbCkgfHxcbiAgICAgICAgdGFzay5jb21wbGV0ZWRBdCAhPT0gc3VibWl0dGVkXG4gICAgICApIHtcbiAgICAgICAgaWYgKHN1Ym1pdHRlZCAhPT0gbnVsbCAmJiBkYXRhLnRpbWVyLnRhc2tJZCA9PT0gdGFzay5pZCkge1xuICAgICAgICAgIHJlY29yZFNlc3Npb24oZGF0YSwgYXQsIGZhbHNlKTtcbiAgICAgICAgICBkYXRhLnRpbWVyLnRhc2tJZCA9IG51bGw7XG4gICAgICAgICAgcmVzZXRUbyhkYXRhLCBcImZvY3VzXCIpO1xuICAgICAgICB9XG4gICAgICAgIHRhc2suY29tcGxldGVkID0gc3VibWl0dGVkICE9PSBudWxsO1xuICAgICAgICB0YXNrLmNvbXBsZXRlZEF0ID0gc3VibWl0dGVkO1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZWQ7XG59XG5cbi8qKiBcdTY2MEVcdTc4NkVcdTVCOENcdTYyMTBcdThCRkVcdTdBMEJcdTVGODVcdTUyOUUgPSBcdTUzQzJcdTRFMEVcdThCRkVcdTdBMEJcdUZGMUJcdTRGNUNcdTRFMUFcdTUzRUFcdTgwRkRcdTRFQ0VcdTRGNUNcdTRFMUFcdTUxNjVcdTUzRTNcdTYzRDBcdTRFQTRcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wbGV0ZVRlYWNoaW5nVGFzayhcbiAgZGF0YTogQXBwRGF0YSxcbiAgdGFza0lkOiBzdHJpbmcsXG4gIGF0OiBudW1iZXIsXG4pOiB2b2lkIHtcbiAgY29uc3QgbGluayA9IHRlYWNoaW5nVGFzayhkYXRhLCB0YXNrSWQpO1xuICBpZiAobGluayA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG4gIGlmIChsaW5rLmtpbmQgPT09IFwiaG9tZXdvcmtcIikge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGN1x1NEVDRVx1NEY1Q1x1NEUxQVx1NTE2NVx1NTNFM1x1NjNEMFx1NEVBNFx1N0I1NFx1NTM3N1x1RkYwQ1x1NjNEMFx1NEVBNFx1NUI4Q1x1NjIxMFx1NTQwRVx1NEYxQVx1ODFFQVx1NTJBOFx1NUI4Q1x1NjIxMFx1NUY4NVx1NTI5RVwiKTtcbiAgfVxuICBjb25zdCBsZXNzb24gPSBkYXRhLmVkdWNhdGlvbi5sZXNzb25zLmZpbmQoKGwpID0+IGwuaWQgPT09IGxpbmsuc291cmNlSWQpO1xuICBlbnN1cmUobGVzc29uICE9PSB1bmRlZmluZWQsIFwiXHU4QkZFXHU3QTBCXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICBsZXNzb24uYXR0ZW5kZWQgPSB0cnVlO1xuICBpZiAobGVzc29uLnByb2dyZXNzLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICBsZXNzb24ucHJvZ3Jlc3MgPVxuICAgICAgXCJcdTY3MkNcdTRFQkFcdTRFQ0VcdTRFQ0FcdTY1RTVcdTRFMTNcdTZDRThcdTc4NkVcdThCQTRcdThCRkVcdTdBMEJcdTRFRkJcdTUyQTFcdTVCOENcdTYyMTBcdUZGMENcdTUxNzdcdTRGNTNcdTVCNjZcdTRFNjBcdTRGNERcdTdGNkVcdTVGODVcdTg4NjVcdTUxNDVcdUZGMUJcdTYzOENcdTYzRTFcdTYwQzVcdTUxQjVcdTVGODVcdTU5MERcdTZENEJcIjtcbiAgfVxuICBpZiAoYXQgPj0gbGVzc29uLmVuZHNBdCkge1xuICAgIGxlc3Nvbi5zdGF0ZSA9IFwiZW5kZWRcIjtcbiAgICBpZiAobGVzc29uLmFpRW5hYmxlZCkge1xuICAgICAgZGF0YS5lZHVjYXRpb24uZXZlbnQobGVzc29uLnByb2plY3RJZCwgXCJob21ld29ya1wiLCBsZXNzb24uaWQsIGF0KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIFx1ODFFQVx1NTJBOFx1OEJBMVx1NjVGNlx1NEUwRFx1Nzg2RVx1OEJBNFx1OEJGRVx1N0EwQlx1NTNDMlx1NEUwRVx1RkYxQVx1NTNFQVx1NjcwOVx1NjYwRVx1Nzg2RVx1NUYwMFx1NTlDQi9cdTVCOENcdTYyMTBcdTYyNERcdTdCOTdcdTUzQzJcdTRFMEVcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFydFRlYWNoaW5nVGFzayhkYXRhOiBBcHBEYXRhLCBhdDogbnVtYmVyKTogdm9pZCB7XG4gIGlmIChkYXRhLnRpbWVyLm1vZGUgIT09IFwiZm9jdXNcIikgcmV0dXJuO1xuICBjb25zdCBsaW5rID1cbiAgICBkYXRhLnRpbWVyLnRhc2tJZCAhPT0gbnVsbFxuICAgICAgPyB0ZWFjaGluZ1Rhc2soZGF0YSwgZGF0YS50aW1lci50YXNrSWQpXG4gICAgICA6IHVuZGVmaW5lZDtcbiAgaWYgKGxpbmsgPT09IHVuZGVmaW5lZCB8fCBsaW5rLmtpbmQgIT09IFwibGVzc29uXCIpIHJldHVybjtcbiAgY29uc3QgbGVzc29uID0gZGF0YS5lZHVjYXRpb24ubGVzc29ucy5maW5kKChsKSA9PiBsLmlkID09PSBsaW5rLnNvdXJjZUlkKTtcbiAgaWYgKGxlc3NvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGF0ID49IGxlc3Nvbi5zdGFydHNBdCAmJiBhdCA8IGxlc3Nvbi5lbmRzQXQpIHtcbiAgICAgIGxlc3Nvbi5hdHRlbmRlZCA9IHRydWU7XG4gICAgfVxuICB9XG59XG5cbi8qKiBcdTY3NjVcdTZFOTBcdTUxNzNcdTgwNTRcdTRFMDBcdTVCRjlcdTRFMDBcdTMwMDFcdTU0MENcdTk4NzlcdTc2RUVcdTMwMDFcdTVCOUVcdTRGOEJcdTRFM0FcdTU1MkZcdTRFMDBcdTY2NkVcdTkwMUFcdTRFRkJcdTUyQTFcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVRlYWNoaW5nVGFza3MoZGF0YTogQXBwRGF0YSk6IHZvaWQge1xuICBjb25zdCB0YXNrcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBzb3VyY2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgbGluayBvZiBkYXRhLmVkdWNhdGlvbi5mb2N1c1Rhc2tzKSB7XG4gICAgY29uc3QgdGFzayA9IGRhdGEudGFza3MuZmluZCgodCkgPT4gdC5pZCA9PT0gbGluay50YXNrSWQpO1xuICAgIGVuc3VyZSh0YXNrICE9PSB1bmRlZmluZWQsIFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHU1MTczXHU4MDU0XHU3Njg0XHU0RUZCXHU1MkExXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgIGNvbnN0IHByb2plY3QgPSAoKCkgPT4ge1xuICAgICAgaWYgKGxpbmsua2luZCA9PT0gXCJsZXNzb25cIikge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIGRhdGEuZWR1Y2F0aW9uLmxlc3NvbnMuZmluZCgobCkgPT4gbC5pZCA9PT0gbGluay5zb3VyY2VJZClcbiAgICAgICAgICAgID8ucHJvamVjdElkID8/IG51bGxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiAoXG4gICAgICAgIGRhdGEuZWR1Y2F0aW9uLmFzc2Vzc21lbnRzLmZpbmQoXG4gICAgICAgICAgKGEpID0+IGEuaWQgPT09IGxpbmsuc291cmNlSWQgJiYgYS5raW5kID09PSBcImhvbWV3b3JrXCIsXG4gICAgICAgICk/LnByb2plY3RJZCA/PyBudWxsXG4gICAgICApO1xuICAgIH0pKCk7XG4gICAgZW5zdXJlKHByb2plY3QgIT09IG51bGwsIFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHU2NzY1XHU2RTkwXHU0RTBEXHU1QjU4XHU1NzI4XHU2MjE2XHU3QzdCXHU1NzhCXHU0RTBEXHU3QjI2XCIpO1xuICAgIGlmIChcbiAgICAgIHRhc2sucHJvamVjdElkICE9PSBwcm9qZWN0IHx8XG4gICAgICB0YXNrcy5oYXMobGluay50YXNrSWQpIHx8XG4gICAgICBzb3VyY2VzLmhhcyhsaW5rLnNvdXJjZUlkKSB8fFxuICAgICAgdGFzay50ZW1wbGF0ZUlkICE9PSBudWxsIHx8XG4gICAgICB0YXNrLmhhYml0SWQgIT09IG51bGwgfHxcbiAgICAgIHRhc2sucmVjdXJyaW5nXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1NTlcdTVCNjZcdTY3NjVcdTZFOTBcdTVGQzVcdTk4N0JcdTUxNzNcdTgwNTRcdTU0MENcdTk4NzlcdTc2RUVcdTc2ODRcdTU1MkZcdTRFMDBcdTY2NkVcdTkwMUFcdTRFRkJcdTUyQTFcIik7XG4gICAgfVxuICAgIHRhc2tzLmFkZChsaW5rLnRhc2tJZCk7XG4gICAgc291cmNlcy5hZGQobGluay5zb3VyY2VJZCk7XG4gIH1cbn1cbiIsICIvLyEgXHU1QjlFXHU0RjUzXHU4RUFCXHU0RUZEXHVGRjFBXHU1MjIwXHU5NjY0XHU1NDBFXHU0RUNEXHU0RkREXHU3NTU5XHU3NjdCXHU4QkIwXHVGRjFCXHU2NEE0XHU5NTAwXHU2MDYyXHU1OTBEXHU1NDBDXHU0RTAwXHU0RUZCXHU1MkExXHVGRjFCXHU4REU4XHU3QzdCXHU1NzhCXHU1NTJGXHU0RTAwXHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9pZGVudGl0aWVzLnJzXHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yLCBlbnN1cmUsIHV0ZjhMZW4gfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7XG4gIGFzT3B0LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICByZWplY3RVbmtub3duLFxuICByZXF1aXJlZEZpZWxkLFxufSBmcm9tIFwiLi9qc29uXCI7XG5pbXBvcnQgdHlwZSB7IEFwcERhdGEgfSBmcm9tIFwiLi9saWJcIjtcbmltcG9ydCB0eXBlIHsgSWRlbnRpdHkgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgcGFyc2VUYXNrLCBzZXJpYWxpemVUYXNrIH0gZnJvbSBcIi4vbGliXCI7XG5cbmNvbnN0IElERU5USVRZX0tFWVMgPSBbXCJpZFwiLCBcImtpbmRcIiwgXCJyZXRpcmVkXCIsIFwicmVzdG9yZVRhc2tcIl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUlkZW50aXR5KHJhdzogdW5rbm93bik6IElkZW50aXR5IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJJRCBcdTc2N0JcdThCQjBcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uSURFTlRJVFlfS0VZU10sIFwiSUQgXHU3NjdCXHU4QkIwXCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIklEIFx1NzY3Qlx1OEJCMFwiLCBhc1N0ciksXG4gICAga2luZDogcmVxdWlyZWRGaWVsZChyYXcsIFwia2luZFwiLCBcIklEIFx1NzY3Qlx1OEJCMFwiLCBhc1N0ciksXG4gICAgcmV0aXJlZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicmV0aXJlZFwiLCBcIklEIFx1NzY3Qlx1OEJCMFwiLCAodikgPT4ge1xuICAgICAgaWYgKHR5cGVvZiB2ICE9PSBcImJvb2xlYW5cIikgdGhyb3cgbmV3IEFwcEVycm9yKFwicmV0aXJlZCBcdTVGQzVcdTk4N0JcdTY2MkZcdTVFMDNcdTVDMTRcdTUwM0NcIik7XG4gICAgICByZXR1cm4gdjtcbiAgICB9KSxcbiAgICByZXN0b3JlVGFzazogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJlc3RvcmVUYXNrXCIsXG4gICAgICBcIklEIFx1NzY3Qlx1OEJCMFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwicmVzdG9yZVRhc2tcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVJZGVudGl0eShpOiBJZGVudGl0eSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogaS5pZCxcbiAgICBraW5kOiBpLmtpbmQsXG4gICAgcmV0aXJlZDogaS5yZXRpcmVkLFxuICAgIHJlc3RvcmVUYXNrOiBpLnJlc3RvcmVUYXNrLFxuICB9O1xufVxuXG4vKiogXHU1RjUzXHU1MjREXHU2RDNCXHU4REMzXHU1QjlFXHU0RjUzIElEIFx1MjE5MiBcdTdDN0JcdTU3OEJcdTMwMDIgKi9cbmZ1bmN0aW9uIGFjdGl2ZUlkZW50aXRpZXMoZGF0YTogQXBwRGF0YSk6IE1hcDxzdHJpbmcsIHN0cmluZz4ge1xuICBjb25zdCBpZHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBjb25zdCBhZGQgPSAoaWQ6IHN0cmluZywga2luZDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgaWYgKGlkLnRyaW0oKS5sZW5ndGggPT09IDAgfHwgdXRmOExlbihpZCkgPiAyMDAgfHwgaWRzLmhhcyhpZCkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NzJFQ1x1N0FDQlx1NUI5RVx1NEY1MyBJRCBcdTRFM0FcdTdBN0FcdTMwMDFcdThGQzdcdTk1N0ZcdTYyMTZcdTkxQ0RcdTU5MERcIik7XG4gICAgfVxuICAgIGlkcy5zZXQoaWQsIGtpbmQpO1xuICB9O1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5wcm9qZWN0cykgYWRkKHguaWQsIFwicHJvamVjdFwiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEuaGFiaXRzKSBhZGQoeC5pZCwgXCJoYWJpdFwiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEudmlzaW9ucykgYWRkKHguaWQsIFwidmlzaW9uXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5ibG9ja3MpIGFkZCh4LmlkLCBcImJsb2NrXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS50YXNrcykgYWRkKHguaWQsIFwidGFza1wiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEudGVtcGxhdGVzKSBhZGQoeC5pZCwgXCJ0ZW1wbGF0ZVwiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEuc2Vzc2lvbnMpIGFkZCh4LmlkLCBcInNlc3Npb25cIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmVkdWNhdGlvbi5yZXNvdXJjZXMpIGFkZCh4LmlkLCBcInJlc291cmNlXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5lZHVjYXRpb24uc2VtZXN0ZXJzKSBhZGQoeC5pZCwgXCJzZW1lc3RlclwiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEuZWR1Y2F0aW9uLmxlc3NvbnMpIGFkZCh4LmlkLCBcImxlc3NvblwiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEuZWR1Y2F0aW9uLmFzc2Vzc21lbnRzKSBhZGQoeC5pZCwgXCJhc3Nlc3NtZW50XCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5lZHVjYXRpb24uc3VibWlzc2lvbnMpIGFkZCh4LmlkLCBcInN1Ym1pc3Npb25cIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmVkdWNhdGlvbi5ncmFkZXMpIGFkZCh4LmlkLCBcImdyYWRlXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5lZHVjYXRpb24ucmV2aWV3cykgYWRkKHguaWQsIFwicmV2aWV3XCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5lZHVjYXRpb24ucHJvZ3Jlc3MpIGFkZCh4LmlkLCBcInByb2dyZXNzXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5lZHVjYXRpb24uY29ycmVjdGlvbnMpIGFkZCh4LmlkLCBcImNvcnJlY3Rpb25cIik7XG4gIHJldHVybiBpZHM7XG59XG5cbmNvbnN0IEFMTE9XRURfS0lORFMgPSBbXG4gIFwicHJvamVjdFwiLFxuICBcImhhYml0XCIsXG4gIFwidmlzaW9uXCIsXG4gIFwidGFza1wiLFxuICBcInRlbXBsYXRlXCIsXG4gIFwic2Vzc2lvblwiLFxuICBcImJsb2NrXCIsXG4gIFwicmVzb3VyY2VcIixcbiAgXCJzZW1lc3RlclwiLFxuICBcImxlc3NvblwiLFxuICBcImFzc2Vzc21lbnRcIixcbiAgXCJzdWJtaXNzaW9uXCIsXG4gIFwiZ3JhZGVcIixcbiAgXCJyZXZpZXdcIixcbiAgXCJwcm9ncmVzc1wiLFxuICBcImNvcnJlY3Rpb25cIixcbl07XG5cbi8qKlxuICogXHU2M0QwXHU0RUE0XHU1MjREXHU2ODM4XHU1QkY5XHU4RUFCXHU0RUZEXHU1Mzg2XHU1M0YyXHVGRjFBXHU1MjIwXHU5NjY0XHU3Njg0IElEIFx1NkMzOFx1NEU0NVx1NEZERFx1NzU1OVx1RkYwQ1x1NjA2Mlx1NTkwRFx1NTNFQVx1ODBGRFx1NjA2Mlx1NTkwRFx1NzY3Qlx1OEJCMFx1NEUyRFx1NzY4NFx1NTM5Rlx1NEVGQlx1NTJBMVx1MzAwMlxuICogYHJlc3RvcmVfaWRgIFx1NjYyRlx1NjcyQ1x1NkIyMVx1NTJBOFx1NEY1Q1x1OTFDQ1x1NkI2M1x1NTcyOFx1NjA2Mlx1NTkwRFx1NzY4NFx1NEVGQlx1NTJBMSBJRFx1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb25jaWxlSWRlbnRpdGllcyhcbiAgYmVmb3JlOiBBcHBEYXRhLFxuICBhZnRlcjogQXBwRGF0YSxcbiAgcmVzdG9yZUlkOiBzdHJpbmcgfCBudWxsLFxuKTogdm9pZCB7XG4gIGNvbnN0IG9sZEFjdGl2ZSA9IGFjdGl2ZUlkZW50aXRpZXMoYmVmb3JlKTtcbiAgY29uc3QgbmV3QWN0aXZlID0gYWN0aXZlSWRlbnRpdGllcyhhZnRlcik7XG4gIGNvbnN0IGVudHJpZXMgPSBuZXcgTWFwPHN0cmluZywgSWRlbnRpdHk+KCk7XG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIFsuLi5iZWZvcmUuaWRlbnRpdGllcywgLi4uYWZ0ZXIuaWRlbnRpdGllc10pIHtcbiAgICBjb25zdCBvbGQgPSBlbnRyaWVzLmdldChyZWNvcmQuaWQpO1xuICAgIGlmIChvbGQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKG9sZC5raW5kICE9PSByZWNvcmQua2luZCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTUzODZcdTUzRjIgSUQgXHU0RTBEXHU4MEZEXHU4RjZDXHU3NTI4XHU0RThFXHU1M0U2XHU0RTAwXHU3OUNEXHU1QjlFXHU0RjUzXCIpO1xuICAgICAgfVxuICAgICAgb2xkLnJldGlyZWQgPSBvbGQucmV0aXJlZCB8fCByZWNvcmQucmV0aXJlZDtcbiAgICAgIGlmIChvbGQucmVzdG9yZVRhc2sgPT09IG51bGwpIHtcbiAgICAgICAgb2xkLnJlc3RvcmVUYXNrID0gcmVjb3JkLnJlc3RvcmVUYXNrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlbnRyaWVzLnNldChyZWNvcmQuaWQsIHsgLi4ucmVjb3JkLCByZXN0b3JlVGFzazogcmVjb3JkLnJlc3RvcmVUYXNrIH0pO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IFtpZCwga2luZF0gb2Ygb2xkQWN0aXZlKSB7XG4gICAgaWYgKCFlbnRyaWVzLmhhcyhpZCkpIHtcbiAgICAgIGVudHJpZXMuc2V0KGlkLCB7IGlkLCBraW5kLCByZXRpcmVkOiBmYWxzZSwgcmVzdG9yZVRhc2s6IG51bGwgfSk7XG4gICAgfVxuICB9XG4gIC8vIFx1NURGMlx1NTIyMFx1OTY2NFx1NEVGQlx1NTJBMVx1NTNFQVx1ODBGRFx1OTAxQVx1OEZDN1x1NTM4Nlx1NTNGMlx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVx1NTNFRlx1ODlDMVx1MzAwMlxuICBjb25zdCB2aXNpdCA9IChzb3VyY2U6IEFwcERhdGEsIGxpdmU6IE1hcDxzdHJpbmcsIHN0cmluZz4pOiB2b2lkID0+IHtcbiAgICBmb3IgKGNvbnN0IHNlc3Npb24gb2Ygc291cmNlLnNlc3Npb25zKSB7XG4gICAgICBjb25zdCB0YXNrSWQgPSBzZXNzaW9uLnRhc2tJZDtcbiAgICAgIGlmICh0YXNrSWQgPT09IG51bGwpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgcmVjb3JkID0gZW50cmllcy5nZXQodGFza0lkKTtcbiAgICAgIGlmIChyZWNvcmQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAocmVjb3JkLmtpbmQgIT09IFwidGFza1wiKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1Mzg2XHU1M0YyXHU0RUZCXHU1MkExXHU1RjE1XHU3NTI4XHU3Njg0IElEIFx1NEUwRVx1NTE3Nlx1NEVENlx1NUI5RVx1NEY1M1x1NTFCMlx1N0E4MVwiKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50cmllcy5zZXQodGFza0lkLCB7XG4gICAgICAgICAgaWQ6IHRhc2tJZCxcbiAgICAgICAgICBraW5kOiBcInRhc2tcIixcbiAgICAgICAgICByZXRpcmVkOiAhbGl2ZS5oYXModGFza0lkKSxcbiAgICAgICAgICByZXN0b3JlVGFzazogbnVsbCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICB2aXNpdChiZWZvcmUsIG9sZEFjdGl2ZSk7XG4gIHZpc2l0KGFmdGVyLCBuZXdBY3RpdmUpO1xuICBmb3IgKGNvbnN0IFtpZCwga2luZF0gb2YgbmV3QWN0aXZlKSB7XG4gICAgY29uc3QgcmVjb3JkID0gZW50cmllcy5nZXQoaWQpO1xuICAgIGlmIChyZWNvcmQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHJlY29yZC5raW5kICE9PSBraW5kKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTM4Nlx1NTNGMiBJRCBcdTRFMERcdTgwRkRcdTg4QUJcdTUxNzZcdTRFRDZcdTVCOUVcdTRGNTNcdTU5MERcdTc1MjhcIik7XG4gICAgICB9XG4gICAgICBpZiAocmVjb3JkLnJldGlyZWQpIHtcbiAgICAgICAgY29uc3Qgc2FtZVRhc2sgPSByZXN0b3JlSWQgPT09IGlkICYmIGtpbmQgPT09IFwidGFza1wiO1xuICAgICAgICBpZiAoIXNhbWVUYXNrKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgICAgXCJcdTUzODZcdTUzRjIgSUQgXHU1REYyXHU4OEFCXHU2QzM4XHU0RTQ1XHU0RkREXHU3NTU5XHVGRjBDXHU0RTBEXHU4MEZEXHU3NTI4XHU0RThFXHU2NUIwXHU1RUZBXHU2MjE2XHU1QkZDXHU1MTY1XHU1MTc2XHU0RUQ2XHU1QjlFXHU0RjUzXCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZWNvcmQucmV0aXJlZCA9IGZhbHNlO1xuICAgICAgICByZWNvcmQucmVzdG9yZVRhc2sgPSBudWxsO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlbnRyaWVzLnNldChpZCwgeyBpZCwga2luZCwgcmV0aXJlZDogZmFsc2UsIHJlc3RvcmVUYXNrOiBudWxsIH0pO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHJlY29yZCBvZiBlbnRyaWVzLnZhbHVlcygpKSB7XG4gICAgaWYgKCFuZXdBY3RpdmUuaGFzKHJlY29yZC5pZCkpIHtcbiAgICAgIHJlY29yZC5yZXRpcmVkID0gdHJ1ZTtcbiAgICAgIGlmIChyZWNvcmQua2luZCA9PT0gXCJ0YXNrXCIpIHtcbiAgICAgICAgY29uc3QgdGFzayA9IGJlZm9yZS50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSByZWNvcmQuaWQpO1xuICAgICAgICBpZiAodGFzayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmVjb3JkLnJlc3RvcmVUYXNrID0gSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplVGFzayh0YXNrKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgcmVjb3JkcyA9IFsuLi5lbnRyaWVzLnZhbHVlcygpXS5zb3J0KChhLCBiKSA9PlxuICAgIGEuaWQgPCBiLmlkID8gLTEgOiBhLmlkID4gYi5pZCA/IDEgOiAwLFxuICApO1xuICBhZnRlci5pZGVudGl0aWVzID0gcmVjb3Jkcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlSWRlbnRpdGllcyhkYXRhOiBBcHBEYXRhKTogdm9pZCB7XG4gIGNvbnN0IGN1cnJlbnQgPSBhY3RpdmVJZGVudGl0aWVzKGRhdGEpO1xuICBjb25zdCBzZWVuID0gbmV3IE1hcDxzdHJpbmcsIHRydWU+KCk7XG4gIGlmIChkYXRhLmlkZW50aXRpZXMubGVuZ3RoID4gMTAwMDAwMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIklEIFx1NTM4Nlx1NTNGMlx1NjU3MFx1OTFDRlx1OEQ4NVx1NTFGQVx1OTY1MFx1NTIzNlwiKTtcbiAgfVxuICBmb3IgKGNvbnN0IHJlY29yZCBvZiBkYXRhLmlkZW50aXRpZXMpIHtcbiAgICBpZiAoXG4gICAgICByZWNvcmQuaWQudHJpbSgpLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgdXRmOExlbihyZWNvcmQuaWQpID4gMjAwIHx8XG4gICAgICBzZWVuLmhhcyhyZWNvcmQuaWQpIHx8XG4gICAgICAhQUxMT1dFRF9LSU5EUy5pbmNsdWRlcyhyZWNvcmQua2luZClcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjVFMFx1NjU0OFx1NzY4NCBJRCBcdTUzODZcdTUzRjJcdTc2N0JcdThCQjBcIik7XG4gICAgfVxuICAgIHNlZW4uc2V0KHJlY29yZC5pZCwgdHJ1ZSk7XG4gICAgLy8gXHU5MDAwXHU0RjExXHU3MkI2XHU2MDAxXHU3NTMxIHJlY29uY2lsZSBcdTY4QzBcdTY3RTVcdUZGMENcdTUxNDFcdThCQjhcdTVERjJcdTlBOENcdThCQzFcdTc2ODRcdTY0QTRcdTk1MDBcdTUwMTlcdTkwMDlcdTVCNThcdTU3MjhcdTMwMDJcbiAgICBpZiAoY3VycmVudC5oYXMocmVjb3JkLmlkKSAmJiBjdXJyZW50LmdldChyZWNvcmQuaWQpICE9PSByZWNvcmQua2luZCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1Mzg2XHU1M0YyIElEIFx1N0M3Qlx1NTc4Qlx1NTFCMlx1N0E4MVwiKTtcbiAgICB9XG4gICAgaWYgKHJlY29yZC5yZXN0b3JlVGFzayAhPT0gbnVsbCkge1xuICAgICAgbGV0IHRhc2s7XG4gICAgICB0cnkge1xuICAgICAgICB0YXNrID0gcGFyc2VUYXNrKEpTT04ucGFyc2UocmVjb3JkLnJlc3RvcmVUYXNrKSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU0RUZCXHU1MkExXHU2MDYyXHU1OTBEXHU4QkIwXHU1RjU1XCIpO1xuICAgICAgfVxuICAgICAgaWYgKHJlY29yZC5raW5kICE9PSBcInRhc2tcIiB8fCB0YXNrLmlkICE9PSByZWNvcmQuaWQgfHwgIXJlY29yZC5yZXRpcmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEVGQlx1NTJBMVx1NjA2Mlx1NTkwRFx1OEJCMFx1NUY1NVx1NEUwRSBJRCBcdTc2N0JcdThCQjBcdTRFMERcdTRFMDBcdTgxRjRcIik7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCAiLy8hIFx1NUI2Nlx1NEU2MFx1OEJBMVx1NTIxMiB2Nlx1RkYxQVx1NEZCRlx1NjQzQVx1OEJBMVx1NTIxMlx1NTIzQlx1NjEwRlx1NEUwRFx1NTQyQlx1NjI2N1x1ODg0Q1x1NTM4Nlx1NTNGMlx1NEUwRVx1NjcyQ1x1NjczQVx1NTA0Rlx1NTk3RFx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvcGxhbi5yc1x1MzAwMlxuXG5pbXBvcnQgeyBBcHBFcnJvciwgY2xvbmUsIGVuc3VyZSB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHtcbiAgYXNBcnJheSxcbiAgYXNCb29sLFxuICBhc0ludCxcbiAgYXNPcHQsXG4gIGFzU3RyLFxuICBmaWVsZCxcbiAgaXNPYmplY3QsXG4gIG9uZU9mLFxuICByZWplY3RVbmtub3duLFxuICByZXF1aXJlZEZpZWxkLFxufSBmcm9tIFwiLi9qc29uXCI7XG5pbXBvcnQgeyBBcHBEYXRhIH0gZnJvbSBcIi4vbGliXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFBsYW5GaWxlLFxuICBQbGFuUHJvamVjdCxcbiAgUGxhblN1YnRhc2ssXG4gIFBsYW5UYXNrLFxuICBSZXBlYXQsXG4gIFRhc2ssXG4gIFRlbXBsYXRlLFxufSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHtcbiAgZGVsZXRlVGVtcGxhdGUsXG4gIHBhcnNlUHJpbnRSZWNvcmQsXG4gIHBhcnNlVGVtcGxhdGUsXG4gIHJlcGxhY2VBcHBEYXRhLFxuICBzZXJpYWxpemVQcmludFJlY29yZCxcbiAgc2VyaWFsaXplVGVtcGxhdGUsXG59IGZyb20gXCIuL3RlbXBsYXRlc1wiO1xuaW1wb3J0IHsgcGFyc2VCbG9jaywgc2VyaWFsaXplQmxvY2sgfSBmcm9tIFwiLi9ibG9ja3NcIjtcbmltcG9ydCB7IHBhcnNlSGFiaXQsIHNlcmlhbGl6ZUhhYml0IH0gZnJvbSBcIi4vaGFiaXRzXCI7XG5cbmNvbnN0IFBMQU5fRklMRV9LRVlTID0gW1xuICBcImZvcm1hdFwiLFxuICBcInZlcnNpb25cIixcbiAgXCJwb21vZG9yb01pbnV0ZXNcIixcbiAgXCJwcm9qZWN0c1wiLFxuICBcInRhc2tzXCIsXG4gIFwiYmxvY2tzXCIsXG4gIFwidGVtcGxhdGVzXCIsXG4gIFwicHJpbnRzXCIsXG4gIFwiaGFiaXRzXCIsXG4gIFwicmVwbGFjZVwiLFxuXSBhcyBjb25zdDtcbmNvbnN0IFBMQU5fUFJPSkVDVF9LRVlTID0gW1wiaWRcIiwgXCJuYW1lXCIsIFwiY29sb3JcIiwgXCJhcHBXaGl0ZWxpc3RcIl0gYXMgY29uc3Q7XG5jb25zdCBQTEFOX1RBU0tfS0VZUyA9IFtcbiAgXCJpZFwiLFxuICBcInRpdGxlXCIsXG4gIFwidGVtcGxhdGVJZFwiLFxuICBcImhhYml0SWRcIixcbiAgXCJyZWN1cnJpbmdcIixcbiAgXCJzY3JhcE1pbnV0ZXNcIixcbiAgXCJub3Rlc1wiLFxuICBcInByb2plY3RJZFwiLFxuICBcImR1ZURhdGVcIixcbiAgXCJyZW1pbmRlclRpbWVcIixcbiAgXCJmb2N1c01pbnV0ZXNcIixcbiAgXCJwcmlvcml0eVwiLFxuICBcImVzdGltYXRlXCIsXG4gIFwidGFnc1wiLFxuICBcInN1YnRhc2tzXCIsXG4gIFwicmVwZWF0XCIsXG5dIGFzIGNvbnN0O1xuY29uc3QgUExBTl9TVUJUQVNLX0tFWVMgPSBbXCJpZFwiLCBcInRpdGxlXCJdIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQbGFuRmlsZShyYXc6IHVua25vd24pOiBQbGFuRmlsZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkExXHU1MjEyXHU2NTg3XHU0RUY2XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlBMQU5fRklMRV9LRVlTXSwgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIik7XG4gIHJldHVybiB7XG4gICAgZm9ybWF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJmb3JtYXRcIiwgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIiwgYXNTdHIpLFxuICAgIHZlcnNpb246IHJlcXVpcmVkRmllbGQocmF3LCBcInZlcnNpb25cIiwgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIiwgYXNJbnQpLFxuICAgIHBvbW9kb3JvTWludXRlczogcmVxdWlyZWRGaWVsZChyYXcsIFwicG9tb2Rvcm9NaW51dGVzXCIsIFwiXHU4QkExXHU1MjEyXHU2NTg3XHU0RUY2XCIsIGFzSW50KSxcbiAgICBwcm9qZWN0czogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdHNcIiwgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIiwgKHYpID0+XG4gICAgICBhc0FycmF5KHYsIFwicHJvamVjdHNcIikubWFwKHBhcnNlUGxhblByb2plY3QpLFxuICAgICksXG4gICAgdGFza3M6IHJlcXVpcmVkRmllbGQocmF3LCBcInRhc2tzXCIsIFwiXHU4QkExXHU1MjEyXHU2NTg3XHU0RUY2XCIsICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcInRhc2tzXCIpLm1hcChwYXJzZVBsYW5UYXNrKSxcbiAgICApLFxuICAgIGJsb2NrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImJsb2Nrc1wiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwiYmxvY2tzXCIpLm1hcChwYXJzZUJsb2NrKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgdGVtcGxhdGVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGVtcGxhdGVzXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0ZW1wbGF0ZXNcIikubWFwKHBhcnNlVGVtcGxhdGUpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBwcmludHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJwcmludHNcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU2NTg3XHU0RUY2XCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInByaW50c1wiKS5tYXAocGFyc2VQcmludFJlY29yZCksXG4gICAgICBbXSxcbiAgICApLFxuICAgIGhhYml0czogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImhhYml0c1wiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwiaGFiaXRzXCIpLm1hcChwYXJzZUhhYml0KSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgcmVwbGFjZTogZmllbGQocmF3LCBcInJlcGxhY2VcIiwgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIiwgYXNCb29sLCBmYWxzZSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlUGxhblByb2plY3QocmF3OiB1bmtub3duKTogUGxhblByb2plY3Qge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJBMVx1NTIxMlx1OTg3OVx1NzZFRVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5QTEFOX1BST0pFQ1RfS0VZU10sIFwiXHU4QkExXHU1MjEyXHU5ODc5XHU3NkVFXCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1OEJBMVx1NTIxMlx1OTg3OVx1NzZFRVwiLCBhc1N0ciksXG4gICAgbmFtZTogcmVxdWlyZWRGaWVsZChyYXcsIFwibmFtZVwiLCBcIlx1OEJBMVx1NTIxMlx1OTg3OVx1NzZFRVwiLCBhc1N0ciksXG4gICAgY29sb3I6IHJlcXVpcmVkRmllbGQocmF3LCBcImNvbG9yXCIsIFwiXHU4QkExXHU1MjEyXHU5ODc5XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBhcHBXaGl0ZWxpc3Q6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJhcHBXaGl0ZWxpc3RcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU5ODc5XHU3NkVFXCIsXG4gICAgICAodikgPT5cbiAgICAgICAgYXNPcHQodiwgXCJhcHBXaGl0ZWxpc3RcIiwgKHgpID0+XG4gICAgICAgICAgYXNBcnJheSh4LCBcImFwcFdoaXRlbGlzdFwiKS5tYXAoKGEpID0+IGFzU3RyKGEsIFwiXHU1RTk0XHU3NTI4IElEXCIpKSxcbiAgICAgICAgKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmdbXSB8IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlUGxhblN1YnRhc2socmF3OiB1bmtub3duKTogUGxhblN1YnRhc2sge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJBMVx1NTIxMlx1NUI1MFx1NkI2NVx1OUFBNFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5QTEFOX1NVQlRBU0tfS0VZU10sIFwiXHU4QkExXHU1MjEyXHU1QjUwXHU2QjY1XHU5QUE0XCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1OEJBMVx1NTIxMlx1NUI1MFx1NkI2NVx1OUFBNFwiLCBhc1N0ciksXG4gICAgdGl0bGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpdGxlXCIsIFwiXHU4QkExXHU1MjEyXHU1QjUwXHU2QjY1XHU5QUE0XCIsIGFzU3RyKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQbGFuVGFzayhyYXc6IHVua25vd24pOiBQbGFuVGFzayB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlBMQU5fVEFTS19LRVlTXSwgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIiwgYXNTdHIpLFxuICAgIHRlbXBsYXRlSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0ZW1wbGF0ZUlkXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwidGVtcGxhdGVJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBoYWJpdElkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiaGFiaXRJZFwiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImhhYml0SWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgcmVjdXJyaW5nOiBmaWVsZChyYXcsIFwicmVjdXJyaW5nXCIsIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIHNjcmFwTWludXRlczogZmllbGQocmF3LCBcInNjcmFwTWludXRlc1wiLCBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLCBhc0ludCwgMCksXG4gICAgbm90ZXM6IGZpZWxkKHJhdywgXCJub3Rlc1wiLCBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLCBhc1N0ciwgXCJcIiksXG4gICAgcHJvamVjdElkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicHJvamVjdElkXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwicHJvamVjdElkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIGR1ZURhdGU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJkdWVEYXRlXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZHVlRGF0ZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICByZW1pbmRlclRpbWU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZW1pbmRlclRpbWVcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJyZW1pbmRlclRpbWVcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZm9jdXNNaW51dGVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiZm9jdXNNaW51dGVzXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZm9jdXNNaW51dGVzXCIsICh4KSA9PiBhc0ludCh4LCBcImZvY3VzTWludXRlc1wiKSksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBwcmlvcml0eTogZmllbGQocmF3LCBcInByaW9yaXR5XCIsIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsIGFzSW50LCAwKSxcbiAgICBlc3RpbWF0ZTogZmllbGQocmF3LCBcImVzdGltYXRlXCIsIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsIGFzSW50LCAxKSxcbiAgICB0YWdzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGFnc1wiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwidGFnc1wiKS5tYXAoKHQpID0+IGFzU3RyKHQsIFwiXHU2ODA3XHU3QjdFXCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgc3VidGFza3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzdWJ0YXNrc1wiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwic3VidGFza3NcIikubWFwKHBhcnNlUGxhblN1YnRhc2spLFxuICAgICAgW10sXG4gICAgKSxcbiAgICByZXBlYXQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZXBlYXRcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gb25lT2YodiwgXCJyZXBlYXRcIiwgW1wibm9uZVwiLCBcImRhaWx5XCIsIFwid2Vla2RheXNcIiwgXCJ3ZWVrbHlcIl0pLFxuICAgICAgXCJub25lXCIsXG4gICAgKSBhcyBSZXBlYXQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVQbGFuRmlsZShwbGFuOiBQbGFuRmlsZSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3Qgb3V0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICBmb3JtYXQ6IHBsYW4uZm9ybWF0LFxuICAgIHZlcnNpb246IHBsYW4udmVyc2lvbixcbiAgICBwb21vZG9yb01pbnV0ZXM6IHBsYW4ucG9tb2Rvcm9NaW51dGVzLFxuICAgIHByb2plY3RzOiBwbGFuLnByb2plY3RzLm1hcCgocCkgPT4ge1xuICAgICAgY29uc3QgbzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgIGlkOiBwLmlkLFxuICAgICAgICBuYW1lOiBwLm5hbWUsXG4gICAgICAgIGNvbG9yOiBwLmNvbG9yLFxuICAgICAgfTtcbiAgICAgIGlmIChwLmFwcFdoaXRlbGlzdCAhPT0gbnVsbCkgb1tcImFwcFdoaXRlbGlzdFwiXSA9IHAuYXBwV2hpdGVsaXN0O1xuICAgICAgcmV0dXJuIG87XG4gICAgfSksXG4gICAgdGFza3M6IHBsYW4udGFza3MubWFwKCh0KSA9PiB7XG4gICAgICBjb25zdCBvOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgaWQ6IHQuaWQsXG4gICAgICAgIHRpdGxlOiB0LnRpdGxlLFxuICAgICAgICB0ZW1wbGF0ZUlkOiB0LnRlbXBsYXRlSWQsXG4gICAgICAgIGhhYml0SWQ6IHQuaGFiaXRJZCxcbiAgICAgICAgcmVjdXJyaW5nOiB0LnJlY3VycmluZyxcbiAgICAgICAgc2NyYXBNaW51dGVzOiB0LnNjcmFwTWludXRlcyxcbiAgICAgICAgbm90ZXM6IHQubm90ZXMsXG4gICAgICAgIHByb2plY3RJZDogdC5wcm9qZWN0SWQsXG4gICAgICAgIGR1ZURhdGU6IHQuZHVlRGF0ZSxcbiAgICAgICAgcHJpb3JpdHk6IHQucHJpb3JpdHksXG4gICAgICAgIGVzdGltYXRlOiB0LmVzdGltYXRlLFxuICAgICAgICB0YWdzOiB0LnRhZ3MsXG4gICAgICAgIHN1YnRhc2tzOiB0LnN1YnRhc2tzLm1hcCgocykgPT4gKHsgaWQ6IHMuaWQsIHRpdGxlOiBzLnRpdGxlIH0pKSxcbiAgICAgICAgcmVwZWF0OiB0LnJlcGVhdCxcbiAgICAgIH07XG4gICAgICBpZiAodC5yZW1pbmRlclRpbWUgIT09IG51bGwpIG9bXCJyZW1pbmRlclRpbWVcIl0gPSB0LnJlbWluZGVyVGltZTtcbiAgICAgIGlmICh0LmZvY3VzTWludXRlcyAhPT0gbnVsbCkgb1tcImZvY3VzTWludXRlc1wiXSA9IHQuZm9jdXNNaW51dGVzO1xuICAgICAgcmV0dXJuIG87XG4gICAgfSksXG4gICAgYmxvY2tzOiBwbGFuLmJsb2Nrcy5tYXAoc2VyaWFsaXplQmxvY2spLFxuICAgIHRlbXBsYXRlczogcGxhbi50ZW1wbGF0ZXMubWFwKHNlcmlhbGl6ZVRlbXBsYXRlKSxcbiAgICBwcmludHM6IHBsYW4ucHJpbnRzLm1hcChzZXJpYWxpemVQcmludFJlY29yZCksXG4gICAgaGFiaXRzOiBwbGFuLmhhYml0cy5tYXAoc2VyaWFsaXplSGFiaXQpLFxuICB9O1xuICBpZiAocGxhbi5yZXBsYWNlKSBvdXRbXCJyZXBsYWNlXCJdID0gdHJ1ZTtcbiAgcmV0dXJuIG91dDtcbn1cblxuLyoqIFx1NjU4N1x1NEVGNlx1NUI5RVx1NEY4QiBcdTIxOTIgXHU2NzJDXHU1NzMwXHU0RUZCXHU1MkExXHVGRjFBXHU4RkRCXHU1RUE2XHU0RTBFXHU1Mzg2XHU1M0YyXHU3NTU5XHU1NzI4XHU2NzJDXHU2NzNBXHUzMDAyICovXG5mdW5jdGlvbiBwbGFuVGFza1RvVGFzayh0OiBQbGFuVGFzaywgYXQ6IG51bWJlciwgZXN0aW1hdGU6IG51bWJlcik6IFRhc2sge1xuICByZXR1cm4ge1xuICAgIGlkOiB0LmlkLFxuICAgIHRlbXBsYXRlSWQ6IHQudGVtcGxhdGVJZCxcbiAgICByZWN1cnJpbmc6IHQucmVjdXJyaW5nIHx8IHQucmVwZWF0ICE9PSBcIm5vbmVcIixcbiAgICB0aXRsZTogdC50aXRsZSxcbiAgICBub3RlczogdC5ub3RlcyxcbiAgICBwcm9qZWN0SWQ6IHQucHJvamVjdElkLFxuICAgIGhhYml0SWQ6IHQuaGFiaXRJZCxcbiAgICBkdWVEYXRlOiB0LmR1ZURhdGUsXG4gICAgcmVtaW5kZXJUaW1lOiB0LnJlbWluZGVyVGltZSxcbiAgICBmb2N1c01pbnV0ZXM6IHQuZm9jdXNNaW51dGVzLFxuICAgIHJlbWluZGVyRmlyZWQ6IGZhbHNlLFxuICAgIHJlbWluZGVyUGVuZGluZzogZmFsc2UsXG4gICAgcmVtaW5kZXJFeHBpcmVkOiBmYWxzZSxcbiAgICBzY3JhcE1pbnV0ZXM6IHQuc2NyYXBNaW51dGVzLFxuICAgIHByaW9yaXR5OiB0LnByaW9yaXR5LFxuICAgIGVzdGltYXRlLFxuICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgY29tcGxldGVkQXQ6IG51bGwsXG4gICAgY3JlYXRlZEF0OiBhdCxcbiAgICB0YWdzOiBbLi4udC50YWdzXSxcbiAgICBzdWJ0YXNrczogdC5zdWJ0YXNrcy5tYXAoKHMpID0+ICh7XG4gICAgICBpZDogcy5pZCxcbiAgICAgIHRpdGxlOiBzLnRpdGxlLFxuICAgICAgZG9uZTogZmFsc2UsXG4gICAgfSkpLFxuICB9O1xufVxuXG4vKiogXHU5MTREXHU3RjZFXHU2NzY1XHU4MUVBXHU2NTg3XHU0RUY2XHVGRjFCXHU4RkRCXHU1RUE2XHU0RTBFXHU1Mzg2XHU1M0YyXHU3NTU5XHU1NzI4XHU2NzJDXHU2NzNBXHUzMDAyXHU2M0QwXHU5MTkyXHU3MkI2XHU2MDAxXHU1M0VBXHU1NzI4XHU2NUY2XHU5NUY0XHU2OUZEXHU0RTBEXHU1M0Q4XHU2NUY2XHU1QjU4XHU2RDNCXHUzMDAyICovXG5mdW5jdGlvbiBwbGFuVGFza01lcmdlKFxuICB0OiBQbGFuVGFzayxcbiAgb2xkOiBUYXNrLFxuICBhdDogbnVtYmVyLFxuICBlc3RpbWF0ZTogbnVtYmVyLFxuKTogVGFzayB7XG4gIGNvbnN0IHRhc2sgPSBwbGFuVGFza1RvVGFzayh0LCBhdCwgZXN0aW1hdGUpO1xuICB0YXNrLmNyZWF0ZWRBdCA9IG9sZC5jcmVhdGVkQXQ7XG4gIHRhc2suY29tcGxldGVkID0gb2xkLmNvbXBsZXRlZDtcbiAgdGFzay5jb21wbGV0ZWRBdCA9IG9sZC5jb21wbGV0ZWRBdDtcbiAgaWYgKG9sZC5kdWVEYXRlID09PSB0LmR1ZURhdGUgJiYgb2xkLnJlbWluZGVyVGltZSA9PT0gdC5yZW1pbmRlclRpbWUpIHtcbiAgICB0YXNrLnJlbWluZGVyRmlyZWQgPSBvbGQucmVtaW5kZXJGaXJlZDtcbiAgICB0YXNrLnJlbWluZGVyUGVuZGluZyA9IG9sZC5yZW1pbmRlclBlbmRpbmc7XG4gICAgdGFzay5yZW1pbmRlckV4cGlyZWQgPSBvbGQucmVtaW5kZXJFeHBpcmVkO1xuICB9XG4gIGZvciAoY29uc3Qgc3ViIG9mIHRhc2suc3VidGFza3MpIHtcbiAgICBjb25zdCBwcmV2ID0gb2xkLnN1YnRhc2tzLmZpbmQoKHMpID0+IHMuaWQgPT09IHN1Yi5pZCk7XG4gICAgaWYgKHByZXYgIT09IHVuZGVmaW5lZCkgc3ViLmRvbmUgPSBwcmV2LmRvbmU7XG4gIH1cbiAgcmV0dXJuIHRhc2s7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVBsYW5GaWxlKHBsYW46IFBsYW5GaWxlKTogdm9pZCB7XG4gIGlmIChwbGFuLmZvcm1hdCAhPT0gXCJ0b21hdG8tdG9kby1wbGFuXCIgfHwgcGxhbi52ZXJzaW9uICE9PSA2KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RUM1XHU2NTJGXHU2MzAxXHU4QkExXHU1MjEyIHY2XHVGRjFCXHU2NUU3XHU4QkExXHU1MjEyXHU4QkY3XHU2MzA5XHU2NUIwXHU2ODNDXHU1RjBGXHU5MUNEXHU2NUIwXHU1QkZDXHU1MUZBXCIpO1xuICB9XG4gIGlmIChwbGFuLnRhc2tzLnNvbWUoKHQpID0+IHQucmVwZWF0ICE9PSBcIm5vbmVcIikpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTVCOUVcdTRGOEJcdTRFMERcdTYyRTVcdTY3MDlcdTkxQ0RcdTU5MERcdTg5QzRcdTUyMTlcdUZGMENcdThCRjdcdTRGN0ZcdTc1MjhcdTU0NjhcdTY3MUZcdTZBMjFcdTY3N0ZcIik7XG4gIH1cbiAgaWYgKHBsYW4ucG9tb2Rvcm9NaW51dGVzIDwgMSB8fCBwbGFuLnBvbW9kb3JvTWludXRlcyA+IDE4MCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJBMVx1NTIxMlx1NzY4NFx1NzU2QVx1ODMwNFx1NjVGNlx1OTU3Rlx1OTcwMFx1NEUzQSAxXHUyMDEzMTgwIFx1NTIwNlx1OTQ5RlwiKTtcbiAgfVxuICBjb25zdCBkYXRhID0gbmV3IEFwcERhdGEoe1xuICAgIHByb2plY3RzOiBwbGFuLnByb2plY3RzLm1hcCgocCkgPT4gKHtcbiAgICAgIGlkOiBwLmlkLFxuICAgICAgbmFtZTogcC5uYW1lLFxuICAgICAgY29sb3I6IHAuY29sb3IsXG4gICAgICBhcHBXaGl0ZWxpc3Q6IHAuYXBwV2hpdGVsaXN0ID09PSBudWxsID8gbnVsbCA6IFsuLi5wLmFwcFdoaXRlbGlzdF0sXG4gICAgfSkpLFxuICAgIHRhc2tzOiBwbGFuLnRhc2tzLm1hcCgodCkgPT4gcGxhblRhc2tUb1Rhc2sodCwgMCwgdC5lc3RpbWF0ZSkpLFxuICAgIGJsb2NrczogcGxhbi5ibG9ja3MubWFwKChiKSA9PiAoeyAuLi5iLCBkYXlzOiBbLi4uYi5kYXlzXSB9KSksXG4gICAgdGVtcGxhdGVzOiBwbGFuLnRlbXBsYXRlcyxcbiAgICBwcmludHM6IHBsYW4ucHJpbnRzLFxuICAgIGhhYml0czogcGxhbi5oYWJpdHMsXG4gIH0pO1xuICBkYXRhLnZhbGlkYXRlKCk7XG59XG5cbi8qKiBcdTYzNjJcdTdCOTdcdTY3MkNcdTU3MzBcdTc1NkFcdTgzMDRcdTZCQjVcdTY1NzBcdUZGMUJcdTY1RTBcdTUzNTVcdTZCMjFcdTY1RjZcdTk1N0ZcdTYzMDlcdTY1ODdcdTRFRjZcdTc1NkFcdTgzMDRcdTY1RjZcdTk1N0ZcdTYzNjJcdTdCOTdcdTVFNzZcdTU0MTFcdTRFMEFcdTUzRDZcdTY1NzRcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBwbGFuRXN0aW1hdGUoXG4gIHQ6IFBsYW5UYXNrLFxuICBwb21vZG9ybzogbnVtYmVyLFxuICBmb2N1czogbnVtYmVyLFxuKTogbnVtYmVyIHtcbiAgY29uc3QgZXN0aW1hdGUgPVxuICAgIHQuZm9jdXNNaW51dGVzICE9PSBudWxsXG4gICAgICA/IHQuZXN0aW1hdGVcbiAgICAgIDogTWF0aC5jZWlsKCh0LmVzdGltYXRlICogcG9tb2Rvcm8pIC8gZm9jdXMpO1xuICBpZiAoZXN0aW1hdGUgPiA5OSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihgXHU0RUZCXHU1MkExXHUyMDFDJHt0LnRpdGxlfVx1MjAxRFx1NjM2Mlx1N0I5N1x1NTQwRVx1OEQ4NVx1OEZDNyA5OSBcdTRFMkFcdTc1NkFcdTgzMDRcdUZGMENcdThCRjdcdTUxNDhcdTYyQzZcdTUyMDZcdTRFRkJcdTUyQTFgKTtcbiAgfVxuICByZXR1cm4gZXN0aW1hdGU7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRlZEVzdGltYXRlKFxuICBlc3RpbWF0ZTogbnVtYmVyLFxuICBmb2N1czogbnVtYmVyIHwgbnVsbCxcbiAgc291cmNlOiBudW1iZXIsXG4gIGRlc3RpbmF0aW9uOiBudW1iZXIsXG4pOiBudW1iZXIge1xuICBjb25zdCBjb252ZXJ0ZWQgPVxuICAgIGZvY3VzICE9PSBudWxsID8gZXN0aW1hdGUgOiBNYXRoLmNlaWwoKGVzdGltYXRlICogc291cmNlKSAvIGRlc3RpbmF0aW9uKTtcbiAgaWYgKGNvbnZlcnRlZCA+IDk5KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2MzYyXHU3Qjk3XHU1NDBFXHU4RDg1XHU4RkM3IDk5IFx1NEUyQVx1NzU2QVx1ODMwNFx1RkYwQ1x1OEJGN1x1NTE0OFx1NjJDNlx1NTIwNlx1NkEyMVx1Njc3RlwiKTtcbiAgfVxuICByZXR1cm4gY29udmVydGVkO1xufVxuXG4vKiogXHU1QkZDXHU1MTY1XHVGRjFBXHU1MTQ4XHU1QjhDXHU2NTc0XHU2ODIxXHU5QThDXHU1MDE5XHU5MDA5XHVGRjBDXHU1MThEXHU1MzlGXHU1QjUwXHU2M0QwXHU0RUE0XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VQbGFuKHBsYW46IFBsYW5GaWxlLCBkYXRhOiBBcHBEYXRhLCBhdDogbnVtYmVyKTogdm9pZCB7XG4gIHZhbGlkYXRlUGxhbkZpbGUocGxhbik7XG4gIGNvbnN0IG5leHQgPSBjbG9uZShkYXRhKTtcbiAgZm9yIChjb25zdCBwbGFuUHJvamVjdCBvZiBwbGFuLnByb2plY3RzKSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBuZXh0LnByb2plY3RzLmZpbmQoKHApID0+IHAuaWQgPT09IHBsYW5Qcm9qZWN0LmlkKTtcbiAgICBpZiAoZXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gXHU5ODc5XHU3NkVFXHU5MTREXHU3RjZFXHU2NjJGXHU5MUNEXHU2NUIwXHU3NTFGXHU2MjEwXHU3Njg0XHVGRjBDXHU4RkRCXHU1RUE2XHU0RTBEXHU2NjJGXHVGRjFBXHU2NTg3XHU0RUY2XHU4M0I3XHU4MERDXHVGRjFCXHU3NzAxXHU3NTY1XHU3NjdEXHU1NDBEXHU1MzU1XHU0RkREXHU3NTU5XHU2NzJDXHU2NzNBXHU2RTA1XHU1MzU1XHUzMDAyXG4gICAgICBleGlzdGluZy5uYW1lID0gcGxhblByb2plY3QubmFtZTtcbiAgICAgIGV4aXN0aW5nLmNvbG9yID0gcGxhblByb2plY3QuY29sb3I7XG4gICAgICBpZiAocGxhblByb2plY3QuYXBwV2hpdGVsaXN0ICE9PSBudWxsKSB7XG4gICAgICAgIGV4aXN0aW5nLmFwcFdoaXRlbGlzdCA9IFsuLi5wbGFuUHJvamVjdC5hcHBXaGl0ZWxpc3RdO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0LnByb2plY3RzLnB1c2goe1xuICAgICAgICBpZDogcGxhblByb2plY3QuaWQsXG4gICAgICAgIG5hbWU6IHBsYW5Qcm9qZWN0Lm5hbWUsXG4gICAgICAgIGNvbG9yOiBwbGFuUHJvamVjdC5jb2xvcixcbiAgICAgICAgYXBwV2hpdGVsaXN0OlxuICAgICAgICAgIHBsYW5Qcm9qZWN0LmFwcFdoaXRlbGlzdCA9PT0gbnVsbFxuICAgICAgICAgICAgPyBudWxsXG4gICAgICAgICAgICA6IFsuLi5wbGFuUHJvamVjdC5hcHBXaGl0ZWxpc3RdLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgaGFiaXQgb2YgcGxhbi5oYWJpdHMpIHtcbiAgICBjb25zdCBleGlzdGluZyA9IG5leHQuaGFiaXRzLmZpbmQoKGgpID0+IGguaWQgPT09IGhhYml0LmlkKTtcbiAgICBpZiAoZXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZXhpc3RpbmcubmFtZSA9IGhhYml0Lm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQuaGFiaXRzLnB1c2goeyBpZDogaGFiaXQuaWQsIG5hbWU6IGhhYml0Lm5hbWUgfSk7XG4gICAgfVxuICB9XG4gIC8vIFx1NjVGNlx1NkJCNVx1NjYyRlx1N0VBRlx1OTE0RFx1N0Y2RVx1RkYxQVx1NjU4N1x1NEVGNlx1NzI0OFx1NjcyQ1x1NjZGRlx1NjM2Mlx1NjcyQ1x1NjczQVx1NzI0OFx1NjcyQ1x1RkYwQ1x1NjcyQVx1NjNEMFx1NTNDQVx1NzY4NFx1NEZERFx1NjMwMVx1NEUwRFx1NTJBOFx1MzAwMlxuICBmb3IgKGNvbnN0IGJsb2NrIG9mIHBsYW4uYmxvY2tzKSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBuZXh0LmJsb2Nrcy5maW5kKChiKSA9PiBiLmlkID09PSBibG9jay5pZCk7XG4gICAgaWYgKGV4aXN0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG5leHQuYmxvY2tzW25leHQuYmxvY2tzLmluZGV4T2YoZXhpc3RpbmcpXSA9IHtcbiAgICAgICAgLi4uYmxvY2ssXG4gICAgICAgIGRheXM6IFsuLi5ibG9jay5kYXlzXSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQuYmxvY2tzLnB1c2goeyAuLi5ibG9jaywgZGF5czogWy4uLmJsb2NrLmRheXNdIH0pO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IHBsYW5UZW1wbGF0ZSBvZiBwbGFuLnRlbXBsYXRlcykge1xuICAgIGNvbnN0IHRlbXBsYXRlOiBUZW1wbGF0ZSA9IGNsb25lKHBsYW5UZW1wbGF0ZSk7XG4gICAgdGVtcGxhdGUuc2hhcGUuZXN0aW1hdGUgPSBjb252ZXJ0ZWRFc3RpbWF0ZShcbiAgICAgIHRlbXBsYXRlLnNoYXBlLmVzdGltYXRlLFxuICAgICAgdGVtcGxhdGUuc2hhcGUuZm9jdXNNaW51dGVzLFxuICAgICAgcGxhbi5wb21vZG9yb01pbnV0ZXMsXG4gICAgICBkYXRhLnNldHRpbmdzLmZvY3VzTWludXRlcyxcbiAgICApO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gbmV4dC50ZW1wbGF0ZXMuZmluZCgodCkgPT4gdC5pZCA9PT0gdGVtcGxhdGUuaWQpO1xuICAgIGlmIChleGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBuZXh0LnRlbXBsYXRlc1tuZXh0LnRlbXBsYXRlcy5pbmRleE9mKGV4aXN0aW5nKV0gPSB0ZW1wbGF0ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dC50ZW1wbGF0ZXMucHVzaCh0ZW1wbGF0ZSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcHJpbnQgb2YgcGxhbi5wcmludHMpIHtcbiAgICBpZiAoXG4gICAgICAhbmV4dC5wcmludHMuc29tZShcbiAgICAgICAgKHApID0+IHAudGVtcGxhdGVJZCA9PT0gcHJpbnQudGVtcGxhdGVJZCAmJiBwLmRhdGUgPT09IHByaW50LmRhdGUsXG4gICAgICApXG4gICAgKSB7XG4gICAgICBuZXh0LnByaW50cy5wdXNoKHsgdGVtcGxhdGVJZDogcHJpbnQudGVtcGxhdGVJZCwgZGF0ZTogcHJpbnQuZGF0ZSB9KTtcbiAgICB9XG4gIH1cbiAgLy8gXHU1REYyXHU2NzA5XHU1QjlFXHU0RjhCXHU1M0Q2XHU2NTg3XHU0RUY2XHU5MTREXHU3RjZFXHUzMDAxXHU0RkREXHU3NTU5XHU4RkRCXHU1RUE2XHUzMDAyXG4gIGNvbnN0IGluY29taW5nID0gbmV3IE1hcDxzdHJpbmcsIFBsYW5UYXNrPigpO1xuICBmb3IgKGNvbnN0IHQgb2YgcGxhbi50YXNrcykgaW5jb21pbmcuc2V0KHQuaWQsIHQpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5leHQudGFza3MubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBjb25zdCB0YXNrID0gbmV4dC50YXNrc1tpXSE7XG4gICAgY29uc3QgcGxhblRhc2sgPSBpbmNvbWluZy5nZXQodGFzay5pZCk7XG4gICAgaWYgKHBsYW5UYXNrID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xuICAgIGlmIChkYXRhLnRlYWNoaW5nVGFzayh0YXNrLmlkKSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcdTRFMERcdTgwRkRcdTY1MzlcdTUxOTlcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdUZGMENcdThCRjdcdThDMDNcdTY1NzRcdTVCRjlcdTVFOTRcdThCRkVcdTdBMEJcdTYyMTZcdTRGNUNcdTRFMUFcIik7XG4gICAgfVxuICAgIGNvbnN0IGVzdGltYXRlID0gcGxhbkVzdGltYXRlKFxuICAgICAgcGxhblRhc2ssXG4gICAgICBwbGFuLnBvbW9kb3JvTWludXRlcyxcbiAgICAgIGRhdGEuc2V0dGluZ3MuZm9jdXNNaW51dGVzLFxuICAgICk7XG4gICAgY29uc3Qgb2xkID0gY2xvbmUodGFzayk7XG4gICAgbmV4dC50YXNrc1tpXSA9IHBsYW5UYXNrTWVyZ2UocGxhblRhc2ssIG9sZCwgYXQsIGVzdGltYXRlKTtcbiAgfVxuICBjb25zdCBsb2NhbElkcyA9IG5ldyBTZXQobmV4dC50YXNrcy5tYXAoKHQpID0+IHQuaWQpKTtcbiAgZm9yIChjb25zdCBwbGFuVGFzayBvZiBwbGFuLnRhc2tzKSB7XG4gICAgaWYgKGxvY2FsSWRzLmhhcyhwbGFuVGFzay5pZCkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGVzdGltYXRlID0gcGxhbkVzdGltYXRlKFxuICAgICAgcGxhblRhc2ssXG4gICAgICBwbGFuLnBvbW9kb3JvTWludXRlcyxcbiAgICAgIGRhdGEuc2V0dGluZ3MuZm9jdXNNaW51dGVzLFxuICAgICk7XG4gICAgY29uc3QgaW5zdGFuY2UgPSBwbGFuVGFza1RvVGFzayhwbGFuVGFzaywgYXQsIGVzdGltYXRlKTtcbiAgICBpZiAoaW5zdGFuY2UudGVtcGxhdGVJZCAhPT0gbnVsbCkge1xuICAgICAgaWYgKFxuICAgICAgICAhbmV4dC5wcmludHMuc29tZShcbiAgICAgICAgICAocCkgPT5cbiAgICAgICAgICAgIHAudGVtcGxhdGVJZCA9PT0gaW5zdGFuY2UudGVtcGxhdGVJZCAmJiBwLmRhdGUgPT09IGluc3RhbmNlLmR1ZURhdGUsXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICBuZXh0LnByaW50cy5wdXNoKHtcbiAgICAgICAgICB0ZW1wbGF0ZUlkOiBpbnN0YW5jZS50ZW1wbGF0ZUlkLFxuICAgICAgICAgIGRhdGU6IGluc3RhbmNlLmR1ZURhdGUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBuZXh0LnRhc2tzLnB1c2goaW5zdGFuY2UpO1xuICB9XG4gIGlmIChwbGFuLnJlcGxhY2UpIHtcbiAgICAvLyBcdTY1ODdcdTRFRjZcdTUzNzNcdTY1NzRcdTRFMkFcdThCQTFcdTUyMTJcdUZGMUFcdTUyMjBcdTYzODlcdTVCODNcdTRFMERcdTUxOERcdTYzRDBcdTUzQ0FcdTc2ODRcdTY3MkFcdTVCOENcdTYyMTBcdTk4NzlcdUZGMENcdTUzODZcdTUzRjJcdTZDMzhcdTRFMERcdTUyMjBcdTMwMDJcbiAgICBjb25zdCBwbGFubmVkVGFza3MgPSBuZXcgU2V0KHBsYW4udGFza3MubWFwKCh0KSA9PiB0LmlkKSk7XG4gICAgbmV4dC50YXNrcyA9IG5leHQudGFza3MuZmlsdGVyKFxuICAgICAgKHQpID0+XG4gICAgICAgIHQuY29tcGxldGVkIHx8XG4gICAgICAgIHBsYW5uZWRUYXNrcy5oYXModC5pZCkgfHxcbiAgICAgICAgZGF0YS50ZWFjaGluZ1Rhc2sodC5pZCkgIT09IHVuZGVmaW5lZCxcbiAgICApO1xuICAgIGNvbnN0IHBsYW5uZWRIYWJpdHMgPSBuZXcgU2V0KHBsYW4uaGFiaXRzLm1hcCgoaCkgPT4gaC5pZCkpO1xuICAgIGNvbnN0IHJlbW92ZWRIYWJpdHMgPSBuZXh0LmhhYml0c1xuICAgICAgLmZpbHRlcigoaCkgPT4gIXBsYW5uZWRIYWJpdHMuaGFzKGguaWQpKVxuICAgICAgLm1hcCgoaCkgPT4gaC5pZCk7XG4gICAgaWYgKHJlbW92ZWRIYWJpdHMubGVuZ3RoID4gMCkge1xuICAgICAgbmV4dC5oYWJpdHMgPSBuZXh0LmhhYml0cy5maWx0ZXIoKGgpID0+ICFyZW1vdmVkSGFiaXRzLmluY2x1ZGVzKGguaWQpKTtcbiAgICAgIGZvciAoY29uc3QgdGFzayBvZiBuZXh0LnRhc2tzKSB7XG4gICAgICAgIGlmICh0YXNrLmhhYml0SWQgIT09IG51bGwgJiYgcmVtb3ZlZEhhYml0cy5pbmNsdWRlcyh0YXNrLmhhYml0SWQpKVxuICAgICAgICAgIHRhc2suaGFiaXRJZCA9IG51bGw7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHRlbXBsYXRlIG9mIG5leHQudGVtcGxhdGVzKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0ZW1wbGF0ZS5zaGFwZS5oYWJpdElkICE9PSBudWxsICYmXG4gICAgICAgICAgcmVtb3ZlZEhhYml0cy5pbmNsdWRlcyh0ZW1wbGF0ZS5zaGFwZS5oYWJpdElkKVxuICAgICAgICApIHtcbiAgICAgICAgICB0ZW1wbGF0ZS5zaGFwZS5oYWJpdElkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBwbGFubmVkVGVtcGxhdGVzID0gbmV3IFNldChwbGFuLnRlbXBsYXRlcy5tYXAoKHQpID0+IHQuaWQpKTtcbiAgICBjb25zdCByZW1vdmVkVGVtcGxhdGVzID0gbmV4dC50ZW1wbGF0ZXNcbiAgICAgIC5maWx0ZXIoKHQpID0+ICFwbGFubmVkVGVtcGxhdGVzLmhhcyh0LmlkKSlcbiAgICAgIC5tYXAoKHQpID0+IHQuaWQpO1xuICAgIGZvciAoY29uc3QgaWQgb2YgcmVtb3ZlZFRlbXBsYXRlcykge1xuICAgICAgZGVsZXRlVGVtcGxhdGUobmV4dCwgaWQpO1xuICAgIH1cbiAgICBjb25zdCBwbGFubmVkQmxvY2tzID0gbmV3IFNldChwbGFuLmJsb2Nrcy5tYXAoKGIpID0+IGIuaWQpKTtcbiAgICBuZXh0LmJsb2NrcyA9IG5leHQuYmxvY2tzLmZpbHRlcigoYikgPT4gcGxhbm5lZEJsb2Nrcy5oYXMoYi5pZCkpO1xuICB9XG4gIG5leHQudmFsaWRhdGUoKTtcbiAgcmVwbGFjZUFwcERhdGEoZGF0YSwgbmV4dCk7XG59XG5cbi8qKiBcdTVCRkNcdTUxRkFcdUZGMUFcdTRFMERcdTU0MkJcdTVCOENcdTYyMTBcdThGREJcdTVFQTZcdTMwMDFcdTRFMTNcdTZDRThcdTUzODZcdTUzRjJcdTMwMDFcdThCQTFcdTY1RjZcdTU2NjhcdTRFMEVcdTY3MkNcdTY3M0FcdThCQkVcdTdGNkVcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBleHBvcnRQbGFuKGRhdGE6IEFwcERhdGEpOiBQbGFuRmlsZSB7XG4gIGNvbnN0IHRhc2tzOiBQbGFuVGFza1tdID0gZGF0YS50YXNrc1xuICAgIC5maWx0ZXIoKHQpID0+ICF0LmNvbXBsZXRlZCAmJiBkYXRhLnRlYWNoaW5nVGFzayh0LmlkKSA9PT0gdW5kZWZpbmVkKVxuICAgIC5tYXAoKHQpID0+ICh7XG4gICAgICB0ZW1wbGF0ZUlkOiB0LnRlbXBsYXRlSWQsXG4gICAgICBoYWJpdElkOiB0LmhhYml0SWQsXG4gICAgICByZWN1cnJpbmc6IHQucmVjdXJyaW5nLFxuICAgICAgc2NyYXBNaW51dGVzOiB0LnNjcmFwTWludXRlcyxcbiAgICAgIGlkOiB0LmlkLFxuICAgICAgdGl0bGU6IHQudGl0bGUsXG4gICAgICBub3RlczogdC5ub3RlcyxcbiAgICAgIHByb2plY3RJZDogdC5wcm9qZWN0SWQsXG4gICAgICBkdWVEYXRlOiB0LmR1ZURhdGUsXG4gICAgICByZW1pbmRlclRpbWU6IHQucmVtaW5kZXJUaW1lLFxuICAgICAgZm9jdXNNaW51dGVzOiB0LmZvY3VzTWludXRlcyxcbiAgICAgIHByaW9yaXR5OiB0LnByaW9yaXR5LFxuICAgICAgZXN0aW1hdGU6IHQuZXN0aW1hdGUsXG4gICAgICB0YWdzOiBbLi4udC50YWdzXSxcbiAgICAgIHJlcGVhdDogXCJub25lXCIgYXMgY29uc3QsXG4gICAgICBzdWJ0YXNrczogdC5zdWJ0YXNrcy5tYXAoKHMpID0+ICh7IGlkOiBzLmlkLCB0aXRsZTogcy50aXRsZSB9KSksXG4gICAgfSkpO1xuICBjb25zdCB1c2VkID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAuLi50YXNrc1xuICAgICAgLmZpbHRlcigodCkgPT4gdC5wcm9qZWN0SWQgIT09IG51bGwpXG4gICAgICAubWFwKCh0KSA9PiB0LnByb2plY3RJZCBhcyBzdHJpbmcpLFxuICAgIC4uLmRhdGEudGVtcGxhdGVzXG4gICAgICAuZmlsdGVyKCh0KSA9PiB0LnNoYXBlLnByb2plY3RJZCAhPT0gbnVsbClcbiAgICAgIC5tYXAoKHQpID0+IHQuc2hhcGUucHJvamVjdElkIGFzIHN0cmluZyksXG4gIF0pO1xuICByZXR1cm4ge1xuICAgIGZvcm1hdDogXCJ0b21hdG8tdG9kby1wbGFuXCIsXG4gICAgdmVyc2lvbjogNixcbiAgICByZXBsYWNlOiBmYWxzZSxcbiAgICBibG9ja3M6IGRhdGEuYmxvY2tzLm1hcCgoYikgPT4gKHsgLi4uYiwgZGF5czogWy4uLmIuZGF5c10gfSkpLFxuICAgIHRlbXBsYXRlczogZGF0YS50ZW1wbGF0ZXMubWFwKCh0KSA9PiBjbG9uZSh0KSksXG4gICAgcHJpbnRzOiBkYXRhLnByaW50cy5tYXAoKHApID0+ICh7IC4uLnAgfSkpLFxuICAgIGhhYml0czogZGF0YS5oYWJpdHMubWFwKChoKSA9PiAoeyAuLi5oIH0pKSxcbiAgICBwb21vZG9yb01pbnV0ZXM6IGRhdGEuc2V0dGluZ3MuZm9jdXNNaW51dGVzLFxuICAgIHByb2plY3RzOiBkYXRhLnByb2plY3RzXG4gICAgICAuZmlsdGVyKChwKSA9PiB1c2VkLmhhcyhwLmlkKSlcbiAgICAgIC5tYXAoKHApID0+ICh7XG4gICAgICAgIGlkOiBwLmlkLFxuICAgICAgICBuYW1lOiBwLm5hbWUsXG4gICAgICAgIGNvbG9yOiBwLmNvbG9yLFxuICAgICAgICBhcHBXaGl0ZWxpc3Q6IHAuYXBwV2hpdGVsaXN0ID09PSBudWxsID8gbnVsbCA6IFsuLi5wLmFwcFdoaXRlbGlzdF0sXG4gICAgICB9KSksXG4gICAgdGFza3MsXG4gIH07XG59XG4iLCAiLy8hIFx1NTE3MVx1NEVBQlx1NkEyMVx1NTc4Qlx1MzAwMVx1OEJBMVx1NjVGNlx1NzJCNlx1NjAwMVx1NjczQVx1NEUwRVx1NjgyMVx1OUE4Q1x1NTE2NVx1NTNFM1x1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvbGliLnJzXHVGRjA4RW5naW5lIFx1NTcyOCBlbmdpbmUudHNcdUZGMENcdTY4NENcdTk3NjIgZ3VhcmQgXHU1MzlGXHU3NTFGXHU0RkREXHU3NTU5XHVGRjA5XHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yLCBjaGFyQ291bnQsIGNsb25lLCBlbnN1cmUsIHV0ZjhMZW4gfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7IGlkIH0gZnJvbSBcIi4vaWRzXCI7XG5pbXBvcnQge1xuICBhc0FycmF5LFxuICBhc0Jvb2wsXG4gIGFzSW50LFxuICBhc09wdCxcbiAgYXNTdHIsXG4gIGZpZWxkLFxuICBpc09iamVjdCxcbiAgb25lT2YsXG4gIHJlamVjdFVua25vd24sXG4gIHJlcXVpcmVkRmllbGQsXG59IGZyb20gXCIuL2pzb25cIjtcbmltcG9ydCB0eXBlIHtcbiAgQWN0aXZlTG9jayxcbiAgQXR0ZW50aW9uLFxuICBCbG9jayxcbiAgRGV0YWNoVGFyZ2V0LFxuICBEYXlTdGF0LFxuICBHdWFyZE1vZGUsXG4gIEhhYml0LFxuICBIYWJpdFNsb3QsXG4gIElkZW50aXR5LFxuICBMb2NrU2NoZWR1bGUsXG4gIExvY2tTdGF0ZSxcbiAgTW9kZSxcbiAgUGxhbkZpbGUsXG4gIFByaW50aW5nLFxuICBQcm9qZWN0LFxuICBSZXBlYXQsXG4gIFNlc3Npb24sXG4gIFNlc3Npb25Tb3VyY2UsXG4gIFNldHRpbmdzLFxuICBTaGFwZSxcbiAgU3RhdHMsXG4gIFN1YnRhc2ssXG4gIFRhc2ssXG4gIFRhc2tEcmFmdCxcbiAgVGFza0tpbmQsXG4gIFRlbXBsYXRlLFxuICBUaW1lcixcbiAgVmlzaW9uLFxufSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgaXNIYWJpdCwga2luZE9mIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IHZhbGlkYXRlTG9jaywgcmVsZWFzZUxvY2ssIHNjaGVkdWxlZEF0IH0gZnJvbSBcIi4vbG9ja1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVCbG9ja3MgfSBmcm9tIFwiLi9ibG9ja3NcIjtcbmltcG9ydCB7IHZhbGlkYXRlSGFiaXQgfSBmcm9tIFwiLi9oYWJpdHNcIjtcbmltcG9ydCB7IHZhbGlkYXRlVGVtcGxhdGVzLCB0YXNrSXNWb2lkIH0gZnJvbSBcIi4vdGVtcGxhdGVzXCI7XG5pbXBvcnQge1xuICBkdXJhdGlvbk9mLFxuICBkdWVBdXRvVGFzayxcbiAgcGVuZGluZ1JlbWluZGVyLFxuICByZWNvcmRTZXNzaW9uLFxuICByZW1pbmRlcklkbGUsXG4gIHJlc2V0VG8sXG4gIHN0YXJ0RHVlVGFzayxcbiAgc3RhcnRUaW1lcixcbiAgdGFza0hhc1JvdW5kc0xlZnQsXG4gIHRpY2tSZW1pbmRlcnMsXG4gIHRpbWVyUmVtYWluaW5nLFxuICB3aW5kb3dNaW51dGVzLFxufSBmcm9tIFwiLi9yZW1pbmRlcnNcIjtcbmltcG9ydCB7IEVkdWNhdGlvbiwgcGFyc2VFZHVjYXRpb24sIHNlcmlhbGl6ZUVkdWNhdGlvbiB9IGZyb20gXCIuL2VkdWNhdGlvblwiO1xuaW1wb3J0IHtcbiAgY29tcGxldGVUZWFjaGluZ1Rhc2ssXG4gIG1hdGVyaWFsaXplVGVhY2hpbmdUYXNrcyxcbiAgc3RhcnRUZWFjaGluZ1Rhc2ssXG4gIHRlYWNoaW5nVGFzayxcbiAgdmFsaWRhdGVUZWFjaGluZ1Rhc2tzLFxufSBmcm9tIFwiLi90ZWFjaGluZ190YXNrc1wiO1xuaW1wb3J0IHtcbiAgdmFsaWRhdGVJZGVudGl0aWVzLFxuICBwYXJzZUlkZW50aXR5LFxuICBzZXJpYWxpemVJZGVudGl0eSxcbn0gZnJvbSBcIi4vaWRlbnRpdGllc1wiO1xuaW1wb3J0IHsgZXhwb3J0UGxhbiwgbWVyZ2VQbGFuIH0gZnJvbSBcIi4vcGxhblwiO1xuaW1wb3J0IHtcbiAgZGVsZXRlVGVtcGxhdGUsXG4gIGZyb21UYXNrLFxuICBtYXRlcmlhbGl6ZVRlbXBsYXRlcyxcbiAgcHJpbnRJbnN0YW5jZXMsXG4gIHByaW50VGVtcGxhdGUsXG4gIHJlcGxhY2VBcHBEYXRhLFxuICBzYXZlVGVtcGxhdGUsXG4gIHN5bmNUZW1wbGF0ZSxcbn0gZnJvbSBcIi4vdGVtcGxhdGVzXCI7XG5pbXBvcnQgeyBwYXJzZUxvY2tTdGF0ZSwgc2VyaWFsaXplTG9ja1N0YXRlIH0gZnJvbSBcIi4vbG9ja1wiO1xuaW1wb3J0IHsgcGFyc2VCbG9jaywgc2VyaWFsaXplQmxvY2sgfSBmcm9tIFwiLi9ibG9ja3NcIjtcbmltcG9ydCB7IHBhcnNlSGFiaXQsIHNlcmlhbGl6ZUhhYml0IH0gZnJvbSBcIi4vaGFiaXRzXCI7XG5pbXBvcnQgeyBhZGREYXlzLCBkYXRlQXQsIHZhbGlkRGF0ZSB9IGZyb20gXCIuL3RpbWVcIjtcblxuLy8gLS0tLS0tLS0tLSBcdTU3RkFcdTc4NDBcdTdDN0JcdTU3OEJcdTg5RTNcdTY3OTAvXHU1RThGXHU1MjE3XHU1MzE2IC0tLS0tLS0tLS1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvamVjdChyYXc6IHVua25vd24pOiBQcm9qZWN0IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk4NzlcdTc2RUVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU5ODc5XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBuYW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJuYW1lXCIsIFwiXHU5ODc5XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBjb2xvcjogcmVxdWlyZWRGaWVsZChyYXcsIFwiY29sb3JcIiwgXCJcdTk4NzlcdTc2RUVcIiwgYXNTdHIpLFxuICAgIGFwcFdoaXRlbGlzdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImFwcFdoaXRlbGlzdFwiLFxuICAgICAgXCJcdTk4NzlcdTc2RUVcIixcbiAgICAgICh2KSA9PlxuICAgICAgICBhc09wdCh2LCBcImFwcFdoaXRlbGlzdFwiLCAoeCkgPT5cbiAgICAgICAgICBhc0FycmF5KHgsIFwiYXBwV2hpdGVsaXN0XCIpLm1hcCgoYSkgPT4gYXNTdHIoYSwgXCJcdTVFOTRcdTc1MjggSURcIikpLFxuICAgICAgICApLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZ1tdIHwgbnVsbCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVByb2plY3QocDogUHJvamVjdCk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3Qgb3V0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICBpZDogcC5pZCxcbiAgICBuYW1lOiBwLm5hbWUsXG4gICAgY29sb3I6IHAuY29sb3IsXG4gIH07XG4gIGlmIChwLmFwcFdoaXRlbGlzdCAhPT0gbnVsbCkgb3V0W1wiYXBwV2hpdGVsaXN0XCJdID0gcC5hcHBXaGl0ZWxpc3Q7XG4gIHJldHVybiBvdXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVZpc2lvbihyYXc6IHVua25vd24pOiBWaXNpb24ge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjEzRlx1NjY2Rlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFtcImlkXCIsIFwibmFtZVwiLCBcIm5vdGVzXCIsIFwicHJvamVjdElkXCJdLCBcIlx1NjEzRlx1NjY2RlwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTYxM0ZcdTY2NkZcIiwgYXNTdHIpLFxuICAgIG5hbWU6IHJlcXVpcmVkRmllbGQocmF3LCBcIm5hbWVcIiwgXCJcdTYxM0ZcdTY2NkZcIiwgYXNTdHIpLFxuICAgIG5vdGVzOiBmaWVsZChyYXcsIFwibm90ZXNcIiwgXCJcdTYxM0ZcdTY2NkZcIiwgYXNTdHIsIFwiXCIpLFxuICAgIHByb2plY3RJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJcdTYxM0ZcdTY2NkZcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInByb2plY3RJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVZpc2lvbih2OiBWaXNpb24pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IG91dDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgaWQ6IHYuaWQsXG4gICAgbmFtZTogdi5uYW1lLFxuICAgIG5vdGVzOiB2Lm5vdGVzLFxuICB9O1xuICBpZiAodi5wcm9qZWN0SWQgIT09IG51bGwpIG91dFtcInByb2plY3RJZFwiXSA9IHYucHJvamVjdElkO1xuICByZXR1cm4gb3V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTdWJ0YXNrKHJhdzogdW5rbm93bik6IFN1YnRhc2sge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NUI1MFx1NEVGQlx1NTJBMVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTVCNTBcdTRFRkJcdTUyQTFcIiwgYXNTdHIpLFxuICAgIHRpdGxlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aXRsZVwiLCBcIlx1NUI1MFx1NEVGQlx1NTJBMVwiLCBhc1N0ciksXG4gICAgZG9uZTogcmVxdWlyZWRGaWVsZChyYXcsIFwiZG9uZVwiLCBcIlx1NUI1MFx1NEVGQlx1NTJBMVwiLCBhc0Jvb2wpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU3VidGFzayhzOiBTdWJ0YXNrKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4geyBpZDogcy5pZCwgdGl0bGU6IHMudGl0bGUsIGRvbmU6IHMuZG9uZSB9O1xufVxuXG5jb25zdCBUQVNLX0tFWVMgPSBbXG4gIFwiaWRcIixcbiAgXCJ0ZW1wbGF0ZUlkXCIsXG4gIFwicmVjdXJyaW5nXCIsXG4gIFwidGl0bGVcIixcbiAgXCJub3Rlc1wiLFxuICBcInByb2plY3RJZFwiLFxuICBcImhhYml0SWRcIixcbiAgXCJkdWVEYXRlXCIsXG4gIFwicmVtaW5kZXJUaW1lXCIsXG4gIFwiZm9jdXNNaW51dGVzXCIsXG4gIFwic2NyYXBNaW51dGVzXCIsXG4gIFwicHJpb3JpdHlcIixcbiAgXCJlc3RpbWF0ZVwiLFxuICBcInJlbWluZGVyRmlyZWRcIixcbiAgXCJyZW1pbmRlclBlbmRpbmdcIixcbiAgXCJyZW1pbmRlckV4cGlyZWRcIixcbiAgXCJjb21wbGV0ZWRcIixcbiAgXCJjb21wbGV0ZWRBdFwiLFxuICBcImNyZWF0ZWRBdFwiLFxuICBcInRhZ3NcIixcbiAgXCJzdWJ0YXNrc1wiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGFzayhyYXc6IHVua25vd24pOiBUYXNrIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFRkJcdTUyQTFcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uVEFTS19LRVlTXSwgXCJcdTRFRkJcdTUyQTFcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzU3RyKSxcbiAgICB0ZW1wbGF0ZUlkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGVtcGxhdGVJZFwiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInRlbXBsYXRlSWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgcmVjdXJyaW5nOiBmaWVsZChyYXcsIFwicmVjdXJyaW5nXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIHRpdGxlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aXRsZVwiLCBcIlx1NEVGQlx1NTJBMVwiLCBhc1N0ciksXG4gICAgbm90ZXM6IHJlcXVpcmVkRmllbGQocmF3LCBcIm5vdGVzXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0SWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJwcm9qZWN0SWRcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJwcm9qZWN0SWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgaGFiaXRJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImhhYml0SWRcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJoYWJpdElkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIGR1ZURhdGU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJkdWVEYXRlXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZHVlRGF0ZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICByZW1pbmRlclRpbWU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZW1pbmRlclRpbWVcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJyZW1pbmRlclRpbWVcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZm9jdXNNaW51dGVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiZm9jdXNNaW51dGVzXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZm9jdXNNaW51dGVzXCIsICh4KSA9PiBhc0ludCh4LCBcImZvY3VzTWludXRlc1wiKSksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBzY3JhcE1pbnV0ZXM6IGZpZWxkKHJhdywgXCJzY3JhcE1pbnV0ZXNcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNJbnQsIDApLFxuICAgIHByaW9yaXR5OiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcmlvcml0eVwiLCBcIlx1NEVGQlx1NTJBMVwiLCBhc0ludCksXG4gICAgZXN0aW1hdGU6IHJlcXVpcmVkRmllbGQocmF3LCBcImVzdGltYXRlXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzSW50KSxcbiAgICByZW1pbmRlckZpcmVkOiBmaWVsZChyYXcsIFwicmVtaW5kZXJGaXJlZFwiLCBcIlx1NEVGQlx1NTJBMVwiLCBhc0Jvb2wsIGZhbHNlKSxcbiAgICByZW1pbmRlclBlbmRpbmc6IGZpZWxkKHJhdywgXCJyZW1pbmRlclBlbmRpbmdcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNCb29sLCBmYWxzZSksXG4gICAgcmVtaW5kZXJFeHBpcmVkOiBmaWVsZChyYXcsIFwicmVtaW5kZXJFeHBpcmVkXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIGNvbXBsZXRlZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiY29tcGxldGVkXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzQm9vbCksXG4gICAgY29tcGxldGVkQXQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJjb21wbGV0ZWRBdFwiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImNvbXBsZXRlZEF0XCIsIGFzSW50KSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICAgIGNyZWF0ZWRBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwiY3JlYXRlZEF0XCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzSW50KSxcbiAgICB0YWdzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGFnc1wiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwidGFnc1wiKS5tYXAoKHQpID0+IGFzU3RyKHQsIFwiXHU2ODA3XHU3QjdFXCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgc3VidGFza3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzdWJ0YXNrc1wiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwic3VidGFza3NcIikubWFwKHBhcnNlU3VidGFzayksXG4gICAgICBbXSxcbiAgICApLFxuICB9O1xufVxuXG4vKipcbiAqIGNhbm9uaWNhbCBcdTRFRkJcdTUyQTFcdTVFOEZcdTUyMTdcdTUzMTZcdUZGMUFcdTk1MkVcdTVFOEZcdTRFMEUgUnVzdCBgVGFza2AgXHU1OEYwXHU2NjBFXHU1RThGXHU0RTAwXHU4MUY0XHUzMDAyXG4gKiBcdTY0QTRcdTk1MDBcdTYwNjJcdTU5MERcdTYyOEFcdThCRTVcdTRFMzJcdTVCNThcdThGREIgSWRlbnRpdHkucmVzdG9yZVRhc2tcdUZGMENcdTZCRDRcdThGODNcdTVGQzVcdTk4N0JcdTkwMTBcdTVCNTdcdTgyODJcdTRFMDBcdTgxRjRcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVRhc2sodDogVGFzayk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdC5pZCxcbiAgICB0ZW1wbGF0ZUlkOiB0LnRlbXBsYXRlSWQsXG4gICAgcmVjdXJyaW5nOiB0LnJlY3VycmluZyxcbiAgICB0aXRsZTogdC50aXRsZSxcbiAgICBub3RlczogdC5ub3RlcyxcbiAgICBwcm9qZWN0SWQ6IHQucHJvamVjdElkLFxuICAgIGhhYml0SWQ6IHQuaGFiaXRJZCxcbiAgICBkdWVEYXRlOiB0LmR1ZURhdGUsXG4gICAgcmVtaW5kZXJUaW1lOiB0LnJlbWluZGVyVGltZSxcbiAgICBmb2N1c01pbnV0ZXM6IHQuZm9jdXNNaW51dGVzLFxuICAgIHNjcmFwTWludXRlczogdC5zY3JhcE1pbnV0ZXMsXG4gICAgcHJpb3JpdHk6IHQucHJpb3JpdHksXG4gICAgZXN0aW1hdGU6IHQuZXN0aW1hdGUsXG4gICAgcmVtaW5kZXJGaXJlZDogdC5yZW1pbmRlckZpcmVkLFxuICAgIHJlbWluZGVyUGVuZGluZzogdC5yZW1pbmRlclBlbmRpbmcsXG4gICAgcmVtaW5kZXJFeHBpcmVkOiB0LnJlbWluZGVyRXhwaXJlZCxcbiAgICBjb21wbGV0ZWQ6IHQuY29tcGxldGVkLFxuICAgIGNvbXBsZXRlZEF0OiB0LmNvbXBsZXRlZEF0LFxuICAgIGNyZWF0ZWRBdDogdC5jcmVhdGVkQXQsXG4gICAgdGFnczogdC50YWdzLFxuICAgIHN1YnRhc2tzOiB0LnN1YnRhc2tzLm1hcChzZXJpYWxpemVTdWJ0YXNrKSxcbiAgfTtcbn1cblxuY29uc3QgVEFTS19EUkFGVF9LRVlTID0gW1xuICBcImlkXCIsXG4gIFwidGl0bGVcIixcbiAgXCJub3Rlc1wiLFxuICBcInByb2plY3RJZFwiLFxuICBcImR1ZURhdGVcIixcbiAgXCJyZW1pbmRlclRpbWVcIixcbiAgXCJmb2N1c01pbnV0ZXNcIixcbiAgXCJzY3JhcE1pbnV0ZXNcIixcbiAgXCJwcmlvcml0eVwiLFxuICBcImVzdGltYXRlXCIsXG4gIFwidGFnc1wiLFxuICBcInN1YnRhc2tzXCIsXG4gIFwicmVwZWF0XCIsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUYXNrRHJhZnQocmF3OiB1bmtub3duKTogVGFza0RyYWZ0IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFRkJcdTUyQTFcdTgzNDlcdTdBM0ZcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uVEFTS19EUkFGVF9LRVlTXSwgXCJcdTRFRkJcdTUyQTFcdTgzNDlcdTdBM0ZcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IGZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLCAodikgPT4gYXNPcHQodiwgXCJpZFwiLCBhc1N0ciksIG51bGwpIGFzXG4gICAgICBzdHJpbmcgfCBudWxsLFxuICAgIHRpdGxlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aXRsZVwiLCBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLCBhc1N0ciksXG4gICAgbm90ZXM6IGZpZWxkKHJhdywgXCJub3Rlc1wiLCBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLCBhc1N0ciwgXCJcIiksXG4gICAgcHJvamVjdElkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicHJvamVjdElkXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwicHJvamVjdElkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIGR1ZURhdGU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJkdWVEYXRlXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZHVlRGF0ZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICByZW1pbmRlclRpbWU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZW1pbmRlclRpbWVcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJyZW1pbmRlclRpbWVcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZm9jdXNNaW51dGVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiZm9jdXNNaW51dGVzXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZm9jdXNNaW51dGVzXCIsICh4KSA9PiBhc0ludCh4LCBcImZvY3VzTWludXRlc1wiKSksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBzY3JhcE1pbnV0ZXM6IGZpZWxkKHJhdywgXCJzY3JhcE1pbnV0ZXNcIiwgXCJcdTRFRkJcdTUyQTFcdTgzNDlcdTdBM0ZcIiwgYXNJbnQsIDApLFxuICAgIHByaW9yaXR5OiBmaWVsZChyYXcsIFwicHJpb3JpdHlcIiwgXCJcdTRFRkJcdTUyQTFcdTgzNDlcdTdBM0ZcIiwgYXNJbnQsIDApLFxuICAgIGVzdGltYXRlOiBmaWVsZChyYXcsIFwiZXN0aW1hdGVcIiwgXCJcdTRFRkJcdTUyQTFcdTgzNDlcdTdBM0ZcIiwgYXNJbnQsIDEpLFxuICAgIHRhZ3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YWdzXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0YWdzXCIpLm1hcCgodCkgPT4gYXNTdHIodCwgXCJcdTY4MDdcdTdCN0VcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBzdWJ0YXNrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInN1YnRhc2tzXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJzdWJ0YXNrc1wiKS5tYXAocGFyc2VTdWJ0YXNrKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgcmVwZWF0OiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicmVwZWF0XCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLFxuICAgICAgKHYpID0+IG9uZU9mKHYsIFwicmVwZWF0XCIsIFtcIm5vbmVcIiwgXCJkYWlseVwiLCBcIndlZWtkYXlzXCIsIFwid2Vla2x5XCJdKSxcbiAgICAgIFwibm9uZVwiLFxuICAgICkgYXMgUmVwZWF0LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIYWJpdFNsb3QocmF3OiB1bmtub3duKTogSGFiaXRTbG90IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFNjBcdTYwRUZcdTY1RjZcdTZCQjVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJldHVybiB7XG4gICAgZGF5czogYXNBcnJheShcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImRheXNcIiwgXCJcdTRFNjBcdTYwRUZcdTY1RjZcdTZCQjVcIiwgKHYpID0+IHYpLFxuICAgICAgXCJkYXlzXCIsXG4gICAgKS5tYXAoKGQpID0+IGFzSW50KGQsIFwiXHU0RTYwXHU2MEVGXHU2NjFGXHU2NzFGXCIpKSxcbiAgICB0aW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aW1lXCIsIFwiXHU0RTYwXHU2MEVGXHU2NUY2XHU2QkI1XCIsIGFzU3RyKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvdGVjdGlvbihyYXc6IHVua25vd24pOiB7XG4gIG1vZGU6IEd1YXJkTW9kZTtcbiAgd2hpdGVsaXN0OiBzdHJpbmdbXTtcbiAgc3RyaWN0OiBib29sZWFuO1xufSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RkREXHU2MkE0XHU4QkJFXHU3RjZFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZXR1cm4ge1xuICAgIG1vZGU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJtb2RlXCIsXG4gICAgICBcIlx1NEZERFx1NjJBNFx1OEJCRVx1N0Y2RVwiLFxuICAgICAgKHYpID0+IG9uZU9mKHYsIFwiXHU0RkREXHU2MkE0IG1vZGVcIiwgW1wib2ZmXCIsIFwibG9ja1wiLCBcIndoaXRlbGlzdFwiXSksXG4gICAgICBcIm9mZlwiLFxuICAgICkgYXMgR3VhcmRNb2RlLFxuICAgIHdoaXRlbGlzdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcIndoaXRlbGlzdFwiLFxuICAgICAgXCJcdTRGRERcdTYyQTRcdThCQkVcdTdGNkVcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwid2hpdGVsaXN0XCIpLm1hcCgoYSkgPT4gYXNTdHIoYSwgXCJcdTVFOTRcdTc1MjggSURcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBzdHJpY3Q6IGZpZWxkKHJhdywgXCJzdHJpY3RcIiwgXCJcdTRGRERcdTYyQTRcdThCQkVcdTdGNkVcIiwgYXNCb29sLCBmYWxzZSksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVQcm90ZWN0aW9uKHA6IHtcbiAgbW9kZTogR3VhcmRNb2RlO1xuICB3aGl0ZWxpc3Q6IHN0cmluZ1tdO1xuICBzdHJpY3Q6IGJvb2xlYW47XG59KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4geyBtb2RlOiBwLm1vZGUsIHdoaXRlbGlzdDogcC53aGl0ZWxpc3QsIHN0cmljdDogcC5zdHJpY3QgfTtcbn1cblxuY29uc3QgU0VUVElOR1NfS0VZUyA9IFtcbiAgXCJmb2N1c01pbnV0ZXNcIixcbiAgXCJzaG9ydEJyZWFrTWludXRlc1wiLFxuICBcImxvbmdCcmVha01pbnV0ZXNcIixcbiAgXCJsb25nQnJlYWtFdmVyeVwiLFxuICBcImRhaWx5R29hbFwiLFxuICBcImF1dG9CcmVha1wiLFxuICBcImF1dG9Gb2N1c1wiLFxuICBcImF1dG9TdGFydFRhc2tzXCIsXG4gIFwic291bmRcIixcbiAgXCJzb3VuZFZvbHVtZVwiLFxuICBcIm5vdGlmaWNhdGlvbnNcIixcbiAgXCJhbHdheXNPblRvcFwiLFxuICBcInRoZW1lXCIsXG4gIFwicGVyc29uYUJhY2tkcm9wXCIsXG4gIFwicHJvdGVjdGlvblwiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU2V0dGluZ3MocmF3OiB1bmtub3duKTogU2V0dGluZ3Mge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJCRVx1N0Y2RVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmV0dXJuIHtcbiAgICBmb2N1c01pbnV0ZXM6IHJlcXVpcmVkRmllbGQocmF3LCBcImZvY3VzTWludXRlc1wiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0ludCksXG4gICAgc2hvcnRCcmVha01pbnV0ZXM6IHJlcXVpcmVkRmllbGQocmF3LCBcInNob3J0QnJlYWtNaW51dGVzXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzSW50KSxcbiAgICBsb25nQnJlYWtNaW51dGVzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJsb25nQnJlYWtNaW51dGVzXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzSW50KSxcbiAgICBsb25nQnJlYWtFdmVyeTogcmVxdWlyZWRGaWVsZChyYXcsIFwibG9uZ0JyZWFrRXZlcnlcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNJbnQpLFxuICAgIGRhaWx5R29hbDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZGFpbHlHb2FsXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzSW50KSxcbiAgICBhdXRvQnJlYWs6IHJlcXVpcmVkRmllbGQocmF3LCBcImF1dG9CcmVha1wiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0Jvb2wpLFxuICAgIGF1dG9Gb2N1czogcmVxdWlyZWRGaWVsZChyYXcsIFwiYXV0b0ZvY3VzXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzQm9vbCksXG4gICAgYXV0b1N0YXJ0VGFza3M6IGZpZWxkKHJhdywgXCJhdXRvU3RhcnRUYXNrc1wiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0Jvb2wsIGZhbHNlKSxcbiAgICBzb3VuZDogcmVxdWlyZWRGaWVsZChyYXcsIFwic291bmRcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNCb29sKSxcbiAgICBzb3VuZFZvbHVtZTogZmllbGQocmF3LCBcInNvdW5kVm9sdW1lXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzSW50LCAxMDApLFxuICAgIG5vdGlmaWNhdGlvbnM6IHJlcXVpcmVkRmllbGQocmF3LCBcIm5vdGlmaWNhdGlvbnNcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNCb29sKSxcbiAgICBhbHdheXNPblRvcDogcmVxdWlyZWRGaWVsZChyYXcsIFwiYWx3YXlzT25Ub3BcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNCb29sKSxcbiAgICB0aGVtZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGhlbWVcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNTdHIpLFxuICAgIHBlcnNvbmFCYWNrZHJvcDogZmllbGQocmF3LCBcInBlcnNvbmFCYWNrZHJvcFwiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0Jvb2wsIGZhbHNlKSxcbiAgICBwcm90ZWN0aW9uOiBmaWVsZChyYXcsIFwicHJvdGVjdGlvblwiLCBcIlx1OEJCRVx1N0Y2RVwiLCBwYXJzZVByb3RlY3Rpb24sIHtcbiAgICAgIG1vZGU6IFwib2ZmXCIsXG4gICAgICB3aGl0ZWxpc3Q6IFtdLFxuICAgICAgc3RyaWN0OiBmYWxzZSxcbiAgICB9KSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVNldHRpbmdzKHM6IFNldHRpbmdzKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGZvY3VzTWludXRlczogcy5mb2N1c01pbnV0ZXMsXG4gICAgc2hvcnRCcmVha01pbnV0ZXM6IHMuc2hvcnRCcmVha01pbnV0ZXMsXG4gICAgbG9uZ0JyZWFrTWludXRlczogcy5sb25nQnJlYWtNaW51dGVzLFxuICAgIGxvbmdCcmVha0V2ZXJ5OiBzLmxvbmdCcmVha0V2ZXJ5LFxuICAgIGRhaWx5R29hbDogcy5kYWlseUdvYWwsXG4gICAgYXV0b0JyZWFrOiBzLmF1dG9CcmVhayxcbiAgICBhdXRvRm9jdXM6IHMuYXV0b0ZvY3VzLFxuICAgIGF1dG9TdGFydFRhc2tzOiBzLmF1dG9TdGFydFRhc2tzLFxuICAgIHNvdW5kOiBzLnNvdW5kLFxuICAgIHNvdW5kVm9sdW1lOiBzLnNvdW5kVm9sdW1lLFxuICAgIG5vdGlmaWNhdGlvbnM6IHMubm90aWZpY2F0aW9ucyxcbiAgICBhbHdheXNPblRvcDogcy5hbHdheXNPblRvcCxcbiAgICB0aGVtZTogcy50aGVtZSxcbiAgICBwZXJzb25hQmFja2Ryb3A6IHMucGVyc29uYUJhY2tkcm9wLFxuICAgIHByb3RlY3Rpb246IHNlcmlhbGl6ZVByb3RlY3Rpb24ocy5wcm90ZWN0aW9uKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZmF1bHRTZXR0aW5ncygpOiBTZXR0aW5ncyB7XG4gIHJldHVybiB7XG4gICAgZm9jdXNNaW51dGVzOiAyNSxcbiAgICBzaG9ydEJyZWFrTWludXRlczogNSxcbiAgICBsb25nQnJlYWtNaW51dGVzOiAxNSxcbiAgICBsb25nQnJlYWtFdmVyeTogNCxcbiAgICBkYWlseUdvYWw6IDgsXG4gICAgYXV0b0JyZWFrOiBmYWxzZSxcbiAgICBhdXRvRm9jdXM6IGZhbHNlLFxuICAgIGF1dG9TdGFydFRhc2tzOiBmYWxzZSxcbiAgICBzb3VuZDogdHJ1ZSxcbiAgICBzb3VuZFZvbHVtZTogMTAwLFxuICAgIG5vdGlmaWNhdGlvbnM6IHRydWUsXG4gICAgYWx3YXlzT25Ub3A6IGZhbHNlLFxuICAgIHRoZW1lOiBcImxpZ2h0XCIsXG4gICAgcGVyc29uYUJhY2tkcm9wOiBmYWxzZSxcbiAgICBwcm90ZWN0aW9uOiB7IG1vZGU6IFwib2ZmXCIsIHdoaXRlbGlzdDogW10sIHN0cmljdDogZmFsc2UgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGltZXIocmF3OiB1bmtub3duKTogVGltZXIge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJBMVx1NjVGNlx1NTY2OFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmV0dXJuIHtcbiAgICBtb2RlOiBvbmVPZihcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcIm1vZGVcIiwgXCJcdThCQTFcdTY1RjZcdTU2NjhcIiwgKHYpID0+IHYpLFxuICAgICAgXCJcdThCQTFcdTY1RjZcdTU2NjggbW9kZVwiLFxuICAgICAgW1wiZm9jdXNcIiwgXCJzaG9ydEJyZWFrXCIsIFwibG9uZ0JyZWFrXCJdLFxuICAgICkgYXMgTW9kZSxcbiAgICBydW5uaW5nOiByZXF1aXJlZEZpZWxkKHJhdywgXCJydW5uaW5nXCIsIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsIGFzQm9vbCksXG4gICAgdGFza0lkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGFza0lkXCIsXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwidGFza0lkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIGR1cmF0aW9uU2VjczogcmVxdWlyZWRGaWVsZChyYXcsIFwiZHVyYXRpb25TZWNzXCIsIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsIGFzSW50KSxcbiAgICByZW1haW5pbmdTZWNzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJyZW1haW5pbmdTZWNzXCIsIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsIGFzSW50KSxcbiAgICBkZWFkbGluZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImRlYWRsaW5lXCIsXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZGVhZGxpbmVcIiwgYXNJbnQpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIG51bWJlciB8IG51bGwsXG4gICAgc3RhcnRlZEF0OiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwic3RhcnRlZEF0XCIsXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwic3RhcnRlZEF0XCIsIGFzSW50KSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICAgIGN5Y2xlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjeWNsZVwiLCBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLCBhc0ludCksXG4gICAgY3ljbGVEYXRlOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiY3ljbGVEYXRlXCIsXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiY3ljbGVEYXRlXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIGNvbXBsZXRpb25TZXJpYWw6IHJlcXVpcmVkRmllbGQocmF3LCBcImNvbXBsZXRpb25TZXJpYWxcIiwgXCJcdThCQTFcdTY1RjZcdTU2NjhcIiwgYXNJbnQpLFxuICAgIGxhc3RGaW5pc2hlZE1vZGU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJsYXN0RmluaXNoZWRNb2RlXCIsXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLFxuICAgICAgKHYpID0+XG4gICAgICAgIGFzT3B0KHYsIFwibGFzdEZpbmlzaGVkTW9kZVwiLCAoeCkgPT5cbiAgICAgICAgICBvbmVPZih4LCBcImxhc3RGaW5pc2hlZE1vZGVcIiwgW1wiZm9jdXNcIiwgXCJzaG9ydEJyZWFrXCIsIFwibG9uZ0JyZWFrXCJdKSxcbiAgICAgICAgKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBNb2RlIHwgbnVsbCxcbiAgICBhdXRvRm9jdXNCbG9ja2VkOiBmaWVsZChyYXcsIFwiYXV0b0ZvY3VzQmxvY2tlZFwiLCBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLCBhc0Jvb2wsIGZhbHNlKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVRpbWVyKHQ6IFRpbWVyKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIG1vZGU6IHQubW9kZSxcbiAgICBydW5uaW5nOiB0LnJ1bm5pbmcsXG4gICAgdGFza0lkOiB0LnRhc2tJZCxcbiAgICBkdXJhdGlvblNlY3M6IHQuZHVyYXRpb25TZWNzLFxuICAgIHJlbWFpbmluZ1NlY3M6IHQucmVtYWluaW5nU2VjcyxcbiAgICBkZWFkbGluZTogdC5kZWFkbGluZSxcbiAgICBzdGFydGVkQXQ6IHQuc3RhcnRlZEF0LFxuICAgIGN5Y2xlOiB0LmN5Y2xlLFxuICAgIGN5Y2xlRGF0ZTogdC5jeWNsZURhdGUsXG4gICAgY29tcGxldGlvblNlcmlhbDogdC5jb21wbGV0aW9uU2VyaWFsLFxuICAgIGxhc3RGaW5pc2hlZE1vZGU6IHQubGFzdEZpbmlzaGVkTW9kZSxcbiAgICBhdXRvRm9jdXNCbG9ja2VkOiB0LmF1dG9Gb2N1c0Jsb2NrZWQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0VGltZXIoKTogVGltZXIge1xuICByZXR1cm4ge1xuICAgIG1vZGU6IFwiZm9jdXNcIixcbiAgICBydW5uaW5nOiBmYWxzZSxcbiAgICB0YXNrSWQ6IG51bGwsXG4gICAgZHVyYXRpb25TZWNzOiAxNTAwLFxuICAgIHJlbWFpbmluZ1NlY3M6IDE1MDAsXG4gICAgZGVhZGxpbmU6IG51bGwsXG4gICAgc3RhcnRlZEF0OiBudWxsLFxuICAgIGN5Y2xlOiAwLFxuICAgIGN5Y2xlRGF0ZTogbnVsbCxcbiAgICBjb21wbGV0aW9uU2VyaWFsOiAwLFxuICAgIGxhc3RGaW5pc2hlZE1vZGU6IG51bGwsXG4gICAgYXV0b0ZvY3VzQmxvY2tlZDogZmFsc2UsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVNlc3Npb24ocmF3OiB1bmtub3duKTogU2Vzc2lvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgc291cmNlOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwic291cmNlXCIsXG4gICAgICBcIlx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLFxuICAgICAgKHYpID0+IG9uZU9mKHYsIFwic291cmNlXCIsIFtcInRpbWVyXCIsIFwidGFza0VzdGltYXRlXCJdKSxcbiAgICAgIFwidGltZXJcIixcbiAgICApIGFzIFNlc3Npb25Tb3VyY2UsXG4gICAgdGFza0lkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGFza0lkXCIsXG4gICAgICBcIlx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwidGFza0lkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHRhc2tUaXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGFza1RpdGxlXCIsIFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0TmFtZTogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdE5hbWVcIiwgXCJcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcIiwgYXNTdHIpLFxuICAgIHN0YXJ0ZWRBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhcnRlZEF0XCIsIFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsIGFzSW50KSxcbiAgICBlbmRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJlbmRlZEF0XCIsIFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsIGFzSW50KSxcbiAgICBkdXJhdGlvblNlY3M6IHJlcXVpcmVkRmllbGQocmF3LCBcImR1cmF0aW9uU2Vjc1wiLCBcIlx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLCBhc0ludCksXG4gICAgY29tcGxldGVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb21wbGV0ZWRcIiwgXCJcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcIiwgYXNCb29sKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVNlc3Npb24oczogU2Vzc2lvbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogcy5pZCxcbiAgICBzb3VyY2U6IHMuc291cmNlLFxuICAgIHRhc2tJZDogcy50YXNrSWQsXG4gICAgdGFza1RpdGxlOiBzLnRhc2tUaXRsZSxcbiAgICBwcm9qZWN0TmFtZTogcy5wcm9qZWN0TmFtZSxcbiAgICBzdGFydGVkQXQ6IHMuc3RhcnRlZEF0LFxuICAgIGVuZGVkQXQ6IHMuZW5kZWRBdCxcbiAgICBkdXJhdGlvblNlY3M6IHMuZHVyYXRpb25TZWNzLFxuICAgIGNvbXBsZXRlZDogcy5jb21wbGV0ZWQsXG4gIH07XG59XG5cbi8vIC0tLS0tLS0tLS0gQXBwRGF0YSAtLS0tLS0tLS0tXG5cbmV4cG9ydCBjbGFzcyBBcHBEYXRhIHtcbiAgZWR1Y2F0aW9uOiBFZHVjYXRpb247XG4gIHZlcnNpb246IG51bWJlcjtcbiAgaWRlbnRpdGllczogSWRlbnRpdHlbXTtcbiAgdGFza3M6IFRhc2tbXTtcbiAgYmxvY2tzOiBCbG9ja1tdO1xuICB0ZW1wbGF0ZXM6IFRlbXBsYXRlW107XG4gIHByaW50czogeyB0ZW1wbGF0ZUlkOiBzdHJpbmc7IGRhdGU6IHN0cmluZyB8IG51bGwgfVtdO1xuICBwcm9qZWN0czogUHJvamVjdFtdO1xuICBoYWJpdHM6IEhhYml0W107XG4gIHZpc2lvbnM6IFZpc2lvbltdO1xuICBzZXR0aW5nczogU2V0dGluZ3M7XG4gIHRpbWVyOiBUaW1lcjtcbiAgc2Vzc2lvbnM6IFNlc3Npb25bXTtcbiAgbG9jazogTG9ja1N0YXRlO1xuXG4gIGNvbnN0cnVjdG9yKGluaXQ/OiBQYXJ0aWFsPFBpY2s8QXBwRGF0YSwga2V5b2YgQXBwRGF0YT4+KSB7XG4gICAgdGhpcy5lZHVjYXRpb24gPSBpbml0Py5lZHVjYXRpb24gPz8gbmV3IEVkdWNhdGlvbigpO1xuICAgIHRoaXMudmVyc2lvbiA9IGluaXQ/LnZlcnNpb24gPz8gNDtcbiAgICB0aGlzLmlkZW50aXRpZXMgPSBpbml0Py5pZGVudGl0aWVzID8/IFtdO1xuICAgIHRoaXMudGFza3MgPSBpbml0Py50YXNrcyA/PyBbXTtcbiAgICB0aGlzLmJsb2NrcyA9IGluaXQ/LmJsb2NrcyA/PyBbXTtcbiAgICB0aGlzLnRlbXBsYXRlcyA9IGluaXQ/LnRlbXBsYXRlcyA/PyBbXTtcbiAgICB0aGlzLnByaW50cyA9IGluaXQ/LnByaW50cyA/PyBbXTtcbiAgICB0aGlzLnByb2plY3RzID0gaW5pdD8ucHJvamVjdHMgPz8gW1xuICAgICAgeyBpZDogaWQoKSwgbmFtZTogXCJcdTVERTVcdTRGNUNcIiwgY29sb3I6IFwiI2RmNzU2MVwiLCBhcHBXaGl0ZWxpc3Q6IG51bGwgfSxcbiAgICAgIHsgaWQ6IGlkKCksIG5hbWU6IFwiXHU1QjY2XHU0RTYwXCIsIGNvbG9yOiBcIiM4NDliN2RcIiwgYXBwV2hpdGVsaXN0OiBudWxsIH0sXG4gICAgICB7IGlkOiBpZCgpLCBuYW1lOiBcIlx1NzUxRlx1NkQzQlwiLCBjb2xvcjogXCIjZDVhNTUzXCIsIGFwcFdoaXRlbGlzdDogbnVsbCB9LFxuICAgIF07XG4gICAgdGhpcy5oYWJpdHMgPSBpbml0Py5oYWJpdHMgPz8gW107XG4gICAgdGhpcy52aXNpb25zID0gaW5pdD8udmlzaW9ucyA/PyBbXTtcbiAgICB0aGlzLnNldHRpbmdzID0gaW5pdD8uc2V0dGluZ3MgPz8gZGVmYXVsdFNldHRpbmdzKCk7XG4gICAgdGhpcy50aW1lciA9IGluaXQ/LnRpbWVyID8/IGRlZmF1bHRUaW1lcigpO1xuICAgIHRoaXMuc2Vzc2lvbnMgPSBpbml0Py5zZXNzaW9ucyA/PyBbXTtcbiAgICB0aGlzLmxvY2sgPSBpbml0Py5sb2NrID8/IHtcbiAgICAgIHNjaGVkdWxlczogW10sXG4gICAgICBhY3RpdmU6IG51bGwsXG4gICAgICBzdXBwcmVzc2VkVW50aWw6IDAsXG4gICAgfTtcbiAgfVxuXG4gIHByb3RlY3RlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5sb2NrLmFjdGl2ZSAhPT0gbnVsbCB8fFxuICAgICAgKHRoaXMudGltZXIucnVubmluZyAmJlxuICAgICAgICB0aGlzLnRpbWVyLm1vZGUgPT09IFwiZm9jdXNcIiAmJlxuICAgICAgICB0aGlzLnNldHRpbmdzLnByb3RlY3Rpb24ubW9kZSAhPT0gXCJvZmZcIilcbiAgICApO1xuICB9XG5cbiAgLyoqIFx1NzY3RFx1NTQwRFx1NTM1NVx1NEUxM1x1NkNFOFx1NjVGNlx1NzUxRlx1NjU0OFx1NzY4NFx1NUU5NFx1NzUyOFx1NkUwNVx1NTM1NVx1RkYxQVx1OTg3OVx1NzZFRVx1NEUxM1x1NUM1RVx1NkUwNVx1NTM1NVx1NjZGRlx1NEVFM1x1OTAxQVx1NzUyOFx1NkUwNVx1NTM1NVx1MzAwMiAqL1xuICBlZmZlY3RpdmVXaGl0ZWxpc3QoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHByb2plY3QgPSAoKCkgPT4ge1xuICAgICAgY29uc3QgdGFza0lkID0gdGhpcy50aW1lci50YXNrSWQ7XG4gICAgICBpZiAodGFza0lkID09PSBudWxsKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgY29uc3QgdGFzayA9IHRoaXMudGFza3MuZmluZCgodCkgPT4gdC5pZCA9PT0gdGFza0lkKTtcbiAgICAgIGlmICh0YXNrID09PSB1bmRlZmluZWQgfHwgdGFzay5wcm9qZWN0SWQgPT09IG51bGwpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICByZXR1cm4gdGhpcy5wcm9qZWN0cy5maW5kKChwKSA9PiBwLmlkID09PSB0YXNrLnByb2plY3RJZCk7XG4gICAgfSkoKTtcbiAgICBjb25zdCBsaXN0ID0gcHJvamVjdD8uYXBwV2hpdGVsaXN0O1xuICAgIHJldHVybiBsaXN0ICE9PSBudWxsICYmIGxpc3QgIT09IHVuZGVmaW5lZFxuICAgICAgPyBbLi4ubGlzdF1cbiAgICAgIDogWy4uLnRoaXMuc2V0dGluZ3MucHJvdGVjdGlvbi53aGl0ZWxpc3RdO1xuICB9XG5cbiAgdGFza0lzVm9pZCh0YXNrOiBUYXNrKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRhc2tJc1ZvaWQodGFzayk7XG4gIH1cblxuICBzdHJpY3RQcm90ZWN0ZWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgICh0aGlzLmxvY2suYWN0aXZlICE9PSBudWxsICYmIHRoaXMubG9jay5hY3RpdmUuc3RyaWN0KSB8fFxuICAgICAgKHRoaXMudGltZXIucnVubmluZyAmJlxuICAgICAgICB0aGlzLnRpbWVyLm1vZGUgPT09IFwiZm9jdXNcIiAmJlxuICAgICAgICB0aGlzLnNldHRpbmdzLnByb3RlY3Rpb24ubW9kZSAhPT0gXCJvZmZcIiAmJlxuICAgICAgICB0aGlzLnNldHRpbmdzLnByb3RlY3Rpb24uc3RyaWN0KVxuICAgICk7XG4gIH1cblxuICBkdXJhdGlvbk9mKG1vZGU6IE1vZGUpOiBudW1iZXIge1xuICAgIHJldHVybiBkdXJhdGlvbk9mKHRoaXMsIG1vZGUpO1xuICB9XG5cbiAgdGFza0hhc1JvdW5kc0xlZnQodGFzazogVGFzayk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0YXNrSGFzUm91bmRzTGVmdCh0aGlzLCB0YXNrKTtcbiAgfVxuXG4gIHJlc2V0VG8obW9kZTogTW9kZSk6IHZvaWQge1xuICAgIHJlc2V0VG8odGhpcywgbW9kZSk7XG4gIH1cblxuICBzdGFydChhdDogbnVtYmVyKTogdm9pZCB7XG4gICAgc3RhcnRUaW1lcih0aGlzLCBhdCk7XG4gIH1cblxuICByZWNvcmQoYXQ6IG51bWJlciwgY29tcGxldGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgcmVjb3JkU2Vzc2lvbih0aGlzLCBhdCwgY29tcGxldGVkKTtcbiAgfVxuXG4gIHJlZnJlc2hDeWNsZShhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZGF0ZSA9IGRhdGVBdChhdCk7XG4gICAgaWYgKHRoaXMudGltZXIuY3ljbGVEYXRlID09PSBkYXRlKSByZXR1cm4gZmFsc2U7XG4gICAgdGhpcy50aW1lci5jeWNsZSA9IHRoaXMuc2Vzc2lvbnMuZmlsdGVyKFxuICAgICAgKHMpID0+IHMuY29tcGxldGVkICYmIGRhdGVBdChzLmVuZGVkQXQpID09PSBkYXRlLFxuICAgICkubGVuZ3RoO1xuICAgIHRoaXMudGltZXIuY3ljbGVEYXRlID0gZGF0ZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKiBcdTUwNUNcdTY3M0FcdTU0MEVcdTY3MDBcdTU5MUFcdTYzQThcdThGREJcdTRFMDBcdTRFMkFcdTk2MzZcdTZCQjVcdUZGMUFcdTdFRERcdTRFMERcdTRGMkFcdTkwMjBcdTY1RTBcdTRFQkFcdTUwM0NcdTVCODhcdTc2ODRcdTRFMTNcdTZDRThcdTRGMUFcdThCRERcdTMwMDIgKi9cbiAgdGljayhhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdGVhY2hpbmdDaGFuZ2VkID0gdGhpcy5lZHVjYXRpb24udGljayhhdCk7XG4gICAgY29uc3QgdGVhY2hpbmdUYXNrc0NoYW5nZWQgPSBtYXRlcmlhbGl6ZVRlYWNoaW5nVGFza3ModGhpcywgYXQpO1xuICAgIGNvbnN0IG1hdGVyaWFsaXplZCA9XG4gICAgICBtYXRlcmlhbGl6ZVRlbXBsYXRlcyh0aGlzLCBhdCkgfHwgdGVhY2hpbmdDaGFuZ2VkIHx8IHRlYWNoaW5nVGFza3NDaGFuZ2VkO1xuICAgIGNvbnN0IHJlbWluZGVyc0NoYW5nZWQgPSB0aWNrUmVtaW5kZXJzKHRoaXMsIGF0KTtcbiAgICBjb25zdCBjaGFuZ2VkID0gdGhpcy50aWNrV2l0aExvY2soYXQpIHx8IG1hdGVyaWFsaXplZDtcbiAgICBjb25zdCBjeWNsZUNoYW5nZWQgPSB0aGlzLnJlZnJlc2hDeWNsZShhdCk7XG4gICAgaWYgKFxuICAgICAgY3ljbGVDaGFuZ2VkICYmXG4gICAgICB0aGlzLnRpbWVyLmN5Y2xlID09PSAwICYmXG4gICAgICB0aGlzLnRpbWVyLm1vZGUgIT09IFwiZm9jdXNcIiAmJlxuICAgICAgIXRoaXMudGltZXIucnVubmluZyAmJlxuICAgICAgdGhpcy50aW1lci5zdGFydGVkQXQgPT09IG51bGwgJiZcbiAgICAgIHRoaXMudGltZXIucmVtYWluaW5nU2VjcyA9PT0gdGhpcy50aW1lci5kdXJhdGlvblNlY3NcbiAgICApIHtcbiAgICAgIHRoaXMucmVzZXRUbyhcImZvY3VzXCIpO1xuICAgIH1cbiAgICByZXR1cm4gKFxuICAgICAgc3RhcnREdWVUYXNrKHRoaXMsIGF0KSB8fCByZW1pbmRlcnNDaGFuZ2VkIHx8IGNoYW5nZWQgfHwgY3ljbGVDaGFuZ2VkXG4gICAgKTtcbiAgfVxuXG4gIHRpY2tXaXRoTG9jayhhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgcHJldmlvdXMgPSBKU09OLnN0cmluZ2lmeShzZXJpYWxpemVMb2NrU3RhdGUodGhpcy5sb2NrKSk7XG4gICAgaWYgKHRoaXMubG9jay5hY3RpdmUgIT09IG51bGwgJiYgYXQgPj0gdGhpcy5sb2NrLmFjdGl2ZS5lbmRzQXQpIHtcbiAgICAgIHRoaXMubG9jay5hY3RpdmUgPSBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzY2hlZHVsZWQgPSBzY2hlZHVsZWRBdCh0aGlzLmxvY2ssIGF0KTtcbiAgICBpZiAoc2NoZWR1bGVkICE9PSBudWxsKSB7XG4gICAgICBpZiAodGhpcy5sb2NrLmFjdGl2ZSAhPT0gbnVsbCkge1xuICAgICAgICBzY2hlZHVsZWQuc3RhcnRlZEF0ID0gTWF0aC5taW4oXG4gICAgICAgICAgdGhpcy5sb2NrLmFjdGl2ZS5zdGFydGVkQXQsXG4gICAgICAgICAgc2NoZWR1bGVkLnN0YXJ0ZWRBdCxcbiAgICAgICAgKTtcbiAgICAgICAgc2NoZWR1bGVkLmVuZHNBdCA9IE1hdGgubWF4KHRoaXMubG9jay5hY3RpdmUuZW5kc0F0LCBzY2hlZHVsZWQuZW5kc0F0KTtcbiAgICAgICAgc2NoZWR1bGVkLnN0cmljdCA9IHNjaGVkdWxlZC5zdHJpY3QgfHwgdGhpcy5sb2NrLmFjdGl2ZS5zdHJpY3Q7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2suYWN0aXZlID0gc2NoZWR1bGVkO1xuICAgIH1cbiAgICBjb25zdCBjaGFuZ2VkID0gcHJldmlvdXMgIT09IEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZUxvY2tTdGF0ZSh0aGlzLmxvY2spKTtcbiAgICBpZiAodGhpcy5sb2NrLmFjdGl2ZSAhPT0gbnVsbCkge1xuICAgICAgY29uc3Qgc3RhcnQgPSB0aGlzLmxvY2suYWN0aXZlLnN0YXJ0ZWRBdDtcbiAgICAgIGlmICh0aGlzLnRpbWVyLnJ1bm5pbmcpIHtcbiAgICAgICAgY29uc3Qgc3RvcCA9IE1hdGgubWluKFxuICAgICAgICAgIE1hdGgubWF4KHN0YXJ0LCB0aGlzLnRpbWVyLnN0YXJ0ZWRBdCA/PyBzdGFydCksXG4gICAgICAgICAgYXQsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMudGlja1RpbWVyKHN0b3ApO1xuICAgICAgICB0aGlzLnJlY29yZChzdG9wLCBmYWxzZSk7XG4gICAgICAgIHRoaXMucmVzZXRUbyhcImZvY3VzXCIpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjaGFuZ2VkO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy50aWNrVGltZXIoYXQpIHx8IGNoYW5nZWQ7XG4gIH1cblxuICB0aWNrVGltZXIoYXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy50aW1lci5ydW5uaW5nIHx8IHRpbWVyUmVtYWluaW5nKHRoaXMudGltZXIsIGF0KSA+IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgZW5kID0gdGhpcy50aW1lci5kZWFkbGluZSA/PyBhdDtcbiAgICB0aGlzLmZpbmlzaFRpbWVyKGVuZCwgYXQpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZmluaXNoVGltZXIoZW5kOiBudW1iZXIsIGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBmaW5pc2hlZCA9IHRoaXMudGltZXIubW9kZTtcbiAgICBjb25zdCBjb250aW51YXRpb25CbG9ja2VkID0gdGhpcy50aW1lci5hdXRvRm9jdXNCbG9ja2VkO1xuICAgIGlmIChmaW5pc2hlZCA9PT0gXCJmb2N1c1wiKSB7XG4gICAgICB0aGlzLnJlZnJlc2hDeWNsZShlbmQpO1xuICAgIH1cbiAgICB0aGlzLnJlY29yZChlbmQsIHRydWUpO1xuICAgIGlmIChmaW5pc2hlZCA9PT0gXCJmb2N1c1wiKSB7XG4gICAgICB0aGlzLnRpbWVyLmN5Y2xlID0gTWF0aC5taW4odGhpcy50aW1lci5jeWNsZSArIDEsIDQyOTQ5NjcyOTUpO1xuICAgIH1cbiAgICBjb25zdCBuZXh0OiBNb2RlID1cbiAgICAgIGZpbmlzaGVkID09PSBcImZvY3VzXCJcbiAgICAgICAgPyB0aGlzLnRpbWVyLmN5Y2xlICUgdGhpcy5zZXR0aW5ncy5sb25nQnJlYWtFdmVyeSA9PT0gMFxuICAgICAgICAgID8gXCJsb25nQnJlYWtcIlxuICAgICAgICAgIDogXCJzaG9ydEJyZWFrXCJcbiAgICAgICAgOiBcImZvY3VzXCI7XG4gICAgdGhpcy5yZXNldFRvKG5leHQpO1xuICAgIHRoaXMudGltZXIuY29tcGxldGlvblNlcmlhbCA9IE1hdGgubWluKFxuICAgICAgdGhpcy50aW1lci5jb21wbGV0aW9uU2VyaWFsICsgMSxcbiAgICAgIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLFxuICAgICk7XG4gICAgdGhpcy50aW1lci5sYXN0RmluaXNoZWRNb2RlID0gZmluaXNoZWQ7XG4gICAgY29uc3QgYXV0byA9XG4gICAgICBuZXh0ID09PSBcImZvY3VzXCJcbiAgICAgICAgPyB0aGlzLnNldHRpbmdzLmF1dG9Gb2N1cyAmJlxuICAgICAgICAgICFjb250aW51YXRpb25CbG9ja2VkICYmXG4gICAgICAgICAgKHRoaXMudGltZXIudGFza0lkID09PSBudWxsIHx8XG4gICAgICAgICAgICAoKCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCB0YXNrID0gdGhpcy50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSB0aGlzLnRpbWVyLnRhc2tJZCk7XG4gICAgICAgICAgICAgIHJldHVybiB0YXNrICE9PSB1bmRlZmluZWQgJiYgdGhpcy50YXNrSGFzUm91bmRzTGVmdCh0YXNrKTtcbiAgICAgICAgICAgIH0pKCkpICYmXG4gICAgICAgICAgISh0aGlzLnNldHRpbmdzLmF1dG9TdGFydFRhc2tzICYmIGR1ZUF1dG9UYXNrKHRoaXMpICE9PSBudWxsKVxuICAgICAgICA6IHRoaXMuc2V0dGluZ3MuYXV0b0JyZWFrO1xuICAgIC8vIFx1ODFFQVx1NTJBOFx1N0VFRFx1NjNBNVx1NTNFQVx1NUM1RVx1NEU4RVx1NkQzQlx1Nzc0MFx1NzY4NFx1NUU5NFx1NzUyOFx1RkYwQ1x1NEUwRFx1NUYyNVx1ODg2NVx1NTE3M1x1NjczQS9cdTc3NjFcdTc3MjBcdTc2ODRcdTY1RjZcdTk1RjRcdTMwMDJcbiAgICBpZiAoYXV0byAmJiBhdCAtIGVuZCA8IDUpIHtcbiAgICAgIHRoaXMuc3RhcnQoYXQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBcdTk4ODRcdTY4QzAgKyBcdTYyNjdcdTg4NEMgKyBcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTc1MUZcdTYyMTAgKyBcdTUxNjhcdTkxQ0ZcdTY4MjFcdTlBOENcdTMwMDIgKi9cbiAgYXBwbHkoYWN0aW9uOiBBY3Rpb24sIGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnRpY2soYXQpO1xuICAgIGlmICh0aGlzLnN0cmljdFByb3RlY3RlZCgpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFMjVcdTY4M0NcdTZBMjFcdTVGMEZcdTc1MUZcdTY1NDhcdTRFMkRcdUZGMENcdTRFMERcdTgwRkRcdTYzRDBcdTUyNERcdTdFRDNcdTY3NUZcdTYyMTZcdTRGRUVcdTY1MzlcdUZGMUJcdTUyMzBcdTY1RjZcdTgxRUFcdTUyQThcdTg5RTNcdTk2NjRcIik7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIHRoaXMucHJvdGVjdGVkKCkgJiZcbiAgICAgIGFjdGlvbi50eXBlICE9PSBcImVtZXJnZW5jeVVubG9ja1wiICYmXG4gICAgICBhY3Rpb24udHlwZSAhPT0gXCJjb21wbGV0ZUZvY3VzXCJcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgXCJcdTRFMTNcdTZDRThcdTRGRERcdTYyQTRcdTRFMkRcdUZGMENcdTdFRDNcdTY3NUZcdTUyNERcdTRFMERcdTgwRkRcdTRGRUVcdTY1MzlcdTRFRkJcdTUyQTFcdTYyMTZcdThCQTFcdTY1RjZcdUZGMUJcdTUzRUZcdTYzRDBcdTUyNERcdTVCOENcdTYyMTBcdTc1NkFcdTgzMDRcdTYyMTZcdTdEMjdcdTYwMjVcdTkwMDBcdTUxRkFcIixcbiAgICAgICk7XG4gICAgfVxuICAgIHN3aXRjaCAoYWN0aW9uLnR5cGUpIHtcbiAgICAgIGNhc2UgXCJlZHVjYXRpb25cIjoge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgYWN0aW9uLmNvbW1hbmQub3AgPT09IFwic3RhcnRFeGFtXCIgJiZcbiAgICAgICAgICAoIXRoaXMucmVtaW5kZXJJZGxlKCkgfHxcbiAgICAgICAgICAgIHRoaXMudGltZXIubW9kZSAhPT0gXCJmb2N1c1wiIHx8XG4gICAgICAgICAgICB0aGlzLnRpbWVyLnJlbWFpbmluZ1NlY3MgIT09IHRoaXMudGltZXIuZHVyYXRpb25TZWNzKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCRjdcdTUxNDhcdTdFRDNcdTY3NUZcdTVGNTNcdTUyNERcdThCQTFcdTY1RjZcdTYyMTZcdTk1MDFcdTY3M0FcdUZGMENcdTUxOERcdTVGMDBcdTU5Q0JcdTgwMDNcdThCRDVcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lZHVjYXRpb24uYXBwbHkoYWN0aW9uLmNvbW1hbmQsIGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicHJpbnRJbnN0YW5jZXNcIjpcbiAgICAgICAgcHJpbnRJbnN0YW5jZXModGhpcywgYWN0aW9uLnNoYXBlLCBhY3Rpb24ucHJpbnRpbmcsIGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwic2F2ZVRlbXBsYXRlXCI6IHtcbiAgICAgICAgY29uc3QgaWQgPSBhY3Rpb24udGVtcGxhdGUuaWQ7XG4gICAgICAgIHNhdmVUZW1wbGF0ZSh0aGlzLCBhY3Rpb24udGVtcGxhdGUpO1xuICAgICAgICB0aGlzLnZhbGlkYXRlKCk7XG4gICAgICAgIGlmIChhY3Rpb24ucHJpbnREYXRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcHJpbnRUZW1wbGF0ZSh0aGlzLCBpZCwgYWN0aW9uLnByaW50RGF0ZXMsIGF0KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJkZWxldGVUZW1wbGF0ZVwiOlxuICAgICAgICBkZWxldGVUZW1wbGF0ZSh0aGlzLCBhY3Rpb24uaWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJwcmludFRlbXBsYXRlXCI6XG4gICAgICAgIHByaW50VGVtcGxhdGUodGhpcywgYWN0aW9uLmlkLCBhY3Rpb24uZGF0ZXMsIGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwic3luY1RlbXBsYXRlXCI6XG4gICAgICAgIHN5bmNUZW1wbGF0ZSh0aGlzLCBhY3Rpb24uaWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJzdGFydFJlbWluZGVyXCI6IHtcbiAgICAgICAgaWYgKCF0aGlzLnJlbWluZGVySWRsZSgpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkY3XHU1MTQ4XHU3RUQzXHU2NzVGXHU1RjUzXHU1MjREXHU4QkExXHU2NUY2XCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLnRhc2tzLmZpbmQoXG4gICAgICAgICAgKHgpID0+IHguaWQgPT09IGFjdGlvbi5pZCAmJiAheC5jb21wbGV0ZWQgJiYgeC5yZW1pbmRlclBlbmRpbmcsXG4gICAgICAgICk7XG4gICAgICAgIGlmICh0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTYzRDBcdTkxOTJcdTVERjJcdTU5MzFcdTY1NDhcIik7XG4gICAgICAgIH1cbiAgICAgICAgdC5yZW1pbmRlclBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy50aW1lci50YXNrSWQgPSBhY3Rpb24uaWQ7XG4gICAgICAgIHRoaXMucmVzZXRUbyhcImZvY3VzXCIpO1xuICAgICAgICBzdGFydFRlYWNoaW5nVGFzayh0aGlzLCBhdCk7XG4gICAgICAgIHRoaXMuc3RhcnQoYXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJlbWVyZ2VuY3lVbmxvY2tcIjoge1xuICAgICAgICB0aGlzLnJlY29yZChhdCwgZmFsc2UpO1xuICAgICAgICB0aGlzLnJlc2V0VG8oXCJmb2N1c1wiKTtcbiAgICAgICAgcmVsZWFzZUxvY2sodGhpcy5sb2NrLCBhdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImNvbXBsZXRlRm9jdXNcIjoge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgdGhpcy5sb2NrLmFjdGl2ZSAhPT0gbnVsbCB8fFxuICAgICAgICAgIHRoaXMudGltZXIubW9kZSAhPT0gXCJmb2N1c1wiIHx8XG4gICAgICAgICAgdGhpcy50aW1lci5zdGFydGVkQXQgPT09IG51bGxcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1RjUzXHU1MjREXHU2Q0ExXHU2NzA5XHU1M0VGXHU2M0QwXHU1MjREXHU1QjhDXHU2MjEwXHU3Njg0XHU0RTEzXHU2Q0U4XCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aW1lclJlbWFpbmluZyh0aGlzLnRpbWVyLCBhdCkgPT09IHRoaXMudGltZXIuZHVyYXRpb25TZWNzKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QzFBXHU2NUUwXHU0RTEzXHU2Q0U4XHU3NTI4XHU2NUY2XHVGRjBDXHU4QkY3XHU3QTBEXHU1NDBFXHU1MThEXHU1QjhDXHU2MjEwXCIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZmluaXNoVGltZXIoYXQsIGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZUxvY2tTY2hlZHVsZVwiOiB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sb2NrLnNjaGVkdWxlcy5maW5kSW5kZXgoXG4gICAgICAgICAgKHMpID0+IHMuaWQgPT09IGFjdGlvbi5zY2hlZHVsZS5pZCxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICB0aGlzLmxvY2suc2NoZWR1bGVzW2luZGV4XSA9IGFjdGlvbi5zY2hlZHVsZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmxvY2suc2NoZWR1bGVzLnB1c2goYWN0aW9uLnNjaGVkdWxlKTtcbiAgICAgICAgfVxuICAgICAgICB2YWxpZGF0ZUxvY2sodGhpcy5sb2NrKTtcbiAgICAgICAgdGhpcy50aWNrKGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiZGVsZXRlTG9ja1NjaGVkdWxlXCI6XG4gICAgICAgIHRoaXMubG9jay5zY2hlZHVsZXMgPSB0aGlzLmxvY2suc2NoZWR1bGVzLmZpbHRlcihcbiAgICAgICAgICAocykgPT4gcy5pZCAhPT0gYWN0aW9uLmlkLFxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJzdGFydFF1aWNrTG9ja1wiOiB7XG4gICAgICAgIGlmIChhY3Rpb24ubWludXRlcyA8IDEgfHwgYWN0aW9uLm1pbnV0ZXMgPiA3MjApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTVGRUJcdTkwMUZcdTk1MDFcdTY3M0FcdTY1RjZcdTk1N0ZcdTk3MDBcdTRFM0EgMVx1MjAxMzcyMCBcdTUyMDZcdTk0OUZcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWNvcmQoYXQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5yZXNldFRvKFwiZm9jdXNcIik7XG4gICAgICAgIHRoaXMubG9jay5hY3RpdmUgPSB7XG4gICAgICAgICAgbmFtZTogXCJcdTVDMEZcdTYxQTlcIixcbiAgICAgICAgICBzdGFydGVkQXQ6IGF0LFxuICAgICAgICAgIGVuZHNBdDogYXQgKyBhY3Rpb24ubWludXRlcyAqIDYwLFxuICAgICAgICAgIHN0cmljdDogYWN0aW9uLnN0cmljdCxcbiAgICAgICAgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVRhc2tcIjoge1xuICAgICAgICBjb25zdCBkID0gYWN0aW9uLnRhc2s7XG4gICAgICAgIGlmIChkLmlkICE9PSBudWxsICYmIHRlYWNoaW5nVGFzayh0aGlzLCBkLmlkKSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgICAgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTk2OEZcdThCRkVcdTdBMEJcdTYyMTZcdTRGNUNcdTRFMUFcdTVCODlcdTYzOTJcdTY2RjRcdTY1QjBcdUZGMENcdThCRjdcdThDMDNcdTY1NzRcdTVCRjlcdTVFOTRcdTY1NTlcdTVCNjZcdTVCODlcdTYzOTJcIixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSW5kZXggPVxuICAgICAgICAgIGQuaWQgIT09IG51bGwgPyB0aGlzLnRhc2tzLmZpbmRJbmRleCgodCkgPT4gdC5pZCA9PT0gZC5pZCkgOiAtMTtcbiAgICAgICAgaWYgKGQuaWQgIT09IG51bGwgJiYgZXhpc3RpbmdJbmRleCA8IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFRkJcdTUyQTFcdTRFMERcdTVCNThcdTU3MjhcdUZGMENcdTUzRUZcdTgwRkRcdTVERjJcdTdFQ0ZcdTg4QUJcdTUyMjBcdTk2NjRcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2xkID0gZXhpc3RpbmdJbmRleCA+PSAwID8gdGhpcy50YXNrc1tleGlzdGluZ0luZGV4XSEgOiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHRhc2s6IFRhc2sgPSB7XG4gICAgICAgICAgdGVtcGxhdGVJZDogb2xkPy50ZW1wbGF0ZUlkID8/IG51bGwsXG4gICAgICAgICAgcmVjdXJyaW5nOiBvbGQ/LnJlY3VycmluZyA/PyBmYWxzZSxcbiAgICAgICAgICBpZDogZC5pZCA/PyBpZCgpLFxuICAgICAgICAgIHRpdGxlOiBkLnRpdGxlLnRyaW0oKSxcbiAgICAgICAgICBub3RlczogZC5ub3RlcyxcbiAgICAgICAgICBwcm9qZWN0SWQ6IGQucHJvamVjdElkLFxuICAgICAgICAgIGhhYml0SWQ6IG9sZD8uaGFiaXRJZCA/PyBudWxsLFxuICAgICAgICAgIHJlbWluZGVyRmlyZWQ6XG4gICAgICAgICAgICBvbGQgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgb2xkLmR1ZURhdGUgPT09IGQuZHVlRGF0ZSAmJlxuICAgICAgICAgICAgb2xkLnJlbWluZGVyVGltZSA9PT0gZC5yZW1pbmRlclRpbWUgJiZcbiAgICAgICAgICAgIG9sZC5yZW1pbmRlckZpcmVkLFxuICAgICAgICAgIHJlbWluZGVyUGVuZGluZzpcbiAgICAgICAgICAgIG9sZCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBvbGQuZHVlRGF0ZSA9PT0gZC5kdWVEYXRlICYmXG4gICAgICAgICAgICBvbGQucmVtaW5kZXJUaW1lID09PSBkLnJlbWluZGVyVGltZSAmJlxuICAgICAgICAgICAgb2xkLnJlbWluZGVyUGVuZGluZyxcbiAgICAgICAgICByZW1pbmRlckV4cGlyZWQ6XG4gICAgICAgICAgICBvbGQgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgb2xkLmR1ZURhdGUgPT09IGQuZHVlRGF0ZSAmJlxuICAgICAgICAgICAgb2xkLnJlbWluZGVyVGltZSA9PT0gZC5yZW1pbmRlclRpbWUgJiZcbiAgICAgICAgICAgIG9sZC5yZW1pbmRlckV4cGlyZWQsXG4gICAgICAgICAgc2NyYXBNaW51dGVzOiBkLnNjcmFwTWludXRlcyxcbiAgICAgICAgICBmb2N1c01pbnV0ZXM6IGQuZm9jdXNNaW51dGVzLFxuICAgICAgICAgIHJlbWluZGVyVGltZTogZC5yZW1pbmRlclRpbWUsXG4gICAgICAgICAgZHVlRGF0ZTogZC5kdWVEYXRlLFxuICAgICAgICAgIHByaW9yaXR5OiBkLnByaW9yaXR5LFxuICAgICAgICAgIGVzdGltYXRlOiBkLmVzdGltYXRlLFxuICAgICAgICAgIGNvbXBsZXRlZDogb2xkPy5jb21wbGV0ZWQgPz8gZmFsc2UsXG4gICAgICAgICAgY29tcGxldGVkQXQ6IG9sZD8uY29tcGxldGVkQXQgPz8gbnVsbCxcbiAgICAgICAgICBjcmVhdGVkQXQ6IG9sZD8uY3JlYXRlZEF0ID8/IGF0LFxuICAgICAgICAgIHRhZ3M6IGQudGFncy5tYXAoKHQpID0+IHQudHJpbSgpKS5maWx0ZXIoKHQpID0+IHQubGVuZ3RoID4gMCksXG4gICAgICAgICAgc3VidGFza3M6IGQuc3VidGFza3MubWFwKChzKSA9PiAoe1xuICAgICAgICAgICAgaWQ6IHMuaWQsXG4gICAgICAgICAgICB0aXRsZTogcy50aXRsZSxcbiAgICAgICAgICAgIGRvbmU6IHMuZG9uZSxcbiAgICAgICAgICB9KSksXG4gICAgICAgIH07XG4gICAgICAgIGlmIChkLnJlcGVhdCAhPT0gXCJub25lXCIpIHtcbiAgICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IGZyb21UYXNrKHRhc2ssIGQucmVwZWF0LCBhdCk7XG4gICAgICAgICAgdGFzay50ZW1wbGF0ZUlkID0gdGVtcGxhdGUuaWQ7XG4gICAgICAgICAgdGFzay5yZWN1cnJpbmcgPSB0cnVlO1xuICAgICAgICAgIHRoaXMucHJpbnRzLnB1c2goeyB0ZW1wbGF0ZUlkOiB0ZW1wbGF0ZS5pZCwgZGF0ZTogdGFzay5kdWVEYXRlIH0pO1xuICAgICAgICAgIHRoaXMudGVtcGxhdGVzLnB1c2godGVtcGxhdGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChleGlzdGluZ0luZGV4ID49IDApIHtcbiAgICAgICAgICB0aGlzLnRhc2tzW2V4aXN0aW5nSW5kZXhdID0gdGFzaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnRhc2tzLnB1c2godGFzayk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwidG9nZ2xlVGFza1wiOiB7XG4gICAgICAgIGNvbnN0IHRhc2tJZCA9IGFjdGlvbi5pZDtcbiAgICAgICAgaWYgKHRoaXMudGFza3Muc29tZSgodCkgPT4gdC5pZCA9PT0gdGFza0lkICYmIHRoaXMudGFza0lzVm9pZCh0KSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRGNUNcdTVFOUZcdTVCOUVcdTRGOEJcdTRFMERcdTgwRkRcdTVCOENcdTYyMTBcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFzayA9IHRoaXMudGFza3MuZmluZCgodCkgPT4gdC5pZCA9PT0gdGFza0lkKTtcbiAgICAgICAgZW5zdXJlKHRhc2sgIT09IHVuZGVmaW5lZCwgXCJcdTRFRkJcdTUyQTFcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGNvbnN0IHRhc2tDb3B5OiBUYXNrID0ge1xuICAgICAgICAgIC4uLnRhc2ssXG4gICAgICAgICAgdGFnczogWy4uLnRhc2sudGFnc10sXG4gICAgICAgICAgc3VidGFza3M6IHRhc2suc3VidGFza3MubWFwKChzKSA9PiAoeyAuLi5zIH0pKSxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHRlYWNoaW5nVGFzayh0aGlzLCB0YXNrSWQpICE9PSB1bmRlZmluZWQgJiYgIXRhc2tDb3B5LmNvbXBsZXRlZCkge1xuICAgICAgICAgIGNvbXBsZXRlVGVhY2hpbmdUYXNrKHRoaXMsIHRhc2tJZCwgYXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFx1N0VEM1x1N0I5N1x1NUJGOVx1NkJENFx1NTI0RFx1NTE0OFx1N0VEM1x1NkUwNVx1NjcyQ1x1NEVGQlx1NTJBMVx1OEJBMVx1NjVGNlx1RkYwQ1x1OTA3Rlx1NTE0RFx1OTFDRFx1NTkwRFx1N0QyRlx1OEJBMVx1MzAwMlxuICAgICAgICBpZiAoIXRhc2tDb3B5LmNvbXBsZXRlZCAmJiB0aGlzLnRpbWVyLnRhc2tJZCA9PT0gdGFza0lkKSB7XG4gICAgICAgICAgY29uc3QgZm9jdXNpbmcgPSB0aGlzLnRpbWVyLm1vZGUgPT09IFwiZm9jdXNcIjtcbiAgICAgICAgICBpZiAoZm9jdXNpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkKGF0LCBmYWxzZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMudGltZXIudGFza0lkID0gbnVsbDtcbiAgICAgICAgICBpZiAoZm9jdXNpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucmVzZXRUbyhcImZvY3VzXCIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnRpbWVyLmF1dG9Gb2N1c0Jsb2NrZWQgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNlc3Npb25zID0gdGhpcy5zZXNzaW9ucy5maWx0ZXIoXG4gICAgICAgICAgKHMpID0+ICEocy5zb3VyY2UgPT09IFwidGFza0VzdGltYXRlXCIgJiYgcy50YXNrSWQgPT09IHRhc2tJZCksXG4gICAgICAgICk7XG4gICAgICAgIGlmICghdGFza0NvcHkuY29tcGxldGVkKSB7XG4gICAgICAgICAgY29uc3QgYWN0dWFsID0gdGhpcy5zZXNzaW9uc1xuICAgICAgICAgICAgLmZpbHRlcigocykgPT4gcy50YXNrSWQgPT09IHRhc2tJZClcbiAgICAgICAgICAgIC5yZWR1Y2UoKG4sIHMpID0+IG4gKyBzLmR1cmF0aW9uU2VjcywgMCk7XG4gICAgICAgICAgY29uc3QgZXhwZWN0ZWQgPVxuICAgICAgICAgICAgdGFza0NvcHkuZXN0aW1hdGUgKlxuICAgICAgICAgICAgKHRhc2tDb3B5LmZvY3VzTWludXRlcyA/PyB0aGlzLnNldHRpbmdzLmZvY3VzTWludXRlcykgKlxuICAgICAgICAgICAgNjA7XG4gICAgICAgICAgY29uc3QgbWlzc2luZyA9IE1hdGgubWF4KDAsIGV4cGVjdGVkIC0gYWN0dWFsKTtcbiAgICAgICAgICBpZiAobWlzc2luZyA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3QgPVxuICAgICAgICAgICAgICB0YXNrQ29weS5wcm9qZWN0SWQgIT09IG51bGxcbiAgICAgICAgICAgICAgICA/IHRoaXMucHJvamVjdHMuZmluZCgocCkgPT4gcC5pZCA9PT0gdGFza0NvcHkucHJvamVjdElkKVxuICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgdGhpcy5zZXNzaW9ucy5wdXNoKHtcbiAgICAgICAgICAgICAgaWQ6IGlkKCksXG4gICAgICAgICAgICAgIHNvdXJjZTogXCJ0YXNrRXN0aW1hdGVcIixcbiAgICAgICAgICAgICAgdGFza0lkLFxuICAgICAgICAgICAgICB0YXNrVGl0bGU6IHRhc2tDb3B5LnRpdGxlLFxuICAgICAgICAgICAgICBwcm9qZWN0TmFtZTogcHJvamVjdD8ubmFtZSA/PyBcIlx1NjcyQVx1NTIwNlx1N0M3QlwiLFxuICAgICAgICAgICAgICBzdGFydGVkQXQ6IGF0LFxuICAgICAgICAgICAgICBlbmRlZEF0OiBhdCxcbiAgICAgICAgICAgICAgZHVyYXRpb25TZWNzOiBtaXNzaW5nLFxuICAgICAgICAgICAgICBjb21wbGV0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHQgPSB0aGlzLnRhc2tzLmZpbmQoKHgpID0+IHguaWQgPT09IHRhc2tJZCkhO1xuICAgICAgICB0LmNvbXBsZXRlZCA9ICF0LmNvbXBsZXRlZDtcbiAgICAgICAgdC5jb21wbGV0ZWRBdCA9IHQuY29tcGxldGVkID8gYXQgOiBudWxsO1xuICAgICAgICBpZiAodC5jb21wbGV0ZWQpIHtcbiAgICAgICAgICB0aGlzLmVkdWNhdGlvbi50YXNrQ29tcGxldGVkKHQsIGF0KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJkZWxldGVUYXNrXCI6IHtcbiAgICAgICAgaWYgKHRlYWNoaW5nVGFzayh0aGlzLCBhY3Rpb24uaWQpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTc1MzFcdTVCRjlcdTVFOTRcdThCRkVcdTdBMEJcdTYyMTZcdTRGNUNcdTRFMUFcdTdFRjRcdTYyQTRcdUZGMENcdTRFMERcdTgwRkRcdTUzNTVcdTcyRUNcdTUyMjBcdTk2NjRcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLnRhc2tzLnNvbWUoKHQpID0+IHQuaWQgPT09IGFjdGlvbi5pZCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFRkJcdTUyQTFcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMudGltZXIudGFza0lkID09PSBhY3Rpb24uaWQpIHtcbiAgICAgICAgICB0aGlzLnJlY29yZChhdCwgZmFsc2UpO1xuICAgICAgICAgIHRoaXMucmVzZXRUbyh0aGlzLnRpbWVyLm1vZGUpO1xuICAgICAgICAgIHRoaXMudGltZXIudGFza0lkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRhc2tzID0gdGhpcy50YXNrcy5maWx0ZXIoKHQpID0+IHQuaWQgIT09IGFjdGlvbi5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInJlc3RvcmVUYXNrXCI6IHtcbiAgICAgICAgY29uc3QgdGFzayA9IGFjdGlvbi50YXNrO1xuICAgICAgICBpZiAodGhpcy50YXNrcy5zb21lKCh0KSA9PiB0LmlkID09PSB0YXNrLmlkKSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEVGQlx1NTJBMVx1NURGMlx1N0VDRlx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgdGFzay5wcm9qZWN0SWQgIT09IG51bGwgJiZcbiAgICAgICAgICAhdGhpcy5wcm9qZWN0cy5zb21lKChwKSA9PiBwLmlkID09PSB0YXNrLnByb2plY3RJZClcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGFzay5wcm9qZWN0SWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0YXNrLnRlbXBsYXRlSWQgIT09IG51bGwgJiZcbiAgICAgICAgICAhdGhpcy50ZW1wbGF0ZXMuc29tZSgodCkgPT4gdC5pZCA9PT0gdGFzay50ZW1wbGF0ZUlkKVxuICAgICAgICApIHtcbiAgICAgICAgICB0YXNrLnRlbXBsYXRlSWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0YXNrLmhhYml0SWQgIT09IG51bGwgJiZcbiAgICAgICAgICAhdGhpcy5oYWJpdHMuc29tZSgoaCkgPT4gaC5pZCA9PT0gdGFzay5oYWJpdElkKVxuICAgICAgICApIHtcbiAgICAgICAgICAvLyBcdTU5MzFcdTUzQkJcdTVCQjlcdTU2NjhcdTUzRUFcdTc5RkJcdTk2NjRcdTdCQTFcdThGOTZcdUZGMUJcdTUxQkJcdTdFRDNcdTY3NjVcdTZFOTBcdTRFQ0RcdTU3MjhcdUZGMENcdTUzODZcdTUzRjJcdTUyMDZcdTdDN0JcdTRFMERcdTUzRDhcdTMwMDJcbiAgICAgICAgICB0YXNrLmhhYml0SWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGFza3MucHVzaCh0YXNrKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwidG9nZ2xlU3VidGFza1wiOiB7XG4gICAgICAgIGNvbnN0IHN1YiA9IHRoaXMudGFza3NcbiAgICAgICAgICAuZmluZCgodCkgPT4gdC5pZCA9PT0gYWN0aW9uLnRhc2tJZClcbiAgICAgICAgICA/LnN1YnRhc2tzLmZpbmQoKHMpID0+IHMuaWQgPT09IGFjdGlvbi5zdWJ0YXNrSWQpO1xuICAgICAgICBlbnN1cmUoc3ViICE9PSB1bmRlZmluZWQsIFwiXHU1QjUwXHU0RUZCXHU1MkExXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBzdWIuZG9uZSA9ICFzdWIuZG9uZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVByb2plY3RcIjoge1xuICAgICAgICBpZiAoYWN0aW9uLmlkICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgcCA9IHRoaXMucHJvamVjdHMuZmluZCgoeCkgPT4geC5pZCA9PT0gYWN0aW9uLmlkKTtcbiAgICAgICAgICBlbnN1cmUocCAhPT0gdW5kZWZpbmVkLCBcIlx1OTg3OVx1NzZFRVx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgICBwLm5hbWUgPSBhY3Rpb24ubmFtZS50cmltKCk7XG4gICAgICAgICAgcC5jb2xvciA9IGFjdGlvbi5jb2xvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgICBhY3Rpb24uZGlyZWN0b3J5ICE9PSBudWxsICYmIGlzQWJzb2x1dGVQYXRoKGFjdGlvbi5kaXJlY3RvcnkpLFxuICAgICAgICAgICAgXCJcdTY1QjBcdTk4NzlcdTc2RUVcdTVGQzVcdTk4N0JcdTdFRDFcdTVCOUFcdThENDRcdTY1OTlcdTc2RUVcdTVGNTVcdUZGMUJcdThCRjdcdTU3MjhcdTk4NzlcdTc2RUVcdTk4NzVcdTkwMDlcdTYyRTlcdTc2RUVcdTVGNTVcdTVFNzZcdTYzODhcdTY3NDNcIixcbiAgICAgICAgICApO1xuICAgICAgICAgIGNvbnN0IHByb2plY3RJZCA9IGlkKCk7XG4gICAgICAgICAgdGhpcy5lZHVjYXRpb24ucHJvamVjdHMucHVzaCh7XG4gICAgICAgICAgICBwcm9qZWN0SWQsXG4gICAgICAgICAgICBkaXJlY3Rvcnk6IGFjdGlvbi5kaXJlY3RvcnksXG4gICAgICAgICAgICBleGFtTW9kZTogZmFsc2UsXG4gICAgICAgICAgICB2aXNpb25JZDogbnVsbCxcbiAgICAgICAgICAgIHRhcmdldDogXCJcIixcbiAgICAgICAgICAgIGV4YW1EYXRlOiBudWxsLFxuICAgICAgICAgICAgc3lsbGFidXNJZDogbnVsbCxcbiAgICAgICAgICAgIHBhc3RQYXBlcklkczogW10sXG4gICAgICAgICAgICBtb2NrUGFwZXJJZHM6IFtdLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMucHJvamVjdHMucHVzaCh7XG4gICAgICAgICAgICBpZDogcHJvamVjdElkLFxuICAgICAgICAgICAgbmFtZTogYWN0aW9uLm5hbWUudHJpbSgpLFxuICAgICAgICAgICAgY29sb3I6IGFjdGlvbi5jb2xvcixcbiAgICAgICAgICAgIGFwcFdoaXRlbGlzdDogbnVsbCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJyZW5hbWVQcm9qZWN0RGlyZWN0b3J5XCI6IHtcbiAgICAgICAgY29uc3QgcHJvamVjdCA9IHRoaXMucHJvamVjdHMuZmluZCgoeCkgPT4geC5pZCA9PT0gYWN0aW9uLmlkKTtcbiAgICAgICAgZW5zdXJlKHByb2plY3QgIT09IHVuZGVmaW5lZCwgXCJcdTk4NzlcdTc2RUVcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGNvbnN0IHByb2ZpbGUgPSB0aGlzLmVkdWNhdGlvbi5wcm9qZWN0cy5maW5kKFxuICAgICAgICAgIChwKSA9PiBwLnByb2plY3RJZCA9PT0gYWN0aW9uLmlkLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUocHJvZmlsZSAhPT0gdW5kZWZpbmVkLCBcIlx1OTg3OVx1NzZFRVx1NkNBMVx1NjcwOVx1N0VEMVx1NUI5QVx1OEQ0NFx1NjU5OVx1NzZFRVx1NUY1NVwiKTtcbiAgICAgICAgZW5zdXJlKGlzQWJzb2x1dGVQYXRoKGFjdGlvbi5kaXJlY3RvcnkpLCBcIlx1OEQ0NFx1NjU5OVx1NzZFRVx1NUY1NVx1NUZDNVx1OTg3Qlx1NjYyRlx1N0VERFx1NUJGOVx1OERFRlx1NUY4NFwiKTtcbiAgICAgICAgcHJvamVjdC5uYW1lID0gYWN0aW9uLm5hbWUudHJpbSgpO1xuICAgICAgICBwcm9qZWN0LmNvbG9yID0gYWN0aW9uLmNvbG9yO1xuICAgICAgICBwcm9maWxlLmRpcmVjdG9yeSA9IGFjdGlvbi5kaXJlY3Rvcnk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNldFByb2plY3RXaGl0ZWxpc3RcIjoge1xuICAgICAgICBjb25zdCBwID0gdGhpcy5wcm9qZWN0cy5maW5kKCh4KSA9PiB4LmlkID09PSBhY3Rpb24uaWQpO1xuICAgICAgICBlbnN1cmUocCAhPT0gdW5kZWZpbmVkLCBcIlx1OTg3OVx1NzZFRVx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgcC5hcHBXaGl0ZWxpc3QgPVxuICAgICAgICAgIGFjdGlvbi53aGl0ZWxpc3QgPT09IG51bGwgPyBudWxsIDogWy4uLmFjdGlvbi53aGl0ZWxpc3RdO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJkZWxldGVQcm9qZWN0XCI6IHtcbiAgICAgICAgaWYgKHRoaXMuZWR1Y2F0aW9uLnNlbWVzdGVycy5zb21lKChzKSA9PiBzLnByb2plY3RJZCA9PT0gYWN0aW9uLmlkKSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgICAgIFwiXHU5ODc5XHU3NkVFXHU1REYyXHU2NzA5XHU2NTU5XHU1QjY2XHU1Mzg2XHU1M0YyXHVGRjBDXHU4QkY3XHU0RkREXHU3NTU5XHU4QkIwXHU1RjU1XHU1RTc2XHU1MDVDXHU3NTI4XHU1RTk0XHU4QkQ1XHU2QTIxXHU1RjBGXHVGRjFCXHU4RDQ0XHU2NTk5XHU3NkVFXHU1RjU1XHU0RTBEXHU0RjFBXHU4OEFCXHU1MjIwXHU5NjY0XCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVkdWNhdGlvbi5wcm9qZWN0cyA9IHRoaXMuZWR1Y2F0aW9uLnByb2plY3RzLmZpbHRlcihcbiAgICAgICAgICAocCkgPT4gcC5wcm9qZWN0SWQgIT09IGFjdGlvbi5pZCxcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5lZHVjYXRpb24ucmVzb3VyY2VzID0gdGhpcy5lZHVjYXRpb24ucmVzb3VyY2VzLmZpbHRlcihcbiAgICAgICAgICAocCkgPT4gcC5wcm9qZWN0SWQgIT09IGFjdGlvbi5pZCxcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5wcm9qZWN0cyA9IHRoaXMucHJvamVjdHMuZmlsdGVyKChwKSA9PiBwLmlkICE9PSBhY3Rpb24uaWQpO1xuICAgICAgICBmb3IgKGNvbnN0IHRhc2sgb2YgdGhpcy50YXNrcykge1xuICAgICAgICAgIGlmICh0YXNrLnByb2plY3RJZCA9PT0gYWN0aW9uLmlkKSB0YXNrLnByb2plY3RJZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCB0ZW1wbGF0ZSBvZiB0aGlzLnRlbXBsYXRlcykge1xuICAgICAgICAgIGlmICh0ZW1wbGF0ZS5zaGFwZS5wcm9qZWN0SWQgPT09IGFjdGlvbi5pZClcbiAgICAgICAgICAgIHRlbXBsYXRlLnNoYXBlLnByb2plY3RJZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy52aXNpb25zID0gdGhpcy52aXNpb25zLmZpbHRlcigoYSkgPT4gYS5wcm9qZWN0SWQgIT09IGFjdGlvbi5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInJlb3JkZXJQcm9qZWN0c1wiOiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBhY3Rpb24uaWRzLmxlbmd0aCAhPT0gdGhpcy5wcm9qZWN0cy5sZW5ndGggfHxcbiAgICAgICAgICAhYWN0aW9uLmlkcy5ldmVyeSgocGlkKSA9PiB0aGlzLnByb2plY3RzLnNvbWUoKHApID0+IHAuaWQgPT09IHBpZCkpXG4gICAgICAgICkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTg3OVx1NzZFRVx1NjM5Mlx1NUU4Rlx1NTIxN1x1ODg2OFx1NEUwRVx1NzNCMFx1NjcwOVx1OTg3OVx1NzZFRVx1NEUwRFx1NEUwMFx1ODFGNFwiKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByb2plY3RzID0gYWN0aW9uLmlkcy5tYXAoKHBpZCkgPT5cbiAgICAgICAgICB0aGlzLnByb2plY3RzLmZpbmQoKHApID0+IHAuaWQgPT09IHBpZCkhLFxuICAgICAgICApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJkZXRhY2hUYXNrc1wiOiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBhY3Rpb24uaWRzLnNvbWUoKHRhc2tJZCkgPT4gdGVhY2hpbmdUYXNrKHRoaXMsIHRhc2tJZCkgIT09IHVuZGVmaW5lZClcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHU5ODdCXHU0RkREXHU3NTU5XHU2NzY1XHU2RTkwXHU5ODc5XHU3NkVFXHVGRjBDXHU4QkY3XHU4QzAzXHU2NTc0XHU1QkY5XHU1RTk0XHU2NTU5XHU1QjY2XHU1Qjg5XHU2MzkyXCIpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgdCBvZiB0aGlzLnRhc2tzKSB7XG4gICAgICAgICAgaWYgKGFjdGlvbi5pZHMuaW5jbHVkZXModC5pZCkpIHtcbiAgICAgICAgICAgIGlmIChhY3Rpb24udGFyZ2V0ID09PSBcInByb2plY3RcIikgdC5wcm9qZWN0SWQgPSBudWxsO1xuICAgICAgICAgICAgZWxzZSB0LmhhYml0SWQgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlSGFiaXRHcm91cFwiOiB7XG4gICAgICAgIGlmIChhY3Rpb24uaWQgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBoID0gdGhpcy5oYWJpdHMuZmluZCgoeCkgPT4geC5pZCA9PT0gYWN0aW9uLmlkKTtcbiAgICAgICAgICBlbnN1cmUoaCAhPT0gdW5kZWZpbmVkLCBcIlx1NEU2MFx1NjBFRlx1N0VDNFx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgICBoLm5hbWUgPSBhY3Rpb24ubmFtZS50cmltKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5oYWJpdHMucHVzaCh7IGlkOiBpZCgpLCBuYW1lOiBhY3Rpb24ubmFtZS50cmltKCkgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZUhhYml0XCI6IHtcbiAgICAgICAgY29uc3QgaGlkID0gYWN0aW9uLmlkID8/IGlkKCk7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5oYWJpdHMuZmluZCgoaCkgPT4gaC5pZCA9PT0gaGlkKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBleGlzdGluZy5uYW1lID0gYWN0aW9uLm5hbWUudHJpbSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaGFiaXRzLnB1c2goeyBpZDogaGlkLCBuYW1lOiBhY3Rpb24ubmFtZS50cmltKCkgfSk7XG4gICAgICAgIH1cbiAgICAgICAgc2F2ZVRlbXBsYXRlKHRoaXMsIHtcbiAgICAgICAgICBpZDogYGhhYml0OiR7aGlkfWAsXG4gICAgICAgICAgYXV0b21hdGljOiB0cnVlLFxuICAgICAgICAgIHByaW50QWhlYWREYXlzOiAwLFxuICAgICAgICAgIHByaW50aW5nOiB7XG4gICAgICAgICAgICBraW5kOiBcIndlZWtseVwiLFxuICAgICAgICAgICAgc2xvdHM6IGFjdGlvbi5zbG90cy5tYXAoKHMpID0+ICh7XG4gICAgICAgICAgICAgIGRheXM6IFsuLi5zLmRheXNdLFxuICAgICAgICAgICAgICB0aW1lOiBzLnRpbWUsXG4gICAgICAgICAgICB9KSksXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzaGFwZToge1xuICAgICAgICAgICAgdGl0bGU6IGFjdGlvbi5uYW1lLnRyaW0oKSxcbiAgICAgICAgICAgIG5vdGVzOiBcIlwiLFxuICAgICAgICAgICAgcHJvamVjdElkOiBhY3Rpb24ucHJvamVjdElkLFxuICAgICAgICAgICAgaGFiaXRJZDogaGlkLFxuICAgICAgICAgICAgZm9jdXNNaW51dGVzOiBhY3Rpb24uZm9jdXNNaW51dGVzLFxuICAgICAgICAgICAgc2NyYXBNaW51dGVzOiAwLFxuICAgICAgICAgICAgcHJpb3JpdHk6IDAsXG4gICAgICAgICAgICBlc3RpbWF0ZTogMSxcbiAgICAgICAgICAgIHRhZ3M6IFtdLFxuICAgICAgICAgICAgc3VidGFza3M6IFtdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJkZWxldGVIYWJpdFwiOiB7XG4gICAgICAgIGNvbnN0IHRpZHMgPSB0aGlzLnRlbXBsYXRlc1xuICAgICAgICAgIC5maWx0ZXIoKHQpID0+IHQuc2hhcGUuaGFiaXRJZCA9PT0gYWN0aW9uLmlkKVxuICAgICAgICAgIC5tYXAoKHQpID0+IHQuaWQpO1xuICAgICAgICBmb3IgKGNvbnN0IHRpZCBvZiB0aWRzKSB7XG4gICAgICAgICAgZGVsZXRlVGVtcGxhdGUodGhpcywgdGlkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmhhYml0cyA9IHRoaXMuaGFiaXRzLmZpbHRlcigoaCkgPT4gaC5pZCAhPT0gYWN0aW9uLmlkKTtcbiAgICAgICAgLy8gXHU2NUUyXHU2NzA5XHU1QjlFXHU0RjhCXHU0RkREXHU3NTU5XHU1MUJCXHU3RUQzXHU2NzY1XHU2RTkwXHVGRjFBXHU3OUZCXHU5NjY0XHU1MjA2XHU3RUM0XHU1M0VBXHU2RTA1XHU1RjE1XHU3NTI4XHVGRjBDXHU1Mzg2XHU1M0YyXHU3RjNBXHU1MkU0XHU0RUNEXHU4QkExXHU1MTY1XHU3RURGXHU4QkExXHUzMDAyXG4gICAgICAgIGZvciAoY29uc3QgdGFzayBvZiB0aGlzLnRhc2tzKSB7XG4gICAgICAgICAgaWYgKHRhc2suaGFiaXRJZCA9PT0gYWN0aW9uLmlkKSB0YXNrLmhhYml0SWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNhdmVWaXNpb25cIjoge1xuICAgICAgICBpZiAoYWN0aW9uLmlkICE9PSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgYSA9IHRoaXMudmlzaW9ucy5maW5kKCh4KSA9PiB4LmlkID09PSBhY3Rpb24uaWQpO1xuICAgICAgICAgIGVuc3VyZShhICE9PSB1bmRlZmluZWQsIFwiXHU2MTNGXHU2NjZGXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICAgIGEubmFtZSA9IGFjdGlvbi5uYW1lLnRyaW0oKTtcbiAgICAgICAgICBhLm5vdGVzID0gYWN0aW9uLm5vdGVzO1xuICAgICAgICAgIGEucHJvamVjdElkID0gYWN0aW9uLnByb2plY3RJZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnZpc2lvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogaWQoKSxcbiAgICAgICAgICAgIG5hbWU6IGFjdGlvbi5uYW1lLnRyaW0oKSxcbiAgICAgICAgICAgIG5vdGVzOiBhY3Rpb24ubm90ZXMsXG4gICAgICAgICAgICBwcm9qZWN0SWQ6IGFjdGlvbi5wcm9qZWN0SWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiZGVsZXRlVmlzaW9uXCI6XG4gICAgICAgIHRoaXMudmlzaW9ucyA9IHRoaXMudmlzaW9ucy5maWx0ZXIoKGEpID0+IGEuaWQgIT09IGFjdGlvbi5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInNhdmVCbG9ja1wiOiB7XG4gICAgICAgIGNvbnN0IGJsb2NrOiBCbG9jayA9IHtcbiAgICAgICAgICBpZDogYWN0aW9uLmlkID8/IGlkKCksXG4gICAgICAgICAgdGl0bGU6IGFjdGlvbi50aXRsZS50cmltKCksXG4gICAgICAgICAgZGF5czogWy4uLmFjdGlvbi5kYXlzXSxcbiAgICAgICAgICBzdGFydDogYWN0aW9uLnN0YXJ0LFxuICAgICAgICAgIGVuZDogYWN0aW9uLmVuZCxcbiAgICAgICAgICBhdHRlbnRpb246IGFjdGlvbi5hdHRlbnRpb24sXG4gICAgICAgICAgbm90ZXM6IGFjdGlvbi5ub3RlcyxcbiAgICAgICAgfTtcbiAgICAgICAgLy8gXHU1MTQ4XHU2ODIxXHU5QThDXHVGRjBDXHU1NzRGXHU3RjE2XHU4RjkxXHU2MkE1XHU4MUVBXHU1REYxXHU3Njg0XHU1MzlGXHU1NkUwXHU4MDBDXHU0RTBEXHU2NjJGXHU3QjNDXHU3RURGXHU3Njg0XHU1MTY4XHU5MUNGXHU1OTMxXHU4RDI1XHUzMDAyXG4gICAgICAgIHZhbGlkYXRlQmxvY2soYmxvY2spO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuYmxvY2tzLmZpbmRJbmRleCgoYikgPT4gYi5pZCA9PT0gYmxvY2suaWQpO1xuICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgIHRoaXMuYmxvY2tzW2luZGV4XSA9IGJsb2NrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuYmxvY2tzLnB1c2goYmxvY2spO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImRlbGV0ZUJsb2NrXCI6XG4gICAgICAgIHRoaXMuYmxvY2tzID0gdGhpcy5ibG9ja3MuZmlsdGVyKChiKSA9PiBiLmlkICE9PSBhY3Rpb24uaWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJzZWxlY3RUYXNrXCI6IHtcbiAgICAgICAgaWYgKHRoaXMudGFza3Muc29tZSgodCkgPT4gdC5pZCA9PT0gYWN0aW9uLmlkICYmIHRoaXMudGFza0lzVm9pZCh0KSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRGNUNcdTVFOUZcdTVCOUVcdTRGOEJcdTRFMERcdTgwRkRcdTRFMTNcdTZDRThcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGFjdGlvbi5pZCAhPT0gbnVsbCAmJlxuICAgICAgICAgICF0aGlzLnRhc2tzLnNvbWUoKHQpID0+IHQuaWQgPT09IGFjdGlvbi5pZCAmJiAhdC5jb21wbGV0ZWQpXG4gICAgICAgICkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGN1x1OTAwOVx1NjJFOVx1NEUwMFx1NEUyQVx1NjcyQVx1NUI4Q1x1NjIxMFx1NzY4NFx1NEVGQlx1NTJBMVwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgdGhpcy50aW1lci5ydW5uaW5nIHx8XG4gICAgICAgICAgdGltZXJSZW1haW5pbmcodGhpcy50aW1lciwgYXQpIDwgdGhpcy50aW1lci5kdXJhdGlvblNlY3NcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkY3XHU1MTQ4XHU3RUQzXHU2NzVGXHU1RjUzXHU1MjREXHU4QkExXHU2NUY2XHVGRjBDXHU1MThEXHU1MjA3XHU2MzYyXHU0RTEzXHU2Q0U4XHU0RUZCXHU1MkExXCIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGltZXIudGFza0lkID0gYWN0aW9uLmlkO1xuICAgICAgICB0aGlzLnJlc2V0VG8odGhpcy50aW1lci5tb2RlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic3RhcnRUaW1lclwiOiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0aGlzLnRhc2tzLnNvbWUoXG4gICAgICAgICAgICAodCkgPT4gdC5pZCA9PT0gdGhpcy50aW1lci50YXNrSWQgJiYgdGhpcy50YXNrSXNWb2lkKHQpLFxuICAgICAgICAgIClcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RjVDXHU1RTlGXHU1QjlFXHU0RjhCXHU0RTBEXHU4MEZEXHU1RjAwXHU1OUNCXHU0RTEzXHU2Q0U4XCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG92ZXJyaWRlID1cbiAgICAgICAgICBhY3Rpb24ubWludXRlcyAhPT0gdW5kZWZpbmVkICYmIGFjdGlvbi5taW51dGVzICE9PSBudWxsXG4gICAgICAgICAgICA/IGFjdGlvbi5taW51dGVzXG4gICAgICAgICAgICA6IG51bGw7XG4gICAgICAgIGlmIChvdmVycmlkZSAhPT0gbnVsbCkge1xuICAgICAgICAgIC8vIFx1NTM1NVx1NkIyMVx1NjVGNlx1OTU3Rlx1ODk4Nlx1NzZENlx1RkYxQVx1N0Y1MVx1OTg3NS9cdTY1RTcgcnVudGltZSBcdTUxNDFcdThCQjhcdTRFMzRcdTY1RjZcdTYzMDdcdTVCOUFcdTY3MkNcdThGNkVcdTUyMDZcdTk0OUZcdTY1NzBcdUZGMENcdTRFMERcdTUxOTlcdTU2REVcdTRFRkJcdTUyQTFcdTYyMTZcbiAgICAgICAgICAvLyBcdTUxNjhcdTVDNDBcdThCQkVcdTdGNkVcdUZGMUJcdTUzRUFcdTY3MDlcdTVDMUFcdTY3MkFcdTVGMDBcdTU5Q0JcdTc2ODRcdTRFMTNcdTZDRThcdTZCQjVcdTUzRUZcdTg5ODZcdTc2RDZcdTMwMDJcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB0aGlzLnRpbWVyLm1vZGUgIT09IFwiZm9jdXNcIiB8fFxuICAgICAgICAgICAgdGhpcy50aW1lci5ydW5uaW5nIHx8XG4gICAgICAgICAgICB0aGlzLnRpbWVyLnN0YXJ0ZWRBdCAhPT0gbnVsbFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1M0VBXHU2NzA5XHU1QzFBXHU2NzJBXHU1RjAwXHU1OUNCXHU3Njg0XHU0RTEzXHU2Q0U4XHU1M0VGXHU0RUU1XHU2MzA3XHU1QjlBXHU1MzU1XHU2QjIxXHU2NUY2XHU5NTdGXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIU51bWJlci5pc0ludGVnZXIob3ZlcnJpZGUpIHx8IG92ZXJyaWRlIDwgMSB8fCBvdmVycmlkZSA+IDE4MCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1MzU1XHU2QjIxXHU2NUY2XHU5NTdGXHU5NzAwXHU0RTNBMVx1MjAxNDE4MFx1NTIwNlx1OTQ5RlwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RhcnRUZWFjaGluZ1Rhc2sodGhpcywgYXQpO1xuICAgICAgICB0aGlzLnN0YXJ0KGF0KTtcbiAgICAgICAgaWYgKG92ZXJyaWRlICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gc3RhcnQoKSBcdTRGMUFcdTYzMDlcdTUxNjhcdTVDNDBcdThCQkVcdTdGNkVcdTkxQ0RcdTdCOTdcdTZCQjVcdTk1N0ZcdUZGMENcdTg5ODZcdTc2RDZcdTVGQzVcdTk4N0JcdTY1M0VcdTU3MjhcdTVCODNcdTRFNEJcdTU0MEVcdTMwMDJcbiAgICAgICAgICB0aGlzLnRpbWVyLmR1cmF0aW9uU2VjcyA9IG92ZXJyaWRlICogNjA7XG4gICAgICAgICAgdGhpcy50aW1lci5yZW1haW5pbmdTZWNzID0gb3ZlcnJpZGUgKiA2MDtcbiAgICAgICAgICB0aGlzLnRpbWVyLmRlYWRsaW5lID0gYXQgKyBvdmVycmlkZSAqIDYwO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInBhdXNlVGltZXJcIjoge1xuICAgICAgICB0aGlzLnRpbWVyLnJlbWFpbmluZ1NlY3MgPSB0aW1lclJlbWFpbmluZyh0aGlzLnRpbWVyLCBhdCk7XG4gICAgICAgIHRoaXMudGltZXIucnVubmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnRpbWVyLmRlYWRsaW5lID0gbnVsbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicmVzZXRUaW1lclwiOiB7XG4gICAgICAgIHRoaXMucmVjb3JkKGF0LCBmYWxzZSk7XG4gICAgICAgIHRoaXMucmVzZXRUbyh0aGlzLnRpbWVyLm1vZGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJza2lwVGltZXJcIjoge1xuICAgICAgICB0aGlzLnJlY29yZChhdCwgZmFsc2UpO1xuICAgICAgICBjb25zdCBuZXh0OiBNb2RlID0gdGhpcy50aW1lci5tb2RlID09PSBcImZvY3VzXCIgPyBcInNob3J0QnJlYWtcIiA6IFwiZm9jdXNcIjtcbiAgICAgICAgdGhpcy5yZXNldFRvKG5leHQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzZXRNb2RlXCI6IHtcbiAgICAgICAgaWYgKGFjdGlvbi5tb2RlICE9PSB0aGlzLnRpbWVyLm1vZGUpIHtcbiAgICAgICAgICB0aGlzLnJlY29yZChhdCwgZmFsc2UpO1xuICAgICAgICAgIHRoaXMucmVzZXRUbyhhY3Rpb24ubW9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVNldHRpbmdzXCI6IHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IGFjdGlvbi5zZXR0aW5ncztcbiAgICAgICAgaWYgKFxuICAgICAgICAgICF0aGlzLnRpbWVyLnJ1bm5pbmcgJiZcbiAgICAgICAgICB0aGlzLnRpbWVyLnJlbWFpbmluZ1NlY3MgPT09IHRoaXMudGltZXIuZHVyYXRpb25TZWNzXG4gICAgICAgICkge1xuICAgICAgICAgIHRoaXMucmVzZXRUbyh0aGlzLnRpbWVyLm1vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImltcG9ydFBsYW5cIjpcbiAgICAgICAgbWVyZ2VQbGFuKGFjdGlvbi5wbGFuLCB0aGlzLCBhdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImltcG9ydFwiOiB7XG4gICAgICAgIGFjdGlvbi5kYXRhLnZhbGlkYXRlKCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBjbG9uZShhY3Rpb24uZGF0YSk7XG4gICAgICAgIC8vIFx1NjA2Mlx1NTkwRFx1NjU4N1x1NEVGNlx1NEUwRFx1NUY5N1x1NjA4NFx1NjA4NFx1NkI2Nlx1ODhDNVx1NUI5QVx1NjVGNlx1OTUwMVx1NjczQVx1MzAwMlxuICAgICAgICBkYXRhLmxvY2suYWN0aXZlID0gbnVsbDtcbiAgICAgICAgZGF0YS5sb2NrLnN1cHByZXNzZWRVbnRpbCA9IDA7XG4gICAgICAgIGRhdGEuc2V0dGluZ3MuYXV0b1N0YXJ0VGFza3MgPSBmYWxzZTtcbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiBkYXRhLmxvY2suc2NoZWR1bGVzKSB7XG4gICAgICAgICAgc2NoZWR1bGUuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vIFx1NTkwN1x1NEVGRFx1NjYyRlx1NjU3MFx1NjM2RVx1RkYwQ1x1NEUwRFx1NjYyRlx1NjM4OFx1Njc0M1x1OTFDRFx1NUYwMFx1NjVFN1x1NjVGNlx1OTQ5Rlx1MzAwMlxuICAgICAgICBkYXRhLnRpbWVyLnJlbWFpbmluZ1NlY3MgPSBNYXRoLm1heCgxLCB0aW1lclJlbWFpbmluZyhkYXRhLnRpbWVyLCBhdCkpO1xuICAgICAgICBkYXRhLnRpbWVyLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgZGF0YS50aW1lci5kZWFkbGluZSA9IG51bGw7XG4gICAgICAgIGRhdGEudGltZXIuY29tcGxldGlvblNlcmlhbCA9IHRoaXMudGltZXIuY29tcGxldGlvblNlcmlhbDtcbiAgICAgICAgcmVwbGFjZUFwcERhdGEodGhpcywgZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImxvYWRFeGFtcGxlXCI6IHtcbiAgICAgICAgaWYgKHRoaXMudGFza3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTNFQVx1NjcwOVx1N0E3QVx1NEVGQlx1NTJBMVx1NTIxN1x1ODg2OFx1NTNFRlx1NEVFNVx1OEY3RFx1NTE2NVx1NzkzQVx1NEY4QlwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0b2RheSA9IGRhdGVBdChhdCk7XG4gICAgICAgIGNvbnN0IGV4YW1wbGVzOiBbc3RyaW5nLCBzdHJpbmcsIG51bWJlciwgbnVtYmVyXVtdID0gW1xuICAgICAgICAgIFtcbiAgICAgICAgICAgIFwiXHU2OEIzXHU3NDA2XHU2NzJDXHU1NDY4XHU3Njg0XHU1REU1XHU0RjVDXHU4QkExXHU1MjEyXCIsXG4gICAgICAgICAgICBcIlx1NjI4QVx1NTkyN1x1NzZFRVx1NjgwN1x1NjJDNlx1NjIxMFx1NUMwRlx1NkI2NVx1OUFBNFx1RkYwQ1x1OEJBOVx1NkJDRlx1NEUwMFx1NTkyOVx1OTBGRFx1NjZGNFx1NEVDRVx1NUJCOVx1MzAwMlwiLFxuICAgICAgICAgICAgMyxcbiAgICAgICAgICAgIDIsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBbXG4gICAgICAgICAgICBcIlx1OEJGQlx1NUI4Q1x1NkI2M1x1NTcyOFx1NzcwQlx1NzY4NFx1OTBBM1x1NEUwMFx1N0FFMFwiLFxuICAgICAgICAgICAgXCJcdTUxNzNcdTYzODlcdTZEODhcdTYwNkZcdTYzRDBcdTkxOTJcdUZGMENcdTdFRDlcdTk2MDVcdThCRkJcdTc1NTlcdTRFMDBcdTZCQjVcdTVCOENcdTY1NzRcdTc2ODRcdTY1RjZcdTk1RjRcdTMwMDJcIixcbiAgICAgICAgICAgIDIsXG4gICAgICAgICAgICAxLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgW1wiXHU2NTc0XHU3NDA2XHU2ODRDXHU5NzYyXHVGRjBDXHU2NTc0XHU3NDA2XHU2MDFEXHU3RUVBXCIsIFwiXHU0RTAwXHU0RTJBXHU4MjEyXHU2NzBEXHU3Njg0XHU3M0FGXHU1ODgzXHVGRjBDXHU2NjJGXHU0RTEzXHU2Q0U4XHU3Njg0XHU1RjAwXHU1OUNCXHUzMDAyXCIsIDEsIDFdLFxuICAgICAgICBdO1xuICAgICAgICBleGFtcGxlcy5mb3JFYWNoKChbdGl0bGUsIG5vdGVzLCBwcmlvcml0eSwgZXN0aW1hdGVdLCBpbmRleCkgPT4ge1xuICAgICAgICAgIHRoaXMudGFza3MucHVzaCh7XG4gICAgICAgICAgICBpZDogaWQoKSxcbiAgICAgICAgICAgIHRlbXBsYXRlSWQ6IG51bGwsXG4gICAgICAgICAgICByZWN1cnJpbmc6IGZhbHNlLFxuICAgICAgICAgICAgdGl0bGUsXG4gICAgICAgICAgICBub3RlcyxcbiAgICAgICAgICAgIHByb2plY3RJZDogdGhpcy5wcm9qZWN0c1tpbmRleF0/LmlkID8/IG51bGwsXG4gICAgICAgICAgICBoYWJpdElkOiBudWxsLFxuICAgICAgICAgICAgZHVlRGF0ZTogdG9kYXksXG4gICAgICAgICAgICByZW1pbmRlclRpbWU6IG51bGwsXG4gICAgICAgICAgICBmb2N1c01pbnV0ZXM6IG51bGwsXG4gICAgICAgICAgICByZW1pbmRlckZpcmVkOiBmYWxzZSxcbiAgICAgICAgICAgIHJlbWluZGVyUGVuZGluZzogZmFsc2UsXG4gICAgICAgICAgICByZW1pbmRlckV4cGlyZWQ6IGZhbHNlLFxuICAgICAgICAgICAgc2NyYXBNaW51dGVzOiAwLFxuICAgICAgICAgICAgcHJpb3JpdHksXG4gICAgICAgICAgICBlc3RpbWF0ZSxcbiAgICAgICAgICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgICAgICAgICBjb21wbGV0ZWRBdDogbnVsbCxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogYXQgKyBpbmRleCxcbiAgICAgICAgICAgIHRhZ3M6IFtcIlx1NzkzQVx1NEY4QlwiXSxcbiAgICAgICAgICAgIHN1YnRhc2tzOiBbXSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBtYXRlcmlhbGl6ZVRlYWNoaW5nVGFza3ModGhpcywgYXQpO1xuICAgIHRoaXMudmFsaWRhdGUoKTtcbiAgfVxuXG4gIHZhbGlkYXRlKCk6IHZvaWQge1xuICAgIHRoaXMuZWR1Y2F0aW9uVmFsaWRhdGUoKTtcbiAgICB2YWxpZGF0ZVRlYWNoaW5nVGFza3ModGhpcyk7XG4gICAgdmFsaWRhdGVMb2NrKHRoaXMubG9jayk7XG4gICAgdmFsaWRhdGVUZW1wbGF0ZXModGhpcyk7XG4gICAgdmFsaWRhdGVJZGVudGl0aWVzKHRoaXMpO1xuICAgIHZhbGlkYXRlQmxvY2tzKHRoaXMuYmxvY2tzKTtcbiAgICBlbnN1cmUodGhpcy52ZXJzaW9uID09PSA0LCBcIlx1NEUwRFx1NjUyRlx1NjMwMVx1NkI2NFx1NjU3MFx1NjM2RVx1NzI0OFx1NjcyQ1wiKTtcbiAgICBlbnN1cmUoXG4gICAgICB0aGlzLnRhc2tzLmxlbmd0aCA8PSA1MDAwMCAmJlxuICAgICAgICB0aGlzLnNlc3Npb25zLmxlbmd0aCA8PSAyMDAwMDAgJiZcbiAgICAgICAgdGhpcy5wcm9qZWN0cy5sZW5ndGggPD0gNTAwLFxuICAgICAgXCJcdTY1NzBcdTYzNkVcdThEODVcdTUxRkFcdTY1NzBcdTkxQ0ZcdTk2NTBcdTUyMzZcIixcbiAgICApO1xuICAgIGNvbnN0IHMgPSB0aGlzLnNldHRpbmdzO1xuICAgIGVuc3VyZShzLnNvdW5kVm9sdW1lIDw9IDEwMCwgXCJcdTk3RjNcdTY1NDhcdTk3RjNcdTkxQ0ZcdTk3MDBcdTRFM0EgMFx1MjAxMzEwMFwiKTtcbiAgICBlbnN1cmUoXG4gICAgICBzLmZvY3VzTWludXRlcyA+PSAxICYmXG4gICAgICAgIHMuZm9jdXNNaW51dGVzIDw9IDE4MCAmJlxuICAgICAgICBzLnNob3J0QnJlYWtNaW51dGVzID49IDEgJiZcbiAgICAgICAgcy5zaG9ydEJyZWFrTWludXRlcyA8PSA2MCAmJlxuICAgICAgICBzLmxvbmdCcmVha01pbnV0ZXMgPj0gMSAmJlxuICAgICAgICBzLmxvbmdCcmVha01pbnV0ZXMgPD0gMTIwICYmXG4gICAgICAgIHMubG9uZ0JyZWFrRXZlcnkgPj0gMiAmJlxuICAgICAgICBzLmxvbmdCcmVha0V2ZXJ5IDw9IDEyICYmXG4gICAgICAgIHMuZGFpbHlHb2FsID49IDEgJiZcbiAgICAgICAgcy5kYWlseUdvYWwgPD0gMzAsXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1OEJCRVx1N0Y2RVx1OEQ4NVx1NTFGQVx1NTE0MVx1OEJCOFx1ODMwM1x1NTZGNFwiLFxuICAgICk7XG4gICAgZW5zdXJlKFtcImxpZ2h0XCIsIFwiZGFya1wiLCBcInN5c3RlbVwiXS5pbmNsdWRlcyhzLnRoZW1lKSwgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTRFM0JcdTk4OThcIik7XG4gICAgZW5zdXJlKHZhbGlkQXBwSWRzKHMucHJvdGVjdGlvbi53aGl0ZWxpc3QpLCBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NUU5NFx1NzUyOFx1NzY3RFx1NTQwRFx1NTM1NVwiKTtcbiAgICBjb25zdCBwcm9qZWN0SWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBwIG9mIHRoaXMucHJvamVjdHMpIHtcbiAgICAgIGVuc3VyZShwLmlkLmxlbmd0aCA+IDAgJiYgIXByb2plY3RJZHMuaGFzKHAuaWQpLCBcIlx1OTg3OVx1NzZFRSBJRCBcdTkxQ0RcdTU5MERcdTYyMTZcdTRFM0FcdTdBN0FcIik7XG4gICAgICBwcm9qZWN0SWRzLmFkZChwLmlkKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgcC5uYW1lLnRyaW0oKS5sZW5ndGggPiAwICYmIGNoYXJDb3VudChwLm5hbWUpIDw9IDQwLFxuICAgICAgICBcIlx1OTg3OVx1NzZFRVx1NTQwRFx1NzlGMFx1OTcwMFx1NEUzQSAxXHUyMDEzNDAgXHU0RTJBXHU1QjU3XHU3QjI2XCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICBwLmNvbG9yLmxlbmd0aCA9PT0gNyAmJlxuICAgICAgICAgIHAuY29sb3Iuc3RhcnRzV2l0aChcIiNcIikgJiZcbiAgICAgICAgICAvXlswLTlhLWZBLUZdezZ9JC8udGVzdChwLmNvbG9yLnNsaWNlKDEpKSxcbiAgICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTk4NzlcdTc2RUVcdTk4OUNcdTgyNzJcIixcbiAgICAgICk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHAuYXBwV2hpdGVsaXN0ID09PSBudWxsIHx8IHZhbGlkQXBwSWRzKHAuYXBwV2hpdGVsaXN0KSxcbiAgICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTk4NzlcdTc2RUVcdTVFOTRcdTc1MjhcdTc2N0RcdTU0MERcdTUzNTVcIixcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IGhhYml0SWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZW5zdXJlKHRoaXMuaGFiaXRzLmxlbmd0aCA8PSA1MDAsIFwiXHU0RTYwXHU2MEVGXHU2NTcwXHU5MUNGXHU4RDg1XHU1MUZBXHU5NjUwXHU1MjM2XCIpO1xuICAgIGZvciAoY29uc3QgaCBvZiB0aGlzLmhhYml0cykge1xuICAgICAgZW5zdXJlKGguaWQubGVuZ3RoID4gMCAmJiAhaGFiaXRJZHMuaGFzKGguaWQpLCBcIlx1NEU2MFx1NjBFRiBJRCBcdTkxQ0RcdTU5MERcdTYyMTZcdTRFM0FcdTdBN0FcIik7XG4gICAgICBoYWJpdElkcy5hZGQoaC5pZCk7XG4gICAgICB2YWxpZGF0ZUhhYml0KGgpO1xuICAgIH1cbiAgICBjb25zdCB2aXNpb25JZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBlbnN1cmUodGhpcy52aXNpb25zLmxlbmd0aCA8PSA1MDAsIFwiXHU2MTNGXHU2NjZGXHU2NTcwXHU5MUNGXHU4RDg1XHU1MUZBXHU5NjUwXHU1MjM2XCIpO1xuICAgIGZvciAoY29uc3QgYSBvZiB0aGlzLnZpc2lvbnMpIHtcbiAgICAgIGVuc3VyZShhLmlkLmxlbmd0aCA+IDAgJiYgIXZpc2lvbklkcy5oYXMoYS5pZCksIFwiXHU2MTNGXHU2NjZGIElEIFx1OTFDRFx1NTkwRFx1NjIxNlx1NEUzQVx1N0E3QVwiKTtcbiAgICAgIHZpc2lvbklkcy5hZGQoYS5pZCk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIGEubmFtZS50cmltKCkubGVuZ3RoID4gMCAmJiBjaGFyQ291bnQoYS5uYW1lKSA8PSA0MCxcbiAgICAgICAgXCJcdTYxM0ZcdTY2NkZcdTU0MERcdTc5RjBcdTk3MDBcdTRFM0EgMVx1MjAxMzQwIFx1NEUyQVx1NUI1N1x1N0IyNlwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZSh1dGY4TGVuKGEubm90ZXMpIDw9IDUwMDAwLCBcIlx1NjEzRlx1NjY2Rlx1NTE4NVx1NUJCOVx1OEZDN1x1OTU3RlwiKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgYS5wcm9qZWN0SWQgPT09IG51bGwgfHwgcHJvamVjdElkcy5oYXMoYS5wcm9qZWN0SWQpLFxuICAgICAgICBcIlx1NjEzRlx1NjY2Rlx1NUYxNVx1NzUyOFx1NEU4Nlx1NEUwRFx1NUI1OFx1NTcyOFx1NzY4NFx1OTg3OVx1NzZFRVwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgdGFza0lkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGZvciAoY29uc3QgdCBvZiB0aGlzLnRhc2tzKSB7XG4gICAgICB0aGlzLnZhbGlkYXRlUmVtaW5kZXJUYXNrKHQpO1xuICAgICAgZW5zdXJlKHQuaWQubGVuZ3RoID4gMCAmJiAhdGFza0lkcy5oYXModC5pZCksIFwiXHU0RUZCXHU1MkExIElEIFx1OTFDRFx1NTkwRFx1NjIxNlx1NEUzQVx1N0E3QVwiKTtcbiAgICAgIHRhc2tJZHMuYWRkKHQuaWQpO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LnRpdGxlLnRyaW0oKS5sZW5ndGggPiAwICYmIGNoYXJDb3VudCh0LnRpdGxlKSA8PSAyMDAsXG4gICAgICAgIFwiXHU0RUZCXHU1MkExXHU1NDBEXHU3OUYwXHU5NzAwXHU0RTNBIDFcdTIwMTMyMDAgXHU0RTJBXHU1QjU3XHU3QjI2XCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB1dGY4TGVuKHQubm90ZXMpIDw9IDUwMDAwICYmXG4gICAgICAgICAgdC50YWdzLmxlbmd0aCA8PSAyMCAmJlxuICAgICAgICAgIHQudGFncy5ldmVyeSgodGFnKSA9PiBjaGFyQ291bnQodGFnKSA8PSA0MCksXG4gICAgICAgIFwiXHU1OTA3XHU2Q0U4XHU2MjE2XHU2ODA3XHU3QjdFXHU4RkM3XHU5NTdGXCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LnByaW9yaXR5IDw9IDMgJiYgdC5lc3RpbWF0ZSA+PSAxICYmIHQuZXN0aW1hdGUgPD0gOTksXG4gICAgICAgIFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU0RjE4XHU1MTQ4XHU3RUE3XHU2MjE2XHU5ODg0XHU4QkExXHU3NTZBXHU4MzA0XHU2NTcwXCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKHQuc2NyYXBNaW51dGVzIDw9IDEwMDgwLCBcIlx1OTFDRFx1NEZFRVx1N0E5N1x1NTNFM1x1OEQ4NVx1NTFGQVx1ODMwM1x1NTZGNFwiKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgdC5wcm9qZWN0SWQgPT09IG51bGwgfHwgcHJvamVjdElkcy5oYXModC5wcm9qZWN0SWQpLFxuICAgICAgICBcIlx1NEVGQlx1NTJBMVx1NUYxNVx1NzUyOFx1NEU4Nlx1NEUwRFx1NUI1OFx1NTcyOFx1NzY4NFx1OTg3OVx1NzZFRVwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgdC5oYWJpdElkID09PSBudWxsIHx8IGhhYml0SWRzLmhhcyh0LmhhYml0SWQpLFxuICAgICAgICBcIlx1NEVGQlx1NTJBMVx1NUYxNVx1NzUyOFx1NEU4Nlx1NEUwRFx1NUI1OFx1NTcyOFx1NzY4NFx1NEU2MFx1NjBFRlwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgdC5oYWJpdElkID09PSBudWxsIHx8IHQucmVtaW5kZXJUaW1lICE9PSBudWxsLFxuICAgICAgICBcIlx1NEU2MFx1NjBFRlx1NUI5RVx1NEY4Qlx1OTcwMFx1ODk4MVx1N0NCRVx1Nzg2RVx1NjVGNlx1OTVGNFwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgdC5kdWVEYXRlID09PSBudWxsIHx8ICh0LmR1ZURhdGUubGVuZ3RoID09PSAxMCAmJiB2YWxpZERhdGUodC5kdWVEYXRlKSksXG4gICAgICAgIFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU0RUZCXHU1MkExXHU2NUU1XHU2NzFGXCIsXG4gICAgICApO1xuICAgICAgY29uc3Qgc3VicyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LnN1YnRhc2tzLmxlbmd0aCA8PSAyMDAgJiZcbiAgICAgICAgICB0LnN1YnRhc2tzLmV2ZXJ5KChzdWIpID0+IHtcbiAgICAgICAgICAgIGlmIChzdWIuaWQubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBpZiAoc3Vicy5oYXMoc3ViLmlkKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgc3Vicy5hZGQoc3ViLmlkKTtcbiAgICAgICAgICAgIHJldHVybiBzdWIudGl0bGUudHJpbSgpLmxlbmd0aCA+IDAgJiYgY2hhckNvdW50KHN1Yi50aXRsZSkgPD0gMjAwO1xuICAgICAgICAgIH0pLFxuICAgICAgICBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NUI1MFx1NEVGQlx1NTJBMVwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgdC5jb21wbGV0ZWQgPT09ICh0LmNvbXBsZXRlZEF0ICE9PSBudWxsKSxcbiAgICAgICAgXCJcdTRFRkJcdTUyQTFcdTVCOENcdTYyMTBcdTcyQjZcdTYwMDFcdTRFMEVcdTY1RTVcdTY3MUZcdTRFMERcdTRFMDBcdTgxRjRcIixcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHQgPSB0aGlzLnRpbWVyO1xuICAgIGVuc3VyZShcbiAgICAgIHQuY3ljbGVEYXRlID09PSBudWxsIHx8XG4gICAgICAgICh0LmN5Y2xlRGF0ZS5sZW5ndGggPT09IDEwICYmIHZhbGlkRGF0ZSh0LmN5Y2xlRGF0ZSkpLFxuICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTc1NkFcdTgzMDRcdTU0NjhcdTY3MUZcdTY1RTVcdTY3MUZcIixcbiAgICApO1xuICAgIGVuc3VyZShcbiAgICAgIHQuZHVyYXRpb25TZWNzID49IDEgJiZcbiAgICAgICAgdC5kdXJhdGlvblNlY3MgPD0gMTA4MDAgJiZcbiAgICAgICAgdC5yZW1haW5pbmdTZWNzIDw9IHQuZHVyYXRpb25TZWNzICYmXG4gICAgICAgIHQucnVubmluZyA9PT0gKHQuZGVhZGxpbmUgIT09IG51bGwpLFxuICAgICAgXCJcdThCQTFcdTY1RjZcdTU2NjhcdTY1NzBcdTYzNkVcdTRFMERcdTZCNjNcdTc4NkVcIixcbiAgICApO1xuICAgIGVuc3VyZSh0LnRhc2tJZCA9PT0gbnVsbCB8fCB0YXNrSWRzLmhhcyh0LnRhc2tJZCksIFwiXHU4QkExXHU2NUY2XHU1NjY4XHU0RUZCXHU1MkExXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgIGNvbnN0IHNlc3Npb25JZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBlc3RpbWF0ZWRUYXNrcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGZvciAoY29uc3Qgc2Vzc2lvbiBvZiB0aGlzLnNlc3Npb25zKSB7XG4gICAgICBjb25zdCBtYXhEdXJhdGlvbiA9IHNlc3Npb24uc291cmNlID09PSBcInRpbWVyXCIgPyAxMDgwMCA6IDk5ICogMTgwICogNjA7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHNlc3Npb24uaWQubGVuZ3RoID4gMCAmJlxuICAgICAgICAgICFzZXNzaW9uSWRzLmhhcyhzZXNzaW9uLmlkKSAmJlxuICAgICAgICAgIHNlc3Npb24uZW5kZWRBdCA+PSBzZXNzaW9uLnN0YXJ0ZWRBdCAmJlxuICAgICAgICAgIHNlc3Npb24uZHVyYXRpb25TZWNzID49IDEgJiZcbiAgICAgICAgICBzZXNzaW9uLmR1cmF0aW9uU2VjcyA8PSBtYXhEdXJhdGlvbiAmJlxuICAgICAgICAgIChzZXNzaW9uLnNvdXJjZSAhPT0gXCJ0YXNrRXN0aW1hdGVcIiB8fFxuICAgICAgICAgICAgKCFzZXNzaW9uLmNvbXBsZXRlZCAmJlxuICAgICAgICAgICAgICBzZXNzaW9uLnRhc2tJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgICAgICBzZXNzaW9uLnRhc2tJZC5sZW5ndGggPiAwICYmXG4gICAgICAgICAgICAgICFlc3RpbWF0ZWRUYXNrcy5oYXMoc2Vzc2lvbi50YXNrSWQpICYmXG4gICAgICAgICAgICAgIHNlc3Npb24uc3RhcnRlZEF0ID09PSBzZXNzaW9uLmVuZGVkQXQpKSAmJlxuICAgICAgICAgIGNoYXJDb3VudChzZXNzaW9uLnRhc2tUaXRsZSkgPD0gMjAwICYmXG4gICAgICAgICAgY2hhckNvdW50KHNlc3Npb24ucHJvamVjdE5hbWUpIDw9IDQwLFxuICAgICAgICBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLFxuICAgICAgKTtcbiAgICAgIHNlc3Npb25JZHMuYWRkKHNlc3Npb24uaWQpO1xuICAgICAgaWYgKHNlc3Npb24uc291cmNlID09PSBcInRhc2tFc3RpbWF0ZVwiICYmIHNlc3Npb24udGFza0lkICE9PSBudWxsKSB7XG4gICAgICAgIGVzdGltYXRlZFRhc2tzLmFkZChzZXNzaW9uLnRhc2tJZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RhdHMoYXQ6IG51bWJlcik6IFN0YXRzIHtcbiAgICBjb25zdCB0b2RheSA9IGRhdGVBdChhdCk7XG4gICAgY29uc3QgY3VycmVudCA9IHBhcnNlTG9jYWxEYXRlKHRvZGF5KSE7XG4gICAgY29uc3QgYnlEYXkgPSBuZXcgTWFwPHN0cmluZywgeyBzZWNvbmRzOiBudW1iZXI7IHBvbW9kb3JvczogbnVtYmVyIH0+KCk7XG4gICAgZm9yIChjb25zdCBzZXNzaW9uIG9mIHRoaXMuc2Vzc2lvbnMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gYnlEYXkuZ2V0KGRhdGVBdChzZXNzaW9uLmVuZGVkQXQpKSA/PyB7XG4gICAgICAgIHNlY29uZHM6IDAsXG4gICAgICAgIHBvbW9kb3JvczogMCxcbiAgICAgIH07XG4gICAgICBlbnRyeS5zZWNvbmRzICs9IHNlc3Npb24uZHVyYXRpb25TZWNzO1xuICAgICAgZW50cnkucG9tb2Rvcm9zICs9IHNlc3Npb24uY29tcGxldGVkID8gMSA6IDA7XG4gICAgICBieURheS5zZXQoZGF0ZUF0KHNlc3Npb24uZW5kZWRBdCksIGVudHJ5KTtcbiAgICB9XG4gICAgLy8gXHU0RTAwXHU5MDREXHU5MDREXHU1Mzg2XHU1QjlFXHU0RjhCXHVGRjFBXHU2MzA5XHU1OTI5XHU3RURGXHU4QkExXHU1QjhDXHU2MjEwXHUzMDAxXHU0RjVDXHU1RTlGXHU0RTBFXHU3RjNBXHU1MkU0XHUzMDAyXG4gICAgY29uc3QgY29tcGxldGVkQnlEYXkgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgIGNvbnN0IHZvaWRlZEJ5RGF5ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBjb25zdCBtaXNzZWRCeURheSA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCB0IG9mIHRoaXMudGFza3MpIHtcbiAgICAgIGlmICh0LmNvbXBsZXRlZEF0ICE9PSBudWxsKSB7XG4gICAgICAgIGNvbXBsZXRlZEJ5RGF5LnNldChcbiAgICAgICAgICBkYXRlQXQodC5jb21wbGV0ZWRBdCksXG4gICAgICAgICAgKGNvbXBsZXRlZEJ5RGF5LmdldChkYXRlQXQodC5jb21wbGV0ZWRBdCkpID8/IDApICsgMSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICh0LnJlbWluZGVyRXhwaXJlZCAmJiAhdC5jb21wbGV0ZWQgJiYgdC5kdWVEYXRlICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChraW5kT2YodCkgPT09IFwiaGFiaXRcIikge1xuICAgICAgICAgIG1pc3NlZEJ5RGF5LnNldCh0LmR1ZURhdGUsIChtaXNzZWRCeURheS5nZXQodC5kdWVEYXRlKSA/PyAwKSArIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZvaWRlZEJ5RGF5LnNldCh0LmR1ZURhdGUsICh2b2lkZWRCeURheS5nZXQodC5kdWVEYXRlKSA/PyAwKSArIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGRheXM6IERheVN0YXRbXSA9IFtdO1xuICAgIGZvciAobGV0IG4gPSAyNzsgbiA+PSAwOyBuIC09IDEpIHtcbiAgICAgIGNvbnN0IGRhdGUgPSBmb3JtYXRMb2NhbERhdGUoYWRkRGF5cyhjdXJyZW50LCAtbikpO1xuICAgICAgY29uc3QgZW50cnkgPSBieURheS5nZXQoZGF0ZSkgPz8geyBzZWNvbmRzOiAwLCBwb21vZG9yb3M6IDAgfTtcbiAgICAgIGRheXMucHVzaCh7XG4gICAgICAgIGRhdGUsXG4gICAgICAgIHNlY29uZHM6IGVudHJ5LnNlY29uZHMsXG4gICAgICAgIHBvbW9kb3JvczogZW50cnkucG9tb2Rvcm9zLFxuICAgICAgICBtaXNzZWQ6IG1pc3NlZEJ5RGF5LmdldChkYXRlKSA/PyAwLFxuICAgICAgICBjb21wbGV0ZWQ6IGNvbXBsZXRlZEJ5RGF5LmdldChkYXRlKSA/PyAwLFxuICAgICAgICB2b2lkZWQ6IHZvaWRlZEJ5RGF5LmdldChkYXRlKSA/PyAwLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGZvY3VzZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IHMgb2YgdGhpcy5zZXNzaW9ucykge1xuICAgICAgaWYgKHMuY29tcGxldGVkIHx8IHMuc291cmNlID09PSBcInRhc2tFc3RpbWF0ZVwiKSB7XG4gICAgICAgIGZvY3VzZWQuYWRkKGRhdGVBdChzLmVuZGVkQXQpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGRheSA9IGN1cnJlbnQ7XG4gICAgaWYgKCFmb2N1c2VkLmhhcyh0b2RheSkpIHtcbiAgICAgIGRheSA9IGFkZERheXMoZGF5LCAtMSk7XG4gICAgfVxuICAgIGxldCBzdHJlYWsgPSAwO1xuICAgIHdoaWxlIChmb2N1c2VkLmhhcyhmb3JtYXRMb2NhbERhdGUoZGF5KSkpIHtcbiAgICAgIHN0cmVhayArPSAxO1xuICAgICAgZGF5ID0gYWRkRGF5cyhkYXksIC0xKTtcbiAgICB9XG4gICAgY29uc3QgbGFzdCA9IGRheXNbZGF5cy5sZW5ndGggLSAxXSE7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvZGF5U2Vjb25kczogbGFzdC5zZWNvbmRzLFxuICAgICAgdG9kYXlQb21vZG9yb3M6IGxhc3QucG9tb2Rvcm9zLFxuICAgICAgdG9kYXlDb21wbGV0ZWQ6IHRoaXMudGFza3MuZmlsdGVyKFxuICAgICAgICAodCkgPT4gdC5jb21wbGV0ZWRBdCAhPT0gbnVsbCAmJiBkYXRlQXQodC5jb21wbGV0ZWRBdCkgPT09IHRvZGF5LFxuICAgICAgKS5sZW5ndGgsXG4gICAgICB0b3RhbFNlY29uZHM6IHRoaXMuc2Vzc2lvbnMucmVkdWNlKChuLCBzKSA9PiBuICsgcy5kdXJhdGlvblNlY3MsIDApLFxuICAgICAgdG90YWxQb21vZG9yb3M6IHRoaXMuc2Vzc2lvbnMuZmlsdGVyKChzKSA9PiBzLmNvbXBsZXRlZCkubGVuZ3RoLFxuICAgICAgc3RyZWFrLFxuICAgICAgZGF5cyxcbiAgICB9O1xuICB9XG5cbiAgLy8gLS0tLSByZW1pbmRlcnMgXHU1MzA1XHU4OEM1IC0tLS1cbiAgcmVtaW5kZXJJZGxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiByZW1pbmRlcklkbGUodGhpcyk7XG4gIH1cbiAgcGVuZGluZ1JlbWluZGVyKCk6IFRhc2sgfCBudWxsIHtcbiAgICByZXR1cm4gcGVuZGluZ1JlbWluZGVyKHRoaXMpO1xuICB9XG4gIGR1ZUF1dG9UYXNrKCk6IFRhc2sgfCBudWxsIHtcbiAgICByZXR1cm4gZHVlQXV0b1Rhc2sodGhpcyk7XG4gIH1cblxuICAvLyAtLS0tIHBsYW4gXHU1MzA1XHU4OEM1IC0tLS1cbiAgZXhwb3J0UGxhbigpOiBQbGFuRmlsZSB7XG4gICAgcmV0dXJuIGV4cG9ydFBsYW4odGhpcyk7XG4gIH1cblxuICAvLyAtLS0tIHRlYWNoaW5nIFx1NTMwNVx1ODhDNSAtLS0tXG4gIHRlYWNoaW5nVGFzayh0YXNrSWQ6IHN0cmluZyk6IFJldHVyblR5cGU8dHlwZW9mIHRlYWNoaW5nVGFzaz4ge1xuICAgIHJldHVybiB0ZWFjaGluZ1Rhc2sodGhpcywgdGFza0lkKTtcbiAgfVxuICBjb21wbGV0ZVRlYWNoaW5nVGFzayh0YXNrSWQ6IHN0cmluZywgYXQ6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbXBsZXRlVGVhY2hpbmdUYXNrKHRoaXMsIHRhc2tJZCwgYXQpO1xuICB9XG5cbiAgLy8gLS0tLSBlZHVjYXRpb24gXHU2ODIxXHU5QThDXHU1MzA1XHU4OEM1IC0tLS1cbiAgZWR1Y2F0aW9uVmFsaWRhdGUoKTogdm9pZCB7XG4gICAgdmFsaWRhdGVFZHVjYXRpb25EYXRhKHRoaXMpO1xuICB9XG4gIHZhbGlkYXRlUmVtaW5kZXJUYXNrKHRhc2s6IFRhc2spOiB2b2lkIHtcbiAgICB2YWxpZGF0ZVJlbWluZGVyVGFzayh0YXNrKTtcbiAgfVxufVxuXG5pbXBvcnQgeyB2YWxpZGF0ZVJlbWluZGVyVGFzayB9IGZyb20gXCIuL3JlbWluZGVyc1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVFZHVjYXRpb24gYXMgdmFsaWRhdGVFZHVjYXRpb25EYXRhIH0gZnJvbSBcIi4vZWR1Y2F0aW9uXCI7XG5cbi8vIC0tLS0tLS0tLS0gXHU1MTY4XHU1QzQwXHU1MUZEXHU2NTcwIC0tLS0tLS0tLS1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkQXBwSWRzKGxpc3Q6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgbGlzdC5sZW5ndGggPD0gMTAwICYmXG4gICAgbGlzdC5ldmVyeShcbiAgICAgIChhKSA9PlxuICAgICAgICBhLnRyaW0oKS5sZW5ndGggPiAwICYmXG4gICAgICAgIGNoYXJDb3VudChhKSA8PSAzMjc2OCAmJlxuICAgICAgICAhQXJyYXkuZnJvbShhKS5zb21lKChjKSA9PiBpc0NvbnRyb2xDaGFyKGMpKSxcbiAgICApXG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzQ29udHJvbENoYXIoYzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IGNvZGUgPSBjLmNvZGVQb2ludEF0KDApITtcbiAgcmV0dXJuIGNvZGUgPCAweDIwIHx8IChjb2RlID49IDB4N2YgJiYgY29kZSA8PSAweDlmKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VMb2NhbERhdGUoXG4gIHZhbHVlOiBzdHJpbmcsXG4pOiB7IHllYXI6IG51bWJlcjsgbW9udGg6IG51bWJlcjsgZGF5OiBudW1iZXIgfSB8IG51bGwge1xuICBpZiAoIS9eXFxkezR9LVxcZHsyfS1cXGR7Mn0kLy50ZXN0KHZhbHVlKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHllYXIgPSBOdW1iZXIodmFsdWUuc2xpY2UoMCwgNCkpO1xuICBjb25zdCBtb250aCA9IE51bWJlcih2YWx1ZS5zbGljZSg1LCA3KSk7XG4gIGNvbnN0IGRheSA9IE51bWJlcih2YWx1ZS5zbGljZSg4LCAxMCkpO1xuICBjb25zdCBwcm9iZSA9IG5ldyBEYXRlKERhdGUuVVRDKHllYXIsIG1vbnRoIC0gMSwgZGF5KSk7XG4gIGlmIChcbiAgICBwcm9iZS5nZXRVVENGdWxsWWVhcigpICE9PSB5ZWFyIHx8XG4gICAgcHJvYmUuZ2V0VVRDTW9udGgoKSAhPT0gbW9udGggLSAxIHx8XG4gICAgcHJvYmUuZ2V0VVRDRGF0ZSgpICE9PSBkYXlcbiAgKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIHsgeWVhciwgbW9udGgsIGRheSB9O1xufVxuXG5mdW5jdGlvbiBmb3JtYXRMb2NhbERhdGUoZGF0ZToge1xuICB5ZWFyOiBudW1iZXI7XG4gIG1vbnRoOiBudW1iZXI7XG4gIGRheTogbnVtYmVyO1xufSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtkYXRlLnllYXJ9LSR7U3RyaW5nKGRhdGUubW9udGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZGF0ZS5kYXkpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tVc2VyQWN0aW9uKGFjdGlvbjogQWN0aW9uKTogdm9pZCB7XG4gIGlmIChhY3Rpb24udHlwZSA9PT0gXCJlZHVjYXRpb25cIiAmJiBhc3Npc3RhbnRPbmx5KGFjdGlvbi5jb21tYW5kKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIFwiXHU4QkZFXHU3QTBCXHUzMDAxXHU0RjVDXHU0RTFBXHUzMDAxXHU4QkQ1XHU1Mzc3XHU1NDhDXHU2Mjc5XHU2NTM5XHU3NTMxXHU1QjY2XHU0RTYwXHU1MkE5XHU2MjRCXHU3NTFGXHU2MjEwXHVGRjBDXHU4QkY3XHU1NzI4XHU1QkY5XHU4QkREXHU0RTJEXHU2M0QwXHU1MUZBXHU4OTgxXHU2QzQyXCIsXG4gICAgKTtcbiAgfVxufVxuXG5pbXBvcnQgeyBhc3Npc3RhbnRPbmx5IH0gZnJvbSBcIi4vZWR1Y2F0aW9uXCI7XG5cbi8vIC0tLS0tLS0tLS0gQWN0aW9uIC0tLS0tLS0tLS1cblxuZXhwb3J0IHR5cGUgQWN0aW9uID1cbiAgfCB7IHR5cGU6IFwiZWR1Y2F0aW9uXCI7IGNvbW1hbmQ6IGltcG9ydChcIi4vZWR1Y2F0aW9uXCIpLkNvbW1hbmQgfVxuICB8IHsgdHlwZTogXCJwcmludEluc3RhbmNlc1wiOyBzaGFwZTogU2hhcGU7IHByaW50aW5nOiBQcmludGluZyB9XG4gIHwgeyB0eXBlOiBcInNhdmVUZW1wbGF0ZVwiOyB0ZW1wbGF0ZTogVGVtcGxhdGU7IHByaW50RGF0ZXM6IChzdHJpbmcgfCBudWxsKVtdIH1cbiAgfCB7IHR5cGU6IFwiZGVsZXRlVGVtcGxhdGVcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiBcInByaW50VGVtcGxhdGVcIjsgaWQ6IHN0cmluZzsgZGF0ZXM6IChzdHJpbmcgfCBudWxsKVtdIH1cbiAgfCB7IHR5cGU6IFwic3luY1RlbXBsYXRlXCI7IGlkOiBzdHJpbmcgfVxuICB8IHsgdHlwZTogXCJzdGFydFJlbWluZGVyXCI7IGlkOiBzdHJpbmcgfVxuICB8IHsgdHlwZTogXCJzYXZlVGFza1wiOyB0YXNrOiBUYXNrRHJhZnQgfVxuICB8IHsgdHlwZTogXCJ0b2dnbGVUYXNrXCI7IGlkOiBzdHJpbmcgfVxuICB8IHsgdHlwZTogXCJkZWxldGVUYXNrXCI7IGlkOiBzdHJpbmcgfVxuICB8IHsgdHlwZTogXCJyZXN0b3JlVGFza1wiOyB0YXNrOiBUYXNrIH1cbiAgfCB7IHR5cGU6IFwidG9nZ2xlU3VidGFza1wiOyB0YXNrSWQ6IHN0cmluZzsgc3VidGFza0lkOiBzdHJpbmcgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwic2F2ZVByb2plY3RcIjtcbiAgICAgIGlkOiBzdHJpbmcgfCBudWxsO1xuICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgY29sb3I6IHN0cmluZztcbiAgICAgIGRpcmVjdG9yeTogc3RyaW5nIHwgbnVsbDtcbiAgICB9XG4gIHwge1xuICAgICAgdHlwZTogXCJyZW5hbWVQcm9qZWN0RGlyZWN0b3J5XCI7XG4gICAgICBpZDogc3RyaW5nO1xuICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgY29sb3I6IHN0cmluZztcbiAgICAgIGRpcmVjdG9yeTogc3RyaW5nO1xuICAgIH1cbiAgfCB7IHR5cGU6IFwic2V0UHJvamVjdFdoaXRlbGlzdFwiOyBpZDogc3RyaW5nOyB3aGl0ZWxpc3Q6IHN0cmluZ1tdIHwgbnVsbCB9XG4gIHwgeyB0eXBlOiBcImRlbGV0ZVByb2plY3RcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiBcInJlb3JkZXJQcm9qZWN0c1wiOyBpZHM6IHN0cmluZ1tdIH1cbiAgfCB7IHR5cGU6IFwiZGV0YWNoVGFza3NcIjsgaWRzOiBzdHJpbmdbXTsgdGFyZ2V0OiBEZXRhY2hUYXJnZXQgfVxuICB8IHsgdHlwZTogXCJzYXZlSGFiaXRHcm91cFwiOyBpZDogc3RyaW5nIHwgbnVsbDsgbmFtZTogc3RyaW5nIH1cbiAgfCB7XG4gICAgICB0eXBlOiBcInNhdmVIYWJpdFwiO1xuICAgICAgaWQ6IHN0cmluZyB8IG51bGw7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gICAgICBmb2N1c01pbnV0ZXM6IG51bWJlciB8IG51bGw7XG4gICAgICBzbG90czogSGFiaXRTbG90W107XG4gICAgfVxuICB8IHsgdHlwZTogXCJkZWxldGVIYWJpdFwiOyBpZDogc3RyaW5nIH1cbiAgfCB7XG4gICAgICB0eXBlOiBcInNhdmVWaXNpb25cIjtcbiAgICAgIGlkOiBzdHJpbmcgfCBudWxsO1xuICAgICAgbmFtZTogc3RyaW5nO1xuICAgICAgbm90ZXM6IHN0cmluZztcbiAgICAgIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbDtcbiAgICB9XG4gIHwgeyB0eXBlOiBcImRlbGV0ZVZpc2lvblwiOyBpZDogc3RyaW5nIH1cbiAgfCB7XG4gICAgICB0eXBlOiBcInNhdmVCbG9ja1wiO1xuICAgICAgaWQ6IHN0cmluZyB8IG51bGw7XG4gICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgZGF5czogbnVtYmVyW107XG4gICAgICBzdGFydDogc3RyaW5nO1xuICAgICAgZW5kOiBzdHJpbmc7XG4gICAgICBhdHRlbnRpb246IEF0dGVudGlvbjtcbiAgICAgIG5vdGVzOiBzdHJpbmc7XG4gICAgfVxuICB8IHsgdHlwZTogXCJkZWxldGVCbG9ja1wiOyBpZDogc3RyaW5nIH1cbiAgfCB7IHR5cGU6IFwic2VsZWN0VGFza1wiOyBpZDogc3RyaW5nIHwgbnVsbCB9XG4gIHwgeyB0eXBlOiBcInN0YXJ0VGltZXJcIjsgbWludXRlcz86IG51bWJlciB8IG51bGwgfVxuICB8IHsgdHlwZTogXCJjb21wbGV0ZUZvY3VzXCIgfVxuICB8IHsgdHlwZTogXCJwYXVzZVRpbWVyXCIgfVxuICB8IHsgdHlwZTogXCJyZXNldFRpbWVyXCIgfVxuICB8IHsgdHlwZTogXCJza2lwVGltZXJcIiB9XG4gIHwgeyB0eXBlOiBcInNldE1vZGVcIjsgbW9kZTogTW9kZSB9XG4gIHwgeyB0eXBlOiBcInNhdmVTZXR0aW5nc1wiOyBzZXR0aW5nczogU2V0dGluZ3MgfVxuICB8IHsgdHlwZTogXCJsb2FkRXhhbXBsZVwiIH1cbiAgfCB7IHR5cGU6IFwiaW1wb3J0XCI7IGRhdGE6IEFwcERhdGEgfVxuICB8IHsgdHlwZTogXCJpbXBvcnRQbGFuXCI7IHBsYW46IFBsYW5GaWxlIH1cbiAgfCB7IHR5cGU6IFwiZW1lcmdlbmN5VW5sb2NrXCIgfVxuICB8IHsgdHlwZTogXCJzYXZlTG9ja1NjaGVkdWxlXCI7IHNjaGVkdWxlOiBMb2NrU2NoZWR1bGUgfVxuICB8IHsgdHlwZTogXCJkZWxldGVMb2NrU2NoZWR1bGVcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiBcInN0YXJ0UXVpY2tMb2NrXCI7IG1pbnV0ZXM6IG51bWJlcjsgc3RyaWN0OiBib29sZWFuIH07XG5cbmltcG9ydCB7IHBhcnNlUGxhbkZpbGUgfSBmcm9tIFwiLi9wbGFuXCI7XG5pbXBvcnQgeyBwYXJzZUNvbW1hbmQgfSBmcm9tIFwiLi9lZHVjYXRpb25cIjtcbmltcG9ydCB7IHBhcnNlVGVtcGxhdGUsIHBhcnNlUHJpbnRpbmcsIHBhcnNlU2hhcGUgfSBmcm9tIFwiLi90ZW1wbGF0ZXNcIjtcbmltcG9ydCB7IHBhcnNlTG9ja1NjaGVkdWxlIH0gZnJvbSBcIi4vbG9ja1wiO1xuXG5jb25zdCBBQ1RJT05fS0VZUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBlZHVjYXRpb246IFtcInR5cGVcIiwgXCJjb21tYW5kXCJdLFxuICBwcmludEluc3RhbmNlczogW1widHlwZVwiLCBcInNoYXBlXCIsIFwicHJpbnRpbmdcIl0sXG4gIHNhdmVUZW1wbGF0ZTogW1widHlwZVwiLCBcInRlbXBsYXRlXCIsIFwicHJpbnREYXRlc1wiXSxcbiAgZGVsZXRlVGVtcGxhdGU6IFtcInR5cGVcIiwgXCJpZFwiXSxcbiAgcHJpbnRUZW1wbGF0ZTogW1widHlwZVwiLCBcImlkXCIsIFwiZGF0ZXNcIl0sXG4gIHN5bmNUZW1wbGF0ZTogW1widHlwZVwiLCBcImlkXCJdLFxuICBzdGFydFJlbWluZGVyOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHNhdmVUYXNrOiBbXCJ0eXBlXCIsIFwidGFza1wiXSxcbiAgdG9nZ2xlVGFzazogW1widHlwZVwiLCBcImlkXCJdLFxuICBkZWxldGVUYXNrOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHJlc3RvcmVUYXNrOiBbXCJ0eXBlXCIsIFwidGFza1wiXSxcbiAgdG9nZ2xlU3VidGFzazogW1widHlwZVwiLCBcInRhc2tJZFwiLCBcInN1YnRhc2tJZFwiXSxcbiAgc2F2ZVByb2plY3Q6IFtcInR5cGVcIiwgXCJpZFwiLCBcIm5hbWVcIiwgXCJjb2xvclwiLCBcImRpcmVjdG9yeVwiXSxcbiAgcmVuYW1lUHJvamVjdERpcmVjdG9yeTogW1widHlwZVwiLCBcImlkXCIsIFwibmFtZVwiLCBcImNvbG9yXCIsIFwiZGlyZWN0b3J5XCJdLFxuICBzZXRQcm9qZWN0V2hpdGVsaXN0OiBbXCJ0eXBlXCIsIFwiaWRcIiwgXCJ3aGl0ZWxpc3RcIl0sXG4gIGRlbGV0ZVByb2plY3Q6IFtcInR5cGVcIiwgXCJpZFwiXSxcbiAgcmVvcmRlclByb2plY3RzOiBbXCJ0eXBlXCIsIFwiaWRzXCJdLFxuICBkZXRhY2hUYXNrczogW1widHlwZVwiLCBcImlkc1wiLCBcInRhcmdldFwiXSxcbiAgc2F2ZUhhYml0R3JvdXA6IFtcInR5cGVcIiwgXCJpZFwiLCBcIm5hbWVcIl0sXG4gIHNhdmVIYWJpdDogW1widHlwZVwiLCBcImlkXCIsIFwibmFtZVwiLCBcInByb2plY3RJZFwiLCBcImZvY3VzTWludXRlc1wiLCBcInNsb3RzXCJdLFxuICBkZWxldGVIYWJpdDogW1widHlwZVwiLCBcImlkXCJdLFxuICBzYXZlVmlzaW9uOiBbXCJ0eXBlXCIsIFwiaWRcIiwgXCJuYW1lXCIsIFwibm90ZXNcIiwgXCJwcm9qZWN0SWRcIl0sXG4gIGRlbGV0ZVZpc2lvbjogW1widHlwZVwiLCBcImlkXCJdLFxuICBzYXZlQmxvY2s6IFtcbiAgICBcInR5cGVcIixcbiAgICBcImlkXCIsXG4gICAgXCJ0aXRsZVwiLFxuICAgIFwiZGF5c1wiLFxuICAgIFwic3RhcnRcIixcbiAgICBcImVuZFwiLFxuICAgIFwiYXR0ZW50aW9uXCIsXG4gICAgXCJub3Rlc1wiLFxuICBdLFxuICBkZWxldGVCbG9jazogW1widHlwZVwiLCBcImlkXCJdLFxuICBzZWxlY3RUYXNrOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHN0YXJ0VGltZXI6IFtcInR5cGVcIiwgXCJtaW51dGVzXCJdLFxuICBjb21wbGV0ZUZvY3VzOiBbXCJ0eXBlXCJdLFxuICBwYXVzZVRpbWVyOiBbXCJ0eXBlXCJdLFxuICByZXNldFRpbWVyOiBbXCJ0eXBlXCJdLFxuICBza2lwVGltZXI6IFtcInR5cGVcIl0sXG4gIHNldE1vZGU6IFtcInR5cGVcIiwgXCJtb2RlXCJdLFxuICBzYXZlU2V0dGluZ3M6IFtcInR5cGVcIiwgXCJzZXR0aW5nc1wiXSxcbiAgbG9hZEV4YW1wbGU6IFtcInR5cGVcIl0sXG4gIGltcG9ydDogW1widHlwZVwiLCBcImRhdGFcIl0sXG4gIGltcG9ydFBsYW46IFtcInR5cGVcIiwgXCJwbGFuXCJdLFxuICBlbWVyZ2VuY3lVbmxvY2s6IFtcInR5cGVcIl0sXG4gIHNhdmVMb2NrU2NoZWR1bGU6IFtcInR5cGVcIiwgXCJzY2hlZHVsZVwiXSxcbiAgZGVsZXRlTG9ja1NjaGVkdWxlOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHN0YXJ0UXVpY2tMb2NrOiBbXCJ0eXBlXCIsIFwibWludXRlc1wiLCBcInN0cmljdFwiXSxcbn07XG5cbmNvbnN0IEFDVElPTl9OQU1FUyA9IE9iamVjdC5rZXlzKEFDVElPTl9LRVlTKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQWN0aW9uKHJhdzogdW5rbm93bik6IEFjdGlvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1MkE4XHU0RjVDXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICBjb25zdCB0eXBlID0gb25lT2YoXG4gICAgcmVxdWlyZWRGaWVsZChyYXcsIFwidHlwZVwiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdiksXG4gICAgXCJcdTUyQThcdTRGNUMgdHlwZVwiLFxuICAgIEFDVElPTl9OQU1FUyxcbiAgKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIEFDVElPTl9LRVlTW3R5cGVdISwgXCJcdTUyQThcdTRGNUNcIik7XG4gIGNvbnN0IHN0ciA9IChrZXk6IHN0cmluZyk6IHN0cmluZyA9PiByZXF1aXJlZEZpZWxkKHJhdywga2V5LCBcIlx1NTJBOFx1NEY1Q1wiLCBhc1N0cik7XG4gIGNvbnN0IG9wdFN0ciA9IChrZXk6IHN0cmluZyk6IHN0cmluZyB8IG51bGwgPT5cbiAgICBmaWVsZChyYXcsIGtleSwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IGFzT3B0KHYsIGtleSwgYXNTdHIpLCBudWxsKSBhcyBzdHJpbmcgfCBudWxsO1xuICBjb25zdCBzdHJzID0gKGtleTogc3RyaW5nKTogc3RyaW5nW10gPT5cbiAgICBhc0FycmF5KFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIGtleSwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpLFxuICAgICAga2V5LFxuICAgICkubWFwKCh4KSA9PiBhc1N0cih4LCBrZXkpKTtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcImVkdWNhdGlvblwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgY29tbWFuZDogcGFyc2VDb21tYW5kKHJlcXVpcmVkRmllbGQocmF3LCBcImNvbW1hbmRcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInByaW50SW5zdGFuY2VzXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBzaGFwZTogcGFyc2VTaGFwZShyZXF1aXJlZEZpZWxkKHJhdywgXCJzaGFwZVwiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdikpLFxuICAgICAgICBwcmludGluZzogcGFyc2VQcmludGluZyhcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJwcmludGluZ1wiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlVGVtcGxhdGVcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHRlbXBsYXRlOiBwYXJzZVRlbXBsYXRlKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInRlbXBsYXRlXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgICAgcHJpbnREYXRlczogZmllbGQoXG4gICAgICAgICAgcmF3LFxuICAgICAgICAgIFwicHJpbnREYXRlc1wiLFxuICAgICAgICAgIFwiXHU1MkE4XHU0RjVDXCIsXG4gICAgICAgICAgKHYpID0+XG4gICAgICAgICAgICBhc0FycmF5KHYsIFwicHJpbnREYXRlc1wiKS5tYXAoKGQpID0+XG4gICAgICAgICAgICAgIGQgPT09IG51bGwgPyBudWxsIDogYXNTdHIoZCwgXCJwcmludERhdGVzXCIpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICBbXSxcbiAgICAgICAgKSBhcyAoc3RyaW5nIHwgbnVsbClbXSxcbiAgICAgIH07XG4gICAgY2FzZSBcImRlbGV0ZVRlbXBsYXRlXCI6XG4gICAgY2FzZSBcInN5bmNUZW1wbGF0ZVwiOlxuICAgIGNhc2UgXCJzdGFydFJlbWluZGVyXCI6XG4gICAgY2FzZSBcInRvZ2dsZVRhc2tcIjpcbiAgICBjYXNlIFwiZGVsZXRlVGFza1wiOlxuICAgIGNhc2UgXCJkZWxldGVQcm9qZWN0XCI6XG4gICAgY2FzZSBcImRlbGV0ZUhhYml0XCI6XG4gICAgY2FzZSBcImRlbGV0ZVZpc2lvblwiOlxuICAgIGNhc2UgXCJkZWxldGVCbG9ja1wiOlxuICAgIGNhc2UgXCJkZWxldGVMb2NrU2NoZWR1bGVcIjpcbiAgICAgIHJldHVybiB7IHR5cGUsIGlkOiBzdHIoXCJpZFwiKSB9O1xuICAgIGNhc2UgXCJwcmludFRlbXBsYXRlXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBpZDogc3RyKFwiaWRcIiksXG4gICAgICAgIGRhdGVzOiBhc0FycmF5KFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImRhdGVzXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgICBcImRhdGVzXCIsXG4gICAgICAgICkubWFwKChkKSA9PiAoZCA9PT0gbnVsbCA/IG51bGwgOiBhc1N0cihkLCBcImRhdGVzXCIpKSkgYXMgKFxuICAgICAgICAgIHN0cmluZyB8IG51bGxcbiAgICAgICAgKVtdLFxuICAgICAgfTtcbiAgICBjYXNlIFwic2F2ZVRhc2tcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHRhc2s6IHBhcnNlVGFza0RyYWZ0KHJlcXVpcmVkRmllbGQocmF3LCBcInRhc2tcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInJlc3RvcmVUYXNrXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICB0YXNrOiBwYXJzZVRhc2socmVxdWlyZWRGaWVsZChyYXcsIFwidGFza1wiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdikpLFxuICAgICAgfTtcbiAgICBjYXNlIFwidG9nZ2xlU3VidGFza1wiOlxuICAgICAgcmV0dXJuIHsgdHlwZSwgdGFza0lkOiBzdHIoXCJ0YXNrSWRcIiksIHN1YnRhc2tJZDogc3RyKFwic3VidGFza0lkXCIpIH07XG4gICAgY2FzZSBcInNhdmVQcm9qZWN0XCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBpZDogb3B0U3RyKFwiaWRcIiksXG4gICAgICAgIG5hbWU6IHN0cihcIm5hbWVcIiksXG4gICAgICAgIGNvbG9yOiBzdHIoXCJjb2xvclwiKSxcbiAgICAgICAgZGlyZWN0b3J5OiBvcHRTdHIoXCJkaXJlY3RvcnlcIiksXG4gICAgICB9O1xuICAgIGNhc2UgXCJyZW5hbWVQcm9qZWN0RGlyZWN0b3J5XCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBpZDogc3RyKFwiaWRcIiksXG4gICAgICAgIG5hbWU6IHN0cihcIm5hbWVcIiksXG4gICAgICAgIGNvbG9yOiBzdHIoXCJjb2xvclwiKSxcbiAgICAgICAgZGlyZWN0b3J5OiBzdHIoXCJkaXJlY3RvcnlcIiksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzZXRQcm9qZWN0V2hpdGVsaXN0XCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBpZDogc3RyKFwiaWRcIiksXG4gICAgICAgIHdoaXRlbGlzdDogZmllbGQoXG4gICAgICAgICAgcmF3LFxuICAgICAgICAgIFwid2hpdGVsaXN0XCIsXG4gICAgICAgICAgXCJcdTUyQThcdTRGNUNcIixcbiAgICAgICAgICAodikgPT5cbiAgICAgICAgICAgIGFzT3B0KHYsIFwid2hpdGVsaXN0XCIsICh4KSA9PlxuICAgICAgICAgICAgICBhc0FycmF5KHgsIFwid2hpdGVsaXN0XCIpLm1hcCgoYSkgPT4gYXNTdHIoYSwgXCJ3aGl0ZWxpc3RcIikpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICBudWxsLFxuICAgICAgICApIGFzIHN0cmluZ1tdIHwgbnVsbCxcbiAgICAgIH07XG4gICAgY2FzZSBcInJlb3JkZXJQcm9qZWN0c1wiOlxuICAgICAgcmV0dXJuIHsgdHlwZSwgaWRzOiBzdHJzKFwiaWRzXCIpIH07XG4gICAgY2FzZSBcImRldGFjaFRhc2tzXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBpZHM6IHN0cnMoXCJpZHNcIiksXG4gICAgICAgIHRhcmdldDogb25lT2YoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwidGFyZ2V0XCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgICBcImRldGFjaCB0YXJnZXRcIixcbiAgICAgICAgICBbXCJwcm9qZWN0XCIsIFwiaGFiaXRcIl0sXG4gICAgICAgICkgYXMgRGV0YWNoVGFyZ2V0LFxuICAgICAgfTtcbiAgICBjYXNlIFwic2F2ZUhhYml0R3JvdXBcIjpcbiAgICAgIHJldHVybiB7IHR5cGUsIGlkOiBvcHRTdHIoXCJpZFwiKSwgbmFtZTogc3RyKFwibmFtZVwiKSB9O1xuICAgIGNhc2UgXCJzYXZlSGFiaXRcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkOiBvcHRTdHIoXCJpZFwiKSxcbiAgICAgICAgbmFtZTogc3RyKFwibmFtZVwiKSxcbiAgICAgICAgcHJvamVjdElkOiBvcHRTdHIoXCJwcm9qZWN0SWRcIiksXG4gICAgICAgIGZvY3VzTWludXRlczogZmllbGQoXG4gICAgICAgICAgcmF3LFxuICAgICAgICAgIFwiZm9jdXNNaW51dGVzXCIsXG4gICAgICAgICAgXCJcdTUyQThcdTRGNUNcIixcbiAgICAgICAgICAodikgPT4gYXNPcHQodiwgXCJmb2N1c01pbnV0ZXNcIiwgKHgpID0+IGFzSW50KHgsIFwiZm9jdXNNaW51dGVzXCIpKSxcbiAgICAgICAgICBudWxsLFxuICAgICAgICApIGFzIG51bWJlciB8IG51bGwsXG4gICAgICAgIHNsb3RzOiBhc0FycmF5KFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNsb3RzXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgICBcInNsb3RzXCIsXG4gICAgICAgICkubWFwKHBhcnNlSGFiaXRTbG90KSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNhdmVWaXNpb25cIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkOiBvcHRTdHIoXCJpZFwiKSxcbiAgICAgICAgbmFtZTogc3RyKFwibmFtZVwiKSxcbiAgICAgICAgbm90ZXM6IGZpZWxkKHJhdywgXCJub3Rlc1wiLCBcIlx1NTJBOFx1NEY1Q1wiLCBhc1N0ciwgXCJcIiksXG4gICAgICAgIHByb2plY3RJZDogb3B0U3RyKFwicHJvamVjdElkXCIpLFxuICAgICAgfTtcbiAgICBjYXNlIFwic2F2ZUJsb2NrXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBpZDogb3B0U3RyKFwiaWRcIiksXG4gICAgICAgIHRpdGxlOiBzdHIoXCJ0aXRsZVwiKSxcbiAgICAgICAgZGF5czogYXNBcnJheShcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJkYXlzXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgICBcImRheXNcIixcbiAgICAgICAgKS5tYXAoKGQpID0+IGFzSW50KGQsIFwiZGF5c1wiKSksXG4gICAgICAgIHN0YXJ0OiBzdHIoXCJzdGFydFwiKSxcbiAgICAgICAgZW5kOiBzdHIoXCJlbmRcIiksXG4gICAgICAgIGF0dGVudGlvbjogZmllbGQoXG4gICAgICAgICAgcmF3LFxuICAgICAgICAgIFwiYXR0ZW50aW9uXCIsXG4gICAgICAgICAgXCJcdTUyQThcdTRGNUNcIixcbiAgICAgICAgICAodikgPT4gb25lT2YodiwgXCJhdHRlbnRpb25cIiwgW1wicmVxdWlyZWRcIiwgXCJsaWdodFwiXSksXG4gICAgICAgICAgXCJyZXF1aXJlZFwiLFxuICAgICAgICApIGFzIEF0dGVudGlvbixcbiAgICAgICAgbm90ZXM6IGZpZWxkKHJhdywgXCJub3Rlc1wiLCBcIlx1NTJBOFx1NEY1Q1wiLCBhc1N0ciwgXCJcIiksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzZWxlY3RUYXNrXCI6XG4gICAgICByZXR1cm4geyB0eXBlLCBpZDogb3B0U3RyKFwiaWRcIikgfTtcbiAgICBjYXNlIFwic3RhcnRUaW1lclwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgbWludXRlczogZmllbGQoXG4gICAgICAgICAgcmF3LFxuICAgICAgICAgIFwibWludXRlc1wiLFxuICAgICAgICAgIFwiXHU1MkE4XHU0RjVDXCIsXG4gICAgICAgICAgKHYpID0+IGFzT3B0KHYsIFwibWludXRlc1wiLCAoeCkgPT4gYXNJbnQoeCwgXCJtaW51dGVzXCIpKSxcbiAgICAgICAgICBudWxsLFxuICAgICAgICApIGFzIG51bWJlciB8IG51bGwsXG4gICAgICB9O1xuICAgIGNhc2UgXCJjb21wbGV0ZUZvY3VzXCI6XG4gICAgY2FzZSBcInBhdXNlVGltZXJcIjpcbiAgICBjYXNlIFwicmVzZXRUaW1lclwiOlxuICAgIGNhc2UgXCJza2lwVGltZXJcIjpcbiAgICBjYXNlIFwibG9hZEV4YW1wbGVcIjpcbiAgICBjYXNlIFwiZW1lcmdlbmN5VW5sb2NrXCI6XG4gICAgICByZXR1cm4geyB0eXBlIH07XG4gICAgY2FzZSBcInNldE1vZGVcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIG1vZGU6IG9uZU9mKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcIm1vZGVcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwibW9kZVwiLFxuICAgICAgICAgIFtcImZvY3VzXCIsIFwic2hvcnRCcmVha1wiLCBcImxvbmdCcmVha1wiXSxcbiAgICAgICAgKSBhcyBNb2RlLFxuICAgICAgfTtcbiAgICBjYXNlIFwic2F2ZVNldHRpbmdzXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBzZXR0aW5nczogcGFyc2VTZXR0aW5ncyhcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJzZXR0aW5nc1wiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJpbXBvcnRcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGRhdGE6IHBhcnNlQXBwRGF0YShyZXF1aXJlZEZpZWxkKHJhdywgXCJkYXRhXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSksXG4gICAgICB9O1xuICAgIGNhc2UgXCJpbXBvcnRQbGFuXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBwbGFuOiBwYXJzZVBsYW5GaWxlKHJlcXVpcmVkRmllbGQocmF3LCBcInBsYW5cIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNhdmVMb2NrU2NoZWR1bGVcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHNjaGVkdWxlOiBwYXJzZUxvY2tTY2hlZHVsZShcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJzY2hlZHVsZVwiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzdGFydFF1aWNrTG9ja1wiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgbWludXRlczogcmVxdWlyZWRGaWVsZChyYXcsIFwibWludXRlc1wiLCBcIlx1NTJBOFx1NEY1Q1wiLCBhc0ludCksXG4gICAgICAgIHN0cmljdDogcmVxdWlyZWRGaWVsZChyYXcsIFwic3RyaWN0XCIsIFwiXHU1MkE4XHU0RjVDXCIsIGFzQm9vbCksXG4gICAgICB9O1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoYFx1NTJBOFx1NEY1QyB0eXBlIFx1NTNENlx1NTAzQ1x1NjVFMFx1NjU0OFx1RkYxQSR7dHlwZX1gKTtcbiAgfVxufVxuXG4vLyAtLS0tLS0tLS0tIEFwcERhdGEgXHU4OUUzXHU2NzkwL1x1NUU4Rlx1NTIxN1x1NTMxNiAtLS0tLS0tLS0tXG5cbmNvbnN0IEFQUF9EQVRBX0tFWVMgPSBbXG4gIFwiZWR1Y2F0aW9uXCIsXG4gIFwidmVyc2lvblwiLFxuICBcImlkZW50aXRpZXNcIixcbiAgXCJ0YXNrc1wiLFxuICBcImJsb2Nrc1wiLFxuICBcInRlbXBsYXRlc1wiLFxuICBcInByaW50c1wiLFxuICBcInByb2plY3RzXCIsXG4gIFwiaGFiaXRzXCIsXG4gIFwidmlzaW9uc1wiLFxuICBcInNldHRpbmdzXCIsXG4gIFwidGltZXJcIixcbiAgXCJzZXNzaW9uc1wiLFxuICBcImxvY2tcIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFwcERhdGEocmF3OiB1bmtub3duKTogQXBwRGF0YSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NTcwXHU2MzZFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICAvLyBcdTRFMEUgUnVzdCAjW3NlcmRlKGRlbnlfdW5rbm93bl9maWVsZHMpXSBcdTVCRjlcdTlGNTBcdUZGMUFcdTk4NzZcdTVDNDJcdTY3MkFcdTc3RTVcdTVCNTdcdTZCQjVcdTc2RjRcdTYzQTVcdTYyRDJcdTdFRERcdUZGMDhcdTRFMERcdTUxN0NcdTVCQjlcdTY1RTdcdTUzNEZcdThCQUVcdUZGMDlcdTMwMDJcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1xuICAgICAgXCJlZHVjYXRpb25cIixcbiAgICAgIFwidmVyc2lvblwiLFxuICAgICAgXCJpZGVudGl0aWVzXCIsXG4gICAgICBcInRhc2tzXCIsXG4gICAgICBcImJsb2Nrc1wiLFxuICAgICAgXCJ0ZW1wbGF0ZXNcIixcbiAgICAgIFwicHJpbnRzXCIsXG4gICAgICBcInByb2plY3RzXCIsXG4gICAgICBcImhhYml0c1wiLFxuICAgICAgXCJ2aXNpb25zXCIsXG4gICAgICBcInNldHRpbmdzXCIsXG4gICAgICBcInRpbWVyXCIsXG4gICAgICBcInNlc3Npb25zXCIsXG4gICAgICBcImxvY2tcIixcbiAgICBdLFxuICAgIFwiXHU2NTcwXHU2MzZFXCIsXG4gICk7XG4gIHJldHVybiBuZXcgQXBwRGF0YSh7XG4gICAgZWR1Y2F0aW9uOiBmaWVsZChyYXcsIFwiZWR1Y2F0aW9uXCIsIFwiXHU2NTcwXHU2MzZFXCIsIHBhcnNlRWR1Y2F0aW9uLCBuZXcgRWR1Y2F0aW9uKCkpLFxuICAgIHZlcnNpb246IHJlcXVpcmVkRmllbGQocmF3LCBcInZlcnNpb25cIiwgXCJcdTY1NzBcdTYzNkVcIiwgYXNJbnQpLFxuICAgIGlkZW50aXRpZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJpZGVudGl0aWVzXCIsXG4gICAgICBcIlx1NjU3MFx1NjM2RVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJpZGVudGl0aWVzXCIpLm1hcChwYXJzZUlkZW50aXR5KSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgdGFza3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YXNrc1wiLFxuICAgICAgXCJcdTY1NzBcdTYzNkVcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwidGFza3NcIikubWFwKHBhcnNlVGFzayksXG4gICAgICBbXSxcbiAgICApLFxuICAgIGJsb2NrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImJsb2Nrc1wiLFxuICAgICAgXCJcdTY1NzBcdTYzNkVcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwiYmxvY2tzXCIpLm1hcChwYXJzZUJsb2NrKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgdGVtcGxhdGVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGVtcGxhdGVzXCIsXG4gICAgICBcIlx1NjU3MFx1NjM2RVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0ZW1wbGF0ZXNcIikubWFwKHBhcnNlVGVtcGxhdGUpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBwcmludHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJwcmludHNcIixcbiAgICAgIFwiXHU2NTcwXHU2MzZFXCIsXG4gICAgICAodikgPT5cbiAgICAgICAgYXNBcnJheSh2LCBcInByaW50c1wiKS5tYXAoKHApID0+IHtcbiAgICAgICAgICBlbnN1cmUoaXNPYmplY3QocCksIFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICAgICAgICAgIHJlamVjdFVua25vd24ocCwgW1widGVtcGxhdGVJZFwiLCBcImRhdGVcIl0sIFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XCIpO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0ZW1wbGF0ZUlkOiByZXF1aXJlZEZpZWxkKHAsIFwidGVtcGxhdGVJZFwiLCBcIlx1NTM3MFx1NTIzN1x1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgICAgICAgICBkYXRlOiBmaWVsZChcbiAgICAgICAgICAgICAgcCxcbiAgICAgICAgICAgICAgXCJkYXRlXCIsXG4gICAgICAgICAgICAgIFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XCIsXG4gICAgICAgICAgICAgIChkKSA9PiBhc09wdChkLCBcImRhdGVcIiwgYXNTdHIpLFxuICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBwcm9qZWN0czogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdHNcIiwgXCJcdTY1NzBcdTYzNkVcIiwgKHYpID0+XG4gICAgICBhc0FycmF5KHYsIFwicHJvamVjdHNcIikubWFwKHBhcnNlUHJvamVjdCksXG4gICAgKSxcbiAgICBoYWJpdHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJoYWJpdHNcIixcbiAgICAgIFwiXHU2NTcwXHU2MzZFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcImhhYml0c1wiKS5tYXAocGFyc2VIYWJpdCksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHZpc2lvbnM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ2aXNpb25zXCIsXG4gICAgICBcIlx1NjU3MFx1NjM2RVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ2aXNpb25zXCIpLm1hcChwYXJzZVZpc2lvbiksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHNldHRpbmdzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJzZXR0aW5nc1wiLCBcIlx1NjU3MFx1NjM2RVwiLCBwYXJzZVNldHRpbmdzKSxcbiAgICB0aW1lcjogcmVxdWlyZWRGaWVsZChyYXcsIFwidGltZXJcIiwgXCJcdTY1NzBcdTYzNkVcIiwgcGFyc2VUaW1lciksXG4gICAgc2Vzc2lvbnM6IHJlcXVpcmVkRmllbGQocmF3LCBcInNlc3Npb25zXCIsIFwiXHU2NTcwXHU2MzZFXCIsICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcInNlc3Npb25zXCIpLm1hcChwYXJzZVNlc3Npb24pLFxuICAgICksXG4gICAgbG9jazogZmllbGQocmF3LCBcImxvY2tcIiwgXCJcdTY1NzBcdTYzNkVcIiwgcGFyc2VMb2NrU3RhdGUsIHtcbiAgICAgIHNjaGVkdWxlczogW10sXG4gICAgICBhY3RpdmU6IG51bGwsXG4gICAgICBzdXBwcmVzc2VkVW50aWw6IDAsXG4gICAgfSksXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQXBwRGF0YShkYXRhOiBBcHBEYXRhKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGVkdWNhdGlvbjogc2VyaWFsaXplRWR1Y2F0aW9uKGRhdGEuZWR1Y2F0aW9uKSxcbiAgICB2ZXJzaW9uOiBkYXRhLnZlcnNpb24sXG4gICAgaWRlbnRpdGllczogZGF0YS5pZGVudGl0aWVzLm1hcChzZXJpYWxpemVJZGVudGl0eSksXG4gICAgdGFza3M6IGRhdGEudGFza3MubWFwKHNlcmlhbGl6ZVRhc2spLFxuICAgIGJsb2NrczogZGF0YS5ibG9ja3MubWFwKHNlcmlhbGl6ZUJsb2NrKSxcbiAgICB0ZW1wbGF0ZXM6IGRhdGEudGVtcGxhdGVzLm1hcChzZXJpYWxpemVUZW1wbGF0ZSksXG4gICAgcHJpbnRzOiBkYXRhLnByaW50cy5tYXAoc2VyaWFsaXplUHJpbnRSZWNvcmQpLFxuICAgIHByb2plY3RzOiBkYXRhLnByb2plY3RzLm1hcChzZXJpYWxpemVQcm9qZWN0KSxcbiAgICBoYWJpdHM6IGRhdGEuaGFiaXRzLm1hcChzZXJpYWxpemVIYWJpdCksXG4gICAgdmlzaW9uczogZGF0YS52aXNpb25zLm1hcChzZXJpYWxpemVWaXNpb24pLFxuICAgIHNldHRpbmdzOiBzZXJpYWxpemVTZXR0aW5ncyhkYXRhLnNldHRpbmdzKSxcbiAgICB0aW1lcjogc2VyaWFsaXplVGltZXIoZGF0YS50aW1lciksXG4gICAgc2Vzc2lvbnM6IGRhdGEuc2Vzc2lvbnMubWFwKHNlcmlhbGl6ZVNlc3Npb24pLFxuICAgIGxvY2s6IHNlcmlhbGl6ZUxvY2tTdGF0ZShkYXRhLmxvY2spLFxuICB9O1xufVxuXG5pbXBvcnQgeyBzZXJpYWxpemVQcmludFJlY29yZCwgc2VyaWFsaXplVGVtcGxhdGUgfSBmcm9tIFwiLi90ZW1wbGF0ZXNcIjtcbmltcG9ydCB7IHZhbGlkYXRlQmxvY2sgfSBmcm9tIFwiLi9ibG9ja3NcIjtcbmltcG9ydCB7IGlzQWJzb2x1dGVQYXRoIH0gZnJvbSBcIi4vZWR1Y2F0aW9uXCI7XG4iLCAiLy8hIFx1NEVDNVx1NjcyQ1x1NTczMCB2M1x1MjE5MnY0IFx1OEY2Q1x1NjM2Mlx1RkYxQVx1NEVBNFx1NjM2Mlx1NjU4N1x1NEVGNlx1NjMwOVx1NUY1M1x1NTI0RFx1NzI0OFx1NjcyQ1x1NEUyNVx1NjgzQ1x1NjgyMVx1OUE4Q1x1RkYwQ1x1NEUwRFx1OEQ3MFx1OEZDMVx1NzlGQlx1OERFRlx1NUY4NFx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvbWlncmF0aW9uLnJzXHVGRjA4XHU0RUM1XHU2NTg3XHU0RUY2XHU2ODNDXHU1RjBGXHU4QkVEXHU0RTQ5XHVGRjA5XHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSBcIi4vZXJyb3JzXCI7XG5pbXBvcnQgeyBkYXRlQXQsIG5vdyB9IGZyb20gXCIuL3RpbWVcIjtcbmltcG9ydCB7IHBhcnNlQXBwRGF0YSwgcGFyc2VUYXNrLCBzZXJpYWxpemVUYXNrIH0gZnJvbSBcIi4vbGliXCI7XG5cbmZ1bmN0aW9uIHVwZ3JhZGVUYXNrVmFsdWUodGFzazogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHRvZGF5OiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZGF0ZSA9XG4gICAgdHlwZW9mIHRhc2tbXCJjcmVhdGVkQXRcIl0gPT09IFwibnVtYmVyXCJcbiAgICAgID8gZGF0ZUF0KHRhc2tbXCJjcmVhdGVkQXRcIl0gYXMgbnVtYmVyKVxuICAgICAgOiB0b2RheTtcbiAgZGVsZXRlIHRhc2tbXCJnb2FsSWRcIl07XG4gIGRlbGV0ZSB0YXNrW1wibm9kZUlkXCJdO1xuICBpZiAodGFza1tcImR1ZURhdGVcIl0gPT09IHVuZGVmaW5lZCB8fCB0YXNrW1wiZHVlRGF0ZVwiXSA9PT0gbnVsbCkge1xuICAgIHRhc2tbXCJkdWVEYXRlXCJdID0gZGF0ZTtcbiAgfVxufVxuXG4vKipcbiAqIFx1OEJGQlx1NTNENlx1NjcyQ1x1NTczMFx1NUI1OFx1NTBBOFx1RkYxQXYzIFx1NEUwMFx1NkIyMVx1NjAyN1x1OEY2Q1x1NjM2Mlx1RkYwOFx1NzlGQlx1OTY2NFx1NzZFRVx1NjgwN1x1NEUzQlx1N0VCRlx1MzAwMVx1ODg2NVx1OUY1MFx1NjVFNVx1NjcxRlx1RkYwOVx1RkYwQ3Y0IFx1NzZGNFx1NjNBNVx1NEUyNVx1NjgzQ1x1ODlFM1x1Njc5MFx1MzAwMlxuICogXHU4RjZDXHU2MzYyXHU1OTMxXHU4RDI1XHU1MzlGXHU2NTg3XHU0RUY2XHU0RkREXHU3NTU5XHVGRjA4XHU3NTMxXHU4QzAzXHU3NTI4XHU2NUI5XHU0RkREXHU4QkMxXHU0RTBEXHU1MTk5XHU1NkRFXHVGRjA5XHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkTG9jYWxEYXRhKHJhdzogc3RyaW5nKTogaW1wb3J0KFwiLi9saWJcIikuQXBwRGF0YSB7XG4gIGxldCB2YWx1ZTogdW5rbm93bjtcbiAgdHJ5IHtcbiAgICB2YWx1ZSA9IEpTT04ucGFyc2UocmF3KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihgXHU2NTcwXHU2MzZFXHU4QkZCXHU1M0Q2XHU1OTMxXHU4RDI1XHVGRjBDXHU1MzlGXHU2NTg3XHU0RUY2XHU1REYyXHU0RkREXHU3NTU5XHVGRjFBJHtTdHJpbmcoZSl9YCk7XG4gIH1cbiAgaWYgKCFpc09iamVjdCh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1NzBcdTYzNkVcdThCRkJcdTUzRDZcdTU5MzFcdThEMjVcdUZGMENcdTUzOUZcdTY1ODdcdTRFRjZcdTVERjJcdTRGRERcdTc1NTlcdUZGMUFcdTY1RTBcdTY1NDhcdTc2ODRcdTY3MkNcdTU3MzBcdTY1NzBcdTYzNkVcIik7XG4gIH1cbiAgaWYgKHZhbHVlW1widmVyc2lvblwiXSA9PT0gMykge1xuICAgIGNvbnN0IHRvZGF5ID0gZGF0ZUF0KG5vdygpKTtcbiAgICB2YWx1ZVtcInZlcnNpb25cIl0gPSA0O1xuICAgIGRlbGV0ZSB2YWx1ZVtcImdvYWxzXCJdO1xuICAgIGRlbGV0ZSB2YWx1ZVtcIm5vZGVCaW5kaW5nc1wiXTtcbiAgICBkZWxldGUgdmFsdWVbXCJzaWduYWxFdmVudHNcIl07XG4gICAgY29uc3QgdGFza3MgPSB2YWx1ZVtcInRhc2tzXCJdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHRhc2tzKSkge1xuICAgICAgZm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG4gICAgICAgIGlmIChpc09iamVjdCh0YXNrKSkgdXBncmFkZVRhc2tWYWx1ZSh0YXNrLCB0b2RheSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHRlbXBsYXRlcyA9IHZhbHVlW1widGVtcGxhdGVzXCJdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHRlbXBsYXRlcykpIHtcbiAgICAgIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgdGVtcGxhdGVzKSB7XG4gICAgICAgIGlmICghaXNPYmplY3QodGVtcGxhdGUpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3Qgc2hhcGUgPSB0ZW1wbGF0ZVtcInNoYXBlXCJdO1xuICAgICAgICBpZiAoaXNPYmplY3Qoc2hhcGUpKSBkZWxldGUgc2hhcGVbXCJnb2FsSWRcIl07XG4gICAgICAgIGNvbnN0IHByaW50aW5nID0gdGVtcGxhdGVbXCJwcmludGluZ1wiXTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGlzT2JqZWN0KHByaW50aW5nKSAmJlxuICAgICAgICAgIHByaW50aW5nW1wia2luZFwiXSA9PT0gXCJvbmNlXCIgJiZcbiAgICAgICAgICAocHJpbnRpbmdbXCJkYXRlXCJdID09PSBudWxsIHx8IHByaW50aW5nW1wiZGF0ZVwiXSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICApIHtcbiAgICAgICAgICBwcmludGluZ1tcImRhdGVcIl0gPSB0b2RheTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBwcmludHMgPSB2YWx1ZVtcInByaW50c1wiXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwcmludHMpKSB7XG4gICAgICB2YWx1ZVtcInByaW50c1wiXSA9IHByaW50cy5maWx0ZXIoKHApID0+IGlzT2JqZWN0KHApICYmIHBbXCJkYXRlXCJdICE9PSBudWxsKTtcbiAgICB9XG4gICAgY29uc3QgdmlzaW9ucyA9IHZhbHVlW1widmlzaW9uc1wiXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2aXNpb25zKSkge1xuICAgICAgZm9yIChjb25zdCB2aXNpb24gb2YgdmlzaW9ucykge1xuICAgICAgICBpZiAoaXNPYmplY3QodmlzaW9uKSkgZGVsZXRlIHZpc2lvbltcImdvYWxJZFwiXTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaWRzID0gdmFsdWVbXCJpZGVudGl0aWVzXCJdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGlkcykpIHtcbiAgICAgIHZhbHVlW1wiaWRlbnRpdGllc1wiXSA9IGlkcy5maWx0ZXIoXG4gICAgICAgIChyKSA9PlxuICAgICAgICAgIGlzT2JqZWN0KHIpICYmXG4gICAgICAgICAgIVtcImdvYWxcIiwgXCJub2RlXCIsIFwic2lnbmFsXCJdLmluY2x1ZGVzKHJbXCJraW5kXCJdIGFzIHN0cmluZyksXG4gICAgICApO1xuICAgICAgZm9yIChjb25zdCByZWNvcmQgb2YgdmFsdWVbXCJpZGVudGl0aWVzXCJdIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+W10pIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZWNvcmRbXCJyZXN0b3JlVGFza1wiXSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIGxldCB0YXNrOiB1bmtub3duO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0YXNrID0gSlNPTi5wYXJzZShyZWNvcmRbXCJyZXN0b3JlVGFza1wiXSBhcyBzdHJpbmcpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihgXHU2NTcwXHU2MzZFXHU4QkZCXHU1M0Q2XHU1OTMxXHU4RDI1XHVGRjBDXHU1MzlGXHU2NTg3XHU0RUY2XHU1REYyXHU0RkREXHU3NTU5XHVGRjFBJHtTdHJpbmcoZSl9YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghaXNPYmplY3QodGFzaykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgICAgICAgICAgXCJcdTY1NzBcdTYzNkVcdThCRkJcdTUzRDZcdTU5MzFcdThEMjVcdUZGMENcdTUzOUZcdTY1ODdcdTRFRjZcdTVERjJcdTRGRERcdTc1NTlcdUZGMUFcdTY1RTBcdTY1NDhcdTc2ODRcdTRFRkJcdTUyQTFcdTYwNjJcdTU5MERcdThCQjBcdTVGNTVcIixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHVwZ3JhZGVUYXNrVmFsdWUodGFzaywgdG9kYXkpO1xuICAgICAgICAgIC8vIFx1NjRBNFx1OTUwMFx1NjA2Mlx1NTkwRFx1NkJENFx1OEY4M1x1NzY3Qlx1OEJCMCBEVE8gXHU3Njg0XHU1RThGXHU1MjE3XHU1MzE2XHVGRjA4XHU1NDJCXHU5NTJFXHU1RThGXHVGRjA5XHUzMDAyXG4gICAgICAgICAgcmVjb3JkW1wicmVzdG9yZVRhc2tcIl0gPSBKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICAgIHNlcmlhbGl6ZVRhc2socGFyc2VUYXNrKHRhc2spKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHRyeSB7XG4gICAgcmV0dXJuIHBhcnNlQXBwRGF0YSh2YWx1ZSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICBgXHU2NTcwXHU2MzZFXHU4QkZCXHU1M0Q2XHU1OTMxXHU4RDI1XHVGRjBDXHU1MzlGXHU2NTg3XHU0RUY2XHU1REYyXHU0RkREXHU3NTU5XHVGRjFBJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSl9YCxcbiAgICApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KHY6IHVua25vd24pOiB2IGlzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHR5cGVvZiB2ID09PSBcIm9iamVjdFwiICYmIHYgIT09IG51bGwgJiYgIUFycmF5LmlzQXJyYXkodik7XG59XG4iLCAiLy8hIFx1NTNFRlx1ODlFM1x1OTFDQVx1NzY4NFx1NjcyQ1x1NTczMFx1NEZFMVx1NTNGN1x1MzAwMlx1NEUwRFx1OEMwM1x1NkEyMVx1NTc4Qlx1MzAwMVx1NEUwRFx1NzMxQ1x1N0YzQVx1NTkzMVx1NjU3MFx1NjM2RVx1MzAwMVx1NEUwRFx1ODFFQVx1NTJBOFx1NEUwQlx1N0VEM1x1OEJCQVx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvZGlhZ25vc3RpY3MucnNcdTMwMDJcblxuaW1wb3J0IHsgZGF0ZUF0LCBtaW51dGVzT2YsIHBhcnNlRGF0ZSwgYWRkRGF5cywgZm9ybWF0RGF0ZSB9IGZyb20gXCIuL3RpbWVcIjtcbmltcG9ydCB0eXBlIHsgU25hcHNob3QsIFRhc2sgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgaXNIYWJpdCB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyB3aW5kb3dNaW51dGVzIH0gZnJvbSBcIi4vcmVtaW5kZXJzXCI7XG5pbXBvcnQgeyBibG9ja3NPbkRhdGUsIG92ZXJsYXBNaW51dGVzLCByZXF1aXJlZE1pbnV0ZXMgfSBmcm9tIFwiLi9ibG9ja3NcIjtcblxuZXhwb3J0IGludGVyZmFjZSBBbm9tYWx5IHtcbiAga2V5OiBzdHJpbmc7XG4gIGtpbmQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgc2V2ZXJpdHk6IHN0cmluZztcbiAgZXZpZGVuY2U6IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBxdWVzdGlvbjogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBzaWduYWwoXG4gIGtleTogc3RyaW5nLFxuICBraW5kOiBzdHJpbmcsXG4gIHRpdGxlOiBzdHJpbmcsXG4gIHNldmVyaXR5OiBzdHJpbmcsXG4gIGV2aWRlbmNlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgcXVlc3Rpb246IHN0cmluZyxcbik6IEFub21hbHkge1xuICByZXR1cm4geyBrZXksIGtpbmQsIHRpdGxlLCBzZXZlcml0eSwgZXZpZGVuY2UsIHF1ZXN0aW9uIH07XG59XG5cbmZ1bmN0aW9uIG1lZGlhbih2YWx1ZXM6IG51bWJlcltdKTogbnVtYmVyIHtcbiAgY29uc3Qgc29ydGVkID0gWy4uLnZhbHVlc10uc29ydCgoYSwgYikgPT4gYSAtIGIpO1xuICByZXR1cm4gc29ydGVkW01hdGguZmxvb3Ioc29ydGVkLmxlbmd0aCAvIDIpXSE7XG59XG5cbi8qKlxuICogXHU1QkI5XHU5MUNGXHU2NjJGXHU2NjNFXHU1RjBGXHU3NTI4XHU2MjM3XHU5ODg0XHU3Qjk3XHVGRjBDXHU1NDI2XHU1MjE5XHU1M0Q2XHU1Mzg2XHU1M0YyXHU2RDNCXHU4REMzXHU2NUU1XHU0RTJEXHU0RjREXHU2NTcwXHVGRjBDXHU2NzAwXHU1NDBFXHU4NDNEXHU1MjMwXHU2QkNGXHU2NUU1XHU3NkVFXHU2ODA3XHUzMDAyXG4gKiBcdTU3RkFcdTdFQkZcdTY2MkZcdThCQzFcdTYzNkVcdUZGMENcdTRFMERcdTY2MkZcdTUzRUZcdTc1MjhcdTY1RjZcdTk1RjRcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpYWdub3NlKFxuICBzbmFwc2hvdDogU25hcHNob3QsXG4gIGNhcGFjaXR5TWludXRlczogbnVtYmVyIHwgbnVsbCxcbik6IEFub21hbHlbXSB7XG4gIGNvbnN0IGRhdGEgPSBzbmFwc2hvdC5kYXRhO1xuICBjb25zdCBhdCA9IHNuYXBzaG90LnNlcnZlclRpbWU7XG4gIGNvbnN0IHRvZGF5ID0gcGFyc2VEYXRlKHNuYXBzaG90LnRvZGF5KSE7XG4gIGNvbnN0IHdlZWtTdGFydCA9IGZvcm1hdERhdGUoYWRkRGF5cyh0b2RheSwgLTcpKTtcbiAgY29uc3QgbW9udGhTdGFydCA9IGZvcm1hdERhdGUoYWRkRGF5cyh0b2RheSwgLTI4KSk7XG4gIGNvbnN0IGJ5RGF5ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgZm9yIChjb25zdCBzIG9mIGRhdGEuc2Vzc2lvbnMpIHtcbiAgICBjb25zdCBkYXRlID0gZGF0ZUF0KHMuZW5kZWRBdCk7XG4gICAgaWYgKGRhdGUgPj0gbW9udGhTdGFydCAmJiBkYXRlIDwgc25hcHNob3QudG9kYXkpIHtcbiAgICAgIGJ5RGF5LnNldChkYXRlLCAoYnlEYXkuZ2V0KGRhdGUpID8/IDApICsgTWF0aC5mbG9vcihzLmR1cmF0aW9uU2VjcyAvIDYwKSk7XG4gICAgfVxuICB9XG4gIGNvbnN0IGFjdGl2ZU1pbnV0ZXMgPSBbLi4uYnlEYXkudmFsdWVzKCldLmZpbHRlcigobSkgPT4gbSA+PSAyMCk7XG4gIGNvbnN0IGhpc3RvcmljYWwgPSBhY3RpdmVNaW51dGVzLmxlbmd0aCA+PSA1ID8gbWVkaWFuKGFjdGl2ZU1pbnV0ZXMpIDogbnVsbDtcbiAgY29uc3QgY2FwYWNpdHkgPVxuICAgIGNhcGFjaXR5TWludXRlcyAhPT0gbnVsbFxuICAgICAgPyBjYXBhY2l0eU1pbnV0ZXNcbiAgICAgIDogaGlzdG9yaWNhbCAhPT0gbnVsbFxuICAgICAgICA/IE1hdGgubWF4KDMwLCBoaXN0b3JpY2FsKVxuICAgICAgICA6IGRhdGEuc2V0dGluZ3MuZGFpbHlHb2FsICogZGF0YS5zZXR0aW5ncy5mb2N1c01pbnV0ZXM7XG4gIGNvbnN0IGNhcGFjaXR5U291cmNlID1cbiAgICBjYXBhY2l0eU1pbnV0ZXMgIT09IG51bGxcbiAgICAgID8gXCJcdTc1MjhcdTYyMzdcdThCQkVcdTdGNkVcdTc2ODRcdTY1RTVcdTk4ODRcdTdCOTdcIlxuICAgICAgOiBoaXN0b3JpY2FsICE9PSBudWxsXG4gICAgICAgID8gXCJcdThGRDEyOFx1NTkyOVx1ODFGM1x1NUMxMTVcdTRFMkFcdTZEM0JcdThEQzNcdTY1RTVcdTc2ODRcdTRFMkRcdTRGNERcdTY1NzBcdUZGMDhcdTVFNzZcdTk3NUVcdTUzRUZcdTc1MjhcdTY1RjZcdTk1RjRcdUZGMDlcIlxuICAgICAgICA6IFwiXHU2QkNGXHU2NUU1XHU3NTZBXHU4MzA0XHU3NkVFXHU2ODA3XHU5ODg0XHU3Qjk3XHVGRjA4XHU1RTc2XHU5NzVFXHU1M0VGXHU3NTI4XHU2NUY2XHU5NUY0XHVGRjA5XCI7XG4gIGNvbnN0IGNvbXBsZXRlZFJvdW5kcyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIGZvciAoY29uc3QgcyBvZiBkYXRhLnNlc3Npb25zKSB7XG4gICAgaWYgKHMuY29tcGxldGVkICYmIHMudGFza0lkICE9PSBudWxsKSB7XG4gICAgICBjb21wbGV0ZWRSb3VuZHMuc2V0KHMudGFza0lkLCAoY29tcGxldGVkUm91bmRzLmdldChzLnRhc2tJZCkgPz8gMCkgKyAxKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgcmVzdWx0OiBBbm9tYWx5W10gPSBbXTtcbiAgZm9yIChsZXQgb2Zmc2V0ID0gMDsgb2Zmc2V0IDwgMzsgb2Zmc2V0ICs9IDEpIHtcbiAgICBjb25zdCBkYXRlID0gZm9ybWF0RGF0ZShhZGREYXlzKHRvZGF5LCBvZmZzZXQpKTtcbiAgICBjb25zdCB0YXNrcyA9IGRhdGEudGFza3MuZmlsdGVyKFxuICAgICAgKHQpID0+IHQuZHVlRGF0ZSA9PT0gZGF0ZSAmJiAhdC5jb21wbGV0ZWQgJiYgIWRhdGEudGFza0lzVm9pZCh0KSxcbiAgICApO1xuICAgIGNvbnN0IG1pbnV0ZXMgPSB0YXNrcy5yZWR1Y2UoXG4gICAgICAobiwgdCkgPT5cbiAgICAgICAgbiArXG4gICAgICAgIE1hdGgubWF4KDAsIHQuZXN0aW1hdGUgLSAoY29tcGxldGVkUm91bmRzLmdldCh0LmlkKSA/PyAwKSkgKlxuICAgICAgICAgICh0LmZvY3VzTWludXRlcyA/PyBkYXRhLnNldHRpbmdzLmZvY3VzTWludXRlcyksXG4gICAgICAwLFxuICAgICk7XG4gICAgY29uc3QgZGF5ID0gcGFyc2VEYXRlKGRhdGUpO1xuICAgIGNvbnN0IGJsb2NrZWRNaW51dGVzID0gcmVxdWlyZWRNaW51dGVzKGRhdGEuYmxvY2tzLCBkYXRlKTtcbiAgICBpZiAoY2FwYWNpdHkgPiAwICYmIG1pbnV0ZXMgKiAxMDAgPiBjYXBhY2l0eSAqIDEzMCkge1xuICAgICAgcmVzdWx0LnB1c2goXG4gICAgICAgIHNpZ25hbChcbiAgICAgICAgICBgb3ZlcmxvYWQvJHtkYXRlfWAsXG4gICAgICAgICAgXCJvdmVybG9hZFwiLFxuICAgICAgICAgIFwiXHU4QkExXHU1MjEyXHU3NTI4XHU2NUY2XHU5QUQ4XHU0RThFXHU1RjUzXHU1MjREXHU5ODg0XHU3Qjk3XCIsXG4gICAgICAgICAgXCJ3YXJuaW5nXCIsXG4gICAgICAgICAge1xuICAgICAgICAgICAgZGF0ZSxcbiAgICAgICAgICAgIHJlbWFpbmluZ1BsYW5uZWRNaW51dGVzOiBtaW51dGVzLFxuICAgICAgICAgICAgYnVkZ2V0TWludXRlczogY2FwYWNpdHksXG4gICAgICAgICAgICBidWRnZXRTb3VyY2U6IGNhcGFjaXR5U291cmNlLFxuICAgICAgICAgICAgYmxvY2tlZE1pbnV0ZXMsXG4gICAgICAgICAgICB0YXNrSWRzOiB0YXNrcy5zbGljZSgwLCAzMCkubWFwKCh0KSA9PiB0LmlkKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFwiXHU4RkQ5XHU0RTlCXHU0RUZCXHU1MkExXHU3Njg0XHU5ODg0XHU4QkExXHU3NTI4XHU2NUY2XHU2NjJGXHU1NDI2XHU1MUM2XHU3ODZFXHVGRjFGXHU4RkQ5XHU0RTAwXHU1OTI5XHU2NzA5XHU5ODlEXHU1OTE2XHU1M0VGXHU3NTI4XHU2NUY2XHU5NUY0XHVGRjBDXHU4RkQ4XHU2NjJGXHU5NzAwXHU4OTgxXHU1MUNGXHU5MUNGXHU2MjE2XHU2MzJBXHU1MkE4XHVGRjFGXCIsXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICBvZmZzZXQgPT09IDEgJiZcbiAgICAgIGhpc3RvcmljYWwgIT09IG51bGwgJiZcbiAgICAgIHRhc2tzLmxlbmd0aCA+IDAgJiZcbiAgICAgIG1pbnV0ZXMgKiAxMDAgPCBjYXBhY2l0eSAqIDMwXG4gICAgKSB7XG4gICAgICByZXN1bHQucHVzaChcbiAgICAgICAgc2lnbmFsKFxuICAgICAgICAgIGB1bmRlcmxvYWQvJHtkYXRlfWAsXG4gICAgICAgICAgXCJ1bmRlcmxvYWRcIixcbiAgICAgICAgICBcIlx1NjYwRVx1NjVFNVx1NUI4OVx1NjM5Mlx1NjYwRVx1NjYzRVx1NEY0RVx1NEU4RVx1OEZEMVx1NjcxRlx1NjI5NVx1NTE2NVwiLFxuICAgICAgICAgIFwibm90aWNlXCIsXG4gICAgICAgICAge1xuICAgICAgICAgICAgZGF0ZSxcbiAgICAgICAgICAgIHBsYW5uZWRNaW51dGVzOiBtaW51dGVzLFxuICAgICAgICAgICAgYmFzZWxpbmVNaW51dGVzOiBjYXBhY2l0eSxcbiAgICAgICAgICAgIGJhc2VsaW5lU291cmNlOiBjYXBhY2l0eVNvdXJjZSxcbiAgICAgICAgICAgIGJsb2NrZWRNaW51dGVzLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgXCJcdTY2MEVcdTU5MjlcdTY2MkZcdTY3MDlcdTYxMEZcdTRGMTFcdTYwNkZcdTMwMDFcdThCRkVcdTdBMEJcdTUzNjBcdTc1MjhcdUZGMENcdThGRDhcdTY2MkZcdThCQTFcdTUyMTJcdTVDMUFcdTY3MkFcdTg4NjVcdTlGNTBcdUZGMUZcdTRFMERcdTg5ODFcdTRFQzVcdTUxRURcdTdBN0FcdTk1RjJcdTYzQThcdTY1QURcdTVFOTRcdThCRTVcdTUyQTBcdTRFRkJcdTUyQTFcdTMwMDJcIixcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHRpbWVkOiB7IHN0YXJ0OiBudW1iZXI7IHRhc2s6IFRhc2sgfVtdID0gdGFza3NcbiAgICAgIC5tYXAoKHQpID0+ICh7XG4gICAgICAgIHN0YXJ0OiB0LnJlbWluZGVyVGltZSAhPT0gbnVsbCA/IChtaW51dGVzT2YodC5yZW1pbmRlclRpbWUpID8/IC0xKSA6IC0xLFxuICAgICAgICB0YXNrOiB0LFxuICAgICAgfSkpXG4gICAgICAuZmlsdGVyKCh4KSA9PiB4LnN0YXJ0ID49IDApXG4gICAgICAuc29ydChcbiAgICAgICAgKGEsIGIpID0+XG4gICAgICAgICAgYS5zdGFydCAtIGIuc3RhcnQgfHxcbiAgICAgICAgICAoYS50YXNrLmlkIDwgYi50YXNrLmlkID8gLTEgOiBhLnRhc2suaWQgPiBiLnRhc2suaWQgPyAxIDogMCksXG4gICAgICApO1xuICAgIC8vIFx1OTcwMFx1NEUxM1x1NUZDM1x1NzY4NFx1NjVGNlx1NkJCNVx1NjI0RFx1Njc4NFx1NjIxMFx1NzcxRlx1NUI5RVx1NTFCMlx1N0E4MVx1RkYxQlx1NkMzNFx1OEJGRVx1NkI2M1x1NjYyRlx1NUU3Nlx1ODg0Q1x1NEY1Q1x1NEUxQVx1NzY4NFx1NTczMFx1NjVCOVx1RkYwQ1x1NEZERFx1NjMwMVx1NUI4OVx1OTc1OVx1MzAwMlxuICAgIGlmIChkYXkgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHJlcXVpcmVkID0gYmxvY2tzT25EYXRlKGRhdGEuYmxvY2tzLCBkYXRlKS5maWx0ZXIoXG4gICAgICAgIChiKSA9PiBiLmF0dGVudGlvbiA9PT0gXCJyZXF1aXJlZFwiLFxuICAgICAgKTtcbiAgICAgIGZvciAoY29uc3QgeyBzdGFydCwgdGFzayB9IG9mIHRpbWVkKSB7XG4gICAgICAgIGNvbnN0IGVuZCA9IHN0YXJ0ICsgd2luZG93TWludXRlcyh0YXNrLCBkYXRhLnNldHRpbmdzKTtcbiAgICAgICAgZm9yIChjb25zdCBiYW5kIG9mIHJlcXVpcmVkKSB7XG4gICAgICAgICAgY29uc3Qgb3ZlcmxhcCA9IG92ZXJsYXBNaW51dGVzKGJhbmQsIGRhdGUsIHN0YXJ0LCBlbmQpO1xuICAgICAgICAgIGlmIChvdmVybGFwID4gMCkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goXG4gICAgICAgICAgICAgIHNpZ25hbChcbiAgICAgICAgICAgICAgICBgYmxvY2svJHtkYXRlfS8ke3Rhc2suaWR9LyR7YmFuZC5pZH1gLFxuICAgICAgICAgICAgICAgIFwiYmxvY2tDb25mbGljdFwiLFxuICAgICAgICAgICAgICAgIFwiXHU4QkExXHU1MjEyXHU2NUY2XHU2QkI1XHU4NDNEXHU1NzI4XHU5NzAwXHU0RTEzXHU1RkMzXHU3Njg0XHU4QkZFXHU3QTBCXHU1MTg1XCIsXG4gICAgICAgICAgICAgICAgXCJ3YXJuaW5nXCIsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgZGF0ZSxcbiAgICAgICAgICAgICAgICAgIHRhc2tJZDogdGFzay5pZCxcbiAgICAgICAgICAgICAgICAgIHRhc2tUaXRsZTogdGFzay50aXRsZSxcbiAgICAgICAgICAgICAgICAgIGJsb2NrSWQ6IGJhbmQuaWQsXG4gICAgICAgICAgICAgICAgICBibG9ja1RpdGxlOiBiYW5kLnRpdGxlLFxuICAgICAgICAgICAgICAgICAgYmxvY2tTdGFydDogYmFuZC5zdGFydCxcbiAgICAgICAgICAgICAgICAgIGJsb2NrRW5kOiBiYW5kLmVuZCxcbiAgICAgICAgICAgICAgICAgIG92ZXJsYXBNaW51dGVzOiBvdmVybGFwLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXCJcdThGRDlcdTZCQjVcdTVCODlcdTYzOTJcdTU0OENcdTg5ODFcdTRFMTNcdTVGQzNcdTU0MkNcdTc2ODRcdThCRkVcdTkxQ0RcdTUzRTBcdUZGMUFcdTgwRkRcdTYzMkFcdTUyMzBcdTZDMzRcdThCRkVcdTY1RjZcdTZCQjVcdTYyMTZcdThCRkVcdTU0MEVcdTU0MTdcdUZGMUZcdTU5ODJcdTY3OUNcdTc4NkVcdTVCOUVcdTg5ODFcdThCRkVcdTRFMEFcdTUwNUFcdUZGMENcdThCRjRcdTY2MEVcdTU0MEVcdTYyMTFcdTRFMERcdTRGMUFcdTUxOERcdTYyOEFcdTVCODNcdTVGNTNcdTUxQjJcdTdBODFcdTMwMDJcIixcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFx1OEJCMFx1NUY1NVx1NUVGNlx1NEYzOFx1NTIzMFx1NjcwMFx1NTNGM1x1NEZBN1x1NzY4NFx1NTMzQVx1OTVGNFx1RkYxQlx1NTNFQVx1NEUwRVx1NzZGOFx1OTBCQlx1NkJENFx1OEY4M1x1NEYxQVx1NkYwRlx1NjM4OVx1NEUwMFx1NEUyQVx1OTU3Rlx1OEJGRVx1N0EwQlx1ODk4Nlx1NzZENlx1NTkxQVx1NEUyQVx1NzdFRFx1NEVGQlx1NTJBMVx1MzAwMlxuICAgIGxldCBwcmV2aW91czogeyBlbmQ6IG51bWJlcjsgdGFzazogVGFzayB9IHwgbnVsbCA9IG51bGw7XG4gICAgZm9yIChjb25zdCB7IHN0YXJ0LCB0YXNrIH0gb2YgdGltZWQpIHtcbiAgICAgIGNvbnN0IGVuZCA9IHN0YXJ0ICsgd2luZG93TWludXRlcyh0YXNrLCBkYXRhLnNldHRpbmdzKTtcbiAgICAgIGlmIChwcmV2aW91cyAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBwcmV2ID0gcHJldmlvdXM7XG4gICAgICAgIGlmIChzdGFydCA8IHByZXYuZW5kKSB7XG4gICAgICAgICAgY29uc3QgaWRzID0gW3ByZXYudGFzay5pZCwgdGFzay5pZF0uc29ydCgpO1xuICAgICAgICAgIGNvbnN0IGJhbmQgPVxuICAgICAgICAgICAgZGF5ID09PSBudWxsXG4gICAgICAgICAgICAgID8gbnVsbFxuICAgICAgICAgICAgICA6IGRhdGEuYmxvY2tzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAoYikgPT5cbiAgICAgICAgICAgICAgICAgICAgYi5hdHRlbnRpb24gPT09IFwibGlnaHRcIiAmJlxuICAgICAgICAgICAgICAgICAgICBvdmVybGFwTWludXRlcyhiLCBkYXRlLCBzdGFydCwgTWF0aC5taW4ocHJldi5lbmQsIGVuZCkpID4gMCxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgIHJlc3VsdC5wdXNoKFxuICAgICAgICAgICAgc2lnbmFsKFxuICAgICAgICAgICAgICBgY29sbGlzaW9uLyR7ZGF0ZX0vJHtpZHNbMF19LyR7aWRzWzFdfWAsXG4gICAgICAgICAgICAgIFwiY29sbGlzaW9uXCIsXG4gICAgICAgICAgICAgIFwiXHU0RTI0XHU0RTJBXHU4QkExXHU1MjEyXHU2NUY2XHU2QkI1XHU5MUNEXHU1M0UwXCIsXG4gICAgICAgICAgICAgIFwid2FybmluZ1wiLFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGF0ZSxcbiAgICAgICAgICAgICAgICB0YXNrSWRzOiBpZHMsXG4gICAgICAgICAgICAgICAgdGl0bGVzOiBbcHJldi50YXNrLnRpdGxlLCB0YXNrLnRpdGxlXSxcbiAgICAgICAgICAgICAgICBvdmVybGFwTWludXRlczogTWF0aC5taW4ocHJldi5lbmQsIGVuZCkgLSBzdGFydCxcbiAgICAgICAgICAgICAgICBpbmNsdWRlc0JyZWFrczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBibG9ja1RpdGxlOiBiYW5kPy50aXRsZSA/PyBudWxsLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBcIlx1OEZEOVx1NEUyNFx1NEUyQVx1NUI4OVx1NjM5Mlx1ODBGRFx1NTQyNlx1NTQwQ1x1NjVGNlx1NUI4Q1x1NjIxMFx1RkYxRlx1NTk4Mlx1Njc5Q1x1NjYyRlx1NTcyOFx1NTQwQ1x1NEUwMFx1OEJGRVx1N0EwQlx1NTE4NVx1NTA1QVx1NEY1Q1x1NEUxQVx1RkYwQ1x1OEJGN1x1OEJGNFx1NjYwRVx1RkYwQ1x1OTA3Rlx1NTE0RFx1NjI4QVx1NTE0MVx1OEJCOFx1NzY4NFx1NUU3Nlx1ODg0Q1x1OEJFRlx1NTIyNFx1NEUzQVx1NTFCMlx1N0E4MVx1MzAwMlwiLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmQgPD0gcHJldmlvdXMuZW5kKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHByZXZpb3VzID0geyBlbmQsIHRhc2sgfTtcbiAgICB9XG4gIH1cbiAgY29uc3QgaGFiaXRzID0gbmV3IE1hcDxcbiAgICBzdHJpbmcsXG4gICAgeyBzY2hlZHVsZWQ6IG51bWJlcjsgbWlzc2VkOiBudW1iZXI7IGlkczogc3RyaW5nW10gfVxuICA+KCk7XG4gIGZvciAoY29uc3QgdCBvZiBkYXRhLnRhc2tzKSB7XG4gICAgaWYgKFxuICAgICAgIWlzSGFiaXQodCkgfHxcbiAgICAgIHQuZHVlRGF0ZSA9PT0gbnVsbCB8fFxuICAgICAgISh0LmR1ZURhdGUgPj0gd2Vla1N0YXJ0ICYmIHQuZHVlRGF0ZSA8IHNuYXBzaG90LnRvZGF5KVxuICAgICkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGtleSA9IHQuaGFiaXRJZCA/PyB0LnRlbXBsYXRlSWQgPz8gdC5pZDtcbiAgICBjb25zdCBlbnRyeSA9IGhhYml0cy5nZXQoa2V5KSA/PyB7IHNjaGVkdWxlZDogMCwgbWlzc2VkOiAwLCBpZHM6IFtdIH07XG4gICAgZW50cnkuc2NoZWR1bGVkICs9IDE7XG4gICAgaWYgKCF0LmNvbXBsZXRlZCAmJiB0LnJlbWluZGVyRXhwaXJlZCkge1xuICAgICAgZW50cnkubWlzc2VkICs9IDE7XG4gICAgICBlbnRyeS5pZHMucHVzaCh0LmlkKTtcbiAgICB9XG4gICAgaGFiaXRzLnNldChrZXksIGVudHJ5KTtcbiAgfVxuICBmb3IgKGNvbnN0IFtpZCwgeyBzY2hlZHVsZWQsIG1pc3NlZCwgaWRzIH1dIG9mIGhhYml0cykge1xuICAgIGlmIChzY2hlZHVsZWQgPj0gNCAmJiBtaXNzZWQgPj0gMyAmJiBtaXNzZWQgKiAxMDAgPj0gc2NoZWR1bGVkICogNTApIHtcbiAgICAgIHJlc3VsdC5wdXNoKFxuICAgICAgICBzaWduYWwoXG4gICAgICAgICAgYGhhYml0LyR7aWR9YCxcbiAgICAgICAgICBcImhhYml0QWJzZW5jZVwiLFxuICAgICAgICAgIFwiXHU4RkQxXHU0RTAwXHU1NDY4XHU0RTYwXHU2MEVGXHU1OTFBXHU2QjIxXHU2NzJBXHU1QjhDXHU2MjEwXCIsXG4gICAgICAgICAgXCJ3YXJuaW5nXCIsXG4gICAgICAgICAge1xuICAgICAgICAgICAgaGFiaXRJZDogaWQsXG4gICAgICAgICAgICBvYnNlcnZlZE9jY3VycmVuY2VzOiBzY2hlZHVsZWQsXG4gICAgICAgICAgICBtaXNzZWRPY2N1cnJlbmNlczogbWlzc2VkLFxuICAgICAgICAgICAgd2luZG93U3RhcnQ6IHdlZWtTdGFydCxcbiAgICAgICAgICAgIHdpbmRvd0VuZDogc25hcHNob3QudG9kYXksXG4gICAgICAgICAgICB0YXNrSWRzOiBpZHMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBcIlx1NjYyRlx1NjVGNlx1OTVGNFx1NUI4OVx1NjM5Mlx1NEUwRFx1NTQwOFx1OTAwMlx1MzAwMVx1NEVGQlx1NTJBMVx1NTkyQVx1OTZCRVx1MzAwMVx1NTkxNlx1OTBFOFx1NTM2MFx1NzUyOFx1RkYwQ1x1OEZEOFx1NjYyRlx1NURGMlx1N0VDRlx1NEUwRFx1NjBGM1x1N0VFN1x1N0VFRFx1OEZEOVx1NEUyQVx1NEU2MFx1NjBFRlx1RkYxRlx1NTE0OFx1Nzg2RVx1OEJBNFx1NTM5Rlx1NTZFMFx1NTE4RFx1NjUzOVx1OEJBMVx1NTIxMlx1MzAwMlwiLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgcmVjZW50U2Vzc2lvbnMgPSBkYXRhLnNlc3Npb25zLmZpbHRlcihcbiAgICAocykgPT4gcy5zb3VyY2UgPT09IFwidGltZXJcIiAmJiBzLmVuZGVkQXQgPj0gYXQgLSA3ICogODY0MDAsXG4gICk7XG4gIGNvbnN0IGxhdGUgPSByZWNlbnRTZXNzaW9ucy5maWx0ZXIoKHMpID0+IHtcbiAgICBjb25zdCBob3VyID0gbmV3IERhdGUocy5lbmRlZEF0ICogMTAwMCkuZ2V0SG91cnMoKTtcbiAgICByZXR1cm4gIShob3VyID49IDYgJiYgaG91ciA8IDIzKTtcbiAgfSk7XG4gIGNvbnN0IGRpc3RpbmN0TGF0ZSA9IG5ldyBTZXQobGF0ZS5tYXAoKHMpID0+IGRhdGVBdChzLmVuZGVkQXQpKSk7XG4gIGlmIChkaXN0aW5jdExhdGUuc2l6ZSA+PSAzKSB7XG4gICAgcmVzdWx0LnB1c2goXG4gICAgICBzaWduYWwoXG4gICAgICAgIFwicmh5dGhtL2xhdGVcIixcbiAgICAgICAgXCJyaHl0aG1EcmlmdFwiLFxuICAgICAgICBcIlx1OEZEMVx1NEUwMFx1NTQ2OFx1NTkxQVx1NTkyOVx1NjcwOVx1NkRGMVx1NTkxQ1x1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLFxuICAgICAgICBcIm5vdGljZVwiLFxuICAgICAgICB7XG4gICAgICAgICAgbGF0ZURhdGVzOiBbLi4uZGlzdGluY3RMYXRlXSxcbiAgICAgICAgICBsYXRlU2Vzc2lvbkNvdW50OiBsYXRlLmxlbmd0aCxcbiAgICAgICAgICB3aW5kb3c6IFwiMjM6MDBcdTIwMTMwNjowMCBcdTY3MkNcdTY3M0FcdTY1RjZcdTk1RjRcIixcbiAgICAgICAgICBzYW1wbGVTZXNzaW9uczogcmVjZW50U2Vzc2lvbnMubGVuZ3RoLFxuICAgICAgICB9LFxuICAgICAgICBcIlx1OEZEOVx1NjYyRlx1NEUzNFx1NjVGNlx1NUI4OVx1NjM5Mlx1OEZEOFx1NjYyRlx1N0IyNlx1NTQwOFx1NEY2MFx1NzY4NFx1NEY1Q1x1NjA2Rlx1RkYxRlx1N0VEM1x1NTQwOFx1NEY2MFx1Nzg2RVx1OEJBNFx1NzY4NFx1Nzc2MVx1NzcyMFx1NTQ4Q1x1OEJGRVx1N0EwQlx1NEZFMVx1NjA2Rlx1NTIyNFx1NjVBRFx1RkYwQ1x1NEUwRFx1NEVFNVx1N0VERlx1NEUwMFx1NEY1Q1x1NjA2Rlx1OEJDNFx1NEVGN1x1NzUyOFx1NjIzN1x1MzAwMlwiLFxuICAgICAgKSxcbiAgICApO1xuICB9XG4gIGNvbnN0IHJlY2VudERheXMgPSBbLi4uYnlEYXkua2V5cygpXS5maWx0ZXIoKGQpID0+IGQgPj0gd2Vla1N0YXJ0KS5sZW5ndGg7XG4gIGlmIChoaXN0b3JpY2FsICE9PSBudWxsICYmIHJlY2VudERheXMgPj0gMykge1xuICAgIGNvbnN0IHJlY2VudCA9IFsuLi5ieURheS5lbnRyaWVzKCldXG4gICAgICAuZmlsdGVyKChbZF0pID0+IGQgPj0gd2Vla1N0YXJ0KVxuICAgICAgLm1hcCgoWywgbV0pID0+IG0pO1xuICAgIGlmIChcbiAgICAgIHJlY2VudC5yZWR1Y2UoKG4sIG0pID0+IG4gKyBtLCAwKSAqIDEwMCA8XG4gICAgICBoaXN0b3JpY2FsICogcmVjZW50Lmxlbmd0aCAqIDQwXG4gICAgKSB7XG4gICAgICByZXN1bHQucHVzaChcbiAgICAgICAgc2lnbmFsKFxuICAgICAgICAgIFwiZW5nYWdlbWVudC9kcm9wXCIsXG4gICAgICAgICAgXCJlbmdhZ2VtZW50RHJvcFwiLFxuICAgICAgICAgIFwiXHU4RkQxXHU2NzFGXHU4QkIwXHU1RjU1XHU3Njg0XHU2Mjk1XHU1MTY1XHU2NjBFXHU2NjNFXHU0RTBCXHU5NjREXCIsXG4gICAgICAgICAgXCJub3RpY2VcIixcbiAgICAgICAgICB7XG4gICAgICAgICAgICByZWNlbnRBY3RpdmVEYXlzOiByZWNlbnQubGVuZ3RoLFxuICAgICAgICAgICAgcmVjZW50TWVhbk1pbnV0ZXM6XG4gICAgICAgICAgICAgIHJlY2VudC5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgPyBNYXRoLmZsb29yKHJlY2VudC5yZWR1Y2UoKG4sIG0pID0+IG4gKyBtLCAwKSAvIHJlY2VudC5sZW5ndGgpXG4gICAgICAgICAgICAgICAgOiAwLFxuICAgICAgICAgICAgYmFzZWxpbmVNaW51dGVzOiBoaXN0b3JpY2FsLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgXCJcdTY2MkZcdTU0MjZcdTY3MDlcdTgwMDNcdThCRDVcdTMwMDFcdThCRkVcdTdBMEJcdTMwMDFcdThFQUJcdTRGNTNcdTcyQjZcdTYwMDFcdTYyMTZcdTdFQkZcdTRFMEJcdTVCNjZcdTRFNjBcdTUzRDhcdTUzMTZcdUZGMUZcdTUxNDhcdTg4NjVcdTUxNjhcdThCQjBcdTVGNTVcdTgwQ0NcdTY2NkZcdUZGMENcdTUxOERcdTUxQjNcdTVCOUFcdTY2MkZcdTU0MjZcdThDMDNcdTY1NzRcdTgyODJcdTU5NEZcdTMwMDJcIixcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIHJlc3VsdC5zb3J0KChhLCBiKSA9PiAoYS5rZXkgPCBiLmtleSA/IC0xIDogYS5rZXkgPiBiLmtleSA/IDEgOiAwKSk7XG4gIHJldHVybiByZXN1bHQuc2xpY2UoMCwgMzApO1xufVxuIiwgIi8vISBcdTRFMTNcdTZDRThcdTRGRERcdTYyQTRcdTc2ODRcdTdFQUZcdThCQTFcdTdCOTdcdTkwRThcdTUyMDZcdUZGMUFcdTdBOTdcdTUzRTNcdTk2QzZcdTU0MDhcdTRFMEVcdTc2N0RcdTU0MERcdTUzNTVcdTUyMjRcdTVCOUFcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgY3JhdGVzL2NvcmUvc3JjL2d1YXJkLnJzIFx1NzY4NCBgYWxsb3dlZGAgXHU0RTBFIGd1YXJkX3dpbmRvd3MucnMgXHU3Njg0XG4vLyEgYXBwLWlkIFx1ODlFM1x1Njc5MFx1RkYwOEFVTUlEIC8gQXBwbGljYXRpb25GcmFtZUhvc3QgXHU1MTcxXHU0RUFCIFVXUCBcdTY4NDZcdTY3QjYgLyBcdTVCOENcdTY1NzRcdThGREJcdTdBMEJcdThERUZcdTVGODRcdUZGMDlcdTMwMDJcbi8vISBcdTRFMERcdTUwNUFcdTRFRkJcdTRGNTVcdTY4NENcdTk3NjJcdThDMDNcdTc1MjhcdTIwMTRcdTIwMTRcdTY3OUFcdTRFM0VcdTMwMDFcdTgwNUFcdTcxMjZcdTRFMEVcdTk1MDFcdTVDNEZcdTYyNjdcdTg4NENcdTc1MzFcdTUzOUZcdTc1MUYgZ3VhcmQgXHU4RDFGXHU4RDIzXHUzMDAyXG5cbmltcG9ydCB0eXBlIHsgUHJvdGVjdGlvbiwgV2luZG93IH0gZnJvbSBcIi4vbW9kZWxcIjtcblxuLyoqXG4gKiBcdTc2N0RcdTU0MERcdTUzNTVcdTUyMjRcdTVCOUFcdUZGMDhndWFyZDo6YWxsb3dlZFx1RkYwOVx1RkYxQVxuICogXHU2NzJDXHU4RkRCXHU3QTBCXHU3QTk3XHU1M0UzXHU1OUNCXHU3RUM4XHU2NTNFXHU4ODRDXHVGRjFCb2ZmIFx1NjUzRVx1ODg0Q1x1NEUwMFx1NTIwN1x1RkYxQndoaXRlbGlzdCBcdTdDQkVcdTc4NkVcdTUzMzlcdTkxNEQgYXBwSWRcdUZGMUJcbiAqIGxvY2sgXHU1RkZEXHU3NTY1XHU3NjdEXHU1NDBEXHU1MzU1XHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhbGxvd2VkKFxuICB3aW5kb3c6IFdpbmRvdyxcbiAgb3duUGlkOiBudW1iZXIsXG4gIHByb3RlY3Rpb246IFByb3RlY3Rpb24sXG4pOiBib29sZWFuIHtcbiAgaWYgKHdpbmRvdy5waWQgIT09IG51bGwgJiYgd2luZG93LnBpZCA9PT0gb3duUGlkKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIChcbiAgICBwcm90ZWN0aW9uLm1vZGUgPT09IFwib2ZmXCIgfHxcbiAgICAocHJvdGVjdGlvbi5tb2RlID09PSBcIndoaXRlbGlzdFwiICYmXG4gICAgICB3aW5kb3cuYXBwSWQgIT09IG51bGwgJiZcbiAgICAgIHByb3RlY3Rpb24ud2hpdGVsaXN0LnNvbWUoKGFsbG93ZWRJZCkgPT4gYWxsb3dlZElkID09PSB3aW5kb3cuYXBwSWQpKVxuICApO1xufVxuXG4vKiogVVdQIFx1NUU5NFx1NzUyOFx1NUMwMVx1ODhDNVx1NEUzQSBgYXVtaWQ6e2lkfWBcdUZGMDhndWFyZF93aW5kb3dzOjppZGVudGl0eVx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEF1bWlkKGlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYGF1bWlkOiR7aWR9YDtcbn1cblxuLyoqXG4gKiBBcHBsaWNhdGlvbkZyYW1lSG9zdC5leGUgXHU2NjJGXHU1MTcxXHU0RUFCXHU2ODQ2XHU2N0I2XHU4RkRCXHU3QTBCXHVGRjFBXHU1QjgzXHU2NzJDXHU4RUFCXHU0RTBEXHU0RUUzXHU4ODY4XHU0RUZCXHU0RjU1XHU0RTAwXHU0RTJBXHU2MjU4XHU3QkExXHU1RTk0XHU3NTI4XHVGRjBDXG4gKiBcdTYzODhcdTRFODhcdTVCODNcdTdCNDlcdTRFOEVcdTY1M0VcdTg4NENcdTUxNjhcdTkwRTggVVdQIFx1NUU5NFx1NzUyOFx1MzAwMlx1NTIyNFx1NjVBRFx1NjMwOVx1NUI4Q1x1NjU3NFx1OERFRlx1NUY4NFx1NzY4NFx1NjcwMFx1NTQwRVx1NEUwMFx1NkJCNVx1MzAwMVx1NEUwRFx1NTMzQVx1NTIwNlx1NTkyN1x1NUMwRlx1NTE5OVx1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNBcHBsaWNhdGlvbkZyYW1lSG9zdChwcm9jZXNzUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IG5hbWUgPSBwcm9jZXNzUGF0aC5zcGxpdCgvW1xcXFwvXS8pLnBvcCgpID8/IFwiXCI7XG4gIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwiYXBwbGljYXRpb25mcmFtZWhvc3QuZXhlXCI7XG59XG5cbi8qKlxuICogXHU1MTcxXHU0RUFCXHU2ODQ2XHU2N0I2XHU3QTk3XHU1M0UzXHU3Njg0XHU2MjU4XHU3QkExXHU1RTk0XHU3NTI4XHU5MDA5XHU2MkU5XHVGRjFBXHU1M0Q2XHU3QjJDXHU0RTAwXHU0RTJBXHU3QzdCXHU1NDBEXHU0RTNBXG4gKiBgV2luZG93cy5VSS5Db3JlLkNvcmVXaW5kb3dgIFx1NEUxNCBQSUQgXHUyMjYwIFx1NUJCRlx1NEUzQiBQSUQgXHU3Njg0XHU1QjUwXHU3QTk3XHU1M0UzXG4gKiBcdUZGMDhndWFyZF93aW5kb3dzOjpjb250ZW50XHVGRjA5XHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZWxlY3RGcmFtZUNvbnRlbnRQaWQoXG4gIGhvc3RQaWQ6IG51bWJlcixcbiAgY2hpbGRyZW46IHsgY2xhc3NOYW1lOiBzdHJpbmc7IHBpZDogbnVtYmVyIH1bXSxcbik6IG51bWJlciB8IG51bGwge1xuICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgaWYgKFxuICAgICAgY2hpbGQuY2xhc3NOYW1lID09PSBcIldpbmRvd3MuVUkuQ29yZS5Db3JlV2luZG93XCIgJiZcbiAgICAgIGNoaWxkLnBpZCAhPT0gMCAmJlxuICAgICAgY2hpbGQucGlkICE9PSBob3N0UGlkXG4gICAgKSB7XG4gICAgICByZXR1cm4gY2hpbGQucGlkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cbiIsICIvLyEgRW5naW5lXHVGRjFBXHU5ODg0XHU2OEMwL1x1NjNEMFx1NEVBNC9cdTYzMDFcdTRFNDVcdTUzMTYvXHU1RkVCXHU3MTY3XHUzMDAyXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9saWIucnMgXHU3Njg0IEVuZ2luZVx1MzAwMlxuLy8hXG4vLyEgXHU2MzAxXHU0RTQ1XHU1MzE2XHVGRjFBXHU2NUU3XHU1RjE1XHU2NENFXHU3NTI4IFNRTGl0ZVx1RkYxQlx1NjVCMFx1NjdCNlx1Njc4NFx1RkYwOE1JR1JBVElPTi5tZC9BUEkubWRcdUZGMDlcdTRFRTUgSlNPTiBcdTY1ODdcdTRFRjZcdTRFM0FcdTU1MkZcdTRFMDBcdTY1NzBcdTYzNkVcdTZFOTBcdTMwMDJcbi8vISBcdTY3MkNcdTVCOUVcdTczQjBcdTY3MDlcdTRFMjRcdTc5Q0RcdTVCNThcdTUwQThcdTUxNjVcdTUzRTNcdUZGMUFcbi8vISAtIGBFbmdpbmUub3BlbihwYXRoKWBcdUZGMUFcdTUzNTUgSlNPTiBcdTY1ODdcdTRFRjZcdUZGMDhcdTUzOUZcdTVCNTBcdTUxOTlcdUZGMDlcdUZGMENcdTVCRjlcdTVFOTRcdTY1RTcgRW5naW5lOjpvcGVuKHBhdGgpXHVGRjFCXG4vLyEgLSBgRW5naW5lLmZyb21EYXRhKGRhdGEsIHNhdmUpYFx1RkYxQVx1OEMwM1x1NzUyOFx1NjVCOVx1ODFFQVx1NUUyNlx1NUI1OFx1NTBBOFx1RkYwOHJ1bnRpbWUgXHU3NTI4XHU1QjgzXHU2MjhBXHU1NDBDXHU0RTAwXHU0RUZEIEFwcERhdGFcbi8vISAgIFx1NjJDNlx1NjIxMCBwbGFuLmpzb24vc3RhdGUuanNvbiBcdTRFMjRcdTRFMkFcdTY1ODdcdTRFRjZcdUZGMDlcdTMwMDJcdTVCNThcdTUwQThcdTdCNTZcdTc1NjVcdTUzRUFcdTVGNzFcdTU0Q0RcdTg0M0RcdTc2RDhcdTY1QjlcdTVGMEZcdUZGMENcdTY4MjFcdTlBOENcdTMwMDFcdThFQUJcdTRFRkRcdTc2N0JcdThCQjBcdTMwMDFcbi8vISAgIFx1NjU1OVx1NUI2Nlx1OEY2Q1x1NzlGQlx1NEUwRVx1NEZERFx1NjJBNFx1ODlDNFx1NTIxOVx1NUI4Q1x1NTE2OFx1NTE3MVx1NzUyOFx1MzAwMlxuXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIHdyaXRlRmlsZVN5bmMsIG1rZGlyU3luYywgcmVuYW1lU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgQXBwRXJyb3IsIGNsb25lIH0gZnJvbSBcIi4vZXJyb3JzXCI7XG5pbXBvcnQgdHlwZSB7IEFjdGlvbiB9IGZyb20gXCIuL2xpYlwiO1xuaW1wb3J0IHsgQXBwRGF0YSB9IGZyb20gXCIuL2xpYlwiO1xuaW1wb3J0IHsgZGF0ZUF0IH0gZnJvbSBcIi4vdGltZVwiO1xuaW1wb3J0IHsgcmVjb25jaWxlSWRlbnRpdGllcywgdmFsaWRhdGVJZGVudGl0aWVzIH0gZnJvbSBcIi4vaWRlbnRpdGllc1wiO1xuaW1wb3J0IHsgcmVhZExvY2FsRGF0YSB9IGZyb20gXCIuL21pZ3JhdGlvblwiO1xuaW1wb3J0IHsgc3VtbWFyaWVzIH0gZnJvbSBcIi4vbGVhcm5pbmdcIjtcbmltcG9ydCB7IHZhbGlkYXRlRWR1Y2F0aW9uVHJhbnNpdGlvbiB9IGZyb20gXCIuL2VkdWNhdGlvblwiO1xuaW1wb3J0IHsgcmVsZWFzZUxvY2sgfSBmcm9tIFwiLi9sb2NrXCI7XG5pbXBvcnQgdHlwZSB7IFNuYXBzaG90LCBUYXNrS2luZCB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBraW5kT2YgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgdGltZXJSZW1haW5pbmcgfSBmcm9tIFwiLi9yZW1pbmRlcnNcIjtcbmltcG9ydCB7IHBhcnNlQXBwRGF0YSwgc2VyaWFsaXplQXBwRGF0YSwgc2VyaWFsaXplVGFzayB9IGZyb20gXCIuL2xpYlwiO1xuXG4vKiogXHU4NDNEXHU3NkQ4XHU1NkRFXHU4QzAzXHVGRjFBXHU2NTM2XHU1MjMwXHU3Njg0XHU2NjJGXHU1REYyXHU3RUNGXHU4RkM3XHU2ODIxXHU5QThDXHU3Njg0IEFwcERhdGFcdUZGMUJcdTU2REVcdThDMDNcdTVGQzVcdTk4N0JcdTUzOUZcdTVCNTBcdTY2RkZcdTYzNjJcdTgxRUFcdTVERjFcdTc2ODRcdTVCNThcdTUwQThcdTMwMDIgKi9cbmV4cG9ydCB0eXBlIEVuZ2luZVBlcnNpc3QgPSAoZGF0YTogQXBwRGF0YSkgPT4gdm9pZDtcblxuLyoqIFx1NTM1NVx1NjU4N1x1NEVGNlx1NUI1OFx1NTBBOFx1RkYxQVx1NEUzNFx1NjVGNlx1NjU4N1x1NEVGNiArIHJlbmFtZVx1RkYwQ1x1NEZERFx1OEJDMVx1OEJGQlx1ODAwNVx1NTNFQVx1NzcwQlx1NTIzMFx1NjVFN1x1NTE4NVx1NUJCOVx1NjIxNlx1NjVCMFx1NTE4NVx1NUJCOVx1MzAwMiAqL1xuZnVuY3Rpb24gd3JpdGVBdG9taWMocGF0aDogc3RyaW5nLCBkYXRhOiBBcHBEYXRhKTogdm9pZCB7XG4gIGNvbnN0IHJhdyA9IEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZUFwcERhdGEoZGF0YSksIG51bGwsIDIpO1xuICBjb25zdCB0bXAgPSBgJHtwYXRofS50bXBgO1xuICB3cml0ZUZpbGVTeW5jKHRtcCwgcmF3LCBcInV0ZjhcIik7XG4gIHJlbmFtZVN5bmModG1wLCBwYXRoKTtcbn1cblxuZXhwb3J0IGNsYXNzIEVuZ2luZSB7XG4gIHBhdGg6IHN0cmluZztcbiAgZGF0YTogQXBwRGF0YTtcbiAgcHJpdmF0ZSByZWFkb25seSBzYXZlOiBFbmdpbmVQZXJzaXN0O1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocGF0aDogc3RyaW5nLCBkYXRhOiBBcHBEYXRhLCBzYXZlOiBFbmdpbmVQZXJzaXN0KSB7XG4gICAgdGhpcy5wYXRoID0gcGF0aDtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIHRoaXMuc2F2ZSA9IHNhdmU7XG4gIH1cblxuICAvKiogXHU2ODRDXHU5NzYyXHU5MDAyXHU5MTREXHU1QzQyXHU0RTEzXHU3NTI4XHVGRjFBXHU1NDA4XHU2MjEwXHU1NjY4XHU2NTQ1XHU5NjlDXHU1NDBFXHU1RjNBXHU1MjM2XHU4OUUzXHU5NjY0XHU0RkREXHU2MkE0XHVGRjFCXHU0RTBEXHU2NjJGXHU1QkY5XHU1OTE2IEFjdGlvblx1MzAwMiAqL1xuICByZWxlYXNlRmFpbGVkUHJvdGVjdGlvbihhdDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgbmV4dCA9IGNsb25lKHRoaXMuZGF0YSk7XG4gICAgbmV4dC5yZWNvcmQoYXQsIGZhbHNlKTtcbiAgICBuZXh0LnJlc2V0VG8oXCJmb2N1c1wiKTtcbiAgICByZWxlYXNlTG9jayhuZXh0LmxvY2ssIGF0KTtcbiAgICBuZXh0LnZhbGlkYXRlKCk7XG4gICAgdGhpcy5wZXJzaXN0KG5leHQpO1xuICAgIHRoaXMuZGF0YSA9IG5leHQ7XG4gIH1cblxuICAvKipcbiAgICogXHU2NUU3IHJ1bnRpbWUgXHU3Njg0XHUzMDBDXHU2NTNFXHU1RjAzXHU1RjUzXHU1MjREXHU3NTZBXHU4MzA0XHUzMDBEXHVGRjFBXHU0RTBEXHU1MTk5XHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XHVGRjBDXHU1M0VBXHU1NkRFXHU1MjMwXHU3QTdBXHU5NUYyXHU0RTEzXHU2Q0U4XHUzMDAyXG4gICAqIFx1NEZERFx1NjJBNFx1NzUxRlx1NjU0OFx1NjVGNlx1NjJEMlx1N0VERFx1RkYwOFx1NEUwRVx1NTE3Nlx1NUI4M1x1NTE5OVx1NTJBOFx1NEY1Q1x1NTQwQ1x1NEUwMFx1ODlDNFx1NTIxOVx1RkYxQVx1NEUwRFx1ODBGRFx1NTAxRlx1NjUzRVx1NUYwM1x1N0VENVx1NUYwMFx1OTUwMVx1NUI5QVx1RkYwOVx1MzAwMlxuICAgKi9cbiAgZGlzY2FyZFRpbWVyKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmRhdGEuc3RyaWN0UHJvdGVjdGVkKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEUyNVx1NjgzQ1x1NkEyMVx1NUYwRlx1NzUxRlx1NjU0OFx1NEUyRFx1RkYwQ1x1NEUwRFx1ODBGRFx1NjNEMFx1NTI0RFx1N0VEM1x1Njc1Rlx1NjIxNlx1NEZFRVx1NjUzOVx1RkYxQlx1NTIzMFx1NjVGNlx1ODFFQVx1NTJBOFx1ODlFM1x1OTY2NFwiKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZGF0YS5wcm90ZWN0ZWQoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICBcIlx1NEUxM1x1NkNFOFx1NEZERFx1NjJBNFx1NEUyRFx1RkYwQ1x1N0VEM1x1Njc1Rlx1NTI0RFx1NEUwRFx1ODBGRFx1NEZFRVx1NjUzOVx1NEVGQlx1NTJBMVx1NjIxNlx1OEJBMVx1NjVGNlx1RkYxQlx1NTNFRlx1NjNEMFx1NTI0RFx1NUI4Q1x1NjIxMFx1NzU2QVx1ODMwNFx1NjIxNlx1N0QyN1x1NjAyNVx1OTAwMFx1NTFGQVwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgbmV4dCA9IGNsb25lKHRoaXMuZGF0YSk7XG4gICAgbmV4dC5yZXNldFRvKFwiZm9jdXNcIik7XG4gICAgbmV4dC52YWxpZGF0ZSgpO1xuICAgIHRoaXMucGVyc2lzdChuZXh0KTtcbiAgICB0aGlzLmRhdGEgPSBuZXh0O1xuICB9XG5cbiAgc3RhdGljIG9wZW4ocGF0aDogc3RyaW5nKTogRW5naW5lIHtcbiAgICBsZXQgcmF3OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBpZiAocGF0aCAhPT0gXCI6bWVtb3J5OlwiKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBkaXJuYW1lKHBhdGgpO1xuICAgICAgaWYgKHBhcmVudCAhPT0gXCIuXCIgJiYgcGFyZW50ICE9PSBcIlwiKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbWtkaXJTeW5jKHBhcmVudCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoU3RyaW5nKGUpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgcmF3ID0gcmVhZEZpbGVTeW5jKHBhdGgsIFwidXRmOFwiKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKChlIGFzIE5vZGVKUy5FcnJub0V4Y2VwdGlvbikuY29kZSAhPT0gXCJFTk9FTlRcIikge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihTdHJpbmcoZSkpO1xuICAgICAgICB9XG4gICAgICAgIHJhdyA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBkYXRhOiBBcHBEYXRhO1xuICAgIGlmIChyYXcgIT09IG51bGwpIHtcbiAgICAgIGRhdGEgPSByZWFkTG9jYWxEYXRhKHJhdyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRhdGEgPSBuZXcgQXBwRGF0YSgpO1xuICAgIH1cbiAgICByZWNvbmNpbGVJZGVudGl0aWVzKGNsb25lKGRhdGEpLCBkYXRhLCBudWxsKTtcbiAgICBkYXRhLnZhbGlkYXRlKCk7XG4gICAgY29uc3QgZW5naW5lID0gbmV3IEVuZ2luZShcbiAgICAgIHBhdGgsXG4gICAgICBkYXRhLFxuICAgICAgcGF0aCA9PT0gXCI6bWVtb3J5OlwiXG4gICAgICAgID8gKCkgPT4ge31cbiAgICAgICAgOiAobmV4dDogQXBwRGF0YSkgPT4gd3JpdGVBdG9taWMocGF0aCwgbmV4dCksXG4gICAgKTtcbiAgICBlbmdpbmUucGVyc2lzdChlbmdpbmUuZGF0YSk7XG4gICAgcmV0dXJuIGVuZ2luZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBcdTc1MjhcdThDMDNcdTc1MjhcdTY1QjlcdTUyQTBcdThGN0RcdTU5N0RcdTc2ODRcdTY1NzBcdTYzNkVcdTVFRkFcdTVGMTVcdTY0Q0VcdUZGMENcdTVFNzZcdTRFRTVcdThDMDNcdTc1MjhcdTY1QjlcdTdFRDlcdTc2ODQgYHNhdmVgIFx1ODQzRFx1NzZEOFx1MzAwMlxuICAgKiBcdTY1NzBcdTYzNkVcdTRFQ0RcdThENzBcdTU0MENcdTRFMDBcdTU5NTdcdThFQUJcdTRFRkRcdTc2N0JcdThCQjBcdTRFMEVcdTUxNjhcdTkxQ0ZcdTY4MjFcdTlBOENcdUZGMUJgc2F2ZWAgXHU2MjlCXHU5NTE5XHU0RjFBXHU1MzlGXHU2ODM3XHU0RjIwXHU1MUZBXHVGRjBDXHU1MkEwXHU4RjdEXHU1OTMxXHU4RDI1XHU2NUY2XG4gICAqIFx1OEMwM1x1NzUyOFx1NjVCOVx1NTZFMFx1NkI2NFx1NEUwRFx1NEYxQVx1ODk4Nlx1NzZENlx1NjVFN1x1NjU4N1x1NEVGNlx1MzAwMlxuICAgKi9cbiAgc3RhdGljIGZyb21EYXRhKFxuICAgIGRhdGE6IEFwcERhdGEsXG4gICAgc2F2ZTogRW5naW5lUGVyc2lzdCxcbiAgICBwYXRoID0gXCI6bWVtb3J5OlwiLFxuICApOiBFbmdpbmUge1xuICAgIGNvbnN0IG5leHQgPSBjbG9uZShkYXRhKTtcbiAgICByZWNvbmNpbGVJZGVudGl0aWVzKGNsb25lKGRhdGEpLCBuZXh0LCBudWxsKTtcbiAgICBuZXh0LnZhbGlkYXRlKCk7XG4gICAgY29uc3QgZW5naW5lID0gbmV3IEVuZ2luZShwYXRoLCBuZXh0LCBzYXZlKTtcbiAgICBlbmdpbmUucGVyc2lzdChlbmdpbmUuZGF0YSk7XG4gICAgcmV0dXJuIGVuZ2luZTtcbiAgfVxuXG4gIHByaXZhdGUgcGVyc2lzdChkYXRhOiBBcHBEYXRhKTogdm9pZCB7XG4gICAgdGhpcy5zYXZlKGRhdGEpO1xuICB9XG5cbiAgLyoqIFx1NEUwRSBkaXNwYXRjaCBcdTc2RjhcdTU0MENcdTc2ODRcdThFQUJcdTRFRkQvXHU1Mzg2XHU1M0YyXHU4OUM0XHU1MjE5XHVGRjBDXHU0RjQ2XHU0RTBEXHU2MzAxXHU0RTQ1XHU1MzE2XHVGRjFBXHU3NTI4XHU0RThFXHU1QkExXHU5NjA1XHU2NTg3XHU0RUY2XHUzMDAyICovXG4gIHByZXZpZXdBY3Rpb24oYWN0aW9uOiBBY3Rpb24sIGF0OiBudW1iZXIpOiBBcHBEYXRhIHtcbiAgICBjb25zdCByZXN0b3JlSWQgPSAoKCkgPT4ge1xuICAgICAgaWYgKGFjdGlvbi50eXBlID09PSBcInJlc3RvcmVUYXNrXCIpIHtcbiAgICAgICAgY29uc3QgcmVjb3JkID0gdGhpcy5kYXRhLmlkZW50aXRpZXMuZmluZChcbiAgICAgICAgICAocikgPT4gci5pZCA9PT0gYWN0aW9uLnRhc2suaWQgJiYgci5yZXRpcmVkICYmIHIua2luZCA9PT0gXCJ0YXNrXCIsXG4gICAgICAgICk7XG4gICAgICAgIGlmIChyZWNvcmQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NkNBMVx1NjcwOVx1NUJGOVx1NUU5NFx1NzY4NFx1NTM5Rlx1NEVGQlx1NTJBMVx1NjA2Mlx1NTkwRFx1OEJCMFx1NUY1NVwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVjb3JkLnJlc3RvcmVUYXNrICE9PSBKU09OLnN0cmluZ2lmeShzZXJpYWxpemVUYXNrKGFjdGlvbi50YXNrKSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTYwNjJcdTU5MERcdTUxODVcdTVCQjlcdTRFMEVcdTUzOUZcdTRFRkJcdTUyQTFcdTRFMERcdTRFMDBcdTgxRjRcdUZGMENcdTUzODZcdTUzRjIgSUQgXHU0RTBEXHU4MEZEXHU1OTBEXHU3NTI4XCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhY3Rpb24udGFzay5pZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0pKCk7XG4gICAgY29uc3QgbmV4dCA9IGNsb25lKHRoaXMuZGF0YSk7XG4gICAgLy8gYXBwbHkgXHU1MTg1XHU5MEU4XHU1REYyXHU1MDVBXHU1MTY4XHU5MUNGXHU2ODIxXHU5QThDXHVGRjFCcmVjb25jaWxlIFx1NTNFQVx1NjUzOSBpZGVudGl0aWVzXHVGRjBDXHU1MThEXHU5QThDXHU4RUFCXHU0RUZEXHU1MzczXHU1M0VGXHVGRjBDXG4gICAgLy8gXHU5MDdGXHU1MTREXHU1QkY5XHU2NTU5XHU1QjY2XHU4QkIwXHU1RjU1XHU1Rjg4XHU1OTFBXHU3Njg0XHU1RTkzXHU2QkNGXHU2QjIxXHU1MkE4XHU0RjVDXHU5MUNEXHU1OTBEXHU4REQxXHU0RTAwXHU5MDREXHU2NjAyXHU4RDM1XHU2ODIxXHU5QThDXHUzMDAyXG4gICAgbmV4dC5hcHBseShhY3Rpb24sIGF0KTtcbiAgICB2YWxpZGF0ZUVkdWNhdGlvblRyYW5zaXRpb24odGhpcy5kYXRhLmVkdWNhdGlvbiwgbmV4dC5lZHVjYXRpb24pO1xuICAgIHJlY29uY2lsZUlkZW50aXRpZXModGhpcy5kYXRhLCBuZXh0LCByZXN0b3JlSWQpO1xuICAgIHZhbGlkYXRlSWRlbnRpdGllcyhuZXh0KTtcbiAgICByZXR1cm4gbmV4dDtcbiAgfVxuXG4gIC8qKiBcdTUzRUFcdTYzQThcdThGREJcdTY1RjZcdTk1RjRcdUZGMDhcdThCQTFcdTY1RjYvXHU2M0QwXHU5MTkyL1x1OTUwMVx1NjczQS9cdTgxRUFcdTUyQThcdTVGMDBcdTVERTVcdUZGMDlcdUZGMENcdTRFMERcdTc1MUZcdTYyMTBcdTVGRUJcdTcxNjdcdTdFREZcdThCQTFcdUZGMUJcdTZCQ0ZcdTc5RDIgdGljayBcdTc1MjhcdTMwMDIgKi9cbiAgdGljayhhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbmV4dCA9IGNsb25lKHRoaXMuZGF0YSk7XG4gICAgaWYgKCFuZXh0LnRpY2soYXQpKSByZXR1cm4gZmFsc2U7XG4gICAgcmVjb25jaWxlSWRlbnRpdGllcyh0aGlzLmRhdGEsIG5leHQsIG51bGwpO1xuICAgIG5leHQudmFsaWRhdGUoKTtcbiAgICB0aGlzLnBlcnNpc3QobmV4dCk7XG4gICAgdGhpcy5kYXRhID0gY2xvbmUobmV4dCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBkaXNwYXRjaChhY3Rpb246IEFjdGlvbiwgYXQ6IG51bWJlcik6IFNuYXBzaG90IHtcbiAgICBjb25zdCBuZXh0ID0gdGhpcy5wcmV2aWV3QWN0aW9uKGFjdGlvbiwgYXQpO1xuICAgIHRoaXMucGVyc2lzdChuZXh0KTtcbiAgICB0aGlzLmRhdGEgPSBuZXh0O1xuICAgIHJldHVybiB0aGlzLnNuYXBzaG90KGF0KTtcbiAgfVxuXG4gIHNuYXBzaG90KGF0OiBudW1iZXIpOiBTbmFwc2hvdCB7XG4gICAgY29uc3QgbmV4dCA9IGNsb25lKHRoaXMuZGF0YSk7XG4gICAgaWYgKG5leHQudGljayhhdCkpIHtcbiAgICAgIHJlY29uY2lsZUlkZW50aXRpZXModGhpcy5kYXRhLCBuZXh0LCBudWxsKTtcbiAgICAgIG5leHQudmFsaWRhdGUoKTtcbiAgICAgIHRoaXMucGVyc2lzdChuZXh0KTtcbiAgICAgIC8vIFx1NTNFQVx1NjcwOVx1NzcxRlx1NkI2M1x1NTNEOFx1NTMxNlx1NjI0RFx1OEZEQlx1OEZEOVx1NEUyQVx1NTIwNlx1NjUyRlx1RkYxQVx1NzBFRFx1OERFRlx1NUY4NFx1NkJDRlx1NzlEMlx1NEUwMFx1NkIyMVx1NTE0Qlx1OTY4Nlx1MzAwMlxuICAgICAgdGhpcy5kYXRhID0gY2xvbmUobmV4dCk7XG4gICAgfVxuICAgIGNvbnN0IGtpbmRzOiBSZWNvcmQ8c3RyaW5nLCBUYXNrS2luZD4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IHQgb2YgdGhpcy5kYXRhLnRhc2tzKSB7XG4gICAgICBraW5kc1t0LmlkXSA9IGtpbmRPZih0KTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHRhc2tLaW5kczoga2luZHMsXG4gICAgICByZW1haW5pbmdTZWNzOiB0aW1lclJlbWFpbmluZyh0aGlzLmRhdGEudGltZXIsIGF0KSxcbiAgICAgIHN0YXRzOiB0aGlzLmRhdGEuc3RhdHMoYXQpLFxuICAgICAgc3R1ZHlQcm9ncmVzczogc3VtbWFyaWVzKG5leHQsIGF0KSxcbiAgICAgIGRhdGE6IG5leHQsXG4gICAgICB0b2RheTogZGF0ZUF0KGF0KSxcbiAgICAgIHNlcnZlclRpbWU6IGF0LFxuICAgIH07XG4gIH1cblxuICBleHBvcnQoYXQ6IG51bWJlcik6IHN0cmluZyB7XG4gICAgdGhpcy5zbmFwc2hvdChhdCk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZUFwcERhdGEodGhpcy5kYXRhKSwgbnVsbCwgMik7XG4gIH1cbn1cblxuLy8gcGFyc2VBcHBEYXRhIFx1NEY5Qlx1OEZEMFx1ODg0Q1x1NjVGNlx1NEVDRSBKU09OIFx1NzZGNFx1NjNBNVx1Njc4NFx1OTAyMFx1NjU3MFx1NjM2RVx1RkYwOFx1NjgyMVx1OUE4Q1x1NTE2NVx1NTNFM1x1ODlDMSBsaWIudHMgXHU0RTBFIGluZGV4LnRzXHVGRjA5XHUzMDAyXG5leHBvcnQgeyBwYXJzZUFwcERhdGEgfTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFJTyxJQUFNLFdBQU4sY0FBdUIsTUFBTTtBQUFBLEVBQ2xDLFlBQVksU0FBaUI7QUFDM0IsVUFBTSxPQUFPO0FBQ2IsU0FBSyxPQUFPO0FBQUEsRUFDZDtBQUNGO0FBRU8sU0FBUyxPQUFPLElBQWEsU0FBNkI7QUFDL0QsTUFBSSxDQUFDLEdBQUksT0FBTSxJQUFJLFNBQVMsT0FBTztBQUNyQztBQUdPLFNBQVNBLFNBQVcsT0FBNkIsU0FBb0I7QUFDMUUsTUFBSSxVQUFVLFFBQVEsVUFBVSxPQUFXLE9BQU0sSUFBSSxTQUFTLE9BQU87QUFDckUsU0FBTztBQUNUO0FBR08sU0FBUyxVQUFVLEdBQW1CO0FBQzNDLFNBQU8sTUFBTSxLQUFLLENBQUMsRUFBRTtBQUN2QjtBQUdPLFNBQVMsUUFBUSxHQUFtQjtBQUN6QyxNQUFJLE9BQU8sZ0JBQWdCLGFBQWE7QUFDdEMsV0FBTyxJQUFJLFlBQVksRUFBRSxPQUFPLENBQUMsRUFBRTtBQUFBLEVBQ3JDO0FBRUEsU0FBTyxVQUFVLENBQUMsSUFBSTtBQUN4QjtBQUdPLFNBQVMsTUFBUyxPQUFhO0FBQ3BDLE1BQUksTUFBTSxRQUFRLEtBQUssR0FBRztBQUN4QixXQUFPLE1BQU0sSUFBSSxDQUFDLE1BQU0sTUFBTSxDQUFDLENBQUM7QUFBQSxFQUNsQztBQUNBLE1BQUksVUFBVSxRQUFRLE9BQU8sVUFBVSxVQUFVO0FBQy9DLFVBQU0sTUFBTSxPQUFPLE9BQU8sT0FBTyxlQUFlLEtBQUssQ0FBQztBQUl0RCxlQUFXLE9BQU8sT0FBTyxLQUFLLEtBQUssR0FBRztBQUNwQyxVQUFJLEdBQUcsSUFBSSxNQUFPLE1BQWtDLEdBQUcsQ0FBQztBQUFBLElBQzFEO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFDQSxTQUFPO0FBQ1Q7QUFHTyxTQUFTLFVBQVUsR0FBWSxHQUFx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QWUsS0FBSyxLQUFLLE9BQU8sRUFBRTtBQUFBLE1BQ2pELE9BQU8sS0FBSyxLQUFLLE1BQU0sRUFBRTtBQUFBLE1BQ3pCLGVBQWUsVUFBVSxNQUFNLEVBQUU7QUFBQSxNQUNqQyxNQUFNO0FBQUEsTUFDTixPQUFPLE9BQU8sRUFBRTtBQUFBLE1BQ2hCLFlBQVk7QUFBQSxJQUNkO0FBQUEsRUFDRjtBQUFBLEVBRUEsT0FBTyxJQUFvQjtBQUN6QixTQUFLLFNBQVMsRUFBRTtBQUNoQixXQUFPLEtBQUssVUFBVSxpQkFBaUIsS0FBSyxJQUFJLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDNUQ7QUFDRjsiLAogICJuYW1lcyI6IFsicmVxdWlyZSIsICJhbGxvd2VkIiwgInRpbWVzIiwgInMiLCAiaWQiLCAicmVxdWlyZSIsICJpZCIsICJleGFtRGVhZGxpbmUiLCAiaWQiLCAiYSIsICJiIiwgImlkIiwgImlkIiwgImlkIiwgInQiLCAiaXNPYmplY3QiLCAid2Vla1N0YXJ0IiwgImJhbmQiLCAiaWQiLCAiaWQiXQp9Cg==
