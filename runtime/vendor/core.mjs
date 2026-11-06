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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZXJyb3JzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2lkcy50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy90aW1lLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL21vZGVsLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2pzb24udHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvbG9jay50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9ibG9ja3MudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvaGFiaXRzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbWluZGVycy50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy90ZW1wbGF0ZXMudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvbGVhcm5pbmcudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZWR1Y2F0aW9uLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3RlYWNoaW5nX3Rhc2tzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2lkZW50aXRpZXMudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcGxhbi50cyIsICIuLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9saWIudHMiLCAiLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvbWlncmF0aW9uLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2RpYWdub3N0aWNzLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2d1YXJkLnRzIiwgIi4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2VuZ2luZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8hIFx1OTUxOVx1OEJFRlx1N0VBNlx1NUI5QVx1RkYxQVJ1c3QgXHU0RkE3IGBBcHBSZXN1bHQ8VD4gPSBSZXN1bHQ8VCwgU3RyaW5nPmBcdUZGMENcdThGRDlcdTkxQ0NcdTdFREZcdTRFMDBcdTY1MzlcdTRFM0FcdTYyOUJcdTUxRkFcbi8vISBgQXBwRXJyb3JgXHVGRjA4bWVzc2FnZSBcdTUzNzMgUnVzdCBcdTc2ODRcdTRFMkRcdTY1ODdcdTk1MTlcdThCRUZcdTY1ODdcdTY4NDhcdUZGMENcdTZENEJcdThCRDVcdTkwMTBcdTVCNTdcdTY1QURcdThBMDBcdUZGMDlcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgUnVzdCBcdTc2ODQgYG9rX29yKG1zZylgIFx1NTM3MyBgdGhyb3cgbmV3IEFwcEVycm9yKG1zZylgXHUzMDAyXG5cbmV4cG9ydCBjbGFzcyBBcHBFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJBcHBFcnJvclwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbnN1cmUob2s6IGJvb2xlYW4sIG1lc3NhZ2U6IHN0cmluZyk6IGFzc2VydHMgb2sge1xuICBpZiAoIW9rKSB0aHJvdyBuZXcgQXBwRXJyb3IobWVzc2FnZSk7XG59XG5cbi8qKiBcdTVCRjkgZmluZC9tYXAuZ2V0IFx1N0I0OVx1NTNFRlx1N0E3QVx1N0VEM1x1Njc5Q1x1NTA1QVx1NjUzNlx1N0E4NFx1RkYxQVJ1c3QgYG9rX29yKG1zZyk/YCBcdTc2ODRcdTc2RjRcdTYzQTVcdTVCRjlcdTVFOTRcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlPFQ+KHZhbHVlOiBUIHwgbnVsbCB8IHVuZGVmaW5lZCwgbWVzc2FnZTogc3RyaW5nKTogVCB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgQXBwRXJyb3IobWVzc2FnZSk7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqIFx1NUI1N1x1N0IyNlx1NjU3MFx1RkYwOFVuaWNvZGUgXHU3ODAxXHU3MEI5XHVGRjA5XHVGRjBDXHU1QkY5XHU1RTk0IFJ1c3QgYHMuY2hhcnMoKS5jb3VudCgpYFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoYXJDb3VudChzOiBzdHJpbmcpOiBudW1iZXIge1xuICByZXR1cm4gQXJyYXkuZnJvbShzKS5sZW5ndGg7XG59XG5cbi8qKiBVVEYtOCBcdTVCNTdcdTgyODJcdTY1NzBcdUZGMENcdTVCRjlcdTVFOTQgUnVzdCBgcy5sZW4oKWBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB1dGY4TGVuKHM6IHN0cmluZyk6IG51bWJlciB7XG4gIGlmICh0eXBlb2YgVGV4dEVuY29kZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXR1cm4gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHMpLmxlbmd0aDtcbiAgfVxuICAvLyBcdTRGRERcdTVCODhcdTU2REVcdTkwMDBcdUZGMUFcdTYzMDkgMyBcdTVCNTdcdTgyODIvXHU3ODAxXHU3MEI5XHU0RjMwXHU3Qjk3XHVGRjA4QVNDSUkgXHU0RUU1XHU0RTBCXHU0RjMwXHU5QUQ4XHU0RTBEXHU0RjFBXHU2NTNFXHU4RkM3XHU4RDg1XHU5NTdGXHU4RjkzXHU1MTY1XHVGRjA5XHUzMDAyXG4gIHJldHVybiBjaGFyQ291bnQocykgKiAzO1xufVxuXG4vKiogXHU2REYxXHU1RUE2XHU1MTRCXHU5Njg2XHU1RTc2XHU0RkREXHU3NTU5XHU1MzlGXHU1NzhCXHVGRjA4QXBwRGF0YS9FZHVjYXRpb24gXHU3QjQ5XHU3QzdCXHU1QjlFXHU0RjhCXHU1MTRCXHU5Njg2XHU1NDBFXHU2NUI5XHU2Q0Q1XHU0RUNEXHU1M0VGXHU3NTI4XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gY2xvbmU8VD4odmFsdWU6IFQpOiBUIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlLm1hcCgodikgPT4gY2xvbmUodikpIGFzIHVua25vd24gYXMgVDtcbiAgfVxuICBpZiAodmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgY29uc3Qgb3V0ID0gT2JqZWN0LmNyZWF0ZShPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpKSBhcyBSZWNvcmQ8XG4gICAgICBzdHJpbmcsXG4gICAgICB1bmtub3duXG4gICAgPjtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyh2YWx1ZSkpIHtcbiAgICAgIG91dFtrZXldID0gY2xvbmUoKHZhbHVlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrZXldKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dCBhcyBUO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuLyoqIFx1N0VEM1x1Njc4NFx1NTMxNlx1NzZGOFx1N0I0OVx1RkYxQUpTT04gXHU1MDNDXHU3RUE3XHU1MjJCXHU3Njg0XHU2REYxXHU1RUE2XHU2QkQ0XHU4RjgzXHVGRjA4XHU1NDJCXHU1QjU3XHU2QkI1XHU5ODdBXHU1RThGXHU2NUUwXHU1MTczXHU3Njg0XHU5NTJFXHU2QkQ0XHU4RjgzXHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gZGVlcEVxdWFsKGE6IHVua25vd24sIGI6IHVua25vd24pOiBib29sZWFuIHtcbiAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICBpZiAoQXJyYXkuaXNBcnJheShhKSAmJiBBcnJheS5pc0FycmF5KGIpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoID09PSBiLmxlbmd0aCAmJiBhLmV2ZXJ5KCh2LCBpKSA9PiBkZWVwRXF1YWwodiwgYltpXSkpO1xuICB9XG4gIGlmIChcbiAgICB0eXBlb2YgYSA9PT0gXCJvYmplY3RcIiAmJlxuICAgIGEgIT09IG51bGwgJiZcbiAgICB0eXBlb2YgYiA9PT0gXCJvYmplY3RcIiAmJlxuICAgIGIgIT09IG51bGwgJiZcbiAgICAhQXJyYXkuaXNBcnJheShhKSAmJlxuICAgICFBcnJheS5pc0FycmF5KGIpXG4gICkge1xuICAgIGNvbnN0IGthID0gT2JqZWN0LmtleXMoYSk7XG4gICAgY29uc3Qga2IgPSBPYmplY3Qua2V5cyhiKTtcbiAgICBpZiAoa2EubGVuZ3RoICE9PSBrYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4ga2EuZXZlcnkoKGspID0+XG4gICAgICBkZWVwRXF1YWwoXG4gICAgICAgIChhIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrXSxcbiAgICAgICAgKGIgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW2tdLFxuICAgICAgKSxcbiAgICApO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cbiIsICIvLyEgXHU1QjlFXHU0RjUzIElEXHVGRjFBVVVJRCB2NFx1RkYwOFx1NUJGOVx1NUU5NCBSdXN0IGBVdWlkOjpuZXdfdjQoKS50b19zdHJpbmcoKWBcdUZGMDlcdTMwMDJcbi8vISBcdTRGMThcdTUxNDhcdTc1MjhcdTVFNzNcdTUzRjAgYGNyeXB0by5yYW5kb21VVUlEYFx1RkYwQ1x1OTAwMFx1NTMxNlx1NjVGNlx1NzUyOCBNYXRoLnJhbmRvbSBcdTVCOUVcdTczQjAgUkZDIDQxMjIgdjRcdTMwMDJcblxuZXhwb3J0IGZ1bmN0aW9uIGlkKCk6IHN0cmluZyB7XG4gIGNvbnN0IGNyeXB0byA9IGdsb2JhbFRoaXMuY3J5cHRvIGFzIHsgcmFuZG9tVVVJRD86ICgpID0+IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuICBpZiAoY3J5cHRvICYmIHR5cGVvZiBjcnlwdG8ucmFuZG9tVVVJRCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIGNyeXB0by5yYW5kb21VVUlEKCk7XG4gIH1cbiAgLy8gUkZDIDQxMjIgdjQgXHU5MDAwXHU1MzE2XHU1QjlFXHU3M0IwXHVGRjA4XHU0RUM1XHU3NTI4XHU0RThFXHU2NUUwIGNyeXB0byBcdTc2ODRcdTczQUZcdTU4ODNcdUZGMDlcdTMwMDJcbiAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgMTY7IGkgKz0gMSkgYnl0ZXNbaV0gPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAyNTYpO1xuICBieXRlc1s2XSA9IChieXRlc1s2XSEgJiAweDBmKSB8IDB4NDA7XG4gIGJ5dGVzWzhdID0gKGJ5dGVzWzhdISAmIDB4M2YpIHwgMHg4MDtcbiAgY29uc3QgaGV4ID0gQXJyYXkuZnJvbShieXRlcywgKGIpID0+IGIudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsIFwiMFwiKSkuam9pbihcbiAgICBcIlwiLFxuICApO1xuICByZXR1cm4gYCR7aGV4LnNsaWNlKDAsIDgpfS0ke2hleC5zbGljZSg4LCAxMil9LSR7aGV4LnNsaWNlKDEyLCAxNil9LSR7aGV4LnNsaWNlKDE2LCAyMCl9LSR7aGV4LnNsaWNlKDIwKX1gO1xufVxuIiwgIi8vISBcdTY3MkNcdTU3MzBcdTY1RTVcdTUzODZcdTRFMEVcdTY1RjZcdTUyM0JcdTVERTVcdTUxNzdcdTMwMDJcbi8vIVxuLy8hIFx1NTk1MVx1N0VBNlx1RkYwOGRvY3MvUExBTl9GT1JNQVQubWRcdTMwMDFkb2NzL0JBQ0tVUF9GT1JNQVQubWRcdTMwMDFBUEkubWRcdUZGMDlcdUZGMUFcbi8vISBcdTYyNDBcdTY3MDlcdTY1RjZcdTk1RjRcdTYyMzNcdTkwRkRcdTY2MkYgVW5peCBcdTc5RDJcdUZGMENcdTYzMDkqKlx1NjcyQ1x1NjczQVx1NjVGNlx1NTMzQSoqXHU4OUUzXHU4QkZCXHVGRjA4XHU1QkY5XHU1RTk0IFJ1c3QgYGNocm9ubzo6TG9jYWxgXHVGRjA5XHVGRjFCXG4vLyEgXHU2NUU1XHU2NzFGXHU0RTNBIGBZWVlZLU1NLUREYFx1RkYwQ1x1NjVGNlx1OTVGNFx1NEUzQSBgSEg6TU1gXHUzMDAyXHU2NUU1XHU1Mzg2XHU4RkQwXHU3Qjk3XHU2MzA5XHUzMDBDXHU4MUVBXHU3MTM2XHU2NUU1XHUzMDBEXHU4RkRCXHU4ODRDXHVGRjBDXHU0RTBEXHU1M0Q3XHU1OTBGXHU0RUU0XHU2NUY2XHU1RjcxXHU1NENEXG4vLyEgXHVGRjA4XHU1QkY5XHU1RTk0IFJ1c3QgYE5haXZlRGF0ZWAgXHU3Njg0IGBjaGVja2VkX2FkZF9kYXlzYFx1RkYwOVx1MzAwMlxuXG5leHBvcnQgaW50ZXJmYWNlIENhbGVuZGFyRGF0ZSB7XG4gIHllYXI6IG51bWJlcjtcbiAgbW9udGg6IG51bWJlcjtcbiAgZGF5OiBudW1iZXI7XG59XG5cbmNvbnN0IERBWV9NUyA9IDg2NDAwMDAwO1xuXG5jb25zdCBwYWQyID0gKG46IG51bWJlcik6IHN0cmluZyA9PiAobiA8IDEwID8gYDAke259YCA6IFN0cmluZyhuKSk7XG5jb25zdCBwYWQ0ID0gKG46IG51bWJlcik6IHN0cmluZyA9PiBTdHJpbmcobikucGFkU3RhcnQoNCwgXCIwXCIpO1xuXG4vKiogVW5peCBcdTc5RDIgXHUyMTkyIFx1NjcyQ1x1NjczQVx1NjVFNVx1NTM4Nlx1NjVFNVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvY2FsRGF0ZU9mKGF0OiBudW1iZXIpOiBDYWxlbmRhckRhdGUge1xuICBjb25zdCBkID0gbmV3IERhdGUoYXQgKiAxMDAwKTtcbiAgcmV0dXJuIHsgeWVhcjogZC5nZXRGdWxsWWVhcigpLCBtb250aDogZC5nZXRNb250aCgpICsgMSwgZGF5OiBkLmdldERhdGUoKSB9O1xufVxuXG4vKiogVW5peCBcdTc5RDIgXHUyMTkyIFx1NjcyQ1x1NjczQVx1NjVFNVx1NjcxRiBgWVlZWS1NTS1ERGBcdUZGMDhcdTVCRjlcdTVFOTQgYGNyYXRlOjpkYXRlX2F0YFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRhdGVBdChhdDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgeyB5ZWFyLCBtb250aCwgZGF5IH0gPSBsb2NhbERhdGVPZihhdCk7XG4gIHJldHVybiBgJHtwYWQ0KHllYXIpfS0ke3BhZDIobW9udGgpfS0ke3BhZDIoZGF5KX1gO1xufVxuXG4vKipcbiAqIFx1ODlFM1x1Njc5MCBgWVlZWS1NTS1ERGBcdUZGMUJcdTY1RTBcdTY1NDhcdTYyMTZcdTk3NUVcdTc3MUZcdTVCOUVcdTY1RTVcdTY3MUZcdUZGMDhcdTU5ODIgMjAyNi0wMi0zMFx1RkYwOVx1OEZENFx1NTZERSBudWxsXHUzMDAyXG4gKiBcdTVCRjlcdTVFOTQgYE5haXZlRGF0ZTo6cGFyc2VfZnJvbV9zdHIocywgXCIlWS0lbS0lZFwiKWBcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRGF0ZSh2YWx1ZTogc3RyaW5nKTogQ2FsZW5kYXJEYXRlIHwgbnVsbCB7XG4gIGlmICghL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QodmFsdWUpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgeWVhciA9IE51bWJlcih2YWx1ZS5zbGljZSgwLCA0KSk7XG4gIGNvbnN0IG1vbnRoID0gTnVtYmVyKHZhbHVlLnNsaWNlKDUsIDcpKTtcbiAgY29uc3QgZGF5ID0gTnVtYmVyKHZhbHVlLnNsaWNlKDgsIDEwKSk7XG4gIGNvbnN0IHByb2JlID0gbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgbW9udGggLSAxLCBkYXkpKTtcbiAgaWYgKFxuICAgIHByb2JlLmdldFVUQ0Z1bGxZZWFyKCkgIT09IHllYXIgfHxcbiAgICBwcm9iZS5nZXRVVENNb250aCgpICE9PSBtb250aCAtIDEgfHxcbiAgICBwcm9iZS5nZXRVVENEYXRlKCkgIT09IGRheVxuICApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4geyB5ZWFyLCBtb250aCwgZGF5IH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZERhdGUodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gcGFyc2VEYXRlKHZhbHVlKSAhPT0gbnVsbDtcbn1cblxuLyoqIFx1ODFFQVx1NzEzNlx1NjVFNVx1NTJBMFx1NkNENVx1RkYwOFx1NTNFRlx1OEQxRlx1RkYwOVx1RkYwQ1x1NEUwRVx1NTkwRlx1NEVFNFx1NjVGNlx1NjVFMFx1NTE3M1x1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFkZERheXMoZGF0ZTogQ2FsZW5kYXJEYXRlLCBkYXlzOiBudW1iZXIpOiBDYWxlbmRhckRhdGUge1xuICBjb25zdCB0ID0gbmV3IERhdGUoRGF0ZS5VVEMoZGF0ZS55ZWFyLCBkYXRlLm1vbnRoIC0gMSwgZGF0ZS5kYXkgKyBkYXlzKSk7XG4gIHJldHVybiB7XG4gICAgeWVhcjogdC5nZXRVVENGdWxsWWVhcigpLFxuICAgIG1vbnRoOiB0LmdldFVUQ01vbnRoKCkgKyAxLFxuICAgIGRheTogdC5nZXRVVENEYXRlKCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wYXJlRGF0ZXMoYTogQ2FsZW5kYXJEYXRlLCBiOiBDYWxlbmRhckRhdGUpOiBudW1iZXIge1xuICByZXR1cm4gYS55ZWFyIC0gYi55ZWFyIHx8IGEubW9udGggLSBiLm1vbnRoIHx8IGEuZGF5IC0gYi5kYXk7XG59XG5cbi8qKiAxID0gXHU1NDY4XHU0RTAwIFx1MjAyNiA3ID0gXHU1NDY4XHU2NUU1XHVGRjA4XHU1QkY5XHU1RTk0IGB3ZWVrZGF5KCkubnVtYmVyX2Zyb21fbW9uZGF5KClgXHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gd2Vla2RheU1vbmRheShkYXRlOiBDYWxlbmRhckRhdGUpOiBudW1iZXIge1xuICBjb25zdCBkYXkgPSBuZXcgRGF0ZShcbiAgICBEYXRlLlVUQyhkYXRlLnllYXIsIGRhdGUubW9udGggLSAxLCBkYXRlLmRheSksXG4gICkuZ2V0VVRDRGF5KCk7IC8vIDAgPSBTdW5kYXlcbiAgcmV0dXJuIGRheSA9PT0gMCA/IDcgOiBkYXk7XG59XG5cbi8qKiBcdTYyNDBcdTU3MjhcdTU0NjhcdTc2ODRcdTU0NjhcdTRFMDBcdUZGMDhcdTVCRjlcdTVFOTQgdGVtcGxhdGVzOjp3ZWVrX3N0YXJ0XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gd2Vla1N0YXJ0KGRhdGU6IENhbGVuZGFyRGF0ZSk6IENhbGVuZGFyRGF0ZSB7XG4gIHJldHVybiBhZGREYXlzKGRhdGUsIC0od2Vla2RheU1vbmRheShkYXRlKSAtIDEpKTtcbn1cblxuLyoqIFx1NEUyNFx1NEUyQVx1NjVFNVx1NTM4Nlx1NjVFNVx1NzZGOFx1NURFRVx1NzY4NFx1ODFFQVx1NzEzNlx1NjVFNVx1NjU3MFx1RkYwOHRvIC0gZnJvbVx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRheXNCZXR3ZWVuKGZyb206IENhbGVuZGFyRGF0ZSwgdG86IENhbGVuZGFyRGF0ZSk6IG51bWJlciB7XG4gIGNvbnN0IGEgPSBEYXRlLlVUQyhmcm9tLnllYXIsIGZyb20ubW9udGggLSAxLCBmcm9tLmRheSk7XG4gIGNvbnN0IGIgPSBEYXRlLlVUQyh0by55ZWFyLCB0by5tb250aCAtIDEsIHRvLmRheSk7XG4gIHJldHVybiBNYXRoLmZsb29yKChiIC0gYSkgLyBEQVlfTVMpO1xufVxuXG4vKiogXHU2NUU1XHU1Mzg2XHU2NUU1IFx1MjE5MiBgWVlZWS1NTS1ERGBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXREYXRlKGRhdGU6IENhbGVuZGFyRGF0ZSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtwYWQ0KGRhdGUueWVhcil9LSR7cGFkMihkYXRlLm1vbnRoKX0tJHtwYWQyKGRhdGUuZGF5KX1gO1xufVxuXG4vKiogXHU2NzJDXHU2NzNBXHU2NUU1XHU2NzFGXHU2NUY2XHU1MjNCIFx1MjE5MiBVbml4IFx1NzlEMlx1RkYwOFx1NUJGOVx1NUU5NCBgTG9jYWwud2l0aF95bWRfYW5kX2htcyguLi4pLnRpbWVzdGFtcCgpYFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGF0TG9jYWwoXG4gIHllYXI6IG51bWJlcixcbiAgbW9udGg6IG51bWJlcixcbiAgZGF5OiBudW1iZXIsXG4gIGhvdXI6IG51bWJlcixcbiAgbWludXRlOiBudW1iZXIsXG4gIHNlY29uZCA9IDAsXG4pOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5mbG9vcihcbiAgICBuZXcgRGF0ZSh5ZWFyLCBtb250aCAtIDEsIGRheSwgaG91ciwgbWludXRlLCBzZWNvbmQpLmdldFRpbWUoKSAvIDEwMDAsXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdExvY2FsRGF0ZShkYXRlOiBDYWxlbmRhckRhdGUsIGhvdXIgPSAwLCBtaW51dGUgPSAwKTogbnVtYmVyIHtcbiAgcmV0dXJuIGF0TG9jYWwoZGF0ZS55ZWFyLCBkYXRlLm1vbnRoLCBkYXRlLmRheSwgaG91ciwgbWludXRlKTtcbn1cblxuLyoqIGBZWVlZLU1NLUREYCBcdTIxOTIgXHU4QkU1XHU2NUU1XHU2NzJDXHU2NzNBIDAwOjAwIFx1NzY4NCBVbml4IFx1NzlEMlx1RkYxQlx1NjVFMFx1NjU0OFx1NjVFNVx1NjcxRlx1OEZENFx1NTZERSBudWxsXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gYXRMb2NhbERhdGVTdHJpbmcoZGF0ZTogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIGNvbnN0IHBhcnNlZCA9IHBhcnNlRGF0ZShkYXRlKTtcbiAgaWYgKHBhcnNlZCA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBhdExvY2FsRGF0ZShwYXJzZWQpO1xufVxuXG4vKiogVW5peCBcdTc5RDIgXHUyMTkyIFx1NjcyQ1x1NjczQSBgSEg6TU1gXHVGRjA4XHU1QkY5XHU1RTk0IGB0LmZvcm1hdChcIiVIOiVNXCIpYFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhvdXJNaW51dGVTdHJpbmcoYXQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShhdCAqIDEwMDApO1xuICByZXR1cm4gYCR7cGFkMihkLmdldEhvdXJzKCkpfToke3BhZDIoZC5nZXRNaW51dGVzKCkpfWA7XG59XG5cbi8qKiBVbml4IFx1NzlEMiBcdTIxOTIgXHU2NzJDXHU2NzNBXHU1RjUzXHU1OTI5XHU1REYyXHU4RkM3XHU3OUQyXHU2NTcwXHVGRjA4MFx1MjAxMzg2Mzk5XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gc2Vjb25kc09mRGF5KGF0OiBudW1iZXIpOiBudW1iZXIge1xuICBjb25zdCBkID0gbmV3IERhdGUoYXQgKiAxMDAwKTtcbiAgcmV0dXJuIGQuZ2V0SG91cnMoKSAqIDM2MDAgKyBkLmdldE1pbnV0ZXMoKSAqIDYwICsgZC5nZXRTZWNvbmRzKCk7XG59XG5cbi8qKiBVbml4IFx1NzlEMiBcdTIxOTIgXHU2NzJDXHU2NzNBIGAoaG91ciwgbWludXRlKWBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBob3VyTWludXRlT2YoYXQ6IG51bWJlcik6IHsgaG91cjogbnVtYmVyOyBtaW51dGU6IG51bWJlciB9IHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKGF0ICogMTAwMCk7XG4gIHJldHVybiB7IGhvdXI6IGQuZ2V0SG91cnMoKSwgbWludXRlOiBkLmdldE1pbnV0ZXMoKSB9O1xufVxuXG4vKipcbiAqIFx1NjgyMVx1OUE4QyBgSEg6TU1gXHVGRjFBXHU5NTdGXHU1RUE2IDVcdTMwMDFcdTdCMkMgMyBcdTRGNERcdTY2MkYgYDpgXHUzMDAxXHU2NTcwXHU1QjU3XHU0RTE0IFx1NUMwRlx1NjVGNiBcdTIyNjQgMjNcdTMwMDFcdTUyMDZcdTk0OUYgXHUyMjY0IDU5XHUzMDAyXG4gKiBcdTVCRjlcdTVFOTQgdGVtcGxhdGVzOjp2YWxpZF90aW1lXHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZFRpbWUodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIHZhbHVlLmxlbmd0aCA9PT0gNSAmJlxuICAgIHZhbHVlLmNoYXJDb2RlQXQoMikgPT09IDU4IC8qICc6JyAqLyAmJlxuICAgIHZhbHVlLnNsaWNlKDAsIDIpID49IFwiMDBcIiAmJlxuICAgIHZhbHVlLnNsaWNlKDAsIDIpIDw9IFwiMjNcIiAmJlxuICAgIHZhbHVlLnNsaWNlKDMpID49IFwiMDBcIiAmJlxuICAgIHZhbHVlLnNsaWNlKDMpIDw9IFwiNTlcIlxuICApO1xufVxuXG4vKiogYEhIOk1NYCBcdTIxOTIgXHU1MjA2XHU5NDlGXHU2NTcwXHVGRjFCXHU2NUUwXHU2NTQ4XHU4RkQ0XHU1NkRFIG51bGxcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW51dGVzT2YodmFsdWU6IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICBpZiAodmFsdWUubGVuZ3RoICE9PSA1IHx8IHZhbHVlLmNoYXJDb2RlQXQoMikgIT09IDU4KSByZXR1cm4gbnVsbDtcbiAgY29uc3QgaG91ciA9IE51bWJlcih2YWx1ZS5zbGljZSgwLCAyKSk7XG4gIGNvbnN0IG1pbnV0ZSA9IE51bWJlcih2YWx1ZS5zbGljZSgzKSk7XG4gIGlmIChcbiAgICAhTnVtYmVyLmlzSW50ZWdlcihob3VyKSB8fFxuICAgICFOdW1iZXIuaXNJbnRlZ2VyKG1pbnV0ZSkgfHxcbiAgICBob3VyID4gMjMgfHxcbiAgICBtaW51dGUgPiA1OVxuICApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4gaG91ciAqIDYwICsgbWludXRlO1xufVxuXG4vKiogXHU1RjUzXHU1MjREIFVuaXggXHU3OUQyXHVGRjA4XHU1QkY5XHU1RTk0IGBjcmF0ZTo6bm93YFx1RkYwOVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vdygpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG59XG4iLCAiLy8hIFx1OTg4Nlx1NTdERlx1NjU3MFx1NjM2RVx1NkEyMVx1NTc4Qlx1RkYxQVx1NEUwRSBjcmF0ZXMvY29yZSBcdTc2ODQgc2VyZGUgXHU3RUQzXHU2Nzg0XHU0RTAwXHU0RTAwXHU1QkY5XHU1RTk0XHUzMDAyXG4vLyFcbi8vISBcdTU0N0RcdTU0MERcdTg5QzRcdTUyMTlcdUZGMUFUUyBcdTUxODVcdTkwRThcdTVCNTdcdTZCQjVcdTU0MERcdTUzNzMgSlNPTiBjYW1lbENhc2UgXHU1NDBEXHVGRjA4XHU1QkY5XHU1RTk0IGAjW3NlcmRlKHJlbmFtZV9hbGw9XCJjYW1lbENhc2VcIildYFx1RkYwOVx1MzAwMlxuLy8hIFx1Njc5QVx1NEUzRVx1NjYyRlx1NUI1N1x1N0IyNlx1NEUzMlx1NUI1N1x1OTc2Mlx1OTFDRlx1ODA1NFx1NTQwOFx1RkYwOHNlcmRlIGNhbWVsQ2FzZSBcdTUzRDZcdTUwM0NcdUZGMDlcdUZGMENcdTVFOEZcdTUyMTdcdTUzMTZcdTUzNzNcdTc2RjRcdTYzQTVcdThGOTNcdTUxRkFcdTMwMDJcbi8vISBcdTUzRUZcdTkwMDkgSlNPTiBcdTVCNTdcdTZCQjVcdUZGMDhzZXJkZSBgT3B0aW9uYCAvIGAjW3NlcmRlKGRlZmF1bHQpXWBcdUZGMDlcdTg5RTNcdTY3OTBcdTU0MEVcdTdFREZcdTRFMDBcdTRFM0EgYFQgfCBudWxsYCBcdTYyMTZcdTdGM0FcdTc3MDFcdTUwM0NcdUZGMUJcbi8vISBcdTVFOEZcdTUyMTdcdTUzMTZcdTY1RjZcdTYzMDkgUnVzdCBcdTc2ODQgYHNraXBfc2VyaWFsaXppbmdfaWZgIFx1NTFCM1x1NUI5QVx1NjYyRlx1NTQyNlx1NzcwMVx1NzU2NVx1OTUyRVx1MzAwMlxuXG5leHBvcnQgaW50ZXJmYWNlIFByb2plY3Qge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGNvbG9yOiBzdHJpbmc7XG4gIC8qKiBcdTYzRDBcdTRGOUJcdTY1RjZcdTY2RkZcdTRFRTNcdTkwMUFcdTc1MjhcdTc2N0RcdTU0MERcdTUzNTVcdUZGMUJcdTVFOEZcdTUyMTdcdTUzMTZcdTY1RjYgbnVsbCBcdTc3MDFcdTc1NjVcdUZGMDhza2lwX3NlcmlhbGl6aW5nX2lmXHVGRjA5XHUzMDAyICovXG4gIGFwcFdoaXRlbGlzdDogc3RyaW5nW10gfCBudWxsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhhYml0U2xvdCB7XG4gIC8qKiAxID0gXHU1NDY4XHU0RTAwIFx1MjAyNiA3ID0gXHU1NDY4XHU2NUU1XHUzMDAyICovXG4gIGRheXM6IG51bWJlcltdO1xuICB0aW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFiaXQge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlzaW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICAvKiogXHU1RThGXHU1MjE3XHU1MzE2XHU2NUY2IG51bGwgXHU3NzAxXHU3NTY1XHUzMDAyICovXG4gIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdWJ0YXNrIHtcbiAgaWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgZG9uZTogYm9vbGVhbjtcbn1cblxuLyoqIFx1N0JBMVx1OEY5Nlx1NTIwNlx1N0M3Qlx1RkYxQVx1NzUzMVx1NTFCQlx1N0VEM1x1NUI1N1x1NkJCNVx1NjNBOFx1NUJGQ1x1RkYwQ1x1NkMzOFx1NEUwRFx1NEY1Q1x1NEUzQVx1NzUyOFx1NjIzN1x1NjU3MFx1NjM2RVx1NUI1OFx1NTBBOFx1MzAwMiAqL1xuZXhwb3J0IHR5cGUgVGFza0tpbmQgPSBcIm9yZGluYXJ5XCIgfCBcImhhYml0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFzayB7XG4gIGlkOiBzdHJpbmc7XG4gIHRlbXBsYXRlSWQ6IHN0cmluZyB8IG51bGw7XG4gIC8qKiBcdTUzNzBcdTUyMzdcdTY1RjZcdTUxQkJcdTdFRDNcdTc2ODRcdTkxQ0RcdTU5MERcdTY3NjVcdTZFOTBcdUZGMUJcdTY1MzlcdTZBMjFcdTY3N0ZcdTRFMERcdTkxQ0RcdTUxOTlcdTUzODZcdTUzRjJcdTUyMDZcdTdDN0JcdTMwMDIgKi9cbiAgcmVjdXJyaW5nOiBib29sZWFuO1xuICB0aXRsZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGhhYml0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGR1ZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIHJlbWluZGVyVGltZTogc3RyaW5nIHwgbnVsbDtcbiAgZm9jdXNNaW51dGVzOiBudW1iZXIgfCBudWxsO1xuICAvKiogXHU2NjZFXHU5MDFBXHU0RUZCXHU1MkExXHU4QkExXHU1MjEyXHU1NzU3XHU3RUQzXHU2NzVGXHU1NDBFXHU3Njg0XHU5NzU5XHU2MDAxXHU5MUNEXHU0RkVFXHU3QTk3XHU1M0UzXHVGRjA4XHU1MjA2XHU5NDlGXHVGRjA5XHVGRjFCMCBcdTUzNzNcdTUyMzBcdTcwQjlcdTRGNUNcdTVFOUZcdTMwMDIgKi9cbiAgc2NyYXBNaW51dGVzOiBudW1iZXI7XG4gIHByaW9yaXR5OiBudW1iZXI7XG4gIGVzdGltYXRlOiBudW1iZXI7XG4gIHJlbWluZGVyRmlyZWQ6IGJvb2xlYW47XG4gIHJlbWluZGVyUGVuZGluZzogYm9vbGVhbjtcbiAgcmVtaW5kZXJFeHBpcmVkOiBib29sZWFuO1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG4gIGNvbXBsZXRlZEF0OiBudW1iZXIgfCBudWxsO1xuICBjcmVhdGVkQXQ6IG51bWJlcjtcbiAgdGFnczogc3RyaW5nW107XG4gIHN1YnRhc2tzOiBTdWJ0YXNrW107XG59XG5cbi8qKiBcdTRFRkJcdTUyQTFcdTc2ODRcdTdCQTFcdThGOTZcdTUyMDZcdTdDN0JcdUZGMDhcdTUzNTVcdTRFMDBcdTY3NDNcdTVBMDFcdTVCOUFcdTRFNDlcdUZGMENcdThCRkJcdTUxQkJcdTdFRDNcdTVCNTdcdTZCQjVcdUZGMDlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBraW5kT2YoXG4gIHRhc2s6IFBpY2s8VGFzaywgXCJyZW1pbmRlclRpbWVcIiB8IFwiaGFiaXRJZFwiIHwgXCJyZWN1cnJpbmdcIj4sXG4pOiBUYXNrS2luZCB7XG4gIHJldHVybiB0YXNrLnJlbWluZGVyVGltZSAhPT0gbnVsbCAmJiAodGFzay5oYWJpdElkICE9PSBudWxsIHx8IHRhc2sucmVjdXJyaW5nKVxuICAgID8gXCJoYWJpdFwiXG4gICAgOiBcIm9yZGluYXJ5XCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0hhYml0KFxuICB0YXNrOiBQaWNrPFRhc2ssIFwicmVtaW5kZXJUaW1lXCIgfCBcImhhYml0SWRcIiB8IFwicmVjdXJyaW5nXCI+LFxuKTogYm9vbGVhbiB7XG4gIHJldHVybiBraW5kT2YodGFzaykgPT09IFwiaGFiaXRcIjtcbn1cblxuZXhwb3J0IHR5cGUgUmVwZWF0ID0gXCJub25lXCIgfCBcImRhaWx5XCIgfCBcIndlZWtkYXlzXCIgfCBcIndlZWtseVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRhc2tEcmFmdCB7XG4gIGlkOiBzdHJpbmcgfCBudWxsO1xuICB0aXRsZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGR1ZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIHJlbWluZGVyVGltZTogc3RyaW5nIHwgbnVsbDtcbiAgZm9jdXNNaW51dGVzOiBudW1iZXIgfCBudWxsO1xuICBzY3JhcE1pbnV0ZXM6IG51bWJlcjtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgZXN0aW1hdGU6IG51bWJlcjtcbiAgdGFnczogc3RyaW5nW107XG4gIHN1YnRhc2tzOiBTdWJ0YXNrW107XG4gIHJlcGVhdDogUmVwZWF0O1xufVxuXG5leHBvcnQgdHlwZSBHdWFyZE1vZGUgPSBcIm9mZlwiIHwgXCJsb2NrXCIgfCBcIndoaXRlbGlzdFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb3RlY3Rpb24ge1xuICBtb2RlOiBHdWFyZE1vZGU7XG4gIHdoaXRlbGlzdDogc3RyaW5nW107XG4gIHN0cmljdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTZXR0aW5ncyB7XG4gIGZvY3VzTWludXRlczogbnVtYmVyO1xuICBzaG9ydEJyZWFrTWludXRlczogbnVtYmVyO1xuICBsb25nQnJlYWtNaW51dGVzOiBudW1iZXI7XG4gIGxvbmdCcmVha0V2ZXJ5OiBudW1iZXI7XG4gIGRhaWx5R29hbDogbnVtYmVyO1xuICBhdXRvQnJlYWs6IGJvb2xlYW47XG4gIGF1dG9Gb2N1czogYm9vbGVhbjtcbiAgYXV0b1N0YXJ0VGFza3M6IGJvb2xlYW47XG4gIHNvdW5kOiBib29sZWFuO1xuICBzb3VuZFZvbHVtZTogbnVtYmVyO1xuICBub3RpZmljYXRpb25zOiBib29sZWFuO1xuICBhbHdheXNPblRvcDogYm9vbGVhbjtcbiAgdGhlbWU6IHN0cmluZztcbiAgcGVyc29uYUJhY2tkcm9wOiBib29sZWFuO1xuICBwcm90ZWN0aW9uOiBQcm90ZWN0aW9uO1xufVxuXG5leHBvcnQgdHlwZSBNb2RlID0gXCJmb2N1c1wiIHwgXCJzaG9ydEJyZWFrXCIgfCBcImxvbmdCcmVha1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVyIHtcbiAgbW9kZTogTW9kZTtcbiAgcnVubmluZzogYm9vbGVhbjtcbiAgdGFza0lkOiBzdHJpbmcgfCBudWxsO1xuICBkdXJhdGlvblNlY3M6IG51bWJlcjtcbiAgcmVtYWluaW5nU2VjczogbnVtYmVyO1xuICBkZWFkbGluZTogbnVtYmVyIHwgbnVsbDtcbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xuICBjeWNsZTogbnVtYmVyO1xuICBjeWNsZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIGNvbXBsZXRpb25TZXJpYWw6IG51bWJlcjtcbiAgbGFzdEZpbmlzaGVkTW9kZTogTW9kZSB8IG51bGw7XG4gIGF1dG9Gb2N1c0Jsb2NrZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFNlc3Npb25Tb3VyY2UgPSBcInRpbWVyXCIgfCBcInRhc2tFc3RpbWF0ZVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlc3Npb24ge1xuICBpZDogc3RyaW5nO1xuICBzb3VyY2U6IFNlc3Npb25Tb3VyY2U7XG4gIHRhc2tJZDogc3RyaW5nIHwgbnVsbDtcbiAgdGFza1RpdGxlOiBzdHJpbmc7XG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIHN0YXJ0ZWRBdDogbnVtYmVyO1xuICBlbmRlZEF0OiBudW1iZXI7XG4gIGR1cmF0aW9uU2VjczogbnVtYmVyO1xuICBjb21wbGV0ZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIERldGFjaFRhcmdldCA9IFwicHJvamVjdFwiIHwgXCJoYWJpdFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIERheVN0YXQge1xuICBkYXRlOiBzdHJpbmc7XG4gIHNlY29uZHM6IG51bWJlcjtcbiAgcG9tb2Rvcm9zOiBudW1iZXI7XG4gIC8qKiBcdTVCOUFcdTY1RjZcdTkxQ0RcdTU5MERcdTRFNjBcdTYwRUZcdTVGNTNcdTU5MjlcdTUyMzBcdTY3MUZcdTY3MkFcdTVCOENcdTYyMTBcdTMwMDIgKi9cbiAgbWlzc2VkOiBudW1iZXI7XG4gIGNvbXBsZXRlZDogbnVtYmVyO1xuICAvKiogXHU2NjZFXHU5MDFBXHU1QjlBXHU2NUY2XHU1QjlFXHU0RjhCXHU1RjUzXHU1OTI5XHU0RjVDXHU1RTlGXHU2NzJBXHU1QjhDXHU2MjEwXHUzMDAyICovXG4gIHZvaWRlZDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRzIHtcbiAgdG9kYXlTZWNvbmRzOiBudW1iZXI7XG4gIHRvZGF5UG9tb2Rvcm9zOiBudW1iZXI7XG4gIHRvZGF5Q29tcGxldGVkOiBudW1iZXI7XG4gIHRvdGFsU2Vjb25kczogbnVtYmVyO1xuICB0b3RhbFBvbW9kb3JvczogbnVtYmVyO1xuICBzdHJlYWs6IG51bWJlcjtcbiAgZGF5czogRGF5U3RhdFtdO1xufVxuXG4vLyAtLS0tLS0tLS0tIFx1NUI5QVx1NjVGNlx1OTUwMVx1NjczQVx1RkYwOFx1NjU3MFx1NjM2RVx1NkEyMVx1NTc4QiArIFx1N0VBRlx1OEMwM1x1NUVBNlx1OTAzQlx1OEY5MVx1RkYxQlx1Njg0Q1x1OTc2Mlx1NjI2N1x1ODg0Q1x1NzU1OVx1NTM5Rlx1NzUxRiBndWFyZFx1RkYwOSAtLS0tLS0tLS0tXG5cbmV4cG9ydCBpbnRlcmZhY2UgTG9ja1NjaGVkdWxlIHtcbiAgaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBzdGFydDogc3RyaW5nO1xuICBlbmQ6IHN0cmluZztcbiAgZGF5czogbnVtYmVyW107XG4gIGVuYWJsZWQ6IGJvb2xlYW47XG4gIHN0cmljdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBY3RpdmVMb2NrIHtcbiAgbmFtZTogc3RyaW5nO1xuICBzdGFydGVkQXQ6IG51bWJlcjtcbiAgZW5kc0F0OiBudW1iZXI7XG4gIHN0cmljdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMb2NrU3RhdGUge1xuICBzY2hlZHVsZXM6IExvY2tTY2hlZHVsZVtdO1xuICBhY3RpdmU6IEFjdGl2ZUxvY2sgfCBudWxsO1xuICBzdXBwcmVzc2VkVW50aWw6IG51bWJlcjtcbn1cblxuLy8gLS0tLS0tLS0tLSBcdThCRkVcdTg4NjhcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjUgLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBBdHRlbnRpb24gPSBcInJlcXVpcmVkXCIgfCBcImxpZ2h0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmxvY2sge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICAvKiogMSA9IFx1NTQ2OFx1NEUwMCBcdTIwMjYgNyA9IFx1NTQ2OFx1NjVFNVx1MzAwMiAqL1xuICBkYXlzOiBudW1iZXJbXTtcbiAgLyoqIFx1NjcyQ1x1NjczQSBISDpNTVx1RkYxQmVuZCBcdTRFMERcdTY2NUFcdTRFOEUgc3RhcnQgXHU4ODY4XHU3OTNBXHU4REU4XHU1MzQ4XHU1OTFDXHUzMDAyICovXG4gIHN0YXJ0OiBzdHJpbmc7XG4gIGVuZDogc3RyaW5nO1xuICBhdHRlbnRpb246IEF0dGVudGlvbjtcbiAgbm90ZXM6IHN0cmluZztcbn1cblxuLy8gLS0tLS0tLS0tLSBcdTZBMjFcdTY3N0ZcdTRFMEVcdTUzNzBcdTUyMzcgLS0tLS0tLS0tLVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlbXBsYXRlU3VidGFzayB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2hhcGUge1xuICB0aXRsZTogc3RyaW5nO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGhhYml0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGZvY3VzTWludXRlczogbnVtYmVyIHwgbnVsbDtcbiAgc2NyYXBNaW51dGVzOiBudW1iZXI7XG4gIHByaW9yaXR5OiBudW1iZXI7XG4gIGVzdGltYXRlOiBudW1iZXI7XG4gIHRhZ3M6IHN0cmluZ1tdO1xuICBzdWJ0YXNrczogVGVtcGxhdGVTdWJ0YXNrW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpbnRTbG90IHtcbiAgZGF5czogbnVtYmVyW107XG4gIHRpbWU6IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FsZW5kYXJTbG90IHtcbiAgZGF0ZXM6IHN0cmluZ1tdO1xuICB0aW1lOiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgdHlwZSBQcmludGluZyA9XG4gIHwgeyBraW5kOiBcIm9uY2VcIjsgZGF0ZTogc3RyaW5nIHwgbnVsbDsgdGltZTogc3RyaW5nIHwgbnVsbCB9XG4gIHwgeyBraW5kOiBcImNhbGVuZGFyXCI7IHNsb3RzOiBDYWxlbmRhclNsb3RbXSB9XG4gIHwgeyBraW5kOiBcIndlZWtseVwiOyBzbG90czogUHJpbnRTbG90W10gfTtcblxuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHNoYXBlOiBTaGFwZTtcbiAgcHJpbnRpbmc6IFByaW50aW5nO1xuICBhdXRvbWF0aWM6IGJvb2xlYW47XG4gIHByaW50QWhlYWREYXlzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJpbnRSZWNvcmQge1xuICB0ZW1wbGF0ZUlkOiBzdHJpbmc7XG4gIGRhdGU6IHN0cmluZyB8IG51bGw7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU2QzM4XHU0RTQ1IElEIFx1NzY3Qlx1OEJCMCAtLS0tLS0tLS0tXG5cbmV4cG9ydCBpbnRlcmZhY2UgSWRlbnRpdHkge1xuICBpZDogc3RyaW5nO1xuICBraW5kOiBzdHJpbmc7XG4gIHJldGlyZWQ6IGJvb2xlYW47XG4gIC8qKiBcdTUzOUZcdTRFRkJcdTUyQTFcdTYwNjJcdTU5MERcdThCQjBcdTVGNTVcdUZGMUFjYW5vbmljYWwgXHU1RThGXHU1MjE3XHU1MzE2XHU1NDBFXHU3Njg0IFRhc2sgSlNPTiBcdTVCNTdcdTdCMjZcdTRFMzJcdTMwMDIgKi9cbiAgcmVzdG9yZVRhc2s6IHN0cmluZyB8IG51bGw7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU4QkExXHU1MjEyXHU2NTg3XHU0RUY2IHY2IC0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBQbGFuUHJvamVjdCB7XG4gIGlkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgY29sb3I6IHN0cmluZztcbiAgLyoqIFx1NUU4Rlx1NTIxN1x1NTMxNlx1NjVGNiBudWxsIFx1NzcwMVx1NzU2NVx1RkYxQlx1NjNEMFx1NEY5Qlx1NjVGNlx1NUJGQ1x1NTE2NVx1NEYxQVx1ODk4Nlx1NzZENlx1NjcyQ1x1NjczQVx1NkUwNVx1NTM1NVx1MzAwMiAqL1xuICBhcHBXaGl0ZWxpc3Q6IHN0cmluZ1tdIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbGFuU3VidGFzayB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGxhblRhc2sge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICB0ZW1wbGF0ZUlkOiBzdHJpbmcgfCBudWxsO1xuICBoYWJpdElkOiBzdHJpbmcgfCBudWxsO1xuICByZWN1cnJpbmc6IGJvb2xlYW47XG4gIHNjcmFwTWludXRlczogbnVtYmVyO1xuICBub3Rlczogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZyB8IG51bGw7XG4gIGR1ZURhdGU6IHN0cmluZyB8IG51bGw7XG4gIC8qKiBcdTVFOEZcdTUyMTdcdTUzMTZcdTY1RjYgbnVsbCBcdTc3MDFcdTc1NjVcdTMwMDIgKi9cbiAgcmVtaW5kZXJUaW1lOiBzdHJpbmcgfCBudWxsO1xuICAvKiogXHU1RThGXHU1MjE3XHU1MzE2XHU2NUY2IG51bGwgXHU3NzAxXHU3NTY1XHUzMDAyICovXG4gIGZvY3VzTWludXRlczogbnVtYmVyIHwgbnVsbDtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgZXN0aW1hdGU6IG51bWJlcjtcbiAgdGFnczogc3RyaW5nW107XG4gIHN1YnRhc2tzOiBQbGFuU3VidGFza1tdO1xuICByZXBlYXQ6IFJlcGVhdDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbGFuRmlsZSB7XG4gIGZvcm1hdDogc3RyaW5nO1xuICB2ZXJzaW9uOiBudW1iZXI7XG4gIHBvbW9kb3JvTWludXRlczogbnVtYmVyO1xuICBwcm9qZWN0czogUGxhblByb2plY3RbXTtcbiAgdGFza3M6IFBsYW5UYXNrW107XG4gIGJsb2NrczogQmxvY2tbXTtcbiAgdGVtcGxhdGVzOiBUZW1wbGF0ZVtdO1xuICBwcmludHM6IFByaW50UmVjb3JkW107XG4gIGhhYml0czogSGFiaXRbXTtcbiAgLyoqIFx1NUU4Rlx1NTIxN1x1NTMxNlx1NjVGNiBmYWxzZSBcdTc3MDFcdTc1NjVcdTMwMDIgKi9cbiAgcmVwbGFjZTogYm9vbGVhbjtcbn1cblxuLy8gLS0tLS0tLS0tLSBcdTY1NTlcdTVCNjYgLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBSZXNvdXJjZUtpbmQgPVxuICB8IFwic3lsbGFidXNcIlxuICB8IFwiY291cnNlXCJcbiAgfCBcImJvb2tcIlxuICB8IFwicGFzdFBhcGVyXCJcbiAgfCBcIm1vY2tQYXBlclwiXG4gIHwgXCJyZWZlcmVuY2VcIlxuICB8IFwiYXR0YWNobWVudFwiXG4gIHwgXCJhbnN3ZXJTaGVldFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2plY3RTdHVkeSB7XG4gIHByb2plY3RJZDogc3RyaW5nO1xuICBkaXJlY3Rvcnk6IHN0cmluZztcbiAgZXhhbU1vZGU6IGJvb2xlYW47XG4gIHZpc2lvbklkOiBzdHJpbmcgfCBudWxsO1xuICB0YXJnZXQ6IHN0cmluZztcbiAgZXhhbURhdGU6IHN0cmluZyB8IG51bGw7XG4gIHN5bGxhYnVzSWQ6IHN0cmluZyB8IG51bGw7XG4gIHBhc3RQYXBlcklkczogc3RyaW5nW107XG4gIG1vY2tQYXBlcklkczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb3VyY2Uge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAga2luZDogUmVzb3VyY2VLaW5kO1xuICAvKiogXHU3NkY4XHU1QkY5XHU5ODc5XHU3NkVFXHU2Mzg4XHU2NzQzXHU3NkVFXHU1RjU1XHVGRjFCXHU2QzM4XHU0RTBEXHU2Mzg4XHU0RTg4XHU2NTg3XHU0RUY2XHU3Q0ZCXHU3RURGXHU4QkJGXHU5NUVFXHUzMDAyICovXG4gIHBhdGg6IHN0cmluZztcbiAgc291cmNlOiBzdHJpbmc7XG4gIGVkaXRpb246IHN0cmluZztcbiAgdG9waWNzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNaWxlc3RvbmUge1xuICB3ZWVrOiBudW1iZXI7XG4gIHRvcGljczogc3RyaW5nW107XG4gIHJlc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgb2JqZWN0aXZlOiBzdHJpbmc7XG4gIGxlc3NvbkNvdW50OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VtZXN0ZXIge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgc3RhcnREYXRlOiBzdHJpbmc7XG4gIGVuZERhdGU6IHN0cmluZztcbiAgcmV2aXNpb246IG51bWJlcjtcbiAgYmFzZWxpbmU6IHN0cmluZztcbiAgZXZpZGVuY2U6IHN0cmluZ1tdO1xuICByYXRpb25hbGU6IHN0cmluZztcbiAgbWlsZXN0b25lczogTWlsZXN0b25lW107XG59XG5cbmV4cG9ydCB0eXBlIExlc3NvblN0YXRlID0gXCJwbGFubmVkXCIgfCBcImFjdGl2ZVwiIHwgXCJlbmRlZFwiIHwgXCJtaXNzZWRcIjtcblxuZXhwb3J0IGludGVyZmFjZSBMZXNzb24ge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgc2VtZXN0ZXJJZDogc3RyaW5nO1xuICBzZW1lc3RlclJldmlzaW9uOiBudW1iZXI7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHRvcGljczogc3RyaW5nW107XG4gIHJlc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgc3RhcnRzQXQ6IG51bWJlcjtcbiAgZW5kc0F0OiBudW1iZXI7XG4gIGFpRW5hYmxlZDogYm9vbGVhbjtcbiAgYXR0ZW5kZWQ6IGJvb2xlYW47XG4gIHByb2dyZXNzOiBzdHJpbmc7XG4gIHN0YXRlOiBMZXNzb25TdGF0ZTtcbn1cblxuZXhwb3J0IHR5cGUgQXNzZXNzbWVudEtpbmQgPSBcImhvbWV3b3JrXCIgfCBcIndlZWtseUV4YW1cIiB8IFwibW9ja0V4YW1cIiB8IFwicmV0ZXN0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NvcmluZ1BvaW50IHtcbiAgaWQ6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgcG9pbnRzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlc3Rpb24ge1xuICBpZDogc3RyaW5nO1xuICBwcm9tcHQ6IHN0cmluZztcbiAgdG9waWNzOiBzdHJpbmdbXTtcbiAgc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgZXh0ZW5zaW9uOiBib29sZWFuO1xuICBlc3RpbWF0ZWRNaW51dGVzOiBudW1iZXI7XG4gIGFuc3dlcjogc3RyaW5nO1xuICBhY2NlcHRhYmxlQWx0ZXJuYXRpdmVzOiBzdHJpbmc7XG4gIHNjb3Jpbmc6IFNjb3JpbmdQb2ludFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFzc2Vzc21lbnQge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgc2VtZXN0ZXJJZDogc3RyaW5nO1xuICBzZW1lc3RlclJldmlzaW9uOiBudW1iZXI7XG4gIGxlc3NvbklkOiBzdHJpbmcgfCBudWxsO1xuICB0YXNrSWQ6IHN0cmluZyB8IG51bGw7XG4gIHJldGVzdE9mR3JhZGVJZDogc3RyaW5nIHwgbnVsbDtcbiAgdGl0bGU6IHN0cmluZztcbiAga2luZDogQXNzZXNzbWVudEtpbmQ7XG4gIHJldmlzaW9uOiBudW1iZXI7XG4gIHN0YXJ0c0F0OiBudW1iZXI7XG4gIGVuZHNBdDogbnVtYmVyO1xuICBpbnN0cnVjdGlvbnM6IHN0cmluZztcbiAgcmV2aWV3RXZpZGVuY2U6IHN0cmluZztcbiAgcXVlc3Rpb25zOiBRdWVzdGlvbltdO1xuICBwdWJsaXNoZWRBdDogbnVtYmVyO1xuICBwcmludGVkQXQ6IG51bWJlciB8IG51bGw7XG4gIHN0YXJ0ZWRBdDogbnVtYmVyIHwgbnVsbDtcbiAgc3RvcHBlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1Ym1pc3Npb24ge1xuICBpZDogc3RyaW5nO1xuICBhc3Nlc3NtZW50SWQ6IHN0cmluZztcbiAgc3VibWl0dGVkQXQ6IG51bWJlcjtcbiAgcmVzb3VyY2VJZHM6IHN0cmluZ1tdO1xuICBhbnN3ZXJzOiBzdHJpbmc7XG4gIHVuZmluaXNoZWQ6IGJvb2xlYW47XG4gIC8qKiBcdTY3MkNcdTY3M0FcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcdUZGMENcdTRFMERcdTY2MkZcdTY1RjZcdTk1N0ZcdTMwMDIgKi9cbiAgcXVlc3Rpb25UaW1lczogUXVlc3Rpb25UaW1lW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVlc3Rpb25UaW1lIHtcbiAgcXVlc3Rpb25JZDogc3RyaW5nO1xuICBsb2NhbFRpbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQb2ludEF3YXJkIHtcbiAgcXVlc3Rpb25JZDogc3RyaW5nO1xuICBwb2ludElkOiBzdHJpbmc7XG4gIGF3YXJkZWQ6IG51bWJlcjtcbiAgZXZpZGVuY2U6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFcnJvckFuYWx5c2lzIHtcbiAgcXVlc3Rpb25JZDogc3RyaW5nO1xuICBjYXVzZTogc3RyaW5nO1xuICBldmlkZW5jZTogc3RyaW5nO1xuICBjb3JyZWN0aW9uOiBzdHJpbmc7XG4gIG5leHRDaGVjazogc3RyaW5nO1xuICByZXRlc3REYXRlOiBzdHJpbmc7XG4gIGNvbmZpcm1lZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHcmFkZSB7XG4gIGlkOiBzdHJpbmc7XG4gIHN1Ym1pc3Npb25JZDogc3RyaW5nO1xuICBhc3Nlc3NtZW50UmV2aXNpb246IG51bWJlcjtcbiAgZ3JhZGVkQXQ6IG51bWJlcjtcbiAgYXdhcmRzOiBQb2ludEF3YXJkW107XG4gIGVycm9yczogRXJyb3JBbmFseXNpc1tdO1xuICBuZWVkc1JldmlldzogYm9vbGVhbjtcbiAgZmVlZGJhY2s6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXZpZXcge1xuICBpZDogc3RyaW5nO1xuICBkYXRlOiBzdHJpbmc7XG4gIHByb2plY3RJZDogc3RyaW5nO1xuICBncmFkZUlkczogc3RyaW5nW107XG4gIGZpbmRpbmdzOiBzdHJpbmc7XG4gIGFjdGlvbnM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlYWNoaW5nRXZlbnQge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAga2luZDogc3RyaW5nO1xuICBzb3VyY2VJZDogc3RyaW5nO1xuICBzdGF0ZTogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgVGVhY2hpbmdUYXNrS2luZCA9IFwibGVzc29uXCIgfCBcImhvbWV3b3JrXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVhY2hpbmdUYXNrIHtcbiAgdGFza0lkOiBzdHJpbmc7XG4gIHNvdXJjZUlkOiBzdHJpbmc7XG4gIGtpbmQ6IFRlYWNoaW5nVGFza0tpbmQ7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU1QjY2XHU2MEM1XHU4QkMxXHU2MzZFIC0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBDb21wbGV0ZWRTdHVkeVRhc2sge1xuICBpZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgbm90ZXM6IHN0cmluZztcbiAgdG9waWNzOiBzdHJpbmdbXTtcbiAgY29tcGxldGVkQXQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgUHJvZ3Jlc3NTb3VyY2UgPSBcInVzZXJcIiB8IFwiYXNzaXN0YW50XCI7XG5leHBvcnQgdHlwZSBQcm9ncmVzc1N0YXRlID0gXCJzdHVkaWVkXCIgfCBcInByYWN0aWNpbmdcIiB8IFwibmVlZHNSZXZpZXdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcm9ncmVzc1JlY29yZCB7XG4gIGlkOiBzdHJpbmc7XG4gIHByb2plY3RJZDogc3RyaW5nO1xuICB0b3BpYzogc3RyaW5nO1xuICBwb3NpdGlvbjogc3RyaW5nO1xuICBzdGF0ZTogUHJvZ3Jlc3NTdGF0ZTtcbiAgZXZpZGVuY2U6IHN0cmluZztcbiAgbmV4dEFjdGlvbjogc3RyaW5nO1xuICBzb3VyY2U6IFByb2dyZXNzU291cmNlO1xuICBjb25maXJtZWQ6IGJvb2xlYW47XG4gIHJlY29yZGVkQXQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb3JyZWN0aW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgZ3JhZGVJZDogc3RyaW5nO1xuICBxdWVzdGlvbklkOiBzdHJpbmc7XG4gIGV4cGxhbmF0aW9uOiBzdHJpbmc7XG4gIHJlc291cmNlSWRzOiBzdHJpbmdbXTtcbiAgc3VibWl0dGVkQXQ6IG51bWJlcjtcbiAgYWNjZXB0ZWQ6IGJvb2xlYW4gfCBudWxsO1xuICBmZWVkYmFjazogc3RyaW5nO1xuICByZXZpZXdlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG4vLyAtLS0tLS0tLS0tIFx1NUI4OFx1NjJBNFx1N0VBRlx1OEJBMVx1N0I5N1x1OTBFOFx1NTIwNlx1RkYwOFx1N0E5N1x1NTNFM1x1OTZDNlx1NTQwOC9cdTc2N0RcdTU0MERcdTUzNTVcdTUyMjRcdTVCOUFcdUZGMUJcdTY1RTBcdTY4NENcdTk3NjJcdThDMDNcdTc1MjhcdUZGMDkgLS0tLS0tLS0tLVxuXG5leHBvcnQgaW50ZXJmYWNlIFdpbmRvdyB7XG4gIGlkOiBudW1iZXI7XG4gIGFwcElkOiBzdHJpbmcgfCBudWxsO1xuICB0aXRsZTogc3RyaW5nIHwgbnVsbDtcbiAgcGlkOiBudW1iZXIgfCBudWxsO1xuICBpc0ZvY3VzZWQ6IGJvb2xlYW47XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU1RkVCXHU3MTY3IC0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBTbmFwc2hvdCB7XG4gIHRhc2tLaW5kczogUmVjb3JkPHN0cmluZywgVGFza0tpbmQ+O1xuICBkYXRhOiBpbXBvcnQoXCIuL2xpYlwiKS5BcHBEYXRhO1xuICBzdHVkeVByb2dyZXNzOiB1bmtub3duW107XG4gIHN0YXRzOiBTdGF0cztcbiAgcmVtYWluaW5nU2VjczogbnVtYmVyO1xuICB0b2RheTogc3RyaW5nO1xuICBzZXJ2ZXJUaW1lOiBudW1iZXI7XG59XG4iLCAiLy8hIEpTT04gXHU0RTI1XHU2ODNDXHU4OUUzXHU3ODAxXHU1MkE5XHU2MjRCXHVGRjFBXHU2QTIxXHU2MkRGIHNlcmRlIFx1NzY4NCBgZGVueV91bmtub3duX2ZpZWxkc2BcdTMwMDFgI1tzZXJkZShkZWZhdWx0KV1gXG4vLyEgXHU0RTBFIGNhbWVsQ2FzZSBcdTU0N0RcdTU0MERcdTMwMDJcdTVFOEZcdTUyMTdcdTUzMTZcdTc1MzFcdTU0MDRcdTZBMjFcdTU3NTdcdTYyNEJcdTUxOTlcdUZGMDhcdTk1MkVcdTVFOEZcdTU2RkFcdTVCOUFcdTMwMDFcdTRFMEUgUnVzdCBcdTU4RjBcdTY2MEVcdTVFOEZcdTRFMDBcdTgxRjRcdUZGMDlcdUZGMENcbi8vISBcdTRGRERcdThCQzFcdTVCRkNcdTUxRkEgSlNPTiBcdTVGNjJcdTcyQjZcdTRFMEVcdTY1RTdcdTVGMTVcdTY0Q0VcdTkwMTBcdTVCNTdcdTgyODJcdTUzRUZcdTZCRDRcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi9lcnJvcnNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cblxuLyoqIGRlbnlfdW5rbm93bl9maWVsZHNcdUZGMUFcdTY3MkFcdTc3RTVcdTk1MkVcdTc2RjRcdTYzQTVcdTYyRDJcdTdFRERcdUZGMDhSdXN0IFx1NEYxQVx1NjJBNSB1bmtub3duIGZpZWxkXHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gcmVqZWN0VW5rbm93bihcbiAgb2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgYWxsb3dlZDogc3RyaW5nW10sXG4gIHdoYXQ6IHN0cmluZyxcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG4gICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihgXHU2NzJBXHU3N0U1XHU1QjU3XHU2QkI1XHVGRjFBJHt3aGF0fSBcdTRFMERcdTYzQTVcdTUzRDcgXCIke2tleX1cImApO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNTdHIodmFsdWU6IHVua25vd24sIHdoYXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHRocm93IG5ldyBBcHBFcnJvcihgJHt3aGF0fVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUI1N1x1N0IyNlx1NEUzMmApO1xuICByZXR1cm4gdmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc0Jvb2wodmFsdWU6IHVua25vd24sIHdoYXQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSBcImJvb2xlYW5cIikgdGhyb3cgbmV3IEFwcEVycm9yKGAke3doYXR9XHU1RkM1XHU5ODdCXHU2NjJGXHU1RTAzXHU1QzE0XHU1MDNDYCk7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzSW50KHZhbHVlOiB1bmtub3duLCB3aGF0OiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm51bWJlclwiIHx8ICFOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihgJHt3aGF0fVx1NUZDNVx1OTg3Qlx1NjYyRlx1NjU3NFx1NjU3MGApO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzQXJyYXkodmFsdWU6IHVua25vd24sIHdoYXQ6IHN0cmluZyk6IHVua25vd25bXSB7XG4gIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHRocm93IG5ldyBBcHBFcnJvcihgJHt3aGF0fVx1NUZDNVx1OTg3Qlx1NjYyRlx1NjU3MFx1N0VDNGApO1xuICByZXR1cm4gdmFsdWU7XG59XG5cbi8qKiBwYXJzZSBcdTdFREZcdTRFMDBcdTVFMjYgd2hhdFx1RkYwOFx1NEY5QiBhc1N0ci9hc0ludCBcdTdCNDlcdTc2RjRcdTYzQTVcdTRGMjBcdTUxNjVcdUZGMDlcdUZGMENcdTUzNTVcdTUzQzJcdTY1NzAgbGFtYmRhIFx1NTQwQ1x1NjgzN1x1NTE3Q1x1NUJCOVx1MzAwMiAqL1xuZXhwb3J0IHR5cGUgUGFyc2VyPFQ+ID0gKHY6IHVua25vd24sIHdoYXQ6IHN0cmluZykgPT4gVDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFzT3B0PFQ+KFxuICB2YWx1ZTogdW5rbm93bixcbiAgd2hhdDogc3RyaW5nLFxuICBwYXJzZTogUGFyc2VyPFQ+LFxuKTogVCB8IG51bGwge1xuICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiBudWxsO1xuICByZXR1cm4gcGFyc2UodmFsdWUsIHdoYXQpO1xufVxuXG4vKiogXHU4QkZCXHU1M0Q2XHU1QjU3XHU2QkI1XHVGRjFBXHU3RjNBXHU3NzAxXHU2NUY2XHU1RTk0XHU3NTI4IGRlZmF1bHRcdUZGMUJcdTVCNThcdTU3MjhcdUZGMDhcdTU0MkIgbnVsbFx1RkYwOVx1NjVGNlx1NjMwOSBwYXJzZSBcdTg5RTNcdTY3OTBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBmaWVsZDxUPihcbiAgb2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAga2V5OiBzdHJpbmcsXG4gIHdoYXQ6IHN0cmluZyxcbiAgcGFyc2U6IFBhcnNlcjxUPixcbiAgZGVmOiBULFxuKTogVCB7XG4gIGNvbnN0IHZhbHVlID0gb2JqW2tleV07XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZGVmO1xuICByZXR1cm4gcGFyc2UodmFsdWUsIHdoYXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVxdWlyZWRGaWVsZDxUPihcbiAgb2JqOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAga2V5OiBzdHJpbmcsXG4gIHdoYXQ6IHN0cmluZyxcbiAgcGFyc2U6IFBhcnNlcjxUPixcbik6IFQge1xuICBjb25zdCB2YWx1ZSA9IG9ialtrZXldO1xuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEFwcEVycm9yKGAke3doYXR9XHU3RjNBXHU1QzExXHU1RkM1XHU1ODZCXHU1QjU3XHU2QkI1ICR7a2V5fWApO1xuICByZXR1cm4gcGFyc2UodmFsdWUsIHdoYXQpO1xufVxuXG4vKiogXHU2NzlBXHU0RTNFXHU1QjU3XHU3QjI2XHU0RTMyXHU4OUUzXHU2NzkwXHVGRjA4c2VyZGUgcmVuYW1lX2FsbCA9IFwiY2FtZWxDYXNlXCIgXHU3Njg0XHU1M0Q2XHU1MDNDXHVGRjA5XHVGRjFCXHU2Q0RCXHU1NzhCXHU0RkREXHU3NTU5XHU1QjU3XHU5NzYyXHU5MUNGXHU4MDU0XHU1NDA4XHU0RUU1XHU0RkJGXHU1MjA2XHU2NTJGXHU2NTM2XHU3QTg0XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gb25lT2Y8VCBleHRlbmRzIHN0cmluZz4oXG4gIHZhbHVlOiB1bmtub3duLFxuICB3aGF0OiBzdHJpbmcsXG4gIGFsbG93ZWQ6IHJlYWRvbmx5IFRbXSxcbik6IFQge1xuICBjb25zdCBzID0gYXNTdHIodmFsdWUsIHdoYXQpO1xuICBpZiAoIShhbGxvd2VkIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhzKSlcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoYCR7d2hhdH1cdTUzRDZcdTUwM0NcdTY1RTBcdTY1NDhcdUZGMUEke3N9YCk7XG4gIHJldHVybiBzIGFzIFQ7XG59XG5cbi8qKiBcdTVCNTdcdTdCMjZcdTRFMzJcdTY1NzBcdTdFQzRcdUZGMDhcdTYzMDlcdTUxNDNcdTdEMjBcdTg5RTNcdTY3OTBcdUZGMDlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBhc1N0ckFycmF5KFxuICB2YWx1ZTogdW5rbm93bixcbiAgd2hhdDogc3RyaW5nLFxuICBwYXJzZTogUGFyc2VyPHN0cmluZz4sXG4pOiBzdHJpbmdbXSB7XG4gIHJldHVybiBhc0FycmF5KHZhbHVlLCB3aGF0KS5tYXAoKHYpID0+IHBhcnNlKHYsIHdoYXQpKTtcbn1cbiIsICIvLyEgXHU1QjlBXHU2NUY2XHU5NTAxXHU2NzNBXHVGRjFBXHU2NTcwXHU2MzZFXHU2QTIxXHU1NzhCXHUzMDAxXHU4REU4XHU1MzQ4XHU1OTFDXHU2NzJDXHU1NzMwXHU1NDY4XHU1Mzg2XHUzMDAxXHU5MUNEXHU1M0UwXHU2OEMwXHU2N0U1XHU0RTBFXHU2NzJDXHU4RjZFXHU2MjkxXHU1MjM2XHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9sb2NrLnJzXHUzMDAyKipcdTdFQUZcdThCQTFcdTdCOTcqKlx1MjAxNFx1MjAxNFx1Njg0Q1x1OTc2Mlx1OTUwMVx1NUM0Rlx1NjI2N1x1ODg0Q1x1NzUzMVx1NTM5Rlx1NzUxRiBndWFyZCBcdThEMUZcdThEMjNcdUZGMENcbi8vISBydW50aW1lIFx1NzUyOFx1NjcyQ1x1NkEyMVx1NTc1N1x1N0I5N1x1NTFGQSBhY3RpdmUgXHU3MkI2XHU2MDAxXHU1NDBFXHU2MzA3XHU2MzI1IGd1YXJkXHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yLCBlbnN1cmUgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7XG4gIGFzQXJyYXksXG4gIGFzQm9vbCxcbiAgYXNJbnQsXG4gIGFzT3B0LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICBvbmVPZixcbiAgcmVqZWN0VW5rbm93bixcbiAgcmVxdWlyZWRGaWVsZCxcbn0gZnJvbSBcIi4vanNvblwiO1xuaW1wb3J0IHR5cGUgeyBBY3RpdmVMb2NrLCBMb2NrU2NoZWR1bGUsIExvY2tTdGF0ZSB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQge1xuICBhZGREYXlzLFxuICBhdExvY2FsRGF0ZSxcbiAgbG9jYWxEYXRlT2YsXG4gIG1pbnV0ZXNPZixcbiAgcGFyc2VEYXRlLFxuICB3ZWVrZGF5TW9uZGF5LFxufSBmcm9tIFwiLi90aW1lXCI7XG5cbmNvbnN0IFNDSEVEVUxFX0tFWVMgPSBbXG4gIFwiaWRcIixcbiAgXCJuYW1lXCIsXG4gIFwic3RhcnRcIixcbiAgXCJlbmRcIixcbiAgXCJkYXlzXCIsXG4gIFwiZW5hYmxlZFwiLFxuICBcInN0cmljdFwiLFxuXSBhcyBjb25zdDtcbmNvbnN0IEFDVElWRV9LRVlTID0gW1wibmFtZVwiLCBcInN0YXJ0ZWRBdFwiLCBcImVuZHNBdFwiLCBcInN0cmljdFwiXSBhcyBjb25zdDtcbmNvbnN0IFNUQVRFX0tFWVMgPSBbXCJzY2hlZHVsZXNcIiwgXCJhY3RpdmVcIiwgXCJzdXBwcmVzc2VkVW50aWxcIl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUxvY2tTY2hlZHVsZShyYXc6IHVua25vd24pOiBMb2NrU2NoZWR1bGUge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTUwMVx1NjczQVx1ODlDNFx1NTIxOVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5TQ0hFRFVMRV9LRVlTXSwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU5NTAxXHU2NzNBXHU4OUM0XHU1MjE5XCIsIGFzU3RyKSxcbiAgICBuYW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJuYW1lXCIsIFwiXHU5NTAxXHU2NzNBXHU4OUM0XHU1MjE5XCIsIGFzU3RyKSxcbiAgICBzdGFydDogcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhcnRcIiwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIiwgYXNTdHIpLFxuICAgIGVuZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZW5kXCIsIFwiXHU5NTAxXHU2NzNBXHU4OUM0XHU1MjE5XCIsIGFzU3RyKSxcbiAgICBkYXlzOiBhc0FycmF5KFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwiZGF5c1wiLCBcIlx1OTUwMVx1NjczQVx1ODlDNFx1NTIxOVwiLCAodikgPT4gdiksXG4gICAgICBcImRheXNcIixcbiAgICApLm1hcCgoZCkgPT4gYXNJbnQoZCwgXCJcdTk1MDFcdTY3M0FcdTY2MUZcdTY3MUZcIikpLFxuICAgIGVuYWJsZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImVuYWJsZWRcIiwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIiwgYXNCb29sKSxcbiAgICBzdHJpY3Q6IGZpZWxkKHJhdywgXCJzdHJpY3RcIiwgXCJcdTk1MDFcdTY3M0FcdTg5QzRcdTUyMTlcIiwgYXNCb29sLCBmYWxzZSksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVMb2NrU2NoZWR1bGUoXG4gIHM6IExvY2tTY2hlZHVsZSxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogcy5pZCxcbiAgICBuYW1lOiBzLm5hbWUsXG4gICAgc3RhcnQ6IHMuc3RhcnQsXG4gICAgZW5kOiBzLmVuZCxcbiAgICBkYXlzOiBzLmRheXMsXG4gICAgZW5hYmxlZDogcy5lbmFibGVkLFxuICAgIHN0cmljdDogcy5zdHJpY3QsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFjdGl2ZUxvY2socmF3OiB1bmtub3duKTogQWN0aXZlTG9jayB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NTAxXHU2NzNBXHU3MkI2XHU2MDAxXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLkFDVElWRV9LRVlTXSwgXCJcdTk1MDFcdTY3M0FcdTcyQjZcdTYwMDFcIik7XG4gIHJldHVybiB7XG4gICAgbmFtZTogcmVxdWlyZWRGaWVsZChyYXcsIFwibmFtZVwiLCBcIlx1OTUwMVx1NjczQVx1NzJCNlx1NjAwMVwiLCBhc1N0ciksXG4gICAgc3RhcnRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdGFydGVkQXRcIiwgXCJcdTk1MDFcdTY3M0FcdTcyQjZcdTYwMDFcIiwgYXNJbnQpLFxuICAgIGVuZHNBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwiZW5kc0F0XCIsIFwiXHU5NTAxXHU2NzNBXHU3MkI2XHU2MDAxXCIsIGFzSW50KSxcbiAgICBzdHJpY3Q6IHJlcXVpcmVkRmllbGQocmF3LCBcInN0cmljdFwiLCBcIlx1OTUwMVx1NjczQVx1NzJCNlx1NjAwMVwiLCBhc0Jvb2wpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQWN0aXZlTG9jayhhOiBBY3RpdmVMb2NrKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGEubmFtZSxcbiAgICBzdGFydGVkQXQ6IGEuc3RhcnRlZEF0LFxuICAgIGVuZHNBdDogYS5lbmRzQXQsXG4gICAgc3RyaWN0OiBhLnN0cmljdCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTG9ja1N0YXRlKHJhdzogdW5rbm93bik6IExvY2tTdGF0ZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NTAxXHU2NzNBXHU5MTREXHU3RjZFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlNUQVRFX0tFWVNdLCBcIlx1OTUwMVx1NjczQVx1OTE0RFx1N0Y2RVwiKTtcbiAgcmV0dXJuIHtcbiAgICBzY2hlZHVsZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzY2hlZHVsZXNcIixcbiAgICAgIFwiXHU5NTAxXHU2NzNBXHU5MTREXHU3RjZFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInNjaGVkdWxlc1wiKS5tYXAocGFyc2VMb2NrU2NoZWR1bGUpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBhY3RpdmU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJhY3RpdmVcIixcbiAgICAgIFwiXHU5NTAxXHU2NzNBXHU5MTREXHU3RjZFXCIsXG4gICAgICAodikgPT4gKHYgPT09IG51bGwgPyBudWxsIDogcGFyc2VBY3RpdmVMb2NrKHYpKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBBY3RpdmVMb2NrIHwgbnVsbCxcbiAgICBzdXBwcmVzc2VkVW50aWw6IGZpZWxkKHJhdywgXCJzdXBwcmVzc2VkVW50aWxcIiwgXCJcdTk1MDFcdTY3M0FcdTkxNERcdTdGNkVcIiwgYXNJbnQsIDApLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplTG9ja1N0YXRlKHM6IExvY2tTdGF0ZSk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBzY2hlZHVsZXM6IHMuc2NoZWR1bGVzLm1hcChzZXJpYWxpemVMb2NrU2NoZWR1bGUpLFxuICAgIC8vIFx1NEUwRSBSdXN0IFx1NEUwMFx1ODFGNFx1RkYxQU9wdGlvbiBcdTc2RjRcdTYzQTVcdTVFOEZcdTUyMTdcdTUzMTZcdUZGMENOb25lIFx1NjYzRVx1NUYwRlx1NTE5OSBcImFjdGl2ZVwiOiBudWxsXHVGRjA4c2VyZGUgXHU0RTI0XHU3QUVGXHU2M0E1XHU1M0Q3XHVGRjA5XHUzMDAyXG4gICAgYWN0aXZlOiBzLmFjdGl2ZSA9PT0gbnVsbCA/IG51bGwgOiBzZXJpYWxpemVBY3RpdmVMb2NrKHMuYWN0aXZlKSxcbiAgICBzdXBwcmVzc2VkVW50aWw6IHMuc3VwcHJlc3NlZFVudGlsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVMb2NrKHN0YXRlOiBMb2NrU3RhdGUpOiB2b2lkIHtcbiAgaWYgKHN0YXRlLnNjaGVkdWxlcy5sZW5ndGggPiAyMCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjcwMFx1NTkxQVx1OEJCRVx1N0Y2RSAyMCBcdTRFMkFcdTk1MDFcdTY3M0FcdTY1RjZcdTZCQjVcIik7XG4gIH1cbiAgY29uc3QgaWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IG9jY3VwaWVkID0gbmV3IEFycmF5PGJvb2xlYW4+KDcgKiAxNDQwKS5maWxsKGZhbHNlKTtcbiAgZm9yIChjb25zdCBzIG9mIHN0YXRlLnNjaGVkdWxlcykge1xuICAgIGlmIChcbiAgICAgIHMuaWQubGVuZ3RoID09PSAwIHx8XG4gICAgICBpZHMuaGFzKHMuaWQpIHx8XG4gICAgICBzLm5hbWUudHJpbSgpLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgQXJyYXkuZnJvbShzLm5hbWUpLmxlbmd0aCA+IDQwXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk1MDFcdTY3M0FcdTU0MERcdTc5RjBcdTk3MDBcdTRFM0EgMVx1MjAxMzQwIFx1NUI1N1x1N0IyNlx1RkYwQ0lEIFx1OTcwMFx1NTUyRlx1NEUwMFx1NEUxNFx1OTc1RVx1N0E3QVwiKTtcbiAgICB9XG4gICAgaWRzLmFkZChzLmlkKTtcbiAgICBpZiAoXG4gICAgICBtaW51dGVzT2Yocy5zdGFydCkgPT09IG51bGwgfHxcbiAgICAgIG1pbnV0ZXNPZihzLmVuZCkgPT09IG51bGwgfHxcbiAgICAgIHMuc3RhcnQgPT09IHMuZW5kXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk1MDFcdTY3M0FcdTY1RjZcdTk1RjRcdTk3MDBcdTRFM0FcdTY3MDlcdTY1NDggSEg6TU1cdUZGMENcdTVGMDBcdTU5Q0JcdTRFMEVcdTdFRDNcdTY3NUZcdTRFMERcdTgwRkRcdTc2RjhcdTU0MENcIik7XG4gICAgfVxuICAgIGNvbnN0IHVuaXF1ZSA9IG5ldyBTZXQocy5kYXlzKTtcbiAgICBpZiAoXG4gICAgICBzLmRheXMubGVuZ3RoID09PSAwIHx8XG4gICAgICBzLmRheXMubGVuZ3RoID4gNyB8fFxuICAgICAgdW5pcXVlLnNpemUgIT09IHMuZGF5cy5sZW5ndGggfHxcbiAgICAgIHMuZGF5cy5zb21lKChkKSA9PiBkIDwgMSB8fCBkID4gNylcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGN1x1OTAwOVx1NjJFOVx1NEUwRFx1OTFDRFx1NTkwRFx1NzY4NFx1NjYxRlx1NjcxRlx1RkYwOFx1NTQ2OFx1NEUwMFx1NEUzQSAxXHVGRjBDXHU1NDY4XHU2NUU1XHU0RTNBIDdcdUZGMDlcIik7XG4gICAgfVxuICAgIGlmIChzLmVuYWJsZWQpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gbWludXRlc09mKHMuc3RhcnQpITtcbiAgICAgIGNvbnN0IGVuZCA9IG1pbnV0ZXNPZihzLmVuZCkhO1xuICAgICAgY29uc3QgZHVyYXRpb24gPSAoZW5kICsgMTQ0MCAtIHN0YXJ0KSAlIDE0NDA7XG4gICAgICBmb3IgKGNvbnN0IGRheSBvZiBzLmRheXMpIHtcbiAgICAgICAgZm9yIChsZXQgb2Zmc2V0ID0gMDsgb2Zmc2V0IDwgZHVyYXRpb247IG9mZnNldCArPSAxKSB7XG4gICAgICAgICAgY29uc3QgbWludXRlID0gKChkYXkgLSAxKSAqIDE0NDAgKyBzdGFydCArIG9mZnNldCkgJSAoNyAqIDE0NDApO1xuICAgICAgICAgIGlmIChvY2N1cGllZFttaW51dGVdKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTU0MkZcdTc1MjhcdTc2ODRcdTk1MDFcdTY3M0FcdTY1RjZcdTZCQjVcdTRFMERcdTgwRkRcdTkxQ0RcdTUzRTBcdUZGMENcdThCRjdcdThDMDNcdTY1NzRcdTY1RTVcdTY3MUZcdTYyMTZcdTY1RjZcdTk1RjRcIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9jY3VwaWVkW21pbnV0ZV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChzdGF0ZS5hY3RpdmUgIT09IG51bGwpIHtcbiAgICBjb25zdCBhID0gc3RhdGUuYWN0aXZlO1xuICAgIGlmIChcbiAgICAgIGEubmFtZS50cmltKCkubGVuZ3RoID09PSAwIHx8XG4gICAgICBBcnJheS5mcm9tKGEubmFtZSkubGVuZ3RoID4gNDAgfHxcbiAgICAgIGEuZW5kc0F0IDw9IGEuc3RhcnRlZEF0IHx8XG4gICAgICBhLmVuZHNBdCAtIGEuc3RhcnRlZEF0ID4gOCAqIDg2NDAwXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTk1MDFcdTY3M0FcdTcyQjZcdTYwMDFcIik7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogXHU1RjUzXHU1MjREXHU2NUY2XHU1MjNCXHU1NDdEXHU0RTJEXHU3Njg0XHU1NDJGXHU3NTI4XHU4OUM0XHU1MjE5IFx1MjE5MiBcdTU0MDhcdTVFNzZcdTU0MEVcdTc2ODQgQWN0aXZlTG9ja1x1RkYxQlx1ODhBQlx1NjI5MVx1NTIzNlx1NjIxNlx1NjcyQVx1NTQ3RFx1NEUyRFx1OEZENFx1NTZERSBudWxsXHUzMDAyXG4gKiBcdTY2MUZcdTY3MUZcdTVGNTJcdTVDNUVcdTVGMDBcdTU5Q0JcdTY1RTVcdTY3MUZcdUZGMUFcdThERThcdTUzNDhcdTU5MUNcdTg5QzRcdTUyMTlcdTYzMDlcdTVGMDBcdTU5Q0JcdTY1RTVcdTUzQzJcdTRFMEVcdTUzMzlcdTkxNERcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNjaGVkdWxlZEF0KHN0YXRlOiBMb2NrU3RhdGUsIGF0OiBudW1iZXIpOiBBY3RpdmVMb2NrIHwgbnVsbCB7XG4gIGlmIChhdCA8IHN0YXRlLnN1cHByZXNzZWRVbnRpbCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHRvZGF5ID0gbG9jYWxEYXRlT2YoYXQpO1xuICBsZXQgcmVzdWx0OiBBY3RpdmVMb2NrIHwgbnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3QgZGF0ZSBvZiBbYWRkRGF5cyh0b2RheSwgLTEpLCB0b2RheV0pIHtcbiAgICBjb25zdCB3ZWVrZGF5ID0gd2Vla2RheU1vbmRheShkYXRlKTtcbiAgICBmb3IgKGNvbnN0IHMgb2Ygc3RhdGUuc2NoZWR1bGVzKSB7XG4gICAgICBpZiAoIXMuZW5hYmxlZCB8fCAhcy5kYXlzLmluY2x1ZGVzKHdlZWtkYXkpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG1pbnV0ZXNPZihzLnN0YXJ0KTtcbiAgICAgIGNvbnN0IGVuZFRpbWUgPSBtaW51dGVzT2Yocy5lbmQpO1xuICAgICAgaWYgKHN0YXJ0VGltZSA9PT0gbnVsbCB8fCBlbmRUaW1lID09PSBudWxsKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGVuZERhdGUgPSBlbmRUaW1lIDw9IHN0YXJ0VGltZSA/IGFkZERheXMoZGF0ZSwgMSkgOiBkYXRlO1xuICAgICAgY29uc3Qgc3RhcnQgPSBhdExvY2FsRGF0ZShcbiAgICAgICAgZGF0ZSxcbiAgICAgICAgTWF0aC5mbG9vcihzdGFydFRpbWUgLyA2MCksXG4gICAgICAgIHN0YXJ0VGltZSAlIDYwLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGVuZCA9IGF0TG9jYWxEYXRlKGVuZERhdGUsIE1hdGguZmxvb3IoZW5kVGltZSAvIDYwKSwgZW5kVGltZSAlIDYwKTtcbiAgICAgIGlmIChhdCA+PSBzdGFydCAmJiBhdCA8IGVuZCkge1xuICAgICAgICBpZiAocmVzdWx0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmVzdWx0LnN0YXJ0ZWRBdCA9IE1hdGgubWluKHJlc3VsdC5zdGFydGVkQXQsIHN0YXJ0KTtcbiAgICAgICAgICByZXN1bHQuZW5kc0F0ID0gTWF0aC5tYXgocmVzdWx0LmVuZHNBdCwgZW5kKTtcbiAgICAgICAgICByZXN1bHQuc3RyaWN0ID0gcmVzdWx0LnN0cmljdCB8fCBzLnN0cmljdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSB7XG4gICAgICAgICAgICBuYW1lOiBzLm5hbWUsXG4gICAgICAgICAgICBzdGFydGVkQXQ6IHN0YXJ0LFxuICAgICAgICAgICAgZW5kc0F0OiBlbmQsXG4gICAgICAgICAgICBzdHJpY3Q6IHMuc3RyaWN0LFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIFx1NjNEMFx1NTI0RFx1N0VEM1x1Njc1Rlx1NUMwRlx1NjFBOVx1NEUwRFx1NUY5N1x1NTQxRVx1NjM4OVx1NjVFMFx1NTE3M1x1NzY4NFx1NTQwRVx1N0VFRFx1Nzc2MVx1NzcyMFx1NjVGNlx1NkJCNVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2VMb2NrKHN0YXRlOiBMb2NrU3RhdGUsIGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgY29uc3Qgc2NoZWR1bGVkID0gc2NoZWR1bGVkQXQoc3RhdGUsIGF0KTtcbiAgaWYgKHNjaGVkdWxlZCAhPT0gbnVsbCkge1xuICAgIHN0YXRlLnN1cHByZXNzZWRVbnRpbCA9IE1hdGgubWF4KHN0YXRlLnN1cHByZXNzZWRVbnRpbCwgc2NoZWR1bGVkLmVuZHNBdCk7XG4gIH1cbiAgc3RhdGUuYWN0aXZlID0gbnVsbDtcbn1cbiIsICIvLyEgXHU4QkZFXHU4ODY4XHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHVGRjFBXHU4QkExXHU1MjEyXHU0RTRCXHU1OTE2XHU3Njg0XHU2QkNGXHU1NDY4XHU1NkZBXHU1QjlBXHU1MzYwXHU3NTI4XHVGRjA4XHU4QkZFXHU3QTBCXHUzMDAxXHU1QjlFXHU5QThDXHVGRjA5XHUzMDAyXHU3RUFGXHU2M0NGXHU4RkYwXHVGRjFBXHU0RTBEXHU1RTI2XHU4RkRCXHU1RUE2XHUzMDAxXHU0RTBEXHU3QkExXHU4Rjk2XHU1QjlFXHU0RjhCXHUzMDAxXHU0RTBEXHU5NTAxXHU2NzNBXHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9ibG9ja3MucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7XG4gIGFzQXJyYXksXG4gIGFzSW50LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICBvbmVPZixcbiAgcmVqZWN0VW5rbm93bixcbiAgcmVxdWlyZWRGaWVsZCxcbn0gZnJvbSBcIi4vanNvblwiO1xuaW1wb3J0IHR5cGUgeyBBdHRlbnRpb24sIEJsb2NrIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IG1pbnV0ZXNPZiwgcGFyc2VEYXRlLCB3ZWVrZGF5TW9uZGF5IH0gZnJvbSBcIi4vdGltZVwiO1xuXG5jb25zdCBCTE9DS19LRVlTID0gW1xuICBcImlkXCIsXG4gIFwidGl0bGVcIixcbiAgXCJkYXlzXCIsXG4gIFwic3RhcnRcIixcbiAgXCJlbmRcIixcbiAgXCJhdHRlbnRpb25cIixcbiAgXCJub3Rlc1wiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQmxvY2socmF3OiB1bmtub3duKTogQmxvY2sge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5CTE9DS19LRVlTXSwgXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcIiwgYXNTdHIpLFxuICAgIGRheXM6IGFzQXJyYXkoXG4gICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJkYXlzXCIsIFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XCIsICh2KSA9PiB2KSxcbiAgICAgIFwiZGF5c1wiLFxuICAgICkubWFwKChkKSA9PiBhc0ludChkLCBcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVx1NjYxRlx1NjcxRlwiKSksXG4gICAgc3RhcnQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInN0YXJ0XCIsIFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XCIsIGFzU3RyKSxcbiAgICBlbmQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImVuZFwiLCBcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVwiLCBhc1N0ciksXG4gICAgYXR0ZW50aW9uOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiYXR0ZW50aW9uXCIsXG4gICAgICBcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNVwiLFxuICAgICAgKHYpID0+IG9uZU9mKHYsIFwiYXR0ZW50aW9uXCIsIFtcInJlcXVpcmVkXCIsIFwibGlnaHRcIl0pLFxuICAgICAgXCJyZXF1aXJlZFwiLFxuICAgICkgYXMgQXR0ZW50aW9uLFxuICAgIG5vdGVzOiBmaWVsZChyYXcsIFwibm90ZXNcIiwgXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcIiwgYXNTdHIsIFwiXCIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQmxvY2soYjogQmxvY2spOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGIuaWQsXG4gICAgdGl0bGU6IGIudGl0bGUsXG4gICAgZGF5czogYi5kYXlzLFxuICAgIHN0YXJ0OiBiLnN0YXJ0LFxuICAgIGVuZDogYi5lbmQsXG4gICAgYXR0ZW50aW9uOiBiLmF0dGVudGlvbixcbiAgICBub3RlczogYi5ub3RlcyxcbiAgfTtcbn1cblxuLyoqIFx1OEJFNVx1NjVFNVx1NjcxRlx1NTM0OFx1NTkxQ1x1OEQ3N1x1N0I5N1x1NzY4NCBgW3N0YXJ0LCBlbmQpYCBcdTUyMDZcdTk0OUZcdTdBOTdcdTUzRTNcdUZGMUJcdThERThcdTUzNDhcdTU5MUNcdTY1RjYgZW5kIFx1OEQ4NVx1OEZDNyAxNDQwXHVGRjFCXHU4QkU1XHU2NjFGXHU2NzFGXHU2NUUwXHU2QjY0XHU1MzYwXHU3NTI4XHU4RkQ0XHU1NkRFIG51bGxcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBiYW5kKFxuICBibG9jazogQmxvY2ssXG4gIGRhdGU6IHN0cmluZyxcbik6IHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfSB8IG51bGwge1xuICBjb25zdCBwYXJzZWQgPSBwYXJzZURhdGUoZGF0ZSk7XG4gIGlmIChwYXJzZWQgPT09IG51bGwpIHJldHVybiBudWxsO1xuICBpZiAoIWJsb2NrLmRheXMuaW5jbHVkZXMod2Vla2RheU1vbmRheShwYXJzZWQpKSkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHN0YXJ0ID0gbWludXRlc09mKGJsb2NrLnN0YXJ0KTtcbiAgY29uc3QgZW5kID0gbWludXRlc09mKGJsb2NrLmVuZCk7XG4gIGlmIChzdGFydCA9PT0gbnVsbCB8fCBlbmQgPT09IG51bGwpIHJldHVybiBudWxsO1xuICByZXR1cm4geyBzdGFydCwgZW5kOiBlbmQgPD0gc3RhcnQgPyBlbmQgKyAxNDQwIDogZW5kIH07XG59XG5cbi8qKiBcdTRFMEVcdTU0MENcdTY1RTUgYFtzdGFydCwgZW5kKWAgXHU3QTk3XHU1M0UzXHU5MUNEXHU1M0UwXHU3Njg0XHU1MjA2XHU5NDlGXHU2NTcwXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gb3ZlcmxhcE1pbnV0ZXMoXG4gIGJsb2NrOiBCbG9jayxcbiAgZGF0ZTogc3RyaW5nLFxuICBzdGFydDogbnVtYmVyLFxuICBlbmQ6IG51bWJlcixcbik6IG51bWJlciB7XG4gIGNvbnN0IGIgPSBiYW5kKGJsb2NrLCBkYXRlKTtcbiAgaWYgKGIgPT09IG51bGwpIHJldHVybiAwO1xuICByZXR1cm4gTWF0aC5taW4oZW5kLCBiLmVuZCkgLSBNYXRoLm1heChzdGFydCwgYi5zdGFydCkgPiAwXG4gICAgPyBNYXRoLm1pbihlbmQsIGIuZW5kKSAtIE1hdGgubWF4KHN0YXJ0LCBiLnN0YXJ0KVxuICAgIDogMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQmxvY2soYmxvY2s6IEJsb2NrKTogdm9pZCB7XG4gIGlmIChibG9jay5pZC5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjUgSUQgXHU0RTBEXHU4MEZEXHU0RTNBXHU3QTdBXCIpO1xuICB9XG4gIGlmIChibG9jay50aXRsZS50cmltKCkubGVuZ3RoID09PSAwIHx8IEFycmF5LmZyb20oYmxvY2sudGl0bGUpLmxlbmd0aCA+IDQwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHU1NDBEXHU3OUYwXHU5NzAwXHU0RTNBIDFcdTIwMTM0MCBcdTRFMkFcdTVCNTdcdTdCMjZcIik7XG4gIH1cbiAgaWYgKG1pbnV0ZXNPZihibG9jay5zdGFydCkgPT09IG51bGwgfHwgbWludXRlc09mKGJsb2NrLmVuZCkgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcdTk3MDBcdTRFM0FcdTY3MDlcdTY1NDhcdTc2ODQgSEg6TU0gXHU2NUY2XHU5NUY0XCIpO1xuICB9XG4gIGlmIChibG9jay5zdGFydCA9PT0gYmxvY2suZW5kKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHU3Njg0XHU1RjAwXHU1OUNCXHU0RTBFXHU3RUQzXHU2NzVGXHU0RTBEXHU4MEZEXHU3NkY4XHU1NDBDXCIpO1xuICB9XG4gIGNvbnN0IHVuaXF1ZSA9IG5ldyBTZXQoYmxvY2suZGF5cyk7XG4gIGlmIChcbiAgICBibG9jay5kYXlzLmxlbmd0aCA9PT0gMCB8fFxuICAgIGJsb2NrLmRheXMubGVuZ3RoID4gNyB8fFxuICAgIHVuaXF1ZS5zaXplICE9PSBibG9jay5kYXlzLmxlbmd0aCB8fFxuICAgIGJsb2NrLmRheXMuc29tZSgoZCkgPT4gZCA8IDEgfHwgZCA+IDcpXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGN1x1OTAwOVx1NjJFOVx1NEUwRFx1OTFDRFx1NTkwRFx1NzY4NFx1NjYxRlx1NjcxRlx1RkYwOFx1NTQ2OFx1NEUwMFx1NEUzQSAxXHVGRjBDXHU1NDY4XHU2NUU1XHU0RTNBIDdcdUZGMDlcIik7XG4gIH1cbiAgaWYgKEFycmF5LmZyb20oYmxvY2subm90ZXMpLmxlbmd0aCA+IDIwMDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk2M0JcdTU4NUVcdTY1RjZcdTZCQjVcdTU5MDdcdTZDRThcdThGQzdcdTk1N0ZcIik7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQmxvY2tzKGJsb2NrczogQmxvY2tbXSk6IHZvaWQge1xuICBpZiAoYmxvY2tzLmxlbmd0aCA+IDYwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkZFXHU4ODY4XHU5NjNCXHU1ODVFXHU2NUY2XHU2QkI1XHU2NzAwXHU1OTFBIDYwIFx1OTg3OVwiKTtcbiAgfVxuICBjb25zdCBpZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBibG9jayBvZiBibG9ja3MpIHtcbiAgICB2YWxpZGF0ZUJsb2NrKGJsb2NrKTtcbiAgICBpZiAoaWRzLmhhcyhibG9jay5pZCkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTYzQlx1NTg1RVx1NjVGNlx1NkJCNSBJRCBcdTkxQ0RcdTU5MERcIik7XG4gICAgfVxuICAgIGlkcy5hZGQoYmxvY2suaWQpO1xuICB9XG59XG5cbi8qKiBcdTg5ODZcdTc2RDYgYGRhdGVgIFx1NzY4NFx1NjVGNlx1NkJCNVx1RkYwQ1x1NjMwOVx1NUYwMFx1NTlDQlx1NjVGNlx1OTVGNFx1MzAwMVx1NTE4RFx1NjMwOVx1NjgwN1x1OTg5OFx1NjM5Mlx1NUU4Rlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJsb2Nrc09uRGF0ZShibG9ja3M6IEJsb2NrW10sIGRhdGU6IHN0cmluZyk6IEJsb2NrW10ge1xuICBpZiAocGFyc2VEYXRlKGRhdGUpID09PSBudWxsKSByZXR1cm4gW107XG4gIHJldHVybiBibG9ja3NcbiAgICAuZmlsdGVyKChiKSA9PiBiYW5kKGIsIGRhdGUpICE9PSBudWxsKVxuICAgIC5zbGljZSgpXG4gICAgLnNvcnQoKGEsIGIpID0+XG4gICAgICBhLnN0YXJ0IDwgYi5zdGFydFxuICAgICAgICA/IC0xXG4gICAgICAgIDogYS5zdGFydCA+IGIuc3RhcnRcbiAgICAgICAgICA/IDFcbiAgICAgICAgICA6IGEudGl0bGUgPCBiLnRpdGxlXG4gICAgICAgICAgICA/IC0xXG4gICAgICAgICAgICA6IGEudGl0bGUgPiBiLnRpdGxlXG4gICAgICAgICAgICAgID8gMVxuICAgICAgICAgICAgICA6IDAsXG4gICAgKTtcbn1cblxuLyoqIGBkYXRlYCBcdTVGNTNcdTU5MjlcdTk3MDBcdTRFMTNcdTVGQzNcdTY1RjZcdTZCQjVcdTUzNjBcdTc1MjhcdTc2ODRcdTUyMDZcdTk0OUZcdTY1NzBcdUZGMDhcdTUzNjBcdTc1MjhcdThCQzFcdTYzNkVcdUZGMENcdTkxQ0RcdTUzRTBcdTRGMUFcdTkxQ0RcdTU5MERcdThCQTFcdTY1NzBcdUZGMDlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlZE1pbnV0ZXMoYmxvY2tzOiBCbG9ja1tdLCBkYXRlOiBzdHJpbmcpOiBudW1iZXIge1xuICBpZiAocGFyc2VEYXRlKGRhdGUpID09PSBudWxsKSByZXR1cm4gMDtcbiAgbGV0IHRvdGFsID0gMDtcbiAgZm9yIChjb25zdCBiIG9mIGJsb2Nrcykge1xuICAgIGlmIChiLmF0dGVudGlvbiAhPT0gXCJyZXF1aXJlZFwiKSBjb250aW51ZTtcbiAgICBjb25zdCBiYW5kVmFsdWUgPSBiYW5kKGIsIGRhdGUpO1xuICAgIGlmIChiYW5kVmFsdWUgIT09IG51bGwpIHRvdGFsICs9IGJhbmRWYWx1ZS5lbmQgLSBiYW5kVmFsdWUuc3RhcnQ7XG4gIH1cbiAgcmV0dXJuIHRvdGFsO1xufVxuIiwgIi8vISBcdTRFNjBcdTYwRUZcdTdFQzRcdUZGMUFcdTUzRUFcdTVFMjZcdTdCQTFcdThGOTZcdUZGMUJcdTVGNjJcdTcyQjZcdTRFMEVcdTUzNzBcdTUyMzdcdTg5QzRcdTUyMTlcdTc1MzEgdGVtcGxhdGVzIFx1N0JBMVx1NzQwNlx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvaGFiaXRzLnJzXHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yLCBlbnN1cmUgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7IGFzU3RyLCBpc09iamVjdCwgcmVqZWN0VW5rbm93biwgcmVxdWlyZWRGaWVsZCB9IGZyb20gXCIuL2pzb25cIjtcbmltcG9ydCB0eXBlIHsgSGFiaXQgfSBmcm9tIFwiLi9tb2RlbFwiO1xuXG5jb25zdCBIQUJJVF9LRVlTID0gW1wiaWRcIiwgXCJuYW1lXCJdIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIYWJpdChyYXc6IHVua25vd24pOiBIYWJpdCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTYwXHU2MEVGXHU3RUM0XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLkhBQklUX0tFWVNdLCBcIlx1NEU2MFx1NjBFRlx1N0VDNFwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTRFNjBcdTYwRUZcdTdFQzRcIiwgYXNTdHIpLFxuICAgIG5hbWU6IHJlcXVpcmVkRmllbGQocmF3LCBcIm5hbWVcIiwgXCJcdTRFNjBcdTYwRUZcdTdFQzRcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplSGFiaXQoaDogSGFiaXQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IGlkOiBoLmlkLCBuYW1lOiBoLm5hbWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlSGFiaXQoaGFiaXQ6IEhhYml0KTogdm9pZCB7XG4gIGlmIChoYWJpdC5uYW1lLnRyaW0oKS5sZW5ndGggPT09IDAgfHwgQXJyYXkuZnJvbShoYWJpdC5uYW1lKS5sZW5ndGggPiA0MCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEU2MFx1NjBFRlx1NTQwRFx1NzlGMFx1OTcwMFx1NEUzQSAxXHUyMDEzNDAgXHU0RTJBXHU1QjU3XHU3QjI2XCIpO1xuICB9XG59XG4iLCAiLy8hIFx1NjVGNlx1OTVGNFx1NUI4OVx1NjM5Mlx1RkYxQVx1NjVFNVx1NjcxRi9cdTY1RjZcdTk1RjRcdTRFMEVcdTUzNTVcdTZCMjFcdTY1RjZcdTk1N0ZcdTY4MjFcdTlBOENcdTMwMDFcdTVGNTNcdTU5MjlcdTVGODVcdTU5MDRcdTc0MDZcdTk2MUZcdTUyMTdcdTMwMDFcdThCQTFcdTY1RjYvXHU5NTAxXHU2NzNBXHU1RUY2XHU1NDBFXHUzMDAxXHU4REU4XHU2NUU1XHU2RTA1XHU3NDA2XHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9yZW1pbmRlcnMucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7IGlkIH0gZnJvbSBcIi4vaWRzXCI7XG5pbXBvcnQgdHlwZSB7IEFwcERhdGEgfSBmcm9tIFwiLi9saWJcIjtcbmltcG9ydCB0eXBlIHsgU2V0dGluZ3MsIFRhc2ssIFRpbWVyIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IGlzSGFiaXQgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgZGF0ZUF0LCBtaW51dGVzT2YsIHNlY29uZHNPZkRheSwgdmFsaWREYXRlIH0gZnJvbSBcIi4vdGltZVwiO1xuXG4vKiogXHU0RUZCXHU1MkExXHU2NUU1XHU2NzFGXHU1RkM1XHU1ODZCXHUzMDAxXHU2M0QwXHU5MTkyXHU5NzAwXHU4OTgxXHU2NzA5XHU2NTQ4IEhIOk1NXHUzMDAxXHU1MzU1XHU2QjIxXHU2NUY2XHU5NTdGIDFcdTIwMTMxODBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVJlbWluZGVyVGFzayh0YXNrOiBUYXNrKTogdm9pZCB7XG4gIGlmICh0YXNrLmR1ZURhdGUgPT09IG51bGwgfHwgIXZhbGlkRGF0ZSh0YXNrLmR1ZURhdGUpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RUZCXHU1MkExXHU1RkM1XHU5ODdCXHU2MzA3XHU1QjlBXHU2NzA5XHU2NTQ4XHU3Njg0XHU4QkExXHU1MjEyXHU2NUU1XHU2NzFGXCIpO1xuICB9XG4gIGlmIChcbiAgICB0YXNrLmZvY3VzTWludXRlcyAhPT0gbnVsbCAmJlxuICAgICh0YXNrLmZvY3VzTWludXRlcyA8IDEgfHwgdGFzay5mb2N1c01pbnV0ZXMgPiAxODApXG4gICkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTM1NVx1NkIyMVx1NEUxM1x1NkNFOFx1NjVGNlx1OTU3Rlx1OTcwMFx1NEUzQTFcdTIwMTQxODBcdTUyMDZcdTk0OUZcIik7XG4gIH1cbiAgaWYgKHRhc2sucmVtaW5kZXJUaW1lICE9PSBudWxsKSB7XG4gICAgaWYgKHRhc2suZHVlRGF0ZSA9PT0gbnVsbCB8fCBtaW51dGVzT2YodGFzay5yZW1pbmRlclRpbWUpID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTYzRDBcdTkxOTJcdTk3MDBcdTg5ODFcdThCQTFcdTUyMTJcdTY1RTVcdTY3MUZcdTU0OENcdTY3MDlcdTY1NDhcdTc2ODQgSEg6TU0gXHU2NUY2XHU5NUY0XCIpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFx1OEJBMVx1NTIxMlx1NTc1N1x1NjAzQlx1OTU3Rlx1RkYxQVx1NTE2OFx1OTBFOFx1NEUxM1x1NkNFOFx1NkJCNVx1NTJBMFx1NkJCNVx1OTVGNFx1NEYxMVx1NjA2Rlx1RkYwQ1x1NTkxQVx1NzU2QVx1ODMwNFx1NEVGQlx1NTJBMVx1OERFOFx1NEYxMVx1NjA2Rlx1OTVGNFx1OTY5OVx1NEVDRFx1NjcwOVx1NjU0OFx1MzAwMlxuICogXHU1QkY5XHU1RTk0IHJlbWluZGVyczo6d2luZG93X21pbnV0ZXNcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpbmRvd01pbnV0ZXModGFzazogVGFzaywgc2V0dGluZ3M6IFNldHRpbmdzKTogbnVtYmVyIHtcbiAgY29uc3QgZm9jdXMgPSB0YXNrLmZvY3VzTWludXRlcyA/PyBzZXR0aW5ncy5mb2N1c01pbnV0ZXM7XG4gIGNvbnN0IHNlc3Npb25zID0gTWF0aC5tYXgoMSwgdGFzay5lc3RpbWF0ZSk7XG4gIGNvbnN0IGV2ZXJ5ID0gTWF0aC5tYXgoMSwgc2V0dGluZ3MubG9uZ0JyZWFrRXZlcnkpO1xuICBsZXQgYnJlYWtzID0gMDtcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBzZXNzaW9uczsgaSArPSAxKSB7XG4gICAgYnJlYWtzICs9XG4gICAgICBpICUgZXZlcnkgPT09IDAgPyBzZXR0aW5ncy5sb25nQnJlYWtNaW51dGVzIDogc2V0dGluZ3Muc2hvcnRCcmVha01pbnV0ZXM7XG4gIH1cbiAgcmV0dXJuIHNlc3Npb25zICogZm9jdXMgKyBicmVha3M7XG59XG5cbi8qKiBcdTdBN0FcdTk1RjJcdUZGMUFcdTY3MkFcdThGRDBcdTg4NENcdTMwMDFcdTY3MkFcdTVGMDBcdTU5Q0JcdTMwMDFcdTUyNjlcdTRGNTlcdTZFRTFcdTk4OURcdTMwMDFcdTY1RTBcdTk1MDFcdTY3M0FcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1pbmRlcklkbGUoZGF0YTogQXBwRGF0YSk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgICFkYXRhLnRpbWVyLnJ1bm5pbmcgJiZcbiAgICBkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgIGRhdGEudGltZXIucmVtYWluaW5nU2VjcyA9PT0gZGF0YS50aW1lci5kdXJhdGlvblNlY3MgJiZcbiAgICBkYXRhLmxvY2suYWN0aXZlID09PSBudWxsXG4gICk7XG59XG5cbi8qKiBcdTVGNTNcdTU5MjlcdTVGODVcdTU5MDRcdTc0MDZcdTYzRDBcdTkxOTJcdUZGMDhcdTYzMDkgXHU2NUU1XHU2NzFGXHUzMDAxXHU2NUY2XHU5NUY0XHUzMDAxSUQgXHU2MzkyXHU1RThGXHU1M0Q2XHU2NzAwXHU2NUU5XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gcGVuZGluZ1JlbWluZGVyKGRhdGE6IEFwcERhdGEpOiBUYXNrIHwgbnVsbCB7XG4gIGlmICghcmVtaW5kZXJJZGxlKGRhdGEpKSByZXR1cm4gbnVsbDtcbiAgbGV0IGJlc3Q6IFRhc2sgfCBudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCB0IG9mIGRhdGEudGFza3MpIHtcbiAgICBpZiAodC5jb21wbGV0ZWQgfHwgIXQucmVtaW5kZXJQZW5kaW5nKSBjb250aW51ZTtcbiAgICBpZiAoXG4gICAgICBiZXN0ID09PSBudWxsIHx8XG4gICAgICBgJHt0LmR1ZURhdGV9fCR7dC5yZW1pbmRlclRpbWV9fCR7dC5pZH1gIDxcbiAgICAgICAgYCR7YmVzdC5kdWVEYXRlfXwke2Jlc3QucmVtaW5kZXJUaW1lfXwke2Jlc3QuaWR9YFxuICAgICkge1xuICAgICAgYmVzdCA9IHQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBiZXN0O1xufVxuXG4vKiogXHU4MUVBXHU1MkE4XHU1RjAwXHU1REU1XHU1MDE5XHU5MDA5XHVGRjFBXHU2M0QwXHU5MTkyXHU1Rjg1XHU1OTA0XHU3NDA2XHU0RTE0XHU0RUNEXHU2NzA5XHU1MjY5XHU0RjU5XHU4RjZFXHU2QjIxXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gZHVlQXV0b1Rhc2soZGF0YTogQXBwRGF0YSk6IFRhc2sgfCBudWxsIHtcbiAgbGV0IGJlc3Q6IFRhc2sgfCBudWxsID0gbnVsbDtcbiAgZm9yIChjb25zdCB0IG9mIGRhdGEudGFza3MpIHtcbiAgICBpZiAoIXQucmVtaW5kZXJQZW5kaW5nIHx8ICF0YXNrSGFzUm91bmRzTGVmdChkYXRhLCB0KSkgY29udGludWU7XG4gICAgaWYgKFxuICAgICAgYmVzdCA9PT0gbnVsbCB8fFxuICAgICAgYCR7dC5kdWVEYXRlfXwke3QucmVtaW5kZXJUaW1lfXwke3QuaWR9YCA8XG4gICAgICAgIGAke2Jlc3QuZHVlRGF0ZX18JHtiZXN0LnJlbWluZGVyVGltZX18JHtiZXN0LmlkfWBcbiAgICApIHtcbiAgICAgIGJlc3QgPSB0O1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmVzdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhc2tIYXNSb3VuZHNMZWZ0KGRhdGE6IEFwcERhdGEsIHRhc2s6IFRhc2spOiBib29sZWFuIHtcbiAgaWYgKHRhc2suY29tcGxldGVkIHx8IHRhc2sucmVtaW5kZXJFeHBpcmVkKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNvbXBsZXRlZFJvdW5kcyA9IGRhdGEuc2Vzc2lvbnMuZmlsdGVyKFxuICAgIChzKSA9PiBzLnNvdXJjZSA9PT0gXCJ0aW1lclwiICYmIHMuY29tcGxldGVkICYmIHMudGFza0lkID09PSB0YXNrLmlkLFxuICApLmxlbmd0aDtcbiAgcmV0dXJuIGNvbXBsZXRlZFJvdW5kcyA8IHRhc2suZXN0aW1hdGU7XG59XG5cbi8qKiBcdTVCOUFcdTY1RjZcdTVGMDBcdTVERTVcdUZGMUFcdThCQTFcdTY1RjYvXHU2NjgyXHU1MDVDL1x1OTUwMVx1NjczQS9cdTgwMDNcdThCRDVcdTRFMkRcdTRFMERcdTYyQTJcdTUzNjBcdUZGMENcdThEODVcdThGQzdcdTRFRkJcdTUyQTFcdTY1RjZcdTZCQjVcdTRFMERcdTg4NjVcdTVGMDBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGFydER1ZVRhc2soZGF0YTogQXBwRGF0YSwgYXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICBpZiAoXG4gICAgIWRhdGEuc2V0dGluZ3MuYXV0b1N0YXJ0VGFza3MgfHxcbiAgICAhcmVtaW5kZXJJZGxlKGRhdGEpIHx8XG4gICAgZGF0YS5lZHVjYXRpb24uYXNzZXNzbWVudHMuc29tZShcbiAgICAgIChhKSA9PiBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJiBhLnN0b3BwZWRBdCA9PT0gbnVsbCxcbiAgICApXG4gICkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXNrID0gZHVlQXV0b1Rhc2soZGF0YSk7XG4gIGlmICh0YXNrID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGRhdGEudGltZXIudGFza0lkID0gdGFzay5pZDtcbiAgcmVzZXRUbyhkYXRhLCBcImZvY3VzXCIpO1xuICBzdGFydFRpbWVyKGRhdGEsIGF0KTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKiBcdTYzRDBcdTkxOTJcdTcyQjZcdTYwMDFcdTYzQThcdThGREJcdUZGMUFcdTUyMzBcdTY3MUYvXHU0RjVDXHU1RTlGL1x1NUY4NVx1NTkwNFx1NzQwNlx1RkYwQ1x1OERFOFx1NjVFNVx1NkUwNVx1NzQwNlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRpY2tSZW1pbmRlcnMoZGF0YTogQXBwRGF0YSwgYXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICBjb25zdCB0b2RheSA9IGRhdGVBdChhdCk7XG4gIGNvbnN0IG5vd01pbnV0ZXMgPSBNYXRoLmZsb29yKHNlY29uZHNPZkRheShhdCkgLyA2MCk7XG4gIGNvbnN0IG5vd1NlY29uZHMgPSBzZWNvbmRzT2ZEYXkoYXQpO1xuICBjb25zdCBzZXR0aW5ncyA9IGRhdGEuc2V0dGluZ3M7XG4gIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gIGZvciAoY29uc3QgdCBvZiBkYXRhLnRhc2tzKSB7XG4gICAgY29uc3QgaXNUb2RheSA9IHQuZHVlRGF0ZSA9PT0gdG9kYXk7XG4gICAgY29uc3QgcGFzdCA9IHQuZHVlRGF0ZSAhPT0gbnVsbCAmJiB0LmR1ZURhdGUgPCB0b2RheTtcbiAgICBjb25zdCBzdGFydCA9IHQucmVtaW5kZXJUaW1lICE9PSBudWxsID8gbWludXRlc09mKHQucmVtaW5kZXJUaW1lKSA6IG51bGw7XG4gICAgLy8gXHU1QjlBXHU2NUY2XHU0RUZCXHU1MkExXHU1NzI4XHU1MTc2XHU2NUU1XHU2NzFGXHU4RkM3XHU1M0JCXHU1NDBFXHUzMDAxXHU2MjE2XHU4QkExXHU1MjEyXHU1NzU3XHU3RUQzXHU2NzVGXHU1NDBFXHU0RjVDXHU1RTlGXHVGRjFCXHU2QjY0XHU1NDBFXHU2NUUyXHU0RTBEXHU2M0QwXHU5MTkyXHU0RTVGXHU0RTBEXHU5ODdBXHU1RUY2XHUzMDAyXG4gICAgY29uc3QgZXhwaXJlZCA9XG4gICAgICAhdC5jb21wbGV0ZWQgJiZcbiAgICAgIChzdGFydCAhPT0gbnVsbFxuICAgICAgICA/ICgoKSA9PiB7XG4gICAgICAgICAgICAvLyBcdTY2NkVcdTkwMUFcdTRFRkJcdTUyQTFcdTU3MjhcdThCQTFcdTUyMTJcdTU3NTdcdTdFRDNcdTY3NUZcdTU0MEVcdTc2ODRcdTk3NTlcdTYwMDFcdTkxQ0RcdTRGRUVcdTdBOTdcdTUzRTNcdTUxODVcdTRFQ0RcdTUzRUZcdTg4NjVcdTUwNUFcdUZGMUJcdTRFNjBcdTYwRUZcdTdBOTdcdTUzRTNcdTRFM0EgMFx1MzAwMlxuICAgICAgICAgICAgY29uc3Qgc3BlbnRBdCA9XG4gICAgICAgICAgICAgIHN0YXJ0ICtcbiAgICAgICAgICAgICAgd2luZG93TWludXRlcyh0LCBzZXR0aW5ncykgK1xuICAgICAgICAgICAgICAoaXNIYWJpdCh0KSA/IDAgOiB0LnNjcmFwTWludXRlcyk7XG4gICAgICAgICAgICByZXR1cm4gcGFzdCB8fCAoaXNUb2RheSAmJiBub3dTZWNvbmRzID49IHNwZW50QXQgKiA2MCk7XG4gICAgICAgICAgfSkoKVxuICAgICAgICA6IGZhbHNlKTtcbiAgICBpZiAoZXhwaXJlZCAmJiAhdC5yZW1pbmRlckV4cGlyZWQpIHtcbiAgICAgIHQucmVtaW5kZXJFeHBpcmVkID0gdHJ1ZTtcbiAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoKHQuY29tcGxldGVkIHx8IGV4cGlyZWQgfHwgIWlzVG9kYXkpICYmIHQucmVtaW5kZXJQZW5kaW5nKSB7XG4gICAgICB0LnJlbWluZGVyUGVuZGluZyA9IGZhbHNlO1xuICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmIChleHBpcmVkICYmICF0LnJlbWluZGVyRmlyZWQpIHtcbiAgICAgIHQucmVtaW5kZXJGaXJlZCA9IHRydWU7XG4gICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgIXQuY29tcGxldGVkICYmXG4gICAgICAhdC5yZW1pbmRlckZpcmVkICYmXG4gICAgICBpc1RvZGF5ICYmXG4gICAgICAhZXhwaXJlZCAmJlxuICAgICAgc3RhcnQgIT09IG51bGwgJiZcbiAgICAgIHN0YXJ0IDw9IG5vd01pbnV0ZXNcbiAgICApIHtcbiAgICAgIHQucmVtaW5kZXJGaXJlZCA9IHRydWU7XG4gICAgICB0LnJlbWluZGVyUGVuZGluZyA9IHRydWU7XG4gICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZWQ7XG59XG5cbi8vIGxpYi50cyBcdTU5MERcdTc1MjhcdTc2ODRcdThCQTFcdTY1RjZcdTUzOUZcdThCRURcdUZGMDhcdTVCRjlcdTVFOTQgQXBwRGF0YSBcdTc2ODRcdTc5QzFcdTY3MDlcdTY1QjlcdTZDRDVcdUZGMDlcdTMwMDJcblxuZXhwb3J0IGZ1bmN0aW9uIHRpbWVyUmVtYWluaW5nKHRpbWVyOiBUaW1lciwgYXQ6IG51bWJlcik6IG51bWJlciB7XG4gIGlmICh0aW1lci5ydW5uaW5nICYmIHRpbWVyLmRlYWRsaW5lICE9PSBudWxsKSB7XG4gICAgY29uc3QgcmVtYWluaW5nID0gdGltZXIuZGVhZGxpbmUgLSBhdDtcbiAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgocmVtYWluaW5nLCAwKSwgdGltZXIuZHVyYXRpb25TZWNzKTtcbiAgfVxuICByZXR1cm4gdGltZXIucmVtYWluaW5nU2Vjcztcbn1cblxuLyoqIFx1N0VEM1x1NkUwNVx1NUY1M1x1NTI0RFx1OEJBMVx1NjVGNlx1NEUzQVx1NEUwMFx1Njc2MSBUaW1lciBcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcdUZGMUJcdTk3NUVcdTRFMTNcdTZDRThcdTYyMTZcdTk2RjZcdTc1MjhcdTY1RjZcdTRFMERcdTUwNUFcdTRFRkJcdTRGNTVcdTRFOEJcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiByZWNvcmRTZXNzaW9uKFxuICBkYXRhOiBBcHBEYXRhLFxuICBhdDogbnVtYmVyLFxuICBjb21wbGV0ZWQ6IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgY29uc3QgZWxhcHNlZCA9IGRhdGEudGltZXIuZHVyYXRpb25TZWNzIC0gdGltZXJSZW1haW5pbmcoZGF0YS50aW1lciwgYXQpO1xuICBpZiAoZGF0YS50aW1lci5tb2RlICE9PSBcImZvY3VzXCIgfHwgZWxhcHNlZCA9PT0gMCkgcmV0dXJuO1xuICBjb25zdCB0YXNrID0gZGF0YS50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSBkYXRhLnRpbWVyLnRhc2tJZCk7XG4gIGNvbnN0IHByb2plY3QgPVxuICAgIHRhc2sgIT09IHVuZGVmaW5lZCAmJiB0YXNrLnByb2plY3RJZCAhPT0gbnVsbFxuICAgICAgPyBkYXRhLnByb2plY3RzLmZpbmQoKHApID0+IHAuaWQgPT09IHRhc2sucHJvamVjdElkKVxuICAgICAgOiB1bmRlZmluZWQ7XG4gIGRhdGEuc2Vzc2lvbnMucHVzaCh7XG4gICAgaWQ6IGlkKCksXG4gICAgc291cmNlOiBcInRpbWVyXCIsXG4gICAgdGFza0lkOiBkYXRhLnRpbWVyLnRhc2tJZCxcbiAgICB0YXNrVGl0bGU6IHRhc2s/LnRpdGxlID8/IFwiXHU4MUVBXHU3NTMxXHU0RTEzXHU2Q0U4XCIsXG4gICAgcHJvamVjdE5hbWU6IHByb2plY3Q/Lm5hbWUgPz8gXCJcdTY3MkFcdTUyMDZcdTdDN0JcIixcbiAgICBzdGFydGVkQXQ6IGRhdGEudGltZXIuc3RhcnRlZEF0ID8/IGF0IC0gZWxhcHNlZCxcbiAgICBlbmRlZEF0OiBhdCxcbiAgICBkdXJhdGlvblNlY3M6IGVsYXBzZWQsXG4gICAgY29tcGxldGVkLFxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0VG8oXG4gIGRhdGE6IEFwcERhdGEsXG4gIG1vZGU6IFwiZm9jdXNcIiB8IFwic2hvcnRCcmVha1wiIHwgXCJsb25nQnJlYWtcIixcbik6IHZvaWQge1xuICBkYXRhLnRpbWVyLmF1dG9Gb2N1c0Jsb2NrZWQgPSBmYWxzZTtcbiAgZGF0YS50aW1lci5tb2RlID0gbW9kZTtcbiAgZGF0YS50aW1lci5ydW5uaW5nID0gZmFsc2U7XG4gIGRhdGEudGltZXIuZHVyYXRpb25TZWNzID0gZHVyYXRpb25PZihkYXRhLCBtb2RlKTtcbiAgZGF0YS50aW1lci5yZW1haW5pbmdTZWNzID0gZGF0YS50aW1lci5kdXJhdGlvblNlY3M7XG4gIGRhdGEudGltZXIuZGVhZGxpbmUgPSBudWxsO1xuICBkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkdXJhdGlvbk9mKFxuICBkYXRhOiBBcHBEYXRhLFxuICBtb2RlOiBcImZvY3VzXCIgfCBcInNob3J0QnJlYWtcIiB8IFwibG9uZ0JyZWFrXCIsXG4pOiBudW1iZXIge1xuICBjb25zdCBtaW51dGVzID1cbiAgICBtb2RlID09PSBcImZvY3VzXCJcbiAgICAgID8gKGRhdGEudGFza3MuZmluZCgodCkgPT4gdC5pZCA9PT0gZGF0YS50aW1lci50YXNrSWQpPy5mb2N1c01pbnV0ZXMgPz9cbiAgICAgICAgZGF0YS5zZXR0aW5ncy5mb2N1c01pbnV0ZXMpXG4gICAgICA6IG1vZGUgPT09IFwic2hvcnRCcmVha1wiXG4gICAgICAgID8gZGF0YS5zZXR0aW5ncy5zaG9ydEJyZWFrTWludXRlc1xuICAgICAgICA6IGRhdGEuc2V0dGluZ3MubG9uZ0JyZWFrTWludXRlcztcbiAgcmV0dXJuIDYwICogbWludXRlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0VGltZXIoZGF0YTogQXBwRGF0YSwgYXQ6IG51bWJlcik6IHZvaWQge1xuICBpZiAoZGF0YS50aW1lci5tb2RlID09PSBcImZvY3VzXCIpIHtcbiAgICBpZiAoXG4gICAgICBkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgICAgIWRhdGEudGltZXIucnVubmluZyAmJlxuICAgICAgZGF0YS50aW1lci5yZW1haW5pbmdTZWNzID09PSBkYXRhLnRpbWVyLmR1cmF0aW9uU2Vjc1xuICAgICkge1xuICAgICAgcmVzZXRUbyhkYXRhLCBcImZvY3VzXCIpO1xuICAgIH1cbiAgICBjb25zdCB0YXNrID0gZGF0YS50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSBkYXRhLnRpbWVyLnRhc2tJZCk7XG4gICAgaWYgKHRhc2sgIT09IHVuZGVmaW5lZCkgdGFzay5yZW1pbmRlclBlbmRpbmcgPSBmYWxzZTtcbiAgfVxuICBpZiAoIWRhdGEudGltZXIucnVubmluZykge1xuICAgIGlmIChkYXRhLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbCkgZGF0YS50aW1lci5zdGFydGVkQXQgPSBhdDtcbiAgICBkYXRhLnRpbWVyLmRlYWRsaW5lID0gYXQgKyBkYXRhLnRpbWVyLnJlbWFpbmluZ1NlY3M7XG4gICAgZGF0YS50aW1lci5ydW5uaW5nID0gdHJ1ZTtcbiAgfVxufVxuIiwgIi8vISBcdTZBMjFcdTY3N0ZcdTRFMEVcdTUzNzBcdTUyMzdcdUZGMUFcdTVGNjJcdTcyQjZcdTUzNzBcdTY1RjZcdTU5MERcdTUyMzZcdUZGMENcdThEMjZcdTY3MkNcdTcyRUNcdTdBQ0JcdTRFOEVcdTVCOUVcdTRGOEJcdUZGMENcdTUyMjBcdTRFODZcdTRFMERcdTRGMUFcdTkxQ0RcdTczQjBcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgY3JhdGVzL2NvcmUvc3JjL3RlbXBsYXRlcy5yc1x1MzAwMkFwcERhdGEgXHU2NUI5XHU2Q0Q1XHU0RUU1XHU4MUVBXHU3NTMxXHU1MUZEXHU2NTcwICsgbGliLnRzIFx1ODU4NFx1NTMwNVx1ODhDNVx1NjNEMFx1NEY5Qlx1MzAwMlxuXG5pbXBvcnQgeyBBcHBFcnJvciwgY2xvbmUsIGVuc3VyZSB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHsgaWQgfSBmcm9tIFwiLi9pZHNcIjtcbmltcG9ydCB7XG4gIGFzQXJyYXksXG4gIGFzQm9vbCxcbiAgYXNJbnQsXG4gIGFzT3B0LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICBvbmVPZixcbiAgcmVqZWN0VW5rbm93bixcbiAgcmVxdWlyZWRGaWVsZCxcbn0gZnJvbSBcIi4vanNvblwiO1xuaW1wb3J0IHR5cGUge1xuICBDYWxlbmRhclNsb3QsXG4gIFByaW50UmVjb3JkLFxuICBQcmludGluZyxcbiAgUHJpbnRTbG90LFxuICBTaGFwZSxcbiAgVGFzayxcbiAgVGVtcGxhdGUsXG4gIFRlbXBsYXRlU3VidGFzayxcbn0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB0eXBlIHsgQXBwRGF0YSB9IGZyb20gXCIuL2xpYlwiO1xuaW1wb3J0IHsgaXNIYWJpdCwga2luZE9mIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IHdpbmRvd01pbnV0ZXMgfSBmcm9tIFwiLi9yZW1pbmRlcnNcIjtcbmltcG9ydCB7XG4gIGFkZERheXMsXG4gIGRhdGVBdCxcbiAgbWludXRlc09mLFxuICBwYXJzZURhdGUsXG4gIHNlY29uZHNPZkRheSxcbiAgdmFsaWREYXRlLFxuICB2YWxpZFRpbWUsXG4gIHdlZWtTdGFydCxcbiAgd2Vla2RheU1vbmRheSxcbn0gZnJvbSBcIi4vdGltZVwiO1xuXG5jb25zdCBURU1QTEFURV9TVUJUQVNLX0tFWVMgPSBbXCJpZFwiLCBcInRpdGxlXCJdIGFzIGNvbnN0O1xuY29uc3QgU0hBUEVfS0VZUyA9IFtcbiAgXCJ0aXRsZVwiLFxuICBcIm5vdGVzXCIsXG4gIFwicHJvamVjdElkXCIsXG4gIFwiaGFiaXRJZFwiLFxuICBcImZvY3VzTWludXRlc1wiLFxuICBcInNjcmFwTWludXRlc1wiLFxuICBcInByaW9yaXR5XCIsXG4gIFwiZXN0aW1hdGVcIixcbiAgXCJ0YWdzXCIsXG4gIFwic3VidGFza3NcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBQUklOVF9TTE9UX0tFWVMgPSBbXCJkYXlzXCIsIFwidGltZVwiXSBhcyBjb25zdDtcbmNvbnN0IENBTEVOREFSX1NMT1RfS0VZUyA9IFtcImRhdGVzXCIsIFwidGltZVwiXSBhcyBjb25zdDtcbmNvbnN0IFRFTVBMQVRFX0tFWVMgPSBbXG4gIFwiaWRcIixcbiAgXCJzaGFwZVwiLFxuICBcInByaW50aW5nXCIsXG4gIFwiYXV0b21hdGljXCIsXG4gIFwicHJpbnRBaGVhZERheXNcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBQUklOVF9SRUNPUkRfS0VZUyA9IFtcInRlbXBsYXRlSWRcIiwgXCJkYXRlXCJdIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZVN1YnRhc2socmF3OiB1bmtub3duKTogVGVtcGxhdGVTdWJ0YXNrIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTZBMjFcdTY3N0ZcdTVCNTBcdTRFRkJcdTUyQTFcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uVEVNUExBVEVfU1VCVEFTS19LRVlTXSwgXCJcdTZBMjFcdTY3N0ZcdTVCNTBcdTRFRkJcdTUyQTFcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2QTIxXHU2NzdGXHU1QjUwXHU0RUZCXHU1MkExXCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTZBMjFcdTY3N0ZcdTVCNTBcdTRFRkJcdTUyQTFcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTaGFwZShyYXc6IHVua25vd24pOiBTaGFwZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QTIxXHU2NzdGXHU1RjYyXHU3MkI2XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlNIQVBFX0tFWVNdLCBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiKTtcbiAgcmV0dXJuIHtcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNTdHIpLFxuICAgIG5vdGVzOiBmaWVsZChyYXcsIFwibm90ZXNcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNTdHIsIFwiXCIpLFxuICAgIHByb2plY3RJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInByb2plY3RJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBoYWJpdElkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiaGFiaXRJZFwiLFxuICAgICAgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImhhYml0SWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZm9jdXNNaW51dGVzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiZm9jdXNNaW51dGVzXCIsXG4gICAgICBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiZm9jdXNNaW51dGVzXCIsICh4KSA9PiBhc0ludCh4LCBcImZvY3VzTWludXRlc1wiKSksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBzY3JhcE1pbnV0ZXM6IGZpZWxkKHJhdywgXCJzY3JhcE1pbnV0ZXNcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNJbnQsIDApLFxuICAgIHByaW9yaXR5OiBmaWVsZChyYXcsIFwicHJpb3JpdHlcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNJbnQsIDApLFxuICAgIGVzdGltYXRlOiBmaWVsZChyYXcsIFwiZXN0aW1hdGVcIiwgXCJcdTZBMjFcdTY3N0ZcdTVGNjJcdTcyQjZcIiwgYXNJbnQsIDEpLFxuICAgIHRhZ3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YWdzXCIsXG4gICAgICBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0YWdzXCIpLm1hcCgodCkgPT4gYXNTdHIodCwgXCJcdTY4MDdcdTdCN0VcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBzdWJ0YXNrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInN1YnRhc2tzXCIsXG4gICAgICBcIlx1NkEyMVx1Njc3Rlx1NUY2Mlx1NzJCNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJzdWJ0YXNrc1wiKS5tYXAocGFyc2VUZW1wbGF0ZVN1YnRhc2spLFxuICAgICAgW10sXG4gICAgKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVNoYXBlKHM6IFNoYXBlKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIHRpdGxlOiBzLnRpdGxlLFxuICAgIG5vdGVzOiBzLm5vdGVzLFxuICAgIHByb2plY3RJZDogcy5wcm9qZWN0SWQsXG4gICAgaGFiaXRJZDogcy5oYWJpdElkLFxuICAgIGZvY3VzTWludXRlczogcy5mb2N1c01pbnV0ZXMsXG4gICAgc2NyYXBNaW51dGVzOiBzLnNjcmFwTWludXRlcyxcbiAgICBwcmlvcml0eTogcy5wcmlvcml0eSxcbiAgICBlc3RpbWF0ZTogcy5lc3RpbWF0ZSxcbiAgICB0YWdzOiBzLnRhZ3MsXG4gICAgc3VidGFza3M6IHMuc3VidGFza3MubWFwKChzdWIpID0+ICh7IGlkOiBzdWIuaWQsIHRpdGxlOiBzdWIudGl0bGUgfSkpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcmludFNsb3QocmF3OiB1bmtub3duKTogUHJpbnRTbG90IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uUFJJTlRfU0xPVF9LRVlTXSwgXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcIik7XG4gIHJldHVybiB7XG4gICAgZGF5czogYXNBcnJheShcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImRheXNcIiwgXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcIiwgKHYpID0+IHYpLFxuICAgICAgXCJkYXlzXCIsXG4gICAgKS5tYXAoKGQpID0+IGFzSW50KGQsIFwiXHU1NDY4XHU2NzFGXHU2NjFGXHU2NzFGXCIpKSxcbiAgICB0aW1lOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidGltZVwiLFxuICAgICAgXCJcdTU0NjhcdTY3MUZcdTY1RjZcdTZCQjVcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInRpbWVcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNhbGVuZGFyU2xvdChyYXc6IHVua25vd24pOiBDYWxlbmRhclNsb3Qge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5DQUxFTkRBUl9TTE9UX0tFWVNdLCBcIlx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVwiKTtcbiAgcmV0dXJuIHtcbiAgICBkYXRlczogYXNBcnJheShcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImRhdGVzXCIsIFwiXHU2NUU1XHU3QTBCXHU2NUY2XHU2QkI1XCIsICh2KSA9PiB2KSxcbiAgICAgIFwiZGF0ZXNcIixcbiAgICApLm1hcCgoZCkgPT4gYXNTdHIoZCwgXCJcdTY1RTVcdTdBMEJcdTY1RTVcdTY3MUZcIikpLFxuICAgIHRpbWU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0aW1lXCIsXG4gICAgICBcIlx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwidGltZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJpbnRpbmcocmF3OiB1bmtub3duKTogUHJpbnRpbmcge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTM3MFx1NTIzN1x1ODlDNFx1NTIxOVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgY29uc3Qga2luZCA9IG9uZU9mKFxuICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImtpbmRcIiwgXCJcdTUzNzBcdTUyMzdcdTg5QzRcdTUyMTlcIiwgKHYpID0+IHYpLFxuICAgIFwiXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5IGtpbmRcIixcbiAgICBbXCJvbmNlXCIsIFwiY2FsZW5kYXJcIiwgXCJ3ZWVrbHlcIl0sXG4gICk7XG4gIGlmIChraW5kID09PSBcIm9uY2VcIikge1xuICAgIHJlamVjdFVua25vd24ocmF3LCBbXCJraW5kXCIsIFwiZGF0ZVwiLCBcInRpbWVcIl0sIFwiXHU0RTAwXHU2QjIxXHU2MDI3XHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIpO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kLFxuICAgICAgZGF0ZTogZmllbGQoXG4gICAgICAgIHJhdyxcbiAgICAgICAgXCJkYXRlXCIsXG4gICAgICAgIFwiXHU0RTAwXHU2QjIxXHU2MDI3XHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsXG4gICAgICAgICh2KSA9PiBhc09wdCh2LCBcImRhdGVcIiwgYXNTdHIpLFxuICAgICAgICBudWxsLFxuICAgICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgICAgdGltZTogZmllbGQoXG4gICAgICAgIHJhdyxcbiAgICAgICAgXCJ0aW1lXCIsXG4gICAgICAgIFwiXHU0RTAwXHU2QjIxXHU2MDI3XHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsXG4gICAgICAgICh2KSA9PiBhc09wdCh2LCBcInRpbWVcIiwgYXNTdHIpLFxuICAgICAgICBudWxsLFxuICAgICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIH07XG4gIH1cbiAgaWYgKGtpbmQgPT09IFwiY2FsZW5kYXJcIikge1xuICAgIHJlamVjdFVua25vd24ocmF3LCBbXCJraW5kXCIsIFwic2xvdHNcIl0sIFwiXHU2NUU1XHU3QTBCXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIpO1xuICAgIHJldHVybiB7XG4gICAgICBraW5kLFxuICAgICAgc2xvdHM6IGFzQXJyYXkoXG4gICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNsb3RzXCIsIFwiXHU2NUU1XHU3QTBCXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsICh2KSA9PiB2KSxcbiAgICAgICAgXCJzbG90c1wiLFxuICAgICAgKS5tYXAocGFyc2VDYWxlbmRhclNsb3QpLFxuICAgIH07XG4gIH1cbiAgcmVqZWN0VW5rbm93bihyYXcsIFtcImtpbmRcIiwgXCJzbG90c1wiXSwgXCJcdTU0NjhcdTY3MUZcdTUzNzBcdTUyMzdcdTg5QzRcdTUyMTlcIik7XG4gIHJldHVybiB7XG4gICAga2luZCxcbiAgICBzbG90czogYXNBcnJheShcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNsb3RzXCIsIFwiXHU1NDY4XHU2NzFGXHU1MzcwXHU1MjM3XHU4OUM0XHU1MjE5XCIsICh2KSA9PiB2KSxcbiAgICAgIFwic2xvdHNcIixcbiAgICApLm1hcChwYXJzZVByaW50U2xvdCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVQcmludGluZyhwOiBQcmludGluZyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgaWYgKHAua2luZCA9PT0gXCJvbmNlXCIpIHtcbiAgICByZXR1cm4geyBraW5kOiBcIm9uY2VcIiwgZGF0ZTogcC5kYXRlLCB0aW1lOiBwLnRpbWUgfTtcbiAgfVxuICBpZiAocC5raW5kID09PSBcImNhbGVuZGFyXCIpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogXCJjYWxlbmRhclwiLFxuICAgICAgc2xvdHM6IHAuc2xvdHMubWFwKChzKSA9PiAoeyBkYXRlczogcy5kYXRlcywgdGltZTogcy50aW1lIH0pKSxcbiAgICB9O1xuICB9XG4gIHJldHVybiB7XG4gICAga2luZDogXCJ3ZWVrbHlcIixcbiAgICBzbG90czogcC5zbG90cy5tYXAoKHMpID0+ICh7IGRheXM6IHMuZGF5cywgdGltZTogcy50aW1lIH0pKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGVtcGxhdGUocmF3OiB1bmtub3duKTogVGVtcGxhdGUge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NkEyMVx1Njc3Rlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5URU1QTEFURV9LRVlTXSwgXCJcdTZBMjFcdTY3N0ZcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2QTIxXHU2NzdGXCIsIGFzU3RyKSxcbiAgICBzaGFwZTogcGFyc2VTaGFwZShyZXF1aXJlZEZpZWxkKHJhdywgXCJzaGFwZVwiLCBcIlx1NkEyMVx1Njc3RlwiLCAodikgPT4gdikpLFxuICAgIHByaW50aW5nOiBwYXJzZVByaW50aW5nKHJlcXVpcmVkRmllbGQocmF3LCBcInByaW50aW5nXCIsIFwiXHU2QTIxXHU2NzdGXCIsICh2KSA9PiB2KSksXG4gICAgYXV0b21hdGljOiBmaWVsZChyYXcsIFwiYXV0b21hdGljXCIsIFwiXHU2QTIxXHU2NzdGXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIHByaW50QWhlYWREYXlzOiBmaWVsZChyYXcsIFwicHJpbnRBaGVhZERheXNcIiwgXCJcdTZBMjFcdTY3N0ZcIiwgYXNJbnQsIDcpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplVGVtcGxhdGUodDogVGVtcGxhdGUpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHQuaWQsXG4gICAgc2hhcGU6IHNlcmlhbGl6ZVNoYXBlKHQuc2hhcGUpLFxuICAgIHByaW50aW5nOiBzZXJpYWxpemVQcmludGluZyh0LnByaW50aW5nKSxcbiAgICBhdXRvbWF0aWM6IHQuYXV0b21hdGljLFxuICAgIHByaW50QWhlYWREYXlzOiB0LnByaW50QWhlYWREYXlzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcmludFJlY29yZChyYXc6IHVua25vd24pOiBQcmludFJlY29yZCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlBSSU5UX1JFQ09SRF9LRVlTXSwgXCJcdTUzNzBcdTUyMzdcdThCQjBcdTVGNTVcIik7XG4gIHJldHVybiB7XG4gICAgdGVtcGxhdGVJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwidGVtcGxhdGVJZFwiLCBcIlx1NTM3MFx1NTIzN1x1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgZGF0ZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImRhdGVcIixcbiAgICAgIFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJkYXRlXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUHJpbnRSZWNvcmQocDogUHJpbnRSZWNvcmQpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IHRlbXBsYXRlSWQ6IHAudGVtcGxhdGVJZCwgZGF0ZTogcC5kYXRlIH07XG59XG5cbi8qKiBcdTU0NjhcdTY3MUZcdTZBMjFcdTY3N0ZcdTYyNERcdTY2MkZcdTkxQ0RcdTU5MERcdTY3NjVcdTZFOTBcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZVJlY3VycmluZyh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIHRlbXBsYXRlLnByaW50aW5nLmtpbmQgPT09IFwid2Vla2x5XCI7XG59XG5cbi8qKiBcdTRFMDBcdTRFMkFcdTY1RTVcdTY3MUZcdTVCRjlcdTVFOTRcdTc2ODRcdTUxNjhcdTkwRThcdTVGMDBcdTU5Q0JcdTY1RjZcdTUyM0JcdUZGMUJcdTY1RTVcdTY3MUZcdTY1RTBcdTY1NDhcdTYyMTZcdTRFMERcdTU3MjhcdTVCODlcdTYzOTJcdTUxODVcdTYyQTVcdTk1MTlcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZW1wbGF0ZVRpbWVzKFxuICB0ZW1wbGF0ZTogVGVtcGxhdGUsXG4gIGRhdGU6IHN0cmluZyB8IG51bGwsXG4pOiAoc3RyaW5nIHwgbnVsbClbXSB7XG4gIGlmIChkYXRlID09PSBudWxsIHx8ICF2YWxpZERhdGUoZGF0ZSkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTUzNzBcdTUyMzdcdTY1RTVcdTY3MUZcIik7XG4gIH1cbiAgY29uc3QgcHJpbnRpbmcgPSB0ZW1wbGF0ZS5wcmludGluZztcbiAgaWYgKHByaW50aW5nLmtpbmQgPT09IFwib25jZVwiKSB7XG4gICAgaWYgKHByaW50aW5nLnRpbWUgIT09IG51bGwgJiYgZGF0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QjlBXHU2NUY2XHU1QjlFXHU0RjhCXHU5NzAwXHU4OTgxXHU2NUU1XHU2NzFGXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW3ByaW50aW5nLnRpbWVdO1xuICB9XG4gIGlmIChwcmludGluZy5raW5kID09PSBcImNhbGVuZGFyXCIpIHtcbiAgICBjb25zdCB0aW1lcyA9IHByaW50aW5nLnNsb3RzXG4gICAgICAuZmlsdGVyKChzKSA9PiBzLmRhdGVzLmluY2x1ZGVzKGRhdGUpKVxuICAgICAgLm1hcCgocykgPT4gcy50aW1lKTtcbiAgICBpZiAodGltZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCRTVcdTY1RTVcdTY3MUZcdTRFMERcdTU3MjhcdTY1RTVcdTdBMEJcdTg4NjhcdTRFMkRcIik7XG4gICAgfVxuICAgIHJldHVybiB0aW1lcztcbiAgfVxuICBjb25zdCB3ZWVrZGF5ID0gd2Vla2RheU1vbmRheShwYXJzZURhdGUoZGF0ZSkhKTtcbiAgY29uc3QgdGltZXMgPSBwcmludGluZy5zbG90c1xuICAgIC5maWx0ZXIoKHMpID0+IHMuZGF5cy5pbmNsdWRlcyh3ZWVrZGF5KSlcbiAgICAubWFwKChzKSA9PiBzLnRpbWUpO1xuICBpZiAodGltZXMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkU1XHU2NUU1XHU2NzFGXHU0RTBEXHU1NzI4XHU2NzJDXHU1NDY4XHU1Qjg5XHU2MzkyXHU0RTJEXCIpO1xuICB9XG4gIHJldHVybiB0aW1lcztcbn1cblxuLyoqIFx1NTM3MFx1NTFGQVx1NUI5RVx1NEY4Qlx1RkYxQVx1NUY2Mlx1NzJCNlx1NTcyOFx1NTM3MFx1NTIzN1x1NjVGNlx1NTIzQlx1NTkwRFx1NTIzNlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlSW5zdGFuY2UoXG4gIHRlbXBsYXRlOiBUZW1wbGF0ZSxcbiAgZGF0ZTogc3RyaW5nIHwgbnVsbCxcbiAgdGltZTogc3RyaW5nIHwgbnVsbCxcbiAgYXQ6IG51bWJlcixcbik6IFRhc2sge1xuICBjb25zdCB0YXNrOiBUYXNrID0ge1xuICAgIGlkOiBpZCgpLFxuICAgIHRlbXBsYXRlSWQ6IHRlbXBsYXRlLmlkLFxuICAgIHJlY3VycmluZzogdGVtcGxhdGVSZWN1cnJpbmcodGVtcGxhdGUpLFxuICAgIHRpdGxlOiBcIlwiLFxuICAgIG5vdGVzOiBcIlwiLFxuICAgIHByb2plY3RJZDogbnVsbCxcbiAgICBoYWJpdElkOiBudWxsLFxuICAgIGR1ZURhdGU6IGRhdGUsXG4gICAgcmVtaW5kZXJUaW1lOiB0aW1lLFxuICAgIGZvY3VzTWludXRlczogbnVsbCxcbiAgICBzY3JhcE1pbnV0ZXM6IDAsXG4gICAgcHJpb3JpdHk6IDAsXG4gICAgZXN0aW1hdGU6IDEsXG4gICAgcmVtaW5kZXJGaXJlZDogZmFsc2UsXG4gICAgcmVtaW5kZXJQZW5kaW5nOiBmYWxzZSxcbiAgICByZW1pbmRlckV4cGlyZWQ6IGZhbHNlLFxuICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgY29tcGxldGVkQXQ6IG51bGwsXG4gICAgY3JlYXRlZEF0OiBhdCxcbiAgICB0YWdzOiBbXSxcbiAgICBzdWJ0YXNrczogW10sXG4gIH07XG4gIGNvcHlTaGFwZSh0ZW1wbGF0ZS5zaGFwZSwgdGFzayk7XG4gIHJldHVybiB0YXNrO1xufVxuXG5mdW5jdGlvbiBjb3B5U2hhcGUoc2hhcGU6IFNoYXBlLCB0YXNrOiBUYXNrKTogdm9pZCB7XG4gIHRhc2sudGl0bGUgPSBzaGFwZS50aXRsZTtcbiAgdGFzay5ub3RlcyA9IHNoYXBlLm5vdGVzO1xuICB0YXNrLnByb2plY3RJZCA9IHNoYXBlLnByb2plY3RJZDtcbiAgdGFzay5oYWJpdElkID0gc2hhcGUuaGFiaXRJZDtcbiAgdGFzay5mb2N1c01pbnV0ZXMgPSBzaGFwZS5mb2N1c01pbnV0ZXM7XG4gIHRhc2suc2NyYXBNaW51dGVzID0gaXNIYWJpdCh0YXNrKSA/IDAgOiBzaGFwZS5zY3JhcE1pbnV0ZXM7XG4gIHRhc2sucHJpb3JpdHkgPSBzaGFwZS5wcmlvcml0eTtcbiAgdGFzay5lc3RpbWF0ZSA9IHNoYXBlLmVzdGltYXRlO1xuICB0YXNrLnRhZ3MgPSBbLi4uc2hhcGUudGFnc107XG4gIC8vIFx1NjYzRVx1NUYwRlx1NTQwQ1x1NkI2NVx1NjVGNlx1NEZERFx1NzU1OVx1NTMzOVx1OTE0RFx1NkI2NVx1OUFBNFx1NzY4NFx1NUI4Q1x1NjIxMFx1NzJCNlx1NjAwMVx1MzAwMlxuICB0YXNrLnN1YnRhc2tzID0gc2hhcGUuc3VidGFza3MubWFwKChzdWIpID0+ICh7XG4gICAgaWQ6IHN1Yi5pZCxcbiAgICB0aXRsZTogc3ViLnRpdGxlLFxuICAgIGRvbmU6IHRhc2suc3VidGFza3Muc29tZSgob2xkKSA9PiBvbGQuaWQgPT09IHN1Yi5pZCAmJiBvbGQuZG9uZSksXG4gIH0pKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlVGVtcGxhdGVzKGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgaWYgKGRhdGEudGVtcGxhdGVzLmxlbmd0aCA+IDUwMDAgfHwgZGF0YS5wcmludHMubGVuZ3RoID4gMjAwMDAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QTIxXHU2NzdGXHU2MjE2XHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XHU4RDg1XHU1MUZBXHU5NjUwXHU1MjM2XCIpO1xuICB9XG4gIGNvbnN0IGlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IHQgb2YgZGF0YS50ZW1wbGF0ZXMpIHtcbiAgICBpZiAodC5pZC5sZW5ndGggPT09IDAgfHwgaWRzLmhhcyh0LmlkKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QTIxXHU2NzdGIElEIFx1OTFDRFx1NTkwRFx1NjIxNlx1NEUzQVx1N0E3QVwiKTtcbiAgICB9XG4gICAgaWRzLmFkZCh0LmlkKTtcbiAgICBjb25zdCBzID0gdC5zaGFwZTtcbiAgICBpZiAodC5wcmludEFoZWFkRGF5cyA+IDkwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk4ODRcdTUzNzBcdTU5MjlcdTY1NzBcdTk3MDBcdTRFM0EgMFx1MjAxMzkwIFx1NTkyOVwiKTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgcy50aXRsZS50cmltKCkubGVuZ3RoID09PSAwIHx8XG4gICAgICBBcnJheS5mcm9tKHMudGl0bGUpLmxlbmd0aCA+IDIwMCB8fFxuICAgICAgcy5ub3Rlcy5sZW5ndGggPiA1MDAwMCB8fFxuICAgICAgcy5wcmlvcml0eSA+IDMgfHxcbiAgICAgIHMuZXN0aW1hdGUgPCAxIHx8XG4gICAgICBzLmVzdGltYXRlID4gOTkgfHxcbiAgICAgIHMuc2NyYXBNaW51dGVzID4gMTAwODAgfHxcbiAgICAgIChzLmZvY3VzTWludXRlcyAhPT0gbnVsbCAmJlxuICAgICAgICAocy5mb2N1c01pbnV0ZXMgPCAxIHx8IHMuZm9jdXNNaW51dGVzID4gMTgwKSkgfHxcbiAgICAgIHMudGFncy5sZW5ndGggPiAyMCB8fFxuICAgICAgcy50YWdzLnNvbWUoKHRhZykgPT4gQXJyYXkuZnJvbSh0YWcpLmxlbmd0aCA+IDQwKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU2QTIxXHU2NzdGXHU1RjYyXHU3MkI2XCIpO1xuICAgIH1cbiAgICBjb25zdCBzdWJzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgaWYgKFxuICAgICAgcy5zdWJ0YXNrcy5sZW5ndGggPiAyMDAgfHxcbiAgICAgIHMuc3VidGFza3Muc29tZShcbiAgICAgICAgKHN1YikgPT5cbiAgICAgICAgICBzdWIuaWQubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICAgc3Vicy5oYXMoc3ViLmlkKSB8fFxuICAgICAgICAgIHN1Yi50aXRsZS50cmltKCkubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICAgQXJyYXkuZnJvbShzdWIudGl0bGUpLmxlbmd0aCA+IDIwMCxcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NkEyMVx1Njc3Rlx1NUI1MFx1NEVGQlx1NTJBMVwiKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBzdWIgb2Ygcy5zdWJ0YXNrcykgc3Vicy5hZGQoc3ViLmlkKTtcbiAgICBpZiAoXG4gICAgICAocy5wcm9qZWN0SWQgIT09IG51bGwgJiZcbiAgICAgICAgIWRhdGEucHJvamVjdHMuc29tZSgocCkgPT4gcC5pZCA9PT0gcy5wcm9qZWN0SWQpKSB8fFxuICAgICAgKHMuaGFiaXRJZCAhPT0gbnVsbCAmJiAhZGF0YS5oYWJpdHMuc29tZSgoaCkgPT4gaC5pZCA9PT0gcy5oYWJpdElkKSlcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NkEyMVx1Njc3Rlx1NUYxNVx1NzUyOFx1NEU4Nlx1NEUwRFx1NUI1OFx1NTcyOFx1NzY4NFx1NUJCOVx1NTY2OFwiKTtcbiAgICB9XG4gICAgY29uc3QgcHJpbnRpbmcgPSB0LnByaW50aW5nO1xuICAgIGlmIChwcmludGluZy5raW5kID09PSBcIm9uY2VcIikge1xuICAgICAgaWYgKFxuICAgICAgICBwcmludGluZy5kYXRlID09PSBudWxsIHx8XG4gICAgICAgICF2YWxpZERhdGUocHJpbnRpbmcuZGF0ZSkgfHxcbiAgICAgICAgKHByaW50aW5nLnRpbWUgIT09IG51bGwgJiYgIXZhbGlkVGltZShwcmludGluZy50aW1lKSlcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTRFMDBcdTZCMjFcdTUzNzBcdTUyMzdcdTY1RTVcdTY3MUZcdTYyMTZcdTY1RjZcdTk1RjRcIik7XG4gICAgICB9XG4gICAgICBpZiAocy5oYWJpdElkICE9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEU2MFx1NjBFRlx1NkEyMVx1Njc3Rlx1NUZDNVx1OTg3Qlx1OTFDRFx1NTkwRFx1NTM3MFx1NTIzN1wiKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHByaW50aW5nLmtpbmQgPT09IFwiY2FsZW5kYXJcIikge1xuICAgICAgaWYgKFxuICAgICAgICBwcmludGluZy5zbG90cy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgcHJpbnRpbmcuc2xvdHMubGVuZ3RoID4gNDkgfHxcbiAgICAgICAgcy5oYWJpdElkICE9PSBudWxsXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5NzVFXHU5MUNEXHU1OTBEXHU2NUU1XHU3QTBCXHU5NzAwXHU4OTgxIDFcdTIwMTM0OSBcdTRFMkFcdTY1RjZcdTZCQjVcdUZGMENcdTRFMERcdTgwRkRcdTVDNUVcdTRFOEVcdTRFNjBcdTYwRUZcdTdFQzRcIik7XG4gICAgICB9XG4gICAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBjb25zdCB0aW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgZm9yIChjb25zdCBzbG90IG9mIHByaW50aW5nLnNsb3RzKSB7XG4gICAgICAgIGNvbnN0IHRpbWVLZXkgPSBzbG90LnRpbWUgPz8gXCJudWxsXCI7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBzbG90LmRhdGVzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAgIHNsb3QuZGF0ZXMubGVuZ3RoID4gMzY2IHx8XG4gICAgICAgICAgKHNsb3QudGltZSAhPT0gbnVsbCAmJiAhdmFsaWRUaW1lKHNsb3QudGltZSkpIHx8XG4gICAgICAgICAgKHRpbWVzLmhhcyh0aW1lS2V5KSA/IHRydWUgOiAodGltZXMuYWRkKHRpbWVLZXkpLCBmYWxzZSkpIHx8XG4gICAgICAgICAgc2xvdC5kYXRlcy5zb21lKChkYXRlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBrZXkgPSBgJHtkYXRlfXwke3RpbWVLZXl9YDtcbiAgICAgICAgICAgIC8vIFx1NEUwRSBSdXN0IFx1NEUwMFx1ODFGNFx1RkYxQVx1NjhDMFx1NjdFNVx1NTM3M1x1NjNEMlx1NTE2NVx1MjAxNFx1MjAxNFx1NTQwQ1x1NEUwMFx1NjVGNlx1NkJCNVx1NTE4NVx1NzY4NFx1OTFDRFx1NTkwRFx1NjVFNVx1NjcxRlx1NEU1Rlx1NEYxQVx1ODhBQlx1NjJEMlx1MzAwMlxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgIXZhbGlkRGF0ZShkYXRlKSB8fFxuICAgICAgICAgICAgICAoc2Vlbi5oYXMoa2V5KSA/IHRydWUgOiAoc2Vlbi5hZGQoa2V5KSwgZmFsc2UpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KVxuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgICBcIlx1NjVFMFx1NjU0OFx1NjIxNlx1OTFDRFx1NTkwRFx1NzY4NFx1NjVFNVx1N0EwQlx1NjVGNlx1NkJCNVx1RkYwQ1x1OEJGN1x1NjI4QVx1NTQwQ1x1NEUwMFx1NUYwMFx1NTlDQlx1NjVGNlx1OTVGNFx1NzY4NFx1NjVFNVx1NjcxRlx1NTQwOFx1NUU3NlwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZWVuLnNpemUgPiAzNjYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTAwXHU2QjIxXHU2NUU1XHU3QTBCXHU4ODY4XHU2NzAwXHU1OTFBIDM2NiBcdTk4NzlcIik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwcmludGluZy5zbG90cy5sZW5ndGggPT09IDAgfHwgcHJpbnRpbmcuc2xvdHMubGVuZ3RoID4gNDkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2QkNGXHU1NDY4XHU1RkFBXHU3M0FGXHU5NzAwXHU4OTgxIDFcdTIwMTM0OSBcdTRFMkFcdTY1RjZcdTZCQjVcIik7XG4gICAgICB9XG4gICAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBmb3IgKGNvbnN0IHNsb3Qgb2YgcHJpbnRpbmcuc2xvdHMpIHtcbiAgICAgICAgY29uc3QgdW5pcXVlID0gbmV3IFNldChzbG90LmRheXMpO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2xvdC5kYXlzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAgIHNsb3QuZGF5cy5sZW5ndGggPiA3IHx8XG4gICAgICAgICAgdW5pcXVlLnNpemUgIT09IHNsb3QuZGF5cy5sZW5ndGggfHxcbiAgICAgICAgICBzbG90LmRheXMuc29tZSgoZCkgPT4gZCA8IDEgfHwgZCA+IDcpIHx8XG4gICAgICAgICAgKHNsb3QudGltZSAhPT0gbnVsbCAmJiAhdmFsaWRUaW1lKHNsb3QudGltZSkpIHx8XG4gICAgICAgICAgKHMuaGFiaXRJZCAhPT0gbnVsbCAmJiBzbG90LnRpbWUgPT09IG51bGwpIHx8XG4gICAgICAgICAgc2xvdC5kYXlzLnNvbWUoKGRheSkgPT4gc2Vlbi5oYXMoYCR7ZGF5fXwke3Nsb3QudGltZSA/PyBcIm51bGxcIn1gKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU2MjE2XHU5MUNEXHU1OTBEXHU3Njg0XHU1NDY4XHU2NzFGXHU2NUY2XHU2QkI1XCIpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZGF5IG9mIHNsb3QuZGF5cykgc2Vlbi5hZGQoYCR7ZGF5fXwke3Nsb3QudGltZSA/PyBcIm51bGxcIn1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgcHJpbnRpbmcuc2xvdHMuc29tZSgocykgPT4gcy50aW1lICE9PSBudWxsKSAmJlxuICAgICAgICBwcmludGluZy5zbG90cy5zb21lKChzKSA9PiBzLnRpbWUgPT09IG51bGwpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTAwXHU0RTJBXHU1NDY4XHU2NzFGXHU0RTBEXHU4MEZEXHU2REY3XHU3NTI4XHU1QjlBXHU2NUY2XHU0RTBFXHU0RTBEXHU1QjlBXHU2NUY2XHU1MzU1XHU1MTQzXCIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCBwcmludHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBwIG9mIGRhdGEucHJpbnRzKSB7XG4gICAgaWYgKFxuICAgICAgIWlkcy5oYXMocC50ZW1wbGF0ZUlkKSB8fFxuICAgICAgcC5kYXRlID09PSBudWxsIHx8XG4gICAgICAhdmFsaWREYXRlKHAuZGF0ZSkgfHxcbiAgICAgIHByaW50cy5oYXMoYCR7cC50ZW1wbGF0ZUlkfXwke3AuZGF0ZX1gKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU2MjE2XHU5MUNEXHU1OTBEXHU3Njg0XHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XCIpO1xuICAgIH1cbiAgICBwcmludHMuYWRkKGAke3AudGVtcGxhdGVJZH18JHtwLmRhdGV9YCk7XG4gIH1cbiAgaWYgKGRhdGEudGFza3Muc29tZSgodCkgPT4gdC50ZW1wbGF0ZUlkICE9PSBudWxsICYmICFpZHMuaGFzKHQudGVtcGxhdGVJZCkpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QjlFXHU0RjhCXHU1RjE1XHU3NTI4XHU0RTg2XHU0RTBEXHU1QjU4XHU1NzI4XHU3Njg0XHU2QTIxXHU2NzdGXCIpO1xuICB9XG59XG5cbi8qKiBcdTRFMzRcdTY1RjZcdUZGMDhcdTRFMERcdTc1NTlcdTZBMjFcdTY3N0ZcdUZGMDlcdTYyNzlcdTkxQ0ZcdTUzNzBcdTUyMzdcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmludEluc3RhbmNlcyhcbiAgZGF0YTogQXBwRGF0YSxcbiAgc2hhcGU6IFNoYXBlLFxuICBwcmludGluZzogUHJpbnRpbmcsXG4gIGF0OiBudW1iZXIsXG4pOiB2b2lkIHtcbiAgaWYgKHByaW50aW5nLmtpbmQgPT09IFwid2Vla2x5XCIpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTVGQUFcdTczQUZcdTg5QzRcdTUyMTlcdTk3MDBcdTg5ODFcdTRGRERcdTc1NTlcdTRFM0FcdTZBMjFcdTY3N0ZcIik7XG4gIH1cbiAgY29uc3QgZGF0ZXM6IChzdHJpbmcgfCBudWxsKVtdID1cbiAgICBwcmludGluZy5raW5kID09PSBcIm9uY2VcIlxuICAgICAgPyBbcHJpbnRpbmcuZGF0ZV1cbiAgICAgIDogWy4uLm5ldyBTZXQocHJpbnRpbmcuc2xvdHMuZmxhdE1hcCgocykgPT4gcy5kYXRlcykpXS5zb3J0KCk7XG4gIGNvbnN0IHRlbXBsYXRlSWQgPSBpZCgpO1xuICBkYXRhLnRlbXBsYXRlcy5wdXNoKHtcbiAgICBpZDogdGVtcGxhdGVJZCxcbiAgICBzaGFwZSxcbiAgICBwcmludGluZyxcbiAgICBhdXRvbWF0aWM6IGZhbHNlLFxuICAgIHByaW50QWhlYWREYXlzOiAwLFxuICB9KTtcbiAgZGF0YS52YWxpZGF0ZSgpO1xuICBwcmludFRlbXBsYXRlKGRhdGEsIHRlbXBsYXRlSWQsIGRhdGVzLCBhdCk7XG4gIGRlbGV0ZVRlbXBsYXRlKGRhdGEsIHRlbXBsYXRlSWQpO1xufVxuXG4vKiogXHU0RkREXHU1QjU4XHU2QTIxXHU2NzdGXHVGRjFBXHU1NDY4XHU2NzFGXHU1MTY4XHU1QjlBXHU2NUY2XHU3Njg0XHU2NjZFXHU5MDFBXHU2QTIxXHU2NzdGXHU4MUVBXHU1MkE4XHU1RUZBXHU3QUNCXHU0RTYwXHU2MEVGXHU3RUM0XHVGRjA4XHU1NDBDXHU1NDBEXHU1OTBEXHU3NTI4XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gc2F2ZVRlbXBsYXRlKGRhdGE6IEFwcERhdGEsIHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQge1xuICB0ZW1wbGF0ZS5zaGFwZS50aXRsZSA9IHRlbXBsYXRlLnNoYXBlLnRpdGxlLnRyaW0oKTtcbiAgaWYgKFxuICAgIHRlbXBsYXRlLnNoYXBlLmhhYml0SWQgPT09IG51bGwgJiZcbiAgICB0ZW1wbGF0ZS5wcmludGluZy5raW5kID09PSBcIndlZWtseVwiICYmXG4gICAgdGVtcGxhdGUucHJpbnRpbmcuc2xvdHMuZXZlcnkoKHMpID0+IHMudGltZSAhPT0gbnVsbClcbiAgKSB7XG4gICAgY29uc3QgZXhpc3RpbmdIYWJpdCA9XG4gICAgICBkYXRhLnRlbXBsYXRlcy5maW5kKCh0KSA9PiB0LmlkID09PSB0ZW1wbGF0ZS5pZCk/LnNoYXBlLmhhYml0SWQgPz8gbnVsbDtcbiAgICBjb25zdCBoaWQgPSBleGlzdGluZ0hhYml0ID8/IGlkKCk7XG4gICAgaWYgKCFkYXRhLmhhYml0cy5zb21lKChoKSA9PiBoLmlkID09PSBoaWQpKSB7XG4gICAgICBkYXRhLmhhYml0cy5wdXNoKHtcbiAgICAgICAgaWQ6IGhpZCxcbiAgICAgICAgbmFtZTogQXJyYXkuZnJvbSh0ZW1wbGF0ZS5zaGFwZS50aXRsZSkuc2xpY2UoMCwgNDApLmpvaW4oXCJcIiksXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGVtcGxhdGUuc2hhcGUuaGFiaXRJZCA9IGhpZDtcbiAgfVxuICBjb25zdCBpbmRleCA9IGRhdGEudGVtcGxhdGVzLmZpbmRJbmRleCgodCkgPT4gdC5pZCA9PT0gdGVtcGxhdGUuaWQpO1xuICBpZiAoaW5kZXggPj0gMCkge1xuICAgIGRhdGEudGVtcGxhdGVzW2luZGV4XSA9IHRlbXBsYXRlO1xuICB9IGVsc2Uge1xuICAgIGRhdGEudGVtcGxhdGVzLnB1c2godGVtcGxhdGUpO1xuICB9XG59XG5cbi8qKiBcdTUyMjBcdTk2NjRcdTZBMjFcdTY3N0ZcdTRGRERcdTc1NTlcdTVCOUVcdTRGOEJcdTVFNzZcdTZFMDUgdGVtcGxhdGVJZFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZVRlbXBsYXRlKGRhdGE6IEFwcERhdGEsIGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgZGF0YS50ZW1wbGF0ZXMgPSBkYXRhLnRlbXBsYXRlcy5maWx0ZXIoKHQpID0+IHQuaWQgIT09IGlkKTtcbiAgZGF0YS5wcmludHMgPSBkYXRhLnByaW50cy5maWx0ZXIoKHApID0+IHAudGVtcGxhdGVJZCAhPT0gaWQpO1xuICBmb3IgKGNvbnN0IHRhc2sgb2YgZGF0YS50YXNrcykge1xuICAgIGlmICh0YXNrLnRlbXBsYXRlSWQgPT09IGlkKSB0YXNrLnRlbXBsYXRlSWQgPSBudWxsO1xuICB9XG59XG5cbi8qKiBcdTYyNEJcdTUyQThcdTUzNzBcdTUyMzdcdUZGMUFcdTU0NjhcdTY3MUZcdTg5QzRcdTUyMTlcdTYzMDlcdTk1MUFcdTVCOUFcdTY1RTVcdTY3MUZcdTVDNTVcdTVGMDBcdTY1NzRcdTU0NjhcdUZGMUJcdTU0MENcdTZBMjFcdTY3N0ZcdTU0MENcdTY1RTVcdTY3MUZcdTk2MzJcdTkxQ0RcdUZGMUJcdTRFMDBcdTU5MjlcdTUxODVcdTRGNUNcdTVFOUZcdTY1RjZcdTZCQjVcdThERjNcdThGQzdcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmludFRlbXBsYXRlKFxuICBkYXRhOiBBcHBEYXRhLFxuICBpZDogc3RyaW5nLFxuICBkYXRlczogKHN0cmluZyB8IG51bGwpW10sXG4gIGF0OiBudW1iZXIsXG4pOiB2b2lkIHtcbiAgaWYgKGRhdGVzLmxlbmd0aCA9PT0gMCB8fCBkYXRlcy5sZW5ndGggPiAzNjYpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTZCQ0ZcdTZCMjFcdTUzNzBcdTUyMzdcdTk3MDBcdTg5ODEgMVx1MjAxMzM2NiBcdTRFMkFcdTY1RTVcdTY3MUZcIik7XG4gIH1cbiAgY29uc3QgdGVtcGxhdGVJbmRleCA9IGRhdGEudGVtcGxhdGVzLmZpbmRJbmRleCgodCkgPT4gdC5pZCA9PT0gaWQpO1xuICBpZiAodGVtcGxhdGVJbmRleCA8IDApIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTZBMjFcdTY3N0ZcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gIH1cbiAgY29uc3QgdGVtcGxhdGUgPSBkYXRhLnRlbXBsYXRlc1t0ZW1wbGF0ZUluZGV4XSE7XG4gIGxldCByZXNvbHZlZDogKHN0cmluZyB8IG51bGwpW107XG4gIGlmICh0ZW1wbGF0ZS5wcmludGluZy5raW5kID09PSBcIndlZWtseVwiKSB7XG4gICAgY29uc3QgZGF5cyA9IFtcbiAgICAgIC4uLm5ldyBTZXQodGVtcGxhdGUucHJpbnRpbmcuc2xvdHMuZmxhdE1hcCgocykgPT4gcy5kYXlzKSksXG4gICAgXS5zb3J0KChhLCBiKSA9PiBhIC0gYik7XG4gICAgY29uc3QgZXhwYW5kZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IGRhdGUgb2YgZGF0ZXMpIHtcbiAgICAgIGlmIChkYXRlID09PSBudWxsKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTU0NjhcdTY3MUZcdTUzNzBcdTUyMzdcdTk3MDBcdTg5ODFcdTY1RTVcdTY3MUZcIik7XG4gICAgICBpZiAoIXZhbGlkRGF0ZShkYXRlKSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU1NDY4XHU2NzFGXHU2NUU1XHU2NzFGXCIpO1xuICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VEYXRlKGRhdGUpITtcbiAgICAgIGNvbnN0IG1vbmRheSA9IHdlZWtTdGFydChwYXJzZWQpO1xuICAgICAgZm9yIChjb25zdCBkYXkgb2YgZGF5cykge1xuICAgICAgICBjb25zdCBkID0gYWRkRGF5cyhtb25kYXksIGRheSAtIDEpO1xuICAgICAgICBleHBhbmRlZC5hZGQoXG4gICAgICAgICAgYCR7ZC55ZWFyfS0ke1N0cmluZyhkLm1vbnRoKS5wYWRTdGFydCgyLCBcIjBcIil9LSR7U3RyaW5nKGQuZGF5KS5wYWRTdGFydCgyLCBcIjBcIil9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGV4cGFuZGVkLnNpemUgPiAzNjYpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEUwMFx1NkIyMVx1NTM3MFx1NTIzN1x1ODMwM1x1NTZGNFx1OEZDN1x1NTkyN1x1RkYwQ1x1OEJGN1x1NjJDNlx1NTIwNlx1NTQ2OFx1NjcxRlwiKTtcbiAgICB9XG4gICAgcmVzb2x2ZWQgPSBbLi4uZXhwYW5kZWRdLnNvcnQoKTtcbiAgfSBlbHNlIHtcbiAgICByZXNvbHZlZCA9IFsuLi5kYXRlc107XG4gIH1cbiAgLy8gXHU1MTQ4XHU1QjhDXHU2NTc0XHU4OUUzXHU2NzkwXHU1NDY4XHU2NzFGL1x1NjVFNVx1N0EwQlx1NjI3OVx1NkIyMVx1RkYwQ1x1NTE4RFx1NTJBOFx1NzJCNlx1NjAwMVx1RkYwOFx1NTM5Rlx1NUI1MFx1RkYwOVx1MzAwMlxuICBjb25zdCBiYXRjaGVzOiB7IGRhdGU6IHN0cmluZyB8IG51bGw7IHRpbWVzOiAoc3RyaW5nIHwgbnVsbClbXSB9W10gPVxuICAgIHJlc29sdmVkLm1hcCgoZGF0ZSkgPT4gKHtcbiAgICAgIGRhdGUsXG4gICAgICB0aW1lczogdGVtcGxhdGVUaW1lcyh0ZW1wbGF0ZSwgZGF0ZSksXG4gICAgfSkpO1xuICBjb25zdCBwcmludGVkRGF0ZXMgPSBuZXcgU2V0KFxuICAgIGRhdGEucHJpbnRzLmZpbHRlcigocCkgPT4gcC50ZW1wbGF0ZUlkID09PSBpZCkubWFwKChwKSA9PiBwLmRhdGUgYXMgc3RyaW5nKSxcbiAgKTtcbiAgZm9yIChjb25zdCB7IGRhdGUsIHRpbWVzIH0gb2YgYmF0Y2hlcykge1xuICAgIGlmIChwcmludGVkRGF0ZXMuaGFzKGRhdGUgYXMgc3RyaW5nKSkgY29udGludWU7XG4gICAgbGV0IHByaW50ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IHRpbWUgb2YgdGltZXMpIHtcbiAgICAgIGNvbnN0IHRhc2sgPSB0ZW1wbGF0ZUluc3RhbmNlKHRlbXBsYXRlLCBkYXRlLCB0aW1lLCBhdCk7XG4gICAgICBpZiAocHJpbnRpbmdFeHBpcmVkKGRhdGEsIHRhc2ssIGF0KSkgY29udGludWU7XG4gICAgICBkYXRhLnRhc2tzLnB1c2godGFzayk7XG4gICAgICBwcmludGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gXHU0RTAwXHU1OTI5XHU3Njg0XHU2Mjc5XHU2QjIxXHU0RTAwXHU2NUU2XHU0RUE3XHU3NTFGXHU1QjlFXHU0RjhCXHU1MzczXHU4QkIwXHU4RDI2XHVGRjFBXHU3RjE2XHU4RjkxL1x1NTIyMFx1OTY2NFx1NEUwRFx1NUY5N1x1OTc1OVx1OUVEOFx1ODg2NVx1NkVFMVx1NUY1M1x1NTkyOVx1NTM4Nlx1NTNGMlx1MzAwMlxuICAgIGlmIChwcmludGVkKSB7XG4gICAgICBwcmludGVkRGF0ZXMuYWRkKGRhdGUgYXMgc3RyaW5nKTtcbiAgICAgIGRhdGEucHJpbnRzLnB1c2goeyB0ZW1wbGF0ZUlkOiBpZCwgZGF0ZSB9KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIFx1NURGMlx1OEZDN1x1OTc1OVx1NjAwMVx1NjVGNlx1OTVGNFx1N0E5N1x1NTNFM1x1NzY4NFx1NUI5QVx1NjVGNlx1NUI5RVx1NEY4Qlx1OERGM1x1OEZDN1x1NTM3MFx1NTIzN1x1MzAwMiAqL1xuZnVuY3Rpb24gcHJpbnRpbmdFeHBpcmVkKGRhdGE6IEFwcERhdGEsIHRhc2s6IFRhc2ssIGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgaWYgKHRhc2sucmVtaW5kZXJUaW1lID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0YXNrLmR1ZURhdGUgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgdG9kYXkgPSBkYXRlQXQoYXQpO1xuICBpZiAodGFzay5kdWVEYXRlIDwgdG9kYXkpIHJldHVybiB0cnVlO1xuICBpZiAodGFzay5kdWVEYXRlID4gdG9kYXkpIHJldHVybiBmYWxzZTtcbiAgY29uc3Qgc3RhcnQgPSBtaW51dGVzT2YodGFzay5yZW1pbmRlclRpbWUpITtcbiAgY29uc3QgZ3JhY2UgPSBpc0hhYml0KHRhc2spID8gMCA6IHRhc2suc2NyYXBNaW51dGVzO1xuICBjb25zdCBlbmQgPSBzdGFydCArIHdpbmRvd01pbnV0ZXModGFzaywgZGF0YS5zZXR0aW5ncykgKyBncmFjZTtcbiAgcmV0dXJuIHNlY29uZHNPZkRheShhdCkgPj0gZW5kICogNjA7XG59XG5cbi8qKiBcdTY2M0VcdTVGMEZcdTVGNjJcdTcyQjZcdTU0MENcdTZCNjVcdUZGMUFcdTUzRUFcdTU0MENcdTZCNjVcdTY3MkFcdTVCOENcdTYyMTBcdTMwMDFcdTY3MkFcdTRGNUNcdTVFOUZcdTVCOUVcdTRGOEJcdTc2ODRcdTVGNjJcdTcyQjZcdUZGMUJcdTY1RTVcdTY3MUYvXHU3QkExXHU4Rjk2L1x1NUI4Q1x1NjIxMFx1NzJCNlx1NjAwMVx1NEUwRFx1NTJBOFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN5bmNUZW1wbGF0ZShkYXRhOiBBcHBEYXRhLCBpZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHRlbXBsYXRlID0gZGF0YS50ZW1wbGF0ZXMuZmluZCgodCkgPT4gdC5pZCA9PT0gaWQpO1xuICBpZiAodGVtcGxhdGUgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NkEyMVx1Njc3Rlx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgfVxuICBjb25zdCB2b2lkSWRzID0gbmV3IFNldChcbiAgICBkYXRhLnRhc2tzLmZpbHRlcigodCkgPT4gdGFza0lzVm9pZCh0KSkubWFwKCh0KSA9PiB0LmlkKSxcbiAgKTtcbiAgZm9yIChjb25zdCB0YXNrIG9mIGRhdGEudGFza3MpIHtcbiAgICBpZiAoIXZvaWRJZHMuaGFzKHRhc2suaWQpICYmICF0YXNrLmNvbXBsZXRlZCAmJiB0YXNrLnRlbXBsYXRlSWQgPT09IGlkKSB7XG4gICAgICBjb25zdCBzaGFwZSA9IHsgLi4udGVtcGxhdGUuc2hhcGUgfTtcbiAgICAgIHNoYXBlLmhhYml0SWQgPSB0YXNrLmhhYml0SWQ7XG4gICAgICBjb3B5U2hhcGUoc2hhcGUsIHRhc2spO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFza0lzVm9pZCh0YXNrOiBUYXNrKTogYm9vbGVhbiB7XG4gIHJldHVybiAhdGFzay5jb21wbGV0ZWQgJiYgdGFzay5yZW1pbmRlclRpbWUgIT09IG51bGwgJiYgdGFzay5yZW1pbmRlckV4cGlyZWQ7XG59XG5cbi8qKiBcdTgxRUFcdTUyQThcdTZFREFcdTUyQThcdTk4ODRcdTUzNzBcdUZGMUFcdTg4NjVcdTlGNTBcdTMwMENcdTRFQ0FcdTU5MjkgKyBcdTk4ODRcdTUzNzBcdTU5MjlcdTY1NzBcdTMwMERcdTgzMDNcdTU2RjRcdTUxODVcdTc2ODRcdTkwNTdcdTZGMEZcdUZGMENcdTdBMEJcdTVFOEZcdTUxNzNcdTk1RURcdTY3MUZcdTk1RjRcdTRFMERcdTYyNjdcdTg4NENcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXRlcmlhbGl6ZVRlbXBsYXRlcyhkYXRhOiBBcHBEYXRhLCBhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRvZGF5ID0gcGFyc2VEYXRlKGRhdGVBdChhdCkpITtcbiAgY29uc3QgcHJpbnRlZCA9IG5ldyBTZXQoXG4gICAgZGF0YS5wcmludHMubWFwKChwKSA9PiBgJHtwLnRlbXBsYXRlSWR9fCR7cC5kYXRlID8/IFwibnVsbFwifWApLFxuICApO1xuICBjb25zdCByZXF1ZXN0czogeyBpZDogc3RyaW5nOyBkYXRlczogKHN0cmluZyB8IG51bGwpW10gfVtdID0gW107XG4gIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgZGF0YS50ZW1wbGF0ZXMpIHtcbiAgICBpZiAoIXRlbXBsYXRlLmF1dG9tYXRpYykgY29udGludWU7XG4gICAgY29uc3QgZW5kID0gYWRkRGF5cyh0b2RheSwgdGVtcGxhdGUucHJpbnRBaGVhZERheXMpO1xuICAgIGNvbnN0IGVuZFN0ciA9IGAke2VuZC55ZWFyfS0ke1N0cmluZyhlbmQubW9udGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZW5kLmRheSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG4gICAgbGV0IGRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHByaW50aW5nID0gdGVtcGxhdGUucHJpbnRpbmc7XG4gICAgaWYgKHByaW50aW5nLmtpbmQgPT09IFwib25jZVwiKSB7XG4gICAgICBpZiAocHJpbnRpbmcuZGF0ZSAhPT0gbnVsbCAmJiBwcmludGluZy5kYXRlIDw9IGVuZFN0cilcbiAgICAgICAgZGF0ZXMgPSBbcHJpbnRpbmcuZGF0ZV07XG4gICAgfSBlbHNlIGlmIChwcmludGluZy5raW5kID09PSBcImNhbGVuZGFyXCIpIHtcbiAgICAgIGRhdGVzID0gW1xuICAgICAgICAuLi5uZXcgU2V0KFxuICAgICAgICAgIHByaW50aW5nLnNsb3RzLmZsYXRNYXAoKHMpID0+IHMuZGF0ZXMpLmZpbHRlcigoZCkgPT4gZCA8PSBlbmRTdHIpLFxuICAgICAgICApLFxuICAgICAgXS5zb3J0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGRheXMgPSBbLi4ubmV3IFNldChwcmludGluZy5zbG90cy5mbGF0TWFwKChzKSA9PiBzLmRheXMpKV0uc29ydChcbiAgICAgICAgKGEsIGIpID0+IGEgLSBiLFxuICAgICAgKTtcbiAgICAgIGxldCBtb25kYXkgPSB3ZWVrU3RhcnQodG9kYXkpO1xuICAgICAgY29uc3QgbGFzdCA9IHdlZWtTdGFydChlbmQpO1xuICAgICAgd2hpbGUgKGNvbXBhcmVJc28obW9uZGF5KSA8PSBjb21wYXJlSXNvKGxhc3QpKSB7XG4gICAgICAgIGZvciAoY29uc3QgZGF5IG9mIGRheXMpIHtcbiAgICAgICAgICBjb25zdCBkID0gYWRkRGF5cyhtb25kYXksIGRheSAtIDEpO1xuICAgICAgICAgIGRhdGVzLnB1c2goXG4gICAgICAgICAgICBgJHtkLnllYXJ9LSR7U3RyaW5nKGQubW9udGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZC5kYXkpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgbW9uZGF5ID0gYWRkRGF5cyhtb25kYXksIDcpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBtaXNzaW5nID0gZGF0ZXMuZmlsdGVyKChkKSA9PiAhcHJpbnRlZC5oYXMoYCR7dGVtcGxhdGUuaWR9fCR7ZH1gKSk7XG4gICAgaWYgKG1pc3NpbmcubGVuZ3RoID4gMCkge1xuICAgICAgcmVxdWVzdHMucHVzaCh7IGlkOiB0ZW1wbGF0ZS5pZCwgZGF0ZXM6IG1pc3NpbmcgfSk7XG4gICAgfVxuICB9XG4gIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gIGZvciAoY29uc3QgeyBpZDogdGVtcGxhdGVJZCwgZGF0ZXMgfSBvZiByZXF1ZXN0cykge1xuICAgIC8vIFx1NTM3MFx1NTIzN1x1NTM5Rlx1NUI1MFx1RkYxQVx1OEZCRVx1NTIzMFx1NUJCOVx1OTFDRlx1NEUwQVx1OTY1MFx1NjVGNlx1NjU3NFx1NTQ2OFx1NjcxRlx1NTE2OFx1NzU1OVx1NjIxNlx1NTE2OFx1NUYwM1x1MzAwMlxuICAgIGNvbnN0IGNhbmRpZGF0ZSA9IGNsb25lKGRhdGEpO1xuICAgIHRyeSB7XG4gICAgICBwcmludFRlbXBsYXRlKGNhbmRpZGF0ZSwgdGVtcGxhdGVJZCwgZGF0ZXMsIGF0KTtcbiAgICAgIGlmIChjYW5kaWRhdGUudGFza3MubGVuZ3RoICE9PSBkYXRhLnRhc2tzLmxlbmd0aCkge1xuICAgICAgICBjYW5kaWRhdGUudmFsaWRhdGUoKTtcbiAgICAgICAgcmVwbGFjZUFwcERhdGEoZGF0YSwgY2FuZGlkYXRlKTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBcdTRGRERcdTc1NTlcdTUzOUZcdTcyQjZcdTYwMDFcdTMwMDJcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNoYW5nZWQ7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVJc28oZGF0ZToge1xuICB5ZWFyOiBudW1iZXI7XG4gIG1vbnRoOiBudW1iZXI7XG4gIGRheTogbnVtYmVyO1xufSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtkYXRlLnllYXJ9LSR7U3RyaW5nKGRhdGUubW9udGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZGF0ZS5kYXkpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwbGFjZUFwcERhdGEodGFyZ2V0OiBBcHBEYXRhLCBzb3VyY2U6IEFwcERhdGEpOiB2b2lkIHtcbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoc291cmNlKSkge1xuICAgICh0YXJnZXQgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPilba2V5XSA9IChcbiAgICAgIHNvdXJjZSBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICAgKVtrZXldO1xuICB9XG59XG5cbi8qKiBcdThCQTFcdTUyMTIvXHU4RjkzXHU1MTY1XHU4RkI5XHU3NTRDXHVGRjFBXHU2MjhBXHU2NUU3XHU1RjBGXHU5MUNEXHU1OTBEXHU4OUM0XHU1MjE5XHU4RjZDXHU2MjEwXHU1MzcwXHU1MjM3XHU2QTIxXHU1NzhCXHVGRjBDXHU0RTBEXHU3RUQ5XHU1QjlFXHU0RjhCXHU2MzAyXHU4OUM0XHU1MjE5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbVRhc2soXG4gIHRhc2s6IFRhc2ssXG4gIHJlcGVhdDogXCJub25lXCIgfCBcImRhaWx5XCIgfCBcIndlZWtkYXlzXCIgfCBcIndlZWtseVwiLFxuICBhdDogbnVtYmVyLFxuKTogVGVtcGxhdGUge1xuICBjb25zdCBkYXRlID0gdGFzay5kdWVEYXRlID8/IGRhdGVBdChhdCk7XG4gIGNvbnN0IHdlZWtkYXkgPSAoKCkgPT4ge1xuICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlRGF0ZShkYXRlKTtcbiAgICByZXR1cm4gcGFyc2VkID09PSBudWxsID8gMSA6IHdlZWtkYXlNb25kYXkocGFyc2VkKTtcbiAgfSkoKTtcbiAgY29uc3QgZGF5cyA9XG4gICAgcmVwZWF0ID09PSBcImRhaWx5XCJcbiAgICAgID8gWzEsIDIsIDMsIDQsIDUsIDYsIDddXG4gICAgICA6IHJlcGVhdCA9PT0gXCJ3ZWVrZGF5c1wiXG4gICAgICAgID8gWzEsIDIsIDMsIDQsIDVdXG4gICAgICAgIDogW3dlZWtkYXldO1xuICByZXR1cm4ge1xuICAgIGlkOiBpZCgpLFxuICAgIGF1dG9tYXRpYzogdHJ1ZSxcbiAgICBwcmludEFoZWFkRGF5czogMCxcbiAgICBwcmludGluZzogeyBraW5kOiBcIndlZWtseVwiLCBzbG90czogW3sgZGF5cywgdGltZTogdGFzay5yZW1pbmRlclRpbWUgfV0gfSxcbiAgICBzaGFwZToge1xuICAgICAgdGl0bGU6IHRhc2sudGl0bGUsXG4gICAgICBub3RlczogdGFzay5ub3RlcyxcbiAgICAgIHByb2plY3RJZDogdGFzay5wcm9qZWN0SWQsXG4gICAgICBoYWJpdElkOiB0YXNrLmhhYml0SWQsXG4gICAgICBmb2N1c01pbnV0ZXM6IHRhc2suZm9jdXNNaW51dGVzLFxuICAgICAgc2NyYXBNaW51dGVzOiB0YXNrLnNjcmFwTWludXRlcyxcbiAgICAgIHByaW9yaXR5OiB0YXNrLnByaW9yaXR5LFxuICAgICAgZXN0aW1hdGU6IHRhc2suZXN0aW1hdGUsXG4gICAgICB0YWdzOiBbLi4udGFzay50YWdzXSxcbiAgICAgIHN1YnRhc2tzOiB0YXNrLnN1YnRhc2tzLm1hcCgocykgPT4gKHsgaWQ6IHMuaWQsIHRpdGxlOiBzLnRpdGxlIH0pKSxcbiAgICB9LFxuICB9O1xufVxuIiwgIi8vISBcdTVCNjZcdTYwQzVcdThCQzFcdTYzNkVcdUZGMUFcdTVERjJcdTVCOENcdTYyMTBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcdTMwMDFcdTY3NjVcdTZFOTBcdTUzRUZcdTVCQTFcdThCQTFcdTRFMTRcdTRFMERcdTUzRUZcdTg5ODZcdTUxOTlcdTc2ODRcdThGREJcdTVFQTZcdTUzODZcdTUzRjJcdTMwMDFcdThCQTJcdTZCNjNcdTY4QzBcdTY3RTVcdUZGMENcbi8vISBcdTYzMDlcdTYzRDBcdTRFQTQvXHU2Mjc5XHU2NTM5L1x1OEJBMlx1NkI2M1x1N0QyMlx1NUYxNVx1OEJBMVx1N0I5N1x1NTJBOFx1NjAwMVx1NUI2Nlx1NjBDNVx1NjQ1OFx1ODk4MVx1NTNDQVx1NjM4Q1x1NjNFMS9cdThCQTFcdTY1RjYvXHU4QkEyXHU2QjYzL1x1NTkwRFx1NkQ0Qlx1NTIwNlx1NUM0Mlx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvbGVhcm5pbmcucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IsIGVuc3VyZSwgcmVxdWlyZSB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHtcbiAgYXNBcnJheSxcbiAgYXNCb29sLFxuICBhc0ludCxcbiAgYXNPcHQsXG4gIGFzU3RyLFxuICBmaWVsZCxcbiAgaXNPYmplY3QsXG4gIG9uZU9mLFxuICByZWplY3RVbmtub3duLFxuICByZXF1aXJlZEZpZWxkLFxufSBmcm9tIFwiLi9qc29uXCI7XG5pbXBvcnQgdHlwZSB7IEVkdWNhdGlvbiB9IGZyb20gXCIuL2VkdWNhdGlvblwiO1xuaW1wb3J0IHR5cGUgeyBBcHBEYXRhIH0gZnJvbSBcIi4vbGliXCI7XG5pbXBvcnQgdHlwZSB7XG4gIEFzc2Vzc21lbnQsXG4gIENvbXBsZXRlZFN0dWR5VGFzayxcbiAgQ29ycmVjdGlvbixcbiAgR3JhZGUsXG4gIExlc3NvbixcbiAgUHJvZ3Jlc3NSZWNvcmQsXG4gIFJldmlldyxcbiAgU3VibWlzc2lvbixcbn0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IGF0TG9jYWxEYXRlU3RyaW5nLCBkYXRlQXQgfSBmcm9tIFwiLi90aW1lXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNvbXBsZXRlZFN0dWR5VGFzayhyYXc6IHVua25vd24pOiBDb21wbGV0ZWRTdHVkeVRhc2sge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1x1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1wiaWRcIiwgXCJwcm9qZWN0SWRcIiwgXCJ0aXRsZVwiLCBcIm5vdGVzXCIsIFwidG9waWNzXCIsIFwiY29tcGxldGVkQXRcIl0sXG4gICAgXCJcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU1REYyXHU1QjhDXHU2MjEwXHU1QjY2XHU0RTYwXHU0RUZCXHU1MkExXHU1RkVCXHU3MTY3XCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIiwgYXNTdHIpLFxuICAgIG5vdGVzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJub3Rlc1wiLCBcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1wiLCBhc1N0ciksXG4gICAgdG9waWNzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidG9waWNzXCIsXG4gICAgICBcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1wiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0b3BpY3NcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NzdFNVx1OEJDNlx1NzBCOVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIGNvbXBsZXRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb21wbGV0ZWRBdFwiLCBcIlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVx1NUZFQlx1NzE2N1wiLCBhc0ludCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVDb21wbGV0ZWRTdHVkeVRhc2soXG4gIHQ6IENvbXBsZXRlZFN0dWR5VGFzayxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogdC5pZCxcbiAgICBwcm9qZWN0SWQ6IHQucHJvamVjdElkLFxuICAgIHRpdGxlOiB0LnRpdGxlLFxuICAgIG5vdGVzOiB0Lm5vdGVzLFxuICAgIHRvcGljczogdC50b3BpY3MsXG4gICAgY29tcGxldGVkQXQ6IHQuY29tcGxldGVkQXQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHRleHQoczogc3RyaW5nLCBtYXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gcy50cmltKCkubGVuZ3RoID4gMCAmJiBBcnJheS5mcm9tKHMpLmxlbmd0aCA8PSBtYXg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUxlYXJuaW5nKGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgY29uc3QgZSA9IGRhdGEuZWR1Y2F0aW9uO1xuICBlbnN1cmUoXG4gICAgZS5wcm9ncmVzcy5sZW5ndGggKyBlLmNvbXBsZXRlZFRhc2tzLmxlbmd0aCArIGUuY29ycmVjdGlvbnMubGVuZ3RoIDw9XG4gICAgICAxMDAwMDAsXG4gICAgXCJcdTVCNjZcdTRFNjBcdThCQzFcdTYzNkVcdTY1NzBcdTkxQ0ZcdThEODVcdTUxRkFcdTk2NTBcdTUyMzZcIixcbiAgKTtcbiAgY29uc3QgaWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgdGFzayBvZiBlLmNvbXBsZXRlZFRhc2tzKSB7XG4gICAgZW5zdXJlKFxuICAgICAgIWlkcy5oYXMoYHRhc2t8JHt0YXNrLmlkfWApICYmXG4gICAgICAgIHRhc2suaWQubGVuZ3RoID4gMCAmJlxuICAgICAgICBkYXRhLnByb2plY3RzLnNvbWUoKHApID0+IHAuaWQgPT09IHRhc2sucHJvamVjdElkKSAmJlxuICAgICAgICB0ZXh0KHRhc2sudGl0bGUsIDIwMCkgJiZcbiAgICAgICAgdGFzay5ub3Rlcy5sZW5ndGggPD0gNTAwMDAgJiZcbiAgICAgICAgdGFzay50b3BpY3MubGVuZ3RoIDw9IDIwLFxuICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTVERjJcdTVCOENcdTYyMTBcdTVCNjZcdTRFNjBcdTRFRkJcdTUyQTFcdTVGRUJcdTcxNjdcIixcbiAgICApO1xuICAgIGlkcy5hZGQoYHRhc2t8JHt0YXNrLmlkfWApO1xuICB9XG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIGUucHJvZ3Jlc3MpIHtcbiAgICBlbnN1cmUoXG4gICAgICAhaWRzLmhhcyhgcHJvZ3Jlc3N8JHtyZWNvcmQuaWR9YCkgJiZcbiAgICAgICAgcmVjb3JkLmlkLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgZGF0YS5wcm9qZWN0cy5zb21lKChwKSA9PiBwLmlkID09PSByZWNvcmQucHJvamVjdElkKSAmJlxuICAgICAgICB0ZXh0KHJlY29yZC50b3BpYywgMjAwKSAmJlxuICAgICAgICB0ZXh0KHJlY29yZC5wb3NpdGlvbiwgMjAwMCkgJiZcbiAgICAgICAgdGV4dChyZWNvcmQuZXZpZGVuY2UsIDgwMDApICYmXG4gICAgICAgIEFycmF5LmZyb20ocmVjb3JkLm5leHRBY3Rpb24pLmxlbmd0aCA8PSAyMDAwLFxuICAgICAgXCJcdTVCNjZcdTRFNjBcdThGREJcdTVFQTZcdTk3MDBcdTg5ODFcdTk4NzlcdTc2RUVcdTMwMDFcdTc3RTVcdThCQzZcdTcwQjlcdTMwMDFcdTVCOUVcdTk2NDVcdTRGNERcdTdGNkVcdTU0OENcdTRGOURcdTYzNkVcIixcbiAgICApO1xuICAgIGlkcy5hZGQoYHByb2dyZXNzfCR7cmVjb3JkLmlkfWApO1xuICB9XG4gIGZvciAoY29uc3QgY29ycmVjdGlvbiBvZiBlLmNvcnJlY3Rpb25zKSB7XG4gICAgY29uc3QgZ3JhZGUgPSByZXF1aXJlKGUuZ3JhZGVzLmZpbmQoXG4gICAgICAoZykgPT4gZy5pZCA9PT0gY29ycmVjdGlvbi5ncmFkZUlkLFxuICAgICksIFwiXHU4QkEyXHU2QjYzXHU3RjNBXHU1QzExXHU2Mjc5XHU2NTM5XHU4QkIwXHU1RjU1XCIpO1xuICAgIGNvbnN0IGFzc2Vzc21lbnQgPSByZXF1aXJlKCgoKSA9PiB7XG4gICAgICBjb25zdCBzdWIgPSBlLnN1Ym1pc3Npb25zLmZpbmQoKHMpID0+IHMuaWQgPT09IGdyYWRlLnN1Ym1pc3Npb25JZCk7XG4gICAgICByZXR1cm4gc3ViID09PSB1bmRlZmluZWRcbiAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgOiBlLmFzc2Vzc21lbnRzLmZpbmQoKGEpID0+IGEuaWQgPT09IHN1Yi5hc3Nlc3NtZW50SWQpO1xuICAgIH0pKCksIFwiXHU4QkEyXHU2QjYzXHU3RjNBXHU1QzExXHU4QkQ1XHU5ODk4XCIpO1xuICAgIGVuc3VyZShcbiAgICAgICFpZHMuaGFzKGBjb3JyZWN0aW9ufCR7Y29ycmVjdGlvbi5pZH1gKSAmJlxuICAgICAgICBjb3JyZWN0aW9uLmlkLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgYXNzZXNzbWVudC5xdWVzdGlvbnMuc29tZSgocSkgPT4gcS5pZCA9PT0gY29ycmVjdGlvbi5xdWVzdGlvbklkKSAmJlxuICAgICAgICBBcnJheS5mcm9tKGNvcnJlY3Rpb24uZXhwbGFuYXRpb24pLmxlbmd0aCA8PSA4MDAwICYmXG4gICAgICAgICh0ZXh0KGNvcnJlY3Rpb24uZXhwbGFuYXRpb24sIDgwMDApIHx8XG4gICAgICAgICAgY29ycmVjdGlvbi5yZXNvdXJjZUlkcy5sZW5ndGggPiAwKSAmJlxuICAgICAgICBjb3JyZWN0aW9uLnJlc291cmNlSWRzLmV2ZXJ5KChpZCkgPT5cbiAgICAgICAgICBlLnJlc291cmNlcy5zb21lKFxuICAgICAgICAgICAgKHIpID0+IHIuaWQgPT09IGlkICYmIHIucHJvamVjdElkID09PSBhc3Nlc3NtZW50LnByb2plY3RJZCxcbiAgICAgICAgICApLFxuICAgICAgICApICYmXG4gICAgICAgIChjb3JyZWN0aW9uLmFjY2VwdGVkICE9PSBudWxsKSA9PT0gKGNvcnJlY3Rpb24ucmV2aWV3ZWRBdCAhPT0gbnVsbCkgJiZcbiAgICAgICAgKGNvcnJlY3Rpb24ucmV2aWV3ZWRBdCA9PT0gbnVsbCB8fFxuICAgICAgICAgIChjb3JyZWN0aW9uLnJldmlld2VkQXQgPj0gY29ycmVjdGlvbi5zdWJtaXR0ZWRBdCAmJlxuICAgICAgICAgICAgdGV4dChjb3JyZWN0aW9uLmZlZWRiYWNrLCA4MDAwKSkpLFxuICAgICAgXCJcdThCQTJcdTZCNjNcdTk3MDBcdTg5ODFcdTUzOUZcdTk4OThcdTMwMDFcdTg5RTNcdTkxQ0FcdTYyMTZcdTY3MkNcdTk4NzlcdTc2RUVcdTk2NDRcdTRFRjZcdUZGMUJcdTY4QzBcdTY3RTVcdTdFRDNcdTY3OUNcdTVGQzVcdTk4N0JcdTY3MDlcdTUzQ0RcdTk5ODhcIixcbiAgICApO1xuICAgIGlkcy5hZGQoYGNvcnJlY3Rpb258JHtjb3JyZWN0aW9uLmlkfWApO1xuICB9XG59XG5cbi8qKiBcdThGREJcdTVFQTYvXHU1RkVCXHU3MTY3L1x1OEJBMlx1NkI2M1x1NTM4Nlx1NTNGMlx1NEUwRFx1NTNFRlx1NTIyMFx1OTY2NFx1MzAwMVx1NEUwRFx1NTNFRlx1NjUzOVx1NTE5OVx1RkYxQlx1Nzg2RVx1OEJBNFx1NEUwRVx1NjhDMFx1NjdFNVx1NzJCNlx1NjAwMVx1NTE0MVx1OEJCOFx1NTM1NVx1NTQxMVx1NjNBOFx1OEZEQlx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlTGVhcm5pbmdUcmFuc2l0aW9uKFxuICBiZWZvcmU6IEVkdWNhdGlvbixcbiAgYWZ0ZXI6IEVkdWNhdGlvbixcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IHJlY29yZCBvZiBiZWZvcmUucHJvZ3Jlc3MpIHtcbiAgICBlbnN1cmUoXG4gICAgICBhZnRlci5wcm9ncmVzcy5zb21lKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpLFxuICAgICAgXCJcdThGREJcdTVFQTZcdTUzODZcdTUzRjJcdTRFMERcdTgwRkRcdTUyMjBcdTk2NjRcdUZGMENcdThCRjdcdTY1QjBcdTU4OUVcdTY2RjRcdTZCNjNcdThCQjBcdTVGNTVcIixcbiAgICApO1xuICAgIGNvbnN0IG5leHQgPSBhZnRlci5wcm9ncmVzcy5maW5kKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpO1xuICAgIGlmIChuZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG9sZCA9IHsgLi4ucmVjb3JkIH07XG4gICAgICBvbGQuY29uZmlybWVkID0gbmV4dC5jb25maXJtZWQ7XG4gICAgICBlbnN1cmUocHJvZ3Jlc3NFcXVhbHMob2xkLCBuZXh0KSwgXCJcdThGREJcdTVFQTZcdTUzODZcdTUzRjJcdTRFMERcdTUzRUZcdTY1MzlcdTUxOTlcdUZGMENcdThCRjdcdTY1QjBcdTU4OUVcdTRFMDBcdTY3NjFcdTY2RjRcdTZCNjNcdThCQjBcdTVGNTVcIik7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIGJlZm9yZS5jb21wbGV0ZWRUYXNrcykge1xuICAgIGVuc3VyZShcbiAgICAgIGFmdGVyLmNvbXBsZXRlZFRhc2tzLmZpbmQoKHIpID0+IHIuaWQgPT09IHJlY29yZC5pZCkgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICBjb21wbGV0ZWRUYXNrRXF1YWxzKFxuICAgICAgICAgIGFmdGVyLmNvbXBsZXRlZFRhc2tzLmZpbmQoKHIpID0+IHIuaWQgPT09IHJlY29yZC5pZCkhLFxuICAgICAgICAgIHJlY29yZCxcbiAgICAgICAgKSxcbiAgICAgIFwiXHU1REYyXHU1QjhDXHU2MjEwXHU0RUZCXHU1MkExXHU3Njg0XHU1QjY2XHU0RTYwXHU1MTg1XHU1QkI5XHU1RkVCXHU3MTY3XHU0RTBEXHU1M0VGXHU2NTM5XHU1MTk5XCIsXG4gICAgKTtcbiAgfVxuICBmb3IgKGNvbnN0IHJlY29yZCBvZiBiZWZvcmUuY29ycmVjdGlvbnMpIHtcbiAgICBlbnN1cmUoXG4gICAgICBhZnRlci5jb3JyZWN0aW9ucy5zb21lKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpLFxuICAgICAgXCJcdThCQTJcdTZCNjNcdTUzODZcdTUzRjJcdTRFMERcdTgwRkRcdTUyMjBcdTk2NjRcIixcbiAgICApO1xuICAgIGNvbnN0IG5leHQgPSBhZnRlci5jb3JyZWN0aW9ucy5maW5kKChyKSA9PiByLmlkID09PSByZWNvcmQuaWQpO1xuICAgIGlmIChuZXh0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG9sZCA9IHsgLi4ucmVjb3JkLCByZXNvdXJjZUlkczogWy4uLnJlY29yZC5yZXNvdXJjZUlkc10gfTtcbiAgICAgIGlmIChvbGQucmV2aWV3ZWRBdCA9PT0gbnVsbCkge1xuICAgICAgICBvbGQuYWNjZXB0ZWQgPSBuZXh0LmFjY2VwdGVkO1xuICAgICAgICBvbGQuZmVlZGJhY2sgPSBuZXh0LmZlZWRiYWNrO1xuICAgICAgICBvbGQucmV2aWV3ZWRBdCA9IG5leHQucmV2aWV3ZWRBdDtcbiAgICAgIH1cbiAgICAgIGVuc3VyZShcbiAgICAgICAgY29ycmVjdGlvbkVxdWFscyhvbGQsIG5leHQpLFxuICAgICAgICBcIlx1OEJBMlx1NkI2M1x1NEUwRVx1NjhDMFx1NjdFNVx1NTM4Nlx1NTNGMlx1NEUwRFx1NTNFRlx1NjUzOVx1NTE5OVx1RkYwQ1x1OEJGN1x1NjVCMFx1NTg5RVx1NEUwMFx1NkIyMVx1OEJBMlx1NkI2M1wiLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvZ3Jlc3NFcXVhbHMoYTogUHJvZ3Jlc3NSZWNvcmQsIGI6IFByb2dyZXNzUmVjb3JkKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgYS5pZCA9PT0gYi5pZCAmJlxuICAgIGEucHJvamVjdElkID09PSBiLnByb2plY3RJZCAmJlxuICAgIGEudG9waWMgPT09IGIudG9waWMgJiZcbiAgICBhLnBvc2l0aW9uID09PSBiLnBvc2l0aW9uICYmXG4gICAgYS5zdGF0ZSA9PT0gYi5zdGF0ZSAmJlxuICAgIGEuZXZpZGVuY2UgPT09IGIuZXZpZGVuY2UgJiZcbiAgICBhLm5leHRBY3Rpb24gPT09IGIubmV4dEFjdGlvbiAmJlxuICAgIGEuc291cmNlID09PSBiLnNvdXJjZSAmJlxuICAgIGEuY29uZmlybWVkID09PSBiLmNvbmZpcm1lZCAmJlxuICAgIGEucmVjb3JkZWRBdCA9PT0gYi5yZWNvcmRlZEF0XG4gICk7XG59XG5cbmZ1bmN0aW9uIGNvbXBsZXRlZFRhc2tFcXVhbHMoXG4gIGE6IENvbXBsZXRlZFN0dWR5VGFzayxcbiAgYjogQ29tcGxldGVkU3R1ZHlUYXNrLFxuKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgYS5pZCA9PT0gYi5pZCAmJlxuICAgIGEucHJvamVjdElkID09PSBiLnByb2plY3RJZCAmJlxuICAgIGEudGl0bGUgPT09IGIudGl0bGUgJiZcbiAgICBhLm5vdGVzID09PSBiLm5vdGVzICYmXG4gICAgYS50b3BpY3MubGVuZ3RoID09PSBiLnRvcGljcy5sZW5ndGggJiZcbiAgICBhLnRvcGljcy5ldmVyeSgodCwgaSkgPT4gYi50b3BpY3NbaV0gPT09IHQpICYmXG4gICAgYS5jb21wbGV0ZWRBdCA9PT0gYi5jb21wbGV0ZWRBdFxuICApO1xufVxuXG5mdW5jdGlvbiBjb3JyZWN0aW9uRXF1YWxzKGE6IENvcnJlY3Rpb24sIGI6IENvcnJlY3Rpb24pOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICBhLmlkID09PSBiLmlkICYmXG4gICAgYS5ncmFkZUlkID09PSBiLmdyYWRlSWQgJiZcbiAgICBhLnF1ZXN0aW9uSWQgPT09IGIucXVlc3Rpb25JZCAmJlxuICAgIGEuZXhwbGFuYXRpb24gPT09IGIuZXhwbGFuYXRpb24gJiZcbiAgICBhLnJlc291cmNlSWRzLmxlbmd0aCA9PT0gYi5yZXNvdXJjZUlkcy5sZW5ndGggJiZcbiAgICBhLnJlc291cmNlSWRzLmV2ZXJ5KChyLCBpKSA9PiBiLnJlc291cmNlSWRzW2ldID09PSByKSAmJlxuICAgIGEuc3VibWl0dGVkQXQgPT09IGIuc3VibWl0dGVkQXQgJiZcbiAgICBhLmFjY2VwdGVkID09PSBiLmFjY2VwdGVkICYmXG4gICAgYS5mZWVkYmFjayA9PT0gYi5mZWVkYmFjayAmJlxuICAgIGEucmV2aWV3ZWRBdCA9PT0gYi5yZXZpZXdlZEF0XG4gICk7XG59XG5cbi8vIC0tLS0tLS0tLS0gXHU1QjY2XHU2MEM1XHU2NDU4XHU4OTgxIC0tLS0tLS0tLS1cblxuaW50ZXJmYWNlIFN1bW1hcnlJbmRleCB7XG4gIHN1Ym1pc3Npb25zOiBNYXA8c3RyaW5nLCBTdWJtaXNzaW9uPjtcbiAgZ3JhZGVzOiBNYXA8c3RyaW5nLCBHcmFkZT47XG4gIGFzc2Vzc21lbnRHcmFkZXM6IE1hcDxzdHJpbmcsIEdyYWRlPjtcbiAgYWNjZXB0ZWQ6IFNldDxzdHJpbmc+O1xuICByZXRlc3RzOiBNYXA8c3RyaW5nLCBBc3Nlc3NtZW50W10+O1xufVxuXG5mdW5jdGlvbiBidWlsZFN1bW1hcnlJbmRleChlOiBFZHVjYXRpb24pOiBTdW1tYXJ5SW5kZXgge1xuICBjb25zdCBpbmRleDogU3VtbWFyeUluZGV4ID0ge1xuICAgIHN1Ym1pc3Npb25zOiBuZXcgTWFwKCksXG4gICAgZ3JhZGVzOiBuZXcgTWFwKCksXG4gICAgYXNzZXNzbWVudEdyYWRlczogbmV3IE1hcCgpLFxuICAgIGFjY2VwdGVkOiBuZXcgU2V0KCksXG4gICAgcmV0ZXN0czogbmV3IE1hcCgpLFxuICB9O1xuICBjb25zdCBwYXJlbnRzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBzIG9mIGUuc3VibWlzc2lvbnMpIHtcbiAgICBwYXJlbnRzLnNldChzLmlkLCBzLmFzc2Vzc21lbnRJZCk7XG4gICAgY29uc3Qgb2xkID0gaW5kZXguc3VibWlzc2lvbnMuZ2V0KHMuYXNzZXNzbWVudElkKTtcbiAgICBpZiAob2xkID09PSB1bmRlZmluZWQgfHwgcy5zdWJtaXR0ZWRBdCA+PSBvbGQuc3VibWl0dGVkQXQpIHtcbiAgICAgIGluZGV4LnN1Ym1pc3Npb25zLnNldChzLmFzc2Vzc21lbnRJZCwgcyk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgZyBvZiBlLmdyYWRlcykge1xuICAgIGNvbnN0IG9sZCA9IGluZGV4LmdyYWRlcy5nZXQoZy5zdWJtaXNzaW9uSWQpO1xuICAgIGlmIChvbGQgPT09IHVuZGVmaW5lZCB8fCBnLmdyYWRlZEF0ID49IG9sZC5ncmFkZWRBdCkge1xuICAgICAgaW5kZXguZ3JhZGVzLnNldChnLnN1Ym1pc3Npb25JZCwgZyk7XG4gICAgfVxuICAgIGNvbnN0IGFzc2Vzc21lbnQgPSBwYXJlbnRzLmdldChnLnN1Ym1pc3Npb25JZCk7XG4gICAgaWYgKGFzc2Vzc21lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3Qgb2xkQSA9IGluZGV4LmFzc2Vzc21lbnRHcmFkZXMuZ2V0KGFzc2Vzc21lbnQpO1xuICAgICAgaWYgKG9sZEEgPT09IHVuZGVmaW5lZCB8fCBnLmdyYWRlZEF0ID49IG9sZEEuZ3JhZGVkQXQpIHtcbiAgICAgICAgaW5kZXguYXNzZXNzbWVudEdyYWRlcy5zZXQoYXNzZXNzbWVudCwgZyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgYyBvZiBlLmNvcnJlY3Rpb25zKSB7XG4gICAgaWYgKGMuYWNjZXB0ZWQgPT09IHRydWUpIHtcbiAgICAgIGluZGV4LmFjY2VwdGVkLmFkZChgJHtjLmdyYWRlSWR9fCR7Yy5xdWVzdGlvbklkfWApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IGEgb2YgZS5hc3Nlc3NtZW50cykge1xuICAgIGlmIChhLnJldGVzdE9mR3JhZGVJZCAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgbGlzdCA9IGluZGV4LnJldGVzdHMuZ2V0KGEucmV0ZXN0T2ZHcmFkZUlkKSA/PyBbXTtcbiAgICAgIGxpc3QucHVzaChhKTtcbiAgICAgIGluZGV4LnJldGVzdHMuc2V0KGEucmV0ZXN0T2ZHcmFkZUlkLCBsaXN0KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBhc3Nlc3NtZW50U3VtbWFyeShcbiAgaW5kZXg6IFN1bW1hcnlJbmRleCxcbiAgYTogQXNzZXNzbWVudCxcbiAgYXQ6IG51bWJlcixcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3Qgc3VibWlzc2lvbiA9IGluZGV4LnN1Ym1pc3Npb25zLmdldChhLmlkKSA/PyBudWxsO1xuICBjb25zdCBncmFkZSA9XG4gICAgc3VibWlzc2lvbiAhPT0gbnVsbCA/IChpbmRleC5ncmFkZXMuZ2V0KHN1Ym1pc3Npb24uaWQpID8/IG51bGwpIDogbnVsbDtcbiAgY29uc3Qgc3RhdHVzID0gKCgpID0+IHtcbiAgICBpZiAoZ3JhZGUgIT09IG51bGwpIHtcbiAgICAgIGlmIChncmFkZS5uZWVkc1JldmlldykgcmV0dXJuIFwibmVlZHNSZXZpZXdcIjtcbiAgICAgIGlmIChcbiAgICAgICAgZ3JhZGUuZXJyb3JzLnNvbWUoXG4gICAgICAgICAgKGVycm9yKSA9PiAhaW5kZXguYWNjZXB0ZWQuaGFzKGAke2dyYWRlLmlkfXwke2Vycm9yLnF1ZXN0aW9uSWR9YCksXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gXCJjb3JyZWN0aW9uRHVlXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gXCJncmFkZWRcIjtcbiAgICB9XG4gICAgaWYgKHN1Ym1pc3Npb24gIT09IG51bGwpIHJldHVybiBcInN1Ym1pdHRlZFwiO1xuICAgIGlmIChcbiAgICAgIGEua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICBhLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgICAgZGF0ZUF0KGF0KSA+IGRhdGVBdChhLnN0YXJ0c0F0KVxuICAgICkge1xuICAgICAgcmV0dXJuIFwibWlzc2VkXCI7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIGEua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJlxuICAgICAgYS5zdG9wcGVkQXQgPT09IG51bGwgJiZcbiAgICAgIGF0IDwgZXhhbURlYWRsaW5lKGEpXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJpblByb2dyZXNzXCI7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIGEua2luZCAhPT0gXCJob21ld29ya1wiICYmXG4gICAgICBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJlxuICAgICAgKGEuc3RvcHBlZEF0ICE9PSBudWxsIHx8IGF0ID49IGV4YW1EZWFkbGluZShhKSlcbiAgICApIHtcbiAgICAgIHJldHVybiBcImF3YWl0aW5nU3VibWlzc2lvblwiO1xuICAgIH1cbiAgICBpZiAoYS5raW5kID09PSBcImhvbWV3b3JrXCIgJiYgYXQgPj0gYS5lbmRzQXQpIHJldHVybiBcIm92ZXJkdWVcIjtcbiAgICBpZiAoYXQgPCBhLnN0YXJ0c0F0IHx8IChhLmtpbmQgIT09IFwiaG9tZXdvcmtcIiAmJiBhLnN0YXJ0ZWRBdCA9PT0gbnVsbCkpXG4gICAgICByZXR1cm4gXCJ1cGNvbWluZ1wiO1xuICAgIHJldHVybiBcImF3YWl0aW5nU3VibWlzc2lvblwiO1xuICB9KSgpO1xuICByZXR1cm4ge1xuICAgIGlkOiBhLmlkLFxuICAgIHRpdGxlOiBhLnRpdGxlLFxuICAgIGtpbmQ6IGEua2luZCxcbiAgICBzdGF0dXMsXG4gICAgc3RhcnRzQXQ6IGEuc3RhcnRzQXQsXG4gICAgZW5kc0F0OiBhLmVuZHNBdCxcbiAgICBzdWJtaXNzaW9uSWQ6IHN1Ym1pc3Npb24/LmlkID8/IG51bGwsXG4gICAgc3VibWl0dGVkQXQ6IHN1Ym1pc3Npb24/LnN1Ym1pdHRlZEF0ID8/IG51bGwsXG4gICAgdW5maW5pc2hlZDogc3VibWlzc2lvbiAhPT0gbnVsbCAmJiBzdWJtaXNzaW9uLnVuZmluaXNoZWQsXG4gICAgbGF0ZTpcbiAgICAgIGEua2luZCA9PT0gXCJob21ld29ya1wiICYmXG4gICAgICBzdWJtaXNzaW9uICE9PSBudWxsICYmXG4gICAgICBzdWJtaXNzaW9uLnN1Ym1pdHRlZEF0ID4gYS5lbmRzQXQsXG4gICAgZ3JhZGVJZDogZ3JhZGU/LmlkID8/IG51bGwsXG4gICAgZ3JhZGVkQXQ6IGdyYWRlPy5ncmFkZWRBdCA/PyBudWxsLFxuICAgIHNjb3JlOlxuICAgICAgZ3JhZGUgIT09IG51bGwgJiYgIWdyYWRlLm5lZWRzUmV2aWV3XG4gICAgICAgID8gZ3JhZGUuYXdhcmRzLnJlZHVjZSgobiwgcCkgPT4gbiArIHAuYXdhcmRlZCwgMClcbiAgICAgICAgOiBudWxsLFxuICAgIHRvdGFsOiBhLnF1ZXN0aW9ucy5yZWR1Y2UoXG4gICAgICAobiwgcSkgPT4gbiArIHEuc2NvcmluZy5yZWR1Y2UoKG0sIHApID0+IG0gKyBwLnBvaW50cywgMCksXG4gICAgICAwLFxuICAgICksXG4gICAgbmVlZHNSZXZpZXc6IGdyYWRlICE9PSBudWxsICYmIGdyYWRlLm5lZWRzUmV2aWV3LFxuICB9O1xufVxuXG5mdW5jdGlvbiBleGFtRGVhZGxpbmUoYTogQXNzZXNzbWVudCk6IG51bWJlciB7XG4gIHJldHVybiBhLnN0YXJ0ZWRBdCA9PT0gbnVsbFxuICAgID8gYS5lbmRzQXRcbiAgICA6IGEuc3RhcnRlZEF0ICsgKGEuZW5kc0F0IC0gYS5zdGFydHNBdCk7XG59XG5cbi8qKiBcdTZCQ0ZcdTZCMjFcdTRFQ0VcdTVGNTNcdTUyNERcdThCQzFcdTYzNkVcdTYzQThcdTVCRkNcdUZGMUJcdTZDQTFcdTY3MDlcdTdCMkNcdTRFOENcdTRFRkRcdTRGMUFcdThGQzdcdTY3MUZcdTc2ODRcdTY0NThcdTg5ODFcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBzdW1tYXJpZXMoXG4gIGRhdGE6IEFwcERhdGEsXG4gIGF0OiBudW1iZXIsXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdIHtcbiAgY29uc3QgZSA9IGRhdGEuZWR1Y2F0aW9uO1xuICBjb25zdCBpbmRleCA9IGJ1aWxkU3VtbWFyeUluZGV4KGUpO1xuICBjb25zdCBvdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+W10gPSBbXTtcbiAgZm9yIChjb25zdCBwcm9qZWN0IG9mIGRhdGEucHJvamVjdHMuZmlsdGVyKFxuICAgIChwKSA9PlxuICAgICAgZS5wcm9qZWN0cy5zb21lKChzKSA9PiBzLnByb2plY3RJZCA9PT0gcC5pZCkgfHxcbiAgICAgIGUucHJvZ3Jlc3Muc29tZSgocikgPT4gci5wcm9qZWN0SWQgPT09IHAuaWQpLFxuICApKSB7XG4gICAgY29uc3QgcHJvZ3Jlc3MgPSBlLnByb2dyZXNzXG4gICAgICAuZmlsdGVyKChyKSA9PiByLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZClcbiAgICAgIC5zbGljZSgpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5yZWNvcmRlZEF0IC0gYi5yZWNvcmRlZEF0KTtcbiAgICBjb25zdCB0b3BpY3MgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBsYXRlc3QgPSBwcm9ncmVzc1xuICAgICAgLnNsaWNlKClcbiAgICAgIC5yZXZlcnNlKClcbiAgICAgIC5maWx0ZXIoKHIpID0+IHtcbiAgICAgICAgaWYgKHRvcGljcy5oYXMoci50b3BpYykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgdG9waWNzLmFkZChyLnRvcGljKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgICBjb25zdCBhc3Nlc3NtZW50cyA9IGUuYXNzZXNzbWVudHNcbiAgICAgIC5maWx0ZXIoKGEpID0+IGEucHJvamVjdElkID09PSBwcm9qZWN0LmlkKVxuICAgICAgLm1hcCgoYSkgPT4gYXNzZXNzbWVudFN1bW1hcnkoaW5kZXgsIGEsIGF0KSlcbiAgICAgIC5zb3J0KChhLCBiKSA9PiAoYi5zdGFydHNBdCBhcyBudW1iZXIpIC0gKGEuc3RhcnRzQXQgYXMgbnVtYmVyKSk7XG4gICAgY29uc3QgcmV0ZXN0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSA9IFtdO1xuICAgIGNvbnN0IGdyYWRlcyA9IGUuYXNzZXNzbWVudHNcbiAgICAgIC5maWx0ZXIoKGEpID0+IGEucHJvamVjdElkID09PSBwcm9qZWN0LmlkKVxuICAgICAgLm1hcCgoYSkgPT4gaW5kZXguYXNzZXNzbWVudEdyYWRlcy5nZXQoYS5pZCkpXG4gICAgICAuZmlsdGVyKChnKTogZyBpcyBHcmFkZSA9PiBnICE9PSB1bmRlZmluZWQpO1xuICAgIGZvciAoY29uc3QgZ3JhZGUgb2YgZ3JhZGVzKSB7XG4gICAgICBjb25zdCBhdHRlbXB0cyA9IChpbmRleC5yZXRlc3RzLmdldChncmFkZS5pZCkgPz8gW10pLm1hcCgoYSkgPT5cbiAgICAgICAgYXNzZXNzbWVudFN1bW1hcnkoaW5kZXgsIGEsIGF0KSxcbiAgICAgICk7XG4gICAgICBmb3IgKGNvbnN0IGVycm9yIG9mIGdyYWRlLmVycm9ycykge1xuICAgICAgICByZXRlc3RzLnB1c2goe1xuICAgICAgICAgIGdyYWRlSWQ6IGdyYWRlLmlkLFxuICAgICAgICAgIHF1ZXN0aW9uSWQ6IGVycm9yLnF1ZXN0aW9uSWQsXG4gICAgICAgICAgY2F1c2U6IGVycm9yLmNhdXNlLFxuICAgICAgICAgIGNvbmZpcm1lZDogZXJyb3IuY29uZmlybWVkLFxuICAgICAgICAgIHJldGVzdERhdGU6IGVycm9yLnJldGVzdERhdGUsXG4gICAgICAgICAgbmV4dENoZWNrOiBlcnJvci5uZXh0Q2hlY2ssXG4gICAgICAgICAgY29ycmVjdGlvbkFjY2VwdGVkOiBpbmRleC5hY2NlcHRlZC5oYXMoXG4gICAgICAgICAgICBgJHtncmFkZS5pZH18JHtlcnJvci5xdWVzdGlvbklkfWAsXG4gICAgICAgICAgKSxcbiAgICAgICAgICBhdHRlbXB0cyxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldGVzdHMuc29ydCgoYSwgYikgPT5cbiAgICAgIFN0cmluZyhhW1wicmV0ZXN0RGF0ZVwiXSkubG9jYWxlQ29tcGFyZShTdHJpbmcoYltcInJldGVzdERhdGVcIl0pKSxcbiAgICApO1xuICAgIGNvbnN0IHJlY2VudFRhc2tzID0gZS5jb21wbGV0ZWRUYXNrc1xuICAgICAgLnNsaWNlKClcbiAgICAgIC5yZXZlcnNlKClcbiAgICAgIC5maWx0ZXIoKHQpID0+IHQucHJvamVjdElkID09PSBwcm9qZWN0LmlkKVxuICAgICAgLnNsaWNlKDAsIDUpO1xuICAgIGNvbnN0IGxlc3NvbnMgPSBlLmxlc3NvbnMuZmlsdGVyKChsKSA9PiBsLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZCk7XG4gICAgY29uc3QgbGFzdExlc3NvbiA9IGxlc3NvbnNcbiAgICAgIC5maWx0ZXIoKGwpID0+IGwuYXR0ZW5kZWQpXG4gICAgICAucmVkdWNlPExlc3NvbiB8IG51bGw+KFxuICAgICAgICAoYmVzdCwgbCkgPT4gKGJlc3QgPT09IG51bGwgfHwgbC5zdGFydHNBdCA+IGJlc3Quc3RhcnRzQXQgPyBsIDogYmVzdCksXG4gICAgICAgIG51bGwsXG4gICAgICApO1xuICAgIGNvbnN0IGxhdGVzdFJldmlldyA9IGUucmV2aWV3c1xuICAgICAgLmZpbHRlcigocikgPT4gci5wcm9qZWN0SWQgPT09IHByb2plY3QuaWQpXG4gICAgICAucmVkdWNlPFJldmlldyB8IG51bGw+KFxuICAgICAgICAoYmVzdCwgcikgPT4gKGJlc3QgPT09IG51bGwgfHwgci5kYXRlID4gYmVzdC5kYXRlID8gciA6IGJlc3QpLFxuICAgICAgICBudWxsLFxuICAgICAgKTtcbiAgICBjb25zdCByZXZpZXdUaW1lID1cbiAgICAgIGxhdGVzdFJldmlldyA9PT0gbnVsbCA/IG51bGwgOiBhdExvY2FsRGF0ZVN0cmluZyhsYXRlc3RSZXZpZXcuZGF0ZSk7XG4gICAgY29uc3QgdXBkYXRlZCA9IE1hdGgubWF4KFxuICAgICAgLi4uW1xuICAgICAgICAuLi5sYXRlc3QubWFwKChyKSA9PiByLnJlY29yZGVkQXQpLFxuICAgICAgICAuLi5yZWNlbnRUYXNrcy5tYXAoKHIpID0+IHIuY29tcGxldGVkQXQpLFxuICAgICAgICAuLi4obGFzdExlc3NvbiAhPT0gbnVsbCA/IFtsYXN0TGVzc29uLnN0YXJ0c0F0XSA6IFtdKSxcbiAgICAgICAgLi4uKHJldmlld1RpbWUgIT09IG51bGwgPyBbcmV2aWV3VGltZV0gOiBbXSksXG4gICAgICAgIC4uLmFzc2Vzc21lbnRzXG4gICAgICAgICAgLmZpbHRlcigoYSkgPT4gdHlwZW9mIGFbXCJzdWJtaXR0ZWRBdFwiXSA9PT0gXCJudW1iZXJcIilcbiAgICAgICAgICAubWFwKChhKSA9PiBhW1wic3VibWl0dGVkQXRcIl0gYXMgbnVtYmVyKSxcbiAgICAgICAgLi4uYXNzZXNzbWVudHNcbiAgICAgICAgICAuZmlsdGVyKChhKSA9PiB0eXBlb2YgYVtcImdyYWRlZEF0XCJdID09PSBcIm51bWJlclwiKVxuICAgICAgICAgIC5tYXAoKGEpID0+IGFbXCJncmFkZWRBdFwiXSBhcyBudW1iZXIpLFxuICAgICAgICAuLi5lLmNvcnJlY3Rpb25zXG4gICAgICAgICAgLmZpbHRlcigoYykgPT4gYXNzZXNzbWVudHMuc29tZSgoYSkgPT4gYVtcImdyYWRlSWRcIl0gPT09IGMuZ3JhZGVJZCkpXG4gICAgICAgICAgLm1hcCgoYykgPT4gYy5yZXZpZXdlZEF0ID8/IGMuc3VibWl0dGVkQXQpLFxuICAgICAgXS5maWx0ZXIoKG4pID0+IHR5cGVvZiBuID09PSBcIm51bWJlclwiKSxcbiAgICAgIC1JbmZpbml0eSxcbiAgICApO1xuICAgIGNvbnN0IHRhc2tJZHMgPSBuZXcgU2V0PHN0cmluZz4oW1xuICAgICAgLi4uZGF0YS50YXNrcy5maWx0ZXIoKHQpID0+IHQucHJvamVjdElkID09PSBwcm9qZWN0LmlkKS5tYXAoKHQpID0+IHQuaWQpLFxuICAgICAgLi4uZS5jb21wbGV0ZWRUYXNrc1xuICAgICAgICAuZmlsdGVyKCh0KSA9PiB0LnByb2plY3RJZCA9PT0gcHJvamVjdC5pZClcbiAgICAgICAgLm1hcCgodCkgPT4gdC5pZCksXG4gICAgXSk7XG4gICAgY29uc3QgYWN0dWFsU2Vjb25kcyA9IGRhdGEuc2Vzc2lvbnNcbiAgICAgIC5maWx0ZXIoXG4gICAgICAgIChzKSA9PlxuICAgICAgICAgIHMuc291cmNlID09PSBcInRpbWVyXCIgJiZcbiAgICAgICAgICBzLmVuZGVkQXQgPj0gYXQgLSA3ICogODY0MDAgJiZcbiAgICAgICAgICBzLmVuZGVkQXQgPD0gYXQgJiZcbiAgICAgICAgICBzLnRhc2tJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgIHRhc2tJZHMuaGFzKHMudGFza0lkKSxcbiAgICAgIClcbiAgICAgIC5yZWR1Y2UoKG4sIHMpID0+IG4gKyBzLmR1cmF0aW9uU2VjcywgMCk7XG4gICAgY29uc3QgYXNzZXNzbWVudENvdW50ID0gYXNzZXNzbWVudHMubGVuZ3RoO1xuICAgIGNvbnN0IHJldGVzdENvdW50ID0gcmV0ZXN0cy5sZW5ndGg7XG4gICAgb3V0LnB1c2goe1xuICAgICAgcHJvamVjdElkOiBwcm9qZWN0LmlkLFxuICAgICAgcHJvamVjdE5hbWU6IHByb2plY3QubmFtZSxcbiAgICAgIHVwZGF0ZWRBdDogTnVtYmVyLmlzRmluaXRlKHVwZGF0ZWQpID8gdXBkYXRlZCA6IG51bGwsXG4gICAgICBwcm9ncmVzczogbGF0ZXN0LnNsaWNlKDAsIDEyKSxcbiAgICAgIHByb2dyZXNzQ291bnQ6IGUucHJvZ3Jlc3MuZmlsdGVyKChyKSA9PiByLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZClcbiAgICAgICAgLmxlbmd0aCxcbiAgICAgIHJlY2VudENvbXBsZXRlZFRhc2tzOiByZWNlbnRUYXNrcyxcbiAgICAgIGxhc3RBdHRlbmRlZExlc3NvbjpcbiAgICAgICAgbGFzdExlc3NvbiA9PT0gbnVsbFxuICAgICAgICAgID8gbnVsbFxuICAgICAgICAgIDoge1xuICAgICAgICAgICAgICBpZDogbGFzdExlc3Nvbi5pZCxcbiAgICAgICAgICAgICAgdGl0bGU6IGxhc3RMZXNzb24udGl0bGUsXG4gICAgICAgICAgICAgIHByb2dyZXNzOiBsYXN0TGVzc29uLnByb2dyZXNzLFxuICAgICAgICAgICAgICBzdGF0ZTogbGFzdExlc3Nvbi5zdGF0ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICBsZXNzb25zOiB7XG4gICAgICAgIHBsYW5uZWQ6IGxlc3NvbnMuZmlsdGVyKChsKSA9PiBsLnN0YXRlID09PSBcInBsYW5uZWRcIikubGVuZ3RoLFxuICAgICAgICBhdHRlbmRlZDogbGVzc29ucy5maWx0ZXIoKGwpID0+IGwuYXR0ZW5kZWQpLmxlbmd0aCxcbiAgICAgICAgbWlzc2VkOiBsZXNzb25zLmZpbHRlcigobCkgPT4gbC5zdGF0ZSA9PT0gXCJtaXNzZWRcIikubGVuZ3RoLFxuICAgICAgfSxcbiAgICAgIGFjdHVhbEZvY3VzU2Vjb25kczdkOiBhY3R1YWxTZWNvbmRzLFxuICAgICAgYXNzZXNzbWVudHM6IGFzc2Vzc21lbnRzLnNsaWNlKDAsIDIwKSxcbiAgICAgIGFzc2Vzc21lbnRDb3VudCxcbiAgICAgIHJldGVzdHM6IHJldGVzdHMuc2xpY2UoMCwgMjApLFxuICAgICAgcmV0ZXN0Q291bnQsXG4gICAgICBsYXRlc3RSZXZpZXcsXG4gICAgICBwZW5kaW5nRXZlbnRzOiBlLmV2ZW50cy5maWx0ZXIoXG4gICAgICAgIChyKSA9PiByLnByb2plY3RJZCA9PT0gcHJvamVjdC5pZCAmJiByLnN0YXRlICE9PSBcImRvbmVcIixcbiAgICAgICkubGVuZ3RoLFxuICAgICAgbm90ZTogXCJcdThCQTFcdTY1RjZcdTRFMEVcdTRFRkJcdTUyQTFcdTVCOENcdTYyMTBcdTUzRUFcdThCRjRcdTY2MEVcdTYyOTVcdTUxNjVcdTYyMTZcdTgxRUFcdTYyQTVcdTVCOENcdTYyMTBcdUZGMUJcdTYzOENcdTYzRTFcdTk4N0JcdTY3RTVcdTc3MEJcdTdCNTRcdTUzNzdcdTMwMDFcdTYyNzlcdTY1MzlcdTRFMEVcdTcyRUNcdTdBQ0JcdTU5MERcdTZENEJcdTMwMDJcdTdBN0FcdThCQjBcdTVGNTVcdTg4NjhcdTc5M0FcdTY3MkFcdTc3RTVcdTMwMDJcIixcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuIiwgIi8vISBcdTY1NTlcdTVCNjZcdTVCOUVcdTRGNTNcdTMwMDFcdTYzMDFcdTRFNDVcdTUzMTZcdTRFOEJcdTRFRjZcdTMwMDFcdThENDRcdTZFOTBcdTVGMTVcdTc1MjhcdTRFMEVcdTUzODZcdTUzRjJcdTRGRERcdTYyQTRcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgY3JhdGVzL2NvcmUvc3JjL2VkdWNhdGlvbi5yc1x1MzAwMlxuXG5pbXBvcnQgeyBBcHBFcnJvciwgZW5zdXJlIH0gZnJvbSBcIi4vZXJyb3JzXCI7XG5pbXBvcnQge1xuICBhc0FycmF5LFxuICBhc0Jvb2wsXG4gIGFzSW50LFxuICBhc09wdCxcbiAgYXNTdHIsXG4gIGZpZWxkLFxuICBpc09iamVjdCxcbiAgb25lT2YsXG4gIHJlamVjdFVua25vd24sXG4gIHJlcXVpcmVkRmllbGQsXG59IGZyb20gXCIuL2pzb25cIjtcbmltcG9ydCB0eXBlIHtcbiAgQXNzZXNzbWVudCxcbiAgQXNzZXNzbWVudEtpbmQsXG4gIENvcnJlY3Rpb24sXG4gIEVycm9yQW5hbHlzaXMsXG4gIEdyYWRlLFxuICBMZXNzb24sXG4gIExlc3NvblN0YXRlLFxuICBNaWxlc3RvbmUsXG4gIFBvaW50QXdhcmQsXG4gIFByb2dyZXNzUmVjb3JkLFxuICBQcm9ncmVzc1NvdXJjZSxcbiAgUHJvamVjdFN0dWR5LFxuICBRdWVzdGlvbixcbiAgUXVlc3Rpb25UaW1lLFxuICBSZXNvdXJjZSxcbiAgUmVzb3VyY2VLaW5kLFxuICBSZXZpZXcsXG4gIFNjb3JpbmdQb2ludCxcbiAgU2VtZXN0ZXIsXG4gIFN1Ym1pc3Npb24sXG4gIFRlYWNoaW5nRXZlbnQsXG59IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgdHlwZSB7IEFwcERhdGEgfSBmcm9tIFwiLi9saWJcIjtcbmltcG9ydCB0eXBlIHsgQ29tcGxldGVkU3R1ZHlUYXNrLCBUYXNrIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7XG4gIGRheXNCZXR3ZWVuLFxuICBkYXRlQXQsXG4gIGxvY2FsRGF0ZU9mLFxuICBtaW51dGVzT2YsXG4gIHBhcnNlRGF0ZSxcbiAgdmFsaWREYXRlLFxuICB3ZWVrZGF5TW9uZGF5LFxufSBmcm9tIFwiLi90aW1lXCI7XG5pbXBvcnQge1xuICBwYXJzZUNvbXBsZXRlZFN0dWR5VGFzayxcbiAgc2VyaWFsaXplQ29tcGxldGVkU3R1ZHlUYXNrLFxuICB2YWxpZGF0ZUxlYXJuaW5nLFxuICB2YWxpZGF0ZUxlYXJuaW5nVHJhbnNpdGlvbixcbn0gZnJvbSBcIi4vbGVhcm5pbmdcIjtcbmltcG9ydCB7IG92ZXJsYXBNaW51dGVzIGFzIG92ZXJsYXBNaW51dGVzT2ZCbG9jayB9IGZyb20gXCIuL2Jsb2Nrc1wiO1xuXG4vLyAtLS0tLS0tLS0tIFx1NTQ3RFx1NEVFNCAtLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlIENvbW1hbmQgPVxuICB8IHsgb3A6IFwic2F2ZVByb2plY3RcIjsgcHJvamVjdDogUHJvamVjdFN0dWR5IH1cbiAgfCB7IG9wOiBcInNhdmVSZXNvdXJjZVwiOyByZXNvdXJjZTogUmVzb3VyY2UgfVxuICB8IHsgb3A6IFwicmVtb3ZlUmVzb3VyY2VzXCI7IGlkczogc3RyaW5nW10gfVxuICB8IHsgb3A6IFwic2F2ZVNlbWVzdGVyXCI7IHNlbWVzdGVyOiBTZW1lc3RlciB9XG4gIHwgeyBvcDogXCJzYXZlTGVzc29uXCI7IGxlc3NvbjogTGVzc29uIH1cbiAgfCB7IG9wOiBcInNldExlc3NvblJlc291cmNlc1wiOyBpZDogc3RyaW5nOyByZXNvdXJjZUlkczogc3RyaW5nW10gfVxuICB8IHsgb3A6IFwiYXR0ZW5kTGVzc29uXCI7IGlkOiBzdHJpbmc7IHByb2dyZXNzOiBzdHJpbmcgfVxuICB8IHsgb3A6IFwicHVibGlzaEFzc2Vzc21lbnRcIjsgYXNzZXNzbWVudDogQXNzZXNzbWVudCB9XG4gIHwgeyBvcDogXCJjb25maXJtUHJpbnRlZFwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcInN0YXJ0RXhhbVwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcImVuZEV4YW1cIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyBvcDogXCJzdWJtaXRcIjsgc3VibWlzc2lvbjogU3VibWlzc2lvbiB9XG4gIHwgeyBvcDogXCJyZWNvcmRRdWVzdGlvblRpbWVzXCI7IGlkOiBzdHJpbmc7IHF1ZXN0aW9uVGltZXM6IFF1ZXN0aW9uVGltZVtdIH1cbiAgfCB7IG9wOiBcImdyYWRlXCI7IGdyYWRlOiBHcmFkZSB9XG4gIHwgeyBvcDogXCJzYXZlUmV2aWV3XCI7IHJldmlldzogUmV2aWV3IH1cbiAgfCB7IG9wOiBcImNsYWltRXZlbnRcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyBvcDogXCJmaW5pc2hFdmVudFwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcInJldHJ5RXZlbnRcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyBvcDogXCJyZWNvcmRQcm9ncmVzc1wiOyByZWNvcmQ6IFByb2dyZXNzUmVjb3JkIH1cbiAgfCB7IG9wOiBcImNvbmZpcm1Qcm9ncmVzc1wiOyBpZDogc3RyaW5nIH1cbiAgfCB7IG9wOiBcInN1Ym1pdENvcnJlY3Rpb25cIjsgY29ycmVjdGlvbjogQ29ycmVjdGlvbiB9XG4gIHwgeyBvcDogXCJyZXZpZXdDb3JyZWN0aW9uXCI7IGlkOiBzdHJpbmc7IGFjY2VwdGVkOiBib29sZWFuOyBmZWVkYmFjazogc3RyaW5nIH07XG5cbmNvbnN0IENPTU1BTkRfS0VZUzogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICBzYXZlUHJvamVjdDogW1wib3BcIiwgXCJwcm9qZWN0XCJdLFxuICBzYXZlUmVzb3VyY2U6IFtcIm9wXCIsIFwicmVzb3VyY2VcIl0sXG4gIHJlbW92ZVJlc291cmNlczogW1wib3BcIiwgXCJpZHNcIl0sXG4gIHNhdmVTZW1lc3RlcjogW1wib3BcIiwgXCJzZW1lc3RlclwiXSxcbiAgc2F2ZUxlc3NvbjogW1wib3BcIiwgXCJsZXNzb25cIl0sXG4gIHNldExlc3NvblJlc291cmNlczogW1wib3BcIiwgXCJpZFwiLCBcInJlc291cmNlSWRzXCJdLFxuICBhdHRlbmRMZXNzb246IFtcIm9wXCIsIFwiaWRcIiwgXCJwcm9ncmVzc1wiXSxcbiAgcHVibGlzaEFzc2Vzc21lbnQ6IFtcIm9wXCIsIFwiYXNzZXNzbWVudFwiXSxcbiAgY29uZmlybVByaW50ZWQ6IFtcIm9wXCIsIFwiaWRcIl0sXG4gIHN0YXJ0RXhhbTogW1wib3BcIiwgXCJpZFwiXSxcbiAgZW5kRXhhbTogW1wib3BcIiwgXCJpZFwiXSxcbiAgc3VibWl0OiBbXCJvcFwiLCBcInN1Ym1pc3Npb25cIl0sXG4gIHJlY29yZFF1ZXN0aW9uVGltZXM6IFtcIm9wXCIsIFwiaWRcIiwgXCJxdWVzdGlvblRpbWVzXCJdLFxuICBncmFkZTogW1wib3BcIiwgXCJncmFkZVwiXSxcbiAgc2F2ZVJldmlldzogW1wib3BcIiwgXCJyZXZpZXdcIl0sXG4gIGNsYWltRXZlbnQ6IFtcIm9wXCIsIFwiaWRcIl0sXG4gIGZpbmlzaEV2ZW50OiBbXCJvcFwiLCBcImlkXCJdLFxuICByZXRyeUV2ZW50OiBbXCJvcFwiLCBcImlkXCJdLFxuICByZWNvcmRQcm9ncmVzczogW1wib3BcIiwgXCJyZWNvcmRcIl0sXG4gIGNvbmZpcm1Qcm9ncmVzczogW1wib3BcIiwgXCJpZFwiXSxcbiAgc3VibWl0Q29ycmVjdGlvbjogW1wib3BcIiwgXCJjb3JyZWN0aW9uXCJdLFxuICByZXZpZXdDb3JyZWN0aW9uOiBbXCJvcFwiLCBcImlkXCIsIFwiYWNjZXB0ZWRcIiwgXCJmZWVkYmFja1wiXSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNvbW1hbmQocmF3OiB1bmtub3duKTogQ29tbWFuZCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICBjb25zdCBvcCA9IG9uZU9mKFxuICAgIHJlcXVpcmVkRmllbGQocmF3LCBcIm9wXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNCBvcFwiLFxuICAgIE9iamVjdC5rZXlzKENPTU1BTkRfS0VZUyksXG4gICk7XG4gIHJlamVjdFVua25vd24ocmF3LCBDT01NQU5EX0tFWVNbb3BdISwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIik7XG4gIHN3aXRjaCAob3ApIHtcbiAgICBjYXNlIFwic2F2ZVByb2plY3RcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBwcm9qZWN0OiBwYXJzZVByb2plY3RTdHVkeShcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9qZWN0XCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNhdmVSZXNvdXJjZVwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIHJlc291cmNlOiBwYXJzZVJlc291cmNlKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInJlc291cmNlXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInJlbW92ZVJlc291cmNlc1wiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIGlkczogYXNBcnJheShcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJpZHNcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwiaWRzXCIsXG4gICAgICAgICkubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1OEQ0NFx1NkU5MCBJRFwiKSksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlU2VtZXN0ZXJcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBzZW1lc3RlcjogcGFyc2VTZW1lc3RlcihcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJzZW1lc3RlclwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlTGVzc29uXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgbGVzc29uOiBwYXJzZUxlc3NvbihyZXF1aXJlZEZpZWxkKHJhdywgXCJsZXNzb25cIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNldExlc3NvblJlc291cmNlc1wiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCBhc1N0ciksXG4gICAgICAgIHJlc291cmNlSWRzOiBhc0FycmF5KFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInJlc291cmNlSWRzXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgICBcInJlc291cmNlSWRzXCIsXG4gICAgICAgICkubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1OEQ0NFx1NkU5MCBJRFwiKSksXG4gICAgICB9O1xuICAgIGNhc2UgXCJhdHRlbmRMZXNzb25cIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgYXNTdHIpLFxuICAgICAgICBwcm9ncmVzczogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvZ3Jlc3NcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgYXNTdHIpLFxuICAgICAgfTtcbiAgICBjYXNlIFwicHVibGlzaEFzc2Vzc21lbnRcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBhc3Nlc3NtZW50OiBwYXJzZUFzc2Vzc21lbnQoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwiYXNzZXNzbWVudFwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJjb25maXJtUHJpbnRlZFwiOlxuICAgIGNhc2UgXCJzdGFydEV4YW1cIjpcbiAgICBjYXNlIFwiZW5kRXhhbVwiOlxuICAgIGNhc2UgXCJjbGFpbUV2ZW50XCI6XG4gICAgY2FzZSBcImZpbmlzaEV2ZW50XCI6XG4gICAgY2FzZSBcInJldHJ5RXZlbnRcIjpcbiAgICBjYXNlIFwiY29uZmlybVByb2dyZXNzXCI6XG4gICAgICByZXR1cm4geyBvcCwgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsIGFzU3RyKSB9O1xuICAgIGNhc2UgXCJzdWJtaXRcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBzdWJtaXNzaW9uOiBwYXJzZVN1Ym1pc3Npb24oXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwic3VibWlzc2lvblwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdiksXG4gICAgICAgICksXG4gICAgICB9O1xuICAgIGNhc2UgXCJyZWNvcmRRdWVzdGlvblRpbWVzXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvcCxcbiAgICAgICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsIGFzU3RyKSxcbiAgICAgICAgcXVlc3Rpb25UaW1lczogYXNBcnJheShcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJxdWVzdGlvblRpbWVzXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgICBcInF1ZXN0aW9uVGltZXNcIixcbiAgICAgICAgKS5tYXAocGFyc2VRdWVzdGlvblRpbWUpLFxuICAgICAgfTtcbiAgICBjYXNlIFwiZ3JhZGVcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBncmFkZTogcGFyc2VHcmFkZShyZXF1aXJlZEZpZWxkKHJhdywgXCJncmFkZVwiLCBcIlx1NjU1OVx1NUI2Nlx1NTQ3RFx1NEVFNFwiLCAodikgPT4gdikpLFxuICAgICAgfTtcbiAgICBjYXNlIFwic2F2ZVJldmlld1wiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIHJldmlldzogcGFyc2VSZXZpZXcocmVxdWlyZWRGaWVsZChyYXcsIFwicmV2aWV3XCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSksXG4gICAgICB9O1xuICAgIGNhc2UgXCJyZWNvcmRQcm9ncmVzc1wiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIHJlY29yZDogcGFyc2VQcm9ncmVzc1JlY29yZChcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJyZWNvcmRcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgKHYpID0+IHYpLFxuICAgICAgICApLFxuICAgICAgfTtcbiAgICBjYXNlIFwic3VibWl0Q29ycmVjdGlvblwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3AsXG4gICAgICAgIGNvcnJlY3Rpb246IHBhcnNlQ29ycmVjdGlvbihcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJjb3JyZWN0aW9uXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInJldmlld0NvcnJlY3Rpb25cIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9wLFxuICAgICAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgYXNTdHIpLFxuICAgICAgICBhY2NlcHRlZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiYWNjZXB0ZWRcIiwgXCJcdTY1NTlcdTVCNjZcdTU0N0RcdTRFRTRcIiwgYXNCb29sKSxcbiAgICAgICAgZmVlZGJhY2s6IHJlcXVpcmVkRmllbGQocmF3LCBcImZlZWRiYWNrXCIsIFwiXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XCIsIGFzU3RyKSxcbiAgICAgIH07XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihgXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XHU1M0Q2XHU1MDNDXHU2NUUwXHU2NTQ4XHVGRjFBJHtvcH1gKTtcbiAgfVxufVxuXG4vKiogXHU1MkE5XHU2MjRCXHU0RTEzXHU1QzVFXHU1NDdEXHU0RUU0XHVGRjFBXHU4QkZFXHU3QTBCXHUzMDAxXHU0RjVDXHU0RTFBXHUzMDAxXHU4QkQ1XHU1Mzc3XHU1NDhDXHU2Mjc5XHU2NTM5XHU1M0VBXHU4MEZEXHU3NTMxXHU1QjY2XHU0RTYwXHU1MkE5XHU2MjRCXHU3NTFGXHU2MjEwXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gYXNzaXN0YW50T25seShjb21tYW5kOiBDb21tYW5kKTogYm9vbGVhbiB7XG4gIHJldHVybiBbXG4gICAgXCJzYXZlU2VtZXN0ZXJcIixcbiAgICBcInNhdmVMZXNzb25cIixcbiAgICBcInB1Ymxpc2hBc3Nlc3NtZW50XCIsXG4gICAgXCJncmFkZVwiLFxuICAgIFwicmVjb3JkUXVlc3Rpb25UaW1lc1wiLFxuICAgIFwic2F2ZVJldmlld1wiLFxuICAgIFwiZmluaXNoRXZlbnRcIixcbiAgICBcImNsYWltRXZlbnRcIixcbiAgICBcInJldmlld0NvcnJlY3Rpb25cIixcbiAgXS5pbmNsdWRlcyhjb21tYW5kLm9wKTtcbn1cblxuLy8gLS0tLS0tLS0tLSBcdTVCOUVcdTRGNTNcdTg5RTNcdTY3OTAvXHU1RThGXHU1MjE3XHU1MzE2IC0tLS0tLS0tLS1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvamVjdFN0dWR5KHJhdzogdW5rbm93bik6IFByb2plY3RTdHVkeSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJkaXJlY3RvcnlcIixcbiAgICAgIFwiZXhhbU1vZGVcIixcbiAgICAgIFwidmlzaW9uSWRcIixcbiAgICAgIFwidGFyZ2V0XCIsXG4gICAgICBcImV4YW1EYXRlXCIsXG4gICAgICBcInN5bGxhYnVzSWRcIixcbiAgICAgIFwicGFzdFBhcGVySWRzXCIsXG4gICAgICBcIm1vY2tQYXBlcklkc1wiLFxuICAgIF0sXG4gICAgXCJcdTY1NTlcdTVCNjZcdTk4NzlcdTc2RUVcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBwcm9qZWN0SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb2plY3RJZFwiLCBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLCBhc1N0ciksXG4gICAgZGlyZWN0b3J5OiByZXF1aXJlZEZpZWxkKHJhdywgXCJkaXJlY3RvcnlcIiwgXCJcdTY1NTlcdTVCNjZcdTk4NzlcdTc2RUVcIiwgYXNTdHIpLFxuICAgIGV4YW1Nb2RlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJleGFtTW9kZVwiLCBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLCBhc0Jvb2wpLFxuICAgIHZpc2lvbklkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidmlzaW9uSWRcIixcbiAgICAgIFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJ2aXNpb25JZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICB0YXJnZXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInRhcmdldFwiLCBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLCBhc1N0ciksXG4gICAgZXhhbURhdGU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJleGFtRGF0ZVwiLFxuICAgICAgXCJcdTY1NTlcdTVCNjZcdTk4NzlcdTc2RUVcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImV4YW1EYXRlXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHN5bGxhYnVzSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzeWxsYWJ1c0lkXCIsXG4gICAgICBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwic3lsbGFidXNJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBwYXN0UGFwZXJJZHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJwYXN0UGFwZXJJZHNcIixcbiAgICAgIFwiXHU2NTU5XHU1QjY2XHU5ODc5XHU3NkVFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInBhc3RQYXBlcklkc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU3NzFGXHU5ODk4IElEXCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgbW9ja1BhcGVySWRzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwibW9ja1BhcGVySWRzXCIsXG4gICAgICBcIlx1NjU1OVx1NUI2Nlx1OTg3OVx1NzZFRVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJtb2NrUGFwZXJJZHNcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NkEyMVx1NjJERlx1OTg5OCBJRFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUHJvamVjdFN0dWR5KFxuICBwOiBQcm9qZWN0U3R1ZHksXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgcHJvamVjdElkOiBwLnByb2plY3RJZCxcbiAgICBkaXJlY3Rvcnk6IHAuZGlyZWN0b3J5LFxuICAgIGV4YW1Nb2RlOiBwLmV4YW1Nb2RlLFxuICAgIHZpc2lvbklkOiBwLnZpc2lvbklkLFxuICAgIHRhcmdldDogcC50YXJnZXQsXG4gICAgZXhhbURhdGU6IHAuZXhhbURhdGUsXG4gICAgc3lsbGFidXNJZDogcC5zeWxsYWJ1c0lkLFxuICAgIHBhc3RQYXBlcklkczogcC5wYXN0UGFwZXJJZHMsXG4gICAgbW9ja1BhcGVySWRzOiBwLm1vY2tQYXBlcklkcyxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUmVzb3VyY2UocmF3OiB1bmtub3duKTogUmVzb3VyY2Uge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEQ0NFx1NkU5MFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1wiaWRcIiwgXCJwcm9qZWN0SWRcIiwgXCJ0aXRsZVwiLCBcImtpbmRcIiwgXCJwYXRoXCIsIFwic291cmNlXCIsIFwiZWRpdGlvblwiLCBcInRvcGljc1wiXSxcbiAgICBcIlx1OEQ0NFx1NkU5MFwiLFxuICApO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1OEQ0NFx1NkU5MFwiLCBhc1N0ciksXG4gICAgcHJvamVjdElkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9qZWN0SWRcIiwgXCJcdThENDRcdTZFOTBcIiwgYXNTdHIpLFxuICAgIHRpdGxlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aXRsZVwiLCBcIlx1OEQ0NFx1NkU5MFwiLCBhc1N0ciksXG4gICAga2luZDogb25lT2YoXG4gICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJraW5kXCIsIFwiXHU4RDQ0XHU2RTkwXCIsICh2KSA9PiB2KSxcbiAgICAgIFwiXHU4RDQ0XHU2RTkwIGtpbmRcIixcbiAgICAgIFtcbiAgICAgICAgXCJzeWxsYWJ1c1wiLFxuICAgICAgICBcImNvdXJzZVwiLFxuICAgICAgICBcImJvb2tcIixcbiAgICAgICAgXCJwYXN0UGFwZXJcIixcbiAgICAgICAgXCJtb2NrUGFwZXJcIixcbiAgICAgICAgXCJyZWZlcmVuY2VcIixcbiAgICAgICAgXCJhdHRhY2htZW50XCIsXG4gICAgICAgIFwiYW5zd2VyU2hlZXRcIixcbiAgICAgIF0sXG4gICAgKSBhcyBSZXNvdXJjZUtpbmQsXG4gICAgcGF0aDogcmVxdWlyZWRGaWVsZChyYXcsIFwicGF0aFwiLCBcIlx1OEQ0NFx1NkU5MFwiLCBhc1N0ciksXG4gICAgc291cmNlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJzb3VyY2VcIiwgXCJcdThENDRcdTZFOTBcIiwgYXNTdHIpLFxuICAgIGVkaXRpb246IHJlcXVpcmVkRmllbGQocmF3LCBcImVkaXRpb25cIiwgXCJcdThENDRcdTZFOTBcIiwgYXNTdHIpLFxuICAgIHRvcGljczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInRvcGljc1wiLFxuICAgICAgXCJcdThENDRcdTZFOTBcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwidG9waWNzXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdTc3RTVcdThCQzZcdTcwQjlcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVJlc291cmNlKHI6IFJlc291cmNlKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiByLmlkLFxuICAgIHByb2plY3RJZDogci5wcm9qZWN0SWQsXG4gICAgdGl0bGU6IHIudGl0bGUsXG4gICAga2luZDogci5raW5kLFxuICAgIHBhdGg6IHIucGF0aCxcbiAgICBzb3VyY2U6IHIuc291cmNlLFxuICAgIGVkaXRpb246IHIuZWRpdGlvbixcbiAgICB0b3BpY3M6IHIudG9waWNzLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VNaWxlc3RvbmUocmF3OiB1bmtub3duKTogTWlsZXN0b25lIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTk2MzZcdTZCQjVcdThGREJcdTVFQTZcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24oXG4gICAgcmF3LFxuICAgIFtcIndlZWtcIiwgXCJ0b3BpY3NcIiwgXCJyZXNvdXJjZUlkc1wiLCBcIm9iamVjdGl2ZVwiLCBcImxlc3NvbkNvdW50XCJdLFxuICAgIFwiXHU5NjM2XHU2QkI1XHU4RkRCXHU1RUE2XCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgd2VlazogcmVxdWlyZWRGaWVsZChyYXcsIFwid2Vla1wiLCBcIlx1OTYzNlx1NkJCNVx1OEZEQlx1NUVBNlwiLCBhc0ludCksXG4gICAgdG9waWNzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidG9waWNzXCIsXG4gICAgICBcIlx1OTYzNlx1NkJCNVx1OEZEQlx1NUVBNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0b3BpY3NcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NzdFNVx1OEJDNlx1NzBCOVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHJlc291cmNlSWRzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicmVzb3VyY2VJZHNcIixcbiAgICAgIFwiXHU5NjM2XHU2QkI1XHU4RkRCXHU1RUE2XCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInJlc291cmNlSWRzXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdThENDRcdTZFOTAgSURcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBvYmplY3RpdmU6IHJlcXVpcmVkRmllbGQocmF3LCBcIm9iamVjdGl2ZVwiLCBcIlx1OTYzNlx1NkJCNVx1OEZEQlx1NUVBNlwiLCBhc1N0ciksXG4gICAgbGVzc29uQ291bnQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImxlc3NvbkNvdW50XCIsIFwiXHU5NjM2XHU2QkI1XHU4RkRCXHU1RUE2XCIsIGFzSW50KSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZU1pbGVzdG9uZShtOiBNaWxlc3RvbmUpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgd2VlazogbS53ZWVrLFxuICAgIHRvcGljczogbS50b3BpY3MsXG4gICAgcmVzb3VyY2VJZHM6IG0ucmVzb3VyY2VJZHMsXG4gICAgb2JqZWN0aXZlOiBtLm9iamVjdGl2ZSxcbiAgICBsZXNzb25Db3VudDogbS5sZXNzb25Db3VudCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU2VtZXN0ZXIocmF3OiB1bmtub3duKTogU2VtZXN0ZXIge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1xuICAgICAgXCJpZFwiLFxuICAgICAgXCJwcm9qZWN0SWRcIixcbiAgICAgIFwidGl0bGVcIixcbiAgICAgIFwic3RhcnREYXRlXCIsXG4gICAgICBcImVuZERhdGVcIixcbiAgICAgIFwicmV2aXNpb25cIixcbiAgICAgIFwiYmFzZWxpbmVcIixcbiAgICAgIFwiZXZpZGVuY2VcIixcbiAgICAgIFwicmF0aW9uYWxlXCIsXG4gICAgICBcIm1pbGVzdG9uZXNcIixcbiAgICBdLFxuICAgIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb2plY3RJZFwiLCBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiLCBhc1N0ciksXG4gICAgdGl0bGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpdGxlXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsIGFzU3RyKSxcbiAgICBzdGFydERhdGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInN0YXJ0RGF0ZVwiLCBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiLCBhc1N0ciksXG4gICAgZW5kRGF0ZTogcmVxdWlyZWRGaWVsZChyYXcsIFwiZW5kRGF0ZVwiLCBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiLCBhc1N0ciksXG4gICAgcmV2aXNpb246IHJlcXVpcmVkRmllbGQocmF3LCBcInJldmlzaW9uXCIsIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsIGFzSW50KSxcbiAgICBiYXNlbGluZTogcmVxdWlyZWRGaWVsZChyYXcsIFwiYmFzZWxpbmVcIiwgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcIiwgYXNTdHIpLFxuICAgIGV2aWRlbmNlOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiZXZpZGVuY2VcIixcbiAgICAgIFwiXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcImV2aWRlbmNlXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdTRGOURcdTYzNkVcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICByYXRpb25hbGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInJhdGlvbmFsZVwiLCBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiLCBhc1N0ciksXG4gICAgbWlsZXN0b25lczogcmVxdWlyZWRGaWVsZChyYXcsIFwibWlsZXN0b25lc1wiLCBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiLCAodikgPT5cbiAgICAgIGFzQXJyYXkodiwgXCJtaWxlc3RvbmVzXCIpLm1hcChwYXJzZU1pbGVzdG9uZSksXG4gICAgKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVNlbWVzdGVyKHM6IFNlbWVzdGVyKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiBzLmlkLFxuICAgIHByb2plY3RJZDogcy5wcm9qZWN0SWQsXG4gICAgdGl0bGU6IHMudGl0bGUsXG4gICAgc3RhcnREYXRlOiBzLnN0YXJ0RGF0ZSxcbiAgICBlbmREYXRlOiBzLmVuZERhdGUsXG4gICAgcmV2aXNpb246IHMucmV2aXNpb24sXG4gICAgYmFzZWxpbmU6IHMuYmFzZWxpbmUsXG4gICAgZXZpZGVuY2U6IHMuZXZpZGVuY2UsXG4gICAgcmF0aW9uYWxlOiBzLnJhdGlvbmFsZSxcbiAgICBtaWxlc3RvbmVzOiBzLm1pbGVzdG9uZXMubWFwKHNlcmlhbGl6ZU1pbGVzdG9uZSksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUxlc3NvbihyYXc6IHVua25vd24pOiBMZXNzb24ge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGRVx1N0EwQlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1xuICAgICAgXCJpZFwiLFxuICAgICAgXCJwcm9qZWN0SWRcIixcbiAgICAgIFwic2VtZXN0ZXJJZFwiLFxuICAgICAgXCJzZW1lc3RlclJldmlzaW9uXCIsXG4gICAgICBcInRpdGxlXCIsXG4gICAgICBcInRvcGljc1wiLFxuICAgICAgXCJyZXNvdXJjZUlkc1wiLFxuICAgICAgXCJzdGFydHNBdFwiLFxuICAgICAgXCJlbmRzQXRcIixcbiAgICAgIFwiYWlFbmFibGVkXCIsXG4gICAgICBcImF0dGVuZGVkXCIsXG4gICAgICBcInByb2dyZXNzXCIsXG4gICAgICBcInN0YXRlXCIsXG4gICAgXSxcbiAgICBcIlx1OEJGRVx1N0EwQlwiLFxuICApO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc1N0ciksXG4gICAgcHJvamVjdElkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9qZWN0SWRcIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNTdHIpLFxuICAgIHNlbWVzdGVySWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInNlbWVzdGVySWRcIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNTdHIpLFxuICAgIHNlbWVzdGVyUmV2aXNpb246IGZpZWxkKHJhdywgXCJzZW1lc3RlclJldmlzaW9uXCIsIFwiXHU4QkZFXHU3QTBCXCIsIGFzSW50LCAxKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNTdHIpLFxuICAgIHRvcGljczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInRvcGljc1wiLFxuICAgICAgXCJcdThCRkVcdTdBMEJcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwidG9waWNzXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdTc3RTVcdThCQzZcdTcwQjlcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICByZXNvdXJjZUlkczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJlc291cmNlSWRzXCIsXG4gICAgICBcIlx1OEJGRVx1N0EwQlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJyZXNvdXJjZUlkc1wiKS5tYXAoKHgpID0+IGFzU3RyKHgsIFwiXHU4RDQ0XHU2RTkwIElEXCIpKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgc3RhcnRzQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInN0YXJ0c0F0XCIsIFwiXHU4QkZFXHU3QTBCXCIsIGFzSW50KSxcbiAgICBlbmRzQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImVuZHNBdFwiLCBcIlx1OEJGRVx1N0EwQlwiLCBhc0ludCksXG4gICAgYWlFbmFibGVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhaUVuYWJsZWRcIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNCb29sKSxcbiAgICBhdHRlbmRlZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiYXR0ZW5kZWRcIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNCb29sKSxcbiAgICBwcm9ncmVzczogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvZ3Jlc3NcIiwgXCJcdThCRkVcdTdBMEJcIiwgYXNTdHIpLFxuICAgIHN0YXRlOiBvbmVPZihcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInN0YXRlXCIsIFwiXHU4QkZFXHU3QTBCXCIsICh2KSA9PiB2KSxcbiAgICAgIFwiXHU4QkZFXHU3QTBCIHN0YXRlXCIsXG4gICAgICBbXCJwbGFubmVkXCIsIFwiYWN0aXZlXCIsIFwiZW5kZWRcIiwgXCJtaXNzZWRcIl0sXG4gICAgKSBhcyBMZXNzb25TdGF0ZSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUxlc3NvbihsOiBMZXNzb24pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGwuaWQsXG4gICAgcHJvamVjdElkOiBsLnByb2plY3RJZCxcbiAgICBzZW1lc3RlcklkOiBsLnNlbWVzdGVySWQsXG4gICAgc2VtZXN0ZXJSZXZpc2lvbjogbC5zZW1lc3RlclJldmlzaW9uLFxuICAgIHRpdGxlOiBsLnRpdGxlLFxuICAgIHRvcGljczogbC50b3BpY3MsXG4gICAgcmVzb3VyY2VJZHM6IGwucmVzb3VyY2VJZHMsXG4gICAgc3RhcnRzQXQ6IGwuc3RhcnRzQXQsXG4gICAgZW5kc0F0OiBsLmVuZHNBdCxcbiAgICBhaUVuYWJsZWQ6IGwuYWlFbmFibGVkLFxuICAgIGF0dGVuZGVkOiBsLmF0dGVuZGVkLFxuICAgIHByb2dyZXNzOiBsLnByb2dyZXNzLFxuICAgIHN0YXRlOiBsLnN0YXRlLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTY29yaW5nUG9pbnQocmF3OiB1bmtub3duKTogU2NvcmluZ1BvaW50IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCQzRcdTUyMDZcdTcwQjlcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbXCJpZFwiLCBcImRlc2NyaXB0aW9uXCIsIFwicG9pbnRzXCJdLCBcIlx1OEJDNFx1NTIwNlx1NzBCOVwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdThCQzRcdTUyMDZcdTcwQjlcIiwgYXNTdHIpLFxuICAgIGRlc2NyaXB0aW9uOiByZXF1aXJlZEZpZWxkKHJhdywgXCJkZXNjcmlwdGlvblwiLCBcIlx1OEJDNFx1NTIwNlx1NzBCOVwiLCBhc1N0ciksXG4gICAgcG9pbnRzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwb2ludHNcIiwgXCJcdThCQzRcdTUyMDZcdTcwQjlcIiwgYXNJbnQpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU2NvcmluZ1BvaW50KFxuICBwOiBTY29yaW5nUG9pbnQsXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IGlkOiBwLmlkLCBkZXNjcmlwdGlvbjogcC5kZXNjcmlwdGlvbiwgcG9pbnRzOiBwLnBvaW50cyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VRdWVzdGlvbihyYXc6IHVua25vd24pOiBRdWVzdGlvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5ODk4XHU3NkVFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcInByb21wdFwiLFxuICAgICAgXCJ0b3BpY3NcIixcbiAgICAgIFwic291cmNlSWRzXCIsXG4gICAgICBcImV4dGVuc2lvblwiLFxuICAgICAgXCJlc3RpbWF0ZWRNaW51dGVzXCIsXG4gICAgICBcImFuc3dlclwiLFxuICAgICAgXCJhY2NlcHRhYmxlQWx0ZXJuYXRpdmVzXCIsXG4gICAgICBcInNjb3JpbmdcIixcbiAgICBdLFxuICAgIFwiXHU5ODk4XHU3NkVFXCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU5ODk4XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBwcm9tcHQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb21wdFwiLCBcIlx1OTg5OFx1NzZFRVwiLCBhc1N0ciksXG4gICAgdG9waWNzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwidG9waWNzXCIsXG4gICAgICBcIlx1OTg5OFx1NzZFRVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0b3BpY3NcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NzdFNVx1OEJDNlx1NzBCOVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHNvdXJjZUlkczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInNvdXJjZUlkc1wiLFxuICAgICAgXCJcdTk4OThcdTc2RUVcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwic291cmNlSWRzXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdTY3NjVcdTZFOTAgSURcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBleHRlbnNpb246IHJlcXVpcmVkRmllbGQocmF3LCBcImV4dGVuc2lvblwiLCBcIlx1OTg5OFx1NzZFRVwiLCBhc0Jvb2wpLFxuICAgIGVzdGltYXRlZE1pbnV0ZXM6IHJlcXVpcmVkRmllbGQocmF3LCBcImVzdGltYXRlZE1pbnV0ZXNcIiwgXCJcdTk4OThcdTc2RUVcIiwgYXNJbnQpLFxuICAgIGFuc3dlcjogcmVxdWlyZWRGaWVsZChyYXcsIFwiYW5zd2VyXCIsIFwiXHU5ODk4XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBhY2NlcHRhYmxlQWx0ZXJuYXRpdmVzOiByZXF1aXJlZEZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJhY2NlcHRhYmxlQWx0ZXJuYXRpdmVzXCIsXG4gICAgICBcIlx1OTg5OFx1NzZFRVwiLFxuICAgICAgYXNTdHIsXG4gICAgKSxcbiAgICBzY29yaW5nOiByZXF1aXJlZEZpZWxkKHJhdywgXCJzY29yaW5nXCIsIFwiXHU5ODk4XHU3NkVFXCIsICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcInNjb3JpbmdcIikubWFwKHBhcnNlU2NvcmluZ1BvaW50KSxcbiAgICApLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUXVlc3Rpb24ocTogUXVlc3Rpb24pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHEuaWQsXG4gICAgcHJvbXB0OiBxLnByb21wdCxcbiAgICB0b3BpY3M6IHEudG9waWNzLFxuICAgIHNvdXJjZUlkczogcS5zb3VyY2VJZHMsXG4gICAgZXh0ZW5zaW9uOiBxLmV4dGVuc2lvbixcbiAgICBlc3RpbWF0ZWRNaW51dGVzOiBxLmVzdGltYXRlZE1pbnV0ZXMsXG4gICAgYW5zd2VyOiBxLmFuc3dlcixcbiAgICBhY2NlcHRhYmxlQWx0ZXJuYXRpdmVzOiBxLmFjY2VwdGFibGVBbHRlcm5hdGl2ZXMsXG4gICAgc2NvcmluZzogcS5zY29yaW5nLm1hcChzZXJpYWxpemVTY29yaW5nUG9pbnQpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VBc3Nlc3NtZW50KHJhdzogdW5rbm93bik6IEFzc2Vzc21lbnQge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJENVx1OTg5OFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1xuICAgICAgXCJpZFwiLFxuICAgICAgXCJwcm9qZWN0SWRcIixcbiAgICAgIFwic2VtZXN0ZXJJZFwiLFxuICAgICAgXCJzZW1lc3RlclJldmlzaW9uXCIsXG4gICAgICBcImxlc3NvbklkXCIsXG4gICAgICBcInRhc2tJZFwiLFxuICAgICAgXCJyZXRlc3RPZkdyYWRlSWRcIixcbiAgICAgIFwidGl0bGVcIixcbiAgICAgIFwia2luZFwiLFxuICAgICAgXCJyZXZpc2lvblwiLFxuICAgICAgXCJzdGFydHNBdFwiLFxuICAgICAgXCJlbmRzQXRcIixcbiAgICAgIFwiaW5zdHJ1Y3Rpb25zXCIsXG4gICAgICBcInJldmlld0V2aWRlbmNlXCIsXG4gICAgICBcInF1ZXN0aW9uc1wiLFxuICAgICAgXCJwdWJsaXNoZWRBdFwiLFxuICAgICAgXCJwcmludGVkQXRcIixcbiAgICAgIFwic3RhcnRlZEF0XCIsXG4gICAgICBcInN0b3BwZWRBdFwiLFxuICAgIF0sXG4gICAgXCJcdThCRDVcdTk4OThcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHJvamVjdElkXCIsIFwiXHU4QkQ1XHU5ODk4XCIsIGFzU3RyKSxcbiAgICBzZW1lc3RlcklkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJzZW1lc3RlcklkXCIsIFwiXHU4QkQ1XHU5ODk4XCIsIGFzU3RyKSxcbiAgICBzZW1lc3RlclJldmlzaW9uOiBmaWVsZChyYXcsIFwic2VtZXN0ZXJSZXZpc2lvblwiLCBcIlx1OEJENVx1OTg5OFwiLCBhc0ludCwgMSksXG4gICAgbGVzc29uSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJsZXNzb25JZFwiLFxuICAgICAgXCJcdThCRDVcdTk4OThcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImxlc3NvbklkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHRhc2tJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInRhc2tJZFwiLFxuICAgICAgXCJcdThCRDVcdTk4OThcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInRhc2tJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICByZXRlc3RPZkdyYWRlSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZXRlc3RPZkdyYWRlSWRcIixcbiAgICAgIFwiXHU4QkQ1XHU5ODk4XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJyZXRlc3RPZkdyYWRlSWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgdGl0bGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpdGxlXCIsIFwiXHU4QkQ1XHU5ODk4XCIsIGFzU3RyKSxcbiAgICBraW5kOiBvbmVPZihcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImtpbmRcIiwgXCJcdThCRDVcdTk4OThcIiwgKHYpID0+IHYpLFxuICAgICAgXCJcdThCRDVcdTk4OTgga2luZFwiLFxuICAgICAgW1wiaG9tZXdvcmtcIiwgXCJ3ZWVrbHlFeGFtXCIsIFwibW9ja0V4YW1cIiwgXCJyZXRlc3RcIl0sXG4gICAgKSBhcyBBc3Nlc3NtZW50S2luZCxcbiAgICByZXZpc2lvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwicmV2aXNpb25cIiwgXCJcdThCRDVcdTk4OThcIiwgYXNJbnQpLFxuICAgIHN0YXJ0c0F0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdGFydHNBdFwiLCBcIlx1OEJENVx1OTg5OFwiLCBhc0ludCksXG4gICAgZW5kc0F0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJlbmRzQXRcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNJbnQpLFxuICAgIGluc3RydWN0aW9uczogcmVxdWlyZWRGaWVsZChyYXcsIFwiaW5zdHJ1Y3Rpb25zXCIsIFwiXHU4QkQ1XHU5ODk4XCIsIGFzU3RyKSxcbiAgICByZXZpZXdFdmlkZW5jZTogcmVxdWlyZWRGaWVsZChyYXcsIFwicmV2aWV3RXZpZGVuY2VcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNTdHIpLFxuICAgIHF1ZXN0aW9uczogcmVxdWlyZWRGaWVsZChyYXcsIFwicXVlc3Rpb25zXCIsIFwiXHU4QkQ1XHU5ODk4XCIsICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcInF1ZXN0aW9uc1wiKS5tYXAocGFyc2VRdWVzdGlvbiksXG4gICAgKSxcbiAgICBwdWJsaXNoZWRBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwicHVibGlzaGVkQXRcIiwgXCJcdThCRDVcdTk4OThcIiwgYXNJbnQpLFxuICAgIHByaW50ZWRBdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInByaW50ZWRBdFwiLFxuICAgICAgXCJcdThCRDVcdTk4OThcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInByaW50ZWRBdFwiLCBhc0ludCksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBzdGFydGVkQXQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzdGFydGVkQXRcIixcbiAgICAgIFwiXHU4QkQ1XHU5ODk4XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJzdGFydGVkQXRcIiwgYXNJbnQpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIG51bWJlciB8IG51bGwsXG4gICAgc3RvcHBlZEF0OiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwic3RvcHBlZEF0XCIsXG4gICAgICBcIlx1OEJENVx1OTg5OFwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwic3RvcHBlZEF0XCIsIGFzSW50KSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQXNzZXNzbWVudChhOiBBc3Nlc3NtZW50KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiBhLmlkLFxuICAgIHByb2plY3RJZDogYS5wcm9qZWN0SWQsXG4gICAgc2VtZXN0ZXJJZDogYS5zZW1lc3RlcklkLFxuICAgIHNlbWVzdGVyUmV2aXNpb246IGEuc2VtZXN0ZXJSZXZpc2lvbixcbiAgICBsZXNzb25JZDogYS5sZXNzb25JZCxcbiAgICB0YXNrSWQ6IGEudGFza0lkLFxuICAgIHJldGVzdE9mR3JhZGVJZDogYS5yZXRlc3RPZkdyYWRlSWQsXG4gICAgdGl0bGU6IGEudGl0bGUsXG4gICAga2luZDogYS5raW5kLFxuICAgIHJldmlzaW9uOiBhLnJldmlzaW9uLFxuICAgIHN0YXJ0c0F0OiBhLnN0YXJ0c0F0LFxuICAgIGVuZHNBdDogYS5lbmRzQXQsXG4gICAgaW5zdHJ1Y3Rpb25zOiBhLmluc3RydWN0aW9ucyxcbiAgICByZXZpZXdFdmlkZW5jZTogYS5yZXZpZXdFdmlkZW5jZSxcbiAgICBxdWVzdGlvbnM6IGEucXVlc3Rpb25zLm1hcChzZXJpYWxpemVRdWVzdGlvbiksXG4gICAgcHVibGlzaGVkQXQ6IGEucHVibGlzaGVkQXQsXG4gICAgcHJpbnRlZEF0OiBhLnByaW50ZWRBdCxcbiAgICBzdGFydGVkQXQ6IGEuc3RhcnRlZEF0LFxuICAgIHN0b3BwZWRBdDogYS5zdG9wcGVkQXQsXG4gIH07XG59XG5cbi8qKiBcdThCQTFcdTUyMTJcdTUzM0FcdTk1RjRcdTRGOUJcdTY1RjZcdTk1N0ZcdUZGMUJcdTVCOUVcdTk2NDVcdTVGMDBcdTgwMDNcdThENzdcdThCQTFcdTY1RjZcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBleGFtRGVhZGxpbmUoYTogQXNzZXNzbWVudCk6IG51bWJlciB7XG4gIHJldHVybiBhLnN0YXJ0ZWRBdCA9PT0gbnVsbFxuICAgID8gYS5lbmRzQXRcbiAgICA6IGEuc3RhcnRlZEF0ICsgKGEuZW5kc0F0IC0gYS5zdGFydHNBdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVN1Ym1pc3Npb24ocmF3OiB1bmtub3duKTogU3VibWlzc2lvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2M0QwXHU0RUE0XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcImFzc2Vzc21lbnRJZFwiLFxuICAgICAgXCJzdWJtaXR0ZWRBdFwiLFxuICAgICAgXCJyZXNvdXJjZUlkc1wiLFxuICAgICAgXCJhbnN3ZXJzXCIsXG4gICAgICBcInVuZmluaXNoZWRcIixcbiAgICAgIFwicXVlc3Rpb25UaW1lc1wiLFxuICAgIF0sXG4gICAgXCJcdTYzRDBcdTRFQTRcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTYzRDBcdTRFQTRcIiwgYXNTdHIpLFxuICAgIGFzc2Vzc21lbnRJZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiYXNzZXNzbWVudElkXCIsIFwiXHU2M0QwXHU0RUE0XCIsIGFzU3RyKSxcbiAgICBzdWJtaXR0ZWRBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwic3VibWl0dGVkQXRcIiwgXCJcdTYzRDBcdTRFQTRcIiwgYXNJbnQpLFxuICAgIHJlc291cmNlSWRzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicmVzb3VyY2VJZHNcIixcbiAgICAgIFwiXHU2M0QwXHU0RUE0XCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInJlc291cmNlSWRzXCIpLm1hcCgoeCkgPT4gYXNTdHIoeCwgXCJcdTk2NDRcdTRFRjYgSURcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBhbnN3ZXJzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhbnN3ZXJzXCIsIFwiXHU2M0QwXHU0RUE0XCIsIGFzU3RyKSxcbiAgICB1bmZpbmlzaGVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ1bmZpbmlzaGVkXCIsIFwiXHU2M0QwXHU0RUE0XCIsIGFzQm9vbCksXG4gICAgcXVlc3Rpb25UaW1lczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInF1ZXN0aW9uVGltZXNcIixcbiAgICAgIFwiXHU2M0QwXHU0RUE0XCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInF1ZXN0aW9uVGltZXNcIikubWFwKHBhcnNlUXVlc3Rpb25UaW1lKSxcbiAgICAgIFtdLFxuICAgICksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVTdWJtaXNzaW9uKHM6IFN1Ym1pc3Npb24pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHMuaWQsXG4gICAgYXNzZXNzbWVudElkOiBzLmFzc2Vzc21lbnRJZCxcbiAgICBzdWJtaXR0ZWRBdDogcy5zdWJtaXR0ZWRBdCxcbiAgICByZXNvdXJjZUlkczogcy5yZXNvdXJjZUlkcyxcbiAgICBhbnN3ZXJzOiBzLmFuc3dlcnMsXG4gICAgdW5maW5pc2hlZDogcy51bmZpbmlzaGVkLFxuICAgIHF1ZXN0aW9uVGltZXM6IHMucXVlc3Rpb25UaW1lcy5tYXAoc2VyaWFsaXplUXVlc3Rpb25UaW1lKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUXVlc3Rpb25UaW1lKHJhdzogdW5rbm93bik6IFF1ZXN0aW9uVGltZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QjhDXHU2MjEwXHU2NUY2XHU1MjNCXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgW1wicXVlc3Rpb25JZFwiLCBcImxvY2FsVGltZVwiXSwgXCJcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcIik7XG4gIHJldHVybiB7XG4gICAgcXVlc3Rpb25JZDogcmVxdWlyZWRGaWVsZChyYXcsIFwicXVlc3Rpb25JZFwiLCBcIlx1NUI4Q1x1NjIxMFx1NjVGNlx1NTIzQlwiLCBhc1N0ciksXG4gICAgbG9jYWxUaW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJsb2NhbFRpbWVcIiwgXCJcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUXVlc3Rpb25UaW1lKFxuICB0OiBRdWVzdGlvblRpbWUsXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IHF1ZXN0aW9uSWQ6IHQucXVlc3Rpb25JZCwgbG9jYWxUaW1lOiB0LmxvY2FsVGltZSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQb2ludEF3YXJkKHJhdzogdW5rbm93bik6IFBvaW50QXdhcmQge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJDNFx1NTIwNlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFtcInF1ZXN0aW9uSWRcIiwgXCJwb2ludElkXCIsIFwiYXdhcmRlZFwiLCBcImV2aWRlbmNlXCJdLCBcIlx1OEJDNFx1NTIwNlwiKTtcbiAgcmV0dXJuIHtcbiAgICBxdWVzdGlvbklkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJxdWVzdGlvbklkXCIsIFwiXHU4QkM0XHU1MjA2XCIsIGFzU3RyKSxcbiAgICBwb2ludElkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwb2ludElkXCIsIFwiXHU4QkM0XHU1MjA2XCIsIGFzU3RyKSxcbiAgICBhd2FyZGVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhd2FyZGVkXCIsIFwiXHU4QkM0XHU1MjA2XCIsIGFzSW50KSxcbiAgICBldmlkZW5jZTogcmVxdWlyZWRGaWVsZChyYXcsIFwiZXZpZGVuY2VcIiwgXCJcdThCQzRcdTUyMDZcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUG9pbnRBd2FyZChwOiBQb2ludEF3YXJkKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIHF1ZXN0aW9uSWQ6IHAucXVlc3Rpb25JZCxcbiAgICBwb2ludElkOiBwLnBvaW50SWQsXG4gICAgYXdhcmRlZDogcC5hd2FyZGVkLFxuICAgIGV2aWRlbmNlOiBwLmV2aWRlbmNlLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VFcnJvckFuYWx5c2lzKHJhdzogdW5rbm93bik6IEVycm9yQW5hbHlzaXMge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTUxOVx1NTZFMFx1NTIwNlx1Njc5MFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1xuICAgICAgXCJxdWVzdGlvbklkXCIsXG4gICAgICBcImNhdXNlXCIsXG4gICAgICBcImV2aWRlbmNlXCIsXG4gICAgICBcImNvcnJlY3Rpb25cIixcbiAgICAgIFwibmV4dENoZWNrXCIsXG4gICAgICBcInJldGVzdERhdGVcIixcbiAgICAgIFwiY29uZmlybWVkXCIsXG4gICAgXSxcbiAgICBcIlx1OTUxOVx1NTZFMFx1NTIwNlx1Njc5MFwiLFxuICApO1xuICByZXR1cm4ge1xuICAgIHF1ZXN0aW9uSWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInF1ZXN0aW9uSWRcIiwgXCJcdTk1MTlcdTU2RTBcdTUyMDZcdTY3OTBcIiwgYXNTdHIpLFxuICAgIGNhdXNlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjYXVzZVwiLCBcIlx1OTUxOVx1NTZFMFx1NTIwNlx1Njc5MFwiLCBhc1N0ciksXG4gICAgZXZpZGVuY2U6IHJlcXVpcmVkRmllbGQocmF3LCBcImV2aWRlbmNlXCIsIFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXCIsIGFzU3RyKSxcbiAgICBjb3JyZWN0aW9uOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb3JyZWN0aW9uXCIsIFwiXHU5NTE5XHU1NkUwXHU1MjA2XHU2NzkwXCIsIGFzU3RyKSxcbiAgICBuZXh0Q2hlY2s6IHJlcXVpcmVkRmllbGQocmF3LCBcIm5leHRDaGVja1wiLCBcIlx1OTUxOVx1NTZFMFx1NTIwNlx1Njc5MFwiLCBhc1N0ciksXG4gICAgcmV0ZXN0RGF0ZTogcmVxdWlyZWRGaWVsZChyYXcsIFwicmV0ZXN0RGF0ZVwiLCBcIlx1OTUxOVx1NTZFMFx1NTIwNlx1Njc5MFwiLCBhc1N0ciksXG4gICAgY29uZmlybWVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb25maXJtZWRcIiwgXCJcdTk1MTlcdTU2RTBcdTUyMDZcdTY3OTBcIiwgYXNCb29sKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUVycm9yQW5hbHlzaXMoXG4gIGU6IEVycm9yQW5hbHlzaXMsXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgcXVlc3Rpb25JZDogZS5xdWVzdGlvbklkLFxuICAgIGNhdXNlOiBlLmNhdXNlLFxuICAgIGV2aWRlbmNlOiBlLmV2aWRlbmNlLFxuICAgIGNvcnJlY3Rpb246IGUuY29ycmVjdGlvbixcbiAgICBuZXh0Q2hlY2s6IGUubmV4dENoZWNrLFxuICAgIHJldGVzdERhdGU6IGUucmV0ZXN0RGF0ZSxcbiAgICBjb25maXJtZWQ6IGUuY29uZmlybWVkLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VHcmFkZShyYXc6IHVua25vd24pOiBHcmFkZSB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2Mjc5XHU2NTM5XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImlkXCIsXG4gICAgICBcInN1Ym1pc3Npb25JZFwiLFxuICAgICAgXCJhc3Nlc3NtZW50UmV2aXNpb25cIixcbiAgICAgIFwiZ3JhZGVkQXRcIixcbiAgICAgIFwiYXdhcmRzXCIsXG4gICAgICBcImVycm9yc1wiLFxuICAgICAgXCJuZWVkc1Jldmlld1wiLFxuICAgICAgXCJmZWVkYmFja1wiLFxuICAgIF0sXG4gICAgXCJcdTYyNzlcdTY1MzlcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTYyNzlcdTY1MzlcIiwgYXNTdHIpLFxuICAgIHN1Ym1pc3Npb25JZDogcmVxdWlyZWRGaWVsZChyYXcsIFwic3VibWlzc2lvbklkXCIsIFwiXHU2Mjc5XHU2NTM5XCIsIGFzU3RyKSxcbiAgICBhc3Nlc3NtZW50UmV2aXNpb246IHJlcXVpcmVkRmllbGQocmF3LCBcImFzc2Vzc21lbnRSZXZpc2lvblwiLCBcIlx1NjI3OVx1NjUzOVwiLCBhc0ludCksXG4gICAgZ3JhZGVkQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImdyYWRlZEF0XCIsIFwiXHU2Mjc5XHU2NTM5XCIsIGFzSW50KSxcbiAgICBhd2FyZHM6IHJlcXVpcmVkRmllbGQocmF3LCBcImF3YXJkc1wiLCBcIlx1NjI3OVx1NjUzOVwiLCAodikgPT5cbiAgICAgIGFzQXJyYXkodiwgXCJhd2FyZHNcIikubWFwKHBhcnNlUG9pbnRBd2FyZCksXG4gICAgKSxcbiAgICBlcnJvcnM6IHJlcXVpcmVkRmllbGQocmF3LCBcImVycm9yc1wiLCBcIlx1NjI3OVx1NjUzOVwiLCAodikgPT5cbiAgICAgIGFzQXJyYXkodiwgXCJlcnJvcnNcIikubWFwKHBhcnNlRXJyb3JBbmFseXNpcyksXG4gICAgKSxcbiAgICBuZWVkc1JldmlldzogcmVxdWlyZWRGaWVsZChyYXcsIFwibmVlZHNSZXZpZXdcIiwgXCJcdTYyNzlcdTY1MzlcIiwgYXNCb29sKSxcbiAgICBmZWVkYmFjazogcmVxdWlyZWRGaWVsZChyYXcsIFwiZmVlZGJhY2tcIiwgXCJcdTYyNzlcdTY1MzlcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplR3JhZGUoZzogR3JhZGUpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGcuaWQsXG4gICAgc3VibWlzc2lvbklkOiBnLnN1Ym1pc3Npb25JZCxcbiAgICBhc3Nlc3NtZW50UmV2aXNpb246IGcuYXNzZXNzbWVudFJldmlzaW9uLFxuICAgIGdyYWRlZEF0OiBnLmdyYWRlZEF0LFxuICAgIGF3YXJkczogZy5hd2FyZHMubWFwKHNlcmlhbGl6ZVBvaW50QXdhcmQpLFxuICAgIGVycm9yczogZy5lcnJvcnMubWFwKHNlcmlhbGl6ZUVycm9yQW5hbHlzaXMpLFxuICAgIG5lZWRzUmV2aWV3OiBnLm5lZWRzUmV2aWV3LFxuICAgIGZlZWRiYWNrOiBnLmZlZWRiYWNrLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VSZXZpZXcocmF3OiB1bmtub3duKTogUmV2aWV3IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTU5MERcdTc2RDhcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24oXG4gICAgcmF3LFxuICAgIFtcImlkXCIsIFwiZGF0ZVwiLCBcInByb2plY3RJZFwiLCBcImdyYWRlSWRzXCIsIFwiZmluZGluZ3NcIiwgXCJhY3Rpb25zXCJdLFxuICAgIFwiXHU1OTBEXHU3NkQ4XCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU1OTBEXHU3NkQ4XCIsIGFzU3RyKSxcbiAgICBkYXRlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJkYXRlXCIsIFwiXHU1OTBEXHU3NkQ4XCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb2plY3RJZFwiLCBcIlx1NTkwRFx1NzZEOFwiLCBhc1N0ciksXG4gICAgZ3JhZGVJZHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJncmFkZUlkc1wiLFxuICAgICAgXCJcdTU5MERcdTc2RDhcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwiZ3JhZGVJZHNcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1NjI3OVx1NjUzOSBJRFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIGZpbmRpbmdzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJmaW5kaW5nc1wiLCBcIlx1NTkwRFx1NzZEOFwiLCBhc1N0ciksXG4gICAgYWN0aW9uczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImFjdGlvbnNcIixcbiAgICAgIFwiXHU1OTBEXHU3NkQ4XCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcImFjdGlvbnNcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1ODg0Q1x1NTJBOFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUmV2aWV3KHI6IFJldmlldyk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogci5pZCxcbiAgICBkYXRlOiByLmRhdGUsXG4gICAgcHJvamVjdElkOiByLnByb2plY3RJZCxcbiAgICBncmFkZUlkczogci5ncmFkZUlkcyxcbiAgICBmaW5kaW5nczogci5maW5kaW5ncyxcbiAgICBhY3Rpb25zOiByLmFjdGlvbnMsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRlYWNoaW5nRXZlbnQocmF3OiB1bmtub3duKTogVGVhY2hpbmdFdmVudCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXCJpZFwiLCBcInByb2plY3RJZFwiLCBcImtpbmRcIiwgXCJzb3VyY2VJZFwiLCBcInN0YXRlXCIsIFwiY3JlYXRlZEF0XCJdLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb2plY3RJZFwiLCBcIlx1NjU1OVx1NUI2Nlx1NEU4Qlx1NEVGNlwiLCBhc1N0ciksXG4gICAga2luZDogcmVxdWlyZWRGaWVsZChyYXcsIFwia2luZFwiLCBcIlx1NjU1OVx1NUI2Nlx1NEU4Qlx1NEVGNlwiLCBhc1N0ciksXG4gICAgc291cmNlSWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInNvdXJjZUlkXCIsIFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XCIsIGFzU3RyKSxcbiAgICBzdGF0ZTogcmVxdWlyZWRGaWVsZChyYXcsIFwic3RhdGVcIiwgXCJcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcIiwgYXNTdHIpLFxuICAgIGNyZWF0ZWRBdDogcmVxdWlyZWRGaWVsZChyYXcsIFwiY3JlYXRlZEF0XCIsIFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XCIsIGFzSW50KSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVRlYWNoaW5nRXZlbnQoXG4gIGU6IFRlYWNoaW5nRXZlbnQsXG4pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgaWQ6IGUuaWQsXG4gICAgcHJvamVjdElkOiBlLnByb2plY3RJZCxcbiAgICBraW5kOiBlLmtpbmQsXG4gICAgc291cmNlSWQ6IGUuc291cmNlSWQsXG4gICAgc3RhdGU6IGUuc3RhdGUsXG4gICAgY3JlYXRlZEF0OiBlLmNyZWF0ZWRBdCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJvZ3Jlc3NSZWNvcmQocmF3OiB1bmtub3duKTogUHJvZ3Jlc3NSZWNvcmQge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1xuICAgICAgXCJpZFwiLFxuICAgICAgXCJwcm9qZWN0SWRcIixcbiAgICAgIFwidG9waWNcIixcbiAgICAgIFwicG9zaXRpb25cIixcbiAgICAgIFwic3RhdGVcIixcbiAgICAgIFwiZXZpZGVuY2VcIixcbiAgICAgIFwibmV4dEFjdGlvblwiLFxuICAgICAgXCJzb3VyY2VcIixcbiAgICAgIFwiY29uZmlybWVkXCIsXG4gICAgICBcInJlY29yZGVkQXRcIixcbiAgICBdLFxuICAgIFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XCIsXG4gICk7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XCIsIGFzU3RyKSxcbiAgICBwcm9qZWN0SWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInByb2plY3RJZFwiLCBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgdG9waWM6IHJlcXVpcmVkRmllbGQocmF3LCBcInRvcGljXCIsIFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XCIsIGFzU3RyKSxcbiAgICBwb3NpdGlvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwicG9zaXRpb25cIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgYXNTdHIpLFxuICAgIHN0YXRlOiBvbmVPZihcbiAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInN0YXRlXCIsIFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XCIsICh2KSA9PiB2KSxcbiAgICAgIFwiXHU4RkRCXHU1RUE2IHN0YXRlXCIsXG4gICAgICBbXCJzdHVkaWVkXCIsIFwicHJhY3RpY2luZ1wiLCBcIm5lZWRzUmV2aWV3XCJdLFxuICAgICkgYXMgUHJvZ3Jlc3NSZWNvcmRbXCJzdGF0ZVwiXSxcbiAgICBldmlkZW5jZTogcmVxdWlyZWRGaWVsZChyYXcsIFwiZXZpZGVuY2VcIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgYXNTdHIpLFxuICAgIG5leHRBY3Rpb246IHJlcXVpcmVkRmllbGQocmF3LCBcIm5leHRBY3Rpb25cIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgYXNTdHIpLFxuICAgIHNvdXJjZTogb25lT2YoXG4gICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJzb3VyY2VcIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgKHYpID0+IHYpLFxuICAgICAgXCJcdThGREJcdTVFQTYgc291cmNlXCIsXG4gICAgICBbXCJ1c2VyXCIsIFwiYXNzaXN0YW50XCJdLFxuICAgICkgYXMgUHJvZ3Jlc3NTb3VyY2UsXG4gICAgY29uZmlybWVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb25maXJtZWRcIiwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcIiwgYXNCb29sKSxcbiAgICByZWNvcmRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJyZWNvcmRlZEF0XCIsIFwiXHU4RkRCXHU1RUE2XHU4QkIwXHU1RjU1XCIsIGFzSW50KSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVByb2dyZXNzUmVjb3JkKFxuICByOiBQcm9ncmVzc1JlY29yZCxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBpZDogci5pZCxcbiAgICBwcm9qZWN0SWQ6IHIucHJvamVjdElkLFxuICAgIHRvcGljOiByLnRvcGljLFxuICAgIHBvc2l0aW9uOiByLnBvc2l0aW9uLFxuICAgIHN0YXRlOiByLnN0YXRlLFxuICAgIGV2aWRlbmNlOiByLmV2aWRlbmNlLFxuICAgIG5leHRBY3Rpb246IHIubmV4dEFjdGlvbixcbiAgICBzb3VyY2U6IHIuc291cmNlLFxuICAgIGNvbmZpcm1lZDogci5jb25maXJtZWQsXG4gICAgcmVjb3JkZWRBdDogci5yZWNvcmRlZEF0LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb3JyZWN0aW9uKHJhdzogdW5rbm93bik6IENvcnJlY3Rpb24ge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJBMlx1NkI2M1x1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihcbiAgICByYXcsXG4gICAgW1xuICAgICAgXCJpZFwiLFxuICAgICAgXCJncmFkZUlkXCIsXG4gICAgICBcInF1ZXN0aW9uSWRcIixcbiAgICAgIFwiZXhwbGFuYXRpb25cIixcbiAgICAgIFwicmVzb3VyY2VJZHNcIixcbiAgICAgIFwic3VibWl0dGVkQXRcIixcbiAgICAgIFwiYWNjZXB0ZWRcIixcbiAgICAgIFwiZmVlZGJhY2tcIixcbiAgICAgIFwicmV2aWV3ZWRBdFwiLFxuICAgIF0sXG4gICAgXCJcdThCQTJcdTZCNjNcIixcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdThCQTJcdTZCNjNcIiwgYXNTdHIpLFxuICAgIGdyYWRlSWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImdyYWRlSWRcIiwgXCJcdThCQTJcdTZCNjNcIiwgYXNTdHIpLFxuICAgIHF1ZXN0aW9uSWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcInF1ZXN0aW9uSWRcIiwgXCJcdThCQTJcdTZCNjNcIiwgYXNTdHIpLFxuICAgIGV4cGxhbmF0aW9uOiByZXF1aXJlZEZpZWxkKHJhdywgXCJleHBsYW5hdGlvblwiLCBcIlx1OEJBMlx1NkI2M1wiLCBhc1N0ciksXG4gICAgcmVzb3VyY2VJZHM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZXNvdXJjZUlkc1wiLFxuICAgICAgXCJcdThCQTJcdTZCNjNcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwicmVzb3VyY2VJZHNcIikubWFwKCh4KSA9PiBhc1N0cih4LCBcIlx1OTY0NFx1NEVGNiBJRFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHN1Ym1pdHRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdWJtaXR0ZWRBdFwiLCBcIlx1OEJBMlx1NkI2M1wiLCBhc0ludCksXG4gICAgYWNjZXB0ZWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJhY2NlcHRlZFwiLFxuICAgICAgXCJcdThCQTJcdTZCNjNcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImFjY2VwdGVkXCIsIGFzQm9vbCksXG4gICAgICBudWxsLFxuICAgICkgYXMgYm9vbGVhbiB8IG51bGwsXG4gICAgZmVlZGJhY2s6IGZpZWxkKHJhdywgXCJmZWVkYmFja1wiLCBcIlx1OEJBMlx1NkI2M1wiLCBhc1N0ciwgXCJcIiksXG4gICAgcmV2aWV3ZWRBdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJldmlld2VkQXRcIixcbiAgICAgIFwiXHU4QkEyXHU2QjYzXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJyZXZpZXdlZEF0XCIsIGFzSW50KSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQ29ycmVjdGlvbihjOiBDb3JyZWN0aW9uKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiBjLmlkLFxuICAgIGdyYWRlSWQ6IGMuZ3JhZGVJZCxcbiAgICBxdWVzdGlvbklkOiBjLnF1ZXN0aW9uSWQsXG4gICAgZXhwbGFuYXRpb246IGMuZXhwbGFuYXRpb24sXG4gICAgcmVzb3VyY2VJZHM6IGMucmVzb3VyY2VJZHMsXG4gICAgc3VibWl0dGVkQXQ6IGMuc3VibWl0dGVkQXQsXG4gICAgYWNjZXB0ZWQ6IGMuYWNjZXB0ZWQsXG4gICAgZmVlZGJhY2s6IGMuZmVlZGJhY2ssXG4gICAgcmV2aWV3ZWRBdDogYy5yZXZpZXdlZEF0LFxuICB9O1xufVxuXG4vLyAtLS0tLS0tLS0tIFx1NjgyMVx1OUE4Q1x1OEY4NVx1NTJBOSAtLS0tLS0tLS0tXG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja1RleHQoczogc3RyaW5nLCBtYXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gcy50cmltKCkubGVuZ3RoID4gMCAmJiBBcnJheS5mcm9tKHMpLmxlbmd0aCA8PSBtYXg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZEVkdWNhdGlvbkRhdGUoczogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBzLmxlbmd0aCA9PT0gMTAgJiYgdmFsaWREYXRlKHMpO1xufVxuXG4vKiogXHU1Qjg5XHU1MTY4XHU3Njg0XHU5ODc5XHU3NkVFXHU1MTg1XHU3NkY4XHU1QkY5XHU4REVGXHU1Rjg0XHVGRjFBXHU5NzVFXHU3QTdBXHUzMDAxXHU2NUUwXHU1M0NEXHU2NTlDXHU2NzYwXHUzMDAxXHU5NzVFXHU3RUREXHU1QkY5XHUzMDAxXHU2NUUwIGAuLmAvYC5gIFx1NkJCNVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUmVsYXRpdmVQYXRoKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAocGF0aC5sZW5ndGggPT09IDAgfHwgcGF0aC5pbmNsdWRlcyhcIlxcXFxcIikgfHwgaXNBYnNvbHV0ZVBhdGgocGF0aCkpXG4gICAgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBzdHJpcHBlZCA9IHBhdGgucmVwbGFjZSgvXFwvKyQvLCBcIlwiKTtcbiAgaWYgKHN0cmlwcGVkLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHBhdGgubGVuZ3RoID4gMCAmJiBmYWxzZTtcbiAgcmV0dXJuIHN0cmlwcGVkXG4gICAgLnNwbGl0KFwiL1wiKVxuICAgIC5ldmVyeSgoc2VnKSA9PiBzZWcgIT09IFwiLlwiICYmIHNlZyAhPT0gXCIuLlwiICYmIHNlZyAhPT0gXCJcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0Fic29sdXRlUGF0aChwYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9eKFxcL3xbQS1aYS16XTpbXFxcXC9dfFxcXFxcXFxcKS8udGVzdChwYXRoKTtcbn1cblxuLy8gLS0tLS0tLS0tLSBFZHVjYXRpb24gXHU2NTcwXHU2MzZFXHU3QzdCIC0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBFZHVjYXRpb25EYXRhIHtcbiAgZm9jdXNUYXNrczogaW1wb3J0KFwiLi9tb2RlbFwiKS5UZWFjaGluZ1Rhc2tbXTtcbiAgcHJvamVjdHM6IFByb2plY3RTdHVkeVtdO1xuICByZXNvdXJjZXM6IFJlc291cmNlW107XG4gIHNlbWVzdGVyczogU2VtZXN0ZXJbXTtcbiAgc2VtZXN0ZXJIaXN0b3J5OiBTZW1lc3RlcltdO1xuICBsZXNzb25zOiBMZXNzb25bXTtcbiAgYXNzZXNzbWVudHM6IEFzc2Vzc21lbnRbXTtcbiAgc3VibWlzc2lvbnM6IFN1Ym1pc3Npb25bXTtcbiAgZ3JhZGVzOiBHcmFkZVtdO1xuICByZXZpZXdzOiBSZXZpZXdbXTtcbiAgZXZlbnRzOiBUZWFjaGluZ0V2ZW50W107XG4gIGNvbXBsZXRlZFRhc2tzOiBDb21wbGV0ZWRTdHVkeVRhc2tbXTtcbiAgcHJvZ3Jlc3M6IFByb2dyZXNzUmVjb3JkW107XG4gIGNvcnJlY3Rpb25zOiBDb3JyZWN0aW9uW107XG59XG5cbmV4cG9ydCBjbGFzcyBFZHVjYXRpb24gaW1wbGVtZW50cyBFZHVjYXRpb25EYXRhIHtcbiAgZm9jdXNUYXNrczogaW1wb3J0KFwiLi9tb2RlbFwiKS5UZWFjaGluZ1Rhc2tbXSA9IFtdO1xuICBwcm9qZWN0czogUHJvamVjdFN0dWR5W10gPSBbXTtcbiAgcmVzb3VyY2VzOiBSZXNvdXJjZVtdID0gW107XG4gIHNlbWVzdGVyczogU2VtZXN0ZXJbXSA9IFtdO1xuICBzZW1lc3Rlckhpc3Rvcnk6IFNlbWVzdGVyW10gPSBbXTtcbiAgbGVzc29uczogTGVzc29uW10gPSBbXTtcbiAgYXNzZXNzbWVudHM6IEFzc2Vzc21lbnRbXSA9IFtdO1xuICBzdWJtaXNzaW9uczogU3VibWlzc2lvbltdID0gW107XG4gIGdyYWRlczogR3JhZGVbXSA9IFtdO1xuICByZXZpZXdzOiBSZXZpZXdbXSA9IFtdO1xuICBldmVudHM6IFRlYWNoaW5nRXZlbnRbXSA9IFtdO1xuICBjb21wbGV0ZWRUYXNrczogQ29tcGxldGVkU3R1ZHlUYXNrW10gPSBbXTtcbiAgcHJvZ3Jlc3M6IFByb2dyZXNzUmVjb3JkW10gPSBbXTtcbiAgY29ycmVjdGlvbnM6IENvcnJlY3Rpb25bXSA9IFtdO1xuXG4gIC8qKiBcdTZCQ0ZcdTZCMjFcdTYyNkJcdTYzQ0ZcdTYyMTZcdTUzRDhcdTY2RjRcdTY1RjZcdTkxQ0RcdTVFRkFcdUZGMUFcdTU0MkJcdTUwNUNcdTc1MjhcdTkxNERcdTdGNkVcdTRFMEVcdTVGNTJcdTY4NjNcdThCQTFcdTUyMTJcdTMwMDIgKi9cbiAgcmVzb3VyY2VSZWZlcmVuY2VJbmRleCgpOiBNYXA8c3RyaW5nLCBzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHJlZnMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nW10+KCk7XG4gICAgY29uc3QgYWRkID0gKGlkczogc3RyaW5nW10sIGxhYmVsOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIGZvciAoY29uc3QgaWQgb2YgbmV3IFNldChpZHMpKSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSByZWZzLmdldChpZCkgPz8gW107XG4gICAgICAgIGxpc3QucHVzaChsYWJlbCk7XG4gICAgICAgIHJlZnMuc2V0KGlkLCBsaXN0KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZvciAoY29uc3QgcCBvZiB0aGlzLnByb2plY3RzKSB7XG4gICAgICBhZGQoXG4gICAgICAgIFtwLnN5bGxhYnVzSWQsIC4uLnAucGFzdFBhcGVySWRzLCAuLi5wLm1vY2tQYXBlcklkc10uZmlsdGVyKFxuICAgICAgICAgICh4KTogeCBpcyBzdHJpbmcgPT4geCAhPT0gbnVsbCxcbiAgICAgICAgKSxcbiAgICAgICAgXCJcdTk4NzlcdTc2RUVcdTY1NTlcdTVCNjZcdTkxNERcdTdGNkVcIixcbiAgICAgICk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcyBvZiBbLi4udGhpcy5zZW1lc3RlcnMsIC4uLnRoaXMuc2VtZXN0ZXJIaXN0b3J5XSkge1xuICAgICAgZm9yIChjb25zdCBtIG9mIHMubWlsZXN0b25lcykge1xuICAgICAgICBhZGQobS5yZXNvdXJjZUlkcywgYCR7cy50aXRsZX0gdiR7cy5yZXZpc2lvbn0gXHU3QjJDJHttLndlZWt9XHU1NDY4YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgbCBvZiB0aGlzLmxlc3NvbnMpIHtcbiAgICAgIGFkZChsLnJlc291cmNlSWRzLCBgXHU4QkZFXHU3QTBCXHVGRjFBJHtsLnRpdGxlfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGEgb2YgdGhpcy5hc3Nlc3NtZW50cykge1xuICAgICAgZm9yIChjb25zdCBxIG9mIGEucXVlc3Rpb25zKSB7XG4gICAgICAgIGFkZChxLnNvdXJjZUlkcywgYCR7YS50aXRsZX0gLyAke3EuaWR9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgcyBvZiB0aGlzLnN1Ym1pc3Npb25zKSB7XG4gICAgICBhZGQocy5yZXNvdXJjZUlkcywgYFx1N0I1NFx1NTM3N1x1RkYxQSR7cy5pZH1gKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBjIG9mIHRoaXMuY29ycmVjdGlvbnMpIHtcbiAgICAgIGFkZChjLnJlc291cmNlSWRzLCBgXHU4QkEyXHU2QjYzXHVGRjFBJHtjLmlkfWApO1xuICAgIH1cbiAgICByZXR1cm4gcmVmcztcbiAgfVxuXG4gIHJlc291cmNlUmVmZXJlbmNlcyhpZDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLnJlc291cmNlUmVmZXJlbmNlSW5kZXgoKS5nZXQoaWQpID8/IFtdO1xuICB9XG5cbiAgZXZlbnQocHJvamVjdDogc3RyaW5nLCBraW5kOiBzdHJpbmcsIHNvdXJjZTogc3RyaW5nLCBhdDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgZXZlbnRJZCA9IGAke2tpbmR9OiR7c291cmNlfWA7XG4gICAgaWYgKCF0aGlzLmV2ZW50cy5zb21lKChlKSA9PiBlLmlkID09PSBldmVudElkKSkge1xuICAgICAgdGhpcy5ldmVudHMucHVzaCh7XG4gICAgICAgIGlkOiBldmVudElkLFxuICAgICAgICBwcm9qZWN0SWQ6IHByb2plY3QsXG4gICAgICAgIGtpbmQsXG4gICAgICAgIHNvdXJjZUlkOiBzb3VyY2UsXG4gICAgICAgIHN0YXRlOiBcInBlbmRpbmdcIixcbiAgICAgICAgY3JlYXRlZEF0OiBhdCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHRhc2tDb21wbGV0ZWQodGFzazogVGFzaywgYXQ6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHJlY29yZCA9IGNvbXBsZXRlZFN0dWR5VGFza0Zyb21UYXNrKHRhc2ssIGF0KTtcbiAgICBpZiAocmVjb3JkID09PSBudWxsKSByZXR1cm47XG4gICAgaWYgKFxuICAgICAgdGhpcy5wcm9qZWN0cy5zb21lKFxuICAgICAgICAocCkgPT4gcC5wcm9qZWN0SWQgPT09IHJlY29yZC5wcm9qZWN0SWQgJiYgcC5leGFtTW9kZSxcbiAgICAgICkgJiZcbiAgICAgICF0aGlzLmNvbXBsZXRlZFRhc2tzLnNvbWUoKHQpID0+IHQuaWQgPT09IHJlY29yZC5pZClcbiAgICApIHtcbiAgICAgIGNvbnN0IGxpbmsgPSB0aGlzLmZvY3VzVGFza3MuZmluZCgobCkgPT4gbC50YXNrSWQgPT09IHJlY29yZC5pZCk7XG4gICAgICBpZiAobGluayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IGxlc3NvbiA9IHRoaXMubGVzc29ucy5maW5kKChsKSA9PiBsLmlkID09PSBsaW5rLnNvdXJjZUlkKTtcbiAgICAgICAgaWYgKGxlc3NvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmVjb3JkLnRvcGljcyA9IFsuLi5sZXNzb24udG9waWNzXTtcbiAgICAgICAgICByZWNvcmQubm90ZXMgPSBsZXNzb24ucHJvZ3Jlc3M7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZXZlbnQocmVjb3JkLnByb2plY3RJZCwgXCJ0YXNrSG9tZXdvcmtcIiwgcmVjb3JkLmlkLCBhdCk7XG4gICAgICB9XG4gICAgICB0aGlzLmNvbXBsZXRlZFRhc2tzLnB1c2gocmVjb3JkKTtcbiAgICB9XG4gIH1cblxuICAvKiogXHU4QkZFXHU3QTBCL1x1ODAwM1x1OEJENVx1NTIzMFx1NzBCOVx1NjNBOFx1OEZEQlx1MzAwMVx1NjMwMVx1NEU0NVx1NTMxNlx1NjU1OVx1NUI2Nlx1NEU4Qlx1NEVGNlx1MzAwMiAqL1xuICB0aWNrKGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgIGNvbnN0IGV2ZW50czogeyBwcm9qZWN0OiBzdHJpbmc7IGtpbmQ6IHN0cmluZzsgc291cmNlOiBzdHJpbmcgfVtdID0gW107XG4gICAgZm9yIChjb25zdCBsZXNzb24gb2YgdGhpcy5sZXNzb25zKSB7XG4gICAgICBpZiAoXG4gICAgICAgIChsZXNzb24uc3RhdGUgPT09IFwicGxhbm5lZFwiIHx8IGxlc3Nvbi5zdGF0ZSA9PT0gXCJhY3RpdmVcIikgJiZcbiAgICAgICAgYXQgPj0gbGVzc29uLmVuZHNBdFxuICAgICAgKSB7XG4gICAgICAgIGxlc3Nvbi5zdGF0ZSA9IGxlc3Nvbi5hdHRlbmRlZCA/IFwiZW5kZWRcIiA6IFwibWlzc2VkXCI7XG4gICAgICAgIGlmIChsZXNzb24uYWlFbmFibGVkICYmIGxlc3Nvbi5hdHRlbmRlZCkge1xuICAgICAgICAgIGV2ZW50cy5wdXNoKHtcbiAgICAgICAgICAgIHByb2plY3Q6IGxlc3Nvbi5wcm9qZWN0SWQsXG4gICAgICAgICAgICBraW5kOiBcImhvbWV3b3JrXCIsXG4gICAgICAgICAgICBzb3VyY2U6IGxlc3Nvbi5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAobGVzc29uLnN0YXRlID09PSBcInBsYW5uZWRcIiAmJiBhdCA+PSBsZXNzb24uc3RhcnRzQXQpIHtcbiAgICAgICAgbGVzc29uLnN0YXRlID0gXCJhY3RpdmVcIjtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYSBvZiB0aGlzLmFzc2Vzc21lbnRzKSB7XG4gICAgICBpZiAoXG4gICAgICAgIChhLmtpbmQgPT09IFwiaG9tZXdvcmtcIiB8fCBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCkgJiZcbiAgICAgICAgYS5zdG9wcGVkQXQgPT09IG51bGwgJiZcbiAgICAgICAgYXQgPj0gZXhhbURlYWRsaW5lKGEpXG4gICAgICApIHtcbiAgICAgICAgYS5zdG9wcGVkQXQgPSBleGFtRGVhZGxpbmUoYSk7XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHsgcHJvamVjdCwga2luZCwgc291cmNlIH0gb2YgZXZlbnRzKSB7XG4gICAgICB0aGlzLmV2ZW50KHByb2plY3QsIGtpbmQsIHNvdXJjZSwgYXQpO1xuICAgIH1cbiAgICAvLyBcdTZCQ0ZcdTY1RTVcdTU5MERcdTc2RDhcdTYzMDFcdTRFNDVcdUZGMUFcdTUzMDVcdTYyRUMgMDg6MzAgXHU1RTk0XHU3NTI4XHU2NzJBXHU1RjAwXHU3Njg0XHU2NUU1XHU2NzFGXHUzMDAyXG4gICAgY29uc3QgZ3JhZGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBnIG9mIHRoaXMuZ3JhZGVzKSB7XG4gICAgICBjb25zdCBub3dNaW51dGVzID0gbWludXRlc09mKGhvdXJNaW51dGVOb3coYXQpKSA/PyAtMTtcbiAgICAgIGlmIChkYXRlQXQoZy5ncmFkZWRBdCkgPCBkYXRlQXQoYXQpICYmIG5vd01pbnV0ZXMgPj0gNTEwKSB7XG4gICAgICAgIGNvbnN0IHN1YiA9IHRoaXMuc3VibWlzc2lvbnMuZmluZCgocykgPT4gcy5pZCA9PT0gZy5zdWJtaXNzaW9uSWQpO1xuICAgICAgICBpZiAoc3ViID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBhID0gdGhpcy5hc3Nlc3NtZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBzdWIuYXNzZXNzbWVudElkKTtcbiAgICAgICAgaWYgKGEgPT09IHVuZGVmaW5lZCkgY29udGludWU7XG4gICAgICAgIGdyYWRlcy5hZGQoYCR7YS5wcm9qZWN0SWR9fCR7ZGF0ZUF0KGcuZ3JhZGVkQXQpfWApO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhaXIgb2YgZ3JhZGVzKSB7XG4gICAgICBjb25zdCBbcCwgZF0gPSBwYWlyLnNwbGl0KFwifFwiKTtcbiAgICAgIGNvbnN0IG4gPSB0aGlzLmV2ZW50cy5sZW5ndGg7XG4gICAgICB0aGlzLmV2ZW50KHAhLCBcInJldmlld1wiLCBgJHtwfToke2R9YCwgYXQpO1xuICAgICAgaWYgKHRoaXMuZXZlbnRzLmxlbmd0aCAhPT0gbikgY2hhbmdlZCA9IHRydWU7XG4gICAgfVxuICAgIC8vIFx1NTQ2OFx1NEU5NFx1OEQ3N1x1RkYwOFx1NTQyQlx1NTQ2OFx1NjcyQlx1RkYwOVx1NEUzQVx1NEVDRFx1NTcyOFx1OEZEQlx1ODg0Q1x1NEUyRFx1NzY4NFx1NUU5NFx1OEJENVx1NUI2Nlx1NjcxRlx1NzY3Qlx1OEJCMFx1NTQ2OFx1ODAwM1x1NEU4Qlx1NEVGNlx1MzAwMlxuICAgIGNvbnN0IHRvZGF5ID0gbG9jYWxEYXRlT2YoYXQpO1xuICAgIGlmICh3ZWVrZGF5TW9uZGF5KHRvZGF5KSA+PSA1KSB7XG4gICAgICBjb25zdCB0ZXJtczogeyBwcm9qZWN0OiBzdHJpbmc7IHNvdXJjZTogc3RyaW5nIH1bXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBzIG9mIHRoaXMuc2VtZXN0ZXJzKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBzLnN0YXJ0RGF0ZSA8PSBkYXRlQXQoYXQpICYmXG4gICAgICAgICAgcy5lbmREYXRlID49IGRhdGVBdChhdCkgJiZcbiAgICAgICAgICB0aGlzLnByb2plY3RzLnNvbWUoKHApID0+IHAucHJvamVjdElkID09PSBzLnByb2plY3RJZCAmJiBwLmV4YW1Nb2RlKVxuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCBzdGFydCA9IHBhcnNlRGF0ZShzLnN0YXJ0RGF0ZSkhO1xuICAgICAgICAgIGNvbnN0IHdlZWsgPSBNYXRoLmZsb29yKGRheXNCZXR3ZWVuKHN0YXJ0LCB0b2RheSkgLyA3KSArIDE7XG4gICAgICAgICAgdGVybXMucHVzaCh7IHByb2plY3Q6IHMucHJvamVjdElkLCBzb3VyY2U6IGAke3MuaWR9OndlZWske3dlZWt9YCB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChjb25zdCB7IHByb2plY3QsIHNvdXJjZSB9IG9mIHRlcm1zKSB7XG4gICAgICAgIGNvbnN0IG4gPSB0aGlzLmV2ZW50cy5sZW5ndGg7XG4gICAgICAgIHRoaXMuZXZlbnQocHJvamVjdCwgXCJ3ZWVrbHlFeGFtXCIsIHNvdXJjZSwgYXQpO1xuICAgICAgICBpZiAodGhpcy5ldmVudHMubGVuZ3RoICE9PSBuKSBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNoYW5nZWQ7XG4gIH1cblxuICAvKiogXHU2NTU5XHU1QjY2XHU1NDdEXHU0RUU0XHU2MjY3XHU4ODRDXHVGRjFBXHU2ODIxXHU5QThDIFx1MjE5MiBcdTUzRDhcdTY2RjRcdUZGMENcdTUxNjhcdTkwRThcdTYyMTBcdTUyOUZcdTU0MEVcdTc1MzFcdTRFMEFcdTVDNDJcdTdFREZcdTRFMDAgdmFsaWRhdGVcdTMwMDIgKi9cbiAgYXBwbHkoY29tbWFuZDogQ29tbWFuZCwgYXQ6IG51bWJlcik6IHZvaWQge1xuICAgIHN3aXRjaCAoY29tbWFuZC5vcCkge1xuICAgICAgY2FzZSBcInJlY29yZFByb2dyZXNzXCI6IHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICF0aGlzLnByb2dyZXNzLnNvbWUoKHIpID0+IHIuaWQgPT09IGNvbW1hbmQucmVjb3JkLmlkKSxcbiAgICAgICAgICBcIlx1OEZEQlx1NUVBNlx1OEJCMFx1NUY1NVx1NEUwRFx1NTNFRlx1ODk4Nlx1NzZENlx1RkYwQ1x1OEJGN1x1NjVCMFx1NTg5RVx1NEUwMFx1Njc2MVx1NjZGNFx1NkI2M1x1OEJCMFx1NUY1NVwiLFxuICAgICAgICApO1xuICAgICAgICBjb21tYW5kLnJlY29yZC5yZWNvcmRlZEF0ID0gYXQ7XG4gICAgICAgIGNvbW1hbmQucmVjb3JkLmNvbmZpcm1lZCA9IGNvbW1hbmQucmVjb3JkLnNvdXJjZSA9PT0gXCJ1c2VyXCI7XG4gICAgICAgIHRoaXMucHJvZ3Jlc3MucHVzaChjb21tYW5kLnJlY29yZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImNvbmZpcm1Qcm9ncmVzc1wiOiB7XG4gICAgICAgIGNvbnN0IHJlY29yZCA9IHRoaXMucHJvZ3Jlc3MuZmluZCgocikgPT4gci5pZCA9PT0gY29tbWFuZC5pZCk7XG4gICAgICAgIGVuc3VyZShyZWNvcmQgIT09IHVuZGVmaW5lZCwgXCJcdThGREJcdTVFQTZcdThCQjBcdTVGNTVcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIHJlY29yZC5jb25maXJtZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzdWJtaXRDb3JyZWN0aW9uXCI6IHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICF0aGlzLmNvcnJlY3Rpb25zLnNvbWUoKGMpID0+IGMuaWQgPT09IGNvbW1hbmQuY29ycmVjdGlvbi5pZCksXG4gICAgICAgICAgXCJcdThCQTJcdTZCNjNcdTcyNDhcdTY3MkNcdTRFMERcdTUzRUZcdTg5ODZcdTc2RDZcIixcbiAgICAgICAgKTtcbiAgICAgICAgY29tbWFuZC5jb3JyZWN0aW9uLnN1Ym1pdHRlZEF0ID0gYXQ7XG4gICAgICAgIGNvbW1hbmQuY29ycmVjdGlvbi5hY2NlcHRlZCA9IG51bGw7XG4gICAgICAgIGNvbW1hbmQuY29ycmVjdGlvbi5mZWVkYmFjayA9IFwiXCI7XG4gICAgICAgIGNvbW1hbmQuY29ycmVjdGlvbi5yZXZpZXdlZEF0ID0gbnVsbDtcbiAgICAgICAgY29uc3QgcHJvamVjdCA9ICgoKSA9PiB7XG4gICAgICAgICAgY29uc3QgZ3JhZGUgPSB0aGlzLmdyYWRlcy5maW5kKFxuICAgICAgICAgICAgKGcpID0+IGcuaWQgPT09IGNvbW1hbmQuY29ycmVjdGlvbi5ncmFkZUlkLFxuICAgICAgICAgICk7XG4gICAgICAgICAgaWYgKGdyYWRlID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgICAgICAgIGNvbnN0IHN1YiA9IHRoaXMuc3VibWlzc2lvbnMuZmluZCgocykgPT4gcy5pZCA9PT0gZ3JhZGUuc3VibWlzc2lvbklkKTtcbiAgICAgICAgICBpZiAoc3ViID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgICAgICAgIGNvbnN0IGEgPSB0aGlzLmFzc2Vzc21lbnRzLmZpbmQoKHgpID0+IHguaWQgPT09IHN1Yi5hc3Nlc3NtZW50SWQpO1xuICAgICAgICAgIHJldHVybiBhPy5wcm9qZWN0SWQgPz8gbnVsbDtcbiAgICAgICAgfSkoKTtcbiAgICAgICAgZW5zdXJlKHByb2plY3QgIT09IG51bGwsIFwiXHU4QkEyXHU2QjYzXHU3RjNBXHU1QzExXHU1MzlGXHU1OUNCXHU2Mjc5XHU2NTM5XCIpO1xuICAgICAgICB0aGlzLmV2ZW50KHByb2plY3QsIFwiY29ycmVjdGlvblwiLCBjb21tYW5kLmNvcnJlY3Rpb24uaWQsIGF0KTtcbiAgICAgICAgdGhpcy5jb3JyZWN0aW9ucy5wdXNoKGNvbW1hbmQuY29ycmVjdGlvbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInJldmlld0NvcnJlY3Rpb25cIjoge1xuICAgICAgICBjb25zdCBjb3JyZWN0aW9uID0gdGhpcy5jb3JyZWN0aW9ucy5maW5kKFxuICAgICAgICAgIChjKSA9PiBjLmlkID09PSBjb21tYW5kLmlkICYmIGMucmV2aWV3ZWRBdCA9PT0gbnVsbCxcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKGNvcnJlY3Rpb24gIT09IHVuZGVmaW5lZCwgXCJcdThCQTJcdTZCNjNcdTVERjJcdTY4QzBcdTY3RTVcdTYyMTZcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGVuc3VyZShjaGVja1RleHQoY29tbWFuZC5mZWVkYmFjaywgNTAwMDApLCBcIlx1OEJBMlx1NkI2M1x1NjhDMFx1NjdFNVx1OTcwMFx1ODk4MVx1NTNDRFx1OTk4OFwiKTtcbiAgICAgICAgY29ycmVjdGlvbi5hY2NlcHRlZCA9IGNvbW1hbmQuYWNjZXB0ZWQ7XG4gICAgICAgIGNvcnJlY3Rpb24uZmVlZGJhY2sgPSBjb21tYW5kLmZlZWRiYWNrO1xuICAgICAgICBjb3JyZWN0aW9uLnJldmlld2VkQXQgPSBhdDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVByb2plY3RcIjoge1xuICAgICAgICB1cHNlcnRCeSh0aGlzLnByb2plY3RzLCBjb21tYW5kLnByb2plY3QsICh4KSA9PiB4LnByb2plY3RJZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNhdmVSZXNvdXJjZVwiOiB7XG4gICAgICAgIHVwc2VydEJ5KHRoaXMucmVzb3VyY2VzLCBjb21tYW5kLnJlc291cmNlLCAoeCkgPT4geC5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInJlbW92ZVJlc291cmNlc1wiOiB7XG4gICAgICAgIGVuc3VyZShjb21tYW5kLmlkcy5sZW5ndGggPiAwLCBcIlx1OEJGN1x1OTAwOVx1NjJFOVx1ODk4MVx1NkUwNVx1NzQwNlx1NzY4NFx1OEQ0NFx1NkU5MFx1NzY3Qlx1OEJCMFwiKTtcbiAgICAgICAgY29uc3QgcmVmZXJlbmNlZCA9IHRoaXMucmVzb3VyY2VSZWZlcmVuY2VJbmRleCgpO1xuICAgICAgICBjb25zdCBrbm93biA9IG5ldyBTZXQodGhpcy5yZXNvdXJjZXMubWFwKChyKSA9PiByLmlkKSk7XG4gICAgICAgIGZvciAoY29uc3QgaWQgb2YgY29tbWFuZC5pZHMpIHtcbiAgICAgICAgICBlbnN1cmUoa25vd24uaGFzKGlkKSwgXCJcdThENDRcdTZFOTBcdTc2N0JcdThCQjBcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICAgIXJlZmVyZW5jZWQuaGFzKGlkKSxcbiAgICAgICAgICAgIFwiXHU4RDQ0XHU2RTkwXHU0RUNEXHU4OEFCXHU2NTU5XHU1QjY2XHU5MTREXHU3RjZFXHU2MjE2XHU1Mzg2XHU1M0YyXHU4QkIwXHU1RjU1XHU1RjE1XHU3NTI4XHVGRjBDXHU4QkY3XHU0RkVFXHU1OTBEXHU4REVGXHU1Rjg0XHU1RTc2XHU0RkREXHU3NTU5XHU3NjdCXHU4QkIwXCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpZHMgPSBuZXcgU2V0KGNvbW1hbmQuaWRzKTtcbiAgICAgICAgdGhpcy5yZXNvdXJjZXMgPSB0aGlzLnJlc291cmNlcy5maWx0ZXIoKHIpID0+ICFpZHMuaGFzKHIuaWQpKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVNlbWVzdGVyXCI6IHtcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5zZW1lc3RlcnMuZmluZCgocykgPT4gcy5pZCA9PT0gY29tbWFuZC5zZW1lc3Rlci5pZCk7XG4gICAgICAgIGlmIChvbGQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVuc3VyZShcbiAgICAgICAgICAgIGNvbW1hbmQuc2VtZXN0ZXIucmV2aXNpb24gPT09IG9sZC5yZXZpc2lvbiArIDEsXG4gICAgICAgICAgICBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlx1NjZGNFx1NjVCMFx1NUZDNVx1OTg3Qlx1OTAxMlx1NTg5RVx1NzI0OFx1NjcyQ1wiLFxuICAgICAgICAgICk7XG4gICAgICAgICAgdGhpcy5zZW1lc3Rlckhpc3RvcnkucHVzaCh7XG4gICAgICAgICAgICAuLi5vbGQsXG4gICAgICAgICAgICBtaWxlc3RvbmVzOiBvbGQubWlsZXN0b25lcy5tYXAoKG0pID0+ICh7XG4gICAgICAgICAgICAgIC4uLm0sXG4gICAgICAgICAgICAgIHRvcGljczogWy4uLm0udG9waWNzXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VJZHM6IFsuLi5tLnJlc291cmNlSWRzXSxcbiAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB1cHNlcnRCeSh0aGlzLnNlbWVzdGVycywgY29tbWFuZC5zZW1lc3RlciwgKHgpID0+IHguaWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlTGVzc29uXCI6IHtcbiAgICAgICAgY29uc3Qgc2VtZXN0ZXIgPSB0aGlzLnNlbWVzdGVycy5maW5kKFxuICAgICAgICAgIChzKSA9PiBzLmlkID09PSBjb21tYW5kLmxlc3Nvbi5zZW1lc3RlcklkLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoc2VtZXN0ZXIgIT09IHVuZGVmaW5lZCwgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGNvbW1hbmQubGVzc29uLnNlbWVzdGVyUmV2aXNpb24gPSBzZW1lc3Rlci5yZXZpc2lvbjtcbiAgICAgICAgZW5zdXJlKGNvbW1hbmQubGVzc29uLnN0YXJ0c0F0ID4gYXQsIFwiXHU4QkZFXHU3QTBCXHU1RkM1XHU5ODdCXHU1Qjg5XHU2MzkyXHU1NzI4XHU2NzJBXHU2NzY1XCIpO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgIXRoaXMubGVzc29ucy5zb21lKFxuICAgICAgICAgICAgKGwpID0+XG4gICAgICAgICAgICAgIGwuaWQgPT09IGNvbW1hbmQubGVzc29uLmlkICYmXG4gICAgICAgICAgICAgIChsLnN0YXRlICE9PSBcInBsYW5uZWRcIiB8fCBsLmF0dGVuZGVkKSxcbiAgICAgICAgICApLFxuICAgICAgICAgIFwiXHU1REYyXHU1RjAwXHU1OUNCXHU4QkZFXHU3QTBCXHU0RkREXHU3NTU5XHU1Mzg2XHU1M0YyXHVGRjBDXHU0RTBEXHU4MEZEXHU2NTM5XHU1MTk5XCIsXG4gICAgICAgICk7XG4gICAgICAgIGNvbW1hbmQubGVzc29uLnN0YXRlID0gXCJwbGFubmVkXCI7XG4gICAgICAgIGNvbW1hbmQubGVzc29uLmF0dGVuZGVkID0gZmFsc2U7XG4gICAgICAgIHVwc2VydEJ5KHRoaXMubGVzc29ucywgY29tbWFuZC5sZXNzb24sICh4KSA9PiB4LmlkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2V0TGVzc29uUmVzb3VyY2VzXCI6IHtcbiAgICAgICAgY29uc3QgbGVzc29uID0gdGhpcy5sZXNzb25zLmZpbmQoKGwpID0+IGwuaWQgPT09IGNvbW1hbmQuaWQpO1xuICAgICAgICBlbnN1cmUobGVzc29uICE9PSB1bmRlZmluZWQsIFwiXHU4QkZFXHU3QTBCXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgbGVzc29uLnN0YXRlID09PSBcInBsYW5uZWRcIiAmJlxuICAgICAgICAgICAgIWxlc3Nvbi5hdHRlbmRlZCAmJlxuICAgICAgICAgICAgbGVzc29uLnN0YXJ0c0F0ID4gYXQsXG4gICAgICAgICAgXCJcdThCRkVcdTdBMEJcdTVERjJcdTVGMDBcdTU5Q0JcdUZGMENcdTRFMERcdTgwRkRcdTRGRUVcdTY1MzlcdTYzMDdcdTVCOUFcdThENDRcdTY1OTlcIixcbiAgICAgICAgKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIGNvbW1hbmQucmVzb3VyY2VJZHMuZXZlcnkoKGlkKSA9PlxuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXMuc29tZShcbiAgICAgICAgICAgICAgKHIpID0+IHIuaWQgPT09IGlkICYmIHIucHJvamVjdElkID09PSBsZXNzb24ucHJvamVjdElkLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApLFxuICAgICAgICAgIFwiXHU1M0VBXHU4MEZEXHU2MzA3XHU1QjlBXHU2NzJDXHU5ODc5XHU3NkVFXHU3NjdCXHU4QkIwXHU3Njg0XHU4RDQ0XHU2NTk5XCIsXG4gICAgICAgICk7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICBuZXcgU2V0KGNvbW1hbmQucmVzb3VyY2VJZHMpLnNpemUgPT09IGNvbW1hbmQucmVzb3VyY2VJZHMubGVuZ3RoLFxuICAgICAgICAgIFwiXHU4QkZFXHU3QTBCXHU4RDQ0XHU2NTk5XHU0RTBEXHU4MEZEXHU5MUNEXHU1OTBEXHU2MzA3XHU1QjlBXCIsXG4gICAgICAgICk7XG4gICAgICAgIGxlc3Nvbi5yZXNvdXJjZUlkcyA9IFsuLi5jb21tYW5kLnJlc291cmNlSWRzXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiYXR0ZW5kTGVzc29uXCI6IHtcbiAgICAgICAgY29uc3QgbGVzc29uID0gdGhpcy5sZXNzb25zLmZpbmQoKGwpID0+IGwuaWQgPT09IGNvbW1hbmQuaWQpO1xuICAgICAgICBlbnN1cmUobGVzc29uICE9PSB1bmRlZmluZWQsIFwiXHU4QkZFXHU3QTBCXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgYXQgPj0gbGVzc29uLnN0YXJ0c0F0ICYmIGF0IDwgbGVzc29uLmVuZHNBdCxcbiAgICAgICAgICBcIlx1NTNFQVx1ODBGRFx1NTcyOFx1NEUwQVx1OEJGRVx1NjVGNlx1Nzg2RVx1OEJBNFx1NTNDMlx1NEUwRVwiLFxuICAgICAgICApO1xuICAgICAgICBsZXNzb24uYXR0ZW5kZWQgPSB0cnVlO1xuICAgICAgICBsZXNzb24ucHJvZ3Jlc3MgPSBjb21tYW5kLnByb2dyZXNzO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJwdWJsaXNoQXNzZXNzbWVudFwiOiB7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICB0aGlzLnByb2plY3RzLnNvbWUoXG4gICAgICAgICAgICAocCkgPT4gcC5wcm9qZWN0SWQgPT09IGNvbW1hbmQuYXNzZXNzbWVudC5wcm9qZWN0SWQgJiYgcC5leGFtTW9kZSxcbiAgICAgICAgICApLFxuICAgICAgICAgIFwiXHU1M0QxXHU1RTAzXHU0RjVDXHU0RTFBXHU1NDhDXHU4QkQ1XHU1Mzc3XHU1MjREXHU4QkY3XHU1NDJGXHU3NTI4XHU1RTk0XHU4QkQ1XHU2QTIxXHU1RjBGXCIsXG4gICAgICAgICk7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICAhdGhpcy5hc3Nlc3NtZW50cy5zb21lKChhKSA9PiBhLmlkID09PSBjb21tYW5kLmFzc2Vzc21lbnQuaWQpLFxuICAgICAgICAgIFwiXHU1REYyXHU1M0QxXHU1RTAzXHU5ODk4XHU3NkVFXHU1NDhDXHU4QkM0XHU1MjA2XHU2ODA3XHU1MUM2XHU0RTBEXHU1M0VGXHU0RkVFXHU2NTM5XHVGRjFCXHU4QkY3XHU1M0QxXHU1RTAzXHU2NUIwIElEIFx1NzY4NFx1NEZFRVx1OEJBMlx1NzI0OFwiLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgY29tbWFuZC5hc3Nlc3NtZW50LmtpbmQgPT09IFwiaG9tZXdvcmtcIlxuICAgICAgICAgICAgPyBjb21tYW5kLmFzc2Vzc21lbnQuZW5kc0F0ID4gYXRcbiAgICAgICAgICAgIDogZGF0ZUF0KGNvbW1hbmQuYXNzZXNzbWVudC5zdGFydHNBdCkgPj0gZGF0ZUF0KGF0KSxcbiAgICAgICAgICBcIlx1NEUwRFx1ODBGRFx1NTNEMVx1NUUwM1x1NURGMlx1NjIyQVx1NkI2Mlx1NzY4NFx1NEY1Q1x1NEUxQVx1NjIxNlx1NURGMlx1OEZDN1x1ODAwM1x1OEJENVx1NjVFNVx1NjcxRlx1NzY4NFx1OEJENVx1NTM3N1wiLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBzZW1lc3RlciA9IHRoaXMuc2VtZXN0ZXJzLmZpbmQoXG4gICAgICAgICAgKHMpID0+IHMuaWQgPT09IGNvbW1hbmQuYXNzZXNzbWVudC5zZW1lc3RlcklkLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoc2VtZXN0ZXIgIT09IHVuZGVmaW5lZCwgXCJcdTVCNjZcdTY3MUZcdThCQTFcdTUyMTJcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGNvbW1hbmQuYXNzZXNzbWVudC5zZW1lc3RlclJldmlzaW9uID0gc2VtZXN0ZXIucmV2aXNpb247XG4gICAgICAgIGNvbW1hbmQuYXNzZXNzbWVudC5wdWJsaXNoZWRBdCA9IGF0O1xuICAgICAgICBjb21tYW5kLmFzc2Vzc21lbnQucHJpbnRlZEF0ID0gbnVsbDtcbiAgICAgICAgY29tbWFuZC5hc3Nlc3NtZW50LnN0YXJ0ZWRBdCA9IG51bGw7XG4gICAgICAgIGNvbW1hbmQuYXNzZXNzbWVudC5zdG9wcGVkQXQgPSBudWxsO1xuICAgICAgICB0aGlzLmFzc2Vzc21lbnRzLnB1c2goY29tbWFuZC5hc3Nlc3NtZW50KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiY29uZmlybVByaW50ZWRcIjoge1xuICAgICAgICBjb25zdCBhID0gdGhpcy5hc3Nlc3NtZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBjb21tYW5kLmlkKTtcbiAgICAgICAgZW5zdXJlKGEgIT09IHVuZGVmaW5lZCwgXCJcdThCRDVcdTUzNzdcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGEucHJpbnRlZEF0ID0gYXQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInN0YXJ0RXhhbVwiOiB7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICAhdGhpcy5hc3Nlc3NtZW50cy5zb21lKFxuICAgICAgICAgICAgKGEpID0+IGEuc3RhcnRlZEF0ICE9PSBudWxsICYmIGEuc3RvcHBlZEF0ID09PSBudWxsLFxuICAgICAgICAgICksXG4gICAgICAgICAgXCJcdThCRjdcdTUxNDhcdTdFRDNcdTY3NUZcdTVGNTNcdTUyNERcdTgwMDNcdThCRDVcIixcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgYSA9IHRoaXMuYXNzZXNzbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gY29tbWFuZC5pZCk7XG4gICAgICAgIGVuc3VyZShhICE9PSB1bmRlZmluZWQsIFwiXHU4QkQ1XHU1Mzc3XHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgYS5raW5kICE9PSBcImhvbWV3b3JrXCIgJiZcbiAgICAgICAgICAgIGEucHJpbnRlZEF0ICE9PSBudWxsICYmXG4gICAgICAgICAgICBhLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgICAgICAgICAgZGF0ZUF0KGF0KSA9PT0gZGF0ZUF0KGEuc3RhcnRzQXQpLFxuICAgICAgICAgIFwiXHU4QkY3XHU1MTQ4XHU2MjUzXHU1MzcwXHU4QkQ1XHU1Mzc3XHU0RTBFXHU3QjU0XHU5ODk4XHU1MzYxXHVGRjBDXHU1RTc2XHU1NzI4XHU4MDAzXHU4QkQ1XHU1Qjg5XHU2MzkyXHU1RjUzXHU1OTI5XHU1RjAwXHU1OUNCXHU4MDAzXHU4QkQ1XCIsXG4gICAgICAgICk7XG4gICAgICAgIGEuc3RhcnRlZEF0ID0gYXQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImVuZEV4YW1cIjoge1xuICAgICAgICBjb25zdCBhID0gdGhpcy5hc3Nlc3NtZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBjb21tYW5kLmlkKTtcbiAgICAgICAgZW5zdXJlKGEgIT09IHVuZGVmaW5lZCwgXCJcdTgwMDNcdThCRDVcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGVuc3VyZShcbiAgICAgICAgICBhLmtpbmQgIT09IFwiaG9tZXdvcmtcIiAmJiBhLnN0YXJ0ZWRBdCAhPT0gbnVsbCAmJiBhLnN0b3BwZWRBdCA9PT0gbnVsbCxcbiAgICAgICAgICBcIlx1ODAwM1x1OEJENVx1NUMxQVx1NjcyQVx1NUYwMFx1NTlDQlx1NjIxNlx1NURGMlx1N0VDRlx1NTA1Q1x1N0IxNFwiLFxuICAgICAgICApO1xuICAgICAgICBhLnN0b3BwZWRBdCA9IGF0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzdWJtaXRcIjoge1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgIXRoaXMuc3VibWlzc2lvbnMuc29tZSgocykgPT4gcy5pZCA9PT0gY29tbWFuZC5zdWJtaXNzaW9uLmlkKSxcbiAgICAgICAgICBcIlx1NjNEMFx1NEVBNFx1NzI0OFx1NjcyQ1x1NEUwRFx1NTNFRlx1ODk4Nlx1NzZENlwiLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBhID0gdGhpcy5hc3Nlc3NtZW50cy5maW5kKFxuICAgICAgICAgICh4KSA9PiB4LmlkID09PSBjb21tYW5kLnN1Ym1pc3Npb24uYXNzZXNzbWVudElkLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoYSAhPT0gdW5kZWZpbmVkLCBcIlx1NEY1Q1x1NEUxQS9cdTgwMDNcdThCRDVcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIGVuc3VyZShhdCA+PSBhLnN0YXJ0c0F0LCBcIlx1NUMxQVx1NjcyQVx1NUYwMFx1NTlDQlx1RkYwQ1x1NEUwRFx1ODBGRFx1NjNEMFx1NEVBNFwiKTtcbiAgICAgICAgaWYgKGEua2luZCAhPT0gXCJob21ld29ya1wiKSB7XG4gICAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICAgYS5zdGFydGVkQXQgIT09IG51bGwgJiYgYS5zdG9wcGVkQXQgIT09IG51bGwsXG4gICAgICAgICAgICBcIlx1ODAwM1x1OEJENVx1N0VEM1x1Njc1Rlx1NTA1Q1x1N0IxNFx1NTQwRVx1NjI0RFx1ODBGRFx1NEUwQVx1NEYyMFx1N0I1NFx1OTg5OFx1NTM2MVwiLFxuICAgICAgICAgICk7XG4gICAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICAgY29tbWFuZC5zdWJtaXNzaW9uLnJlc291cmNlSWRzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICBcIlx1ODAwM1x1OEJENVx1OTcwMFx1ODk4MVx1NEUwQVx1NEYyMFx1N0VCOFx1OEQyOFx1N0I1NFx1OTg5OFx1NTM2MVwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIGNoZWNrVGV4dChjb21tYW5kLnN1Ym1pc3Npb24uYW5zd2VycywgNTAwMDApIHx8XG4gICAgICAgICAgICBjb21tYW5kLnN1Ym1pc3Npb24ucmVzb3VyY2VJZHMubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgY29tbWFuZC5zdWJtaXNzaW9uLnVuZmluaXNoZWQsXG4gICAgICAgICAgXCJcdThCRjdcdTYzRDBcdTRGOUJcdTdCNTRcdTY4NDhcdTMwMDFcdTk2NDRcdTRFRjZcdTYyMTZcdTY4MDdcdThCQjBcdTY3MkFcdTVCOENcdTYyMTBcIixcbiAgICAgICAgKTtcbiAgICAgICAgY29tbWFuZC5zdWJtaXNzaW9uLnN1Ym1pdHRlZEF0ID0gYXQ7XG4gICAgICAgIGNvbnN0IHByb2plY3QgPSBhLnByb2plY3RJZDtcbiAgICAgICAgY29uc3Qgc291cmNlID0gY29tbWFuZC5zdWJtaXNzaW9uLmlkO1xuICAgICAgICB0aGlzLnN1Ym1pc3Npb25zLnB1c2goY29tbWFuZC5zdWJtaXNzaW9uKTtcbiAgICAgICAgdGhpcy5ldmVudChwcm9qZWN0LCBcImdyYWRlXCIsIHNvdXJjZSwgYXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJyZWNvcmRRdWVzdGlvblRpbWVzXCI6IHtcbiAgICAgICAgZW5zdXJlKGNvbW1hbmQucXVlc3Rpb25UaW1lcy5sZW5ndGggPiAwLCBcIlx1NkNBMVx1NjcwOVx1OTcwMFx1ODk4MVx1ODg2NVx1NUY1NVx1NzY4NFx1NUI4Q1x1NjIxMFx1NjVGNlx1NTIzQlwiKTtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICF0aGlzLmdyYWRlcy5zb21lKChnKSA9PiBnLnN1Ym1pc3Npb25JZCA9PT0gY29tbWFuZC5pZCksXG4gICAgICAgICAgXCJcdTVERjJcdTYyNzlcdTY1MzlcdTc2ODRcdTdCNTRcdTUzNzdcdTRFMERcdTgwRkRcdTg4NjVcdTVGNTVcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcIixcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3Qgc3VibWlzc2lvbiA9IHRoaXMuc3VibWlzc2lvbnMuZmluZCgocykgPT4gcy5pZCA9PT0gY29tbWFuZC5pZCk7XG4gICAgICAgIGVuc3VyZShzdWJtaXNzaW9uICE9PSB1bmRlZmluZWQsIFwiXHU2M0QwXHU0RUE0XHU3MjQ4XHU2NzJDXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgY29tbWFuZC5xdWVzdGlvblRpbWVzLmV2ZXJ5KFxuICAgICAgICAgICAgKHQpID0+XG4gICAgICAgICAgICAgICFzdWJtaXNzaW9uLnF1ZXN0aW9uVGltZXMuc29tZShcbiAgICAgICAgICAgICAgICAoZXhpc3RpbmcpID0+IGV4aXN0aW5nLnF1ZXN0aW9uSWQgPT09IHQucXVlc3Rpb25JZCxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICApLFxuICAgICAgICAgIFwiXHU1REYyXHU2NzA5XHU3Njg0XHU1QjhDXHU2MjEwXHU2NUY2XHU1MjNCXHU0RTBEXHU4MEZEXHU4OTg2XHU3NkQ2XCIsXG4gICAgICAgICk7XG4gICAgICAgIHN1Ym1pc3Npb24ucXVlc3Rpb25UaW1lcy5wdXNoKC4uLmNvbW1hbmQucXVlc3Rpb25UaW1lcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImdyYWRlXCI6IHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgICF0aGlzLmdyYWRlcy5zb21lKChnKSA9PiBnLmlkID09PSBjb21tYW5kLmdyYWRlLmlkKSxcbiAgICAgICAgICBcIlx1NjI3OVx1NjUzOVx1NTM4Nlx1NTNGMlx1NEUwRFx1NTNFRlx1ODk4Nlx1NzZENlx1RkYwQ1x1NTkwRFx1NjgzOFx1OEJGN1x1NjVCMFx1NTg5RVx1NjI3OVx1NjUzOVx1OEJCMFx1NUY1NVwiLFxuICAgICAgICApO1xuICAgICAgICBjb21tYW5kLmdyYWRlLmdyYWRlZEF0ID0gYXQ7XG4gICAgICAgIHRoaXMuZ3JhZGVzLnB1c2goY29tbWFuZC5ncmFkZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNhdmVSZXZpZXdcIjoge1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgIXRoaXMucmV2aWV3cy5zb21lKChyKSA9PiByLmlkID09PSBjb21tYW5kLnJldmlldy5pZCksXG4gICAgICAgICAgXCJcdTU5MERcdTc2RDhcdTUzODZcdTUzRjJcdTRFMERcdTUzRUZcdTg5ODZcdTc2RDZcIixcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5yZXZpZXdzLnB1c2goY29tbWFuZC5yZXZpZXcpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJjbGFpbUV2ZW50XCI6IHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSB0aGlzLmV2ZW50cy5maW5kKFxuICAgICAgICAgIChlKSA9PiBlLmlkID09PSBjb21tYW5kLmlkICYmIGUuc3RhdGUgPT09IFwicGVuZGluZ1wiLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoZXZlbnQgIT09IHVuZGVmaW5lZCwgXCJcdTRFOEJcdTRFRjZcdTVERjJcdTU5MDRcdTc0MDZcIik7XG4gICAgICAgIGV2ZW50LnN0YXRlID0gXCJydW5uaW5nXCI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImZpbmlzaEV2ZW50XCI6IHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSB0aGlzLmV2ZW50cy5maW5kKChlKSA9PiBlLmlkID09PSBjb21tYW5kLmlkKTtcbiAgICAgICAgZW5zdXJlKGV2ZW50ICE9PSB1bmRlZmluZWQsIFwiXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBjb25zdCBwcm9kdWNlZCA9ICgoKSA9PiB7XG4gICAgICAgICAgc3dpdGNoIChldmVudC5raW5kKSB7XG4gICAgICAgICAgICBjYXNlIFwiaG9tZXdvcmtcIjpcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXNzZXNzbWVudHMuc29tZShcbiAgICAgICAgICAgICAgICAoYSkgPT5cbiAgICAgICAgICAgICAgICAgIGEucHJvamVjdElkID09PSBldmVudC5wcm9qZWN0SWQgJiZcbiAgICAgICAgICAgICAgICAgIGEua2luZCA9PT0gXCJob21ld29ya1wiICYmXG4gICAgICAgICAgICAgICAgICBhLmxlc3NvbklkID09PSBldmVudC5zb3VyY2VJZCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGNhc2UgXCJ0YXNrSG9tZXdvcmtcIjpcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXNzZXNzbWVudHMuc29tZShcbiAgICAgICAgICAgICAgICAoYSkgPT5cbiAgICAgICAgICAgICAgICAgIGEua2luZCA9PT0gXCJob21ld29ya1wiICYmXG4gICAgICAgICAgICAgICAgICBhLnByb2plY3RJZCA9PT0gZXZlbnQucHJvamVjdElkICYmXG4gICAgICAgICAgICAgICAgICBhLnRhc2tJZCA9PT0gZXZlbnQuc291cmNlSWQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjYXNlIFwiY29ycmVjdGlvblwiOlxuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jb3JyZWN0aW9ucy5zb21lKFxuICAgICAgICAgICAgICAgIChjKSA9PiBjLmlkID09PSBldmVudC5zb3VyY2VJZCAmJiBjLnJldmlld2VkQXQgIT09IG51bGwsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjYXNlIFwid2Vla2x5RXhhbVwiOlxuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hc3Nlc3NtZW50cy5zb21lKFxuICAgICAgICAgICAgICAgIChhKSA9PlxuICAgICAgICAgICAgICAgICAgYS5wcm9qZWN0SWQgPT09IGV2ZW50LnByb2plY3RJZCAmJlxuICAgICAgICAgICAgICAgICAgYS5raW5kID09PSBcIndlZWtseUV4YW1cIiAmJlxuICAgICAgICAgICAgICAgICAgYS5wdWJsaXNoZWRBdCA+PSBldmVudC5jcmVhdGVkQXQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICBjYXNlIFwiZ3JhZGVcIjpcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ3JhZGVzLnNvbWUoKGcpID0+IGcuc3VibWlzc2lvbklkID09PSBldmVudC5zb3VyY2VJZCk7XG4gICAgICAgICAgICBjYXNlIFwicmV2aWV3XCI6XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldmlld3Muc29tZShcbiAgICAgICAgICAgICAgICAocikgPT5cbiAgICAgICAgICAgICAgICAgIHIucHJvamVjdElkID09PSBldmVudC5wcm9qZWN0SWQgJiZcbiAgICAgICAgICAgICAgICAgIGV2ZW50LnNvdXJjZUlkLmVuZHNXaXRoKHIuZGF0ZSksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpO1xuICAgICAgICBlbnN1cmUocHJvZHVjZWQsIFwiXHU4QkY3XHU1MTQ4XHU0RkREXHU1QjU4XHU2NzJDXHU2QjIxXHU2NTU5XHU1QjY2XHU0RThCXHU0RUY2XHU3Njg0XHU1QjlFXHU5NjQ1XHU0RUE3XHU3MjY5XCIpO1xuICAgICAgICBldmVudC5zdGF0ZSA9IFwiZG9uZVwiO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJyZXRyeUV2ZW50XCI6IHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSB0aGlzLmV2ZW50cy5maW5kKFxuICAgICAgICAgIChlKSA9PiBlLmlkID09PSBjb21tYW5kLmlkICYmIGUuc3RhdGUgIT09IFwiZG9uZVwiLFxuICAgICAgICApO1xuICAgICAgICBlbnN1cmUoZXZlbnQgIT09IHVuZGVmaW5lZCwgXCJcdTZDQTFcdTY3MDlcdTUzRUZcdTkxQ0RcdThCRDVcdTc2ODRcdTY1NTlcdTVCNjZcdTRFOEJcdTRFRjZcIik7XG4gICAgICAgIGV2ZW50LnN0YXRlID0gXCJwZW5kaW5nXCI7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB1cHNlcnRCeTxUPihsaXN0OiBUW10sIHZhbHVlOiBULCBrZXk6ICh4OiBUKSA9PiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgayA9IGtleSh2YWx1ZSk7XG4gIGNvbnN0IGluZGV4ID0gbGlzdC5maW5kSW5kZXgoKHgpID0+IGtleSh4KSA9PT0gayk7XG4gIGlmIChpbmRleCA+PSAwKSB7XG4gICAgbGlzdFtpbmRleF0gPSB2YWx1ZTtcbiAgfSBlbHNlIHtcbiAgICBsaXN0LnB1c2godmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbXBsZXRlZFN0dWR5VGFza0Zyb21UYXNrKFxuICB0YXNrOiBUYXNrLFxuICBhdDogbnVtYmVyLFxuKTogQ29tcGxldGVkU3R1ZHlUYXNrIHwgbnVsbCB7XG4gIGlmICh0YXNrLnByb2plY3RJZCA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiB7XG4gICAgaWQ6IHRhc2suaWQsXG4gICAgcHJvamVjdElkOiB0YXNrLnByb2plY3RJZCxcbiAgICB0aXRsZTogdGFzay50aXRsZSxcbiAgICBub3RlczogdGFzay5ub3RlcyxcbiAgICB0b3BpY3M6IFsuLi50YXNrLnRhZ3NdLFxuICAgIGNvbXBsZXRlZEF0OiBhdCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaG91ck1pbnV0ZU5vdyhhdDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKGF0ICogMTAwMCk7XG4gIHJldHVybiBgJHtTdHJpbmcoZC5nZXRIb3VycygpKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKGQuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuLy8gLS0tLS0tLS0tLSBcdTY4MjFcdTlBOEMgLS0tLS0tLS0tLVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVFZHVjYXRpb24oZGF0YTogQXBwRGF0YSk6IHZvaWQge1xuICBjb25zdCBlID0gZGF0YS5lZHVjYXRpb247XG4gIHVuaXF1ZUVkdWNhdGlvbklkcyhbXG4gICAgLi4uZS5yZXNvdXJjZXMubWFwKCh4KSA9PiB4LmlkKSxcbiAgICAuLi5lLnNlbWVzdGVycy5tYXAoKHgpID0+IHguaWQpLFxuICAgIC4uLmUubGVzc29ucy5tYXAoKHgpID0+IHguaWQpLFxuICAgIC4uLmUuYXNzZXNzbWVudHMubWFwKCh4KSA9PiB4LmlkKSxcbiAgICAuLi5lLnN1Ym1pc3Npb25zLm1hcCgoeCkgPT4geC5pZCksXG4gICAgLi4uZS5ncmFkZXMubWFwKCh4KSA9PiB4LmlkKSxcbiAgICAuLi5lLnJldmlld3MubWFwKCh4KSA9PiB4LmlkKSxcbiAgXSk7XG4gIHVuaXF1ZUVkdWNhdGlvbklkcyhlLnByb2plY3RzLm1hcCgocCkgPT4gcC5wcm9qZWN0SWQpKTtcbiAgdW5pcXVlRWR1Y2F0aW9uSWRzKGUuZXZlbnRzLm1hcCgocCkgPT4gcC5pZCkpO1xuICBjb25zdCBwcm9qZWN0RXhpc3RzID0gKGlkOiBzdHJpbmcpOiBib29sZWFuID0+XG4gICAgZGF0YS5wcm9qZWN0cy5zb21lKChwKSA9PiBwLmlkID09PSBpZCk7XG4gIGNvbnN0IHJlc291cmNlID0gKGlkOiBzdHJpbmcsIHA6IHN0cmluZyk6IFJlc291cmNlIHwgdW5kZWZpbmVkID0+XG4gICAgZS5yZXNvdXJjZXMuZmluZCgocikgPT4gci5pZCA9PT0gaWQgJiYgci5wcm9qZWN0SWQgPT09IHApO1xuICBlbnN1cmUoXG4gICAgZS5sZXNzb25zLmxlbmd0aCArXG4gICAgICBlLmFzc2Vzc21lbnRzLmxlbmd0aCArXG4gICAgICBlLnN1Ym1pc3Npb25zLmxlbmd0aCArXG4gICAgICBlLmdyYWRlcy5sZW5ndGggPD1cbiAgICAgIDEwMDAwMCxcbiAgICBcIlx1NjU1OVx1NUI2Nlx1OEJCMFx1NUY1NVx1NjU3MFx1OTFDRlx1OEQ4NVx1NTFGQVx1OTY1MFx1NTIzNlwiLFxuICApO1xuICBmb3IgKGNvbnN0IHAgb2YgZS5wcm9qZWN0cykge1xuICAgIGVuc3VyZShcbiAgICAgIHByb2plY3RFeGlzdHMocC5wcm9qZWN0SWQpICYmIGlzQWJzb2x1dGVQYXRoKHAuZGlyZWN0b3J5KSxcbiAgICAgIFwiXHU5ODc5XHU3NkVFXHU1RkM1XHU5ODdCXHU3RUQxXHU1QjlBXHU3RUREXHU1QkY5XHU3NkVFXHU1RjU1XCIsXG4gICAgKTtcbiAgICBlbnN1cmUoXG4gICAgICBwLmV4YW1EYXRlID09PSBudWxsIHx8IHZhbGlkRWR1Y2F0aW9uRGF0ZShwLmV4YW1EYXRlKSxcbiAgICAgIFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU4MDAzXHU4QkQ1XHU2NUU1XHU2NzFGXCIsXG4gICAgKTtcbiAgICBpZiAocC5leGFtTW9kZSkge1xuICAgICAgZW5zdXJlKFxuICAgICAgICBwLnZpc2lvbklkICE9PSBudWxsICYmXG4gICAgICAgICAgZGF0YS52aXNpb25zLnNvbWUoKHYpID0+IHYuaWQgPT09IHAudmlzaW9uSWQpICYmXG4gICAgICAgICAgY2hlY2tUZXh0KHAudGFyZ2V0LCA1MDAwMCksXG4gICAgICAgIFwiXHU1RTk0XHU4QkQ1XHU2QTIxXHU1RjBGXHU1RkM1XHU5ODdCXHU3RUQxXHU1QjlBXHU2MTNGXHU2NjZGXHU1RTc2XHU2NjBFXHU3ODZFXHU5NjYyXHU2ODIxXHUzMDAxXHU0RTEzXHU0RTFBXHUzMDAxXHU1RTc0XHU0RUZEXHU1NDhDXHU3OUQxXHU3NkVFXHU3NkVFXHU2ODA3XCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICBwLnN5bGxhYnVzSWQgIT09IG51bGwgJiZcbiAgICAgICAgICByZXNvdXJjZShwLnN5bGxhYnVzSWQsIHAucHJvamVjdElkKT8ua2luZCA9PT0gXCJzeWxsYWJ1c1wiLFxuICAgICAgICBcIlx1NUU5NFx1OEJENVx1NkEyMVx1NUYwRlx1NUZDNVx1OTg3Qlx1N0VEMVx1NUI5QVx1ODAwM1x1N0VCMlwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgcC5wYXN0UGFwZXJJZHMubGVuZ3RoID4gMCAmJlxuICAgICAgICAgIHAucGFzdFBhcGVySWRzLmV2ZXJ5KFxuICAgICAgICAgICAgKGlkKSA9PiByZXNvdXJjZShpZCwgcC5wcm9qZWN0SWQpPy5raW5kID09PSBcInBhc3RQYXBlclwiLFxuICAgICAgICAgICksXG4gICAgICAgIFwiXHU1RTk0XHU4QkQ1XHU2QTIxXHU1RjBGXHU1RkM1XHU5ODdCXHU3RUQxXHU1QjlBXHU3NzFGXHU5ODk4XCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICBwLm1vY2tQYXBlcklkcy5sZW5ndGggPiAwICYmXG4gICAgICAgICAgcC5tb2NrUGFwZXJJZHMuZXZlcnkoXG4gICAgICAgICAgICAoaWQpID0+IHJlc291cmNlKGlkLCBwLnByb2plY3RJZCk/LmtpbmQgPT09IFwibW9ja1BhcGVyXCIsXG4gICAgICAgICAgKSxcbiAgICAgICAgXCJcdTVFOTRcdThCRDVcdTZBMjFcdTVGMEZcdTVGQzVcdTk4N0JcdTdFRDFcdTVCOUFcdTZBMjFcdTYyREZcdTk4OThcIixcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgciBvZiBlLnJlc291cmNlcykge1xuICAgIGVuc3VyZShcbiAgICAgIGUucHJvamVjdHMuc29tZSgocCkgPT4gcC5wcm9qZWN0SWQgPT09IHIucHJvamVjdElkKSAmJlxuICAgICAgICBjaGVja1RleHQoci50aXRsZSwgNTAwMDApICYmXG4gICAgICAgIGlzUmVsYXRpdmVQYXRoKHIucGF0aCksXG4gICAgICBcIlx1OEQ0NFx1NkU5MFx1OTcwMFx1ODk4MVx1NjI0MFx1NUM1RVx1OTg3OVx1NzZFRVx1MzAwMVx1NTQwRFx1NzlGMFx1NTQ4Q1x1NUI4OVx1NTE2OFx1NzY4NFx1NzZGOFx1NUJGOVx1OERFRlx1NUY4NFwiLFxuICAgICk7XG4gIH1cbiAgZm9yIChjb25zdCBzIG9mIGUuc2VtZXN0ZXJzKSB7XG4gICAgZW5zdXJlKFxuICAgICAgZS5wcm9qZWN0cy5zb21lKChwKSA9PiBwLnByb2plY3RJZCA9PT0gcy5wcm9qZWN0SWQpICYmXG4gICAgICAgIGNoZWNrVGV4dChzLnRpdGxlLCA1MDAwMCkgJiZcbiAgICAgICAgdmFsaWRFZHVjYXRpb25EYXRlKHMuc3RhcnREYXRlKSAmJlxuICAgICAgICB2YWxpZEVkdWNhdGlvbkRhdGUocy5lbmREYXRlKSAmJlxuICAgICAgICBzLnN0YXJ0RGF0ZSA8PSBzLmVuZERhdGUgJiZcbiAgICAgICAgcy5yZXZpc2lvbiA+IDAgJiZcbiAgICAgICAgY2hlY2tUZXh0KHMuYmFzZWxpbmUsIDUwMDAwKSAmJlxuICAgICAgICBjaGVja1RleHQocy5yYXRpb25hbGUsIDUwMDAwKSAmJlxuICAgICAgICBzLmV2aWRlbmNlLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgcy5taWxlc3RvbmVzLmxlbmd0aCA+IDAsXG4gICAgICBcIlx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlx1N0YzQVx1NUMxMVx1NjVFNVx1NjcxRlx1MzAwMVx1NUI2Nlx1NjBDNVx1OEJDQVx1NjVBRFx1MzAwMVx1NEY5RFx1NjM2RVx1NjIxNlx1OTYzNlx1NkJCNVx1OEZEQlx1NUVBNlwiLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBtIG9mIHMubWlsZXN0b25lcykge1xuICAgICAgZW5zdXJlKFxuICAgICAgICBtLndlZWsgPiAwICYmXG4gICAgICAgICAgbS50b3BpY3MubGVuZ3RoID4gMCAmJlxuICAgICAgICAgIGNoZWNrVGV4dChtLm9iamVjdGl2ZSwgNTAwMDApICYmXG4gICAgICAgICAgbS5sZXNzb25Db3VudCA+IDAgJiZcbiAgICAgICAgICBtLnJlc291cmNlSWRzLmV2ZXJ5KChpZCkgPT4gcmVzb3VyY2UoaWQsIHMucHJvamVjdElkKSAhPT0gdW5kZWZpbmVkKSxcbiAgICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTU0NjhcdThGREJcdTVFQTZcdTYyMTZcdTVCNjZcdTRFNjBcdThENDRcdTZFOTBcIixcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgbCBvZiBlLmxlc3NvbnMpIHtcbiAgICBjb25zdCBzID0gWy4uLmUuc2VtZXN0ZXJzLCAuLi5lLnNlbWVzdGVySGlzdG9yeV0uZmluZChcbiAgICAgICh4KSA9PlxuICAgICAgICB4LmlkID09PSBsLnNlbWVzdGVySWQgJiZcbiAgICAgICAgeC5wcm9qZWN0SWQgPT09IGwucHJvamVjdElkICYmXG4gICAgICAgIHgucmV2aXNpb24gPT09IGwuc2VtZXN0ZXJSZXZpc2lvbixcbiAgICApO1xuICAgIGVuc3VyZShzICE9PSB1bmRlZmluZWQsIFwiXHU4QkZFXHU3QTBCXHU1RkM1XHU5ODdCXHU3RUQxXHU1QjlBXHU2NzJDXHU5ODc5XHU3NkVFXHU1QjY2XHU2NzFGXHU4QkExXHU1MjEyXCIpO1xuICAgIGVuc3VyZShcbiAgICAgIGNoZWNrVGV4dChsLnRpdGxlLCA1MDAwMCkgJiZcbiAgICAgICAgbC50b3BpY3MubGVuZ3RoID4gMCAmJlxuICAgICAgICBsLmVuZHNBdCAtIGwuc3RhcnRzQXQgPT09IDQ1ICogNjAgJiZcbiAgICAgICAgZGF0ZUF0KGwuc3RhcnRzQXQpID49IHMuc3RhcnREYXRlICYmXG4gICAgICAgIGRhdGVBdChsLmVuZHNBdCkgPD0gcy5lbmREYXRlICYmXG4gICAgICAgIGwucmVzb3VyY2VJZHMuZXZlcnkoKGlkKSA9PiByZXNvdXJjZShpZCwgbC5wcm9qZWN0SWQpICE9PSB1bmRlZmluZWQpLFxuICAgICAgXCJcdThCRkVcdTdBMEJcdTk3MDBcdTg5ODE0NVx1NTIwNlx1OTQ5Rlx1MzAwMVx1NzdFNVx1OEJDNlx1NzBCOVx1NTQ4Q1x1NjcwOVx1NjU0OFx1OEQ0NFx1NkU5MFx1RkYwQ1x1NEUxNFx1NTcyOFx1NUI2Nlx1NjcxRlx1ODMwM1x1NTZGNFx1NTE4NVwiLFxuICAgICk7XG4gICAgY29uc3QgbWludXRlID0gTWF0aC5mbG9vcihtaW51dGVzT2YoaG91ck1pbnV0ZU5vdyhsLnN0YXJ0c0F0KSkgPz8gMCk7XG4gICAgZW5zdXJlKFxuICAgICAgKG1pbnV0ZSA+PSA4ICogNjAgJiYgbWludXRlIDwgMTIgKiA2MCArIDQwKSB8fFxuICAgICAgICAobWludXRlID49IDE0ICogNjAgJiYgbWludXRlIDwgMTggKiA2MCArIDE1KSxcbiAgICAgIFwiXHU4QkZFXHU3QTBCXHU5ODdCXHU1NzI4XHU0RTBBXHU1MzQ4XHU2MjE2XHU0RTBCXHU1MzQ4XHVGRjBDXHU2NjVBXHU5NUY0MTlcdTIwMTMyMlx1NzBCOVx1NzU1OVx1N0VEOVx1NEY1Q1x1NEUxQVwiLFxuICAgICk7XG4gICAgY29uc3Qgc2FtZSA9IGUubGVzc29ucy5maWx0ZXIoXG4gICAgICAoeCkgPT4gZGF0ZUF0KHguc3RhcnRzQXQpID09PSBkYXRlQXQobC5zdGFydHNBdCksXG4gICAgKTtcbiAgICBsZXQgbW9ybmluZyA9IDA7XG4gICAgbGV0IGFmdGVybm9vbiA9IDA7XG4gICAgZm9yIChjb25zdCB4IG9mIHNhbWUpIHtcbiAgICAgIGNvbnN0IGggPSBuZXcgRGF0ZSh4LnN0YXJ0c0F0ICogMTAwMCkuZ2V0SG91cnMoKTtcbiAgICAgIGlmIChoIDwgMTIpIG1vcm5pbmcgKz0gMTtcbiAgICAgIGVsc2UgYWZ0ZXJub29uICs9IDE7XG4gICAgfVxuICAgIGVuc3VyZShtb3JuaW5nIDw9IDQgJiYgYWZ0ZXJub29uIDw9IDQsIFwiXHU4REU4XHU5ODc5XHU3NkVFXHU2QkNGXHU1OTI5XHU2NzAwXHU1OTFBXHU0RTBBXHU1MzQ4NFx1ODI4Mlx1MzAwMVx1NEUwQlx1NTM0ODRcdTgyODJcIik7XG4gICAgZW5zdXJlKFxuICAgICAgIWUubGVzc29ucy5zb21lKFxuICAgICAgICAoeCkgPT4geC5pZCAhPT0gbC5pZCAmJiB4LnN0YXJ0c0F0IDwgbC5lbmRzQXQgJiYgeC5lbmRzQXQgPiBsLnN0YXJ0c0F0LFxuICAgICAgKSxcbiAgICAgIFwiXHU4REU4XHU5ODc5XHU3NkVFXHU4QkZFXHU3QTBCXHU2NUY2XHU5NUY0XHU1MUIyXHU3QTgxXCIsXG4gICAgKTtcbiAgICBjb25zdCBkYXRlID0gZGF0ZUF0KGwuc3RhcnRzQXQpO1xuICAgIGZvciAoY29uc3QgYiBvZiBkYXRhLmJsb2Nrcykge1xuICAgICAgaWYgKGIuYXR0ZW50aW9uID09PSBcInJlcXVpcmVkXCIpIHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIG92ZXJsYXBNaW51dGVzT2ZCbG9jayhiLCBkYXRlLCBtaW51dGUsIG1pbnV0ZSArIDQ1KSA9PT0gMCxcbiAgICAgICAgICBcIlx1OEJGRVx1N0EwQlx1NEUwRVx1OTcwMFx1NEUxM1x1NUZDM1x1NzY4NFx1NTZGQVx1NUI5QVx1NTM2MFx1NzUyOFx1NTFCMlx1N0E4MVwiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IGEgb2YgZS5hc3Nlc3NtZW50cykge1xuICAgIGVuc3VyZShcbiAgICAgIGUucHJvamVjdHMuc29tZSgocCkgPT4gcC5wcm9qZWN0SWQgPT09IGEucHJvamVjdElkKSxcbiAgICAgIFwiQUlcdTRGNUNcdTRFMUFcdTU0OENcdTgwMDNcdThCRDVcdTk3MDBcdTg5ODFcdTU0MkZcdTc1MjhcdTVFOTRcdThCRDVcdTZBMjFcdTVGMEZcIixcbiAgICApO1xuICAgIGVuc3VyZShcbiAgICAgIFsuLi5lLnNlbWVzdGVycywgLi4uZS5zZW1lc3Rlckhpc3RvcnldLnNvbWUoXG4gICAgICAgIChzKSA9PlxuICAgICAgICAgIHMuaWQgPT09IGEuc2VtZXN0ZXJJZCAmJlxuICAgICAgICAgIHMucHJvamVjdElkID09PSBhLnByb2plY3RJZCAmJlxuICAgICAgICAgIHMucmV2aXNpb24gPT09IGEuc2VtZXN0ZXJSZXZpc2lvbixcbiAgICAgICksXG4gICAgICBcIlx1OEJENVx1OTg5OFx1NUZDNVx1OTg3Qlx1N0VEMVx1NUI5QVx1NUI2Nlx1NjcxRlx1OEJBMVx1NTIxMlwiLFxuICAgICk7XG4gICAgZW5zdXJlKFxuICAgICAgYS5yZXZpc2lvbiA+IDAgJiZcbiAgICAgICAgYS5zdGFydHNBdCA8IGEuZW5kc0F0ICYmXG4gICAgICAgIGNoZWNrVGV4dChhLnRpdGxlLCA1MDAwMCkgJiZcbiAgICAgICAgY2hlY2tUZXh0KGEucmV2aWV3RXZpZGVuY2UsIDUwMDAwKSAmJlxuICAgICAgICBjaGVja1RleHQoYS5pbnN0cnVjdGlvbnMsIDUwMDAwKSAmJlxuICAgICAgICBhLnF1ZXN0aW9ucy5sZW5ndGggPiAwLFxuICAgICAgXCJcdTUzRDFcdTVFMDNcdTUyNERcdTVGQzVcdTk4N0JcdTUxQzZcdTU5MDdcdTk4OThcdTc2RUVcdTMwMDFcdTgwMDNcdThCRDVcdThCRjRcdTY2MEVcdTMwMDFcdTdCNTRcdTY4NDhcdTU0OENcdTcyRUNcdTdBQ0JcdTU5MERcdTY4MzhcdThCQjBcdTVGNTVcIixcbiAgICApO1xuICAgIGlmIChhLmtpbmQgPT09IFwiaG9tZXdvcmtcIikge1xuICAgICAgZW5zdXJlKFxuICAgICAgICAoYS50YXNrSWQgPT09IG51bGwgJiZcbiAgICAgICAgICBhLmxlc3NvbklkICE9PSBudWxsICYmXG4gICAgICAgICAgZS5sZXNzb25zLnNvbWUoXG4gICAgICAgICAgICAobCkgPT5cbiAgICAgICAgICAgICAgbC5pZCA9PT0gYS5sZXNzb25JZCAmJlxuICAgICAgICAgICAgICBsLnByb2plY3RJZCA9PT0gYS5wcm9qZWN0SWQgJiZcbiAgICAgICAgICAgICAgbC5haUVuYWJsZWQgJiZcbiAgICAgICAgICAgICAgbC5zdGF0ZSA9PT0gXCJlbmRlZFwiLFxuICAgICAgICAgICkpIHx8XG4gICAgICAgICAgKGEubGVzc29uSWQgPT09IG51bGwgJiZcbiAgICAgICAgICAgIGEudGFza0lkICE9PSBudWxsICYmXG4gICAgICAgICAgICBlLmNvbXBsZXRlZFRhc2tzLnNvbWUoXG4gICAgICAgICAgICAgICh0KSA9PiB0LmlkID09PSBhLnRhc2tJZCAmJiB0LnByb2plY3RJZCA9PT0gYS5wcm9qZWN0SWQsXG4gICAgICAgICAgICApKSxcbiAgICAgICAgXCJcdTRGNUNcdTRFMUFcdTVGQzVcdTk4N0JcdTY3NjVcdTgxRUFcdTY3MkNcdTk4NzlcdTc2RUVcdTVERjJcdTdFRDNcdTY3NUZcdTc2ODRBSVx1OEJGRVx1N0EwQlx1NjIxNlx1NURGMlx1NUI4Q1x1NjIxMFx1NUI2Nlx1NEU2MFx1NEVGQlx1NTJBMVwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKGEua2luZCA9PT0gXCJyZXRlc3RcIikge1xuICAgICAgZW5zdXJlKFxuICAgICAgICBhLnJldGVzdE9mR3JhZGVJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgIGUuZ3JhZGVzLnNvbWUoKGcpID0+IHtcbiAgICAgICAgICAgIGlmIChnLmlkICE9PSBhLnJldGVzdE9mR3JhZGVJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIGUuc3VibWlzc2lvbnMuc29tZSgocykgPT4ge1xuICAgICAgICAgICAgICBpZiAocy5pZCAhPT0gZy5zdWJtaXNzaW9uSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgcmV0dXJuIGUuYXNzZXNzbWVudHMuc29tZShcbiAgICAgICAgICAgICAgICAob3JpZ2luYWwpID0+XG4gICAgICAgICAgICAgICAgICBvcmlnaW5hbC5pZCA9PT0gcy5hc3Nlc3NtZW50SWQgJiZcbiAgICAgICAgICAgICAgICAgIG9yaWdpbmFsLnByb2plY3RJZCA9PT0gYS5wcm9qZWN0SWQsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgXCJcdTU5MERcdTZENEJcdTVGQzVcdTk4N0JcdTUxNzNcdTgwNTRcdTY3MkNcdTk4NzlcdTc2RUVcdTUzOUZcdTU5Q0JcdTYyNzlcdTY1MzlcIixcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVuc3VyZShhLnJldGVzdE9mR3JhZGVJZCA9PT0gbnVsbCwgXCJcdTUzRUFcdTY3MDlcdTU5MERcdTZENEJcdTUzRUZcdTRFRTVcdTVGMTVcdTc1MjhcdTUzOUZcdTU5Q0JcdTYyNzlcdTY1MzlcIik7XG4gICAgfVxuICAgIGlmIChhLmtpbmQgPT09IFwid2Vla2x5RXhhbVwiKSB7XG4gICAgICBlbnN1cmUod2Vla2RheU1vbmRheShsb2NhbERhdGVPZihhLnN0YXJ0c0F0KSkgPj0gNiwgXCJcdTU0NjhcdTgwMDNcdTVCODlcdTYzOTJcdTU3MjhcdTU0NjhcdTY3MkJcIik7XG4gICAgfVxuICAgIGlmIChhLmtpbmQgIT09IFwiaG9tZXdvcmtcIikge1xuICAgICAgZW5zdXJlKFxuICAgICAgICAhZS5sZXNzb25zLnNvbWUoXG4gICAgICAgICAgKGwpID0+IGwuc3RhcnRzQXQgPCBhLmVuZHNBdCAmJiBsLmVuZHNBdCA+IGEuc3RhcnRzQXQsXG4gICAgICAgICkgJiZcbiAgICAgICAgICAhZS5hc3Nlc3NtZW50cy5zb21lKFxuICAgICAgICAgICAgKGIpID0+XG4gICAgICAgICAgICAgIGIuaWQgIT09IGEuaWQgJiZcbiAgICAgICAgICAgICAgYi5raW5kICE9PSBcImhvbWV3b3JrXCIgJiZcbiAgICAgICAgICAgICAgYi5zdGFydHNBdCA8IGEuZW5kc0F0ICYmXG4gICAgICAgICAgICAgIGIuZW5kc0F0ID4gYS5zdGFydHNBdCxcbiAgICAgICAgICApLFxuICAgICAgICBcIlx1ODAwM1x1OEJENVx1NEUwRVx1OEJGRVx1N0EwQlx1NjIxNlx1NTE3Nlx1NEVENlx1ODAwM1x1OEJENVx1NTFCMlx1N0E4MVwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgdW5pcXVlRWR1Y2F0aW9uSWRzKGEucXVlc3Rpb25zLm1hcCgocSkgPT4gcS5pZCkpO1xuICAgIGZvciAoY29uc3QgcSBvZiBhLnF1ZXN0aW9ucykge1xuICAgICAgZW5zdXJlKFxuICAgICAgICBjaGVja1RleHQocS5wcm9tcHQsIDUwMDAwKSAmJlxuICAgICAgICAgIGNoZWNrVGV4dChxLmFuc3dlciwgNTAwMDApICYmXG4gICAgICAgICAgcS50b3BpY3MubGVuZ3RoID4gMCAmJlxuICAgICAgICAgIHEuZXN0aW1hdGVkTWludXRlcyA+IDAgJiZcbiAgICAgICAgICBxLnNjb3JpbmcubGVuZ3RoID4gMCAmJlxuICAgICAgICAgIHEuc291cmNlSWRzLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICBxLnNvdXJjZUlkcy5ldmVyeSgoaWQpID0+IHJlc291cmNlKGlkLCBhLnByb2plY3RJZCkgIT09IHVuZGVmaW5lZCksXG4gICAgICAgIFwiXHU2QkNGXHU5ODk4XHU1RkM1XHU5ODdCXHU2NzA5XHU2NzY1XHU2RTkwXHUzMDAxXHU3N0U1XHU4QkM2XHU3MEI5XHUzMDAxXHU0RjMwXHU2NUY2XHUzMDAxXHU3QjU0XHU2ODQ4XHU1NDhDXHU4QkM0XHU1MjA2XHU3MEI5XCIsXG4gICAgICApO1xuICAgICAgdW5pcXVlRWR1Y2F0aW9uSWRzKHEuc2NvcmluZy5tYXAoKHApID0+IHAuaWQpKTtcbiAgICAgIGZvciAoY29uc3QgcCBvZiBxLnNjb3JpbmcpIHtcbiAgICAgICAgZW5zdXJlKFxuICAgICAgICAgIHAucG9pbnRzID4gMCAmJiBjaGVja1RleHQocC5kZXNjcmlwdGlvbiwgNTAwMDApLFxuICAgICAgICAgIFwiXHU4QkM0XHU1MjA2XHU3MEI5XHU5NzAwXHU4OTgxXHU1MjA2XHU1MDNDXHU0RTBFXHU1MjI0XHU1MjA2XHU0RjlEXHU2MzZFXCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoIXEuZXh0ZW5zaW9uICYmIGEua2luZCAhPT0gXCJtb2NrRXhhbVwiICYmIGEua2luZCAhPT0gXCJyZXRlc3RcIikge1xuICAgICAgICBlbnN1cmUoXG4gICAgICAgICAgcS50b3BpY3MuZXZlcnkoXG4gICAgICAgICAgICAodCkgPT5cbiAgICAgICAgICAgICAgZS5sZXNzb25zLnNvbWUoXG4gICAgICAgICAgICAgICAgKGwpID0+XG4gICAgICAgICAgICAgICAgICBsLnByb2plY3RJZCA9PT0gYS5wcm9qZWN0SWQgJiZcbiAgICAgICAgICAgICAgICAgIGwuc3RhdGUgPT09IFwiZW5kZWRcIiAmJlxuICAgICAgICAgICAgICAgICAgbC50b3BpY3MuaW5jbHVkZXModCksXG4gICAgICAgICAgICAgICkgfHxcbiAgICAgICAgICAgICAgZS5jb21wbGV0ZWRUYXNrcy5zb21lKFxuICAgICAgICAgICAgICAgICh0YXNrKSA9PlxuICAgICAgICAgICAgICAgICAgdGFzay5wcm9qZWN0SWQgPT09IGEucHJvamVjdElkICYmIHRhc2sudG9waWNzLmluY2x1ZGVzKHQpLFxuICAgICAgICAgICAgICApIHx8XG4gICAgICAgICAgICAgIGUucHJvZ3Jlc3Muc29tZShcbiAgICAgICAgICAgICAgICAocikgPT5cbiAgICAgICAgICAgICAgICAgIHIucHJvamVjdElkID09PSBhLnByb2plY3RJZCAmJiByLmNvbmZpcm1lZCAmJiByLnRvcGljID09PSB0LFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICksXG4gICAgICAgICAgXCJcdTU3RkFcdTc4NDBcdTdFQzNcdTRFNjBcdTRFMERcdTgwRkRcdTUzMDVcdTU0MkJcdTVDMUFcdTY3MkFcdTYzODhcdThCRkVcdTc2ODRcdTc3RTVcdThCQzZcdTcwQjlcdUZGMUJcdTYyRDNcdTVDNTVcdTk4OThcdTk4N0JcdTY2MEVcdTc4NkVcdTY4MDdcdThCQjBcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBzIG9mIGUuc3VibWlzc2lvbnMpIHtcbiAgICBjb25zdCBhID0gZS5hc3Nlc3NtZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBzLmFzc2Vzc21lbnRJZCk7XG4gICAgZW5zdXJlKGEgIT09IHVuZGVmaW5lZCwgXCJcdTYzRDBcdTRFQTRcdTVGMTVcdTc1MjhcdTRFODZcdTRFMERcdTVCNThcdTU3MjhcdTc2ODRcdThCRDVcdTk4OThcIik7XG4gICAgZW5zdXJlKFxuICAgICAgcy5yZXNvdXJjZUlkcy5ldmVyeSgoaWQpID0+IHJlc291cmNlKGlkLCBhLnByb2plY3RJZCkgIT09IHVuZGVmaW5lZCksXG4gICAgICBcIlx1N0I1NFx1NTM3N1x1OTY0NFx1NEVGNlx1NUZDNVx1OTg3Qlx1NUM1RVx1NEU4RVx1NjcyQ1x1OTg3OVx1NzZFRVwiLFxuICAgICk7XG4gICAgdW5pcXVlRWR1Y2F0aW9uSWRzKHMucXVlc3Rpb25UaW1lcy5tYXAoKHQpID0+IHQucXVlc3Rpb25JZCkpO1xuICAgIGZvciAoY29uc3QgdCBvZiBzLnF1ZXN0aW9uVGltZXMpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgYS5xdWVzdGlvbnMuc29tZSgocSkgPT4gcS5pZCA9PT0gdC5xdWVzdGlvbklkKSAmJlxuICAgICAgICAgIHQubG9jYWxUaW1lLmxlbmd0aCA9PT0gNSAmJlxuICAgICAgICAgIG1pbnV0ZXNPZih0LmxvY2FsVGltZSkgIT09IG51bGwsXG4gICAgICAgIFwiXHU2QkNGXHU5ODk4XHU4QkIwXHU1RjU1XHU2NzJDXHU2NzNBSEg6TU1cdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcIixcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgZyBvZiBlLmdyYWRlcykge1xuICAgIGNvbnN0IHMgPSBlLnN1Ym1pc3Npb25zLmZpbmQoKHgpID0+IHguaWQgPT09IGcuc3VibWlzc2lvbklkKTtcbiAgICBlbnN1cmUocyAhPT0gdW5kZWZpbmVkLCBcIlx1NjI3OVx1NjUzOVx1N0YzQVx1NUMxMVx1NjNEMFx1NEVBNFx1NzI0OFx1NjcyQ1wiKTtcbiAgICBjb25zdCBhID0gZS5hc3Nlc3NtZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBzLmFzc2Vzc21lbnRJZCk7XG4gICAgZW5zdXJlKGEgIT09IHVuZGVmaW5lZCwgXCJcdThCRDVcdTk4OThcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgZW5zdXJlKFxuICAgICAgZy5hc3Nlc3NtZW50UmV2aXNpb24gPT09IGEucmV2aXNpb24gJiYgY2hlY2tUZXh0KGcuZmVlZGJhY2ssIDUwMDAwKSxcbiAgICAgIFwiXHU2Mjc5XHU2NTM5XHU1RkM1XHU5ODdCXHU1RjE1XHU3NTI4XHU1M0QxXHU1RTAzXHU2NUY2XHU3Njg0XHU4QkM0XHU1MjA2XHU3MjQ4XHU2NzJDXHU1RTc2XHU3RUQ5XHU1MUZBXHU1M0NEXHU5OTg4XCIsXG4gICAgKTtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBhd2FyZCBvZiBnLmF3YXJkcykge1xuICAgICAgY29uc3QgcG9pbnQgPSBhLnF1ZXN0aW9uc1xuICAgICAgICAuZmluZCgocSkgPT4gcS5pZCA9PT0gYXdhcmQucXVlc3Rpb25JZClcbiAgICAgICAgPy5zY29yaW5nLmZpbmQoKHApID0+IHAuaWQgPT09IGF3YXJkLnBvaW50SWQpO1xuICAgICAgZW5zdXJlKHBvaW50ICE9PSB1bmRlZmluZWQsIFwiXHU2Mjc5XHU2NTM5XHU0RTBEXHU4MEZEXHU0RTM0XHU2NUY2XHU1ODlFXHU1MkEwXHU4QkM0XHU1MjA2XHU3MEI5XCIpO1xuICAgICAgZW5zdXJlKFxuICAgICAgICBhd2FyZC5hd2FyZGVkIDw9IHBvaW50LnBvaW50cyAmJlxuICAgICAgICAgIGNoZWNrVGV4dChhd2FyZC5ldmlkZW5jZSwgNTAwMDApICYmXG4gICAgICAgICAgIXNlZW4uaGFzKGAke2F3YXJkLnF1ZXN0aW9uSWR9fCR7YXdhcmQucG9pbnRJZH1gKSxcbiAgICAgICAgXCJcdThCQzRcdTUyMDZcdThEODVcdTgzMDNcdTU2RjRcdTMwMDFcdTkxQ0RcdTU5MERcdTYyMTZcdTdGM0FcdTVDMTFcdTdCNTRcdTUzNzdcdThCQzFcdTYzNkVcIixcbiAgICAgICk7XG4gICAgICBzZWVuLmFkZChgJHthd2FyZC5xdWVzdGlvbklkfXwke2F3YXJkLnBvaW50SWR9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRvdGFsUG9pbnRzID0gYS5xdWVzdGlvbnMucmVkdWNlKChuLCBxKSA9PiBuICsgcS5zY29yaW5nLmxlbmd0aCwgMCk7XG4gICAgZW5zdXJlKFxuICAgICAgZy5uZWVkc1JldmlldyB8fCBnLmF3YXJkcy5sZW5ndGggPT09IHRvdGFsUG9pbnRzLFxuICAgICAgXCJcdTZCNjNcdTVGMEZcdTYyNzlcdTY1MzlcdTVGQzVcdTk4N0JcdTg5ODZcdTc2RDZcdTUxNjhcdTkwRThcdThCQzRcdTUyMDZcdTcwQjlcdUZGMUJcdThCQzZcdTUyMkJcdTRFMERcdTZFMDVcdThCRjdcdTY4MDdcdThCQjBcdTVGODVcdTU5MERcdTY4MzhcIixcbiAgICApO1xuICAgIGZvciAoY29uc3QgZXJyb3Igb2YgZy5lcnJvcnMpIHtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgYS5xdWVzdGlvbnMuc29tZSgocSkgPT4gcS5pZCA9PT0gZXJyb3IucXVlc3Rpb25JZCkgJiZcbiAgICAgICAgICBjaGVja1RleHQoZXJyb3IuY2F1c2UsIDUwMDAwKSAmJlxuICAgICAgICAgIGNoZWNrVGV4dChlcnJvci5ldmlkZW5jZSwgNTAwMDApICYmXG4gICAgICAgICAgY2hlY2tUZXh0KGVycm9yLmNvcnJlY3Rpb24sIDUwMDAwKSAmJlxuICAgICAgICAgIGNoZWNrVGV4dChlcnJvci5uZXh0Q2hlY2ssIDUwMDAwKSAmJlxuICAgICAgICAgIHZhbGlkRWR1Y2F0aW9uRGF0ZShlcnJvci5yZXRlc3REYXRlKSxcbiAgICAgICAgXCJcdTk1MTlcdTU2RTBcdTUyMDZcdTY3OTBcdTk3MDBcdTg5ODFcdThCQzFcdTYzNkVcdTMwMDFcdTdFQTBcdTZCNjNcdTUyQThcdTRGNUNcdTU0OENcdTU5MERcdTZENEJcdTY1RTVcdTY3MUZcIixcbiAgICAgICk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgciBvZiBlLnJldmlld3MpIHtcbiAgICBlbnN1cmUoXG4gICAgICBwcm9qZWN0RXhpc3RzKHIucHJvamVjdElkKSAmJlxuICAgICAgICB2YWxpZEVkdWNhdGlvbkRhdGUoci5kYXRlKSAmJlxuICAgICAgICBjaGVja1RleHQoci5maW5kaW5ncywgNTAwMDApICYmXG4gICAgICAgIHIuYWN0aW9ucy5sZW5ndGggPiAwICYmXG4gICAgICAgIHIuZ3JhZGVJZHMubGVuZ3RoID4gMCAmJlxuICAgICAgICByLmdyYWRlSWRzLmV2ZXJ5KChpZCkgPT5cbiAgICAgICAgICBlLmdyYWRlcy5zb21lKChnKSA9PiB7XG4gICAgICAgICAgICBpZiAoZy5pZCAhPT0gaWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiBlLnN1Ym1pc3Npb25zLnNvbWUoKHMpID0+IHtcbiAgICAgICAgICAgICAgaWYgKHMuaWQgIT09IGcuc3VibWlzc2lvbklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgIHJldHVybiBlLmFzc2Vzc21lbnRzLnNvbWUoXG4gICAgICAgICAgICAgICAgKGEpID0+IGEuaWQgPT09IHMuYXNzZXNzbWVudElkICYmIGEucHJvamVjdElkID09PSByLnByb2plY3RJZCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pLFxuICAgICAgICApLFxuICAgICAgXCJcdTU5MERcdTc2RDhcdTVGQzVcdTk4N0JcdTVGMTVcdTc1MjhcdTY3MkNcdTk4NzlcdTc2RUVcdTYyNzlcdTY1MzlcdTVFNzZcdTdFRDlcdTUxRkFcdTU0MEVcdTdFRURcdTg4NENcdTUyQThcIixcbiAgICApO1xuICB9XG4gIGZvciAoY29uc3QgZXZlbnQgb2YgZS5ldmVudHMpIHtcbiAgICBlbnN1cmUoXG4gICAgICBwcm9qZWN0RXhpc3RzKGV2ZW50LnByb2plY3RJZCkgJiZcbiAgICAgICAgW1wicGVuZGluZ1wiLCBcInJ1bm5pbmdcIiwgXCJkb25lXCJdLmluY2x1ZGVzKGV2ZW50LnN0YXRlKSAmJlxuICAgICAgICBbXG4gICAgICAgICAgXCJob21ld29ya1wiLFxuICAgICAgICAgIFwidGFza0hvbWV3b3JrXCIsXG4gICAgICAgICAgXCJncmFkZVwiLFxuICAgICAgICAgIFwiY29ycmVjdGlvblwiLFxuICAgICAgICAgIFwicmV2aWV3XCIsXG4gICAgICAgICAgXCJ3ZWVrbHlFeGFtXCIsXG4gICAgICAgIF0uaW5jbHVkZXMoZXZlbnQua2luZCksXG4gICAgICBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NjU1OVx1NUI2Nlx1NEU4Qlx1NEVGNlwiLFxuICAgICk7XG4gIH1cbiAgdmFsaWRhdGVMZWFybmluZyhkYXRhKTtcbn1cblxuZnVuY3Rpb24gdW5pcXVlRWR1Y2F0aW9uSWRzKGlkczogc3RyaW5nW10pOiB2b2lkIHtcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBmb3IgKGNvbnN0IGlkIG9mIGlkcykge1xuICAgIGVuc3VyZShcbiAgICAgIGlkLnRyaW0oKS5sZW5ndGggPiAwICYmIGlkLmxlbmd0aCA8PSAyMDAgJiYgIXNlZW4uaGFzKGlkKSxcbiAgICAgIFwiXHU2NTU5XHU1QjY2XHU1QjlFXHU0RjUzIElEIFx1NEUzQVx1N0E3QVx1MzAwMVx1OEZDN1x1OTU3Rlx1NjIxNlx1OTFDRFx1NTkwRFwiLFxuICAgICk7XG4gICAgc2Vlbi5hZGQoaWQpO1xuICB9XG59XG5cbi8qKiBcdTVCRkNcdTUxNjVcdTUzRUZcdTYwNjJcdTU5MERcdThCQjBcdTVGNTVcdUZGMENcdTRGNDZcdTRFMERcdTVGOTdcdTk3NTlcdTlFRDhcdTY1MzlcdTUxOTlcdTVERjJcdTUzRDFcdTVFMDNcdTk4OThcdTc2RUVcdTYyMTZcdTUzODZcdTUzRjJcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUVkdWNhdGlvblRyYW5zaXRpb24oXG4gIGJlZm9yZTogRWR1Y2F0aW9uLFxuICBhZnRlcjogRWR1Y2F0aW9uLFxuKTogdm9pZCB7XG4gIHZhbGlkYXRlTGVhcm5pbmdUcmFuc2l0aW9uKGJlZm9yZSwgYWZ0ZXIpO1xuICBmb3IgKGNvbnN0IGxpbmsgb2YgYmVmb3JlLmZvY3VzVGFza3MpIHtcbiAgICBlbnN1cmUoXG4gICAgICBhZnRlci5mb2N1c1Rhc2tzLnNvbWUoXG4gICAgICAgICh4KSA9PlxuICAgICAgICAgIHgudGFza0lkID09PSBsaW5rLnRhc2tJZCAmJlxuICAgICAgICAgIHguc291cmNlSWQgPT09IGxpbmsuc291cmNlSWQgJiZcbiAgICAgICAgICB4LmtpbmQgPT09IGxpbmsua2luZCxcbiAgICAgICksXG4gICAgICBcIlx1NURGMlx1NUVGQVx1N0FDQlx1NzY4NFx1NjU1OVx1NUI2Nlx1NUY4NVx1NTI5RVx1Njc2NVx1NkU5MFx1NTE3M1x1ODA1NFx1NEUwRFx1ODBGRFx1NTIyMFx1OTY2NFx1NjIxNlx1NjUzOVx1NTE5OVwiLFxuICAgICk7XG4gIH1cbiAgY29uc3QgYWN0aXZlUmVzb3VyY2VzID0gbmV3IFNldChhZnRlci5yZXNvdXJjZXMubWFwKChyKSA9PiByLmlkKSk7XG4gIGNvbnN0IHJlZmVyZW5jZXMgPSBiZWZvcmUucmVzb3VyY2VSZWZlcmVuY2VJbmRleCgpO1xuICBmb3IgKGNvbnN0IHJlc291cmNlIG9mIGJlZm9yZS5yZXNvdXJjZXMpIHtcbiAgICBpZiAoIWFjdGl2ZVJlc291cmNlcy5oYXMocmVzb3VyY2UuaWQpKSB7XG4gICAgICBlbnN1cmUoXG4gICAgICAgICFyZWZlcmVuY2VzLmhhcyhyZXNvdXJjZS5pZCksXG4gICAgICAgIFwiXHU2NTU5XHU1QjY2XHU1Mzg2XHU1M0YyXHU1RjE1XHU3NTI4XHU3Njg0XHU4RDQ0XHU2RTkwXHU3NjdCXHU4QkIwXHU0RTBEXHU4MEZEXHU1MjIwXHU5NjY0XHVGRjBDXHU4QkY3XHU0RkVFXHU1OTBEXHU4REVGXHU1Rjg0XCIsXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IGEgb2YgYmVmb3JlLmFzc2Vzc21lbnRzKSB7XG4gICAgZW5zdXJlKFxuICAgICAgYWZ0ZXIuYXNzZXNzbWVudHMuc29tZSgoYikgPT4gYi5pZCA9PT0gYS5pZCksXG4gICAgICBcIlx1NURGMlx1NTNEMVx1NUUwM1x1OEJENVx1NTM3N1x1NEUwRFx1ODBGRFx1NTIyMFx1OTY2NFwiLFxuICAgICk7XG4gICAgY29uc3QgYiA9IGFmdGVyLmFzc2Vzc21lbnRzLmZpbmQoKHgpID0+IHguaWQgPT09IGEuaWQpO1xuICAgIGlmIChiICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG9sZCA9IGNsb25lQXNzZXNzbWVudChhKTtcbiAgICAgIG9sZC5wcmludGVkQXQgPSBiLnByaW50ZWRBdDtcbiAgICAgIG9sZC5zdGFydGVkQXQgPSBiLnN0YXJ0ZWRBdDtcbiAgICAgIG9sZC5zdG9wcGVkQXQgPSBiLnN0b3BwZWRBdDtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgYXNzZXNzbWVudEVxdWFscyhvbGQsIGIpLFxuICAgICAgICBcIlx1NURGMlx1NTNEMVx1NUUwM1x1OTg5OFx1NzZFRVx1NEUwRVx1OEJDNFx1NTIwNlx1NjgwN1x1NTFDNlx1NEUwRFx1NTNFRlx1ODhBQlx1NUJGQ1x1NTE2NVx1NjIxNlx1ODg2NVx1NEUwMVx1NjUzOVx1NTE5OVwiLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBzIG9mIGJlZm9yZS5zdWJtaXNzaW9ucykge1xuICAgIGNvbnN0IGIgPSBhZnRlci5zdWJtaXNzaW9ucy5maW5kKCh4KSA9PiB4LmlkID09PSBzLmlkKTtcbiAgICBlbnN1cmUoXG4gICAgICBiICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBvbGQgPSBjbG9uZVN1Ym1pc3Npb24ocyk7XG4gICAgICAgICAgb2xkLnF1ZXN0aW9uVGltZXMgPSBiLnF1ZXN0aW9uVGltZXMubWFwKCh0KSA9PiAoeyAuLi50IH0pKTtcbiAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgc3VibWlzc2lvbkVxdWFscyhvbGQsIGIpICYmXG4gICAgICAgICAgICBzdGFydHNXaXRoUXVlc3Rpb25UaW1lcyhiLnF1ZXN0aW9uVGltZXMsIHMucXVlc3Rpb25UaW1lcykgJiZcbiAgICAgICAgICAgIChiLnF1ZXN0aW9uVGltZXMubGVuZ3RoID09PSBzLnF1ZXN0aW9uVGltZXMubGVuZ3RoIHx8XG4gICAgICAgICAgICAgICFiZWZvcmUuZ3JhZGVzLnNvbWUoKGcpID0+IGcuc3VibWlzc2lvbklkID09PSBzLmlkKSlcbiAgICAgICAgICApO1xuICAgICAgICB9KSgpLFxuICAgICAgXCJcdTYzRDBcdTRFQTRcdTUzODZcdTUzRjJcdTRFMERcdTUzRUZcdTY1MzlcdTUxOTlcdUZGMUJcdTUzRUFcdTgwRkRcdTU3MjhcdTYyNzlcdTY1MzlcdTUyNERcdTg4NjVcdTUxNDVcdTdGM0FcdTU5MzFcdTc2ODRcdTVCOENcdTYyMTBcdTY1RjZcdTUyM0JcIixcbiAgICApO1xuICB9XG4gIGZvciAoY29uc3QgZyBvZiBiZWZvcmUuZ3JhZGVzKSB7XG4gICAgY29uc3QgYiA9IGFmdGVyLmdyYWRlcy5maW5kKCh4KSA9PiB4LmlkID09PSBnLmlkKTtcbiAgICBlbnN1cmUoYiAhPT0gdW5kZWZpbmVkICYmIGdyYWRlRXF1YWxzKGIsIGcpLCBcIlx1NjI3OVx1NjUzOVx1NTM4Nlx1NTNGMlx1NEUwRFx1NTNFRlx1NjUzOVx1NTE5OVwiKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbG9uZUFzc2Vzc21lbnQoYTogQXNzZXNzbWVudCk6IEFzc2Vzc21lbnQge1xuICByZXR1cm4ge1xuICAgIC4uLmEsXG4gICAgcXVlc3Rpb25zOiBhLnF1ZXN0aW9ucy5tYXAoKHEpID0+ICh7XG4gICAgICAuLi5xLFxuICAgICAgdG9waWNzOiBbLi4ucS50b3BpY3NdLFxuICAgICAgc291cmNlSWRzOiBbLi4ucS5zb3VyY2VJZHNdLFxuICAgICAgc2NvcmluZzogcS5zY29yaW5nLm1hcCgocCkgPT4gKHsgLi4ucCB9KSksXG4gICAgfSkpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBjbG9uZVN1Ym1pc3Npb24oczogU3VibWlzc2lvbik6IFN1Ym1pc3Npb24ge1xuICByZXR1cm4ge1xuICAgIC4uLnMsXG4gICAgcmVzb3VyY2VJZHM6IFsuLi5zLnJlc291cmNlSWRzXSxcbiAgICBxdWVzdGlvblRpbWVzOiBzLnF1ZXN0aW9uVGltZXMubWFwKCh0KSA9PiAoeyAuLi50IH0pKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYXNzZXNzbWVudEVxdWFscyhhOiBBc3Nlc3NtZW50LCBiOiBBc3Nlc3NtZW50KTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplQXNzZXNzbWVudChhKSkgPT09XG4gICAgSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplQXNzZXNzbWVudChiKSlcbiAgKTtcbn1cblxuZnVuY3Rpb24gc3VibWlzc2lvbkVxdWFscyhhOiBTdWJtaXNzaW9uLCBiOiBTdWJtaXNzaW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplU3VibWlzc2lvbihhKSkgPT09XG4gICAgSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplU3VibWlzc2lvbihiKSlcbiAgKTtcbn1cblxuZnVuY3Rpb24gZ3JhZGVFcXVhbHMoYTogR3JhZGUsIGI6IEdyYWRlKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplR3JhZGUoYSkpID09PSBKU09OLnN0cmluZ2lmeShzZXJpYWxpemVHcmFkZShiKSlcbiAgKTtcbn1cblxuZnVuY3Rpb24gc3RhcnRzV2l0aFF1ZXN0aW9uVGltZXMoXG4gIGxpc3Q6IFF1ZXN0aW9uVGltZVtdLFxuICBwcmVmaXg6IFF1ZXN0aW9uVGltZVtdLFxuKTogYm9vbGVhbiB7XG4gIHJldHVybiBwcmVmaXguZXZlcnkoXG4gICAgKHAsIGkpID0+XG4gICAgICBsaXN0W2ldICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIGxpc3RbaV0hLnF1ZXN0aW9uSWQgPT09IHAucXVlc3Rpb25JZCAmJlxuICAgICAgbGlzdFtpXSEubG9jYWxUaW1lID09PSBwLmxvY2FsVGltZSxcbiAgKTtcbn1cblxuLy8gLS0tLS0tLS0tLSBFZHVjYXRpb24gXHU4OUUzXHU2NzkwL1x1NUU4Rlx1NTIxN1x1NTMxNiAtLS0tLS0tLS0tXG5cbmNvbnN0IEVEVUNBVElPTl9LRVlTID0gW1xuICBcImZvY3VzVGFza3NcIixcbiAgXCJwcm9qZWN0c1wiLFxuICBcInJlc291cmNlc1wiLFxuICBcInNlbWVzdGVyc1wiLFxuICBcInNlbWVzdGVySGlzdG9yeVwiLFxuICBcImxlc3NvbnNcIixcbiAgXCJhc3Nlc3NtZW50c1wiLFxuICBcInN1Ym1pc3Npb25zXCIsXG4gIFwiZ3JhZGVzXCIsXG4gIFwicmV2aWV3c1wiLFxuICBcImV2ZW50c1wiLFxuICBcImNvbXBsZXRlZFRhc2tzXCIsXG4gIFwicHJvZ3Jlc3NcIixcbiAgXCJjb3JyZWN0aW9uc1wiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRWR1Y2F0aW9uKHJhdzogdW5rbm93bik6IEVkdWNhdGlvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLkVEVUNBVElPTl9LRVlTXSwgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIik7XG4gIGNvbnN0IGUgPSBuZXcgRWR1Y2F0aW9uKCk7XG4gIGUuZm9jdXNUYXNrcyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcImZvY3VzVGFza3NcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PlxuICAgICAgYXNBcnJheSh2LCBcImZvY3VzVGFza3NcIikubWFwKCh4KSA9PiB7XG4gICAgICAgIGVuc3VyZShpc09iamVjdCh4KSwgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTUxNzNcdTgwNTRcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gICAgICAgIHJlamVjdFVua25vd24oeCwgW1widGFza0lkXCIsIFwic291cmNlSWRcIiwgXCJraW5kXCJdLCBcIlx1NjU1OVx1NUI2Nlx1NUY4NVx1NTI5RVx1NTE3M1x1ODA1NFwiKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0YXNrSWQ6IHJlcXVpcmVkRmllbGQoeCwgXCJ0YXNrSWRcIiwgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTUxNzNcdTgwNTRcIiwgYXNTdHIpLFxuICAgICAgICAgIHNvdXJjZUlkOiByZXF1aXJlZEZpZWxkKHgsIFwic291cmNlSWRcIiwgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTUxNzNcdTgwNTRcIiwgYXNTdHIpLFxuICAgICAgICAgIGtpbmQ6IG9uZU9mKFxuICAgICAgICAgICAgcmVxdWlyZWRGaWVsZCh4LCBcImtpbmRcIiwgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTUxNzNcdTgwNTRcIiwgKGspID0+IGspLFxuICAgICAgICAgICAgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUUga2luZFwiLFxuICAgICAgICAgICAgW1wibGVzc29uXCIsIFwiaG9tZXdvcmtcIl0sXG4gICAgICAgICAgKSBhcyBcImxlc3NvblwiIHwgXCJob21ld29ya1wiLFxuICAgICAgICB9O1xuICAgICAgfSksXG4gICAgW10sXG4gICk7XG4gIGUucHJvamVjdHMgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJwcm9qZWN0c1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJwcm9qZWN0c1wiKS5tYXAocGFyc2VQcm9qZWN0U3R1ZHkpLFxuICAgIFtdLFxuICApO1xuICBlLnJlc291cmNlcyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcInJlc291cmNlc1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJyZXNvdXJjZXNcIikubWFwKHBhcnNlUmVzb3VyY2UpLFxuICAgIFtdLFxuICApO1xuICBlLnNlbWVzdGVycyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcInNlbWVzdGVyc1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJzZW1lc3RlcnNcIikubWFwKHBhcnNlU2VtZXN0ZXIpLFxuICAgIFtdLFxuICApO1xuICBlLnNlbWVzdGVySGlzdG9yeSA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcInNlbWVzdGVySGlzdG9yeVwiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJzZW1lc3Rlckhpc3RvcnlcIikubWFwKHBhcnNlU2VtZXN0ZXIpLFxuICAgIFtdLFxuICApO1xuICBlLmxlc3NvbnMgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJsZXNzb25zXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT4gYXNBcnJheSh2LCBcImxlc3NvbnNcIikubWFwKHBhcnNlTGVzc29uKSxcbiAgICBbXSxcbiAgKTtcbiAgZS5hc3Nlc3NtZW50cyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcImFzc2Vzc21lbnRzXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT4gYXNBcnJheSh2LCBcImFzc2Vzc21lbnRzXCIpLm1hcChwYXJzZUFzc2Vzc21lbnQpLFxuICAgIFtdLFxuICApO1xuICBlLnN1Ym1pc3Npb25zID0gZmllbGQoXG4gICAgcmF3LFxuICAgIFwic3VibWlzc2lvbnNcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwic3VibWlzc2lvbnNcIikubWFwKHBhcnNlU3VibWlzc2lvbiksXG4gICAgW10sXG4gICk7XG4gIGUuZ3JhZGVzID0gZmllbGQoXG4gICAgcmF3LFxuICAgIFwiZ3JhZGVzXCIsXG4gICAgXCJcdTY1NTlcdTVCNjZcdTY1NzBcdTYzNkVcIixcbiAgICAodikgPT4gYXNBcnJheSh2LCBcImdyYWRlc1wiKS5tYXAocGFyc2VHcmFkZSksXG4gICAgW10sXG4gICk7XG4gIGUucmV2aWV3cyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcInJldmlld3NcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwicmV2aWV3c1wiKS5tYXAocGFyc2VSZXZpZXcpLFxuICAgIFtdLFxuICApO1xuICBlLmV2ZW50cyA9IGZpZWxkKFxuICAgIHJhdyxcbiAgICBcImV2ZW50c1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJldmVudHNcIikubWFwKHBhcnNlVGVhY2hpbmdFdmVudCksXG4gICAgW10sXG4gICk7XG4gIGUuY29tcGxldGVkVGFza3MgPSBmaWVsZChcbiAgICByYXcsXG4gICAgXCJjb21wbGV0ZWRUYXNrc1wiLFxuICAgIFwiXHU2NTU5XHU1QjY2XHU2NTcwXHU2MzZFXCIsXG4gICAgKHYpID0+IGFzQXJyYXkodiwgXCJjb21wbGV0ZWRUYXNrc1wiKS5tYXAocGFyc2VDb21wbGV0ZWRTdHVkeVRhc2spLFxuICAgIFtdLFxuICApO1xuICBlLnByb2dyZXNzID0gZmllbGQoXG4gICAgcmF3LFxuICAgIFwicHJvZ3Jlc3NcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwicHJvZ3Jlc3NcIikubWFwKHBhcnNlUHJvZ3Jlc3NSZWNvcmQpLFxuICAgIFtdLFxuICApO1xuICBlLmNvcnJlY3Rpb25zID0gZmllbGQoXG4gICAgcmF3LFxuICAgIFwiY29ycmVjdGlvbnNcIixcbiAgICBcIlx1NjU1OVx1NUI2Nlx1NjU3MFx1NjM2RVwiLFxuICAgICh2KSA9PiBhc0FycmF5KHYsIFwiY29ycmVjdGlvbnNcIikubWFwKHBhcnNlQ29ycmVjdGlvbiksXG4gICAgW10sXG4gICk7XG4gIHJldHVybiBlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplRWR1Y2F0aW9uKGU6IEVkdWNhdGlvbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgcmV0dXJuIHtcbiAgICBmb2N1c1Rhc2tzOiBlLmZvY3VzVGFza3MubWFwKCh0KSA9PiAoe1xuICAgICAgdGFza0lkOiB0LnRhc2tJZCxcbiAgICAgIHNvdXJjZUlkOiB0LnNvdXJjZUlkLFxuICAgICAga2luZDogdC5raW5kLFxuICAgIH0pKSxcbiAgICBwcm9qZWN0czogZS5wcm9qZWN0cy5tYXAoc2VyaWFsaXplUHJvamVjdFN0dWR5KSxcbiAgICByZXNvdXJjZXM6IGUucmVzb3VyY2VzLm1hcChzZXJpYWxpemVSZXNvdXJjZSksXG4gICAgc2VtZXN0ZXJzOiBlLnNlbWVzdGVycy5tYXAoc2VyaWFsaXplU2VtZXN0ZXIpLFxuICAgIHNlbWVzdGVySGlzdG9yeTogZS5zZW1lc3Rlckhpc3RvcnkubWFwKHNlcmlhbGl6ZVNlbWVzdGVyKSxcbiAgICBsZXNzb25zOiBlLmxlc3NvbnMubWFwKHNlcmlhbGl6ZUxlc3NvbiksXG4gICAgYXNzZXNzbWVudHM6IGUuYXNzZXNzbWVudHMubWFwKHNlcmlhbGl6ZUFzc2Vzc21lbnQpLFxuICAgIHN1Ym1pc3Npb25zOiBlLnN1Ym1pc3Npb25zLm1hcChzZXJpYWxpemVTdWJtaXNzaW9uKSxcbiAgICBncmFkZXM6IGUuZ3JhZGVzLm1hcChzZXJpYWxpemVHcmFkZSksXG4gICAgcmV2aWV3czogZS5yZXZpZXdzLm1hcChzZXJpYWxpemVSZXZpZXcpLFxuICAgIGV2ZW50czogZS5ldmVudHMubWFwKHNlcmlhbGl6ZVRlYWNoaW5nRXZlbnQpLFxuICAgIGNvbXBsZXRlZFRhc2tzOiBlLmNvbXBsZXRlZFRhc2tzLm1hcChzZXJpYWxpemVDb21wbGV0ZWRTdHVkeVRhc2spLFxuICAgIHByb2dyZXNzOiBlLnByb2dyZXNzLm1hcChzZXJpYWxpemVQcm9ncmVzc1JlY29yZCksXG4gICAgY29ycmVjdGlvbnM6IGUuY29ycmVjdGlvbnMubWFwKHNlcmlhbGl6ZUNvcnJlY3Rpb24pLFxuICB9O1xufVxuIiwgIi8vISBcdTY1NTlcdTVCNjZcdTYyNjdcdTg4NENcdUZGMUFcdThCRkVcdTdBMEIvXHU0RjVDXHU0RTFBXHU1MjMwXHU2NjZFXHU5MDFBXHU1Rjg1XHU1MjlFXHU3Njg0XHU0RTAwXHU1QkY5XHU0RTAwXHU2NzY1XHU2RTkwXHU1MTczXHU4MDU0XHUzMDAxXHU2NTM5XHU2NzFGXHU2NkY0XHU2NUIwXHUzMDAxXHU2NjBFXHU3ODZFXHU1M0MyXHU0RTBFXHUzMDAxXG4vLyEgXHU2M0QwXHU0RUE0XHU1QjhDXHU2MjEwXHU0RTBFXHU5MUNEXHU1OTBEXHU0RjVDXHU0RTFBXHU2MjkxXHU1MjM2XHVGRjFCXHU4QkExXHU1MjEyXHU1QkZDXHU1MUZBXHU2MzkyXHU5NjY0XHU1RTc2XHU0RkREXHU3NTU5XHU2NTU5XHU1QjY2XHU1Rjg1XHU1MjlFXHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy90ZWFjaGluZ190YXNrcy5yc1x1MzAwMlxuXG5pbXBvcnQgeyBBcHBFcnJvciwgZW5zdXJlIH0gZnJvbSBcIi4vZXJyb3JzXCI7XG5pbXBvcnQgeyBpZCB9IGZyb20gXCIuL2lkc1wiO1xuaW1wb3J0IHR5cGUgeyBBcHBEYXRhIH0gZnJvbSBcIi4vbGliXCI7XG5pbXBvcnQgdHlwZSB7IFRlYWNoaW5nVGFzaywgVGVhY2hpbmdUYXNrS2luZCB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBkYXRlQXQsIGhvdXJNaW51dGVTdHJpbmcgfSBmcm9tIFwiLi90aW1lXCI7XG5pbXBvcnQgeyByZWNvcmRTZXNzaW9uLCByZXNldFRvLCBzdGFydFRpbWVyIH0gZnJvbSBcIi4vcmVtaW5kZXJzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZWFjaGluZ1Rhc2soXG4gIGRhdGE6IEFwcERhdGEsXG4gIHRhc2tJZDogc3RyaW5nLFxuKTogVGVhY2hpbmdUYXNrIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGRhdGEuZWR1Y2F0aW9uLmZvY3VzVGFza3MuZmluZCgobGluaykgPT4gbGluay50YXNrSWQgPT09IHRhc2tJZCk7XG59XG5cbi8qKiBcdTY1NTlcdTVCNjZcdTY3NjVcdTZFOTBcdTYyRTVcdTY3MDlcdTVCODlcdTYzOTJcdUZGMUFcdThCRkVcdTdBMEIvXHU0RjVDXHU0RTFBXHU3NTFGXHU2MjEwXHU2MjE2XHU2NkY0XHU2NUIwXHU2NjZFXHU5MDFBXHU1Rjg1XHU1MjlFXHVGRjBDXHU2NTM5XHU2NzFGXHU2NTM5XHU1MTg1XHU1QkI5XHU5NjhGXHU2NzY1XHU2RTkwXHU4RDcwXHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gbWF0ZXJpYWxpemVUZWFjaGluZ1Rhc2tzKGRhdGE6IEFwcERhdGEsIGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgY29uc3QgZW5hYmxlZCA9IG5ldyBTZXQoXG4gICAgZGF0YS5lZHVjYXRpb24ucHJvamVjdHMuZmlsdGVyKChwKSA9PiBwLmV4YW1Nb2RlKS5tYXAoKHApID0+IHAucHJvamVjdElkKSxcbiAgKTtcbiAgY29uc3Qgc291cmNlczoge1xuICAgIGtpbmQ6IFRlYWNoaW5nVGFza0tpbmQ7XG4gICAgc291cmNlSWQ6IHN0cmluZztcbiAgICBwcm9qZWN0SWQ6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIG5vdGVzOiBzdHJpbmc7XG4gICAgc3RhcnRzQXQ6IG51bWJlcjtcbiAgICBtaW51dGVzOiBudW1iZXI7XG4gIH1bXSA9IFtdO1xuICBmb3IgKGNvbnN0IGxlc3NvbiBvZiBkYXRhLmVkdWNhdGlvbi5sZXNzb25zKSB7XG4gICAgaWYgKFxuICAgICAgZW5hYmxlZC5oYXMobGVzc29uLnByb2plY3RJZCkgJiZcbiAgICAgIGRhdGVBdChsZXNzb24uc3RhcnRzQXQpID49IGRhdGVBdChhdClcbiAgICApIHtcbiAgICAgIHNvdXJjZXMucHVzaCh7XG4gICAgICAgIGtpbmQ6IFwibGVzc29uXCIsXG4gICAgICAgIHNvdXJjZUlkOiBsZXNzb24uaWQsXG4gICAgICAgIHByb2plY3RJZDogbGVzc29uLnByb2plY3RJZCxcbiAgICAgICAgdGl0bGU6IGxlc3Nvbi50aXRsZSxcbiAgICAgICAgbm90ZXM6IGxlc3Nvbi50b3BpY3Muam9pbihcIlx1MzAwMVwiKSxcbiAgICAgICAgc3RhcnRzQXQ6IGxlc3Nvbi5zdGFydHNBdCxcbiAgICAgICAgbWludXRlczogNDUsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwYXBlciBvZiBkYXRhLmVkdWNhdGlvbi5hc3Nlc3NtZW50cykge1xuICAgIGlmIChwYXBlci5raW5kID09PSBcImhvbWV3b3JrXCIgJiYgZW5hYmxlZC5oYXMocGFwZXIucHJvamVjdElkKSkge1xuICAgICAgbGV0IG1pbnV0ZXMgPSAwO1xuICAgICAgZm9yIChjb25zdCBxIG9mIHBhcGVyLnF1ZXN0aW9ucykge1xuICAgICAgICBtaW51dGVzID0gTWF0aC5taW4oNDI5NDk2NzI5NSwgbWludXRlcyArIHEuZXN0aW1hdGVkTWludXRlcyk7XG4gICAgICB9XG4gICAgICBzb3VyY2VzLnB1c2goe1xuICAgICAgICBraW5kOiBcImhvbWV3b3JrXCIsXG4gICAgICAgIHNvdXJjZUlkOiBwYXBlci5pZCxcbiAgICAgICAgcHJvamVjdElkOiBwYXBlci5wcm9qZWN0SWQsXG4gICAgICAgIHRpdGxlOiBwYXBlci50aXRsZSxcbiAgICAgICAgbm90ZXM6IHBhcGVyLmluc3RydWN0aW9ucyxcbiAgICAgICAgc3RhcnRzQXQ6IHBhcGVyLnN0YXJ0c0F0LFxuICAgICAgICBtaW51dGVzOiBNYXRoLm1heCgxLCBtaW51dGVzKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCBsaW5rcyA9IG5ldyBNYXA8c3RyaW5nLCBUZWFjaGluZ1Rhc2s+KCk7XG4gIGZvciAoY29uc3QgbGluayBvZiBkYXRhLmVkdWNhdGlvbi5mb2N1c1Rhc2tzKSB7XG4gICAgbGlua3Muc2V0KGxpbmsuc291cmNlSWQsIGxpbmspO1xuICB9XG4gIGNvbnN0IHBvc2l0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gIGRhdGEudGFza3MuZm9yRWFjaCgodGFzaywgaSkgPT4gcG9zaXRpb25zLnNldCh0YXNrLmlkLCBpKSk7XG4gIGNvbnN0IHN1Ym1pc3Npb25zID0gbmV3IE1hcDxcbiAgICBzdHJpbmcsXG4gICAgeyBzdWJtaXR0ZWRBdDogbnVtYmVyOyB1bmZpbmlzaGVkOiBib29sZWFuIH1cbiAgPigpO1xuICBmb3IgKGNvbnN0IHN1Ym1pc3Npb24gb2YgZGF0YS5lZHVjYXRpb24uc3VibWlzc2lvbnMpIHtcbiAgICBjb25zdCBsYXN0ID0gc3VibWlzc2lvbnMuZ2V0KHN1Ym1pc3Npb24uYXNzZXNzbWVudElkKTtcbiAgICBpZiAobGFzdCA9PT0gdW5kZWZpbmVkIHx8IHN1Ym1pc3Npb24uc3VibWl0dGVkQXQgPj0gbGFzdC5zdWJtaXR0ZWRBdCkge1xuICAgICAgc3VibWlzc2lvbnMuc2V0KHN1Ym1pc3Npb24uYXNzZXNzbWVudElkLCB7XG4gICAgICAgIHN1Ym1pdHRlZEF0OiBzdWJtaXNzaW9uLnN1Ym1pdHRlZEF0LFxuICAgICAgICB1bmZpbmlzaGVkOiBzdWJtaXNzaW9uLnVuZmluaXNoZWQsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcbiAgZm9yIChjb25zdCB7XG4gICAga2luZCxcbiAgICBzb3VyY2VJZCxcbiAgICBwcm9qZWN0SWQsXG4gICAgdGl0bGUsXG4gICAgbm90ZXMsXG4gICAgc3RhcnRzQXQsXG4gICAgbWludXRlcyxcbiAgfSBvZiBzb3VyY2VzKSB7XG4gICAgY29uc3QgbGluayA9IGxpbmtzLmdldChzb3VyY2VJZCk7XG4gICAgY29uc3QgdGFza0lkID1cbiAgICAgIGxpbmsgIT09IHVuZGVmaW5lZCAmJiBsaW5rLmtpbmQgPT09IGtpbmQgPyBsaW5rLnRhc2tJZCA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBwb3NpdGlvbiA9IHRhc2tJZCAhPT0gdW5kZWZpbmVkID8gcG9zaXRpb25zLmdldCh0YXNrSWQpIDogdW5kZWZpbmVkO1xuICAgIGlmICh0YXNrSWQgIT09IHVuZGVmaW5lZCAmJiBwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZHVlRGF0ZSA9IGRhdGVBdChzdGFydHNBdCk7XG4gICAgY29uc3QgaXNMZXNzb24gPSBraW5kID09PSBcImxlc3NvblwiO1xuICAgIGNvbnN0IHJlbWluZGVyID0gaXNMZXNzb24gPyBob3VyTWludXRlU3RyaW5nKHN0YXJ0c0F0KSA6IG51bGw7XG4gICAgY29uc3QgZm9jdXMgPSBpc0xlc3NvbiA/IDQ1IDogTWF0aC5taW4obWludXRlcywgZGF0YS5zZXR0aW5ncy5mb2N1c01pbnV0ZXMpO1xuICAgIGNvbnN0IGVzdGltYXRlID0gTWF0aC5tYXgoMSwgTWF0aC5jZWlsKG1pbnV0ZXMgLyBmb2N1cykpO1xuICAgIGNvbnN0IHNjcmFwID0gaXNMZXNzb25cbiAgICAgID8gKCgpID0+IHtcbiAgICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoc3RhcnRzQXQgKiAxMDAwKTtcbiAgICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgMTQ0MCAtIGQuZ2V0SG91cnMoKSAqIDYwIC0gZC5nZXRNaW51dGVzKCkgLSA0NSk7XG4gICAgICAgIH0pKClcbiAgICAgIDogMDtcbiAgICBsZXQgaW5kZXg6IG51bWJlcjtcbiAgICBpZiAocG9zaXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgaW5kZXggPSBwb3NpdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGFza0lkTmV3ID0gaWQoKTtcbiAgICAgIGRhdGEuZWR1Y2F0aW9uLmZvY3VzVGFza3MucHVzaCh7IHRhc2tJZDogdGFza0lkTmV3LCBzb3VyY2VJZCwga2luZCB9KTtcbiAgICAgIGRhdGEudGFza3MucHVzaCh7XG4gICAgICAgIGlkOiB0YXNrSWROZXcsXG4gICAgICAgIHRlbXBsYXRlSWQ6IG51bGwsXG4gICAgICAgIHJlY3VycmluZzogZmFsc2UsXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBub3RlcyxcbiAgICAgICAgcHJvamVjdElkLFxuICAgICAgICBoYWJpdElkOiBudWxsLFxuICAgICAgICBkdWVEYXRlLFxuICAgICAgICByZW1pbmRlclRpbWU6IHJlbWluZGVyLFxuICAgICAgICBmb2N1c01pbnV0ZXM6IGZvY3VzLFxuICAgICAgICBzY3JhcE1pbnV0ZXM6IHNjcmFwLFxuICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgZXN0aW1hdGUsXG4gICAgICAgIHJlbWluZGVyRmlyZWQ6IGZhbHNlLFxuICAgICAgICByZW1pbmRlclBlbmRpbmc6IGZhbHNlLFxuICAgICAgICByZW1pbmRlckV4cGlyZWQ6IGZhbHNlLFxuICAgICAgICBjb21wbGV0ZWQ6IGZhbHNlLFxuICAgICAgICBjb21wbGV0ZWRBdDogbnVsbCxcbiAgICAgICAgY3JlYXRlZEF0OiBhdCxcbiAgICAgICAgdGFnczogW2lzTGVzc29uID8gXCJcdThCRkVcdTdBMEJcIiA6IFwiXHU0RjVDXHU0RTFBXCJdLFxuICAgICAgICBzdWJ0YXNrczogW10sXG4gICAgICB9KTtcbiAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgaW5kZXggPSBkYXRhLnRhc2tzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIGNvbnN0IHRhc2sgPSBkYXRhLnRhc2tzW2luZGV4XSE7XG4gICAgaWYgKFxuICAgICAgIXRhc2suY29tcGxldGVkICYmXG4gICAgICAodGFzay50aXRsZSAhPT0gdGl0bGUgfHxcbiAgICAgICAgdGFzay5ub3RlcyAhPT0gbm90ZXMgfHxcbiAgICAgICAgdGFzay5wcm9qZWN0SWQgIT09IHByb2plY3RJZCB8fFxuICAgICAgICB0YXNrLmR1ZURhdGUgIT09IGR1ZURhdGUgfHxcbiAgICAgICAgdGFzay5yZW1pbmRlclRpbWUgIT09IHJlbWluZGVyIHx8XG4gICAgICAgIHRhc2suZm9jdXNNaW51dGVzICE9PSBmb2N1cyB8fFxuICAgICAgICB0YXNrLmVzdGltYXRlICE9PSBlc3RpbWF0ZSB8fFxuICAgICAgICB0YXNrLnNjcmFwTWludXRlcyAhPT0gc2NyYXApXG4gICAgKSB7XG4gICAgICBpZiAodGFzay5kdWVEYXRlICE9PSBkdWVEYXRlIHx8IHRhc2sucmVtaW5kZXJUaW1lICE9PSByZW1pbmRlcikge1xuICAgICAgICB0YXNrLnJlbWluZGVyRmlyZWQgPSBmYWxzZTtcbiAgICAgICAgdGFzay5yZW1pbmRlclBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgdGFzay5yZW1pbmRlckV4cGlyZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRhc2sudGl0bGUgPSB0aXRsZTtcbiAgICAgIHRhc2subm90ZXMgPSBub3RlcztcbiAgICAgIHRhc2sucHJvamVjdElkID0gcHJvamVjdElkO1xuICAgICAgdGFzay5kdWVEYXRlID0gZHVlRGF0ZTtcbiAgICAgIHRhc2sucmVtaW5kZXJUaW1lID0gcmVtaW5kZXI7XG4gICAgICB0YXNrLmZvY3VzTWludXRlcyA9IGZvY3VzO1xuICAgICAgdGFzay5lc3RpbWF0ZSA9IGVzdGltYXRlO1xuICAgICAgdGFzay5zY3JhcE1pbnV0ZXMgPSBzY3JhcDtcbiAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoa2luZCA9PT0gXCJob21ld29ya1wiKSB7XG4gICAgICBjb25zdCBzdWJtaXR0ZWQgPSAoKCkgPT4ge1xuICAgICAgICBjb25zdCBsYXN0ID0gc3VibWlzc2lvbnMuZ2V0KHNvdXJjZUlkKTtcbiAgICAgICAgaWYgKGxhc3QgPT09IHVuZGVmaW5lZCB8fCBsYXN0LnVuZmluaXNoZWQpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gbGFzdC5zdWJtaXR0ZWRBdDtcbiAgICAgIH0pKCk7XG4gICAgICBpZiAoXG4gICAgICAgIHRhc2suY29tcGxldGVkICE9PSAoc3VibWl0dGVkICE9PSBudWxsKSB8fFxuICAgICAgICB0YXNrLmNvbXBsZXRlZEF0ICE9PSBzdWJtaXR0ZWRcbiAgICAgICkge1xuICAgICAgICBpZiAoc3VibWl0dGVkICE9PSBudWxsICYmIGRhdGEudGltZXIudGFza0lkID09PSB0YXNrLmlkKSB7XG4gICAgICAgICAgcmVjb3JkU2Vzc2lvbihkYXRhLCBhdCwgZmFsc2UpO1xuICAgICAgICAgIGRhdGEudGltZXIudGFza0lkID0gbnVsbDtcbiAgICAgICAgICByZXNldFRvKGRhdGEsIFwiZm9jdXNcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGFzay5jb21wbGV0ZWQgPSBzdWJtaXR0ZWQgIT09IG51bGw7XG4gICAgICAgIHRhc2suY29tcGxldGVkQXQgPSBzdWJtaXR0ZWQ7XG4gICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gY2hhbmdlZDtcbn1cblxuLyoqIFx1NjYwRVx1Nzg2RVx1NUI4Q1x1NjIxMFx1OEJGRVx1N0EwQlx1NUY4NVx1NTI5RSA9IFx1NTNDMlx1NEUwRVx1OEJGRVx1N0EwQlx1RkYxQlx1NEY1Q1x1NEUxQVx1NTNFQVx1ODBGRFx1NEVDRVx1NEY1Q1x1NEUxQVx1NTE2NVx1NTNFM1x1NjNEMFx1NEVBNFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBsZXRlVGVhY2hpbmdUYXNrKFxuICBkYXRhOiBBcHBEYXRhLFxuICB0YXNrSWQ6IHN0cmluZyxcbiAgYXQ6IG51bWJlcixcbik6IHZvaWQge1xuICBjb25zdCBsaW5rID0gdGVhY2hpbmdUYXNrKGRhdGEsIHRhc2tJZCk7XG4gIGlmIChsaW5rID09PSB1bmRlZmluZWQpIHJldHVybjtcbiAgaWYgKGxpbmsua2luZCA9PT0gXCJob21ld29ya1wiKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkY3XHU0RUNFXHU0RjVDXHU0RTFBXHU1MTY1XHU1M0UzXHU2M0QwXHU0RUE0XHU3QjU0XHU1Mzc3XHVGRjBDXHU2M0QwXHU0RUE0XHU1QjhDXHU2MjEwXHU1NDBFXHU0RjFBXHU4MUVBXHU1MkE4XHU1QjhDXHU2MjEwXHU1Rjg1XHU1MjlFXCIpO1xuICB9XG4gIGNvbnN0IGxlc3NvbiA9IGRhdGEuZWR1Y2F0aW9uLmxlc3NvbnMuZmluZCgobCkgPT4gbC5pZCA9PT0gbGluay5zb3VyY2VJZCk7XG4gIGVuc3VyZShsZXNzb24gIT09IHVuZGVmaW5lZCwgXCJcdThCRkVcdTdBMEJcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gIGxlc3Nvbi5hdHRlbmRlZCA9IHRydWU7XG4gIGlmIChsZXNzb24ucHJvZ3Jlc3MudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgIGxlc3Nvbi5wcm9ncmVzcyA9XG4gICAgICBcIlx1NjcyQ1x1NEVCQVx1NEVDRVx1NEVDQVx1NjVFNVx1NEUxM1x1NkNFOFx1Nzg2RVx1OEJBNFx1OEJGRVx1N0EwQlx1NEVGQlx1NTJBMVx1NUI4Q1x1NjIxMFx1RkYwQ1x1NTE3N1x1NEY1M1x1NUI2Nlx1NEU2MFx1NEY0RFx1N0Y2RVx1NUY4NVx1ODg2NVx1NTE0NVx1RkYxQlx1NjM4Q1x1NjNFMVx1NjBDNVx1NTFCNVx1NUY4NVx1NTkwRFx1NkQ0QlwiO1xuICB9XG4gIGlmIChhdCA+PSBsZXNzb24uZW5kc0F0KSB7XG4gICAgbGVzc29uLnN0YXRlID0gXCJlbmRlZFwiO1xuICAgIGlmIChsZXNzb24uYWlFbmFibGVkKSB7XG4gICAgICBkYXRhLmVkdWNhdGlvbi5ldmVudChsZXNzb24ucHJvamVjdElkLCBcImhvbWV3b3JrXCIsIGxlc3Nvbi5pZCwgYXQpO1xuICAgIH1cbiAgfVxufVxuXG4vKiogXHU4MUVBXHU1MkE4XHU4QkExXHU2NUY2XHU0RTBEXHU3ODZFXHU4QkE0XHU4QkZFXHU3QTBCXHU1M0MyXHU0RTBFXHVGRjFBXHU1M0VBXHU2NzA5XHU2NjBFXHU3ODZFXHU1RjAwXHU1OUNCL1x1NUI4Q1x1NjIxMFx1NjI0RFx1N0I5N1x1NTNDMlx1NEUwRVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0VGVhY2hpbmdUYXNrKGRhdGE6IEFwcERhdGEsIGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgaWYgKGRhdGEudGltZXIubW9kZSAhPT0gXCJmb2N1c1wiKSByZXR1cm47XG4gIGNvbnN0IGxpbmsgPVxuICAgIGRhdGEudGltZXIudGFza0lkICE9PSBudWxsXG4gICAgICA/IHRlYWNoaW5nVGFzayhkYXRhLCBkYXRhLnRpbWVyLnRhc2tJZClcbiAgICAgIDogdW5kZWZpbmVkO1xuICBpZiAobGluayA9PT0gdW5kZWZpbmVkIHx8IGxpbmsua2luZCAhPT0gXCJsZXNzb25cIikgcmV0dXJuO1xuICBjb25zdCBsZXNzb24gPSBkYXRhLmVkdWNhdGlvbi5sZXNzb25zLmZpbmQoKGwpID0+IGwuaWQgPT09IGxpbmsuc291cmNlSWQpO1xuICBpZiAobGVzc29uICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoYXQgPj0gbGVzc29uLnN0YXJ0c0F0ICYmIGF0IDwgbGVzc29uLmVuZHNBdCkge1xuICAgICAgbGVzc29uLmF0dGVuZGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIFx1Njc2NVx1NkU5MFx1NTE3M1x1ODA1NFx1NEUwMFx1NUJGOVx1NEUwMFx1MzAwMVx1NTQwQ1x1OTg3OVx1NzZFRVx1MzAwMVx1NUI5RVx1NEY4Qlx1NEUzQVx1NTUyRlx1NEUwMFx1NjY2RVx1OTAxQVx1NEVGQlx1NTJBMVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlVGVhY2hpbmdUYXNrcyhkYXRhOiBBcHBEYXRhKTogdm9pZCB7XG4gIGNvbnN0IHRhc2tzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IHNvdXJjZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBsaW5rIG9mIGRhdGEuZWR1Y2F0aW9uLmZvY3VzVGFza3MpIHtcbiAgICBjb25zdCB0YXNrID0gZGF0YS50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSBsaW5rLnRhc2tJZCk7XG4gICAgZW5zdXJlKHRhc2sgIT09IHVuZGVmaW5lZCwgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTUxNzNcdTgwNTRcdTc2ODRcdTRFRkJcdTUyQTFcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgY29uc3QgcHJvamVjdCA9ICgoKSA9PiB7XG4gICAgICBpZiAobGluay5raW5kID09PSBcImxlc3NvblwiKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgZGF0YS5lZHVjYXRpb24ubGVzc29ucy5maW5kKChsKSA9PiBsLmlkID09PSBsaW5rLnNvdXJjZUlkKVxuICAgICAgICAgICAgPy5wcm9qZWN0SWQgPz8gbnVsbFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgZGF0YS5lZHVjYXRpb24uYXNzZXNzbWVudHMuZmluZChcbiAgICAgICAgICAoYSkgPT4gYS5pZCA9PT0gbGluay5zb3VyY2VJZCAmJiBhLmtpbmQgPT09IFwiaG9tZXdvcmtcIixcbiAgICAgICAgKT8ucHJvamVjdElkID8/IG51bGxcbiAgICAgICk7XG4gICAgfSkoKTtcbiAgICBlbnN1cmUocHJvamVjdCAhPT0gbnVsbCwgXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTY3NjVcdTZFOTBcdTRFMERcdTVCNThcdTU3MjhcdTYyMTZcdTdDN0JcdTU3OEJcdTRFMERcdTdCMjZcIik7XG4gICAgaWYgKFxuICAgICAgdGFzay5wcm9qZWN0SWQgIT09IHByb2plY3QgfHxcbiAgICAgIHRhc2tzLmhhcyhsaW5rLnRhc2tJZCkgfHxcbiAgICAgIHNvdXJjZXMuaGFzKGxpbmsuc291cmNlSWQpIHx8XG4gICAgICB0YXNrLnRlbXBsYXRlSWQgIT09IG51bGwgfHxcbiAgICAgIHRhc2suaGFiaXRJZCAhPT0gbnVsbCB8fFxuICAgICAgdGFzay5yZWN1cnJpbmdcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjU1OVx1NUI2Nlx1Njc2NVx1NkU5MFx1NUZDNVx1OTg3Qlx1NTE3M1x1ODA1NFx1NTQwQ1x1OTg3OVx1NzZFRVx1NzY4NFx1NTUyRlx1NEUwMFx1NjY2RVx1OTAxQVx1NEVGQlx1NTJBMVwiKTtcbiAgICB9XG4gICAgdGFza3MuYWRkKGxpbmsudGFza0lkKTtcbiAgICBzb3VyY2VzLmFkZChsaW5rLnNvdXJjZUlkKTtcbiAgfVxufVxuIiwgIi8vISBcdTVCOUVcdTRGNTNcdThFQUJcdTRFRkRcdUZGMUFcdTUyMjBcdTk2NjRcdTU0MEVcdTRFQ0RcdTRGRERcdTc1NTlcdTc2N0JcdThCQjBcdUZGMUJcdTY0QTRcdTk1MDBcdTYwNjJcdTU5MERcdTU0MENcdTRFMDBcdTRFRkJcdTUyQTFcdUZGMUJcdThERThcdTdDN0JcdTU3OEJcdTU1MkZcdTRFMDBcdTMwMDJcbi8vISBcdTVCRjlcdTVFOTQgY3JhdGVzL2NvcmUvc3JjL2lkZW50aXRpZXMucnNcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IsIGVuc3VyZSwgdXRmOExlbiB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHtcbiAgYXNPcHQsXG4gIGFzU3RyLFxuICBmaWVsZCxcbiAgaXNPYmplY3QsXG4gIHJlamVjdFVua25vd24sXG4gIHJlcXVpcmVkRmllbGQsXG59IGZyb20gXCIuL2pzb25cIjtcbmltcG9ydCB0eXBlIHsgQXBwRGF0YSB9IGZyb20gXCIuL2xpYlwiO1xuaW1wb3J0IHR5cGUgeyBJZGVudGl0eSB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBwYXJzZVRhc2ssIHNlcmlhbGl6ZVRhc2sgfSBmcm9tIFwiLi9saWJcIjtcblxuY29uc3QgSURFTlRJVFlfS0VZUyA9IFtcImlkXCIsIFwia2luZFwiLCBcInJldGlyZWRcIiwgXCJyZXN0b3JlVGFza1wiXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSWRlbnRpdHkocmF3OiB1bmtub3duKTogSWRlbnRpdHkge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIklEIFx1NzY3Qlx1OEJCMFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5JREVOVElUWV9LRVlTXSwgXCJJRCBcdTc2N0JcdThCQjBcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiSUQgXHU3NjdCXHU4QkIwXCIsIGFzU3RyKSxcbiAgICBraW5kOiByZXF1aXJlZEZpZWxkKHJhdywgXCJraW5kXCIsIFwiSUQgXHU3NjdCXHU4QkIwXCIsIGFzU3RyKSxcbiAgICByZXRpcmVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJyZXRpcmVkXCIsIFwiSUQgXHU3NjdCXHU4QkIwXCIsICh2KSA9PiB7XG4gICAgICBpZiAodHlwZW9mIHYgIT09IFwiYm9vbGVhblwiKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJyZXRpcmVkIFx1NUZDNVx1OTg3Qlx1NjYyRlx1NUUwM1x1NUMxNFx1NTAzQ1wiKTtcbiAgICAgIHJldHVybiB2O1xuICAgIH0pLFxuICAgIHJlc3RvcmVUYXNrOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicmVzdG9yZVRhc2tcIixcbiAgICAgIFwiSUQgXHU3NjdCXHU4QkIwXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJyZXN0b3JlVGFza1wiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUlkZW50aXR5KGk6IElkZW50aXR5KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiBpLmlkLFxuICAgIGtpbmQ6IGkua2luZCxcbiAgICByZXRpcmVkOiBpLnJldGlyZWQsXG4gICAgcmVzdG9yZVRhc2s6IGkucmVzdG9yZVRhc2ssXG4gIH07XG59XG5cbi8qKiBcdTVGNTNcdTUyNERcdTZEM0JcdThEQzNcdTVCOUVcdTRGNTMgSUQgXHUyMTkyIFx1N0M3Qlx1NTc4Qlx1MzAwMiAqL1xuZnVuY3Rpb24gYWN0aXZlSWRlbnRpdGllcyhkYXRhOiBBcHBEYXRhKTogTWFwPHN0cmluZywgc3RyaW5nPiB7XG4gIGNvbnN0IGlkcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGNvbnN0IGFkZCA9IChpZDogc3RyaW5nLCBraW5kOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICBpZiAoaWQudHJpbSgpLmxlbmd0aCA9PT0gMCB8fCB1dGY4TGVuKGlkKSA+IDIwMCB8fCBpZHMuaGFzKGlkKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU3MkVDXHU3QUNCXHU1QjlFXHU0RjUzIElEIFx1NEUzQVx1N0E3QVx1MzAwMVx1OEZDN1x1OTU3Rlx1NjIxNlx1OTFDRFx1NTkwRFwiKTtcbiAgICB9XG4gICAgaWRzLnNldChpZCwga2luZCk7XG4gIH07XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLnByb2plY3RzKSBhZGQoeC5pZCwgXCJwcm9qZWN0XCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5oYWJpdHMpIGFkZCh4LmlkLCBcImhhYml0XCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS52aXNpb25zKSBhZGQoeC5pZCwgXCJ2aXNpb25cIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmJsb2NrcykgYWRkKHguaWQsIFwiYmxvY2tcIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLnRhc2tzKSBhZGQoeC5pZCwgXCJ0YXNrXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS50ZW1wbGF0ZXMpIGFkZCh4LmlkLCBcInRlbXBsYXRlXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5zZXNzaW9ucykgYWRkKHguaWQsIFwic2Vzc2lvblwiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEuZWR1Y2F0aW9uLnJlc291cmNlcykgYWRkKHguaWQsIFwicmVzb3VyY2VcIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmVkdWNhdGlvbi5zZW1lc3RlcnMpIGFkZCh4LmlkLCBcInNlbWVzdGVyXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5lZHVjYXRpb24ubGVzc29ucykgYWRkKHguaWQsIFwibGVzc29uXCIpO1xuICBmb3IgKGNvbnN0IHggb2YgZGF0YS5lZHVjYXRpb24uYXNzZXNzbWVudHMpIGFkZCh4LmlkLCBcImFzc2Vzc21lbnRcIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmVkdWNhdGlvbi5zdWJtaXNzaW9ucykgYWRkKHguaWQsIFwic3VibWlzc2lvblwiKTtcbiAgZm9yIChjb25zdCB4IG9mIGRhdGEuZWR1Y2F0aW9uLmdyYWRlcykgYWRkKHguaWQsIFwiZ3JhZGVcIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmVkdWNhdGlvbi5yZXZpZXdzKSBhZGQoeC5pZCwgXCJyZXZpZXdcIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmVkdWNhdGlvbi5wcm9ncmVzcykgYWRkKHguaWQsIFwicHJvZ3Jlc3NcIik7XG4gIGZvciAoY29uc3QgeCBvZiBkYXRhLmVkdWNhdGlvbi5jb3JyZWN0aW9ucykgYWRkKHguaWQsIFwiY29ycmVjdGlvblwiKTtcbiAgcmV0dXJuIGlkcztcbn1cblxuY29uc3QgQUxMT1dFRF9LSU5EUyA9IFtcbiAgXCJwcm9qZWN0XCIsXG4gIFwiaGFiaXRcIixcbiAgXCJ2aXNpb25cIixcbiAgXCJ0YXNrXCIsXG4gIFwidGVtcGxhdGVcIixcbiAgXCJzZXNzaW9uXCIsXG4gIFwiYmxvY2tcIixcbiAgXCJyZXNvdXJjZVwiLFxuICBcInNlbWVzdGVyXCIsXG4gIFwibGVzc29uXCIsXG4gIFwiYXNzZXNzbWVudFwiLFxuICBcInN1Ym1pc3Npb25cIixcbiAgXCJncmFkZVwiLFxuICBcInJldmlld1wiLFxuICBcInByb2dyZXNzXCIsXG4gIFwiY29ycmVjdGlvblwiLFxuXTtcblxuLyoqXG4gKiBcdTYzRDBcdTRFQTRcdTUyNERcdTY4MzhcdTVCRjlcdThFQUJcdTRFRkRcdTUzODZcdTUzRjJcdUZGMUFcdTUyMjBcdTk2NjRcdTc2ODQgSUQgXHU2QzM4XHU0RTQ1XHU0RkREXHU3NTU5XHVGRjBDXHU2MDYyXHU1OTBEXHU1M0VBXHU4MEZEXHU2MDYyXHU1OTBEXHU3NjdCXHU4QkIwXHU0RTJEXHU3Njg0XHU1MzlGXHU0RUZCXHU1MkExXHUzMDAyXG4gKiBgcmVzdG9yZV9pZGAgXHU2NjJGXHU2NzJDXHU2QjIxXHU1MkE4XHU0RjVDXHU5MUNDXHU2QjYzXHU1NzI4XHU2MDYyXHU1OTBEXHU3Njg0XHU0RUZCXHU1MkExIElEXHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWNvbmNpbGVJZGVudGl0aWVzKFxuICBiZWZvcmU6IEFwcERhdGEsXG4gIGFmdGVyOiBBcHBEYXRhLFxuICByZXN0b3JlSWQ6IHN0cmluZyB8IG51bGwsXG4pOiB2b2lkIHtcbiAgY29uc3Qgb2xkQWN0aXZlID0gYWN0aXZlSWRlbnRpdGllcyhiZWZvcmUpO1xuICBjb25zdCBuZXdBY3RpdmUgPSBhY3RpdmVJZGVudGl0aWVzKGFmdGVyKTtcbiAgY29uc3QgZW50cmllcyA9IG5ldyBNYXA8c3RyaW5nLCBJZGVudGl0eT4oKTtcbiAgZm9yIChjb25zdCByZWNvcmQgb2YgWy4uLmJlZm9yZS5pZGVudGl0aWVzLCAuLi5hZnRlci5pZGVudGl0aWVzXSkge1xuICAgIGNvbnN0IG9sZCA9IGVudHJpZXMuZ2V0KHJlY29yZC5pZCk7XG4gICAgaWYgKG9sZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAob2xkLmtpbmQgIT09IHJlY29yZC5raW5kKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NTM4Nlx1NTNGMiBJRCBcdTRFMERcdTgwRkRcdThGNkNcdTc1MjhcdTRFOEVcdTUzRTZcdTRFMDBcdTc5Q0RcdTVCOUVcdTRGNTNcIik7XG4gICAgICB9XG4gICAgICBvbGQucmV0aXJlZCA9IG9sZC5yZXRpcmVkIHx8IHJlY29yZC5yZXRpcmVkO1xuICAgICAgaWYgKG9sZC5yZXN0b3JlVGFzayA9PT0gbnVsbCkge1xuICAgICAgICBvbGQucmVzdG9yZVRhc2sgPSByZWNvcmQucmVzdG9yZVRhc2s7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJpZXMuc2V0KHJlY29yZC5pZCwgeyAuLi5yZWNvcmQsIHJlc3RvcmVUYXNrOiByZWNvcmQucmVzdG9yZVRhc2sgfSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgW2lkLCBraW5kXSBvZiBvbGRBY3RpdmUpIHtcbiAgICBpZiAoIWVudHJpZXMuaGFzKGlkKSkge1xuICAgICAgZW50cmllcy5zZXQoaWQsIHsgaWQsIGtpbmQsIHJldGlyZWQ6IGZhbHNlLCByZXN0b3JlVGFzazogbnVsbCB9KTtcbiAgICB9XG4gIH1cbiAgLy8gXHU1REYyXHU1MjIwXHU5NjY0XHU0RUZCXHU1MkExXHU1M0VBXHU4MEZEXHU5MDFBXHU4RkM3XHU1Mzg2XHU1M0YyXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XHU1M0VGXHU4OUMxXHUzMDAyXG4gIGNvbnN0IHZpc2l0ID0gKHNvdXJjZTogQXBwRGF0YSwgbGl2ZTogTWFwPHN0cmluZywgc3RyaW5nPik6IHZvaWQgPT4ge1xuICAgIGZvciAoY29uc3Qgc2Vzc2lvbiBvZiBzb3VyY2Uuc2Vzc2lvbnMpIHtcbiAgICAgIGNvbnN0IHRhc2tJZCA9IHNlc3Npb24udGFza0lkO1xuICAgICAgaWYgKHRhc2tJZCA9PT0gbnVsbCkgY29udGludWU7XG4gICAgICBjb25zdCByZWNvcmQgPSBlbnRyaWVzLmdldCh0YXNrSWQpO1xuICAgICAgaWYgKHJlY29yZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChyZWNvcmQua2luZCAhPT0gXCJ0YXNrXCIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTUzODZcdTUzRjJcdTRFRkJcdTUyQTFcdTVGMTVcdTc1MjhcdTc2ODQgSUQgXHU0RTBFXHU1MTc2XHU0RUQ2XHU1QjlFXHU0RjUzXHU1MUIyXHU3QTgxXCIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyaWVzLnNldCh0YXNrSWQsIHtcbiAgICAgICAgICBpZDogdGFza0lkLFxuICAgICAgICAgIGtpbmQ6IFwidGFza1wiLFxuICAgICAgICAgIHJldGlyZWQ6ICFsaXZlLmhhcyh0YXNrSWQpLFxuICAgICAgICAgIHJlc3RvcmVUYXNrOiBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIHZpc2l0KGJlZm9yZSwgb2xkQWN0aXZlKTtcbiAgdmlzaXQoYWZ0ZXIsIG5ld0FjdGl2ZSk7XG4gIGZvciAoY29uc3QgW2lkLCBraW5kXSBvZiBuZXdBY3RpdmUpIHtcbiAgICBjb25zdCByZWNvcmQgPSBlbnRyaWVzLmdldChpZCk7XG4gICAgaWYgKHJlY29yZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAocmVjb3JkLmtpbmQgIT09IGtpbmQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1Mzg2XHU1M0YyIElEIFx1NEUwRFx1ODBGRFx1ODhBQlx1NTE3Nlx1NEVENlx1NUI5RVx1NEY1M1x1NTkwRFx1NzUyOFwiKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZWNvcmQucmV0aXJlZCkge1xuICAgICAgICBjb25zdCBzYW1lVGFzayA9IHJlc3RvcmVJZCA9PT0gaWQgJiYga2luZCA9PT0gXCJ0YXNrXCI7XG4gICAgICAgIGlmICghc2FtZVRhc2spIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgICBcIlx1NTM4Nlx1NTNGMiBJRCBcdTVERjJcdTg4QUJcdTZDMzhcdTRFNDVcdTRGRERcdTc1NTlcdUZGMENcdTRFMERcdTgwRkRcdTc1MjhcdTRFOEVcdTY1QjBcdTVFRkFcdTYyMTZcdTVCRkNcdTUxNjVcdTUxNzZcdTRFRDZcdTVCOUVcdTRGNTNcIixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJlY29yZC5yZXRpcmVkID0gZmFsc2U7XG4gICAgICAgIHJlY29yZC5yZXN0b3JlVGFzayA9IG51bGw7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJpZXMuc2V0KGlkLCB7IGlkLCBraW5kLCByZXRpcmVkOiBmYWxzZSwgcmVzdG9yZVRhc2s6IG51bGwgfSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIGVudHJpZXMudmFsdWVzKCkpIHtcbiAgICBpZiAoIW5ld0FjdGl2ZS5oYXMocmVjb3JkLmlkKSkge1xuICAgICAgcmVjb3JkLnJldGlyZWQgPSB0cnVlO1xuICAgICAgaWYgKHJlY29yZC5raW5kID09PSBcInRhc2tcIikge1xuICAgICAgICBjb25zdCB0YXNrID0gYmVmb3JlLnRhc2tzLmZpbmQoKHQpID0+IHQuaWQgPT09IHJlY29yZC5pZCk7XG4gICAgICAgIGlmICh0YXNrICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZWNvcmQucmVzdG9yZVRhc2sgPSBKU09OLnN0cmluZ2lmeShzZXJpYWxpemVUYXNrKHRhc2spKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjb25zdCByZWNvcmRzID0gWy4uLmVudHJpZXMudmFsdWVzKCldLnNvcnQoKGEsIGIpID0+XG4gICAgYS5pZCA8IGIuaWQgPyAtMSA6IGEuaWQgPiBiLmlkID8gMSA6IDAsXG4gICk7XG4gIGFmdGVyLmlkZW50aXRpZXMgPSByZWNvcmRzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVJZGVudGl0aWVzKGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgY29uc3QgY3VycmVudCA9IGFjdGl2ZUlkZW50aXRpZXMoZGF0YSk7XG4gIGNvbnN0IHNlZW4gPSBuZXcgTWFwPHN0cmluZywgdHJ1ZT4oKTtcbiAgaWYgKGRhdGEuaWRlbnRpdGllcy5sZW5ndGggPiAxMDAwMDAwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiSUQgXHU1Mzg2XHU1M0YyXHU2NTcwXHU5MUNGXHU4RDg1XHU1MUZBXHU5NjUwXHU1MjM2XCIpO1xuICB9XG4gIGZvciAoY29uc3QgcmVjb3JkIG9mIGRhdGEuaWRlbnRpdGllcykge1xuICAgIGlmIChcbiAgICAgIHJlY29yZC5pZC50cmltKCkubGVuZ3RoID09PSAwIHx8XG4gICAgICB1dGY4TGVuKHJlY29yZC5pZCkgPiAyMDAgfHxcbiAgICAgIHNlZW4uaGFzKHJlY29yZC5pZCkgfHxcbiAgICAgICFBTExPV0VEX0tJTkRTLmluY2x1ZGVzKHJlY29yZC5raW5kKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2NUUwXHU2NTQ4XHU3Njg0IElEIFx1NTM4Nlx1NTNGMlx1NzY3Qlx1OEJCMFwiKTtcbiAgICB9XG4gICAgc2Vlbi5zZXQocmVjb3JkLmlkLCB0cnVlKTtcbiAgICAvLyBcdTkwMDBcdTRGMTFcdTcyQjZcdTYwMDFcdTc1MzEgcmVjb25jaWxlIFx1NjhDMFx1NjdFNVx1RkYwQ1x1NTE0MVx1OEJCOFx1NURGMlx1OUE4Q1x1OEJDMVx1NzY4NFx1NjRBNFx1OTUwMFx1NTAxOVx1OTAwOVx1NUI1OFx1NTcyOFx1MzAwMlxuICAgIGlmIChjdXJyZW50LmhhcyhyZWNvcmQuaWQpICYmIGN1cnJlbnQuZ2V0KHJlY29yZC5pZCkgIT09IHJlY29yZC5raW5kKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTUzODZcdTUzRjIgSUQgXHU3QzdCXHU1NzhCXHU1MUIyXHU3QTgxXCIpO1xuICAgIH1cbiAgICBpZiAocmVjb3JkLnJlc3RvcmVUYXNrICE9PSBudWxsKSB7XG4gICAgICBsZXQgdGFzaztcbiAgICAgIHRyeSB7XG4gICAgICAgIHRhc2sgPSBwYXJzZVRhc2soSlNPTi5wYXJzZShyZWNvcmQucmVzdG9yZVRhc2spKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTRFRkJcdTUyQTFcdTYwNjJcdTU5MERcdThCQjBcdTVGNTVcIik7XG4gICAgICB9XG4gICAgICBpZiAocmVjb3JkLmtpbmQgIT09IFwidGFza1wiIHx8IHRhc2suaWQgIT09IHJlY29yZC5pZCB8fCAhcmVjb3JkLnJldGlyZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RUZCXHU1MkExXHU2MDYyXHU1OTBEXHU4QkIwXHU1RjU1XHU0RTBFIElEIFx1NzY3Qlx1OEJCMFx1NEUwRFx1NEUwMFx1ODFGNFwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsICIvLyEgXHU1QjY2XHU0RTYwXHU4QkExXHU1MjEyIHY2XHVGRjFBXHU0RkJGXHU2NDNBXHU4QkExXHU1MjEyXHU1MjNCXHU2MTBGXHU0RTBEXHU1NDJCXHU2MjY3XHU4ODRDXHU1Mzg2XHU1M0YyXHU0RTBFXHU2NzJDXHU2NzNBXHU1MDRGXHU1OTdEXHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9wbGFuLnJzXHUzMDAyXG5cbmltcG9ydCB7IEFwcEVycm9yLCBjbG9uZSwgZW5zdXJlIH0gZnJvbSBcIi4vZXJyb3JzXCI7XG5pbXBvcnQge1xuICBhc0FycmF5LFxuICBhc0Jvb2wsXG4gIGFzSW50LFxuICBhc09wdCxcbiAgYXNTdHIsXG4gIGZpZWxkLFxuICBpc09iamVjdCxcbiAgb25lT2YsXG4gIHJlamVjdFVua25vd24sXG4gIHJlcXVpcmVkRmllbGQsXG59IGZyb20gXCIuL2pzb25cIjtcbmltcG9ydCB7IEFwcERhdGEgfSBmcm9tIFwiLi9saWJcIjtcbmltcG9ydCB0eXBlIHtcbiAgUGxhbkZpbGUsXG4gIFBsYW5Qcm9qZWN0LFxuICBQbGFuU3VidGFzayxcbiAgUGxhblRhc2ssXG4gIFJlcGVhdCxcbiAgVGFzayxcbiAgVGVtcGxhdGUsXG59IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQge1xuICBkZWxldGVUZW1wbGF0ZSxcbiAgcGFyc2VQcmludFJlY29yZCxcbiAgcGFyc2VUZW1wbGF0ZSxcbiAgcmVwbGFjZUFwcERhdGEsXG4gIHNlcmlhbGl6ZVByaW50UmVjb3JkLFxuICBzZXJpYWxpemVUZW1wbGF0ZSxcbn0gZnJvbSBcIi4vdGVtcGxhdGVzXCI7XG5pbXBvcnQgeyBwYXJzZUJsb2NrLCBzZXJpYWxpemVCbG9jayB9IGZyb20gXCIuL2Jsb2Nrc1wiO1xuaW1wb3J0IHsgcGFyc2VIYWJpdCwgc2VyaWFsaXplSGFiaXQgfSBmcm9tIFwiLi9oYWJpdHNcIjtcblxuY29uc3QgUExBTl9GSUxFX0tFWVMgPSBbXG4gIFwiZm9ybWF0XCIsXG4gIFwidmVyc2lvblwiLFxuICBcInBvbW9kb3JvTWludXRlc1wiLFxuICBcInByb2plY3RzXCIsXG4gIFwidGFza3NcIixcbiAgXCJibG9ja3NcIixcbiAgXCJ0ZW1wbGF0ZXNcIixcbiAgXCJwcmludHNcIixcbiAgXCJoYWJpdHNcIixcbiAgXCJyZXBsYWNlXCIsXG5dIGFzIGNvbnN0O1xuY29uc3QgUExBTl9QUk9KRUNUX0tFWVMgPSBbXCJpZFwiLCBcIm5hbWVcIiwgXCJjb2xvclwiLCBcImFwcFdoaXRlbGlzdFwiXSBhcyBjb25zdDtcbmNvbnN0IFBMQU5fVEFTS19LRVlTID0gW1xuICBcImlkXCIsXG4gIFwidGl0bGVcIixcbiAgXCJ0ZW1wbGF0ZUlkXCIsXG4gIFwiaGFiaXRJZFwiLFxuICBcInJlY3VycmluZ1wiLFxuICBcInNjcmFwTWludXRlc1wiLFxuICBcIm5vdGVzXCIsXG4gIFwicHJvamVjdElkXCIsXG4gIFwiZHVlRGF0ZVwiLFxuICBcInJlbWluZGVyVGltZVwiLFxuICBcImZvY3VzTWludXRlc1wiLFxuICBcInByaW9yaXR5XCIsXG4gIFwiZXN0aW1hdGVcIixcbiAgXCJ0YWdzXCIsXG4gIFwic3VidGFza3NcIixcbiAgXCJyZXBlYXRcIixcbl0gYXMgY29uc3Q7XG5jb25zdCBQTEFOX1NVQlRBU0tfS0VZUyA9IFtcImlkXCIsIFwidGl0bGVcIl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBsYW5GaWxlKHJhdzogdW5rbm93bik6IFBsYW5GaWxlIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uUExBTl9GSUxFX0tFWVNdLCBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiKTtcbiAgcmV0dXJuIHtcbiAgICBmb3JtYXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImZvcm1hdFwiLCBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiLCBhc1N0ciksXG4gICAgdmVyc2lvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwidmVyc2lvblwiLCBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiLCBhc0ludCksXG4gICAgcG9tb2Rvcm9NaW51dGVzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwb21vZG9yb01pbnV0ZXNcIiwgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIiwgYXNJbnQpLFxuICAgIHByb2plY3RzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9qZWN0c1wiLCBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiLCAodikgPT5cbiAgICAgIGFzQXJyYXkodiwgXCJwcm9qZWN0c1wiKS5tYXAocGFyc2VQbGFuUHJvamVjdCksXG4gICAgKSxcbiAgICB0YXNrczogcmVxdWlyZWRGaWVsZChyYXcsIFwidGFza3NcIiwgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIiwgKHYpID0+XG4gICAgICBhc0FycmF5KHYsIFwidGFza3NcIikubWFwKHBhcnNlUGxhblRhc2spLFxuICAgICksXG4gICAgYmxvY2tzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiYmxvY2tzXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJibG9ja3NcIikubWFwKHBhcnNlQmxvY2spLFxuICAgICAgW10sXG4gICAgKSxcbiAgICB0ZW1wbGF0ZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0ZW1wbGF0ZXNcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU2NTg3XHU0RUY2XCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInRlbXBsYXRlc1wiKS5tYXAocGFyc2VUZW1wbGF0ZSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHByaW50czogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInByaW50c1wiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTY1ODdcdTRFRjZcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwicHJpbnRzXCIpLm1hcChwYXJzZVByaW50UmVjb3JkKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgaGFiaXRzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiaGFiaXRzXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJoYWJpdHNcIikubWFwKHBhcnNlSGFiaXQpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICByZXBsYWNlOiBmaWVsZChyYXcsIFwicmVwbGFjZVwiLCBcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlwiLCBhc0Jvb2wsIGZhbHNlKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQbGFuUHJvamVjdChyYXc6IHVua25vd24pOiBQbGFuUHJvamVjdCB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkExXHU1MjEyXHU5ODc5XHU3NkVFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlBMQU5fUFJPSkVDVF9LRVlTXSwgXCJcdThCQTFcdTUyMTJcdTk4NzlcdTc2RUVcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU4QkExXHU1MjEyXHU5ODc5XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBuYW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJuYW1lXCIsIFwiXHU4QkExXHU1MjEyXHU5ODc5XHU3NkVFXCIsIGFzU3RyKSxcbiAgICBjb2xvcjogcmVxdWlyZWRGaWVsZChyYXcsIFwiY29sb3JcIiwgXCJcdThCQTFcdTUyMTJcdTk4NzlcdTc2RUVcIiwgYXNTdHIpLFxuICAgIGFwcFdoaXRlbGlzdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImFwcFdoaXRlbGlzdFwiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTk4NzlcdTc2RUVcIixcbiAgICAgICh2KSA9PlxuICAgICAgICBhc09wdCh2LCBcImFwcFdoaXRlbGlzdFwiLCAoeCkgPT5cbiAgICAgICAgICBhc0FycmF5KHgsIFwiYXBwV2hpdGVsaXN0XCIpLm1hcCgoYSkgPT4gYXNTdHIoYSwgXCJcdTVFOTRcdTc1MjggSURcIikpLFxuICAgICAgICApLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZ1tdIHwgbnVsbCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQbGFuU3VidGFzayhyYXc6IHVua25vd24pOiBQbGFuU3VidGFzayB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkExXHU1MjEyXHU1QjUwXHU2QjY1XHU5QUE0XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgWy4uLlBMQU5fU1VCVEFTS19LRVlTXSwgXCJcdThCQTFcdTUyMTJcdTVCNTBcdTZCNjVcdTlBQTRcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU4QkExXHU1MjEyXHU1QjUwXHU2QjY1XHU5QUE0XCIsIGFzU3RyKSxcbiAgICB0aXRsZTogcmVxdWlyZWRGaWVsZChyYXcsIFwidGl0bGVcIiwgXCJcdThCQTFcdTUyMTJcdTVCNTBcdTZCNjVcdTlBQTRcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZVBsYW5UYXNrKHJhdzogdW5rbm93bik6IFBsYW5UYXNrIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJlamVjdFVua25vd24ocmF3LCBbLi4uUExBTl9UQVNLX0tFWVNdLCBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIiwgYXNTdHIpLFxuICAgIHRpdGxlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aXRsZVwiLCBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLCBhc1N0ciksXG4gICAgdGVtcGxhdGVJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInRlbXBsYXRlSWRcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJ0ZW1wbGF0ZUlkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIGhhYml0SWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJoYWJpdElkXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiaGFiaXRJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICByZWN1cnJpbmc6IGZpZWxkKHJhdywgXCJyZWN1cnJpbmdcIiwgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIiwgYXNCb29sLCBmYWxzZSksXG4gICAgc2NyYXBNaW51dGVzOiBmaWVsZChyYXcsIFwic2NyYXBNaW51dGVzXCIsIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsIGFzSW50LCAwKSxcbiAgICBub3RlczogZmllbGQocmF3LCBcIm5vdGVzXCIsIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsIGFzU3RyLCBcIlwiKSxcbiAgICBwcm9qZWN0SWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJwcm9qZWN0SWRcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJwcm9qZWN0SWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZHVlRGF0ZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImR1ZURhdGVcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJkdWVEYXRlXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHJlbWluZGVyVGltZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJlbWluZGVyVGltZVwiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInJlbWluZGVyVGltZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBmb2N1c01pbnV0ZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJmb2N1c01pbnV0ZXNcIixcbiAgICAgIFwiXHU4QkExXHU1MjEyXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJmb2N1c01pbnV0ZXNcIiwgKHgpID0+IGFzSW50KHgsIFwiZm9jdXNNaW51dGVzXCIpKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICAgIHByaW9yaXR5OiBmaWVsZChyYXcsIFwicHJpb3JpdHlcIiwgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIiwgYXNJbnQsIDApLFxuICAgIGVzdGltYXRlOiBmaWVsZChyYXcsIFwiZXN0aW1hdGVcIiwgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIiwgYXNJbnQsIDEpLFxuICAgIHRhZ3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YWdzXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0YWdzXCIpLm1hcCgodCkgPT4gYXNTdHIodCwgXCJcdTY4MDdcdTdCN0VcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBzdWJ0YXNrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInN1YnRhc2tzXCIsXG4gICAgICBcIlx1OEJBMVx1NTIxMlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJzdWJ0YXNrc1wiKS5tYXAocGFyc2VQbGFuU3VidGFzayksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHJlcGVhdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJlcGVhdFwiLFxuICAgICAgXCJcdThCQTFcdTUyMTJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBvbmVPZih2LCBcInJlcGVhdFwiLCBbXCJub25lXCIsIFwiZGFpbHlcIiwgXCJ3ZWVrZGF5c1wiLCBcIndlZWtseVwiXSksXG4gICAgICBcIm5vbmVcIixcbiAgICApIGFzIFJlcGVhdCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVBsYW5GaWxlKHBsYW46IFBsYW5GaWxlKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBvdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgIGZvcm1hdDogcGxhbi5mb3JtYXQsXG4gICAgdmVyc2lvbjogcGxhbi52ZXJzaW9uLFxuICAgIHBvbW9kb3JvTWludXRlczogcGxhbi5wb21vZG9yb01pbnV0ZXMsXG4gICAgcHJvamVjdHM6IHBsYW4ucHJvamVjdHMubWFwKChwKSA9PiB7XG4gICAgICBjb25zdCBvOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgaWQ6IHAuaWQsXG4gICAgICAgIG5hbWU6IHAubmFtZSxcbiAgICAgICAgY29sb3I6IHAuY29sb3IsXG4gICAgICB9O1xuICAgICAgaWYgKHAuYXBwV2hpdGVsaXN0ICE9PSBudWxsKSBvW1wiYXBwV2hpdGVsaXN0XCJdID0gcC5hcHBXaGl0ZWxpc3Q7XG4gICAgICByZXR1cm4gbztcbiAgICB9KSxcbiAgICB0YXNrczogcGxhbi50YXNrcy5tYXAoKHQpID0+IHtcbiAgICAgIGNvbnN0IG86IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICBpZDogdC5pZCxcbiAgICAgICAgdGl0bGU6IHQudGl0bGUsXG4gICAgICAgIHRlbXBsYXRlSWQ6IHQudGVtcGxhdGVJZCxcbiAgICAgICAgaGFiaXRJZDogdC5oYWJpdElkLFxuICAgICAgICByZWN1cnJpbmc6IHQucmVjdXJyaW5nLFxuICAgICAgICBzY3JhcE1pbnV0ZXM6IHQuc2NyYXBNaW51dGVzLFxuICAgICAgICBub3RlczogdC5ub3RlcyxcbiAgICAgICAgcHJvamVjdElkOiB0LnByb2plY3RJZCxcbiAgICAgICAgZHVlRGF0ZTogdC5kdWVEYXRlLFxuICAgICAgICBwcmlvcml0eTogdC5wcmlvcml0eSxcbiAgICAgICAgZXN0aW1hdGU6IHQuZXN0aW1hdGUsXG4gICAgICAgIHRhZ3M6IHQudGFncyxcbiAgICAgICAgc3VidGFza3M6IHQuc3VidGFza3MubWFwKChzKSA9PiAoeyBpZDogcy5pZCwgdGl0bGU6IHMudGl0bGUgfSkpLFxuICAgICAgICByZXBlYXQ6IHQucmVwZWF0LFxuICAgICAgfTtcbiAgICAgIGlmICh0LnJlbWluZGVyVGltZSAhPT0gbnVsbCkgb1tcInJlbWluZGVyVGltZVwiXSA9IHQucmVtaW5kZXJUaW1lO1xuICAgICAgaWYgKHQuZm9jdXNNaW51dGVzICE9PSBudWxsKSBvW1wiZm9jdXNNaW51dGVzXCJdID0gdC5mb2N1c01pbnV0ZXM7XG4gICAgICByZXR1cm4gbztcbiAgICB9KSxcbiAgICBibG9ja3M6IHBsYW4uYmxvY2tzLm1hcChzZXJpYWxpemVCbG9jayksXG4gICAgdGVtcGxhdGVzOiBwbGFuLnRlbXBsYXRlcy5tYXAoc2VyaWFsaXplVGVtcGxhdGUpLFxuICAgIHByaW50czogcGxhbi5wcmludHMubWFwKHNlcmlhbGl6ZVByaW50UmVjb3JkKSxcbiAgICBoYWJpdHM6IHBsYW4uaGFiaXRzLm1hcChzZXJpYWxpemVIYWJpdCksXG4gIH07XG4gIGlmIChwbGFuLnJlcGxhY2UpIG91dFtcInJlcGxhY2VcIl0gPSB0cnVlO1xuICByZXR1cm4gb3V0O1xufVxuXG4vKiogXHU2NTg3XHU0RUY2XHU1QjlFXHU0RjhCIFx1MjE5MiBcdTY3MkNcdTU3MzBcdTRFRkJcdTUyQTFcdUZGMUFcdThGREJcdTVFQTZcdTRFMEVcdTUzODZcdTUzRjJcdTc1NTlcdTU3MjhcdTY3MkNcdTY3M0FcdTMwMDIgKi9cbmZ1bmN0aW9uIHBsYW5UYXNrVG9UYXNrKHQ6IFBsYW5UYXNrLCBhdDogbnVtYmVyLCBlc3RpbWF0ZTogbnVtYmVyKTogVGFzayB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHQuaWQsXG4gICAgdGVtcGxhdGVJZDogdC50ZW1wbGF0ZUlkLFxuICAgIHJlY3VycmluZzogdC5yZWN1cnJpbmcgfHwgdC5yZXBlYXQgIT09IFwibm9uZVwiLFxuICAgIHRpdGxlOiB0LnRpdGxlLFxuICAgIG5vdGVzOiB0Lm5vdGVzLFxuICAgIHByb2plY3RJZDogdC5wcm9qZWN0SWQsXG4gICAgaGFiaXRJZDogdC5oYWJpdElkLFxuICAgIGR1ZURhdGU6IHQuZHVlRGF0ZSxcbiAgICByZW1pbmRlclRpbWU6IHQucmVtaW5kZXJUaW1lLFxuICAgIGZvY3VzTWludXRlczogdC5mb2N1c01pbnV0ZXMsXG4gICAgcmVtaW5kZXJGaXJlZDogZmFsc2UsXG4gICAgcmVtaW5kZXJQZW5kaW5nOiBmYWxzZSxcbiAgICByZW1pbmRlckV4cGlyZWQ6IGZhbHNlLFxuICAgIHNjcmFwTWludXRlczogdC5zY3JhcE1pbnV0ZXMsXG4gICAgcHJpb3JpdHk6IHQucHJpb3JpdHksXG4gICAgZXN0aW1hdGUsXG4gICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICBjb21wbGV0ZWRBdDogbnVsbCxcbiAgICBjcmVhdGVkQXQ6IGF0LFxuICAgIHRhZ3M6IFsuLi50LnRhZ3NdLFxuICAgIHN1YnRhc2tzOiB0LnN1YnRhc2tzLm1hcCgocykgPT4gKHtcbiAgICAgIGlkOiBzLmlkLFxuICAgICAgdGl0bGU6IHMudGl0bGUsXG4gICAgICBkb25lOiBmYWxzZSxcbiAgICB9KSksXG4gIH07XG59XG5cbi8qKiBcdTkxNERcdTdGNkVcdTY3NjVcdTgxRUFcdTY1ODdcdTRFRjZcdUZGMUJcdThGREJcdTVFQTZcdTRFMEVcdTUzODZcdTUzRjJcdTc1NTlcdTU3MjhcdTY3MkNcdTY3M0FcdTMwMDJcdTYzRDBcdTkxOTJcdTcyQjZcdTYwMDFcdTUzRUFcdTU3MjhcdTY1RjZcdTk1RjRcdTY5RkRcdTRFMERcdTUzRDhcdTY1RjZcdTVCNThcdTZEM0JcdTMwMDIgKi9cbmZ1bmN0aW9uIHBsYW5UYXNrTWVyZ2UoXG4gIHQ6IFBsYW5UYXNrLFxuICBvbGQ6IFRhc2ssXG4gIGF0OiBudW1iZXIsXG4gIGVzdGltYXRlOiBudW1iZXIsXG4pOiBUYXNrIHtcbiAgY29uc3QgdGFzayA9IHBsYW5UYXNrVG9UYXNrKHQsIGF0LCBlc3RpbWF0ZSk7XG4gIHRhc2suY3JlYXRlZEF0ID0gb2xkLmNyZWF0ZWRBdDtcbiAgdGFzay5jb21wbGV0ZWQgPSBvbGQuY29tcGxldGVkO1xuICB0YXNrLmNvbXBsZXRlZEF0ID0gb2xkLmNvbXBsZXRlZEF0O1xuICBpZiAob2xkLmR1ZURhdGUgPT09IHQuZHVlRGF0ZSAmJiBvbGQucmVtaW5kZXJUaW1lID09PSB0LnJlbWluZGVyVGltZSkge1xuICAgIHRhc2sucmVtaW5kZXJGaXJlZCA9IG9sZC5yZW1pbmRlckZpcmVkO1xuICAgIHRhc2sucmVtaW5kZXJQZW5kaW5nID0gb2xkLnJlbWluZGVyUGVuZGluZztcbiAgICB0YXNrLnJlbWluZGVyRXhwaXJlZCA9IG9sZC5yZW1pbmRlckV4cGlyZWQ7XG4gIH1cbiAgZm9yIChjb25zdCBzdWIgb2YgdGFzay5zdWJ0YXNrcykge1xuICAgIGNvbnN0IHByZXYgPSBvbGQuc3VidGFza3MuZmluZCgocykgPT4gcy5pZCA9PT0gc3ViLmlkKTtcbiAgICBpZiAocHJldiAhPT0gdW5kZWZpbmVkKSBzdWIuZG9uZSA9IHByZXYuZG9uZTtcbiAgfVxuICByZXR1cm4gdGFzaztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlUGxhbkZpbGUocGxhbjogUGxhbkZpbGUpOiB2b2lkIHtcbiAgaWYgKHBsYW4uZm9ybWF0ICE9PSBcInRvbWF0by10b2RvLXBsYW5cIiB8fCBwbGFuLnZlcnNpb24gIT09IDYpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFQzVcdTY1MkZcdTYzMDFcdThCQTFcdTUyMTIgdjZcdUZGMUJcdTY1RTdcdThCQTFcdTUyMTJcdThCRjdcdTYzMDlcdTY1QjBcdTY4M0NcdTVGMEZcdTkxQ0RcdTY1QjBcdTVCRkNcdTUxRkFcIik7XG4gIH1cbiAgaWYgKHBsYW4udGFza3Muc29tZSgodCkgPT4gdC5yZXBlYXQgIT09IFwibm9uZVwiKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NUI5RVx1NEY4Qlx1NEUwRFx1NjJFNVx1NjcwOVx1OTFDRFx1NTkwRFx1ODlDNFx1NTIxOVx1RkYwQ1x1OEJGN1x1NEY3Rlx1NzUyOFx1NTQ2OFx1NjcxRlx1NkEyMVx1Njc3RlwiKTtcbiAgfVxuICBpZiAocGxhbi5wb21vZG9yb01pbnV0ZXMgPCAxIHx8IHBsYW4ucG9tb2Rvcm9NaW51dGVzID4gMTgwKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkExXHU1MjEyXHU3Njg0XHU3NTZBXHU4MzA0XHU2NUY2XHU5NTdGXHU5NzAwXHU0RTNBIDFcdTIwMTMxODAgXHU1MjA2XHU5NDlGXCIpO1xuICB9XG4gIGNvbnN0IGRhdGEgPSBuZXcgQXBwRGF0YSh7XG4gICAgcHJvamVjdHM6IHBsYW4ucHJvamVjdHMubWFwKChwKSA9PiAoe1xuICAgICAgaWQ6IHAuaWQsXG4gICAgICBuYW1lOiBwLm5hbWUsXG4gICAgICBjb2xvcjogcC5jb2xvcixcbiAgICAgIGFwcFdoaXRlbGlzdDogcC5hcHBXaGl0ZWxpc3QgPT09IG51bGwgPyBudWxsIDogWy4uLnAuYXBwV2hpdGVsaXN0XSxcbiAgICB9KSksXG4gICAgdGFza3M6IHBsYW4udGFza3MubWFwKCh0KSA9PiBwbGFuVGFza1RvVGFzayh0LCAwLCB0LmVzdGltYXRlKSksXG4gICAgYmxvY2tzOiBwbGFuLmJsb2Nrcy5tYXAoKGIpID0+ICh7IC4uLmIsIGRheXM6IFsuLi5iLmRheXNdIH0pKSxcbiAgICB0ZW1wbGF0ZXM6IHBsYW4udGVtcGxhdGVzLFxuICAgIHByaW50czogcGxhbi5wcmludHMsXG4gICAgaGFiaXRzOiBwbGFuLmhhYml0cyxcbiAgfSk7XG4gIGRhdGEudmFsaWRhdGUoKTtcbn1cblxuLyoqIFx1NjM2Mlx1N0I5N1x1NjcyQ1x1NTczMFx1NzU2QVx1ODMwNFx1NkJCNVx1NjU3MFx1RkYxQlx1NjVFMFx1NTM1NVx1NkIyMVx1NjVGNlx1OTU3Rlx1NjMwOVx1NjU4N1x1NEVGNlx1NzU2QVx1ODMwNFx1NjVGNlx1OTU3Rlx1NjM2Mlx1N0I5N1x1NUU3Nlx1NTQxMVx1NEUwQVx1NTNENlx1NjU3NFx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBsYW5Fc3RpbWF0ZShcbiAgdDogUGxhblRhc2ssXG4gIHBvbW9kb3JvOiBudW1iZXIsXG4gIGZvY3VzOiBudW1iZXIsXG4pOiBudW1iZXIge1xuICBjb25zdCBlc3RpbWF0ZSA9XG4gICAgdC5mb2N1c01pbnV0ZXMgIT09IG51bGxcbiAgICAgID8gdC5lc3RpbWF0ZVxuICAgICAgOiBNYXRoLmNlaWwoKHQuZXN0aW1hdGUgKiBwb21vZG9ybykgLyBmb2N1cyk7XG4gIGlmIChlc3RpbWF0ZSA+IDk5KSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKGBcdTRFRkJcdTUyQTFcdTIwMUMke3QudGl0bGV9XHUyMDFEXHU2MzYyXHU3Qjk3XHU1NDBFXHU4RDg1XHU4RkM3IDk5IFx1NEUyQVx1NzU2QVx1ODMwNFx1RkYwQ1x1OEJGN1x1NTE0OFx1NjJDNlx1NTIwNlx1NEVGQlx1NTJBMWApO1xuICB9XG4gIHJldHVybiBlc3RpbWF0ZTtcbn1cblxuZnVuY3Rpb24gY29udmVydGVkRXN0aW1hdGUoXG4gIGVzdGltYXRlOiBudW1iZXIsXG4gIGZvY3VzOiBudW1iZXIgfCBudWxsLFxuICBzb3VyY2U6IG51bWJlcixcbiAgZGVzdGluYXRpb246IG51bWJlcixcbik6IG51bWJlciB7XG4gIGNvbnN0IGNvbnZlcnRlZCA9XG4gICAgZm9jdXMgIT09IG51bGwgPyBlc3RpbWF0ZSA6IE1hdGguY2VpbCgoZXN0aW1hdGUgKiBzb3VyY2UpIC8gZGVzdGluYXRpb24pO1xuICBpZiAoY29udmVydGVkID4gOTkpIHtcbiAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTYzNjJcdTdCOTdcdTU0MEVcdThEODVcdThGQzcgOTkgXHU0RTJBXHU3NTZBXHU4MzA0XHVGRjBDXHU4QkY3XHU1MTQ4XHU2MkM2XHU1MjA2XHU2QTIxXHU2NzdGXCIpO1xuICB9XG4gIHJldHVybiBjb252ZXJ0ZWQ7XG59XG5cbi8qKiBcdTVCRkNcdTUxNjVcdUZGMUFcdTUxNDhcdTVCOENcdTY1NzRcdTY4MjFcdTlBOENcdTUwMTlcdTkwMDlcdUZGMENcdTUxOERcdTUzOUZcdTVCNTBcdTYzRDBcdTRFQTRcdTMwMDIgKi9cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZVBsYW4ocGxhbjogUGxhbkZpbGUsIGRhdGE6IEFwcERhdGEsIGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgdmFsaWRhdGVQbGFuRmlsZShwbGFuKTtcbiAgY29uc3QgbmV4dCA9IGNsb25lKGRhdGEpO1xuICBmb3IgKGNvbnN0IHBsYW5Qcm9qZWN0IG9mIHBsYW4ucHJvamVjdHMpIHtcbiAgICBjb25zdCBleGlzdGluZyA9IG5leHQucHJvamVjdHMuZmluZCgocCkgPT4gcC5pZCA9PT0gcGxhblByb2plY3QuaWQpO1xuICAgIGlmIChleGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBcdTk4NzlcdTc2RUVcdTkxNERcdTdGNkVcdTY2MkZcdTkxQ0RcdTY1QjBcdTc1MUZcdTYyMTBcdTc2ODRcdUZGMENcdThGREJcdTVFQTZcdTRFMERcdTY2MkZcdUZGMUFcdTY1ODdcdTRFRjZcdTgzQjdcdTgwRENcdUZGMUJcdTc3MDFcdTc1NjVcdTc2N0RcdTU0MERcdTUzNTVcdTRGRERcdTc1NTlcdTY3MkNcdTY3M0FcdTZFMDVcdTUzNTVcdTMwMDJcbiAgICAgIGV4aXN0aW5nLm5hbWUgPSBwbGFuUHJvamVjdC5uYW1lO1xuICAgICAgZXhpc3RpbmcuY29sb3IgPSBwbGFuUHJvamVjdC5jb2xvcjtcbiAgICAgIGlmIChwbGFuUHJvamVjdC5hcHBXaGl0ZWxpc3QgIT09IG51bGwpIHtcbiAgICAgICAgZXhpc3RpbmcuYXBwV2hpdGVsaXN0ID0gWy4uLnBsYW5Qcm9qZWN0LmFwcFdoaXRlbGlzdF07XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQucHJvamVjdHMucHVzaCh7XG4gICAgICAgIGlkOiBwbGFuUHJvamVjdC5pZCxcbiAgICAgICAgbmFtZTogcGxhblByb2plY3QubmFtZSxcbiAgICAgICAgY29sb3I6IHBsYW5Qcm9qZWN0LmNvbG9yLFxuICAgICAgICBhcHBXaGl0ZWxpc3Q6XG4gICAgICAgICAgcGxhblByb2plY3QuYXBwV2hpdGVsaXN0ID09PSBudWxsXG4gICAgICAgICAgICA/IG51bGxcbiAgICAgICAgICAgIDogWy4uLnBsYW5Qcm9qZWN0LmFwcFdoaXRlbGlzdF0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBoYWJpdCBvZiBwbGFuLmhhYml0cykge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gbmV4dC5oYWJpdHMuZmluZCgoaCkgPT4gaC5pZCA9PT0gaGFiaXQuaWQpO1xuICAgIGlmIChleGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBleGlzdGluZy5uYW1lID0gaGFiaXQubmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dC5oYWJpdHMucHVzaCh7IGlkOiBoYWJpdC5pZCwgbmFtZTogaGFiaXQubmFtZSB9KTtcbiAgICB9XG4gIH1cbiAgLy8gXHU2NUY2XHU2QkI1XHU2NjJGXHU3RUFGXHU5MTREXHU3RjZFXHVGRjFBXHU2NTg3XHU0RUY2XHU3MjQ4XHU2NzJDXHU2NkZGXHU2MzYyXHU2NzJDXHU2NzNBXHU3MjQ4XHU2NzJDXHVGRjBDXHU2NzJBXHU2M0QwXHU1M0NBXHU3Njg0XHU0RkREXHU2MzAxXHU0RTBEXHU1MkE4XHUzMDAyXG4gIGZvciAoY29uc3QgYmxvY2sgb2YgcGxhbi5ibG9ja3MpIHtcbiAgICBjb25zdCBleGlzdGluZyA9IG5leHQuYmxvY2tzLmZpbmQoKGIpID0+IGIuaWQgPT09IGJsb2NrLmlkKTtcbiAgICBpZiAoZXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbmV4dC5ibG9ja3NbbmV4dC5ibG9ja3MuaW5kZXhPZihleGlzdGluZyldID0ge1xuICAgICAgICAuLi5ibG9jayxcbiAgICAgICAgZGF5czogWy4uLmJsb2NrLmRheXNdLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dC5ibG9ja3MucHVzaCh7IC4uLmJsb2NrLCBkYXlzOiBbLi4uYmxvY2suZGF5c10gfSk7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgcGxhblRlbXBsYXRlIG9mIHBsYW4udGVtcGxhdGVzKSB7XG4gICAgY29uc3QgdGVtcGxhdGU6IFRlbXBsYXRlID0gY2xvbmUocGxhblRlbXBsYXRlKTtcbiAgICB0ZW1wbGF0ZS5zaGFwZS5lc3RpbWF0ZSA9IGNvbnZlcnRlZEVzdGltYXRlKFxuICAgICAgdGVtcGxhdGUuc2hhcGUuZXN0aW1hdGUsXG4gICAgICB0ZW1wbGF0ZS5zaGFwZS5mb2N1c01pbnV0ZXMsXG4gICAgICBwbGFuLnBvbW9kb3JvTWludXRlcyxcbiAgICAgIGRhdGEuc2V0dGluZ3MuZm9jdXNNaW51dGVzLFxuICAgICk7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBuZXh0LnRlbXBsYXRlcy5maW5kKCh0KSA9PiB0LmlkID09PSB0ZW1wbGF0ZS5pZCk7XG4gICAgaWYgKGV4aXN0aW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG5leHQudGVtcGxhdGVzW25leHQudGVtcGxhdGVzLmluZGV4T2YoZXhpc3RpbmcpXSA9IHRlbXBsYXRlO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0LnRlbXBsYXRlcy5wdXNoKHRlbXBsYXRlKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBwcmludCBvZiBwbGFuLnByaW50cykge1xuICAgIGlmIChcbiAgICAgICFuZXh0LnByaW50cy5zb21lKFxuICAgICAgICAocCkgPT4gcC50ZW1wbGF0ZUlkID09PSBwcmludC50ZW1wbGF0ZUlkICYmIHAuZGF0ZSA9PT0gcHJpbnQuZGF0ZSxcbiAgICAgIClcbiAgICApIHtcbiAgICAgIG5leHQucHJpbnRzLnB1c2goeyB0ZW1wbGF0ZUlkOiBwcmludC50ZW1wbGF0ZUlkLCBkYXRlOiBwcmludC5kYXRlIH0pO1xuICAgIH1cbiAgfVxuICAvLyBcdTVERjJcdTY3MDlcdTVCOUVcdTRGOEJcdTUzRDZcdTY1ODdcdTRFRjZcdTkxNERcdTdGNkVcdTMwMDFcdTRGRERcdTc1NTlcdThGREJcdTVFQTZcdTMwMDJcbiAgY29uc3QgaW5jb21pbmcgPSBuZXcgTWFwPHN0cmluZywgUGxhblRhc2s+KCk7XG4gIGZvciAoY29uc3QgdCBvZiBwbGFuLnRhc2tzKSBpbmNvbWluZy5zZXQodC5pZCwgdCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbmV4dC50YXNrcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGNvbnN0IHRhc2sgPSBuZXh0LnRhc2tzW2ldITtcbiAgICBjb25zdCBwbGFuVGFzayA9IGluY29taW5nLmdldCh0YXNrLmlkKTtcbiAgICBpZiAocGxhblRhc2sgPT09IHVuZGVmaW5lZCkgY29udGludWU7XG4gICAgaWYgKGRhdGEudGVhY2hpbmdUYXNrKHRhc2suaWQpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJBMVx1NTIxMlx1NjU4N1x1NEVGNlx1NEUwRFx1ODBGRFx1NjUzOVx1NTE5OVx1NjU1OVx1NUI2Nlx1NUY4NVx1NTI5RVx1RkYwQ1x1OEJGN1x1OEMwM1x1NjU3NFx1NUJGOVx1NUU5NFx1OEJGRVx1N0EwQlx1NjIxNlx1NEY1Q1x1NEUxQVwiKTtcbiAgICB9XG4gICAgY29uc3QgZXN0aW1hdGUgPSBwbGFuRXN0aW1hdGUoXG4gICAgICBwbGFuVGFzayxcbiAgICAgIHBsYW4ucG9tb2Rvcm9NaW51dGVzLFxuICAgICAgZGF0YS5zZXR0aW5ncy5mb2N1c01pbnV0ZXMsXG4gICAgKTtcbiAgICBjb25zdCBvbGQgPSBjbG9uZSh0YXNrKTtcbiAgICBuZXh0LnRhc2tzW2ldID0gcGxhblRhc2tNZXJnZShwbGFuVGFzaywgb2xkLCBhdCwgZXN0aW1hdGUpO1xuICB9XG4gIGNvbnN0IGxvY2FsSWRzID0gbmV3IFNldChuZXh0LnRhc2tzLm1hcCgodCkgPT4gdC5pZCkpO1xuICBmb3IgKGNvbnN0IHBsYW5UYXNrIG9mIHBsYW4udGFza3MpIHtcbiAgICBpZiAobG9jYWxJZHMuaGFzKHBsYW5UYXNrLmlkKSkgY29udGludWU7XG4gICAgY29uc3QgZXN0aW1hdGUgPSBwbGFuRXN0aW1hdGUoXG4gICAgICBwbGFuVGFzayxcbiAgICAgIHBsYW4ucG9tb2Rvcm9NaW51dGVzLFxuICAgICAgZGF0YS5zZXR0aW5ncy5mb2N1c01pbnV0ZXMsXG4gICAgKTtcbiAgICBjb25zdCBpbnN0YW5jZSA9IHBsYW5UYXNrVG9UYXNrKHBsYW5UYXNrLCBhdCwgZXN0aW1hdGUpO1xuICAgIGlmIChpbnN0YW5jZS50ZW1wbGF0ZUlkICE9PSBudWxsKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFuZXh0LnByaW50cy5zb21lKFxuICAgICAgICAgIChwKSA9PlxuICAgICAgICAgICAgcC50ZW1wbGF0ZUlkID09PSBpbnN0YW5jZS50ZW1wbGF0ZUlkICYmIHAuZGF0ZSA9PT0gaW5zdGFuY2UuZHVlRGF0ZSxcbiAgICAgICAgKVxuICAgICAgKSB7XG4gICAgICAgIG5leHQucHJpbnRzLnB1c2goe1xuICAgICAgICAgIHRlbXBsYXRlSWQ6IGluc3RhbmNlLnRlbXBsYXRlSWQsXG4gICAgICAgICAgZGF0ZTogaW5zdGFuY2UuZHVlRGF0ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIG5leHQudGFza3MucHVzaChpbnN0YW5jZSk7XG4gIH1cbiAgaWYgKHBsYW4ucmVwbGFjZSkge1xuICAgIC8vIFx1NjU4N1x1NEVGNlx1NTM3M1x1NjU3NFx1NEUyQVx1OEJBMVx1NTIxMlx1RkYxQVx1NTIyMFx1NjM4OVx1NUI4M1x1NEUwRFx1NTE4RFx1NjNEMFx1NTNDQVx1NzY4NFx1NjcyQVx1NUI4Q1x1NjIxMFx1OTg3OVx1RkYwQ1x1NTM4Nlx1NTNGMlx1NkMzOFx1NEUwRFx1NTIyMFx1MzAwMlxuICAgIGNvbnN0IHBsYW5uZWRUYXNrcyA9IG5ldyBTZXQocGxhbi50YXNrcy5tYXAoKHQpID0+IHQuaWQpKTtcbiAgICBuZXh0LnRhc2tzID0gbmV4dC50YXNrcy5maWx0ZXIoXG4gICAgICAodCkgPT5cbiAgICAgICAgdC5jb21wbGV0ZWQgfHxcbiAgICAgICAgcGxhbm5lZFRhc2tzLmhhcyh0LmlkKSB8fFxuICAgICAgICBkYXRhLnRlYWNoaW5nVGFzayh0LmlkKSAhPT0gdW5kZWZpbmVkLFxuICAgICk7XG4gICAgY29uc3QgcGxhbm5lZEhhYml0cyA9IG5ldyBTZXQocGxhbi5oYWJpdHMubWFwKChoKSA9PiBoLmlkKSk7XG4gICAgY29uc3QgcmVtb3ZlZEhhYml0cyA9IG5leHQuaGFiaXRzXG4gICAgICAuZmlsdGVyKChoKSA9PiAhcGxhbm5lZEhhYml0cy5oYXMoaC5pZCkpXG4gICAgICAubWFwKChoKSA9PiBoLmlkKTtcbiAgICBpZiAocmVtb3ZlZEhhYml0cy5sZW5ndGggPiAwKSB7XG4gICAgICBuZXh0LmhhYml0cyA9IG5leHQuaGFiaXRzLmZpbHRlcigoaCkgPT4gIXJlbW92ZWRIYWJpdHMuaW5jbHVkZXMoaC5pZCkpO1xuICAgICAgZm9yIChjb25zdCB0YXNrIG9mIG5leHQudGFza3MpIHtcbiAgICAgICAgaWYgKHRhc2suaGFiaXRJZCAhPT0gbnVsbCAmJiByZW1vdmVkSGFiaXRzLmluY2x1ZGVzKHRhc2suaGFiaXRJZCkpXG4gICAgICAgICAgdGFzay5oYWJpdElkID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgdGVtcGxhdGUgb2YgbmV4dC50ZW1wbGF0ZXMpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRlbXBsYXRlLnNoYXBlLmhhYml0SWQgIT09IG51bGwgJiZcbiAgICAgICAgICByZW1vdmVkSGFiaXRzLmluY2x1ZGVzKHRlbXBsYXRlLnNoYXBlLmhhYml0SWQpXG4gICAgICAgICkge1xuICAgICAgICAgIHRlbXBsYXRlLnNoYXBlLmhhYml0SWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHBsYW5uZWRUZW1wbGF0ZXMgPSBuZXcgU2V0KHBsYW4udGVtcGxhdGVzLm1hcCgodCkgPT4gdC5pZCkpO1xuICAgIGNvbnN0IHJlbW92ZWRUZW1wbGF0ZXMgPSBuZXh0LnRlbXBsYXRlc1xuICAgICAgLmZpbHRlcigodCkgPT4gIXBsYW5uZWRUZW1wbGF0ZXMuaGFzKHQuaWQpKVxuICAgICAgLm1hcCgodCkgPT4gdC5pZCk7XG4gICAgZm9yIChjb25zdCBpZCBvZiByZW1vdmVkVGVtcGxhdGVzKSB7XG4gICAgICBkZWxldGVUZW1wbGF0ZShuZXh0LCBpZCk7XG4gICAgfVxuICAgIGNvbnN0IHBsYW5uZWRCbG9ja3MgPSBuZXcgU2V0KHBsYW4uYmxvY2tzLm1hcCgoYikgPT4gYi5pZCkpO1xuICAgIG5leHQuYmxvY2tzID0gbmV4dC5ibG9ja3MuZmlsdGVyKChiKSA9PiBwbGFubmVkQmxvY2tzLmhhcyhiLmlkKSk7XG4gIH1cbiAgbmV4dC52YWxpZGF0ZSgpO1xuICByZXBsYWNlQXBwRGF0YShkYXRhLCBuZXh0KTtcbn1cblxuLyoqIFx1NUJGQ1x1NTFGQVx1RkYxQVx1NEUwRFx1NTQyQlx1NUI4Q1x1NjIxMFx1OEZEQlx1NUVBNlx1MzAwMVx1NEUxM1x1NkNFOFx1NTM4Nlx1NTNGMlx1MzAwMVx1OEJBMVx1NjVGNlx1NTY2OFx1NEUwRVx1NjcyQ1x1NjczQVx1OEJCRVx1N0Y2RVx1MzAwMiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4cG9ydFBsYW4oZGF0YTogQXBwRGF0YSk6IFBsYW5GaWxlIHtcbiAgY29uc3QgdGFza3M6IFBsYW5UYXNrW10gPSBkYXRhLnRhc2tzXG4gICAgLmZpbHRlcigodCkgPT4gIXQuY29tcGxldGVkICYmIGRhdGEudGVhY2hpbmdUYXNrKHQuaWQpID09PSB1bmRlZmluZWQpXG4gICAgLm1hcCgodCkgPT4gKHtcbiAgICAgIHRlbXBsYXRlSWQ6IHQudGVtcGxhdGVJZCxcbiAgICAgIGhhYml0SWQ6IHQuaGFiaXRJZCxcbiAgICAgIHJlY3VycmluZzogdC5yZWN1cnJpbmcsXG4gICAgICBzY3JhcE1pbnV0ZXM6IHQuc2NyYXBNaW51dGVzLFxuICAgICAgaWQ6IHQuaWQsXG4gICAgICB0aXRsZTogdC50aXRsZSxcbiAgICAgIG5vdGVzOiB0Lm5vdGVzLFxuICAgICAgcHJvamVjdElkOiB0LnByb2plY3RJZCxcbiAgICAgIGR1ZURhdGU6IHQuZHVlRGF0ZSxcbiAgICAgIHJlbWluZGVyVGltZTogdC5yZW1pbmRlclRpbWUsXG4gICAgICBmb2N1c01pbnV0ZXM6IHQuZm9jdXNNaW51dGVzLFxuICAgICAgcHJpb3JpdHk6IHQucHJpb3JpdHksXG4gICAgICBlc3RpbWF0ZTogdC5lc3RpbWF0ZSxcbiAgICAgIHRhZ3M6IFsuLi50LnRhZ3NdLFxuICAgICAgcmVwZWF0OiBcIm5vbmVcIiBhcyBjb25zdCxcbiAgICAgIHN1YnRhc2tzOiB0LnN1YnRhc2tzLm1hcCgocykgPT4gKHsgaWQ6IHMuaWQsIHRpdGxlOiBzLnRpdGxlIH0pKSxcbiAgICB9KSk7XG4gIGNvbnN0IHVzZWQgPSBuZXcgU2V0PHN0cmluZz4oW1xuICAgIC4uLnRhc2tzXG4gICAgICAuZmlsdGVyKCh0KSA9PiB0LnByb2plY3RJZCAhPT0gbnVsbClcbiAgICAgIC5tYXAoKHQpID0+IHQucHJvamVjdElkIGFzIHN0cmluZyksXG4gICAgLi4uZGF0YS50ZW1wbGF0ZXNcbiAgICAgIC5maWx0ZXIoKHQpID0+IHQuc2hhcGUucHJvamVjdElkICE9PSBudWxsKVxuICAgICAgLm1hcCgodCkgPT4gdC5zaGFwZS5wcm9qZWN0SWQgYXMgc3RyaW5nKSxcbiAgXSk7XG4gIHJldHVybiB7XG4gICAgZm9ybWF0OiBcInRvbWF0by10b2RvLXBsYW5cIixcbiAgICB2ZXJzaW9uOiA2LFxuICAgIHJlcGxhY2U6IGZhbHNlLFxuICAgIGJsb2NrczogZGF0YS5ibG9ja3MubWFwKChiKSA9PiAoeyAuLi5iLCBkYXlzOiBbLi4uYi5kYXlzXSB9KSksXG4gICAgdGVtcGxhdGVzOiBkYXRhLnRlbXBsYXRlcy5tYXAoKHQpID0+IGNsb25lKHQpKSxcbiAgICBwcmludHM6IGRhdGEucHJpbnRzLm1hcCgocCkgPT4gKHsgLi4ucCB9KSksXG4gICAgaGFiaXRzOiBkYXRhLmhhYml0cy5tYXAoKGgpID0+ICh7IC4uLmggfSkpLFxuICAgIHBvbW9kb3JvTWludXRlczogZGF0YS5zZXR0aW5ncy5mb2N1c01pbnV0ZXMsXG4gICAgcHJvamVjdHM6IGRhdGEucHJvamVjdHNcbiAgICAgIC5maWx0ZXIoKHApID0+IHVzZWQuaGFzKHAuaWQpKVxuICAgICAgLm1hcCgocCkgPT4gKHtcbiAgICAgICAgaWQ6IHAuaWQsXG4gICAgICAgIG5hbWU6IHAubmFtZSxcbiAgICAgICAgY29sb3I6IHAuY29sb3IsXG4gICAgICAgIGFwcFdoaXRlbGlzdDogcC5hcHBXaGl0ZWxpc3QgPT09IG51bGwgPyBudWxsIDogWy4uLnAuYXBwV2hpdGVsaXN0XSxcbiAgICAgIH0pKSxcbiAgICB0YXNrcyxcbiAgfTtcbn1cbiIsICIvLyEgXHU1MTcxXHU0RUFCXHU2QTIxXHU1NzhCXHUzMDAxXHU4QkExXHU2NUY2XHU3MkI2XHU2MDAxXHU2NzNBXHU0RTBFXHU2ODIxXHU5QThDXHU1MTY1XHU1M0UzXHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9saWIucnNcdUZGMDhFbmdpbmUgXHU1NzI4IGVuZ2luZS50c1x1RkYwQ1x1Njg0Q1x1OTc2MiBndWFyZCBcdTUzOUZcdTc1MUZcdTRGRERcdTc1NTlcdUZGMDlcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IsIGNoYXJDb3VudCwgY2xvbmUsIGVuc3VyZSwgdXRmOExlbiB9IGZyb20gXCIuL2Vycm9yc1wiO1xuaW1wb3J0IHsgaWQgfSBmcm9tIFwiLi9pZHNcIjtcbmltcG9ydCB7XG4gIGFzQXJyYXksXG4gIGFzQm9vbCxcbiAgYXNJbnQsXG4gIGFzT3B0LFxuICBhc1N0cixcbiAgZmllbGQsXG4gIGlzT2JqZWN0LFxuICBvbmVPZixcbiAgcmVqZWN0VW5rbm93bixcbiAgcmVxdWlyZWRGaWVsZCxcbn0gZnJvbSBcIi4vanNvblwiO1xuaW1wb3J0IHR5cGUge1xuICBBY3RpdmVMb2NrLFxuICBBdHRlbnRpb24sXG4gIEJsb2NrLFxuICBEZXRhY2hUYXJnZXQsXG4gIERheVN0YXQsXG4gIEd1YXJkTW9kZSxcbiAgSGFiaXQsXG4gIEhhYml0U2xvdCxcbiAgSWRlbnRpdHksXG4gIExvY2tTY2hlZHVsZSxcbiAgTG9ja1N0YXRlLFxuICBNb2RlLFxuICBQbGFuRmlsZSxcbiAgUHJpbnRpbmcsXG4gIFByb2plY3QsXG4gIFJlcGVhdCxcbiAgU2Vzc2lvbixcbiAgU2Vzc2lvblNvdXJjZSxcbiAgU2V0dGluZ3MsXG4gIFNoYXBlLFxuICBTdGF0cyxcbiAgU3VidGFzayxcbiAgVGFzayxcbiAgVGFza0RyYWZ0LFxuICBUYXNrS2luZCxcbiAgVGVtcGxhdGUsXG4gIFRpbWVyLFxuICBWaXNpb24sXG59IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBpc0hhYml0LCBraW5kT2YgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgdmFsaWRhdGVMb2NrLCByZWxlYXNlTG9jaywgc2NoZWR1bGVkQXQgfSBmcm9tIFwiLi9sb2NrXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZUJsb2NrcyB9IGZyb20gXCIuL2Jsb2Nrc1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVIYWJpdCB9IGZyb20gXCIuL2hhYml0c1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVUZW1wbGF0ZXMsIHRhc2tJc1ZvaWQgfSBmcm9tIFwiLi90ZW1wbGF0ZXNcIjtcbmltcG9ydCB7XG4gIGR1cmF0aW9uT2YsXG4gIGR1ZUF1dG9UYXNrLFxuICBwZW5kaW5nUmVtaW5kZXIsXG4gIHJlY29yZFNlc3Npb24sXG4gIHJlbWluZGVySWRsZSxcbiAgcmVzZXRUbyxcbiAgc3RhcnREdWVUYXNrLFxuICBzdGFydFRpbWVyLFxuICB0YXNrSGFzUm91bmRzTGVmdCxcbiAgdGlja1JlbWluZGVycyxcbiAgdGltZXJSZW1haW5pbmcsXG4gIHdpbmRvd01pbnV0ZXMsXG59IGZyb20gXCIuL3JlbWluZGVyc1wiO1xuaW1wb3J0IHsgRWR1Y2F0aW9uLCBwYXJzZUVkdWNhdGlvbiwgc2VyaWFsaXplRWR1Y2F0aW9uIH0gZnJvbSBcIi4vZWR1Y2F0aW9uXCI7XG5pbXBvcnQge1xuICBjb21wbGV0ZVRlYWNoaW5nVGFzayxcbiAgbWF0ZXJpYWxpemVUZWFjaGluZ1Rhc2tzLFxuICBzdGFydFRlYWNoaW5nVGFzayxcbiAgdGVhY2hpbmdUYXNrLFxuICB2YWxpZGF0ZVRlYWNoaW5nVGFza3MsXG59IGZyb20gXCIuL3RlYWNoaW5nX3Rhc2tzXCI7XG5pbXBvcnQge1xuICB2YWxpZGF0ZUlkZW50aXRpZXMsXG4gIHBhcnNlSWRlbnRpdHksXG4gIHNlcmlhbGl6ZUlkZW50aXR5LFxufSBmcm9tIFwiLi9pZGVudGl0aWVzXCI7XG5pbXBvcnQgeyBleHBvcnRQbGFuLCBtZXJnZVBsYW4gfSBmcm9tIFwiLi9wbGFuXCI7XG5pbXBvcnQge1xuICBkZWxldGVUZW1wbGF0ZSxcbiAgZnJvbVRhc2ssXG4gIG1hdGVyaWFsaXplVGVtcGxhdGVzLFxuICBwcmludEluc3RhbmNlcyxcbiAgcHJpbnRUZW1wbGF0ZSxcbiAgcmVwbGFjZUFwcERhdGEsXG4gIHNhdmVUZW1wbGF0ZSxcbiAgc3luY1RlbXBsYXRlLFxufSBmcm9tIFwiLi90ZW1wbGF0ZXNcIjtcbmltcG9ydCB7IHBhcnNlTG9ja1N0YXRlLCBzZXJpYWxpemVMb2NrU3RhdGUgfSBmcm9tIFwiLi9sb2NrXCI7XG5pbXBvcnQgeyBwYXJzZUJsb2NrLCBzZXJpYWxpemVCbG9jayB9IGZyb20gXCIuL2Jsb2Nrc1wiO1xuaW1wb3J0IHsgcGFyc2VIYWJpdCwgc2VyaWFsaXplSGFiaXQgfSBmcm9tIFwiLi9oYWJpdHNcIjtcbmltcG9ydCB7IGFkZERheXMsIGRhdGVBdCwgdmFsaWREYXRlIH0gZnJvbSBcIi4vdGltZVwiO1xuXG4vLyAtLS0tLS0tLS0tIFx1NTdGQVx1Nzg0MFx1N0M3Qlx1NTc4Qlx1ODlFM1x1Njc5MC9cdTVFOEZcdTUyMTdcdTUzMTYgLS0tLS0tLS0tLVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm9qZWN0KHJhdzogdW5rbm93bik6IFByb2plY3Qge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OTg3OVx1NzZFRVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTk4NzlcdTc2RUVcIiwgYXNTdHIpLFxuICAgIG5hbWU6IHJlcXVpcmVkRmllbGQocmF3LCBcIm5hbWVcIiwgXCJcdTk4NzlcdTc2RUVcIiwgYXNTdHIpLFxuICAgIGNvbG9yOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb2xvclwiLCBcIlx1OTg3OVx1NzZFRVwiLCBhc1N0ciksXG4gICAgYXBwV2hpdGVsaXN0OiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiYXBwV2hpdGVsaXN0XCIsXG4gICAgICBcIlx1OTg3OVx1NzZFRVwiLFxuICAgICAgKHYpID0+XG4gICAgICAgIGFzT3B0KHYsIFwiYXBwV2hpdGVsaXN0XCIsICh4KSA9PlxuICAgICAgICAgIGFzQXJyYXkoeCwgXCJhcHBXaGl0ZWxpc3RcIikubWFwKChhKSA9PiBhc1N0cihhLCBcIlx1NUU5NFx1NzUyOCBJRFwiKSksXG4gICAgICAgICksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nW10gfCBudWxsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUHJvamVjdChwOiBQcm9qZWN0KTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBvdXQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgIGlkOiBwLmlkLFxuICAgIG5hbWU6IHAubmFtZSxcbiAgICBjb2xvcjogcC5jb2xvcixcbiAgfTtcbiAgaWYgKHAuYXBwV2hpdGVsaXN0ICE9PSBudWxsKSBvdXRbXCJhcHBXaGl0ZWxpc3RcIl0gPSBwLmFwcFdoaXRlbGlzdDtcbiAgcmV0dXJuIG91dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVmlzaW9uKHJhdzogdW5rbm93bik6IFZpc2lvbiB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2MTNGXHU2NjZGXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZWplY3RVbmtub3duKHJhdywgW1wiaWRcIiwgXCJuYW1lXCIsIFwibm90ZXNcIiwgXCJwcm9qZWN0SWRcIl0sIFwiXHU2MTNGXHU2NjZGXCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NjEzRlx1NjY2RlwiLCBhc1N0ciksXG4gICAgbmFtZTogcmVxdWlyZWRGaWVsZChyYXcsIFwibmFtZVwiLCBcIlx1NjEzRlx1NjY2RlwiLCBhc1N0ciksXG4gICAgbm90ZXM6IGZpZWxkKHJhdywgXCJub3Rlc1wiLCBcIlx1NjEzRlx1NjY2RlwiLCBhc1N0ciwgXCJcIiksXG4gICAgcHJvamVjdElkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwicHJvamVjdElkXCIsXG4gICAgICBcIlx1NjEzRlx1NjY2RlwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwicHJvamVjdElkXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplVmlzaW9uKHY6IFZpc2lvbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3Qgb3V0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICBpZDogdi5pZCxcbiAgICBuYW1lOiB2Lm5hbWUsXG4gICAgbm90ZXM6IHYubm90ZXMsXG4gIH07XG4gIGlmICh2LnByb2plY3RJZCAhPT0gbnVsbCkgb3V0W1wicHJvamVjdElkXCJdID0gdi5wcm9qZWN0SWQ7XG4gIHJldHVybiBvdXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVN1YnRhc2socmF3OiB1bmtub3duKTogU3VidGFzayB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1QjUwXHU0RUZCXHU1MkExXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZXR1cm4ge1xuICAgIGlkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJpZFwiLCBcIlx1NUI1MFx1NEVGQlx1NTJBMVwiLCBhc1N0ciksXG4gICAgdGl0bGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpdGxlXCIsIFwiXHU1QjUwXHU0RUZCXHU1MkExXCIsIGFzU3RyKSxcbiAgICBkb25lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJkb25lXCIsIFwiXHU1QjUwXHU0RUZCXHU1MkExXCIsIGFzQm9vbCksXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVTdWJ0YXNrKHM6IFN1YnRhc2spOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IGlkOiBzLmlkLCB0aXRsZTogcy50aXRsZSwgZG9uZTogcy5kb25lIH07XG59XG5cbmNvbnN0IFRBU0tfS0VZUyA9IFtcbiAgXCJpZFwiLFxuICBcInRlbXBsYXRlSWRcIixcbiAgXCJyZWN1cnJpbmdcIixcbiAgXCJ0aXRsZVwiLFxuICBcIm5vdGVzXCIsXG4gIFwicHJvamVjdElkXCIsXG4gIFwiaGFiaXRJZFwiLFxuICBcImR1ZURhdGVcIixcbiAgXCJyZW1pbmRlclRpbWVcIixcbiAgXCJmb2N1c01pbnV0ZXNcIixcbiAgXCJzY3JhcE1pbnV0ZXNcIixcbiAgXCJwcmlvcml0eVwiLFxuICBcImVzdGltYXRlXCIsXG4gIFwicmVtaW5kZXJGaXJlZFwiLFxuICBcInJlbWluZGVyUGVuZGluZ1wiLFxuICBcInJlbWluZGVyRXhwaXJlZFwiLFxuICBcImNvbXBsZXRlZFwiLFxuICBcImNvbXBsZXRlZEF0XCIsXG4gIFwiY3JlYXRlZEF0XCIsXG4gIFwidGFnc1wiLFxuICBcInN1YnRhc2tzXCIsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUYXNrKHJhdzogdW5rbm93bik6IFRhc2sge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEVGQlx1NTJBMVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5UQVNLX0tFWVNdLCBcIlx1NEVGQlx1NTJBMVwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogcmVxdWlyZWRGaWVsZChyYXcsIFwiaWRcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNTdHIpLFxuICAgIHRlbXBsYXRlSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0ZW1wbGF0ZUlkXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwidGVtcGxhdGVJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICByZWN1cnJpbmc6IGZpZWxkKHJhdywgXCJyZWN1cnJpbmdcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNCb29sLCBmYWxzZSksXG4gICAgdGl0bGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpdGxlXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzU3RyKSxcbiAgICBub3RlczogcmVxdWlyZWRGaWVsZChyYXcsIFwibm90ZXNcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNTdHIpLFxuICAgIHByb2plY3RJZDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInByb2plY3RJZFwiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInByb2plY3RJZFwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBoYWJpdElkOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiaGFiaXRJZFwiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcImhhYml0SWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZHVlRGF0ZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImR1ZURhdGVcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJkdWVEYXRlXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHJlbWluZGVyVGltZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJlbWluZGVyVGltZVwiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInJlbWluZGVyVGltZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBmb2N1c01pbnV0ZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJmb2N1c01pbnV0ZXNcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJmb2N1c01pbnV0ZXNcIiwgKHgpID0+IGFzSW50KHgsIFwiZm9jdXNNaW51dGVzXCIpKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICAgIHNjcmFwTWludXRlczogZmllbGQocmF3LCBcInNjcmFwTWludXRlc1wiLCBcIlx1NEVGQlx1NTJBMVwiLCBhc0ludCwgMCksXG4gICAgcHJpb3JpdHk6IHJlcXVpcmVkRmllbGQocmF3LCBcInByaW9yaXR5XCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzSW50KSxcbiAgICBlc3RpbWF0ZTogcmVxdWlyZWRGaWVsZChyYXcsIFwiZXN0aW1hdGVcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNJbnQpLFxuICAgIHJlbWluZGVyRmlyZWQ6IGZpZWxkKHJhdywgXCJyZW1pbmRlckZpcmVkXCIsIFwiXHU0RUZCXHU1MkExXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIHJlbWluZGVyUGVuZGluZzogZmllbGQocmF3LCBcInJlbWluZGVyUGVuZGluZ1wiLCBcIlx1NEVGQlx1NTJBMVwiLCBhc0Jvb2wsIGZhbHNlKSxcbiAgICByZW1pbmRlckV4cGlyZWQ6IGZpZWxkKHJhdywgXCJyZW1pbmRlckV4cGlyZWRcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNCb29sLCBmYWxzZSksXG4gICAgY29tcGxldGVkOiByZXF1aXJlZEZpZWxkKHJhdywgXCJjb21wbGV0ZWRcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNCb29sKSxcbiAgICBjb21wbGV0ZWRBdDogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImNvbXBsZXRlZEF0XCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzT3B0KHYsIFwiY29tcGxldGVkQXRcIiwgYXNJbnQpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIG51bWJlciB8IG51bGwsXG4gICAgY3JlYXRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJjcmVhdGVkQXRcIiwgXCJcdTRFRkJcdTUyQTFcIiwgYXNJbnQpLFxuICAgIHRhZ3M6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YWdzXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0YWdzXCIpLm1hcCgodCkgPT4gYXNTdHIodCwgXCJcdTY4MDdcdTdCN0VcIikpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICBzdWJ0YXNrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInN1YnRhc2tzXCIsXG4gICAgICBcIlx1NEVGQlx1NTJBMVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJzdWJ0YXNrc1wiKS5tYXAocGFyc2VTdWJ0YXNrKSxcbiAgICAgIFtdLFxuICAgICksXG4gIH07XG59XG5cbi8qKlxuICogY2Fub25pY2FsIFx1NEVGQlx1NTJBMVx1NUU4Rlx1NTIxN1x1NTMxNlx1RkYxQVx1OTUyRVx1NUU4Rlx1NEUwRSBSdXN0IGBUYXNrYCBcdTU4RjBcdTY2MEVcdTVFOEZcdTRFMDBcdTgxRjRcdTMwMDJcbiAqIFx1NjRBNFx1OTUwMFx1NjA2Mlx1NTkwRFx1NjI4QVx1OEJFNVx1NEUzMlx1NUI1OFx1OEZEQiBJZGVudGl0eS5yZXN0b3JlVGFza1x1RkYwQ1x1NkJENFx1OEY4M1x1NUZDNVx1OTg3Qlx1OTAxMFx1NUI1N1x1ODI4Mlx1NEUwMFx1ODFGNFx1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplVGFzayh0OiBUYXNrKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiB0LmlkLFxuICAgIHRlbXBsYXRlSWQ6IHQudGVtcGxhdGVJZCxcbiAgICByZWN1cnJpbmc6IHQucmVjdXJyaW5nLFxuICAgIHRpdGxlOiB0LnRpdGxlLFxuICAgIG5vdGVzOiB0Lm5vdGVzLFxuICAgIHByb2plY3RJZDogdC5wcm9qZWN0SWQsXG4gICAgaGFiaXRJZDogdC5oYWJpdElkLFxuICAgIGR1ZURhdGU6IHQuZHVlRGF0ZSxcbiAgICByZW1pbmRlclRpbWU6IHQucmVtaW5kZXJUaW1lLFxuICAgIGZvY3VzTWludXRlczogdC5mb2N1c01pbnV0ZXMsXG4gICAgc2NyYXBNaW51dGVzOiB0LnNjcmFwTWludXRlcyxcbiAgICBwcmlvcml0eTogdC5wcmlvcml0eSxcbiAgICBlc3RpbWF0ZTogdC5lc3RpbWF0ZSxcbiAgICByZW1pbmRlckZpcmVkOiB0LnJlbWluZGVyRmlyZWQsXG4gICAgcmVtaW5kZXJQZW5kaW5nOiB0LnJlbWluZGVyUGVuZGluZyxcbiAgICByZW1pbmRlckV4cGlyZWQ6IHQucmVtaW5kZXJFeHBpcmVkLFxuICAgIGNvbXBsZXRlZDogdC5jb21wbGV0ZWQsXG4gICAgY29tcGxldGVkQXQ6IHQuY29tcGxldGVkQXQsXG4gICAgY3JlYXRlZEF0OiB0LmNyZWF0ZWRBdCxcbiAgICB0YWdzOiB0LnRhZ3MsXG4gICAgc3VidGFza3M6IHQuc3VidGFza3MubWFwKHNlcmlhbGl6ZVN1YnRhc2spLFxuICB9O1xufVxuXG5jb25zdCBUQVNLX0RSQUZUX0tFWVMgPSBbXG4gIFwiaWRcIixcbiAgXCJ0aXRsZVwiLFxuICBcIm5vdGVzXCIsXG4gIFwicHJvamVjdElkXCIsXG4gIFwiZHVlRGF0ZVwiLFxuICBcInJlbWluZGVyVGltZVwiLFxuICBcImZvY3VzTWludXRlc1wiLFxuICBcInNjcmFwTWludXRlc1wiLFxuICBcInByaW9yaXR5XCIsXG4gIFwiZXN0aW1hdGVcIixcbiAgXCJ0YWdzXCIsXG4gIFwic3VidGFza3NcIixcbiAgXCJyZXBlYXRcIixcbl0gYXMgY29uc3Q7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRhc2tEcmFmdChyYXc6IHVua25vd24pOiBUYXNrRHJhZnQge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmVqZWN0VW5rbm93bihyYXcsIFsuLi5UQVNLX0RSQUZUX0tFWVNdLCBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogZmllbGQocmF3LCBcImlkXCIsIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsICh2KSA9PiBhc09wdCh2LCBcImlkXCIsIGFzU3RyKSwgbnVsbCkgYXNcbiAgICAgIHN0cmluZyB8IG51bGwsXG4gICAgdGl0bGU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpdGxlXCIsIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsIGFzU3RyKSxcbiAgICBub3RlczogZmllbGQocmF3LCBcIm5vdGVzXCIsIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsIGFzU3RyLCBcIlwiKSxcbiAgICBwcm9qZWN0SWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJwcm9qZWN0SWRcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJwcm9qZWN0SWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZHVlRGF0ZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImR1ZURhdGVcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJkdWVEYXRlXCIsIGFzU3RyKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBzdHJpbmcgfCBudWxsLFxuICAgIHJlbWluZGVyVGltZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInJlbWluZGVyVGltZVwiLFxuICAgICAgXCJcdTRFRkJcdTUyQTFcdTgzNDlcdTdBM0ZcIixcbiAgICAgICh2KSA9PiBhc09wdCh2LCBcInJlbWluZGVyVGltZVwiLCBhc1N0ciksXG4gICAgICBudWxsLFxuICAgICkgYXMgc3RyaW5nIHwgbnVsbCxcbiAgICBmb2N1c01pbnV0ZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJmb2N1c01pbnV0ZXNcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJmb2N1c01pbnV0ZXNcIiwgKHgpID0+IGFzSW50KHgsIFwiZm9jdXNNaW51dGVzXCIpKSxcbiAgICAgIG51bGwsXG4gICAgKSBhcyBudW1iZXIgfCBudWxsLFxuICAgIHNjcmFwTWludXRlczogZmllbGQocmF3LCBcInNjcmFwTWludXRlc1wiLCBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLCBhc0ludCwgMCksXG4gICAgcHJpb3JpdHk6IGZpZWxkKHJhdywgXCJwcmlvcml0eVwiLCBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLCBhc0ludCwgMCksXG4gICAgZXN0aW1hdGU6IGZpZWxkKHJhdywgXCJlc3RpbWF0ZVwiLCBcIlx1NEVGQlx1NTJBMVx1ODM0OVx1N0EzRlwiLCBhc0ludCwgMSksXG4gICAgdGFnczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInRhZ3NcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInRhZ3NcIikubWFwKCh0KSA9PiBhc1N0cih0LCBcIlx1NjgwN1x1N0I3RVwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHN1YnRhc2tzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwic3VidGFza3NcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInN1YnRhc2tzXCIpLm1hcChwYXJzZVN1YnRhc2spLFxuICAgICAgW10sXG4gICAgKSxcbiAgICByZXBlYXQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJyZXBlYXRcIixcbiAgICAgIFwiXHU0RUZCXHU1MkExXHU4MzQ5XHU3QTNGXCIsXG4gICAgICAodikgPT4gb25lT2YodiwgXCJyZXBlYXRcIiwgW1wibm9uZVwiLCBcImRhaWx5XCIsIFwid2Vla2RheXNcIiwgXCJ3ZWVrbHlcIl0pLFxuICAgICAgXCJub25lXCIsXG4gICAgKSBhcyBSZXBlYXQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhhYml0U2xvdChyYXc6IHVua25vd24pOiBIYWJpdFNsb3Qge1xuICBpZiAoIWlzT2JqZWN0KHJhdykpIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEU2MFx1NjBFRlx1NjVGNlx1NkJCNVx1NUZDNVx1OTg3Qlx1NjYyRlx1NUJGOVx1OEM2MVwiKTtcbiAgcmV0dXJuIHtcbiAgICBkYXlzOiBhc0FycmF5KFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwiZGF5c1wiLCBcIlx1NEU2MFx1NjBFRlx1NjVGNlx1NkJCNVwiLCAodikgPT4gdiksXG4gICAgICBcImRheXNcIixcbiAgICApLm1hcCgoZCkgPT4gYXNJbnQoZCwgXCJcdTRFNjBcdTYwRUZcdTY2MUZcdTY3MUZcIikpLFxuICAgIHRpbWU6IHJlcXVpcmVkRmllbGQocmF3LCBcInRpbWVcIiwgXCJcdTRFNjBcdTYwRUZcdTY1RjZcdTZCQjVcIiwgYXNTdHIpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQcm90ZWN0aW9uKHJhdzogdW5rbm93bik6IHtcbiAgbW9kZTogR3VhcmRNb2RlO1xuICB3aGl0ZWxpc3Q6IHN0cmluZ1tdO1xuICBzdHJpY3Q6IGJvb2xlYW47XG59IHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRGRERcdTYyQTRcdThCQkVcdTdGNkVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJldHVybiB7XG4gICAgbW9kZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcIm1vZGVcIixcbiAgICAgIFwiXHU0RkREXHU2MkE0XHU4QkJFXHU3RjZFXCIsXG4gICAgICAodikgPT4gb25lT2YodiwgXCJcdTRGRERcdTYyQTQgbW9kZVwiLCBbXCJvZmZcIiwgXCJsb2NrXCIsIFwid2hpdGVsaXN0XCJdKSxcbiAgICAgIFwib2ZmXCIsXG4gICAgKSBhcyBHdWFyZE1vZGUsXG4gICAgd2hpdGVsaXN0OiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwid2hpdGVsaXN0XCIsXG4gICAgICBcIlx1NEZERFx1NjJBNFx1OEJCRVx1N0Y2RVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ3aGl0ZWxpc3RcIikubWFwKChhKSA9PiBhc1N0cihhLCBcIlx1NUU5NFx1NzUyOCBJRFwiKSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHN0cmljdDogZmllbGQocmF3LCBcInN0cmljdFwiLCBcIlx1NEZERFx1NjJBNFx1OEJCRVx1N0Y2RVwiLCBhc0Jvb2wsIGZhbHNlKSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVByb3RlY3Rpb24ocDoge1xuICBtb2RlOiBHdWFyZE1vZGU7XG4gIHdoaXRlbGlzdDogc3RyaW5nW107XG4gIHN0cmljdDogYm9vbGVhbjtcbn0pOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7IG1vZGU6IHAubW9kZSwgd2hpdGVsaXN0OiBwLndoaXRlbGlzdCwgc3RyaWN0OiBwLnN0cmljdCB9O1xufVxuXG5jb25zdCBTRVRUSU5HU19LRVlTID0gW1xuICBcImZvY3VzTWludXRlc1wiLFxuICBcInNob3J0QnJlYWtNaW51dGVzXCIsXG4gIFwibG9uZ0JyZWFrTWludXRlc1wiLFxuICBcImxvbmdCcmVha0V2ZXJ5XCIsXG4gIFwiZGFpbHlHb2FsXCIsXG4gIFwiYXV0b0JyZWFrXCIsXG4gIFwiYXV0b0ZvY3VzXCIsXG4gIFwiYXV0b1N0YXJ0VGFza3NcIixcbiAgXCJzb3VuZFwiLFxuICBcInNvdW5kVm9sdW1lXCIsXG4gIFwibm90aWZpY2F0aW9uc1wiLFxuICBcImFsd2F5c09uVG9wXCIsXG4gIFwidGhlbWVcIixcbiAgXCJwZXJzb25hQmFja2Ryb3BcIixcbiAgXCJwcm90ZWN0aW9uXCIsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTZXR0aW5ncyhyYXc6IHVua25vd24pOiBTZXR0aW5ncyB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkJFXHU3RjZFXHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZXR1cm4ge1xuICAgIGZvY3VzTWludXRlczogcmVxdWlyZWRGaWVsZChyYXcsIFwiZm9jdXNNaW51dGVzXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzSW50KSxcbiAgICBzaG9ydEJyZWFrTWludXRlczogcmVxdWlyZWRGaWVsZChyYXcsIFwic2hvcnRCcmVha01pbnV0ZXNcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNJbnQpLFxuICAgIGxvbmdCcmVha01pbnV0ZXM6IHJlcXVpcmVkRmllbGQocmF3LCBcImxvbmdCcmVha01pbnV0ZXNcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNJbnQpLFxuICAgIGxvbmdCcmVha0V2ZXJ5OiByZXF1aXJlZEZpZWxkKHJhdywgXCJsb25nQnJlYWtFdmVyeVwiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0ludCksXG4gICAgZGFpbHlHb2FsOiByZXF1aXJlZEZpZWxkKHJhdywgXCJkYWlseUdvYWxcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNJbnQpLFxuICAgIGF1dG9CcmVhazogcmVxdWlyZWRGaWVsZChyYXcsIFwiYXV0b0JyZWFrXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzQm9vbCksXG4gICAgYXV0b0ZvY3VzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhdXRvRm9jdXNcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNCb29sKSxcbiAgICBhdXRvU3RhcnRUYXNrczogZmllbGQocmF3LCBcImF1dG9TdGFydFRhc2tzXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIHNvdW5kOiByZXF1aXJlZEZpZWxkKHJhdywgXCJzb3VuZFwiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0Jvb2wpLFxuICAgIHNvdW5kVm9sdW1lOiBmaWVsZChyYXcsIFwic291bmRWb2x1bWVcIiwgXCJcdThCQkVcdTdGNkVcIiwgYXNJbnQsIDEwMCksXG4gICAgbm90aWZpY2F0aW9uczogcmVxdWlyZWRGaWVsZChyYXcsIFwibm90aWZpY2F0aW9uc1wiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0Jvb2wpLFxuICAgIGFsd2F5c09uVG9wOiByZXF1aXJlZEZpZWxkKHJhdywgXCJhbHdheXNPblRvcFwiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc0Jvb2wpLFxuICAgIHRoZW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aGVtZVwiLCBcIlx1OEJCRVx1N0Y2RVwiLCBhc1N0ciksXG4gICAgcGVyc29uYUJhY2tkcm9wOiBmaWVsZChyYXcsIFwicGVyc29uYUJhY2tkcm9wXCIsIFwiXHU4QkJFXHU3RjZFXCIsIGFzQm9vbCwgZmFsc2UpLFxuICAgIHByb3RlY3Rpb246IGZpZWxkKHJhdywgXCJwcm90ZWN0aW9uXCIsIFwiXHU4QkJFXHU3RjZFXCIsIHBhcnNlUHJvdGVjdGlvbiwge1xuICAgICAgbW9kZTogXCJvZmZcIixcbiAgICAgIHdoaXRlbGlzdDogW10sXG4gICAgICBzdHJpY3Q6IGZhbHNlLFxuICAgIH0pLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU2V0dGluZ3MoczogU2V0dGluZ3MpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgZm9jdXNNaW51dGVzOiBzLmZvY3VzTWludXRlcyxcbiAgICBzaG9ydEJyZWFrTWludXRlczogcy5zaG9ydEJyZWFrTWludXRlcyxcbiAgICBsb25nQnJlYWtNaW51dGVzOiBzLmxvbmdCcmVha01pbnV0ZXMsXG4gICAgbG9uZ0JyZWFrRXZlcnk6IHMubG9uZ0JyZWFrRXZlcnksXG4gICAgZGFpbHlHb2FsOiBzLmRhaWx5R29hbCxcbiAgICBhdXRvQnJlYWs6IHMuYXV0b0JyZWFrLFxuICAgIGF1dG9Gb2N1czogcy5hdXRvRm9jdXMsXG4gICAgYXV0b1N0YXJ0VGFza3M6IHMuYXV0b1N0YXJ0VGFza3MsXG4gICAgc291bmQ6IHMuc291bmQsXG4gICAgc291bmRWb2x1bWU6IHMuc291bmRWb2x1bWUsXG4gICAgbm90aWZpY2F0aW9uczogcy5ub3RpZmljYXRpb25zLFxuICAgIGFsd2F5c09uVG9wOiBzLmFsd2F5c09uVG9wLFxuICAgIHRoZW1lOiBzLnRoZW1lLFxuICAgIHBlcnNvbmFCYWNrZHJvcDogcy5wZXJzb25hQmFja2Ryb3AsXG4gICAgcHJvdGVjdGlvbjogc2VyaWFsaXplUHJvdGVjdGlvbihzLnByb3RlY3Rpb24pLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVmYXVsdFNldHRpbmdzKCk6IFNldHRpbmdzIHtcbiAgcmV0dXJuIHtcbiAgICBmb2N1c01pbnV0ZXM6IDI1LFxuICAgIHNob3J0QnJlYWtNaW51dGVzOiA1LFxuICAgIGxvbmdCcmVha01pbnV0ZXM6IDE1LFxuICAgIGxvbmdCcmVha0V2ZXJ5OiA0LFxuICAgIGRhaWx5R29hbDogOCxcbiAgICBhdXRvQnJlYWs6IGZhbHNlLFxuICAgIGF1dG9Gb2N1czogZmFsc2UsXG4gICAgYXV0b1N0YXJ0VGFza3M6IGZhbHNlLFxuICAgIHNvdW5kOiB0cnVlLFxuICAgIHNvdW5kVm9sdW1lOiAxMDAsXG4gICAgbm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICBhbHdheXNPblRvcDogZmFsc2UsXG4gICAgdGhlbWU6IFwibGlnaHRcIixcbiAgICBwZXJzb25hQmFja2Ryb3A6IGZhbHNlLFxuICAgIHByb3RlY3Rpb246IHsgbW9kZTogXCJvZmZcIiwgd2hpdGVsaXN0OiBbXSwgc3RyaWN0OiBmYWxzZSB9LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUaW1lcihyYXc6IHVua25vd24pOiBUaW1lciB7XG4gIGlmICghaXNPYmplY3QocmF3KSkgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkExXHU2NUY2XHU1NjY4XHU1RkM1XHU5ODdCXHU2NjJGXHU1QkY5XHU4QzYxXCIpO1xuICByZXR1cm4ge1xuICAgIG1vZGU6IG9uZU9mKFxuICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwibW9kZVwiLCBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLCAodikgPT4gdiksXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1NTY2OCBtb2RlXCIsXG4gICAgICBbXCJmb2N1c1wiLCBcInNob3J0QnJlYWtcIiwgXCJsb25nQnJlYWtcIl0sXG4gICAgKSBhcyBNb2RlLFxuICAgIHJ1bm5pbmc6IHJlcXVpcmVkRmllbGQocmF3LCBcInJ1bm5pbmdcIiwgXCJcdThCQTFcdTY1RjZcdTU2NjhcIiwgYXNCb29sKSxcbiAgICB0YXNrSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YXNrSWRcIixcbiAgICAgIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJ0YXNrSWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgZHVyYXRpb25TZWNzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJkdXJhdGlvblNlY3NcIiwgXCJcdThCQTFcdTY1RjZcdTU2NjhcIiwgYXNJbnQpLFxuICAgIHJlbWFpbmluZ1NlY3M6IHJlcXVpcmVkRmllbGQocmF3LCBcInJlbWFpbmluZ1NlY3NcIiwgXCJcdThCQTFcdTY1RjZcdTU2NjhcIiwgYXNJbnQpLFxuICAgIGRlYWRsaW5lOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiZGVhZGxpbmVcIixcbiAgICAgIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJkZWFkbGluZVwiLCBhc0ludCksXG4gICAgICBudWxsLFxuICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICBzdGFydGVkQXQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzdGFydGVkQXRcIixcbiAgICAgIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJzdGFydGVkQXRcIiwgYXNJbnQpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIG51bWJlciB8IG51bGwsXG4gICAgY3ljbGU6IHJlcXVpcmVkRmllbGQocmF3LCBcImN5Y2xlXCIsIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsIGFzSW50KSxcbiAgICBjeWNsZURhdGU6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJjeWNsZURhdGVcIixcbiAgICAgIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJjeWNsZURhdGVcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgY29tcGxldGlvblNlcmlhbDogcmVxdWlyZWRGaWVsZChyYXcsIFwiY29tcGxldGlvblNlcmlhbFwiLCBcIlx1OEJBMVx1NjVGNlx1NTY2OFwiLCBhc0ludCksXG4gICAgbGFzdEZpbmlzaGVkTW9kZTogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImxhc3RGaW5pc2hlZE1vZGVcIixcbiAgICAgIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsXG4gICAgICAodikgPT5cbiAgICAgICAgYXNPcHQodiwgXCJsYXN0RmluaXNoZWRNb2RlXCIsICh4KSA9PlxuICAgICAgICAgIG9uZU9mKHgsIFwibGFzdEZpbmlzaGVkTW9kZVwiLCBbXCJmb2N1c1wiLCBcInNob3J0QnJlYWtcIiwgXCJsb25nQnJlYWtcIl0pLFxuICAgICAgICApLFxuICAgICAgbnVsbCxcbiAgICApIGFzIE1vZGUgfCBudWxsLFxuICAgIGF1dG9Gb2N1c0Jsb2NrZWQ6IGZpZWxkKHJhdywgXCJhdXRvRm9jdXNCbG9ja2VkXCIsIFwiXHU4QkExXHU2NUY2XHU1NjY4XCIsIGFzQm9vbCwgZmFsc2UpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplVGltZXIodDogVGltZXIpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgbW9kZTogdC5tb2RlLFxuICAgIHJ1bm5pbmc6IHQucnVubmluZyxcbiAgICB0YXNrSWQ6IHQudGFza0lkLFxuICAgIGR1cmF0aW9uU2VjczogdC5kdXJhdGlvblNlY3MsXG4gICAgcmVtYWluaW5nU2VjczogdC5yZW1haW5pbmdTZWNzLFxuICAgIGRlYWRsaW5lOiB0LmRlYWRsaW5lLFxuICAgIHN0YXJ0ZWRBdDogdC5zdGFydGVkQXQsXG4gICAgY3ljbGU6IHQuY3ljbGUsXG4gICAgY3ljbGVEYXRlOiB0LmN5Y2xlRGF0ZSxcbiAgICBjb21wbGV0aW9uU2VyaWFsOiB0LmNvbXBsZXRpb25TZXJpYWwsXG4gICAgbGFzdEZpbmlzaGVkTW9kZTogdC5sYXN0RmluaXNoZWRNb2RlLFxuICAgIGF1dG9Gb2N1c0Jsb2NrZWQ6IHQuYXV0b0ZvY3VzQmxvY2tlZCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZmF1bHRUaW1lcigpOiBUaW1lciB7XG4gIHJldHVybiB7XG4gICAgbW9kZTogXCJmb2N1c1wiLFxuICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgIHRhc2tJZDogbnVsbCxcbiAgICBkdXJhdGlvblNlY3M6IDE1MDAsXG4gICAgcmVtYWluaW5nU2VjczogMTUwMCxcbiAgICBkZWFkbGluZTogbnVsbCxcbiAgICBzdGFydGVkQXQ6IG51bGwsXG4gICAgY3ljbGU6IDAsXG4gICAgY3ljbGVEYXRlOiBudWxsLFxuICAgIGNvbXBsZXRpb25TZXJpYWw6IDAsXG4gICAgbGFzdEZpbmlzaGVkTW9kZTogbnVsbCxcbiAgICBhdXRvRm9jdXNCbG9ja2VkOiBmYWxzZSxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU2Vzc2lvbihyYXc6IHVua25vd24pOiBTZXNzaW9uIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIHJldHVybiB7XG4gICAgaWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImlkXCIsIFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsIGFzU3RyKSxcbiAgICBzb3VyY2U6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJzb3VyY2VcIixcbiAgICAgIFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsXG4gICAgICAodikgPT4gb25lT2YodiwgXCJzb3VyY2VcIiwgW1widGltZXJcIiwgXCJ0YXNrRXN0aW1hdGVcIl0pLFxuICAgICAgXCJ0aW1lclwiLFxuICAgICkgYXMgU2Vzc2lvblNvdXJjZSxcbiAgICB0YXNrSWQ6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0YXNrSWRcIixcbiAgICAgIFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsXG4gICAgICAodikgPT4gYXNPcHQodiwgXCJ0YXNrSWRcIiwgYXNTdHIpLFxuICAgICAgbnVsbCxcbiAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgdGFza1RpdGxlOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0YXNrVGl0bGVcIiwgXCJcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcIiwgYXNTdHIpLFxuICAgIHByb2plY3ROYW1lOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9qZWN0TmFtZVwiLCBcIlx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLCBhc1N0ciksXG4gICAgc3RhcnRlZEF0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdGFydGVkQXRcIiwgXCJcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcIiwgYXNJbnQpLFxuICAgIGVuZGVkQXQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImVuZGVkQXRcIiwgXCJcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcIiwgYXNJbnQpLFxuICAgIGR1cmF0aW9uU2VjczogcmVxdWlyZWRGaWVsZChyYXcsIFwiZHVyYXRpb25TZWNzXCIsIFwiXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsIGFzSW50KSxcbiAgICBjb21wbGV0ZWQ6IHJlcXVpcmVkRmllbGQocmF3LCBcImNvbXBsZXRlZFwiLCBcIlx1NEUxM1x1NkNFOFx1OEJCMFx1NUY1NVwiLCBhc0Jvb2wpLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU2Vzc2lvbihzOiBTZXNzaW9uKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4ge1xuICAgIGlkOiBzLmlkLFxuICAgIHNvdXJjZTogcy5zb3VyY2UsXG4gICAgdGFza0lkOiBzLnRhc2tJZCxcbiAgICB0YXNrVGl0bGU6IHMudGFza1RpdGxlLFxuICAgIHByb2plY3ROYW1lOiBzLnByb2plY3ROYW1lLFxuICAgIHN0YXJ0ZWRBdDogcy5zdGFydGVkQXQsXG4gICAgZW5kZWRBdDogcy5lbmRlZEF0LFxuICAgIGR1cmF0aW9uU2Vjczogcy5kdXJhdGlvblNlY3MsXG4gICAgY29tcGxldGVkOiBzLmNvbXBsZXRlZCxcbiAgfTtcbn1cblxuLy8gLS0tLS0tLS0tLSBBcHBEYXRhIC0tLS0tLS0tLS1cblxuZXhwb3J0IGNsYXNzIEFwcERhdGEge1xuICBlZHVjYXRpb246IEVkdWNhdGlvbjtcbiAgdmVyc2lvbjogbnVtYmVyO1xuICBpZGVudGl0aWVzOiBJZGVudGl0eVtdO1xuICB0YXNrczogVGFza1tdO1xuICBibG9ja3M6IEJsb2NrW107XG4gIHRlbXBsYXRlczogVGVtcGxhdGVbXTtcbiAgcHJpbnRzOiB7IHRlbXBsYXRlSWQ6IHN0cmluZzsgZGF0ZTogc3RyaW5nIHwgbnVsbCB9W107XG4gIHByb2plY3RzOiBQcm9qZWN0W107XG4gIGhhYml0czogSGFiaXRbXTtcbiAgdmlzaW9uczogVmlzaW9uW107XG4gIHNldHRpbmdzOiBTZXR0aW5ncztcbiAgdGltZXI6IFRpbWVyO1xuICBzZXNzaW9uczogU2Vzc2lvbltdO1xuICBsb2NrOiBMb2NrU3RhdGU7XG5cbiAgY29uc3RydWN0b3IoaW5pdD86IFBhcnRpYWw8UGljazxBcHBEYXRhLCBrZXlvZiBBcHBEYXRhPj4pIHtcbiAgICB0aGlzLmVkdWNhdGlvbiA9IGluaXQ/LmVkdWNhdGlvbiA/PyBuZXcgRWR1Y2F0aW9uKCk7XG4gICAgdGhpcy52ZXJzaW9uID0gaW5pdD8udmVyc2lvbiA/PyA0O1xuICAgIHRoaXMuaWRlbnRpdGllcyA9IGluaXQ/LmlkZW50aXRpZXMgPz8gW107XG4gICAgdGhpcy50YXNrcyA9IGluaXQ/LnRhc2tzID8/IFtdO1xuICAgIHRoaXMuYmxvY2tzID0gaW5pdD8uYmxvY2tzID8/IFtdO1xuICAgIHRoaXMudGVtcGxhdGVzID0gaW5pdD8udGVtcGxhdGVzID8/IFtdO1xuICAgIHRoaXMucHJpbnRzID0gaW5pdD8ucHJpbnRzID8/IFtdO1xuICAgIHRoaXMucHJvamVjdHMgPSBpbml0Py5wcm9qZWN0cyA/PyBbXG4gICAgICB7IGlkOiBpZCgpLCBuYW1lOiBcIlx1NURFNVx1NEY1Q1wiLCBjb2xvcjogXCIjZGY3NTYxXCIsIGFwcFdoaXRlbGlzdDogbnVsbCB9LFxuICAgICAgeyBpZDogaWQoKSwgbmFtZTogXCJcdTVCNjZcdTRFNjBcIiwgY29sb3I6IFwiIzg0OWI3ZFwiLCBhcHBXaGl0ZWxpc3Q6IG51bGwgfSxcbiAgICAgIHsgaWQ6IGlkKCksIG5hbWU6IFwiXHU3NTFGXHU2RDNCXCIsIGNvbG9yOiBcIiNkNWE1NTNcIiwgYXBwV2hpdGVsaXN0OiBudWxsIH0sXG4gICAgXTtcbiAgICB0aGlzLmhhYml0cyA9IGluaXQ/LmhhYml0cyA/PyBbXTtcbiAgICB0aGlzLnZpc2lvbnMgPSBpbml0Py52aXNpb25zID8/IFtdO1xuICAgIHRoaXMuc2V0dGluZ3MgPSBpbml0Py5zZXR0aW5ncyA/PyBkZWZhdWx0U2V0dGluZ3MoKTtcbiAgICB0aGlzLnRpbWVyID0gaW5pdD8udGltZXIgPz8gZGVmYXVsdFRpbWVyKCk7XG4gICAgdGhpcy5zZXNzaW9ucyA9IGluaXQ/LnNlc3Npb25zID8/IFtdO1xuICAgIHRoaXMubG9jayA9IGluaXQ/LmxvY2sgPz8ge1xuICAgICAgc2NoZWR1bGVzOiBbXSxcbiAgICAgIGFjdGl2ZTogbnVsbCxcbiAgICAgIHN1cHByZXNzZWRVbnRpbDogMCxcbiAgICB9O1xuICB9XG5cbiAgcHJvdGVjdGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmxvY2suYWN0aXZlICE9PSBudWxsIHx8XG4gICAgICAodGhpcy50aW1lci5ydW5uaW5nICYmXG4gICAgICAgIHRoaXMudGltZXIubW9kZSA9PT0gXCJmb2N1c1wiICYmXG4gICAgICAgIHRoaXMuc2V0dGluZ3MucHJvdGVjdGlvbi5tb2RlICE9PSBcIm9mZlwiKVxuICAgICk7XG4gIH1cblxuICAvKiogXHU3NjdEXHU1NDBEXHU1MzU1XHU0RTEzXHU2Q0U4XHU2NUY2XHU3NTFGXHU2NTQ4XHU3Njg0XHU1RTk0XHU3NTI4XHU2RTA1XHU1MzU1XHVGRjFBXHU5ODc5XHU3NkVFXHU0RTEzXHU1QzVFXHU2RTA1XHU1MzU1XHU2NkZGXHU0RUUzXHU5MDFBXHU3NTI4XHU2RTA1XHU1MzU1XHUzMDAyICovXG4gIGVmZmVjdGl2ZVdoaXRlbGlzdCgpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgcHJvamVjdCA9ICgoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrSWQgPSB0aGlzLnRpbWVyLnRhc2tJZDtcbiAgICAgIGlmICh0YXNrSWQgPT09IG51bGwpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICBjb25zdCB0YXNrID0gdGhpcy50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSB0YXNrSWQpO1xuICAgICAgaWYgKHRhc2sgPT09IHVuZGVmaW5lZCB8fCB0YXNrLnByb2plY3RJZCA9PT0gbnVsbCkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiB0aGlzLnByb2plY3RzLmZpbmQoKHApID0+IHAuaWQgPT09IHRhc2sucHJvamVjdElkKTtcbiAgICB9KSgpO1xuICAgIGNvbnN0IGxpc3QgPSBwcm9qZWN0Py5hcHBXaGl0ZWxpc3Q7XG4gICAgcmV0dXJuIGxpc3QgIT09IG51bGwgJiYgbGlzdCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IFsuLi5saXN0XVxuICAgICAgOiBbLi4udGhpcy5zZXR0aW5ncy5wcm90ZWN0aW9uLndoaXRlbGlzdF07XG4gIH1cblxuICB0YXNrSXNWb2lkKHRhc2s6IFRhc2spOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGFza0lzVm9pZCh0YXNrKTtcbiAgfVxuXG4gIHN0cmljdFByb3RlY3RlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKFxuICAgICAgKHRoaXMubG9jay5hY3RpdmUgIT09IG51bGwgJiYgdGhpcy5sb2NrLmFjdGl2ZS5zdHJpY3QpIHx8XG4gICAgICAodGhpcy50aW1lci5ydW5uaW5nICYmXG4gICAgICAgIHRoaXMudGltZXIubW9kZSA9PT0gXCJmb2N1c1wiICYmXG4gICAgICAgIHRoaXMuc2V0dGluZ3MucHJvdGVjdGlvbi5tb2RlICE9PSBcIm9mZlwiICYmXG4gICAgICAgIHRoaXMuc2V0dGluZ3MucHJvdGVjdGlvbi5zdHJpY3QpXG4gICAgKTtcbiAgfVxuXG4gIGR1cmF0aW9uT2YobW9kZTogTW9kZSk6IG51bWJlciB7XG4gICAgcmV0dXJuIGR1cmF0aW9uT2YodGhpcywgbW9kZSk7XG4gIH1cblxuICB0YXNrSGFzUm91bmRzTGVmdCh0YXNrOiBUYXNrKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRhc2tIYXNSb3VuZHNMZWZ0KHRoaXMsIHRhc2spO1xuICB9XG5cbiAgcmVzZXRUbyhtb2RlOiBNb2RlKTogdm9pZCB7XG4gICAgcmVzZXRUbyh0aGlzLCBtb2RlKTtcbiAgfVxuXG4gIHN0YXJ0KGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgICBzdGFydFRpbWVyKHRoaXMsIGF0KTtcbiAgfVxuXG4gIHJlY29yZChhdDogbnVtYmVyLCBjb21wbGV0ZWQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICByZWNvcmRTZXNzaW9uKHRoaXMsIGF0LCBjb21wbGV0ZWQpO1xuICB9XG5cbiAgcmVmcmVzaEN5Y2xlKGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBkYXRlID0gZGF0ZUF0KGF0KTtcbiAgICBpZiAodGhpcy50aW1lci5jeWNsZURhdGUgPT09IGRhdGUpIHJldHVybiBmYWxzZTtcbiAgICB0aGlzLnRpbWVyLmN5Y2xlID0gdGhpcy5zZXNzaW9ucy5maWx0ZXIoXG4gICAgICAocykgPT4gcy5jb21wbGV0ZWQgJiYgZGF0ZUF0KHMuZW5kZWRBdCkgPT09IGRhdGUsXG4gICAgKS5sZW5ndGg7XG4gICAgdGhpcy50aW1lci5jeWNsZURhdGUgPSBkYXRlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqIFx1NTA1Q1x1NjczQVx1NTQwRVx1NjcwMFx1NTkxQVx1NjNBOFx1OEZEQlx1NEUwMFx1NEUyQVx1OTYzNlx1NkJCNVx1RkYxQVx1N0VERFx1NEUwRFx1NEYyQVx1OTAyMFx1NjVFMFx1NEVCQVx1NTAzQ1x1NUI4OFx1NzY4NFx1NEUxM1x1NkNFOFx1NEYxQVx1OEJERFx1MzAwMiAqL1xuICB0aWNrKGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCB0ZWFjaGluZ0NoYW5nZWQgPSB0aGlzLmVkdWNhdGlvbi50aWNrKGF0KTtcbiAgICBjb25zdCB0ZWFjaGluZ1Rhc2tzQ2hhbmdlZCA9IG1hdGVyaWFsaXplVGVhY2hpbmdUYXNrcyh0aGlzLCBhdCk7XG4gICAgY29uc3QgbWF0ZXJpYWxpemVkID1cbiAgICAgIG1hdGVyaWFsaXplVGVtcGxhdGVzKHRoaXMsIGF0KSB8fCB0ZWFjaGluZ0NoYW5nZWQgfHwgdGVhY2hpbmdUYXNrc0NoYW5nZWQ7XG4gICAgY29uc3QgcmVtaW5kZXJzQ2hhbmdlZCA9IHRpY2tSZW1pbmRlcnModGhpcywgYXQpO1xuICAgIGNvbnN0IGNoYW5nZWQgPSB0aGlzLnRpY2tXaXRoTG9jayhhdCkgfHwgbWF0ZXJpYWxpemVkO1xuICAgIGNvbnN0IGN5Y2xlQ2hhbmdlZCA9IHRoaXMucmVmcmVzaEN5Y2xlKGF0KTtcbiAgICBpZiAoXG4gICAgICBjeWNsZUNoYW5nZWQgJiZcbiAgICAgIHRoaXMudGltZXIuY3ljbGUgPT09IDAgJiZcbiAgICAgIHRoaXMudGltZXIubW9kZSAhPT0gXCJmb2N1c1wiICYmXG4gICAgICAhdGhpcy50aW1lci5ydW5uaW5nICYmXG4gICAgICB0aGlzLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbCAmJlxuICAgICAgdGhpcy50aW1lci5yZW1haW5pbmdTZWNzID09PSB0aGlzLnRpbWVyLmR1cmF0aW9uU2Vjc1xuICAgICkge1xuICAgICAgdGhpcy5yZXNldFRvKFwiZm9jdXNcIik7XG4gICAgfVxuICAgIHJldHVybiAoXG4gICAgICBzdGFydER1ZVRhc2sodGhpcywgYXQpIHx8IHJlbWluZGVyc0NoYW5nZWQgfHwgY2hhbmdlZCB8fCBjeWNsZUNoYW5nZWRcbiAgICApO1xuICB9XG5cbiAgdGlja1dpdGhMb2NrKGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBwcmV2aW91cyA9IEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZUxvY2tTdGF0ZSh0aGlzLmxvY2spKTtcbiAgICBpZiAodGhpcy5sb2NrLmFjdGl2ZSAhPT0gbnVsbCAmJiBhdCA+PSB0aGlzLmxvY2suYWN0aXZlLmVuZHNBdCkge1xuICAgICAgdGhpcy5sb2NrLmFjdGl2ZSA9IG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHNjaGVkdWxlZCA9IHNjaGVkdWxlZEF0KHRoaXMubG9jaywgYXQpO1xuICAgIGlmIChzY2hlZHVsZWQgIT09IG51bGwpIHtcbiAgICAgIGlmICh0aGlzLmxvY2suYWN0aXZlICE9PSBudWxsKSB7XG4gICAgICAgIHNjaGVkdWxlZC5zdGFydGVkQXQgPSBNYXRoLm1pbihcbiAgICAgICAgICB0aGlzLmxvY2suYWN0aXZlLnN0YXJ0ZWRBdCxcbiAgICAgICAgICBzY2hlZHVsZWQuc3RhcnRlZEF0LFxuICAgICAgICApO1xuICAgICAgICBzY2hlZHVsZWQuZW5kc0F0ID0gTWF0aC5tYXgodGhpcy5sb2NrLmFjdGl2ZS5lbmRzQXQsIHNjaGVkdWxlZC5lbmRzQXQpO1xuICAgICAgICBzY2hlZHVsZWQuc3RyaWN0ID0gc2NoZWR1bGVkLnN0cmljdCB8fCB0aGlzLmxvY2suYWN0aXZlLnN0cmljdDtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jay5hY3RpdmUgPSBzY2hlZHVsZWQ7XG4gICAgfVxuICAgIGNvbnN0IGNoYW5nZWQgPSBwcmV2aW91cyAhPT0gSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplTG9ja1N0YXRlKHRoaXMubG9jaykpO1xuICAgIGlmICh0aGlzLmxvY2suYWN0aXZlICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBzdGFydCA9IHRoaXMubG9jay5hY3RpdmUuc3RhcnRlZEF0O1xuICAgICAgaWYgKHRoaXMudGltZXIucnVubmluZykge1xuICAgICAgICBjb25zdCBzdG9wID0gTWF0aC5taW4oXG4gICAgICAgICAgTWF0aC5tYXgoc3RhcnQsIHRoaXMudGltZXIuc3RhcnRlZEF0ID8/IHN0YXJ0KSxcbiAgICAgICAgICBhdCxcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy50aWNrVGltZXIoc3RvcCk7XG4gICAgICAgIHRoaXMucmVjb3JkKHN0b3AsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5yZXNldFRvKFwiZm9jdXNcIik7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNoYW5nZWQ7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRpY2tUaW1lcihhdCkgfHwgY2hhbmdlZDtcbiAgfVxuXG4gIHRpY2tUaW1lcihhdDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKCF0aGlzLnRpbWVyLnJ1bm5pbmcgfHwgdGltZXJSZW1haW5pbmcodGhpcy50aW1lciwgYXQpID4gMCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbmQgPSB0aGlzLnRpbWVyLmRlYWRsaW5lID8/IGF0O1xuICAgIHRoaXMuZmluaXNoVGltZXIoZW5kLCBhdCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmaW5pc2hUaW1lcihlbmQ6IG51bWJlciwgYXQ6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGZpbmlzaGVkID0gdGhpcy50aW1lci5tb2RlO1xuICAgIGNvbnN0IGNvbnRpbnVhdGlvbkJsb2NrZWQgPSB0aGlzLnRpbWVyLmF1dG9Gb2N1c0Jsb2NrZWQ7XG4gICAgaWYgKGZpbmlzaGVkID09PSBcImZvY3VzXCIpIHtcbiAgICAgIHRoaXMucmVmcmVzaEN5Y2xlKGVuZCk7XG4gICAgfVxuICAgIHRoaXMucmVjb3JkKGVuZCwgdHJ1ZSk7XG4gICAgaWYgKGZpbmlzaGVkID09PSBcImZvY3VzXCIpIHtcbiAgICAgIHRoaXMudGltZXIuY3ljbGUgPSBNYXRoLm1pbih0aGlzLnRpbWVyLmN5Y2xlICsgMSwgNDI5NDk2NzI5NSk7XG4gICAgfVxuICAgIGNvbnN0IG5leHQ6IE1vZGUgPVxuICAgICAgZmluaXNoZWQgPT09IFwiZm9jdXNcIlxuICAgICAgICA/IHRoaXMudGltZXIuY3ljbGUgJSB0aGlzLnNldHRpbmdzLmxvbmdCcmVha0V2ZXJ5ID09PSAwXG4gICAgICAgICAgPyBcImxvbmdCcmVha1wiXG4gICAgICAgICAgOiBcInNob3J0QnJlYWtcIlxuICAgICAgICA6IFwiZm9jdXNcIjtcbiAgICB0aGlzLnJlc2V0VG8obmV4dCk7XG4gICAgdGhpcy50aW1lci5jb21wbGV0aW9uU2VyaWFsID0gTWF0aC5taW4oXG4gICAgICB0aGlzLnRpbWVyLmNvbXBsZXRpb25TZXJpYWwgKyAxLFxuICAgICAgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsXG4gICAgKTtcbiAgICB0aGlzLnRpbWVyLmxhc3RGaW5pc2hlZE1vZGUgPSBmaW5pc2hlZDtcbiAgICBjb25zdCBhdXRvID1cbiAgICAgIG5leHQgPT09IFwiZm9jdXNcIlxuICAgICAgICA/IHRoaXMuc2V0dGluZ3MuYXV0b0ZvY3VzICYmXG4gICAgICAgICAgIWNvbnRpbnVhdGlvbkJsb2NrZWQgJiZcbiAgICAgICAgICAodGhpcy50aW1lci50YXNrSWQgPT09IG51bGwgfHxcbiAgICAgICAgICAgICgoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHRhc2sgPSB0aGlzLnRhc2tzLmZpbmQoKHQpID0+IHQuaWQgPT09IHRoaXMudGltZXIudGFza0lkKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHRhc2sgIT09IHVuZGVmaW5lZCAmJiB0aGlzLnRhc2tIYXNSb3VuZHNMZWZ0KHRhc2spO1xuICAgICAgICAgICAgfSkoKSkgJiZcbiAgICAgICAgICAhKHRoaXMuc2V0dGluZ3MuYXV0b1N0YXJ0VGFza3MgJiYgZHVlQXV0b1Rhc2sodGhpcykgIT09IG51bGwpXG4gICAgICAgIDogdGhpcy5zZXR0aW5ncy5hdXRvQnJlYWs7XG4gICAgLy8gXHU4MUVBXHU1MkE4XHU3RUVEXHU2M0E1XHU1M0VBXHU1QzVFXHU0RThFXHU2RDNCXHU3NzQwXHU3Njg0XHU1RTk0XHU3NTI4XHVGRjBDXHU0RTBEXHU1RjI1XHU4ODY1XHU1MTczXHU2NzNBL1x1Nzc2MVx1NzcyMFx1NzY4NFx1NjVGNlx1OTVGNFx1MzAwMlxuICAgIGlmIChhdXRvICYmIGF0IC0gZW5kIDwgNSkge1xuICAgICAgdGhpcy5zdGFydChhdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFx1OTg4NFx1NjhDMCArIFx1NjI2N1x1ODg0QyArIFx1NjU1OVx1NUI2Nlx1NUY4NVx1NTI5RVx1NzUxRlx1NjIxMCArIFx1NTE2OFx1OTFDRlx1NjgyMVx1OUE4Q1x1MzAwMiAqL1xuICBhcHBseShhY3Rpb246IEFjdGlvbiwgYXQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMudGljayhhdCk7XG4gICAgaWYgKHRoaXMuc3RyaWN0UHJvdGVjdGVkKCkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEUyNVx1NjgzQ1x1NkEyMVx1NUYwRlx1NzUxRlx1NjU0OFx1NEUyRFx1RkYwQ1x1NEUwRFx1ODBGRFx1NjNEMFx1NTI0RFx1N0VEM1x1Njc1Rlx1NjIxNlx1NEZFRVx1NjUzOVx1RkYxQlx1NTIzMFx1NjVGNlx1ODFFQVx1NTJBOFx1ODlFM1x1OTY2NFwiKTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgdGhpcy5wcm90ZWN0ZWQoKSAmJlxuICAgICAgYWN0aW9uLnR5cGUgIT09IFwiZW1lcmdlbmN5VW5sb2NrXCIgJiZcbiAgICAgIGFjdGlvbi50eXBlICE9PSBcImNvbXBsZXRlRm9jdXNcIlxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICBcIlx1NEUxM1x1NkNFOFx1NEZERFx1NjJBNFx1NEUyRFx1RkYwQ1x1N0VEM1x1Njc1Rlx1NTI0RFx1NEUwRFx1ODBGRFx1NEZFRVx1NjUzOVx1NEVGQlx1NTJBMVx1NjIxNlx1OEJBMVx1NjVGNlx1RkYxQlx1NTNFRlx1NjNEMFx1NTI0RFx1NUI4Q1x1NjIxMFx1NzU2QVx1ODMwNFx1NjIxNlx1N0QyN1x1NjAyNVx1OTAwMFx1NTFGQVwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgc3dpdGNoIChhY3Rpb24udHlwZSkge1xuICAgICAgY2FzZSBcImVkdWNhdGlvblwiOiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBhY3Rpb24uY29tbWFuZC5vcCA9PT0gXCJzdGFydEV4YW1cIiAmJlxuICAgICAgICAgICghdGhpcy5yZW1pbmRlcklkbGUoKSB8fFxuICAgICAgICAgICAgdGhpcy50aW1lci5tb2RlICE9PSBcImZvY3VzXCIgfHxcbiAgICAgICAgICAgIHRoaXMudGltZXIucmVtYWluaW5nU2VjcyAhPT0gdGhpcy50aW1lci5kdXJhdGlvblNlY3MpXG4gICAgICAgICkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1OEJGN1x1NTE0OFx1N0VEM1x1Njc1Rlx1NUY1M1x1NTI0RFx1OEJBMVx1NjVGNlx1NjIxNlx1OTUwMVx1NjczQVx1RkYwQ1x1NTE4RFx1NUYwMFx1NTlDQlx1ODAwM1x1OEJENVwiKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVkdWNhdGlvbi5hcHBseShhY3Rpb24uY29tbWFuZCwgYXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJwcmludEluc3RhbmNlc1wiOlxuICAgICAgICBwcmludEluc3RhbmNlcyh0aGlzLCBhY3Rpb24uc2hhcGUsIGFjdGlvbi5wcmludGluZywgYXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJzYXZlVGVtcGxhdGVcIjoge1xuICAgICAgICBjb25zdCBpZCA9IGFjdGlvbi50ZW1wbGF0ZS5pZDtcbiAgICAgICAgc2F2ZVRlbXBsYXRlKHRoaXMsIGFjdGlvbi50ZW1wbGF0ZSk7XG4gICAgICAgIHRoaXMudmFsaWRhdGUoKTtcbiAgICAgICAgaWYgKGFjdGlvbi5wcmludERhdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBwcmludFRlbXBsYXRlKHRoaXMsIGlkLCBhY3Rpb24ucHJpbnREYXRlcywgYXQpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImRlbGV0ZVRlbXBsYXRlXCI6XG4gICAgICAgIGRlbGV0ZVRlbXBsYXRlKHRoaXMsIGFjdGlvbi5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInByaW50VGVtcGxhdGVcIjpcbiAgICAgICAgcHJpbnRUZW1wbGF0ZSh0aGlzLCBhY3Rpb24uaWQsIGFjdGlvbi5kYXRlcywgYXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJzeW5jVGVtcGxhdGVcIjpcbiAgICAgICAgc3luY1RlbXBsYXRlKHRoaXMsIGFjdGlvbi5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInN0YXJ0UmVtaW5kZXJcIjoge1xuICAgICAgICBpZiAoIXRoaXMucmVtaW5kZXJJZGxlKCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCRjdcdTUxNDhcdTdFRDNcdTY3NUZcdTVGNTNcdTUyNERcdThCQTFcdTY1RjZcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdCA9IHRoaXMudGFza3MuZmluZChcbiAgICAgICAgICAoeCkgPT4geC5pZCA9PT0gYWN0aW9uLmlkICYmICF4LmNvbXBsZXRlZCAmJiB4LnJlbWluZGVyUGVuZGluZyxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjNEMFx1OTE5Mlx1NURGMlx1NTkzMVx1NjU0OFwiKTtcbiAgICAgICAgfVxuICAgICAgICB0LnJlbWluZGVyUGVuZGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnRpbWVyLnRhc2tJZCA9IGFjdGlvbi5pZDtcbiAgICAgICAgdGhpcy5yZXNldFRvKFwiZm9jdXNcIik7XG4gICAgICAgIHN0YXJ0VGVhY2hpbmdUYXNrKHRoaXMsIGF0KTtcbiAgICAgICAgdGhpcy5zdGFydChhdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImVtZXJnZW5jeVVubG9ja1wiOiB7XG4gICAgICAgIHRoaXMucmVjb3JkKGF0LCBmYWxzZSk7XG4gICAgICAgIHRoaXMucmVzZXRUbyhcImZvY3VzXCIpO1xuICAgICAgICByZWxlYXNlTG9jayh0aGlzLmxvY2ssIGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiY29tcGxldGVGb2N1c1wiOiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0aGlzLmxvY2suYWN0aXZlICE9PSBudWxsIHx8XG4gICAgICAgICAgdGhpcy50aW1lci5tb2RlICE9PSBcImZvY3VzXCIgfHxcbiAgICAgICAgICB0aGlzLnRpbWVyLnN0YXJ0ZWRBdCA9PT0gbnVsbFxuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTVGNTNcdTUyNERcdTZDQTFcdTY3MDlcdTUzRUZcdTYzRDBcdTUyNERcdTVCOENcdTYyMTBcdTc2ODRcdTRFMTNcdTZDRThcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRpbWVyUmVtYWluaW5nKHRoaXMudGltZXIsIGF0KSA9PT0gdGhpcy50aW1lci5kdXJhdGlvblNlY3MpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTVDMUFcdTY1RTBcdTRFMTNcdTZDRThcdTc1MjhcdTY1RjZcdUZGMENcdThCRjdcdTdBMERcdTU0MEVcdTUxOERcdTVCOENcdTYyMTBcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5maW5pc2hUaW1lcihhdCwgYXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlTG9ja1NjaGVkdWxlXCI6IHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxvY2suc2NoZWR1bGVzLmZpbmRJbmRleChcbiAgICAgICAgICAocykgPT4gcy5pZCA9PT0gYWN0aW9uLnNjaGVkdWxlLmlkLFxuICAgICAgICApO1xuICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgIHRoaXMubG9jay5zY2hlZHVsZXNbaW5kZXhdID0gYWN0aW9uLnNjaGVkdWxlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMubG9jay5zY2hlZHVsZXMucHVzaChhY3Rpb24uc2NoZWR1bGUpO1xuICAgICAgICB9XG4gICAgICAgIHZhbGlkYXRlTG9jayh0aGlzLmxvY2spO1xuICAgICAgICB0aGlzLnRpY2soYXQpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJkZWxldGVMb2NrU2NoZWR1bGVcIjpcbiAgICAgICAgdGhpcy5sb2NrLnNjaGVkdWxlcyA9IHRoaXMubG9jay5zY2hlZHVsZXMuZmlsdGVyKFxuICAgICAgICAgIChzKSA9PiBzLmlkICE9PSBhY3Rpb24uaWQsXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInN0YXJ0UXVpY2tMb2NrXCI6IHtcbiAgICAgICAgaWYgKGFjdGlvbi5taW51dGVzIDwgMSB8fCBhY3Rpb24ubWludXRlcyA+IDcyMCkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NUZFQlx1OTAxRlx1OTUwMVx1NjczQVx1NjVGNlx1OTU3Rlx1OTcwMFx1NEUzQSAxXHUyMDEzNzIwIFx1NTIwNlx1OTQ5RlwiKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlY29yZChhdCwgZmFsc2UpO1xuICAgICAgICB0aGlzLnJlc2V0VG8oXCJmb2N1c1wiKTtcbiAgICAgICAgdGhpcy5sb2NrLmFjdGl2ZSA9IHtcbiAgICAgICAgICBuYW1lOiBcIlx1NUMwRlx1NjFBOVwiLFxuICAgICAgICAgIHN0YXJ0ZWRBdDogYXQsXG4gICAgICAgICAgZW5kc0F0OiBhdCArIGFjdGlvbi5taW51dGVzICogNjAsXG4gICAgICAgICAgc3RyaWN0OiBhY3Rpb24uc3RyaWN0LFxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlVGFza1wiOiB7XG4gICAgICAgIGNvbnN0IGQgPSBhY3Rpb24udGFzaztcbiAgICAgICAgaWYgKGQuaWQgIT09IG51bGwgJiYgdGVhY2hpbmdUYXNrKHRoaXMsIGQuaWQpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgICAgICBcIlx1NjU1OVx1NUI2Nlx1NUY4NVx1NTI5RVx1OTY4Rlx1OEJGRVx1N0EwQlx1NjIxNlx1NEY1Q1x1NEUxQVx1NUI4OVx1NjM5Mlx1NjZGNFx1NjVCMFx1RkYwQ1x1OEJGN1x1OEMwM1x1NjU3NFx1NUJGOVx1NUU5NFx1NjU1OVx1NUI2Nlx1NUI4OVx1NjM5MlwiLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZXhpc3RpbmdJbmRleCA9XG4gICAgICAgICAgZC5pZCAhPT0gbnVsbCA/IHRoaXMudGFza3MuZmluZEluZGV4KCh0KSA9PiB0LmlkID09PSBkLmlkKSA6IC0xO1xuICAgICAgICBpZiAoZC5pZCAhPT0gbnVsbCAmJiBleGlzdGluZ0luZGV4IDwgMCkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEVGQlx1NTJBMVx1NEUwRFx1NUI1OFx1NTcyOFx1RkYwQ1x1NTNFRlx1ODBGRFx1NURGMlx1N0VDRlx1ODhBQlx1NTIyMFx1OTY2NFwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvbGQgPSBleGlzdGluZ0luZGV4ID49IDAgPyB0aGlzLnRhc2tzW2V4aXN0aW5nSW5kZXhdISA6IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgdGFzazogVGFzayA9IHtcbiAgICAgICAgICB0ZW1wbGF0ZUlkOiBvbGQ/LnRlbXBsYXRlSWQgPz8gbnVsbCxcbiAgICAgICAgICByZWN1cnJpbmc6IG9sZD8ucmVjdXJyaW5nID8/IGZhbHNlLFxuICAgICAgICAgIGlkOiBkLmlkID8/IGlkKCksXG4gICAgICAgICAgdGl0bGU6IGQudGl0bGUudHJpbSgpLFxuICAgICAgICAgIG5vdGVzOiBkLm5vdGVzLFxuICAgICAgICAgIHByb2plY3RJZDogZC5wcm9qZWN0SWQsXG4gICAgICAgICAgaGFiaXRJZDogb2xkPy5oYWJpdElkID8/IG51bGwsXG4gICAgICAgICAgcmVtaW5kZXJGaXJlZDpcbiAgICAgICAgICAgIG9sZCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBvbGQuZHVlRGF0ZSA9PT0gZC5kdWVEYXRlICYmXG4gICAgICAgICAgICBvbGQucmVtaW5kZXJUaW1lID09PSBkLnJlbWluZGVyVGltZSAmJlxuICAgICAgICAgICAgb2xkLnJlbWluZGVyRmlyZWQsXG4gICAgICAgICAgcmVtaW5kZXJQZW5kaW5nOlxuICAgICAgICAgICAgb2xkICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIG9sZC5kdWVEYXRlID09PSBkLmR1ZURhdGUgJiZcbiAgICAgICAgICAgIG9sZC5yZW1pbmRlclRpbWUgPT09IGQucmVtaW5kZXJUaW1lICYmXG4gICAgICAgICAgICBvbGQucmVtaW5kZXJQZW5kaW5nLFxuICAgICAgICAgIHJlbWluZGVyRXhwaXJlZDpcbiAgICAgICAgICAgIG9sZCAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBvbGQuZHVlRGF0ZSA9PT0gZC5kdWVEYXRlICYmXG4gICAgICAgICAgICBvbGQucmVtaW5kZXJUaW1lID09PSBkLnJlbWluZGVyVGltZSAmJlxuICAgICAgICAgICAgb2xkLnJlbWluZGVyRXhwaXJlZCxcbiAgICAgICAgICBzY3JhcE1pbnV0ZXM6IGQuc2NyYXBNaW51dGVzLFxuICAgICAgICAgIGZvY3VzTWludXRlczogZC5mb2N1c01pbnV0ZXMsXG4gICAgICAgICAgcmVtaW5kZXJUaW1lOiBkLnJlbWluZGVyVGltZSxcbiAgICAgICAgICBkdWVEYXRlOiBkLmR1ZURhdGUsXG4gICAgICAgICAgcHJpb3JpdHk6IGQucHJpb3JpdHksXG4gICAgICAgICAgZXN0aW1hdGU6IGQuZXN0aW1hdGUsXG4gICAgICAgICAgY29tcGxldGVkOiBvbGQ/LmNvbXBsZXRlZCA/PyBmYWxzZSxcbiAgICAgICAgICBjb21wbGV0ZWRBdDogb2xkPy5jb21wbGV0ZWRBdCA/PyBudWxsLFxuICAgICAgICAgIGNyZWF0ZWRBdDogb2xkPy5jcmVhdGVkQXQgPz8gYXQsXG4gICAgICAgICAgdGFnczogZC50YWdzLm1hcCgodCkgPT4gdC50cmltKCkpLmZpbHRlcigodCkgPT4gdC5sZW5ndGggPiAwKSxcbiAgICAgICAgICBzdWJ0YXNrczogZC5zdWJ0YXNrcy5tYXAoKHMpID0+ICh7XG4gICAgICAgICAgICBpZDogcy5pZCxcbiAgICAgICAgICAgIHRpdGxlOiBzLnRpdGxlLFxuICAgICAgICAgICAgZG9uZTogcy5kb25lLFxuICAgICAgICAgIH0pKSxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGQucmVwZWF0ICE9PSBcIm5vbmVcIikge1xuICAgICAgICAgIGNvbnN0IHRlbXBsYXRlID0gZnJvbVRhc2sodGFzaywgZC5yZXBlYXQsIGF0KTtcbiAgICAgICAgICB0YXNrLnRlbXBsYXRlSWQgPSB0ZW1wbGF0ZS5pZDtcbiAgICAgICAgICB0YXNrLnJlY3VycmluZyA9IHRydWU7XG4gICAgICAgICAgdGhpcy5wcmludHMucHVzaCh7IHRlbXBsYXRlSWQ6IHRlbXBsYXRlLmlkLCBkYXRlOiB0YXNrLmR1ZURhdGUgfSk7XG4gICAgICAgICAgdGhpcy50ZW1wbGF0ZXMucHVzaCh0ZW1wbGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4aXN0aW5nSW5kZXggPj0gMCkge1xuICAgICAgICAgIHRoaXMudGFza3NbZXhpc3RpbmdJbmRleF0gPSB0YXNrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudGFza3MucHVzaCh0YXNrKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJ0b2dnbGVUYXNrXCI6IHtcbiAgICAgICAgY29uc3QgdGFza0lkID0gYWN0aW9uLmlkO1xuICAgICAgICBpZiAodGhpcy50YXNrcy5zb21lKCh0KSA9PiB0LmlkID09PSB0YXNrSWQgJiYgdGhpcy50YXNrSXNWb2lkKHQpKSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEY1Q1x1NUU5Rlx1NUI5RVx1NEY4Qlx1NEUwRFx1ODBGRFx1NUI4Q1x1NjIxMFwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXNrID0gdGhpcy50YXNrcy5maW5kKCh0KSA9PiB0LmlkID09PSB0YXNrSWQpO1xuICAgICAgICBlbnN1cmUodGFzayAhPT0gdW5kZWZpbmVkLCBcIlx1NEVGQlx1NTJBMVx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgY29uc3QgdGFza0NvcHk6IFRhc2sgPSB7XG4gICAgICAgICAgLi4udGFzayxcbiAgICAgICAgICB0YWdzOiBbLi4udGFzay50YWdzXSxcbiAgICAgICAgICBzdWJ0YXNrczogdGFzay5zdWJ0YXNrcy5tYXAoKHMpID0+ICh7IC4uLnMgfSkpLFxuICAgICAgICB9O1xuICAgICAgICBpZiAodGVhY2hpbmdUYXNrKHRoaXMsIHRhc2tJZCkgIT09IHVuZGVmaW5lZCAmJiAhdGFza0NvcHkuY29tcGxldGVkKSB7XG4gICAgICAgICAgY29tcGxldGVUZWFjaGluZ1Rhc2sodGhpcywgdGFza0lkLCBhdCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gXHU3RUQzXHU3Qjk3XHU1QkY5XHU2QkQ0XHU1MjREXHU1MTQ4XHU3RUQzXHU2RTA1XHU2NzJDXHU0RUZCXHU1MkExXHU4QkExXHU2NUY2XHVGRjBDXHU5MDdGXHU1MTREXHU5MUNEXHU1OTBEXHU3RDJGXHU4QkExXHUzMDAyXG4gICAgICAgIGlmICghdGFza0NvcHkuY29tcGxldGVkICYmIHRoaXMudGltZXIudGFza0lkID09PSB0YXNrSWQpIHtcbiAgICAgICAgICBjb25zdCBmb2N1c2luZyA9IHRoaXMudGltZXIubW9kZSA9PT0gXCJmb2N1c1wiO1xuICAgICAgICAgIGlmIChmb2N1c2luZykge1xuICAgICAgICAgICAgdGhpcy5yZWNvcmQoYXQsIGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy50aW1lci50YXNrSWQgPSBudWxsO1xuICAgICAgICAgIGlmIChmb2N1c2luZykge1xuICAgICAgICAgICAgdGhpcy5yZXNldFRvKFwiZm9jdXNcIik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudGltZXIuYXV0b0ZvY3VzQmxvY2tlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2Vzc2lvbnMgPSB0aGlzLnNlc3Npb25zLmZpbHRlcihcbiAgICAgICAgICAocykgPT4gIShzLnNvdXJjZSA9PT0gXCJ0YXNrRXN0aW1hdGVcIiAmJiBzLnRhc2tJZCA9PT0gdGFza0lkKSxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKCF0YXNrQ29weS5jb21wbGV0ZWQpIHtcbiAgICAgICAgICBjb25zdCBhY3R1YWwgPSB0aGlzLnNlc3Npb25zXG4gICAgICAgICAgICAuZmlsdGVyKChzKSA9PiBzLnRhc2tJZCA9PT0gdGFza0lkKVxuICAgICAgICAgICAgLnJlZHVjZSgobiwgcykgPT4gbiArIHMuZHVyYXRpb25TZWNzLCAwKTtcbiAgICAgICAgICBjb25zdCBleHBlY3RlZCA9XG4gICAgICAgICAgICB0YXNrQ29weS5lc3RpbWF0ZSAqXG4gICAgICAgICAgICAodGFza0NvcHkuZm9jdXNNaW51dGVzID8/IHRoaXMuc2V0dGluZ3MuZm9jdXNNaW51dGVzKSAqXG4gICAgICAgICAgICA2MDtcbiAgICAgICAgICBjb25zdCBtaXNzaW5nID0gTWF0aC5tYXgoMCwgZXhwZWN0ZWQgLSBhY3R1YWwpO1xuICAgICAgICAgIGlmIChtaXNzaW5nID4gMCkge1xuICAgICAgICAgICAgY29uc3QgcHJvamVjdCA9XG4gICAgICAgICAgICAgIHRhc2tDb3B5LnByb2plY3RJZCAhPT0gbnVsbFxuICAgICAgICAgICAgICAgID8gdGhpcy5wcm9qZWN0cy5maW5kKChwKSA9PiBwLmlkID09PSB0YXNrQ29weS5wcm9qZWN0SWQpXG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB0aGlzLnNlc3Npb25zLnB1c2goe1xuICAgICAgICAgICAgICBpZDogaWQoKSxcbiAgICAgICAgICAgICAgc291cmNlOiBcInRhc2tFc3RpbWF0ZVwiLFxuICAgICAgICAgICAgICB0YXNrSWQsXG4gICAgICAgICAgICAgIHRhc2tUaXRsZTogdGFza0NvcHkudGl0bGUsXG4gICAgICAgICAgICAgIHByb2plY3ROYW1lOiBwcm9qZWN0Py5uYW1lID8/IFwiXHU2NzJBXHU1MjA2XHU3QzdCXCIsXG4gICAgICAgICAgICAgIHN0YXJ0ZWRBdDogYXQsXG4gICAgICAgICAgICAgIGVuZGVkQXQ6IGF0LFxuICAgICAgICAgICAgICBkdXJhdGlvblNlY3M6IG1pc3NpbmcsXG4gICAgICAgICAgICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdCA9IHRoaXMudGFza3MuZmluZCgoeCkgPT4geC5pZCA9PT0gdGFza0lkKSE7XG4gICAgICAgIHQuY29tcGxldGVkID0gIXQuY29tcGxldGVkO1xuICAgICAgICB0LmNvbXBsZXRlZEF0ID0gdC5jb21wbGV0ZWQgPyBhdCA6IG51bGw7XG4gICAgICAgIGlmICh0LmNvbXBsZXRlZCkge1xuICAgICAgICAgIHRoaXMuZWR1Y2F0aW9uLnRhc2tDb21wbGV0ZWQodCwgYXQpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImRlbGV0ZVRhc2tcIjoge1xuICAgICAgICBpZiAodGVhY2hpbmdUYXNrKHRoaXMsIGFjdGlvbi5pZCkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjU1OVx1NUI2Nlx1NUY4NVx1NTI5RVx1NzUzMVx1NUJGOVx1NUU5NFx1OEJGRVx1N0EwQlx1NjIxNlx1NEY1Q1x1NEUxQVx1N0VGNFx1NjJBNFx1RkYwQ1x1NEUwRFx1ODBGRFx1NTM1NVx1NzJFQ1x1NTIyMFx1OTY2NFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMudGFza3Muc29tZSgodCkgPT4gdC5pZCA9PT0gYWN0aW9uLmlkKSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEVGQlx1NTJBMVx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy50aW1lci50YXNrSWQgPT09IGFjdGlvbi5pZCkge1xuICAgICAgICAgIHRoaXMucmVjb3JkKGF0LCBmYWxzZSk7XG4gICAgICAgICAgdGhpcy5yZXNldFRvKHRoaXMudGltZXIubW9kZSk7XG4gICAgICAgICAgdGhpcy50aW1lci50YXNrSWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGFza3MgPSB0aGlzLnRhc2tzLmZpbHRlcigodCkgPT4gdC5pZCAhPT0gYWN0aW9uLmlkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicmVzdG9yZVRhc2tcIjoge1xuICAgICAgICBjb25zdCB0YXNrID0gYWN0aW9uLnRhc2s7XG4gICAgICAgIGlmICh0aGlzLnRhc2tzLnNvbWUoKHQpID0+IHQuaWQgPT09IHRhc2suaWQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RUZCXHU1MkExXHU1REYyXHU3RUNGXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0YXNrLnByb2plY3RJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgICF0aGlzLnByb2plY3RzLnNvbWUoKHApID0+IHAuaWQgPT09IHRhc2sucHJvamVjdElkKVxuICAgICAgICApIHtcbiAgICAgICAgICB0YXNrLnByb2plY3RJZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRhc2sudGVtcGxhdGVJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgICF0aGlzLnRlbXBsYXRlcy5zb21lKCh0KSA9PiB0LmlkID09PSB0YXNrLnRlbXBsYXRlSWQpXG4gICAgICAgICkge1xuICAgICAgICAgIHRhc2sudGVtcGxhdGVJZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRhc2suaGFiaXRJZCAhPT0gbnVsbCAmJlxuICAgICAgICAgICF0aGlzLmhhYml0cy5zb21lKChoKSA9PiBoLmlkID09PSB0YXNrLmhhYml0SWQpXG4gICAgICAgICkge1xuICAgICAgICAgIC8vIFx1NTkzMVx1NTNCQlx1NUJCOVx1NTY2OFx1NTNFQVx1NzlGQlx1OTY2NFx1N0JBMVx1OEY5Nlx1RkYxQlx1NTFCQlx1N0VEM1x1Njc2NVx1NkU5MFx1NEVDRFx1NTcyOFx1RkYwQ1x1NTM4Nlx1NTNGMlx1NTIwNlx1N0M3Qlx1NEUwRFx1NTNEOFx1MzAwMlxuICAgICAgICAgIHRhc2suaGFiaXRJZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50YXNrcy5wdXNoKHRhc2spO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJ0b2dnbGVTdWJ0YXNrXCI6IHtcbiAgICAgICAgY29uc3Qgc3ViID0gdGhpcy50YXNrc1xuICAgICAgICAgIC5maW5kKCh0KSA9PiB0LmlkID09PSBhY3Rpb24udGFza0lkKVxuICAgICAgICAgID8uc3VidGFza3MuZmluZCgocykgPT4gcy5pZCA9PT0gYWN0aW9uLnN1YnRhc2tJZCk7XG4gICAgICAgIGVuc3VyZShzdWIgIT09IHVuZGVmaW5lZCwgXCJcdTVCNTBcdTRFRkJcdTUyQTFcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgIHN1Yi5kb25lID0gIXN1Yi5kb25lO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlUHJvamVjdFwiOiB7XG4gICAgICAgIGlmIChhY3Rpb24uaWQgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBwID0gdGhpcy5wcm9qZWN0cy5maW5kKCh4KSA9PiB4LmlkID09PSBhY3Rpb24uaWQpO1xuICAgICAgICAgIGVuc3VyZShwICE9PSB1bmRlZmluZWQsIFwiXHU5ODc5XHU3NkVFXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICAgIHAubmFtZSA9IGFjdGlvbi5uYW1lLnRyaW0oKTtcbiAgICAgICAgICBwLmNvbG9yID0gYWN0aW9uLmNvbG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVuc3VyZShcbiAgICAgICAgICAgIGFjdGlvbi5kaXJlY3RvcnkgIT09IG51bGwgJiYgaXNBYnNvbHV0ZVBhdGgoYWN0aW9uLmRpcmVjdG9yeSksXG4gICAgICAgICAgICBcIlx1NjVCMFx1OTg3OVx1NzZFRVx1NUZDNVx1OTg3Qlx1N0VEMVx1NUI5QVx1OEQ0NFx1NjU5OVx1NzZFRVx1NUY1NVx1RkYxQlx1OEJGN1x1NTcyOFx1OTg3OVx1NzZFRVx1OTg3NVx1OTAwOVx1NjJFOVx1NzZFRVx1NUY1NVx1NUU3Nlx1NjM4OFx1Njc0M1wiLFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgcHJvamVjdElkID0gaWQoKTtcbiAgICAgICAgICB0aGlzLmVkdWNhdGlvbi5wcm9qZWN0cy5wdXNoKHtcbiAgICAgICAgICAgIHByb2plY3RJZCxcbiAgICAgICAgICAgIGRpcmVjdG9yeTogYWN0aW9uLmRpcmVjdG9yeSxcbiAgICAgICAgICAgIGV4YW1Nb2RlOiBmYWxzZSxcbiAgICAgICAgICAgIHZpc2lvbklkOiBudWxsLFxuICAgICAgICAgICAgdGFyZ2V0OiBcIlwiLFxuICAgICAgICAgICAgZXhhbURhdGU6IG51bGwsXG4gICAgICAgICAgICBzeWxsYWJ1c0lkOiBudWxsLFxuICAgICAgICAgICAgcGFzdFBhcGVySWRzOiBbXSxcbiAgICAgICAgICAgIG1vY2tQYXBlcklkczogW10sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5wcm9qZWN0cy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBwcm9qZWN0SWQsXG4gICAgICAgICAgICBuYW1lOiBhY3Rpb24ubmFtZS50cmltKCksXG4gICAgICAgICAgICBjb2xvcjogYWN0aW9uLmNvbG9yLFxuICAgICAgICAgICAgYXBwV2hpdGVsaXN0OiBudWxsLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInJlbmFtZVByb2plY3REaXJlY3RvcnlcIjoge1xuICAgICAgICBjb25zdCBwcm9qZWN0ID0gdGhpcy5wcm9qZWN0cy5maW5kKCh4KSA9PiB4LmlkID09PSBhY3Rpb24uaWQpO1xuICAgICAgICBlbnN1cmUocHJvamVjdCAhPT0gdW5kZWZpbmVkLCBcIlx1OTg3OVx1NzZFRVx1NEUwRFx1NUI1OFx1NTcyOFwiKTtcbiAgICAgICAgY29uc3QgcHJvZmlsZSA9IHRoaXMuZWR1Y2F0aW9uLnByb2plY3RzLmZpbmQoXG4gICAgICAgICAgKHApID0+IHAucHJvamVjdElkID09PSBhY3Rpb24uaWQsXG4gICAgICAgICk7XG4gICAgICAgIGVuc3VyZShwcm9maWxlICE9PSB1bmRlZmluZWQsIFwiXHU5ODc5XHU3NkVFXHU2Q0ExXHU2NzA5XHU3RUQxXHU1QjlBXHU4RDQ0XHU2NTk5XHU3NkVFXHU1RjU1XCIpO1xuICAgICAgICBlbnN1cmUoaXNBYnNvbHV0ZVBhdGgoYWN0aW9uLmRpcmVjdG9yeSksIFwiXHU4RDQ0XHU2NTk5XHU3NkVFXHU1RjU1XHU1RkM1XHU5ODdCXHU2NjJGXHU3RUREXHU1QkY5XHU4REVGXHU1Rjg0XCIpO1xuICAgICAgICBwcm9qZWN0Lm5hbWUgPSBhY3Rpb24ubmFtZS50cmltKCk7XG4gICAgICAgIHByb2plY3QuY29sb3IgPSBhY3Rpb24uY29sb3I7XG4gICAgICAgIHByb2ZpbGUuZGlyZWN0b3J5ID0gYWN0aW9uLmRpcmVjdG9yeTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2V0UHJvamVjdFdoaXRlbGlzdFwiOiB7XG4gICAgICAgIGNvbnN0IHAgPSB0aGlzLnByb2plY3RzLmZpbmQoKHgpID0+IHguaWQgPT09IGFjdGlvbi5pZCk7XG4gICAgICAgIGVuc3VyZShwICE9PSB1bmRlZmluZWQsIFwiXHU5ODc5XHU3NkVFXHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICBwLmFwcFdoaXRlbGlzdCA9XG4gICAgICAgICAgYWN0aW9uLndoaXRlbGlzdCA9PT0gbnVsbCA/IG51bGwgOiBbLi4uYWN0aW9uLndoaXRlbGlzdF07XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImRlbGV0ZVByb2plY3RcIjoge1xuICAgICAgICBpZiAodGhpcy5lZHVjYXRpb24uc2VtZXN0ZXJzLnNvbWUoKHMpID0+IHMucHJvamVjdElkID09PSBhY3Rpb24uaWQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgICAgXCJcdTk4NzlcdTc2RUVcdTVERjJcdTY3MDlcdTY1NTlcdTVCNjZcdTUzODZcdTUzRjJcdUZGMENcdThCRjdcdTRGRERcdTc1NTlcdThCQjBcdTVGNTVcdTVFNzZcdTUwNUNcdTc1MjhcdTVFOTRcdThCRDVcdTZBMjFcdTVGMEZcdUZGMUJcdThENDRcdTY1OTlcdTc2RUVcdTVGNTVcdTRFMERcdTRGMUFcdTg4QUJcdTUyMjBcdTk2NjRcIixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZWR1Y2F0aW9uLnByb2plY3RzID0gdGhpcy5lZHVjYXRpb24ucHJvamVjdHMuZmlsdGVyKFxuICAgICAgICAgIChwKSA9PiBwLnByb2plY3RJZCAhPT0gYWN0aW9uLmlkLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmVkdWNhdGlvbi5yZXNvdXJjZXMgPSB0aGlzLmVkdWNhdGlvbi5yZXNvdXJjZXMuZmlsdGVyKFxuICAgICAgICAgIChwKSA9PiBwLnByb2plY3RJZCAhPT0gYWN0aW9uLmlkLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLnByb2plY3RzID0gdGhpcy5wcm9qZWN0cy5maWx0ZXIoKHApID0+IHAuaWQgIT09IGFjdGlvbi5pZCk7XG4gICAgICAgIGZvciAoY29uc3QgdGFzayBvZiB0aGlzLnRhc2tzKSB7XG4gICAgICAgICAgaWYgKHRhc2sucHJvamVjdElkID09PSBhY3Rpb24uaWQpIHRhc2sucHJvamVjdElkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHRlbXBsYXRlIG9mIHRoaXMudGVtcGxhdGVzKSB7XG4gICAgICAgICAgaWYgKHRlbXBsYXRlLnNoYXBlLnByb2plY3RJZCA9PT0gYWN0aW9uLmlkKVxuICAgICAgICAgICAgdGVtcGxhdGUuc2hhcGUucHJvamVjdElkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnZpc2lvbnMgPSB0aGlzLnZpc2lvbnMuZmlsdGVyKChhKSA9PiBhLnByb2plY3RJZCAhPT0gYWN0aW9uLmlkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicmVvcmRlclByb2plY3RzXCI6IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGFjdGlvbi5pZHMubGVuZ3RoICE9PSB0aGlzLnByb2plY3RzLmxlbmd0aCB8fFxuICAgICAgICAgICFhY3Rpb24uaWRzLmV2ZXJ5KChwaWQpID0+IHRoaXMucHJvamVjdHMuc29tZSgocCkgPT4gcC5pZCA9PT0gcGlkKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU5ODc5XHU3NkVFXHU2MzkyXHU1RThGXHU1MjE3XHU4ODY4XHU0RTBFXHU3M0IwXHU2NzA5XHU5ODc5XHU3NkVFXHU0RTBEXHU0RTAwXHU4MUY0XCIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvamVjdHMgPSBhY3Rpb24uaWRzLm1hcCgocGlkKSA9PlxuICAgICAgICAgIHRoaXMucHJvamVjdHMuZmluZCgocCkgPT4gcC5pZCA9PT0gcGlkKSEsXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImRldGFjaFRhc2tzXCI6IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGFjdGlvbi5pZHMuc29tZSgodGFza0lkKSA9PiB0ZWFjaGluZ1Rhc2sodGhpcywgdGFza0lkKSAhPT0gdW5kZWZpbmVkKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1NTlcdTVCNjZcdTVGODVcdTUyOUVcdTk4N0JcdTRGRERcdTc1NTlcdTY3NjVcdTZFOTBcdTk4NzlcdTc2RUVcdUZGMENcdThCRjdcdThDMDNcdTY1NzRcdTVCRjlcdTVFOTRcdTY1NTlcdTVCNjZcdTVCODlcdTYzOTJcIik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCB0IG9mIHRoaXMudGFza3MpIHtcbiAgICAgICAgICBpZiAoYWN0aW9uLmlkcy5pbmNsdWRlcyh0LmlkKSkge1xuICAgICAgICAgICAgaWYgKGFjdGlvbi50YXJnZXQgPT09IFwicHJvamVjdFwiKSB0LnByb2plY3RJZCA9IG51bGw7XG4gICAgICAgICAgICBlbHNlIHQuaGFiaXRJZCA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNhdmVIYWJpdEdyb3VwXCI6IHtcbiAgICAgICAgaWYgKGFjdGlvbi5pZCAhPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnN0IGggPSB0aGlzLmhhYml0cy5maW5kKCh4KSA9PiB4LmlkID09PSBhY3Rpb24uaWQpO1xuICAgICAgICAgIGVuc3VyZShoICE9PSB1bmRlZmluZWQsIFwiXHU0RTYwXHU2MEVGXHU3RUM0XHU0RTBEXHU1QjU4XHU1NzI4XCIpO1xuICAgICAgICAgIGgubmFtZSA9IGFjdGlvbi5uYW1lLnRyaW0oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmhhYml0cy5wdXNoKHsgaWQ6IGlkKCksIG5hbWU6IGFjdGlvbi5uYW1lLnRyaW0oKSB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlSGFiaXRcIjoge1xuICAgICAgICBjb25zdCBoaWQgPSBhY3Rpb24uaWQgPz8gaWQoKTtcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmhhYml0cy5maW5kKChoKSA9PiBoLmlkID09PSBoaWQpO1xuICAgICAgICBpZiAoZXhpc3RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGV4aXN0aW5nLm5hbWUgPSBhY3Rpb24ubmFtZS50cmltKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5oYWJpdHMucHVzaCh7IGlkOiBoaWQsIG5hbWU6IGFjdGlvbi5uYW1lLnRyaW0oKSB9KTtcbiAgICAgICAgfVxuICAgICAgICBzYXZlVGVtcGxhdGUodGhpcywge1xuICAgICAgICAgIGlkOiBgaGFiaXQ6JHtoaWR9YCxcbiAgICAgICAgICBhdXRvbWF0aWM6IHRydWUsXG4gICAgICAgICAgcHJpbnRBaGVhZERheXM6IDAsXG4gICAgICAgICAgcHJpbnRpbmc6IHtcbiAgICAgICAgICAgIGtpbmQ6IFwid2Vla2x5XCIsXG4gICAgICAgICAgICBzbG90czogYWN0aW9uLnNsb3RzLm1hcCgocykgPT4gKHtcbiAgICAgICAgICAgICAgZGF5czogWy4uLnMuZGF5c10sXG4gICAgICAgICAgICAgIHRpbWU6IHMudGltZSxcbiAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHNoYXBlOiB7XG4gICAgICAgICAgICB0aXRsZTogYWN0aW9uLm5hbWUudHJpbSgpLFxuICAgICAgICAgICAgbm90ZXM6IFwiXCIsXG4gICAgICAgICAgICBwcm9qZWN0SWQ6IGFjdGlvbi5wcm9qZWN0SWQsXG4gICAgICAgICAgICBoYWJpdElkOiBoaWQsXG4gICAgICAgICAgICBmb2N1c01pbnV0ZXM6IGFjdGlvbi5mb2N1c01pbnV0ZXMsXG4gICAgICAgICAgICBzY3JhcE1pbnV0ZXM6IDAsXG4gICAgICAgICAgICBwcmlvcml0eTogMCxcbiAgICAgICAgICAgIGVzdGltYXRlOiAxLFxuICAgICAgICAgICAgdGFnczogW10sXG4gICAgICAgICAgICBzdWJ0YXNrczogW10sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcImRlbGV0ZUhhYml0XCI6IHtcbiAgICAgICAgY29uc3QgdGlkcyA9IHRoaXMudGVtcGxhdGVzXG4gICAgICAgICAgLmZpbHRlcigodCkgPT4gdC5zaGFwZS5oYWJpdElkID09PSBhY3Rpb24uaWQpXG4gICAgICAgICAgLm1hcCgodCkgPT4gdC5pZCk7XG4gICAgICAgIGZvciAoY29uc3QgdGlkIG9mIHRpZHMpIHtcbiAgICAgICAgICBkZWxldGVUZW1wbGF0ZSh0aGlzLCB0aWQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGFiaXRzID0gdGhpcy5oYWJpdHMuZmlsdGVyKChoKSA9PiBoLmlkICE9PSBhY3Rpb24uaWQpO1xuICAgICAgICAvLyBcdTY1RTJcdTY3MDlcdTVCOUVcdTRGOEJcdTRGRERcdTc1NTlcdTUxQkJcdTdFRDNcdTY3NjVcdTZFOTBcdUZGMUFcdTc5RkJcdTk2NjRcdTUyMDZcdTdFQzRcdTUzRUFcdTZFMDVcdTVGMTVcdTc1MjhcdUZGMENcdTUzODZcdTUzRjJcdTdGM0FcdTUyRTRcdTRFQ0RcdThCQTFcdTUxNjVcdTdFREZcdThCQTFcdTMwMDJcbiAgICAgICAgZm9yIChjb25zdCB0YXNrIG9mIHRoaXMudGFza3MpIHtcbiAgICAgICAgICBpZiAodGFzay5oYWJpdElkID09PSBhY3Rpb24uaWQpIHRhc2suaGFiaXRJZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwic2F2ZVZpc2lvblwiOiB7XG4gICAgICAgIGlmIChhY3Rpb24uaWQgIT09IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBhID0gdGhpcy52aXNpb25zLmZpbmQoKHgpID0+IHguaWQgPT09IGFjdGlvbi5pZCk7XG4gICAgICAgICAgZW5zdXJlKGEgIT09IHVuZGVmaW5lZCwgXCJcdTYxM0ZcdTY2NkZcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgICAgICAgYS5uYW1lID0gYWN0aW9uLm5hbWUudHJpbSgpO1xuICAgICAgICAgIGEubm90ZXMgPSBhY3Rpb24ubm90ZXM7XG4gICAgICAgICAgYS5wcm9qZWN0SWQgPSBhY3Rpb24ucHJvamVjdElkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudmlzaW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBpZCgpLFxuICAgICAgICAgICAgbmFtZTogYWN0aW9uLm5hbWUudHJpbSgpLFxuICAgICAgICAgICAgbm90ZXM6IGFjdGlvbi5ub3RlcyxcbiAgICAgICAgICAgIHByb2plY3RJZDogYWN0aW9uLnByb2plY3RJZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJkZWxldGVWaXNpb25cIjpcbiAgICAgICAgdGhpcy52aXNpb25zID0gdGhpcy52aXNpb25zLmZpbHRlcigoYSkgPT4gYS5pZCAhPT0gYWN0aW9uLmlkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwic2F2ZUJsb2NrXCI6IHtcbiAgICAgICAgY29uc3QgYmxvY2s6IEJsb2NrID0ge1xuICAgICAgICAgIGlkOiBhY3Rpb24uaWQgPz8gaWQoKSxcbiAgICAgICAgICB0aXRsZTogYWN0aW9uLnRpdGxlLnRyaW0oKSxcbiAgICAgICAgICBkYXlzOiBbLi4uYWN0aW9uLmRheXNdLFxuICAgICAgICAgIHN0YXJ0OiBhY3Rpb24uc3RhcnQsXG4gICAgICAgICAgZW5kOiBhY3Rpb24uZW5kLFxuICAgICAgICAgIGF0dGVudGlvbjogYWN0aW9uLmF0dGVudGlvbixcbiAgICAgICAgICBub3RlczogYWN0aW9uLm5vdGVzLFxuICAgICAgICB9O1xuICAgICAgICAvLyBcdTUxNDhcdTY4MjFcdTlBOENcdUZGMENcdTU3NEZcdTdGMTZcdThGOTFcdTYyQTVcdTgxRUFcdTVERjFcdTc2ODRcdTUzOUZcdTU2RTBcdTgwMENcdTRFMERcdTY2MkZcdTdCM0NcdTdFREZcdTc2ODRcdTUxNjhcdTkxQ0ZcdTU5MzFcdThEMjVcdTMwMDJcbiAgICAgICAgdmFsaWRhdGVCbG9jayhibG9jayk7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5ibG9ja3MuZmluZEluZGV4KChiKSA9PiBiLmlkID09PSBibG9jay5pZCk7XG4gICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgdGhpcy5ibG9ja3NbaW5kZXhdID0gYmxvY2s7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5ibG9ja3MucHVzaChibG9jayk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiZGVsZXRlQmxvY2tcIjpcbiAgICAgICAgdGhpcy5ibG9ja3MgPSB0aGlzLmJsb2Nrcy5maWx0ZXIoKGIpID0+IGIuaWQgIT09IGFjdGlvbi5pZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInNlbGVjdFRhc2tcIjoge1xuICAgICAgICBpZiAodGhpcy50YXNrcy5zb21lKCh0KSA9PiB0LmlkID09PSBhY3Rpb24uaWQgJiYgdGhpcy50YXNrSXNWb2lkKHQpKSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NEY1Q1x1NUU5Rlx1NUI5RVx1NEY4Qlx1NEUwRFx1ODBGRFx1NEUxM1x1NkNFOFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgYWN0aW9uLmlkICE9PSBudWxsICYmXG4gICAgICAgICAgIXRoaXMudGFza3Muc29tZSgodCkgPT4gdC5pZCA9PT0gYWN0aW9uLmlkICYmICF0LmNvbXBsZXRlZClcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU4QkY3XHU5MDA5XHU2MkU5XHU0RTAwXHU0RTJBXHU2NzJBXHU1QjhDXHU2MjEwXHU3Njg0XHU0RUZCXHU1MkExXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0aGlzLnRpbWVyLnJ1bm5pbmcgfHxcbiAgICAgICAgICB0aW1lclJlbWFpbmluZyh0aGlzLnRpbWVyLCBhdCkgPCB0aGlzLnRpbWVyLmR1cmF0aW9uU2Vjc1xuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdThCRjdcdTUxNDhcdTdFRDNcdTY3NUZcdTVGNTNcdTUyNERcdThCQTFcdTY1RjZcdUZGMENcdTUxOERcdTUyMDdcdTYzNjJcdTRFMTNcdTZDRThcdTRFRkJcdTUyQTFcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50aW1lci50YXNrSWQgPSBhY3Rpb24uaWQ7XG4gICAgICAgIHRoaXMucmVzZXRUbyh0aGlzLnRpbWVyLm1vZGUpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzdGFydFRpbWVyXCI6IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRoaXMudGFza3Muc29tZShcbiAgICAgICAgICAgICh0KSA9PiB0LmlkID09PSB0aGlzLnRpbWVyLnRhc2tJZCAmJiB0aGlzLnRhc2tJc1ZvaWQodCksXG4gICAgICAgICAgKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTRGNUNcdTVFOUZcdTVCOUVcdTRGOEJcdTRFMERcdTgwRkRcdTVGMDBcdTU5Q0JcdTRFMTNcdTZDRThcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb3ZlcnJpZGUgPVxuICAgICAgICAgIGFjdGlvbi5taW51dGVzICE9PSB1bmRlZmluZWQgJiYgYWN0aW9uLm1pbnV0ZXMgIT09IG51bGxcbiAgICAgICAgICAgID8gYWN0aW9uLm1pbnV0ZXNcbiAgICAgICAgICAgIDogbnVsbDtcbiAgICAgICAgaWYgKG92ZXJyaWRlICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gXHU1MzU1XHU2QjIxXHU2NUY2XHU5NTdGXHU4OTg2XHU3NkQ2XHVGRjFBXHU3RjUxXHU5ODc1L1x1NjVFNyBydW50aW1lIFx1NTE0MVx1OEJCOFx1NEUzNFx1NjVGNlx1NjMwN1x1NUI5QVx1NjcyQ1x1OEY2RVx1NTIwNlx1OTQ5Rlx1NjU3MFx1RkYwQ1x1NEUwRFx1NTE5OVx1NTZERVx1NEVGQlx1NTJBMVx1NjIxNlxuICAgICAgICAgIC8vIFx1NTE2OFx1NUM0MFx1OEJCRVx1N0Y2RVx1RkYxQlx1NTNFQVx1NjcwOVx1NUMxQVx1NjcyQVx1NUYwMFx1NTlDQlx1NzY4NFx1NEUxM1x1NkNFOFx1NkJCNVx1NTNFRlx1ODk4Nlx1NzZENlx1MzAwMlxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHRoaXMudGltZXIubW9kZSAhPT0gXCJmb2N1c1wiIHx8XG4gICAgICAgICAgICB0aGlzLnRpbWVyLnJ1bm5pbmcgfHxcbiAgICAgICAgICAgIHRoaXMudGltZXIuc3RhcnRlZEF0ICE9PSBudWxsXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTUzRUFcdTY3MDlcdTVDMUFcdTY3MkFcdTVGMDBcdTU5Q0JcdTc2ODRcdTRFMTNcdTZDRThcdTUzRUZcdTRFRTVcdTYzMDdcdTVCOUFcdTUzNTVcdTZCMjFcdTY1RjZcdTk1N0ZcIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghTnVtYmVyLmlzSW50ZWdlcihvdmVycmlkZSkgfHwgb3ZlcnJpZGUgPCAxIHx8IG92ZXJyaWRlID4gMTgwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTUzNTVcdTZCMjFcdTY1RjZcdTk1N0ZcdTk3MDBcdTRFM0ExXHUyMDE0MTgwXHU1MjA2XHU5NDlGXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdGFydFRlYWNoaW5nVGFzayh0aGlzLCBhdCk7XG4gICAgICAgIHRoaXMuc3RhcnQoYXQpO1xuICAgICAgICBpZiAob3ZlcnJpZGUgIT09IG51bGwpIHtcbiAgICAgICAgICAvLyBzdGFydCgpIFx1NEYxQVx1NjMwOVx1NTE2OFx1NUM0MFx1OEJCRVx1N0Y2RVx1OTFDRFx1N0I5N1x1NkJCNVx1OTU3Rlx1RkYwQ1x1ODk4Nlx1NzZENlx1NUZDNVx1OTg3Qlx1NjUzRVx1NTcyOFx1NUI4M1x1NEU0Qlx1NTQwRVx1MzAwMlxuICAgICAgICAgIHRoaXMudGltZXIuZHVyYXRpb25TZWNzID0gb3ZlcnJpZGUgKiA2MDtcbiAgICAgICAgICB0aGlzLnRpbWVyLnJlbWFpbmluZ1NlY3MgPSBvdmVycmlkZSAqIDYwO1xuICAgICAgICAgIHRoaXMudGltZXIuZGVhZGxpbmUgPSBhdCArIG92ZXJyaWRlICogNjA7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwicGF1c2VUaW1lclwiOiB7XG4gICAgICAgIHRoaXMudGltZXIucmVtYWluaW5nU2VjcyA9IHRpbWVyUmVtYWluaW5nKHRoaXMudGltZXIsIGF0KTtcbiAgICAgICAgdGhpcy50aW1lci5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMudGltZXIuZGVhZGxpbmUgPSBudWxsO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJyZXNldFRpbWVyXCI6IHtcbiAgICAgICAgdGhpcy5yZWNvcmQoYXQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5yZXNldFRvKHRoaXMudGltZXIubW9kZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNraXBUaW1lclwiOiB7XG4gICAgICAgIHRoaXMucmVjb3JkKGF0LCBmYWxzZSk7XG4gICAgICAgIGNvbnN0IG5leHQ6IE1vZGUgPSB0aGlzLnRpbWVyLm1vZGUgPT09IFwiZm9jdXNcIiA/IFwic2hvcnRCcmVha1wiIDogXCJmb2N1c1wiO1xuICAgICAgICB0aGlzLnJlc2V0VG8obmV4dCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBcInNldE1vZGVcIjoge1xuICAgICAgICBpZiAoYWN0aW9uLm1vZGUgIT09IHRoaXMudGltZXIubW9kZSkge1xuICAgICAgICAgIHRoaXMucmVjb3JkKGF0LCBmYWxzZSk7XG4gICAgICAgICAgdGhpcy5yZXNldFRvKGFjdGlvbi5tb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzYXZlU2V0dGluZ3NcIjoge1xuICAgICAgICB0aGlzLnNldHRpbmdzID0gYWN0aW9uLnNldHRpbmdzO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgIXRoaXMudGltZXIucnVubmluZyAmJlxuICAgICAgICAgIHRoaXMudGltZXIucmVtYWluaW5nU2VjcyA9PT0gdGhpcy50aW1lci5kdXJhdGlvblNlY3NcbiAgICAgICAgKSB7XG4gICAgICAgICAgdGhpcy5yZXNldFRvKHRoaXMudGltZXIubW9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwiaW1wb3J0UGxhblwiOlxuICAgICAgICBtZXJnZVBsYW4oYWN0aW9uLnBsYW4sIHRoaXMsIGF0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiaW1wb3J0XCI6IHtcbiAgICAgICAgYWN0aW9uLmRhdGEudmFsaWRhdGUoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IGNsb25lKGFjdGlvbi5kYXRhKTtcbiAgICAgICAgLy8gXHU2MDYyXHU1OTBEXHU2NTg3XHU0RUY2XHU0RTBEXHU1Rjk3XHU2MDg0XHU2MDg0XHU2QjY2XHU4OEM1XHU1QjlBXHU2NUY2XHU5NTAxXHU2NzNBXHUzMDAyXG4gICAgICAgIGRhdGEubG9jay5hY3RpdmUgPSBudWxsO1xuICAgICAgICBkYXRhLmxvY2suc3VwcHJlc3NlZFVudGlsID0gMDtcbiAgICAgICAgZGF0YS5zZXR0aW5ncy5hdXRvU3RhcnRUYXNrcyA9IGZhbHNlO1xuICAgICAgICBmb3IgKGNvbnN0IHNjaGVkdWxlIG9mIGRhdGEubG9jay5zY2hlZHVsZXMpIHtcbiAgICAgICAgICBzY2hlZHVsZS5lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gXHU1OTA3XHU0RUZEXHU2NjJGXHU2NTcwXHU2MzZFXHVGRjBDXHU0RTBEXHU2NjJGXHU2Mzg4XHU2NzQzXHU5MUNEXHU1RjAwXHU2NUU3XHU2NUY2XHU5NDlGXHUzMDAyXG4gICAgICAgIGRhdGEudGltZXIucmVtYWluaW5nU2VjcyA9IE1hdGgubWF4KDEsIHRpbWVyUmVtYWluaW5nKGRhdGEudGltZXIsIGF0KSk7XG4gICAgICAgIGRhdGEudGltZXIucnVubmluZyA9IGZhbHNlO1xuICAgICAgICBkYXRhLnRpbWVyLmRlYWRsaW5lID0gbnVsbDtcbiAgICAgICAgZGF0YS50aW1lci5jb21wbGV0aW9uU2VyaWFsID0gdGhpcy50aW1lci5jb21wbGV0aW9uU2VyaWFsO1xuICAgICAgICByZXBsYWNlQXBwRGF0YSh0aGlzLCBkYXRhKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIFwibG9hZEV4YW1wbGVcIjoge1xuICAgICAgICBpZiAodGhpcy50YXNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU1M0VBXHU2NzA5XHU3QTdBXHU0RUZCXHU1MkExXHU1MjE3XHU4ODY4XHU1M0VGXHU0RUU1XHU4RjdEXHU1MTY1XHU3OTNBXHU0RjhCXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRvZGF5ID0gZGF0ZUF0KGF0KTtcbiAgICAgICAgY29uc3QgZXhhbXBsZXM6IFtzdHJpbmcsIHN0cmluZywgbnVtYmVyLCBudW1iZXJdW10gPSBbXG4gICAgICAgICAgW1xuICAgICAgICAgICAgXCJcdTY4QjNcdTc0MDZcdTY3MkNcdTU0NjhcdTc2ODRcdTVERTVcdTRGNUNcdThCQTFcdTUyMTJcIixcbiAgICAgICAgICAgIFwiXHU2MjhBXHU1OTI3XHU3NkVFXHU2ODA3XHU2MkM2XHU2MjEwXHU1QzBGXHU2QjY1XHU5QUE0XHVGRjBDXHU4QkE5XHU2QkNGXHU0RTAwXHU1OTI5XHU5MEZEXHU2NkY0XHU0RUNFXHU1QkI5XHUzMDAyXCIsXG4gICAgICAgICAgICAzLFxuICAgICAgICAgICAgMixcbiAgICAgICAgICBdLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIFwiXHU4QkZCXHU1QjhDXHU2QjYzXHU1NzI4XHU3NzBCXHU3Njg0XHU5MEEzXHU0RTAwXHU3QUUwXCIsXG4gICAgICAgICAgICBcIlx1NTE3M1x1NjM4OVx1NkQ4OFx1NjA2Rlx1NjNEMFx1OTE5Mlx1RkYwQ1x1N0VEOVx1OTYwNVx1OEJGQlx1NzU1OVx1NEUwMFx1NkJCNVx1NUI4Q1x1NjU3NFx1NzY4NFx1NjVGNlx1OTVGNFx1MzAwMlwiLFxuICAgICAgICAgICAgMixcbiAgICAgICAgICAgIDEsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBbXCJcdTY1NzRcdTc0MDZcdTY4NENcdTk3NjJcdUZGMENcdTY1NzRcdTc0MDZcdTYwMURcdTdFRUFcIiwgXCJcdTRFMDBcdTRFMkFcdTgyMTJcdTY3MERcdTc2ODRcdTczQUZcdTU4ODNcdUZGMENcdTY2MkZcdTRFMTNcdTZDRThcdTc2ODRcdTVGMDBcdTU5Q0JcdTMwMDJcIiwgMSwgMV0sXG4gICAgICAgIF07XG4gICAgICAgIGV4YW1wbGVzLmZvckVhY2goKFt0aXRsZSwgbm90ZXMsIHByaW9yaXR5LCBlc3RpbWF0ZV0sIGluZGV4KSA9PiB7XG4gICAgICAgICAgdGhpcy50YXNrcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBpZCgpLFxuICAgICAgICAgICAgdGVtcGxhdGVJZDogbnVsbCxcbiAgICAgICAgICAgIHJlY3VycmluZzogZmFsc2UsXG4gICAgICAgICAgICB0aXRsZSxcbiAgICAgICAgICAgIG5vdGVzLFxuICAgICAgICAgICAgcHJvamVjdElkOiB0aGlzLnByb2plY3RzW2luZGV4XT8uaWQgPz8gbnVsbCxcbiAgICAgICAgICAgIGhhYml0SWQ6IG51bGwsXG4gICAgICAgICAgICBkdWVEYXRlOiB0b2RheSxcbiAgICAgICAgICAgIHJlbWluZGVyVGltZTogbnVsbCxcbiAgICAgICAgICAgIGZvY3VzTWludXRlczogbnVsbCxcbiAgICAgICAgICAgIHJlbWluZGVyRmlyZWQ6IGZhbHNlLFxuICAgICAgICAgICAgcmVtaW5kZXJQZW5kaW5nOiBmYWxzZSxcbiAgICAgICAgICAgIHJlbWluZGVyRXhwaXJlZDogZmFsc2UsXG4gICAgICAgICAgICBzY3JhcE1pbnV0ZXM6IDAsXG4gICAgICAgICAgICBwcmlvcml0eSxcbiAgICAgICAgICAgIGVzdGltYXRlLFxuICAgICAgICAgICAgY29tcGxldGVkOiBmYWxzZSxcbiAgICAgICAgICAgIGNvbXBsZXRlZEF0OiBudWxsLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBhdCArIGluZGV4LFxuICAgICAgICAgICAgdGFnczogW1wiXHU3OTNBXHU0RjhCXCJdLFxuICAgICAgICAgICAgc3VidGFza3M6IFtdLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIG1hdGVyaWFsaXplVGVhY2hpbmdUYXNrcyh0aGlzLCBhdCk7XG4gICAgdGhpcy52YWxpZGF0ZSgpO1xuICB9XG5cbiAgdmFsaWRhdGUoKTogdm9pZCB7XG4gICAgdGhpcy5lZHVjYXRpb25WYWxpZGF0ZSgpO1xuICAgIHZhbGlkYXRlVGVhY2hpbmdUYXNrcyh0aGlzKTtcbiAgICB2YWxpZGF0ZUxvY2sodGhpcy5sb2NrKTtcbiAgICB2YWxpZGF0ZVRlbXBsYXRlcyh0aGlzKTtcbiAgICB2YWxpZGF0ZUlkZW50aXRpZXModGhpcyk7XG4gICAgdmFsaWRhdGVCbG9ja3ModGhpcy5ibG9ja3MpO1xuICAgIGVuc3VyZSh0aGlzLnZlcnNpb24gPT09IDQsIFwiXHU0RTBEXHU2NTJGXHU2MzAxXHU2QjY0XHU2NTcwXHU2MzZFXHU3MjQ4XHU2NzJDXCIpO1xuICAgIGVuc3VyZShcbiAgICAgIHRoaXMudGFza3MubGVuZ3RoIDw9IDUwMDAwICYmXG4gICAgICAgIHRoaXMuc2Vzc2lvbnMubGVuZ3RoIDw9IDIwMDAwMCAmJlxuICAgICAgICB0aGlzLnByb2plY3RzLmxlbmd0aCA8PSA1MDAsXG4gICAgICBcIlx1NjU3MFx1NjM2RVx1OEQ4NVx1NTFGQVx1NjU3MFx1OTFDRlx1OTY1MFx1NTIzNlwiLFxuICAgICk7XG4gICAgY29uc3QgcyA9IHRoaXMuc2V0dGluZ3M7XG4gICAgZW5zdXJlKHMuc291bmRWb2x1bWUgPD0gMTAwLCBcIlx1OTdGM1x1NjU0OFx1OTdGM1x1OTFDRlx1OTcwMFx1NEUzQSAwXHUyMDEzMTAwXCIpO1xuICAgIGVuc3VyZShcbiAgICAgIHMuZm9jdXNNaW51dGVzID49IDEgJiZcbiAgICAgICAgcy5mb2N1c01pbnV0ZXMgPD0gMTgwICYmXG4gICAgICAgIHMuc2hvcnRCcmVha01pbnV0ZXMgPj0gMSAmJlxuICAgICAgICBzLnNob3J0QnJlYWtNaW51dGVzIDw9IDYwICYmXG4gICAgICAgIHMubG9uZ0JyZWFrTWludXRlcyA+PSAxICYmXG4gICAgICAgIHMubG9uZ0JyZWFrTWludXRlcyA8PSAxMjAgJiZcbiAgICAgICAgcy5sb25nQnJlYWtFdmVyeSA+PSAyICYmXG4gICAgICAgIHMubG9uZ0JyZWFrRXZlcnkgPD0gMTIgJiZcbiAgICAgICAgcy5kYWlseUdvYWwgPj0gMSAmJlxuICAgICAgICBzLmRhaWx5R29hbCA8PSAzMCxcbiAgICAgIFwiXHU4QkExXHU2NUY2XHU4QkJFXHU3RjZFXHU4RDg1XHU1MUZBXHU1MTQxXHU4QkI4XHU4MzAzXHU1NkY0XCIsXG4gICAgKTtcbiAgICBlbnN1cmUoW1wibGlnaHRcIiwgXCJkYXJrXCIsIFwic3lzdGVtXCJdLmluY2x1ZGVzKHMudGhlbWUpLCBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NEUzQlx1OTg5OFwiKTtcbiAgICBlbnN1cmUodmFsaWRBcHBJZHMocy5wcm90ZWN0aW9uLndoaXRlbGlzdCksIFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU1RTk0XHU3NTI4XHU3NjdEXHU1NDBEXHU1MzU1XCIpO1xuICAgIGNvbnN0IHByb2plY3RJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBmb3IgKGNvbnN0IHAgb2YgdGhpcy5wcm9qZWN0cykge1xuICAgICAgZW5zdXJlKHAuaWQubGVuZ3RoID4gMCAmJiAhcHJvamVjdElkcy5oYXMocC5pZCksIFwiXHU5ODc5XHU3NkVFIElEIFx1OTFDRFx1NTkwRFx1NjIxNlx1NEUzQVx1N0E3QVwiKTtcbiAgICAgIHByb2plY3RJZHMuYWRkKHAuaWQpO1xuICAgICAgZW5zdXJlKFxuICAgICAgICBwLm5hbWUudHJpbSgpLmxlbmd0aCA+IDAgJiYgY2hhckNvdW50KHAubmFtZSkgPD0gNDAsXG4gICAgICAgIFwiXHU5ODc5XHU3NkVFXHU1NDBEXHU3OUYwXHU5NzAwXHU0RTNBIDFcdTIwMTM0MCBcdTRFMkFcdTVCNTdcdTdCMjZcIixcbiAgICAgICk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHAuY29sb3IubGVuZ3RoID09PSA3ICYmXG4gICAgICAgICAgcC5jb2xvci5zdGFydHNXaXRoKFwiI1wiKSAmJlxuICAgICAgICAgIC9eWzAtOWEtZkEtRl17Nn0kLy50ZXN0KHAuY29sb3Iuc2xpY2UoMSkpLFxuICAgICAgICBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1OTg3OVx1NzZFRVx1OTg5Q1x1ODI3MlwiLFxuICAgICAgKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgcC5hcHBXaGl0ZWxpc3QgPT09IG51bGwgfHwgdmFsaWRBcHBJZHMocC5hcHBXaGl0ZWxpc3QpLFxuICAgICAgICBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1OTg3OVx1NzZFRVx1NUU5NFx1NzUyOFx1NzY3RFx1NTQwRFx1NTM1NVwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgaGFiaXRJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBlbnN1cmUodGhpcy5oYWJpdHMubGVuZ3RoIDw9IDUwMCwgXCJcdTRFNjBcdTYwRUZcdTY1NzBcdTkxQ0ZcdThEODVcdTUxRkFcdTk2NTBcdTUyMzZcIik7XG4gICAgZm9yIChjb25zdCBoIG9mIHRoaXMuaGFiaXRzKSB7XG4gICAgICBlbnN1cmUoaC5pZC5sZW5ndGggPiAwICYmICFoYWJpdElkcy5oYXMoaC5pZCksIFwiXHU0RTYwXHU2MEVGIElEIFx1OTFDRFx1NTkwRFx1NjIxNlx1NEUzQVx1N0E3QVwiKTtcbiAgICAgIGhhYml0SWRzLmFkZChoLmlkKTtcbiAgICAgIHZhbGlkYXRlSGFiaXQoaCk7XG4gICAgfVxuICAgIGNvbnN0IHZpc2lvbklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGVuc3VyZSh0aGlzLnZpc2lvbnMubGVuZ3RoIDw9IDUwMCwgXCJcdTYxM0ZcdTY2NkZcdTY1NzBcdTkxQ0ZcdThEODVcdTUxRkFcdTk2NTBcdTUyMzZcIik7XG4gICAgZm9yIChjb25zdCBhIG9mIHRoaXMudmlzaW9ucykge1xuICAgICAgZW5zdXJlKGEuaWQubGVuZ3RoID4gMCAmJiAhdmlzaW9uSWRzLmhhcyhhLmlkKSwgXCJcdTYxM0ZcdTY2NkYgSUQgXHU5MUNEXHU1OTBEXHU2MjE2XHU0RTNBXHU3QTdBXCIpO1xuICAgICAgdmlzaW9uSWRzLmFkZChhLmlkKTtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgYS5uYW1lLnRyaW0oKS5sZW5ndGggPiAwICYmIGNoYXJDb3VudChhLm5hbWUpIDw9IDQwLFxuICAgICAgICBcIlx1NjEzRlx1NjY2Rlx1NTQwRFx1NzlGMFx1OTcwMFx1NEUzQSAxXHUyMDEzNDAgXHU0RTJBXHU1QjU3XHU3QjI2XCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKHV0ZjhMZW4oYS5ub3RlcykgPD0gNTAwMDAsIFwiXHU2MTNGXHU2NjZGXHU1MTg1XHU1QkI5XHU4RkM3XHU5NTdGXCIpO1xuICAgICAgZW5zdXJlKFxuICAgICAgICBhLnByb2plY3RJZCA9PT0gbnVsbCB8fCBwcm9qZWN0SWRzLmhhcyhhLnByb2plY3RJZCksXG4gICAgICAgIFwiXHU2MTNGXHU2NjZGXHU1RjE1XHU3NTI4XHU0RTg2XHU0RTBEXHU1QjU4XHU1NzI4XHU3Njg0XHU5ODc5XHU3NkVFXCIsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCB0YXNrSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCB0IG9mIHRoaXMudGFza3MpIHtcbiAgICAgIHRoaXMudmFsaWRhdGVSZW1pbmRlclRhc2sodCk7XG4gICAgICBlbnN1cmUodC5pZC5sZW5ndGggPiAwICYmICF0YXNrSWRzLmhhcyh0LmlkKSwgXCJcdTRFRkJcdTUyQTEgSUQgXHU5MUNEXHU1OTBEXHU2MjE2XHU0RTNBXHU3QTdBXCIpO1xuICAgICAgdGFza0lkcy5hZGQodC5pZCk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHQudGl0bGUudHJpbSgpLmxlbmd0aCA+IDAgJiYgY2hhckNvdW50KHQudGl0bGUpIDw9IDIwMCxcbiAgICAgICAgXCJcdTRFRkJcdTUyQTFcdTU0MERcdTc5RjBcdTk3MDBcdTRFM0EgMVx1MjAxMzIwMCBcdTRFMkFcdTVCNTdcdTdCMjZcIixcbiAgICAgICk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHV0ZjhMZW4odC5ub3RlcykgPD0gNTAwMDAgJiZcbiAgICAgICAgICB0LnRhZ3MubGVuZ3RoIDw9IDIwICYmXG4gICAgICAgICAgdC50YWdzLmV2ZXJ5KCh0YWcpID0+IGNoYXJDb3VudCh0YWcpIDw9IDQwKSxcbiAgICAgICAgXCJcdTU5MDdcdTZDRThcdTYyMTZcdTY4MDdcdTdCN0VcdThGQzdcdTk1N0ZcIixcbiAgICAgICk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHQucHJpb3JpdHkgPD0gMyAmJiB0LmVzdGltYXRlID49IDEgJiYgdC5lc3RpbWF0ZSA8PSA5OSxcbiAgICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTRGMThcdTUxNDhcdTdFQTdcdTYyMTZcdTk4ODRcdThCQTFcdTc1NkFcdTgzMDRcdTY1NzBcIixcbiAgICAgICk7XG4gICAgICBlbnN1cmUodC5zY3JhcE1pbnV0ZXMgPD0gMTAwODAsIFwiXHU5MUNEXHU0RkVFXHU3QTk3XHU1M0UzXHU4RDg1XHU1MUZBXHU4MzAzXHU1NkY0XCIpO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LnByb2plY3RJZCA9PT0gbnVsbCB8fCBwcm9qZWN0SWRzLmhhcyh0LnByb2plY3RJZCksXG4gICAgICAgIFwiXHU0RUZCXHU1MkExXHU1RjE1XHU3NTI4XHU0RTg2XHU0RTBEXHU1QjU4XHU1NzI4XHU3Njg0XHU5ODc5XHU3NkVFXCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LmhhYml0SWQgPT09IG51bGwgfHwgaGFiaXRJZHMuaGFzKHQuaGFiaXRJZCksXG4gICAgICAgIFwiXHU0RUZCXHU1MkExXHU1RjE1XHU3NTI4XHU0RTg2XHU0RTBEXHU1QjU4XHU1NzI4XHU3Njg0XHU0RTYwXHU2MEVGXCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LmhhYml0SWQgPT09IG51bGwgfHwgdC5yZW1pbmRlclRpbWUgIT09IG51bGwsXG4gICAgICAgIFwiXHU0RTYwXHU2MEVGXHU1QjlFXHU0RjhCXHU5NzAwXHU4OTgxXHU3Q0JFXHU3ODZFXHU2NUY2XHU5NUY0XCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LmR1ZURhdGUgPT09IG51bGwgfHwgKHQuZHVlRGF0ZS5sZW5ndGggPT09IDEwICYmIHZhbGlkRGF0ZSh0LmR1ZURhdGUpKSxcbiAgICAgICAgXCJcdTY1RTBcdTY1NDhcdTc2ODRcdTRFRkJcdTUyQTFcdTY1RTVcdTY3MUZcIixcbiAgICAgICk7XG4gICAgICBjb25zdCBzdWJzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICBlbnN1cmUoXG4gICAgICAgIHQuc3VidGFza3MubGVuZ3RoIDw9IDIwMCAmJlxuICAgICAgICAgIHQuc3VidGFza3MuZXZlcnkoKHN1YikgPT4ge1xuICAgICAgICAgICAgaWYgKHN1Yi5pZC5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIGlmIChzdWJzLmhhcyhzdWIuaWQpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBzdWJzLmFkZChzdWIuaWQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Yi50aXRsZS50cmltKCkubGVuZ3RoID4gMCAmJiBjaGFyQ291bnQoc3ViLnRpdGxlKSA8PSAyMDA7XG4gICAgICAgICAgfSksXG4gICAgICAgIFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU1QjUwXHU0RUZCXHU1MkExXCIsXG4gICAgICApO1xuICAgICAgZW5zdXJlKFxuICAgICAgICB0LmNvbXBsZXRlZCA9PT0gKHQuY29tcGxldGVkQXQgIT09IG51bGwpLFxuICAgICAgICBcIlx1NEVGQlx1NTJBMVx1NUI4Q1x1NjIxMFx1NzJCNlx1NjAwMVx1NEUwRVx1NjVFNVx1NjcxRlx1NEUwRFx1NEUwMFx1ODFGNFwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgdCA9IHRoaXMudGltZXI7XG4gICAgZW5zdXJlKFxuICAgICAgdC5jeWNsZURhdGUgPT09IG51bGwgfHxcbiAgICAgICAgKHQuY3ljbGVEYXRlLmxlbmd0aCA9PT0gMTAgJiYgdmFsaWREYXRlKHQuY3ljbGVEYXRlKSksXG4gICAgICBcIlx1NjVFMFx1NjU0OFx1NzY4NFx1NzU2QVx1ODMwNFx1NTQ2OFx1NjcxRlx1NjVFNVx1NjcxRlwiLFxuICAgICk7XG4gICAgZW5zdXJlKFxuICAgICAgdC5kdXJhdGlvblNlY3MgPj0gMSAmJlxuICAgICAgICB0LmR1cmF0aW9uU2VjcyA8PSAxMDgwMCAmJlxuICAgICAgICB0LnJlbWFpbmluZ1NlY3MgPD0gdC5kdXJhdGlvblNlY3MgJiZcbiAgICAgICAgdC5ydW5uaW5nID09PSAodC5kZWFkbGluZSAhPT0gbnVsbCksXG4gICAgICBcIlx1OEJBMVx1NjVGNlx1NTY2OFx1NjU3MFx1NjM2RVx1NEUwRFx1NkI2M1x1Nzg2RVwiLFxuICAgICk7XG4gICAgZW5zdXJlKHQudGFza0lkID09PSBudWxsIHx8IHRhc2tJZHMuaGFzKHQudGFza0lkKSwgXCJcdThCQTFcdTY1RjZcdTU2NjhcdTRFRkJcdTUyQTFcdTRFMERcdTVCNThcdTU3MjhcIik7XG4gICAgY29uc3Qgc2Vzc2lvbklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGVzdGltYXRlZFRhc2tzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgZm9yIChjb25zdCBzZXNzaW9uIG9mIHRoaXMuc2Vzc2lvbnMpIHtcbiAgICAgIGNvbnN0IG1heER1cmF0aW9uID0gc2Vzc2lvbi5zb3VyY2UgPT09IFwidGltZXJcIiA/IDEwODAwIDogOTkgKiAxODAgKiA2MDtcbiAgICAgIGVuc3VyZShcbiAgICAgICAgc2Vzc2lvbi5pZC5sZW5ndGggPiAwICYmXG4gICAgICAgICAgIXNlc3Npb25JZHMuaGFzKHNlc3Npb24uaWQpICYmXG4gICAgICAgICAgc2Vzc2lvbi5lbmRlZEF0ID49IHNlc3Npb24uc3RhcnRlZEF0ICYmXG4gICAgICAgICAgc2Vzc2lvbi5kdXJhdGlvblNlY3MgPj0gMSAmJlxuICAgICAgICAgIHNlc3Npb24uZHVyYXRpb25TZWNzIDw9IG1heER1cmF0aW9uICYmXG4gICAgICAgICAgKHNlc3Npb24uc291cmNlICE9PSBcInRhc2tFc3RpbWF0ZVwiIHx8XG4gICAgICAgICAgICAoIXNlc3Npb24uY29tcGxldGVkICYmXG4gICAgICAgICAgICAgIHNlc3Npb24udGFza0lkICE9PSBudWxsICYmXG4gICAgICAgICAgICAgIHNlc3Npb24udGFza0lkLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICAgICAgIWVzdGltYXRlZFRhc2tzLmhhcyhzZXNzaW9uLnRhc2tJZCkgJiZcbiAgICAgICAgICAgICAgc2Vzc2lvbi5zdGFydGVkQXQgPT09IHNlc3Npb24uZW5kZWRBdCkpICYmXG4gICAgICAgICAgY2hhckNvdW50KHNlc3Npb24udGFza1RpdGxlKSA8PSAyMDAgJiZcbiAgICAgICAgICBjaGFyQ291bnQoc2Vzc2lvbi5wcm9qZWN0TmFtZSkgPD0gNDAsXG4gICAgICAgIFwiXHU2NUUwXHU2NTQ4XHU3Njg0XHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsXG4gICAgICApO1xuICAgICAgc2Vzc2lvbklkcy5hZGQoc2Vzc2lvbi5pZCk7XG4gICAgICBpZiAoc2Vzc2lvbi5zb3VyY2UgPT09IFwidGFza0VzdGltYXRlXCIgJiYgc2Vzc2lvbi50YXNrSWQgIT09IG51bGwpIHtcbiAgICAgICAgZXN0aW1hdGVkVGFza3MuYWRkKHNlc3Npb24udGFza0lkKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdGF0cyhhdDogbnVtYmVyKTogU3RhdHMge1xuICAgIGNvbnN0IHRvZGF5ID0gZGF0ZUF0KGF0KTtcbiAgICBjb25zdCBjdXJyZW50ID0gcGFyc2VMb2NhbERhdGUodG9kYXkpITtcbiAgICBjb25zdCBieURheSA9IG5ldyBNYXA8c3RyaW5nLCB7IHNlY29uZHM6IG51bWJlcjsgcG9tb2Rvcm9zOiBudW1iZXIgfT4oKTtcbiAgICBmb3IgKGNvbnN0IHNlc3Npb24gb2YgdGhpcy5zZXNzaW9ucykge1xuICAgICAgY29uc3QgZW50cnkgPSBieURheS5nZXQoZGF0ZUF0KHNlc3Npb24uZW5kZWRBdCkpID8/IHtcbiAgICAgICAgc2Vjb25kczogMCxcbiAgICAgICAgcG9tb2Rvcm9zOiAwLFxuICAgICAgfTtcbiAgICAgIGVudHJ5LnNlY29uZHMgKz0gc2Vzc2lvbi5kdXJhdGlvblNlY3M7XG4gICAgICBlbnRyeS5wb21vZG9yb3MgKz0gc2Vzc2lvbi5jb21wbGV0ZWQgPyAxIDogMDtcbiAgICAgIGJ5RGF5LnNldChkYXRlQXQoc2Vzc2lvbi5lbmRlZEF0KSwgZW50cnkpO1xuICAgIH1cbiAgICAvLyBcdTRFMDBcdTkwNERcdTkwNERcdTUzODZcdTVCOUVcdTRGOEJcdUZGMUFcdTYzMDlcdTU5MjlcdTdFREZcdThCQTFcdTVCOENcdTYyMTBcdTMwMDFcdTRGNUNcdTVFOUZcdTRFMEVcdTdGM0FcdTUyRTRcdTMwMDJcbiAgICBjb25zdCBjb21wbGV0ZWRCeURheSA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY29uc3Qgdm9pZGVkQnlEYXkgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgIGNvbnN0IG1pc3NlZEJ5RGF5ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBmb3IgKGNvbnN0IHQgb2YgdGhpcy50YXNrcykge1xuICAgICAgaWYgKHQuY29tcGxldGVkQXQgIT09IG51bGwpIHtcbiAgICAgICAgY29tcGxldGVkQnlEYXkuc2V0KFxuICAgICAgICAgIGRhdGVBdCh0LmNvbXBsZXRlZEF0KSxcbiAgICAgICAgICAoY29tcGxldGVkQnlEYXkuZ2V0KGRhdGVBdCh0LmNvbXBsZXRlZEF0KSkgPz8gMCkgKyAxLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKHQucmVtaW5kZXJFeHBpcmVkICYmICF0LmNvbXBsZXRlZCAmJiB0LmR1ZURhdGUgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKGtpbmRPZih0KSA9PT0gXCJoYWJpdFwiKSB7XG4gICAgICAgICAgbWlzc2VkQnlEYXkuc2V0KHQuZHVlRGF0ZSwgKG1pc3NlZEJ5RGF5LmdldCh0LmR1ZURhdGUpID8/IDApICsgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdm9pZGVkQnlEYXkuc2V0KHQuZHVlRGF0ZSwgKHZvaWRlZEJ5RGF5LmdldCh0LmR1ZURhdGUpID8/IDApICsgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgZGF5czogRGF5U3RhdFtdID0gW107XG4gICAgZm9yIChsZXQgbiA9IDI3OyBuID49IDA7IG4gLT0gMSkge1xuICAgICAgY29uc3QgZGF0ZSA9IGZvcm1hdExvY2FsRGF0ZShhZGREYXlzKGN1cnJlbnQsIC1uKSk7XG4gICAgICBjb25zdCBlbnRyeSA9IGJ5RGF5LmdldChkYXRlKSA/PyB7IHNlY29uZHM6IDAsIHBvbW9kb3JvczogMCB9O1xuICAgICAgZGF5cy5wdXNoKHtcbiAgICAgICAgZGF0ZSxcbiAgICAgICAgc2Vjb25kczogZW50cnkuc2Vjb25kcyxcbiAgICAgICAgcG9tb2Rvcm9zOiBlbnRyeS5wb21vZG9yb3MsXG4gICAgICAgIG1pc3NlZDogbWlzc2VkQnlEYXkuZ2V0KGRhdGUpID8/IDAsXG4gICAgICAgIGNvbXBsZXRlZDogY29tcGxldGVkQnlEYXkuZ2V0KGRhdGUpID8/IDAsXG4gICAgICAgIHZvaWRlZDogdm9pZGVkQnlEYXkuZ2V0KGRhdGUpID8/IDAsXG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgZm9jdXNlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGZvciAoY29uc3QgcyBvZiB0aGlzLnNlc3Npb25zKSB7XG4gICAgICBpZiAocy5jb21wbGV0ZWQgfHwgcy5zb3VyY2UgPT09IFwidGFza0VzdGltYXRlXCIpIHtcbiAgICAgICAgZm9jdXNlZC5hZGQoZGF0ZUF0KHMuZW5kZWRBdCkpO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgZGF5ID0gY3VycmVudDtcbiAgICBpZiAoIWZvY3VzZWQuaGFzKHRvZGF5KSkge1xuICAgICAgZGF5ID0gYWRkRGF5cyhkYXksIC0xKTtcbiAgICB9XG4gICAgbGV0IHN0cmVhayA9IDA7XG4gICAgd2hpbGUgKGZvY3VzZWQuaGFzKGZvcm1hdExvY2FsRGF0ZShkYXkpKSkge1xuICAgICAgc3RyZWFrICs9IDE7XG4gICAgICBkYXkgPSBhZGREYXlzKGRheSwgLTEpO1xuICAgIH1cbiAgICBjb25zdCBsYXN0ID0gZGF5c1tkYXlzLmxlbmd0aCAtIDFdITtcbiAgICByZXR1cm4ge1xuICAgICAgdG9kYXlTZWNvbmRzOiBsYXN0LnNlY29uZHMsXG4gICAgICB0b2RheVBvbW9kb3JvczogbGFzdC5wb21vZG9yb3MsXG4gICAgICB0b2RheUNvbXBsZXRlZDogdGhpcy50YXNrcy5maWx0ZXIoXG4gICAgICAgICh0KSA9PiB0LmNvbXBsZXRlZEF0ICE9PSBudWxsICYmIGRhdGVBdCh0LmNvbXBsZXRlZEF0KSA9PT0gdG9kYXksXG4gICAgICApLmxlbmd0aCxcbiAgICAgIHRvdGFsU2Vjb25kczogdGhpcy5zZXNzaW9ucy5yZWR1Y2UoKG4sIHMpID0+IG4gKyBzLmR1cmF0aW9uU2VjcywgMCksXG4gICAgICB0b3RhbFBvbW9kb3JvczogdGhpcy5zZXNzaW9ucy5maWx0ZXIoKHMpID0+IHMuY29tcGxldGVkKS5sZW5ndGgsXG4gICAgICBzdHJlYWssXG4gICAgICBkYXlzLFxuICAgIH07XG4gIH1cblxuICAvLyAtLS0tIHJlbWluZGVycyBcdTUzMDVcdTg4QzUgLS0tLVxuICByZW1pbmRlcklkbGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHJlbWluZGVySWRsZSh0aGlzKTtcbiAgfVxuICBwZW5kaW5nUmVtaW5kZXIoKTogVGFzayB8IG51bGwge1xuICAgIHJldHVybiBwZW5kaW5nUmVtaW5kZXIodGhpcyk7XG4gIH1cbiAgZHVlQXV0b1Rhc2soKTogVGFzayB8IG51bGwge1xuICAgIHJldHVybiBkdWVBdXRvVGFzayh0aGlzKTtcbiAgfVxuXG4gIC8vIC0tLS0gcGxhbiBcdTUzMDVcdTg4QzUgLS0tLVxuICBleHBvcnRQbGFuKCk6IFBsYW5GaWxlIHtcbiAgICByZXR1cm4gZXhwb3J0UGxhbih0aGlzKTtcbiAgfVxuXG4gIC8vIC0tLS0gdGVhY2hpbmcgXHU1MzA1XHU4OEM1IC0tLS1cbiAgdGVhY2hpbmdUYXNrKHRhc2tJZDogc3RyaW5nKTogUmV0dXJuVHlwZTx0eXBlb2YgdGVhY2hpbmdUYXNrPiB7XG4gICAgcmV0dXJuIHRlYWNoaW5nVGFzayh0aGlzLCB0YXNrSWQpO1xuICB9XG4gIGNvbXBsZXRlVGVhY2hpbmdUYXNrKHRhc2tJZDogc3RyaW5nLCBhdDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29tcGxldGVUZWFjaGluZ1Rhc2sodGhpcywgdGFza0lkLCBhdCk7XG4gIH1cblxuICAvLyAtLS0tIGVkdWNhdGlvbiBcdTY4MjFcdTlBOENcdTUzMDVcdTg4QzUgLS0tLVxuICBlZHVjYXRpb25WYWxpZGF0ZSgpOiB2b2lkIHtcbiAgICB2YWxpZGF0ZUVkdWNhdGlvbkRhdGEodGhpcyk7XG4gIH1cbiAgdmFsaWRhdGVSZW1pbmRlclRhc2sodGFzazogVGFzayk6IHZvaWQge1xuICAgIHZhbGlkYXRlUmVtaW5kZXJUYXNrKHRhc2spO1xuICB9XG59XG5cbmltcG9ydCB7IHZhbGlkYXRlUmVtaW5kZXJUYXNrIH0gZnJvbSBcIi4vcmVtaW5kZXJzXCI7XG5pbXBvcnQgeyB2YWxpZGF0ZUVkdWNhdGlvbiBhcyB2YWxpZGF0ZUVkdWNhdGlvbkRhdGEgfSBmcm9tIFwiLi9lZHVjYXRpb25cIjtcblxuLy8gLS0tLS0tLS0tLSBcdTUxNjhcdTVDNDBcdTUxRkRcdTY1NzAgLS0tLS0tLS0tLVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRBcHBJZHMobGlzdDogc3RyaW5nW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICBsaXN0Lmxlbmd0aCA8PSAxMDAgJiZcbiAgICBsaXN0LmV2ZXJ5KFxuICAgICAgKGEpID0+XG4gICAgICAgIGEudHJpbSgpLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgY2hhckNvdW50KGEpIDw9IDMyNzY4ICYmXG4gICAgICAgICFBcnJheS5mcm9tKGEpLnNvbWUoKGMpID0+IGlzQ29udHJvbENoYXIoYykpLFxuICAgIClcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNDb250cm9sQ2hhcihjOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgY29kZSA9IGMuY29kZVBvaW50QXQoMCkhO1xuICByZXR1cm4gY29kZSA8IDB4MjAgfHwgKGNvZGUgPj0gMHg3ZiAmJiBjb2RlIDw9IDB4OWYpO1xufVxuXG5mdW5jdGlvbiBwYXJzZUxvY2FsRGF0ZShcbiAgdmFsdWU6IHN0cmluZyxcbik6IHsgeWVhcjogbnVtYmVyOyBtb250aDogbnVtYmVyOyBkYXk6IG51bWJlciB9IHwgbnVsbCB7XG4gIGlmICghL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QodmFsdWUpKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgeWVhciA9IE51bWJlcih2YWx1ZS5zbGljZSgwLCA0KSk7XG4gIGNvbnN0IG1vbnRoID0gTnVtYmVyKHZhbHVlLnNsaWNlKDUsIDcpKTtcbiAgY29uc3QgZGF5ID0gTnVtYmVyKHZhbHVlLnNsaWNlKDgsIDEwKSk7XG4gIGNvbnN0IHByb2JlID0gbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgbW9udGggLSAxLCBkYXkpKTtcbiAgaWYgKFxuICAgIHByb2JlLmdldFVUQ0Z1bGxZZWFyKCkgIT09IHllYXIgfHxcbiAgICBwcm9iZS5nZXRVVENNb250aCgpICE9PSBtb250aCAtIDEgfHxcbiAgICBwcm9iZS5nZXRVVENEYXRlKCkgIT09IGRheVxuICApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4geyB5ZWFyLCBtb250aCwgZGF5IH07XG59XG5cbmZ1bmN0aW9uIGZvcm1hdExvY2FsRGF0ZShkYXRlOiB7XG4gIHllYXI6IG51bWJlcjtcbiAgbW9udGg6IG51bWJlcjtcbiAgZGF5OiBudW1iZXI7XG59KTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke2RhdGUueWVhcn0tJHtTdHJpbmcoZGF0ZS5tb250aCkucGFkU3RhcnQoMiwgXCIwXCIpfS0ke1N0cmluZyhkYXRlLmRheSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja1VzZXJBY3Rpb24oYWN0aW9uOiBBY3Rpb24pOiB2b2lkIHtcbiAgaWYgKGFjdGlvbi50eXBlID09PSBcImVkdWNhdGlvblwiICYmIGFzc2lzdGFudE9ubHkoYWN0aW9uLmNvbW1hbmQpKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgXCJcdThCRkVcdTdBMEJcdTMwMDFcdTRGNUNcdTRFMUFcdTMwMDFcdThCRDVcdTUzNzdcdTU0OENcdTYyNzlcdTY1MzlcdTc1MzFcdTVCNjZcdTRFNjBcdTUyQTlcdTYyNEJcdTc1MUZcdTYyMTBcdUZGMENcdThCRjdcdTU3MjhcdTVCRjlcdThCRERcdTRFMkRcdTYzRDBcdTUxRkFcdTg5ODFcdTZDNDJcIixcbiAgICApO1xuICB9XG59XG5cbmltcG9ydCB7IGFzc2lzdGFudE9ubHkgfSBmcm9tIFwiLi9lZHVjYXRpb25cIjtcblxuLy8gLS0tLS0tLS0tLSBBY3Rpb24gLS0tLS0tLS0tLVxuXG5leHBvcnQgdHlwZSBBY3Rpb24gPVxuICB8IHsgdHlwZTogXCJlZHVjYXRpb25cIjsgY29tbWFuZDogaW1wb3J0KFwiLi9lZHVjYXRpb25cIikuQ29tbWFuZCB9XG4gIHwgeyB0eXBlOiBcInByaW50SW5zdGFuY2VzXCI7IHNoYXBlOiBTaGFwZTsgcHJpbnRpbmc6IFByaW50aW5nIH1cbiAgfCB7IHR5cGU6IFwic2F2ZVRlbXBsYXRlXCI7IHRlbXBsYXRlOiBUZW1wbGF0ZTsgcHJpbnREYXRlczogKHN0cmluZyB8IG51bGwpW10gfVxuICB8IHsgdHlwZTogXCJkZWxldGVUZW1wbGF0ZVwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IHR5cGU6IFwicHJpbnRUZW1wbGF0ZVwiOyBpZDogc3RyaW5nOyBkYXRlczogKHN0cmluZyB8IG51bGwpW10gfVxuICB8IHsgdHlwZTogXCJzeW5jVGVtcGxhdGVcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiBcInN0YXJ0UmVtaW5kZXJcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiBcInNhdmVUYXNrXCI7IHRhc2s6IFRhc2tEcmFmdCB9XG4gIHwgeyB0eXBlOiBcInRvZ2dsZVRhc2tcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiBcImRlbGV0ZVRhc2tcIjsgaWQ6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiBcInJlc3RvcmVUYXNrXCI7IHRhc2s6IFRhc2sgfVxuICB8IHsgdHlwZTogXCJ0b2dnbGVTdWJ0YXNrXCI7IHRhc2tJZDogc3RyaW5nOyBzdWJ0YXNrSWQ6IHN0cmluZyB9XG4gIHwge1xuICAgICAgdHlwZTogXCJzYXZlUHJvamVjdFwiO1xuICAgICAgaWQ6IHN0cmluZyB8IG51bGw7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICBjb2xvcjogc3RyaW5nO1xuICAgICAgZGlyZWN0b3J5OiBzdHJpbmcgfCBudWxsO1xuICAgIH1cbiAgfCB7XG4gICAgICB0eXBlOiBcInJlbmFtZVByb2plY3REaXJlY3RvcnlcIjtcbiAgICAgIGlkOiBzdHJpbmc7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICBjb2xvcjogc3RyaW5nO1xuICAgICAgZGlyZWN0b3J5OiBzdHJpbmc7XG4gICAgfVxuICB8IHsgdHlwZTogXCJzZXRQcm9qZWN0V2hpdGVsaXN0XCI7IGlkOiBzdHJpbmc7IHdoaXRlbGlzdDogc3RyaW5nW10gfCBudWxsIH1cbiAgfCB7IHR5cGU6IFwiZGVsZXRlUHJvamVjdFwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IHR5cGU6IFwicmVvcmRlclByb2plY3RzXCI7IGlkczogc3RyaW5nW10gfVxuICB8IHsgdHlwZTogXCJkZXRhY2hUYXNrc1wiOyBpZHM6IHN0cmluZ1tdOyB0YXJnZXQ6IERldGFjaFRhcmdldCB9XG4gIHwgeyB0eXBlOiBcInNhdmVIYWJpdEdyb3VwXCI7IGlkOiBzdHJpbmcgfCBudWxsOyBuYW1lOiBzdHJpbmcgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwic2F2ZUhhYml0XCI7XG4gICAgICBpZDogc3RyaW5nIHwgbnVsbDtcbiAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgIHByb2plY3RJZDogc3RyaW5nIHwgbnVsbDtcbiAgICAgIGZvY3VzTWludXRlczogbnVtYmVyIHwgbnVsbDtcbiAgICAgIHNsb3RzOiBIYWJpdFNsb3RbXTtcbiAgICB9XG4gIHwgeyB0eXBlOiBcImRlbGV0ZUhhYml0XCI7IGlkOiBzdHJpbmcgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwic2F2ZVZpc2lvblwiO1xuICAgICAgaWQ6IHN0cmluZyB8IG51bGw7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICBub3Rlczogc3RyaW5nO1xuICAgICAgcHJvamVjdElkOiBzdHJpbmcgfCBudWxsO1xuICAgIH1cbiAgfCB7IHR5cGU6IFwiZGVsZXRlVmlzaW9uXCI7IGlkOiBzdHJpbmcgfVxuICB8IHtcbiAgICAgIHR5cGU6IFwic2F2ZUJsb2NrXCI7XG4gICAgICBpZDogc3RyaW5nIHwgbnVsbDtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBkYXlzOiBudW1iZXJbXTtcbiAgICAgIHN0YXJ0OiBzdHJpbmc7XG4gICAgICBlbmQ6IHN0cmluZztcbiAgICAgIGF0dGVudGlvbjogQXR0ZW50aW9uO1xuICAgICAgbm90ZXM6IHN0cmluZztcbiAgICB9XG4gIHwgeyB0eXBlOiBcImRlbGV0ZUJsb2NrXCI7IGlkOiBzdHJpbmcgfVxuICB8IHsgdHlwZTogXCJzZWxlY3RUYXNrXCI7IGlkOiBzdHJpbmcgfCBudWxsIH1cbiAgfCB7IHR5cGU6IFwic3RhcnRUaW1lclwiOyBtaW51dGVzPzogbnVtYmVyIHwgbnVsbCB9XG4gIHwgeyB0eXBlOiBcImNvbXBsZXRlRm9jdXNcIiB9XG4gIHwgeyB0eXBlOiBcInBhdXNlVGltZXJcIiB9XG4gIHwgeyB0eXBlOiBcInJlc2V0VGltZXJcIiB9XG4gIHwgeyB0eXBlOiBcInNraXBUaW1lclwiIH1cbiAgfCB7IHR5cGU6IFwic2V0TW9kZVwiOyBtb2RlOiBNb2RlIH1cbiAgfCB7IHR5cGU6IFwic2F2ZVNldHRpbmdzXCI7IHNldHRpbmdzOiBTZXR0aW5ncyB9XG4gIHwgeyB0eXBlOiBcImxvYWRFeGFtcGxlXCIgfVxuICB8IHsgdHlwZTogXCJpbXBvcnRcIjsgZGF0YTogQXBwRGF0YSB9XG4gIHwgeyB0eXBlOiBcImltcG9ydFBsYW5cIjsgcGxhbjogUGxhbkZpbGUgfVxuICB8IHsgdHlwZTogXCJlbWVyZ2VuY3lVbmxvY2tcIiB9XG4gIHwgeyB0eXBlOiBcInNhdmVMb2NrU2NoZWR1bGVcIjsgc2NoZWR1bGU6IExvY2tTY2hlZHVsZSB9XG4gIHwgeyB0eXBlOiBcImRlbGV0ZUxvY2tTY2hlZHVsZVwiOyBpZDogc3RyaW5nIH1cbiAgfCB7IHR5cGU6IFwic3RhcnRRdWlja0xvY2tcIjsgbWludXRlczogbnVtYmVyOyBzdHJpY3Q6IGJvb2xlYW4gfTtcblxuaW1wb3J0IHsgcGFyc2VQbGFuRmlsZSB9IGZyb20gXCIuL3BsYW5cIjtcbmltcG9ydCB7IHBhcnNlQ29tbWFuZCB9IGZyb20gXCIuL2VkdWNhdGlvblwiO1xuaW1wb3J0IHsgcGFyc2VUZW1wbGF0ZSwgcGFyc2VQcmludGluZywgcGFyc2VTaGFwZSB9IGZyb20gXCIuL3RlbXBsYXRlc1wiO1xuaW1wb3J0IHsgcGFyc2VMb2NrU2NoZWR1bGUgfSBmcm9tIFwiLi9sb2NrXCI7XG5cbmNvbnN0IEFDVElPTl9LRVlTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gIGVkdWNhdGlvbjogW1widHlwZVwiLCBcImNvbW1hbmRcIl0sXG4gIHByaW50SW5zdGFuY2VzOiBbXCJ0eXBlXCIsIFwic2hhcGVcIiwgXCJwcmludGluZ1wiXSxcbiAgc2F2ZVRlbXBsYXRlOiBbXCJ0eXBlXCIsIFwidGVtcGxhdGVcIiwgXCJwcmludERhdGVzXCJdLFxuICBkZWxldGVUZW1wbGF0ZTogW1widHlwZVwiLCBcImlkXCJdLFxuICBwcmludFRlbXBsYXRlOiBbXCJ0eXBlXCIsIFwiaWRcIiwgXCJkYXRlc1wiXSxcbiAgc3luY1RlbXBsYXRlOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHN0YXJ0UmVtaW5kZXI6IFtcInR5cGVcIiwgXCJpZFwiXSxcbiAgc2F2ZVRhc2s6IFtcInR5cGVcIiwgXCJ0YXNrXCJdLFxuICB0b2dnbGVUYXNrOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIGRlbGV0ZVRhc2s6IFtcInR5cGVcIiwgXCJpZFwiXSxcbiAgcmVzdG9yZVRhc2s6IFtcInR5cGVcIiwgXCJ0YXNrXCJdLFxuICB0b2dnbGVTdWJ0YXNrOiBbXCJ0eXBlXCIsIFwidGFza0lkXCIsIFwic3VidGFza0lkXCJdLFxuICBzYXZlUHJvamVjdDogW1widHlwZVwiLCBcImlkXCIsIFwibmFtZVwiLCBcImNvbG9yXCIsIFwiZGlyZWN0b3J5XCJdLFxuICByZW5hbWVQcm9qZWN0RGlyZWN0b3J5OiBbXCJ0eXBlXCIsIFwiaWRcIiwgXCJuYW1lXCIsIFwiY29sb3JcIiwgXCJkaXJlY3RvcnlcIl0sXG4gIHNldFByb2plY3RXaGl0ZWxpc3Q6IFtcInR5cGVcIiwgXCJpZFwiLCBcIndoaXRlbGlzdFwiXSxcbiAgZGVsZXRlUHJvamVjdDogW1widHlwZVwiLCBcImlkXCJdLFxuICByZW9yZGVyUHJvamVjdHM6IFtcInR5cGVcIiwgXCJpZHNcIl0sXG4gIGRldGFjaFRhc2tzOiBbXCJ0eXBlXCIsIFwiaWRzXCIsIFwidGFyZ2V0XCJdLFxuICBzYXZlSGFiaXRHcm91cDogW1widHlwZVwiLCBcImlkXCIsIFwibmFtZVwiXSxcbiAgc2F2ZUhhYml0OiBbXCJ0eXBlXCIsIFwiaWRcIiwgXCJuYW1lXCIsIFwicHJvamVjdElkXCIsIFwiZm9jdXNNaW51dGVzXCIsIFwic2xvdHNcIl0sXG4gIGRlbGV0ZUhhYml0OiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHNhdmVWaXNpb246IFtcInR5cGVcIiwgXCJpZFwiLCBcIm5hbWVcIiwgXCJub3Rlc1wiLCBcInByb2plY3RJZFwiXSxcbiAgZGVsZXRlVmlzaW9uOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHNhdmVCbG9jazogW1xuICAgIFwidHlwZVwiLFxuICAgIFwiaWRcIixcbiAgICBcInRpdGxlXCIsXG4gICAgXCJkYXlzXCIsXG4gICAgXCJzdGFydFwiLFxuICAgIFwiZW5kXCIsXG4gICAgXCJhdHRlbnRpb25cIixcbiAgICBcIm5vdGVzXCIsXG4gIF0sXG4gIGRlbGV0ZUJsb2NrOiBbXCJ0eXBlXCIsIFwiaWRcIl0sXG4gIHNlbGVjdFRhc2s6IFtcInR5cGVcIiwgXCJpZFwiXSxcbiAgc3RhcnRUaW1lcjogW1widHlwZVwiLCBcIm1pbnV0ZXNcIl0sXG4gIGNvbXBsZXRlRm9jdXM6IFtcInR5cGVcIl0sXG4gIHBhdXNlVGltZXI6IFtcInR5cGVcIl0sXG4gIHJlc2V0VGltZXI6IFtcInR5cGVcIl0sXG4gIHNraXBUaW1lcjogW1widHlwZVwiXSxcbiAgc2V0TW9kZTogW1widHlwZVwiLCBcIm1vZGVcIl0sXG4gIHNhdmVTZXR0aW5nczogW1widHlwZVwiLCBcInNldHRpbmdzXCJdLFxuICBsb2FkRXhhbXBsZTogW1widHlwZVwiXSxcbiAgaW1wb3J0OiBbXCJ0eXBlXCIsIFwiZGF0YVwiXSxcbiAgaW1wb3J0UGxhbjogW1widHlwZVwiLCBcInBsYW5cIl0sXG4gIGVtZXJnZW5jeVVubG9jazogW1widHlwZVwiXSxcbiAgc2F2ZUxvY2tTY2hlZHVsZTogW1widHlwZVwiLCBcInNjaGVkdWxlXCJdLFxuICBkZWxldGVMb2NrU2NoZWR1bGU6IFtcInR5cGVcIiwgXCJpZFwiXSxcbiAgc3RhcnRRdWlja0xvY2s6IFtcInR5cGVcIiwgXCJtaW51dGVzXCIsIFwic3RyaWN0XCJdLFxufTtcblxuY29uc3QgQUNUSU9OX05BTUVTID0gT2JqZWN0LmtleXMoQUNUSU9OX0tFWVMpO1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VBY3Rpb24ocmF3OiB1bmtub3duKTogQWN0aW9uIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTUyQThcdTRGNUNcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIGNvbnN0IHR5cGUgPSBvbmVPZihcbiAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJ0eXBlXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICBcIlx1NTJBOFx1NEY1QyB0eXBlXCIsXG4gICAgQUNUSU9OX05BTUVTLFxuICApO1xuICByZWplY3RVbmtub3duKHJhdywgQUNUSU9OX0tFWVNbdHlwZV0hLCBcIlx1NTJBOFx1NEY1Q1wiKTtcbiAgY29uc3Qgc3RyID0gKGtleTogc3RyaW5nKTogc3RyaW5nID0+IHJlcXVpcmVkRmllbGQocmF3LCBrZXksIFwiXHU1MkE4XHU0RjVDXCIsIGFzU3RyKTtcbiAgY29uc3Qgb3B0U3RyID0gKGtleTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCA9PlxuICAgIGZpZWxkKHJhdywga2V5LCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gYXNPcHQodiwga2V5LCBhc1N0ciksIG51bGwpIGFzIHN0cmluZyB8IG51bGw7XG4gIGNvbnN0IHN0cnMgPSAoa2V5OiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxuICAgIGFzQXJyYXkoXG4gICAgICByZXF1aXJlZEZpZWxkKHJhdywga2V5LCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdiksXG4gICAgICBrZXksXG4gICAgKS5tYXAoKHgpID0+IGFzU3RyKHgsIGtleSkpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFwiZWR1Y2F0aW9uXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBjb21tYW5kOiBwYXJzZUNvbW1hbmQocmVxdWlyZWRGaWVsZChyYXcsIFwiY29tbWFuZFwiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdikpLFxuICAgICAgfTtcbiAgICBjYXNlIFwicHJpbnRJbnN0YW5jZXNcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHNoYXBlOiBwYXJzZVNoYXBlKHJlcXVpcmVkRmllbGQocmF3LCBcInNoYXBlXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSksXG4gICAgICAgIHByaW50aW5nOiBwYXJzZVByaW50aW5nKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInByaW50aW5nXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNhdmVUZW1wbGF0ZVwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgdGVtcGxhdGU6IHBhcnNlVGVtcGxhdGUoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwidGVtcGxhdGVcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpLFxuICAgICAgICApLFxuICAgICAgICBwcmludERhdGVzOiBmaWVsZChcbiAgICAgICAgICByYXcsXG4gICAgICAgICAgXCJwcmludERhdGVzXCIsXG4gICAgICAgICAgXCJcdTUyQThcdTRGNUNcIixcbiAgICAgICAgICAodikgPT5cbiAgICAgICAgICAgIGFzQXJyYXkodiwgXCJwcmludERhdGVzXCIpLm1hcCgoZCkgPT5cbiAgICAgICAgICAgICAgZCA9PT0gbnVsbCA/IG51bGwgOiBhc1N0cihkLCBcInByaW50RGF0ZXNcIiksXG4gICAgICAgICAgICApLFxuICAgICAgICAgIFtdLFxuICAgICAgICApIGFzIChzdHJpbmcgfCBudWxsKVtdLFxuICAgICAgfTtcbiAgICBjYXNlIFwiZGVsZXRlVGVtcGxhdGVcIjpcbiAgICBjYXNlIFwic3luY1RlbXBsYXRlXCI6XG4gICAgY2FzZSBcInN0YXJ0UmVtaW5kZXJcIjpcbiAgICBjYXNlIFwidG9nZ2xlVGFza1wiOlxuICAgIGNhc2UgXCJkZWxldGVUYXNrXCI6XG4gICAgY2FzZSBcImRlbGV0ZVByb2plY3RcIjpcbiAgICBjYXNlIFwiZGVsZXRlSGFiaXRcIjpcbiAgICBjYXNlIFwiZGVsZXRlVmlzaW9uXCI6XG4gICAgY2FzZSBcImRlbGV0ZUJsb2NrXCI6XG4gICAgY2FzZSBcImRlbGV0ZUxvY2tTY2hlZHVsZVwiOlxuICAgICAgcmV0dXJuIHsgdHlwZSwgaWQ6IHN0cihcImlkXCIpIH07XG4gICAgY2FzZSBcInByaW50VGVtcGxhdGVcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkOiBzdHIoXCJpZFwiKSxcbiAgICAgICAgZGF0ZXM6IGFzQXJyYXkoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwiZGF0ZXNcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwiZGF0ZXNcIixcbiAgICAgICAgKS5tYXAoKGQpID0+IChkID09PSBudWxsID8gbnVsbCA6IGFzU3RyKGQsIFwiZGF0ZXNcIikpKSBhcyAoXG4gICAgICAgICAgc3RyaW5nIHwgbnVsbFxuICAgICAgICApW10sXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlVGFza1wiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgdGFzazogcGFyc2VUYXNrRHJhZnQocmVxdWlyZWRGaWVsZChyYXcsIFwidGFza1wiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdikpLFxuICAgICAgfTtcbiAgICBjYXNlIFwicmVzdG9yZVRhc2tcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHRhc2s6IHBhcnNlVGFzayhyZXF1aXJlZEZpZWxkKHJhdywgXCJ0YXNrXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSksXG4gICAgICB9O1xuICAgIGNhc2UgXCJ0b2dnbGVTdWJ0YXNrXCI6XG4gICAgICByZXR1cm4geyB0eXBlLCB0YXNrSWQ6IHN0cihcInRhc2tJZFwiKSwgc3VidGFza0lkOiBzdHIoXCJzdWJ0YXNrSWRcIikgfTtcbiAgICBjYXNlIFwic2F2ZVByb2plY3RcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkOiBvcHRTdHIoXCJpZFwiKSxcbiAgICAgICAgbmFtZTogc3RyKFwibmFtZVwiKSxcbiAgICAgICAgY29sb3I6IHN0cihcImNvbG9yXCIpLFxuICAgICAgICBkaXJlY3Rvcnk6IG9wdFN0cihcImRpcmVjdG9yeVwiKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInJlbmFtZVByb2plY3REaXJlY3RvcnlcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkOiBzdHIoXCJpZFwiKSxcbiAgICAgICAgbmFtZTogc3RyKFwibmFtZVwiKSxcbiAgICAgICAgY29sb3I6IHN0cihcImNvbG9yXCIpLFxuICAgICAgICBkaXJlY3Rvcnk6IHN0cihcImRpcmVjdG9yeVwiKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNldFByb2plY3RXaGl0ZWxpc3RcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkOiBzdHIoXCJpZFwiKSxcbiAgICAgICAgd2hpdGVsaXN0OiBmaWVsZChcbiAgICAgICAgICByYXcsXG4gICAgICAgICAgXCJ3aGl0ZWxpc3RcIixcbiAgICAgICAgICBcIlx1NTJBOFx1NEY1Q1wiLFxuICAgICAgICAgICh2KSA9PlxuICAgICAgICAgICAgYXNPcHQodiwgXCJ3aGl0ZWxpc3RcIiwgKHgpID0+XG4gICAgICAgICAgICAgIGFzQXJyYXkoeCwgXCJ3aGl0ZWxpc3RcIikubWFwKChhKSA9PiBhc1N0cihhLCBcIndoaXRlbGlzdFwiKSksXG4gICAgICAgICAgICApLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICkgYXMgc3RyaW5nW10gfCBudWxsLFxuICAgICAgfTtcbiAgICBjYXNlIFwicmVvcmRlclByb2plY3RzXCI6XG4gICAgICByZXR1cm4geyB0eXBlLCBpZHM6IHN0cnMoXCJpZHNcIikgfTtcbiAgICBjYXNlIFwiZGV0YWNoVGFza3NcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkczogc3RycyhcImlkc1wiKSxcbiAgICAgICAgdGFyZ2V0OiBvbmVPZihcbiAgICAgICAgICByZXF1aXJlZEZpZWxkKHJhdywgXCJ0YXJnZXRcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwiZGV0YWNoIHRhcmdldFwiLFxuICAgICAgICAgIFtcInByb2plY3RcIiwgXCJoYWJpdFwiXSxcbiAgICAgICAgKSBhcyBEZXRhY2hUYXJnZXQsXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlSGFiaXRHcm91cFwiOlxuICAgICAgcmV0dXJuIHsgdHlwZSwgaWQ6IG9wdFN0cihcImlkXCIpLCBuYW1lOiBzdHIoXCJuYW1lXCIpIH07XG4gICAgY2FzZSBcInNhdmVIYWJpdFwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgaWQ6IG9wdFN0cihcImlkXCIpLFxuICAgICAgICBuYW1lOiBzdHIoXCJuYW1lXCIpLFxuICAgICAgICBwcm9qZWN0SWQ6IG9wdFN0cihcInByb2plY3RJZFwiKSxcbiAgICAgICAgZm9jdXNNaW51dGVzOiBmaWVsZChcbiAgICAgICAgICByYXcsXG4gICAgICAgICAgXCJmb2N1c01pbnV0ZXNcIixcbiAgICAgICAgICBcIlx1NTJBOFx1NEY1Q1wiLFxuICAgICAgICAgICh2KSA9PiBhc09wdCh2LCBcImZvY3VzTWludXRlc1wiLCAoeCkgPT4gYXNJbnQoeCwgXCJmb2N1c01pbnV0ZXNcIikpLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgICAgc2xvdHM6IGFzQXJyYXkoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwic2xvdHNcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwic2xvdHNcIixcbiAgICAgICAgKS5tYXAocGFyc2VIYWJpdFNsb3QpLFxuICAgICAgfTtcbiAgICBjYXNlIFwic2F2ZVZpc2lvblwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgaWQ6IG9wdFN0cihcImlkXCIpLFxuICAgICAgICBuYW1lOiBzdHIoXCJuYW1lXCIpLFxuICAgICAgICBub3RlczogZmllbGQocmF3LCBcIm5vdGVzXCIsIFwiXHU1MkE4XHU0RjVDXCIsIGFzU3RyLCBcIlwiKSxcbiAgICAgICAgcHJvamVjdElkOiBvcHRTdHIoXCJwcm9qZWN0SWRcIiksXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlQmxvY2tcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIGlkOiBvcHRTdHIoXCJpZFwiKSxcbiAgICAgICAgdGl0bGU6IHN0cihcInRpdGxlXCIpLFxuICAgICAgICBkYXlzOiBhc0FycmF5KFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcImRheXNcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpLFxuICAgICAgICAgIFwiZGF5c1wiLFxuICAgICAgICApLm1hcCgoZCkgPT4gYXNJbnQoZCwgXCJkYXlzXCIpKSxcbiAgICAgICAgc3RhcnQ6IHN0cihcInN0YXJ0XCIpLFxuICAgICAgICBlbmQ6IHN0cihcImVuZFwiKSxcbiAgICAgICAgYXR0ZW50aW9uOiBmaWVsZChcbiAgICAgICAgICByYXcsXG4gICAgICAgICAgXCJhdHRlbnRpb25cIixcbiAgICAgICAgICBcIlx1NTJBOFx1NEY1Q1wiLFxuICAgICAgICAgICh2KSA9PiBvbmVPZih2LCBcImF0dGVudGlvblwiLCBbXCJyZXF1aXJlZFwiLCBcImxpZ2h0XCJdKSxcbiAgICAgICAgICBcInJlcXVpcmVkXCIsXG4gICAgICAgICkgYXMgQXR0ZW50aW9uLFxuICAgICAgICBub3RlczogZmllbGQocmF3LCBcIm5vdGVzXCIsIFwiXHU1MkE4XHU0RjVDXCIsIGFzU3RyLCBcIlwiKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInNlbGVjdFRhc2tcIjpcbiAgICAgIHJldHVybiB7IHR5cGUsIGlkOiBvcHRTdHIoXCJpZFwiKSB9O1xuICAgIGNhc2UgXCJzdGFydFRpbWVyXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBtaW51dGVzOiBmaWVsZChcbiAgICAgICAgICByYXcsXG4gICAgICAgICAgXCJtaW51dGVzXCIsXG4gICAgICAgICAgXCJcdTUyQThcdTRGNUNcIixcbiAgICAgICAgICAodikgPT4gYXNPcHQodiwgXCJtaW51dGVzXCIsICh4KSA9PiBhc0ludCh4LCBcIm1pbnV0ZXNcIikpLFxuICAgICAgICAgIG51bGwsXG4gICAgICAgICkgYXMgbnVtYmVyIHwgbnVsbCxcbiAgICAgIH07XG4gICAgY2FzZSBcImNvbXBsZXRlRm9jdXNcIjpcbiAgICBjYXNlIFwicGF1c2VUaW1lclwiOlxuICAgIGNhc2UgXCJyZXNldFRpbWVyXCI6XG4gICAgY2FzZSBcInNraXBUaW1lclwiOlxuICAgIGNhc2UgXCJsb2FkRXhhbXBsZVwiOlxuICAgIGNhc2UgXCJlbWVyZ2VuY3lVbmxvY2tcIjpcbiAgICAgIHJldHVybiB7IHR5cGUgfTtcbiAgICBjYXNlIFwic2V0TW9kZVwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgbW9kZTogb25lT2YoXG4gICAgICAgICAgcmVxdWlyZWRGaWVsZChyYXcsIFwibW9kZVwiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdiksXG4gICAgICAgICAgXCJtb2RlXCIsXG4gICAgICAgICAgW1wiZm9jdXNcIiwgXCJzaG9ydEJyZWFrXCIsIFwibG9uZ0JyZWFrXCJdLFxuICAgICAgICApIGFzIE1vZGUsXG4gICAgICB9O1xuICAgIGNhc2UgXCJzYXZlU2V0dGluZ3NcIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHNldHRpbmdzOiBwYXJzZVNldHRpbmdzKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNldHRpbmdzXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcImltcG9ydFwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgZGF0YTogcGFyc2VBcHBEYXRhKHJlcXVpcmVkRmllbGQocmF3LCBcImRhdGFcIiwgXCJcdTUyQThcdTRGNUNcIiwgKHYpID0+IHYpKSxcbiAgICAgIH07XG4gICAgY2FzZSBcImltcG9ydFBsYW5cIjpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHBsYW46IHBhcnNlUGxhbkZpbGUocmVxdWlyZWRGaWVsZChyYXcsIFwicGxhblwiLCBcIlx1NTJBOFx1NEY1Q1wiLCAodikgPT4gdikpLFxuICAgICAgfTtcbiAgICBjYXNlIFwic2F2ZUxvY2tTY2hlZHVsZVwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgc2NoZWR1bGU6IHBhcnNlTG9ja1NjaGVkdWxlKFxuICAgICAgICAgIHJlcXVpcmVkRmllbGQocmF3LCBcInNjaGVkdWxlXCIsIFwiXHU1MkE4XHU0RjVDXCIsICh2KSA9PiB2KSxcbiAgICAgICAgKSxcbiAgICAgIH07XG4gICAgY2FzZSBcInN0YXJ0UXVpY2tMb2NrXCI6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBtaW51dGVzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJtaW51dGVzXCIsIFwiXHU1MkE4XHU0RjVDXCIsIGFzSW50KSxcbiAgICAgICAgc3RyaWN0OiByZXF1aXJlZEZpZWxkKHJhdywgXCJzdHJpY3RcIiwgXCJcdTUyQThcdTRGNUNcIiwgYXNCb29sKSxcbiAgICAgIH07XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcihgXHU1MkE4XHU0RjVDIHR5cGUgXHU1M0Q2XHU1MDNDXHU2NUUwXHU2NTQ4XHVGRjFBJHt0eXBlfWApO1xuICB9XG59XG5cbi8vIC0tLS0tLS0tLS0gQXBwRGF0YSBcdTg5RTNcdTY3OTAvXHU1RThGXHU1MjE3XHU1MzE2IC0tLS0tLS0tLS1cblxuY29uc3QgQVBQX0RBVEFfS0VZUyA9IFtcbiAgXCJlZHVjYXRpb25cIixcbiAgXCJ2ZXJzaW9uXCIsXG4gIFwiaWRlbnRpdGllc1wiLFxuICBcInRhc2tzXCIsXG4gIFwiYmxvY2tzXCIsXG4gIFwidGVtcGxhdGVzXCIsXG4gIFwicHJpbnRzXCIsXG4gIFwicHJvamVjdHNcIixcbiAgXCJoYWJpdHNcIixcbiAgXCJ2aXNpb25zXCIsXG4gIFwic2V0dGluZ3NcIixcbiAgXCJ0aW1lclwiLFxuICBcInNlc3Npb25zXCIsXG4gIFwibG9ja1wiLFxuXSBhcyBjb25zdDtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQXBwRGF0YShyYXc6IHVua25vd24pOiBBcHBEYXRhIHtcbiAgaWYgKCFpc09iamVjdChyYXcpKSB0aHJvdyBuZXcgQXBwRXJyb3IoXCJcdTY1NzBcdTYzNkVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gIC8vIFx1NEUwRSBSdXN0ICNbc2VyZGUoZGVueV91bmtub3duX2ZpZWxkcyldIFx1NUJGOVx1OUY1MFx1RkYxQVx1OTg3Nlx1NUM0Mlx1NjcyQVx1NzdFNVx1NUI1N1x1NkJCNVx1NzZGNFx1NjNBNVx1NjJEMlx1N0VERFx1RkYwOFx1NEUwRFx1NTE3Q1x1NUJCOVx1NjVFN1x1NTM0Rlx1OEJBRVx1RkYwOVx1MzAwMlxuICByZWplY3RVbmtub3duKFxuICAgIHJhdyxcbiAgICBbXG4gICAgICBcImVkdWNhdGlvblwiLFxuICAgICAgXCJ2ZXJzaW9uXCIsXG4gICAgICBcImlkZW50aXRpZXNcIixcbiAgICAgIFwidGFza3NcIixcbiAgICAgIFwiYmxvY2tzXCIsXG4gICAgICBcInRlbXBsYXRlc1wiLFxuICAgICAgXCJwcmludHNcIixcbiAgICAgIFwicHJvamVjdHNcIixcbiAgICAgIFwiaGFiaXRzXCIsXG4gICAgICBcInZpc2lvbnNcIixcbiAgICAgIFwic2V0dGluZ3NcIixcbiAgICAgIFwidGltZXJcIixcbiAgICAgIFwic2Vzc2lvbnNcIixcbiAgICAgIFwibG9ja1wiLFxuICAgIF0sXG4gICAgXCJcdTY1NzBcdTYzNkVcIixcbiAgKTtcbiAgcmV0dXJuIG5ldyBBcHBEYXRhKHtcbiAgICBlZHVjYXRpb246IGZpZWxkKHJhdywgXCJlZHVjYXRpb25cIiwgXCJcdTY1NzBcdTYzNkVcIiwgcGFyc2VFZHVjYXRpb24sIG5ldyBFZHVjYXRpb24oKSksXG4gICAgdmVyc2lvbjogcmVxdWlyZWRGaWVsZChyYXcsIFwidmVyc2lvblwiLCBcIlx1NjU3MFx1NjM2RVwiLCBhc0ludCksXG4gICAgaWRlbnRpdGllczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImlkZW50aXRpZXNcIixcbiAgICAgIFwiXHU2NTcwXHU2MzZFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcImlkZW50aXRpZXNcIikubWFwKHBhcnNlSWRlbnRpdHkpLFxuICAgICAgW10sXG4gICAgKSxcbiAgICB0YXNrczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInRhc2tzXCIsXG4gICAgICBcIlx1NjU3MFx1NjM2RVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJ0YXNrc1wiKS5tYXAocGFyc2VUYXNrKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgYmxvY2tzOiBmaWVsZChcbiAgICAgIHJhdyxcbiAgICAgIFwiYmxvY2tzXCIsXG4gICAgICBcIlx1NjU3MFx1NjM2RVwiLFxuICAgICAgKHYpID0+IGFzQXJyYXkodiwgXCJibG9ja3NcIikubWFwKHBhcnNlQmxvY2spLFxuICAgICAgW10sXG4gICAgKSxcbiAgICB0ZW1wbGF0ZXM6IGZpZWxkKFxuICAgICAgcmF3LFxuICAgICAgXCJ0ZW1wbGF0ZXNcIixcbiAgICAgIFwiXHU2NTcwXHU2MzZFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInRlbXBsYXRlc1wiKS5tYXAocGFyc2VUZW1wbGF0ZSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHByaW50czogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInByaW50c1wiLFxuICAgICAgXCJcdTY1NzBcdTYzNkVcIixcbiAgICAgICh2KSA9PlxuICAgICAgICBhc0FycmF5KHYsIFwicHJpbnRzXCIpLm1hcCgocCkgPT4ge1xuICAgICAgICAgIGVuc3VyZShpc09iamVjdChwKSwgXCJcdTUzNzBcdTUyMzdcdThCQjBcdTVGNTVcdTVGQzVcdTk4N0JcdTY2MkZcdTVCRjlcdThDNjFcIik7XG4gICAgICAgICAgcmVqZWN0VW5rbm93bihwLCBbXCJ0ZW1wbGF0ZUlkXCIsIFwiZGF0ZVwiXSwgXCJcdTUzNzBcdTUyMzdcdThCQjBcdTVGNTVcIik7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHRlbXBsYXRlSWQ6IHJlcXVpcmVkRmllbGQocCwgXCJ0ZW1wbGF0ZUlkXCIsIFwiXHU1MzcwXHU1MjM3XHU4QkIwXHU1RjU1XCIsIGFzU3RyKSxcbiAgICAgICAgICAgIGRhdGU6IGZpZWxkKFxuICAgICAgICAgICAgICBwLFxuICAgICAgICAgICAgICBcImRhdGVcIixcbiAgICAgICAgICAgICAgXCJcdTUzNzBcdTUyMzdcdThCQjBcdTVGNTVcIixcbiAgICAgICAgICAgICAgKGQpID0+IGFzT3B0KGQsIFwiZGF0ZVwiLCBhc1N0ciksXG4gICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICApIGFzIHN0cmluZyB8IG51bGwsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSksXG4gICAgICBbXSxcbiAgICApLFxuICAgIHByb2plY3RzOiByZXF1aXJlZEZpZWxkKHJhdywgXCJwcm9qZWN0c1wiLCBcIlx1NjU3MFx1NjM2RVwiLCAodikgPT5cbiAgICAgIGFzQXJyYXkodiwgXCJwcm9qZWN0c1wiKS5tYXAocGFyc2VQcm9qZWN0KSxcbiAgICApLFxuICAgIGhhYml0czogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcImhhYml0c1wiLFxuICAgICAgXCJcdTY1NzBcdTYzNkVcIixcbiAgICAgICh2KSA9PiBhc0FycmF5KHYsIFwiaGFiaXRzXCIpLm1hcChwYXJzZUhhYml0KSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgdmlzaW9uczogZmllbGQoXG4gICAgICByYXcsXG4gICAgICBcInZpc2lvbnNcIixcbiAgICAgIFwiXHU2NTcwXHU2MzZFXCIsXG4gICAgICAodikgPT4gYXNBcnJheSh2LCBcInZpc2lvbnNcIikubWFwKHBhcnNlVmlzaW9uKSxcbiAgICAgIFtdLFxuICAgICksXG4gICAgc2V0dGluZ3M6IHJlcXVpcmVkRmllbGQocmF3LCBcInNldHRpbmdzXCIsIFwiXHU2NTcwXHU2MzZFXCIsIHBhcnNlU2V0dGluZ3MpLFxuICAgIHRpbWVyOiByZXF1aXJlZEZpZWxkKHJhdywgXCJ0aW1lclwiLCBcIlx1NjU3MFx1NjM2RVwiLCBwYXJzZVRpbWVyKSxcbiAgICBzZXNzaW9uczogcmVxdWlyZWRGaWVsZChyYXcsIFwic2Vzc2lvbnNcIiwgXCJcdTY1NzBcdTYzNkVcIiwgKHYpID0+XG4gICAgICBhc0FycmF5KHYsIFwic2Vzc2lvbnNcIikubWFwKHBhcnNlU2Vzc2lvbiksXG4gICAgKSxcbiAgICBsb2NrOiBmaWVsZChyYXcsIFwibG9ja1wiLCBcIlx1NjU3MFx1NjM2RVwiLCBwYXJzZUxvY2tTdGF0ZSwge1xuICAgICAgc2NoZWR1bGVzOiBbXSxcbiAgICAgIGFjdGl2ZTogbnVsbCxcbiAgICAgIHN1cHByZXNzZWRVbnRpbDogMCxcbiAgICB9KSxcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVBcHBEYXRhKGRhdGE6IEFwcERhdGEpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIHJldHVybiB7XG4gICAgZWR1Y2F0aW9uOiBzZXJpYWxpemVFZHVjYXRpb24oZGF0YS5lZHVjYXRpb24pLFxuICAgIHZlcnNpb246IGRhdGEudmVyc2lvbixcbiAgICBpZGVudGl0aWVzOiBkYXRhLmlkZW50aXRpZXMubWFwKHNlcmlhbGl6ZUlkZW50aXR5KSxcbiAgICB0YXNrczogZGF0YS50YXNrcy5tYXAoc2VyaWFsaXplVGFzayksXG4gICAgYmxvY2tzOiBkYXRhLmJsb2Nrcy5tYXAoc2VyaWFsaXplQmxvY2spLFxuICAgIHRlbXBsYXRlczogZGF0YS50ZW1wbGF0ZXMubWFwKHNlcmlhbGl6ZVRlbXBsYXRlKSxcbiAgICBwcmludHM6IGRhdGEucHJpbnRzLm1hcChzZXJpYWxpemVQcmludFJlY29yZCksXG4gICAgcHJvamVjdHM6IGRhdGEucHJvamVjdHMubWFwKHNlcmlhbGl6ZVByb2plY3QpLFxuICAgIGhhYml0czogZGF0YS5oYWJpdHMubWFwKHNlcmlhbGl6ZUhhYml0KSxcbiAgICB2aXNpb25zOiBkYXRhLnZpc2lvbnMubWFwKHNlcmlhbGl6ZVZpc2lvbiksXG4gICAgc2V0dGluZ3M6IHNlcmlhbGl6ZVNldHRpbmdzKGRhdGEuc2V0dGluZ3MpLFxuICAgIHRpbWVyOiBzZXJpYWxpemVUaW1lcihkYXRhLnRpbWVyKSxcbiAgICBzZXNzaW9uczogZGF0YS5zZXNzaW9ucy5tYXAoc2VyaWFsaXplU2Vzc2lvbiksXG4gICAgbG9jazogc2VyaWFsaXplTG9ja1N0YXRlKGRhdGEubG9jayksXG4gIH07XG59XG5cbmltcG9ydCB7IHNlcmlhbGl6ZVByaW50UmVjb3JkLCBzZXJpYWxpemVUZW1wbGF0ZSB9IGZyb20gXCIuL3RlbXBsYXRlc1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVCbG9jayB9IGZyb20gXCIuL2Jsb2Nrc1wiO1xuaW1wb3J0IHsgaXNBYnNvbHV0ZVBhdGggfSBmcm9tIFwiLi9lZHVjYXRpb25cIjtcbiIsICIvLyEgXHU0RUM1XHU2NzJDXHU1NzMwIHYzXHUyMTkydjQgXHU4RjZDXHU2MzYyXHVGRjFBXHU0RUE0XHU2MzYyXHU2NTg3XHU0RUY2XHU2MzA5XHU1RjUzXHU1MjREXHU3MjQ4XHU2NzJDXHU0RTI1XHU2ODNDXHU2ODIxXHU5QThDXHVGRjBDXHU0RTBEXHU4RDcwXHU4RkMxXHU3OUZCXHU4REVGXHU1Rjg0XHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9taWdyYXRpb24ucnNcdUZGMDhcdTRFQzVcdTY1ODdcdTRFRjZcdTY4M0NcdTVGMEZcdThCRURcdTRFNDlcdUZGMDlcdTMwMDJcblxuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB7IGRhdGVBdCwgbm93IH0gZnJvbSBcIi4vdGltZVwiO1xuaW1wb3J0IHsgcGFyc2VBcHBEYXRhLCBwYXJzZVRhc2ssIHNlcmlhbGl6ZVRhc2sgfSBmcm9tIFwiLi9saWJcIjtcblxuZnVuY3Rpb24gdXBncmFkZVRhc2tWYWx1ZSh0YXNrOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgdG9kYXk6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBkYXRlID1cbiAgICB0eXBlb2YgdGFza1tcImNyZWF0ZWRBdFwiXSA9PT0gXCJudW1iZXJcIlxuICAgICAgPyBkYXRlQXQodGFza1tcImNyZWF0ZWRBdFwiXSBhcyBudW1iZXIpXG4gICAgICA6IHRvZGF5O1xuICBkZWxldGUgdGFza1tcImdvYWxJZFwiXTtcbiAgZGVsZXRlIHRhc2tbXCJub2RlSWRcIl07XG4gIGlmICh0YXNrW1wiZHVlRGF0ZVwiXSA9PT0gdW5kZWZpbmVkIHx8IHRhc2tbXCJkdWVEYXRlXCJdID09PSBudWxsKSB7XG4gICAgdGFza1tcImR1ZURhdGVcIl0gPSBkYXRlO1xuICB9XG59XG5cbi8qKlxuICogXHU4QkZCXHU1M0Q2XHU2NzJDXHU1NzMwXHU1QjU4XHU1MEE4XHVGRjFBdjMgXHU0RTAwXHU2QjIxXHU2MDI3XHU4RjZDXHU2MzYyXHVGRjA4XHU3OUZCXHU5NjY0XHU3NkVFXHU2ODA3XHU0RTNCXHU3RUJGXHUzMDAxXHU4ODY1XHU5RjUwXHU2NUU1XHU2NzFGXHVGRjA5XHVGRjBDdjQgXHU3NkY0XHU2M0E1XHU0RTI1XHU2ODNDXHU4OUUzXHU2NzkwXHUzMDAyXG4gKiBcdThGNkNcdTYzNjJcdTU5MzFcdThEMjVcdTUzOUZcdTY1ODdcdTRFRjZcdTRGRERcdTc1NTlcdUZGMDhcdTc1MzFcdThDMDNcdTc1MjhcdTY1QjlcdTRGRERcdThCQzFcdTRFMERcdTUxOTlcdTU2REVcdUZGMDlcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRMb2NhbERhdGEocmF3OiBzdHJpbmcpOiBpbXBvcnQoXCIuL2xpYlwiKS5BcHBEYXRhIHtcbiAgbGV0IHZhbHVlOiB1bmtub3duO1xuICB0cnkge1xuICAgIHZhbHVlID0gSlNPTi5wYXJzZShyYXcpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKGBcdTY1NzBcdTYzNkVcdThCRkJcdTUzRDZcdTU5MzFcdThEMjVcdUZGMENcdTUzOUZcdTY1ODdcdTRFRjZcdTVERjJcdTRGRERcdTc1NTlcdUZGMUEke1N0cmluZyhlKX1gKTtcbiAgfVxuICBpZiAoIWlzT2JqZWN0KHZhbHVlKSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjU3MFx1NjM2RVx1OEJGQlx1NTNENlx1NTkzMVx1OEQyNVx1RkYwQ1x1NTM5Rlx1NjU4N1x1NEVGNlx1NURGMlx1NEZERFx1NzU1OVx1RkYxQVx1NjVFMFx1NjU0OFx1NzY4NFx1NjcyQ1x1NTczMFx1NjU3MFx1NjM2RVwiKTtcbiAgfVxuICBpZiAodmFsdWVbXCJ2ZXJzaW9uXCJdID09PSAzKSB7XG4gICAgY29uc3QgdG9kYXkgPSBkYXRlQXQobm93KCkpO1xuICAgIHZhbHVlW1widmVyc2lvblwiXSA9IDQ7XG4gICAgZGVsZXRlIHZhbHVlW1wiZ29hbHNcIl07XG4gICAgZGVsZXRlIHZhbHVlW1wibm9kZUJpbmRpbmdzXCJdO1xuICAgIGRlbGV0ZSB2YWx1ZVtcInNpZ25hbEV2ZW50c1wiXTtcbiAgICBjb25zdCB0YXNrcyA9IHZhbHVlW1widGFza3NcIl07XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodGFza3MpKSB7XG4gICAgICBmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcbiAgICAgICAgaWYgKGlzT2JqZWN0KHRhc2spKSB1cGdyYWRlVGFza1ZhbHVlKHRhc2ssIHRvZGF5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgdGVtcGxhdGVzID0gdmFsdWVbXCJ0ZW1wbGF0ZXNcIl07XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodGVtcGxhdGVzKSkge1xuICAgICAgZm9yIChjb25zdCB0ZW1wbGF0ZSBvZiB0ZW1wbGF0ZXMpIHtcbiAgICAgICAgaWYgKCFpc09iamVjdCh0ZW1wbGF0ZSkpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBzaGFwZSA9IHRlbXBsYXRlW1wic2hhcGVcIl07XG4gICAgICAgIGlmIChpc09iamVjdChzaGFwZSkpIGRlbGV0ZSBzaGFwZVtcImdvYWxJZFwiXTtcbiAgICAgICAgY29uc3QgcHJpbnRpbmcgPSB0ZW1wbGF0ZVtcInByaW50aW5nXCJdO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgaXNPYmplY3QocHJpbnRpbmcpICYmXG4gICAgICAgICAgcHJpbnRpbmdbXCJraW5kXCJdID09PSBcIm9uY2VcIiAmJlxuICAgICAgICAgIChwcmludGluZ1tcImRhdGVcIl0gPT09IG51bGwgfHwgcHJpbnRpbmdbXCJkYXRlXCJdID09PSB1bmRlZmluZWQpXG4gICAgICAgICkge1xuICAgICAgICAgIHByaW50aW5nW1wiZGF0ZVwiXSA9IHRvZGF5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHByaW50cyA9IHZhbHVlW1wicHJpbnRzXCJdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHByaW50cykpIHtcbiAgICAgIHZhbHVlW1wicHJpbnRzXCJdID0gcHJpbnRzLmZpbHRlcigocCkgPT4gaXNPYmplY3QocCkgJiYgcFtcImRhdGVcIl0gIT09IG51bGwpO1xuICAgIH1cbiAgICBjb25zdCB2aXNpb25zID0gdmFsdWVbXCJ2aXNpb25zXCJdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZpc2lvbnMpKSB7XG4gICAgICBmb3IgKGNvbnN0IHZpc2lvbiBvZiB2aXNpb25zKSB7XG4gICAgICAgIGlmIChpc09iamVjdCh2aXNpb24pKSBkZWxldGUgdmlzaW9uW1wiZ29hbElkXCJdO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBpZHMgPSB2YWx1ZVtcImlkZW50aXRpZXNcIl07XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaWRzKSkge1xuICAgICAgdmFsdWVbXCJpZGVudGl0aWVzXCJdID0gaWRzLmZpbHRlcihcbiAgICAgICAgKHIpID0+XG4gICAgICAgICAgaXNPYmplY3QocikgJiZcbiAgICAgICAgICAhW1wiZ29hbFwiLCBcIm5vZGVcIiwgXCJzaWduYWxcIl0uaW5jbHVkZXMocltcImtpbmRcIl0gYXMgc3RyaW5nKSxcbiAgICAgICk7XG4gICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiB2YWx1ZVtcImlkZW50aXRpZXNcIl0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj5bXSkge1xuICAgICAgICBpZiAodHlwZW9mIHJlY29yZFtcInJlc3RvcmVUYXNrXCJdID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgbGV0IHRhc2s6IHVua25vd247XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRhc2sgPSBKU09OLnBhcnNlKHJlY29yZFtcInJlc3RvcmVUYXNrXCJdIGFzIHN0cmluZyk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKGBcdTY1NzBcdTYzNkVcdThCRkJcdTUzRDZcdTU5MzFcdThEMjVcdUZGMENcdTUzOUZcdTY1ODdcdTRFRjZcdTVERjJcdTRGRERcdTc1NTlcdUZGMUEke1N0cmluZyhlKX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFpc09iamVjdCh0YXNrKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFxuICAgICAgICAgICAgICBcIlx1NjU3MFx1NjM2RVx1OEJGQlx1NTNENlx1NTkzMVx1OEQyNVx1RkYwQ1x1NTM5Rlx1NjU4N1x1NEVGNlx1NURGMlx1NEZERFx1NzU1OVx1RkYxQVx1NjVFMFx1NjU0OFx1NzY4NFx1NEVGQlx1NTJBMVx1NjA2Mlx1NTkwRFx1OEJCMFx1NUY1NVwiLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdXBncmFkZVRhc2tWYWx1ZSh0YXNrLCB0b2RheSk7XG4gICAgICAgICAgLy8gXHU2NEE0XHU5NTAwXHU2MDYyXHU1OTBEXHU2QkQ0XHU4RjgzXHU3NjdCXHU4QkIwIERUTyBcdTc2ODRcdTVFOEZcdTUyMTdcdTUzMTZcdUZGMDhcdTU0MkJcdTk1MkVcdTVFOEZcdUZGMDlcdTMwMDJcbiAgICAgICAgICByZWNvcmRbXCJyZXN0b3JlVGFza1wiXSA9IEpTT04uc3RyaW5naWZ5KFxuICAgICAgICAgICAgc2VyaWFsaXplVGFzayhwYXJzZVRhc2sodGFzaykpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdHJ5IHtcbiAgICByZXR1cm4gcGFyc2VBcHBEYXRhKHZhbHVlKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBBcHBFcnJvcihcbiAgICAgIGBcdTY1NzBcdTYzNkVcdThCRkJcdTUzRDZcdTU5MzFcdThEMjVcdUZGMENcdTUzOUZcdTY1ODdcdTRFRjZcdTVERjJcdTRGRERcdTc1NTlcdUZGMUEke2UgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKX1gLFxuICAgICk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNPYmplY3QodjogdW5rbm93bik6IHYgaXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICByZXR1cm4gdHlwZW9mIHYgPT09IFwib2JqZWN0XCIgJiYgdiAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheSh2KTtcbn1cbiIsICIvLyEgXHU1M0VGXHU4OUUzXHU5MUNBXHU3Njg0XHU2NzJDXHU1NzMwXHU0RkUxXHU1M0Y3XHUzMDAyXHU0RTBEXHU4QzAzXHU2QTIxXHU1NzhCXHUzMDAxXHU0RTBEXHU3MzFDXHU3RjNBXHU1OTMxXHU2NTcwXHU2MzZFXHUzMDAxXHU0RTBEXHU4MUVBXHU1MkE4XHU0RTBCXHU3RUQzXHU4QkJBXHUzMDAyXG4vLyEgXHU1QkY5XHU1RTk0IGNyYXRlcy9jb3JlL3NyYy9kaWFnbm9zdGljcy5yc1x1MzAwMlxuXG5pbXBvcnQgeyBkYXRlQXQsIG1pbnV0ZXNPZiwgcGFyc2VEYXRlLCBhZGREYXlzLCBmb3JtYXREYXRlIH0gZnJvbSBcIi4vdGltZVwiO1xuaW1wb3J0IHR5cGUgeyBTbmFwc2hvdCwgVGFzayB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBpc0hhYml0IH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IHdpbmRvd01pbnV0ZXMgfSBmcm9tIFwiLi9yZW1pbmRlcnNcIjtcbmltcG9ydCB7IGJsb2Nrc09uRGF0ZSwgb3ZlcmxhcE1pbnV0ZXMsIHJlcXVpcmVkTWludXRlcyB9IGZyb20gXCIuL2Jsb2Nrc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFub21hbHkge1xuICBrZXk6IHN0cmluZztcbiAga2luZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBzZXZlcml0eTogc3RyaW5nO1xuICBldmlkZW5jZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIHF1ZXN0aW9uOiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHNpZ25hbChcbiAga2V5OiBzdHJpbmcsXG4gIGtpbmQ6IHN0cmluZyxcbiAgdGl0bGU6IHN0cmluZyxcbiAgc2V2ZXJpdHk6IHN0cmluZyxcbiAgZXZpZGVuY2U6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICBxdWVzdGlvbjogc3RyaW5nLFxuKTogQW5vbWFseSB7XG4gIHJldHVybiB7IGtleSwga2luZCwgdGl0bGUsIHNldmVyaXR5LCBldmlkZW5jZSwgcXVlc3Rpb24gfTtcbn1cblxuZnVuY3Rpb24gbWVkaWFuKHZhbHVlczogbnVtYmVyW10pOiBudW1iZXIge1xuICBjb25zdCBzb3J0ZWQgPSBbLi4udmFsdWVzXS5zb3J0KChhLCBiKSA9PiBhIC0gYik7XG4gIHJldHVybiBzb3J0ZWRbTWF0aC5mbG9vcihzb3J0ZWQubGVuZ3RoIC8gMildITtcbn1cblxuLyoqXG4gKiBcdTVCQjlcdTkxQ0ZcdTY2MkZcdTY2M0VcdTVGMEZcdTc1MjhcdTYyMzdcdTk4ODRcdTdCOTdcdUZGMENcdTU0MjZcdTUyMTlcdTUzRDZcdTUzODZcdTUzRjJcdTZEM0JcdThEQzNcdTY1RTVcdTRFMkRcdTRGNERcdTY1NzBcdUZGMENcdTY3MDBcdTU0MEVcdTg0M0RcdTUyMzBcdTZCQ0ZcdTY1RTVcdTc2RUVcdTY4MDdcdTMwMDJcbiAqIFx1NTdGQVx1N0VCRlx1NjYyRlx1OEJDMVx1NjM2RVx1RkYwQ1x1NEUwRFx1NjYyRlx1NTNFRlx1NzUyOFx1NjVGNlx1OTVGNFx1MzAwMlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlhZ25vc2UoXG4gIHNuYXBzaG90OiBTbmFwc2hvdCxcbiAgY2FwYWNpdHlNaW51dGVzOiBudW1iZXIgfCBudWxsLFxuKTogQW5vbWFseVtdIHtcbiAgY29uc3QgZGF0YSA9IHNuYXBzaG90LmRhdGE7XG4gIGNvbnN0IGF0ID0gc25hcHNob3Quc2VydmVyVGltZTtcbiAgY29uc3QgdG9kYXkgPSBwYXJzZURhdGUoc25hcHNob3QudG9kYXkpITtcbiAgY29uc3Qgd2Vla1N0YXJ0ID0gZm9ybWF0RGF0ZShhZGREYXlzKHRvZGF5LCAtNykpO1xuICBjb25zdCBtb250aFN0YXJ0ID0gZm9ybWF0RGF0ZShhZGREYXlzKHRvZGF5LCAtMjgpKTtcbiAgY29uc3QgYnlEYXkgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICBmb3IgKGNvbnN0IHMgb2YgZGF0YS5zZXNzaW9ucykge1xuICAgIGNvbnN0IGRhdGUgPSBkYXRlQXQocy5lbmRlZEF0KTtcbiAgICBpZiAoZGF0ZSA+PSBtb250aFN0YXJ0ICYmIGRhdGUgPCBzbmFwc2hvdC50b2RheSkge1xuICAgICAgYnlEYXkuc2V0KGRhdGUsIChieURheS5nZXQoZGF0ZSkgPz8gMCkgKyBNYXRoLmZsb29yKHMuZHVyYXRpb25TZWNzIC8gNjApKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgYWN0aXZlTWludXRlcyA9IFsuLi5ieURheS52YWx1ZXMoKV0uZmlsdGVyKChtKSA9PiBtID49IDIwKTtcbiAgY29uc3QgaGlzdG9yaWNhbCA9IGFjdGl2ZU1pbnV0ZXMubGVuZ3RoID49IDUgPyBtZWRpYW4oYWN0aXZlTWludXRlcykgOiBudWxsO1xuICBjb25zdCBjYXBhY2l0eSA9XG4gICAgY2FwYWNpdHlNaW51dGVzICE9PSBudWxsXG4gICAgICA/IGNhcGFjaXR5TWludXRlc1xuICAgICAgOiBoaXN0b3JpY2FsICE9PSBudWxsXG4gICAgICAgID8gTWF0aC5tYXgoMzAsIGhpc3RvcmljYWwpXG4gICAgICAgIDogZGF0YS5zZXR0aW5ncy5kYWlseUdvYWwgKiBkYXRhLnNldHRpbmdzLmZvY3VzTWludXRlcztcbiAgY29uc3QgY2FwYWNpdHlTb3VyY2UgPVxuICAgIGNhcGFjaXR5TWludXRlcyAhPT0gbnVsbFxuICAgICAgPyBcIlx1NzUyOFx1NjIzN1x1OEJCRVx1N0Y2RVx1NzY4NFx1NjVFNVx1OTg4NFx1N0I5N1wiXG4gICAgICA6IGhpc3RvcmljYWwgIT09IG51bGxcbiAgICAgICAgPyBcIlx1OEZEMTI4XHU1OTI5XHU4MUYzXHU1QzExNVx1NEUyQVx1NkQzQlx1OERDM1x1NjVFNVx1NzY4NFx1NEUyRFx1NEY0RFx1NjU3MFx1RkYwOFx1NUU3Nlx1OTc1RVx1NTNFRlx1NzUyOFx1NjVGNlx1OTVGNFx1RkYwOVwiXG4gICAgICAgIDogXCJcdTZCQ0ZcdTY1RTVcdTc1NkFcdTgzMDRcdTc2RUVcdTY4MDdcdTk4ODRcdTdCOTdcdUZGMDhcdTVFNzZcdTk3NUVcdTUzRUZcdTc1MjhcdTY1RjZcdTk1RjRcdUZGMDlcIjtcbiAgY29uc3QgY29tcGxldGVkUm91bmRzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgZm9yIChjb25zdCBzIG9mIGRhdGEuc2Vzc2lvbnMpIHtcbiAgICBpZiAocy5jb21wbGV0ZWQgJiYgcy50YXNrSWQgIT09IG51bGwpIHtcbiAgICAgIGNvbXBsZXRlZFJvdW5kcy5zZXQocy50YXNrSWQsIChjb21wbGV0ZWRSb3VuZHMuZ2V0KHMudGFza0lkKSA/PyAwKSArIDEpO1xuICAgIH1cbiAgfVxuICBjb25zdCByZXN1bHQ6IEFub21hbHlbXSA9IFtdO1xuICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCAzOyBvZmZzZXQgKz0gMSkge1xuICAgIGNvbnN0IGRhdGUgPSBmb3JtYXREYXRlKGFkZERheXModG9kYXksIG9mZnNldCkpO1xuICAgIGNvbnN0IHRhc2tzID0gZGF0YS50YXNrcy5maWx0ZXIoXG4gICAgICAodCkgPT4gdC5kdWVEYXRlID09PSBkYXRlICYmICF0LmNvbXBsZXRlZCAmJiAhZGF0YS50YXNrSXNWb2lkKHQpLFxuICAgICk7XG4gICAgY29uc3QgbWludXRlcyA9IHRhc2tzLnJlZHVjZShcbiAgICAgIChuLCB0KSA9PlxuICAgICAgICBuICtcbiAgICAgICAgTWF0aC5tYXgoMCwgdC5lc3RpbWF0ZSAtIChjb21wbGV0ZWRSb3VuZHMuZ2V0KHQuaWQpID8/IDApKSAqXG4gICAgICAgICAgKHQuZm9jdXNNaW51dGVzID8/IGRhdGEuc2V0dGluZ3MuZm9jdXNNaW51dGVzKSxcbiAgICAgIDAsXG4gICAgKTtcbiAgICBjb25zdCBkYXkgPSBwYXJzZURhdGUoZGF0ZSk7XG4gICAgY29uc3QgYmxvY2tlZE1pbnV0ZXMgPSByZXF1aXJlZE1pbnV0ZXMoZGF0YS5ibG9ja3MsIGRhdGUpO1xuICAgIGlmIChjYXBhY2l0eSA+IDAgJiYgbWludXRlcyAqIDEwMCA+IGNhcGFjaXR5ICogMTMwKSB7XG4gICAgICByZXN1bHQucHVzaChcbiAgICAgICAgc2lnbmFsKFxuICAgICAgICAgIGBvdmVybG9hZC8ke2RhdGV9YCxcbiAgICAgICAgICBcIm92ZXJsb2FkXCIsXG4gICAgICAgICAgXCJcdThCQTFcdTUyMTJcdTc1MjhcdTY1RjZcdTlBRDhcdTRFOEVcdTVGNTNcdTUyNERcdTk4ODRcdTdCOTdcIixcbiAgICAgICAgICBcIndhcm5pbmdcIixcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkYXRlLFxuICAgICAgICAgICAgcmVtYWluaW5nUGxhbm5lZE1pbnV0ZXM6IG1pbnV0ZXMsXG4gICAgICAgICAgICBidWRnZXRNaW51dGVzOiBjYXBhY2l0eSxcbiAgICAgICAgICAgIGJ1ZGdldFNvdXJjZTogY2FwYWNpdHlTb3VyY2UsXG4gICAgICAgICAgICBibG9ja2VkTWludXRlcyxcbiAgICAgICAgICAgIHRhc2tJZHM6IHRhc2tzLnNsaWNlKDAsIDMwKS5tYXAoKHQpID0+IHQuaWQpLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgXCJcdThGRDlcdTRFOUJcdTRFRkJcdTUyQTFcdTc2ODRcdTk4ODRcdThCQTFcdTc1MjhcdTY1RjZcdTY2MkZcdTU0MjZcdTUxQzZcdTc4NkVcdUZGMUZcdThGRDlcdTRFMDBcdTU5MjlcdTY3MDlcdTk4OURcdTU5MTZcdTUzRUZcdTc1MjhcdTY1RjZcdTk1RjRcdUZGMENcdThGRDhcdTY2MkZcdTk3MDBcdTg5ODFcdTUxQ0ZcdTkxQ0ZcdTYyMTZcdTYzMkFcdTUyQThcdUZGMUZcIixcbiAgICAgICAgKSxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIG9mZnNldCA9PT0gMSAmJlxuICAgICAgaGlzdG9yaWNhbCAhPT0gbnVsbCAmJlxuICAgICAgdGFza3MubGVuZ3RoID4gMCAmJlxuICAgICAgbWludXRlcyAqIDEwMCA8IGNhcGFjaXR5ICogMzBcbiAgICApIHtcbiAgICAgIHJlc3VsdC5wdXNoKFxuICAgICAgICBzaWduYWwoXG4gICAgICAgICAgYHVuZGVybG9hZC8ke2RhdGV9YCxcbiAgICAgICAgICBcInVuZGVybG9hZFwiLFxuICAgICAgICAgIFwiXHU2NjBFXHU2NUU1XHU1Qjg5XHU2MzkyXHU2NjBFXHU2NjNFXHU0RjRFXHU0RThFXHU4RkQxXHU2NzFGXHU2Mjk1XHU1MTY1XCIsXG4gICAgICAgICAgXCJub3RpY2VcIixcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkYXRlLFxuICAgICAgICAgICAgcGxhbm5lZE1pbnV0ZXM6IG1pbnV0ZXMsXG4gICAgICAgICAgICBiYXNlbGluZU1pbnV0ZXM6IGNhcGFjaXR5LFxuICAgICAgICAgICAgYmFzZWxpbmVTb3VyY2U6IGNhcGFjaXR5U291cmNlLFxuICAgICAgICAgICAgYmxvY2tlZE1pbnV0ZXMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBcIlx1NjYwRVx1NTkyOVx1NjYyRlx1NjcwOVx1NjEwRlx1NEYxMVx1NjA2Rlx1MzAwMVx1OEJGRVx1N0EwQlx1NTM2MFx1NzUyOFx1RkYwQ1x1OEZEOFx1NjYyRlx1OEJBMVx1NTIxMlx1NUMxQVx1NjcyQVx1ODg2NVx1OUY1MFx1RkYxRlx1NEUwRFx1ODk4MVx1NEVDNVx1NTFFRFx1N0E3QVx1OTVGMlx1NjNBOFx1NjVBRFx1NUU5NFx1OEJFNVx1NTJBMFx1NEVGQlx1NTJBMVx1MzAwMlwiLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgdGltZWQ6IHsgc3RhcnQ6IG51bWJlcjsgdGFzazogVGFzayB9W10gPSB0YXNrc1xuICAgICAgLm1hcCgodCkgPT4gKHtcbiAgICAgICAgc3RhcnQ6IHQucmVtaW5kZXJUaW1lICE9PSBudWxsID8gKG1pbnV0ZXNPZih0LnJlbWluZGVyVGltZSkgPz8gLTEpIDogLTEsXG4gICAgICAgIHRhc2s6IHQsXG4gICAgICB9KSlcbiAgICAgIC5maWx0ZXIoKHgpID0+IHguc3RhcnQgPj0gMClcbiAgICAgIC5zb3J0KFxuICAgICAgICAoYSwgYikgPT5cbiAgICAgICAgICBhLnN0YXJ0IC0gYi5zdGFydCB8fFxuICAgICAgICAgIChhLnRhc2suaWQgPCBiLnRhc2suaWQgPyAtMSA6IGEudGFzay5pZCA+IGIudGFzay5pZCA/IDEgOiAwKSxcbiAgICAgICk7XG4gICAgLy8gXHU5NzAwXHU0RTEzXHU1RkMzXHU3Njg0XHU2NUY2XHU2QkI1XHU2MjREXHU2Nzg0XHU2MjEwXHU3NzFGXHU1QjlFXHU1MUIyXHU3QTgxXHVGRjFCXHU2QzM0XHU4QkZFXHU2QjYzXHU2NjJGXHU1RTc2XHU4ODRDXHU0RjVDXHU0RTFBXHU3Njg0XHU1NzMwXHU2NUI5XHVGRjBDXHU0RkREXHU2MzAxXHU1Qjg5XHU5NzU5XHUzMDAyXG4gICAgaWYgKGRheSAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcmVxdWlyZWQgPSBibG9ja3NPbkRhdGUoZGF0YS5ibG9ja3MsIGRhdGUpLmZpbHRlcihcbiAgICAgICAgKGIpID0+IGIuYXR0ZW50aW9uID09PSBcInJlcXVpcmVkXCIsXG4gICAgICApO1xuICAgICAgZm9yIChjb25zdCB7IHN0YXJ0LCB0YXNrIH0gb2YgdGltZWQpIHtcbiAgICAgICAgY29uc3QgZW5kID0gc3RhcnQgKyB3aW5kb3dNaW51dGVzKHRhc2ssIGRhdGEuc2V0dGluZ3MpO1xuICAgICAgICBmb3IgKGNvbnN0IGJhbmQgb2YgcmVxdWlyZWQpIHtcbiAgICAgICAgICBjb25zdCBvdmVybGFwID0gb3ZlcmxhcE1pbnV0ZXMoYmFuZCwgZGF0ZSwgc3RhcnQsIGVuZCk7XG4gICAgICAgICAgaWYgKG92ZXJsYXAgPiAwKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaChcbiAgICAgICAgICAgICAgc2lnbmFsKFxuICAgICAgICAgICAgICAgIGBibG9jay8ke2RhdGV9LyR7dGFzay5pZH0vJHtiYW5kLmlkfWAsXG4gICAgICAgICAgICAgICAgXCJibG9ja0NvbmZsaWN0XCIsXG4gICAgICAgICAgICAgICAgXCJcdThCQTFcdTUyMTJcdTY1RjZcdTZCQjVcdTg0M0RcdTU3MjhcdTk3MDBcdTRFMTNcdTVGQzNcdTc2ODRcdThCRkVcdTdBMEJcdTUxODVcIixcbiAgICAgICAgICAgICAgICBcIndhcm5pbmdcIixcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBkYXRlLFxuICAgICAgICAgICAgICAgICAgdGFza0lkOiB0YXNrLmlkLFxuICAgICAgICAgICAgICAgICAgdGFza1RpdGxlOiB0YXNrLnRpdGxlLFxuICAgICAgICAgICAgICAgICAgYmxvY2tJZDogYmFuZC5pZCxcbiAgICAgICAgICAgICAgICAgIGJsb2NrVGl0bGU6IGJhbmQudGl0bGUsXG4gICAgICAgICAgICAgICAgICBibG9ja1N0YXJ0OiBiYW5kLnN0YXJ0LFxuICAgICAgICAgICAgICAgICAgYmxvY2tFbmQ6IGJhbmQuZW5kLFxuICAgICAgICAgICAgICAgICAgb3ZlcmxhcE1pbnV0ZXM6IG92ZXJsYXAsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBcIlx1OEZEOVx1NkJCNVx1NUI4OVx1NjM5Mlx1NTQ4Q1x1ODk4MVx1NEUxM1x1NUZDM1x1NTQyQ1x1NzY4NFx1OEJGRVx1OTFDRFx1NTNFMFx1RkYxQVx1ODBGRFx1NjMyQVx1NTIzMFx1NkMzNFx1OEJGRVx1NjVGNlx1NkJCNVx1NjIxNlx1OEJGRVx1NTQwRVx1NTQxN1x1RkYxRlx1NTk4Mlx1Njc5Q1x1Nzg2RVx1NUI5RVx1ODk4MVx1OEJGRVx1NEUwQVx1NTA1QVx1RkYwQ1x1OEJGNFx1NjYwRVx1NTQwRVx1NjIxMVx1NEUwRFx1NEYxQVx1NTE4RFx1NjI4QVx1NUI4M1x1NUY1M1x1NTFCMlx1N0E4MVx1MzAwMlwiLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gXHU4QkIwXHU1RjU1XHU1RUY2XHU0RjM4XHU1MjMwXHU2NzAwXHU1M0YzXHU0RkE3XHU3Njg0XHU1MzNBXHU5NUY0XHVGRjFCXHU1M0VBXHU0RTBFXHU3NkY4XHU5MEJCXHU2QkQ0XHU4RjgzXHU0RjFBXHU2RjBGXHU2Mzg5XHU0RTAwXHU0RTJBXHU5NTdGXHU4QkZFXHU3QTBCXHU4OTg2XHU3NkQ2XHU1OTFBXHU0RTJBXHU3N0VEXHU0RUZCXHU1MkExXHUzMDAyXG4gICAgbGV0IHByZXZpb3VzOiB7IGVuZDogbnVtYmVyOyB0YXNrOiBUYXNrIH0gfCBudWxsID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IHsgc3RhcnQsIHRhc2sgfSBvZiB0aW1lZCkge1xuICAgICAgY29uc3QgZW5kID0gc3RhcnQgKyB3aW5kb3dNaW51dGVzKHRhc2ssIGRhdGEuc2V0dGluZ3MpO1xuICAgICAgaWYgKHByZXZpb3VzICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IHByZXYgPSBwcmV2aW91cztcbiAgICAgICAgaWYgKHN0YXJ0IDwgcHJldi5lbmQpIHtcbiAgICAgICAgICBjb25zdCBpZHMgPSBbcHJldi50YXNrLmlkLCB0YXNrLmlkXS5zb3J0KCk7XG4gICAgICAgICAgY29uc3QgYmFuZCA9XG4gICAgICAgICAgICBkYXkgPT09IG51bGxcbiAgICAgICAgICAgICAgPyBudWxsXG4gICAgICAgICAgICAgIDogZGF0YS5ibG9ja3MuZmluZChcbiAgICAgICAgICAgICAgICAgIChiKSA9PlxuICAgICAgICAgICAgICAgICAgICBiLmF0dGVudGlvbiA9PT0gXCJsaWdodFwiICYmXG4gICAgICAgICAgICAgICAgICAgIG92ZXJsYXBNaW51dGVzKGIsIGRhdGUsIHN0YXJ0LCBNYXRoLm1pbihwcmV2LmVuZCwgZW5kKSkgPiAwLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgcmVzdWx0LnB1c2goXG4gICAgICAgICAgICBzaWduYWwoXG4gICAgICAgICAgICAgIGBjb2xsaXNpb24vJHtkYXRlfS8ke2lkc1swXX0vJHtpZHNbMV19YCxcbiAgICAgICAgICAgICAgXCJjb2xsaXNpb25cIixcbiAgICAgICAgICAgICAgXCJcdTRFMjRcdTRFMkFcdThCQTFcdTUyMTJcdTY1RjZcdTZCQjVcdTkxQ0RcdTUzRTBcIixcbiAgICAgICAgICAgICAgXCJ3YXJuaW5nXCIsXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkYXRlLFxuICAgICAgICAgICAgICAgIHRhc2tJZHM6IGlkcyxcbiAgICAgICAgICAgICAgICB0aXRsZXM6IFtwcmV2LnRhc2sudGl0bGUsIHRhc2sudGl0bGVdLFxuICAgICAgICAgICAgICAgIG92ZXJsYXBNaW51dGVzOiBNYXRoLm1pbihwcmV2LmVuZCwgZW5kKSAtIHN0YXJ0LFxuICAgICAgICAgICAgICAgIGluY2x1ZGVzQnJlYWtzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGJsb2NrVGl0bGU6IGJhbmQ/LnRpdGxlID8/IG51bGwsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIFwiXHU4RkQ5XHU0RTI0XHU0RTJBXHU1Qjg5XHU2MzkyXHU4MEZEXHU1NDI2XHU1NDBDXHU2NUY2XHU1QjhDXHU2MjEwXHVGRjFGXHU1OTgyXHU2NzlDXHU2NjJGXHU1NzI4XHU1NDBDXHU0RTAwXHU4QkZFXHU3QTBCXHU1MTg1XHU1MDVBXHU0RjVDXHU0RTFBXHVGRjBDXHU4QkY3XHU4QkY0XHU2NjBFXHVGRjBDXHU5MDdGXHU1MTREXHU2MjhBXHU1MTQxXHU4QkI4XHU3Njg0XHU1RTc2XHU4ODRDXHU4QkVGXHU1MjI0XHU0RTNBXHU1MUIyXHU3QTgxXHUzMDAyXCIsXG4gICAgICAgICAgICApLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVuZCA8PSBwcmV2aW91cy5lbmQpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcHJldmlvdXMgPSB7IGVuZCwgdGFzayB9O1xuICAgIH1cbiAgfVxuICBjb25zdCBoYWJpdHMgPSBuZXcgTWFwPFxuICAgIHN0cmluZyxcbiAgICB7IHNjaGVkdWxlZDogbnVtYmVyOyBtaXNzZWQ6IG51bWJlcjsgaWRzOiBzdHJpbmdbXSB9XG4gID4oKTtcbiAgZm9yIChjb25zdCB0IG9mIGRhdGEudGFza3MpIHtcbiAgICBpZiAoXG4gICAgICAhaXNIYWJpdCh0KSB8fFxuICAgICAgdC5kdWVEYXRlID09PSBudWxsIHx8XG4gICAgICAhKHQuZHVlRGF0ZSA+PSB3ZWVrU3RhcnQgJiYgdC5kdWVEYXRlIDwgc25hcHNob3QudG9kYXkpXG4gICAgKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3Qga2V5ID0gdC5oYWJpdElkID8/IHQudGVtcGxhdGVJZCA/PyB0LmlkO1xuICAgIGNvbnN0IGVudHJ5ID0gaGFiaXRzLmdldChrZXkpID8/IHsgc2NoZWR1bGVkOiAwLCBtaXNzZWQ6IDAsIGlkczogW10gfTtcbiAgICBlbnRyeS5zY2hlZHVsZWQgKz0gMTtcbiAgICBpZiAoIXQuY29tcGxldGVkICYmIHQucmVtaW5kZXJFeHBpcmVkKSB7XG4gICAgICBlbnRyeS5taXNzZWQgKz0gMTtcbiAgICAgIGVudHJ5Lmlkcy5wdXNoKHQuaWQpO1xuICAgIH1cbiAgICBoYWJpdHMuc2V0KGtleSwgZW50cnkpO1xuICB9XG4gIGZvciAoY29uc3QgW2lkLCB7IHNjaGVkdWxlZCwgbWlzc2VkLCBpZHMgfV0gb2YgaGFiaXRzKSB7XG4gICAgaWYgKHNjaGVkdWxlZCA+PSA0ICYmIG1pc3NlZCA+PSAzICYmIG1pc3NlZCAqIDEwMCA+PSBzY2hlZHVsZWQgKiA1MCkge1xuICAgICAgcmVzdWx0LnB1c2goXG4gICAgICAgIHNpZ25hbChcbiAgICAgICAgICBgaGFiaXQvJHtpZH1gLFxuICAgICAgICAgIFwiaGFiaXRBYnNlbmNlXCIsXG4gICAgICAgICAgXCJcdThGRDFcdTRFMDBcdTU0NjhcdTRFNjBcdTYwRUZcdTU5MUFcdTZCMjFcdTY3MkFcdTVCOENcdTYyMTBcIixcbiAgICAgICAgICBcIndhcm5pbmdcIixcbiAgICAgICAgICB7XG4gICAgICAgICAgICBoYWJpdElkOiBpZCxcbiAgICAgICAgICAgIG9ic2VydmVkT2NjdXJyZW5jZXM6IHNjaGVkdWxlZCxcbiAgICAgICAgICAgIG1pc3NlZE9jY3VycmVuY2VzOiBtaXNzZWQsXG4gICAgICAgICAgICB3aW5kb3dTdGFydDogd2Vla1N0YXJ0LFxuICAgICAgICAgICAgd2luZG93RW5kOiBzbmFwc2hvdC50b2RheSxcbiAgICAgICAgICAgIHRhc2tJZHM6IGlkcyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIFwiXHU2NjJGXHU2NUY2XHU5NUY0XHU1Qjg5XHU2MzkyXHU0RTBEXHU1NDA4XHU5MDAyXHUzMDAxXHU0RUZCXHU1MkExXHU1OTJBXHU5NkJFXHUzMDAxXHU1OTE2XHU5MEU4XHU1MzYwXHU3NTI4XHVGRjBDXHU4RkQ4XHU2NjJGXHU1REYyXHU3RUNGXHU0RTBEXHU2MEYzXHU3RUU3XHU3RUVEXHU4RkQ5XHU0RTJBXHU0RTYwXHU2MEVGXHVGRjFGXHU1MTQ4XHU3ODZFXHU4QkE0XHU1MzlGXHU1NkUwXHU1MThEXHU2NTM5XHU4QkExXHU1MjEyXHUzMDAyXCIsXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH1cbiAgfVxuICBjb25zdCByZWNlbnRTZXNzaW9ucyA9IGRhdGEuc2Vzc2lvbnMuZmlsdGVyKFxuICAgIChzKSA9PiBzLnNvdXJjZSA9PT0gXCJ0aW1lclwiICYmIHMuZW5kZWRBdCA+PSBhdCAtIDcgKiA4NjQwMCxcbiAgKTtcbiAgY29uc3QgbGF0ZSA9IHJlY2VudFNlc3Npb25zLmZpbHRlcigocykgPT4ge1xuICAgIGNvbnN0IGhvdXIgPSBuZXcgRGF0ZShzLmVuZGVkQXQgKiAxMDAwKS5nZXRIb3VycygpO1xuICAgIHJldHVybiAhKGhvdXIgPj0gNiAmJiBob3VyIDwgMjMpO1xuICB9KTtcbiAgY29uc3QgZGlzdGluY3RMYXRlID0gbmV3IFNldChsYXRlLm1hcCgocykgPT4gZGF0ZUF0KHMuZW5kZWRBdCkpKTtcbiAgaWYgKGRpc3RpbmN0TGF0ZS5zaXplID49IDMpIHtcbiAgICByZXN1bHQucHVzaChcbiAgICAgIHNpZ25hbChcbiAgICAgICAgXCJyaHl0aG0vbGF0ZVwiLFxuICAgICAgICBcInJoeXRobURyaWZ0XCIsXG4gICAgICAgIFwiXHU4RkQxXHU0RTAwXHU1NDY4XHU1OTFBXHU1OTI5XHU2NzA5XHU2REYxXHU1OTFDXHU0RTEzXHU2Q0U4XHU4QkIwXHU1RjU1XCIsXG4gICAgICAgIFwibm90aWNlXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBsYXRlRGF0ZXM6IFsuLi5kaXN0aW5jdExhdGVdLFxuICAgICAgICAgIGxhdGVTZXNzaW9uQ291bnQ6IGxhdGUubGVuZ3RoLFxuICAgICAgICAgIHdpbmRvdzogXCIyMzowMFx1MjAxMzA2OjAwIFx1NjcyQ1x1NjczQVx1NjVGNlx1OTVGNFwiLFxuICAgICAgICAgIHNhbXBsZVNlc3Npb25zOiByZWNlbnRTZXNzaW9ucy5sZW5ndGgsXG4gICAgICAgIH0sXG4gICAgICAgIFwiXHU4RkQ5XHU2NjJGXHU0RTM0XHU2NUY2XHU1Qjg5XHU2MzkyXHU4RkQ4XHU2NjJGXHU3QjI2XHU1NDA4XHU0RjYwXHU3Njg0XHU0RjVDXHU2MDZGXHVGRjFGXHU3RUQzXHU1NDA4XHU0RjYwXHU3ODZFXHU4QkE0XHU3Njg0XHU3NzYxXHU3NzIwXHU1NDhDXHU4QkZFXHU3QTBCXHU0RkUxXHU2MDZGXHU1MjI0XHU2NUFEXHVGRjBDXHU0RTBEXHU0RUU1XHU3RURGXHU0RTAwXHU0RjVDXHU2MDZGXHU4QkM0XHU0RUY3XHU3NTI4XHU2MjM3XHUzMDAyXCIsXG4gICAgICApLFxuICAgICk7XG4gIH1cbiAgY29uc3QgcmVjZW50RGF5cyA9IFsuLi5ieURheS5rZXlzKCldLmZpbHRlcigoZCkgPT4gZCA+PSB3ZWVrU3RhcnQpLmxlbmd0aDtcbiAgaWYgKGhpc3RvcmljYWwgIT09IG51bGwgJiYgcmVjZW50RGF5cyA+PSAzKSB7XG4gICAgY29uc3QgcmVjZW50ID0gWy4uLmJ5RGF5LmVudHJpZXMoKV1cbiAgICAgIC5maWx0ZXIoKFtkXSkgPT4gZCA+PSB3ZWVrU3RhcnQpXG4gICAgICAubWFwKChbLCBtXSkgPT4gbSk7XG4gICAgaWYgKFxuICAgICAgcmVjZW50LnJlZHVjZSgobiwgbSkgPT4gbiArIG0sIDApICogMTAwIDxcbiAgICAgIGhpc3RvcmljYWwgKiByZWNlbnQubGVuZ3RoICogNDBcbiAgICApIHtcbiAgICAgIHJlc3VsdC5wdXNoKFxuICAgICAgICBzaWduYWwoXG4gICAgICAgICAgXCJlbmdhZ2VtZW50L2Ryb3BcIixcbiAgICAgICAgICBcImVuZ2FnZW1lbnREcm9wXCIsXG4gICAgICAgICAgXCJcdThGRDFcdTY3MUZcdThCQjBcdTVGNTVcdTc2ODRcdTYyOTVcdTUxNjVcdTY2MEVcdTY2M0VcdTRFMEJcdTk2NERcIixcbiAgICAgICAgICBcIm5vdGljZVwiLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJlY2VudEFjdGl2ZURheXM6IHJlY2VudC5sZW5ndGgsXG4gICAgICAgICAgICByZWNlbnRNZWFuTWludXRlczpcbiAgICAgICAgICAgICAgcmVjZW50Lmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICA/IE1hdGguZmxvb3IocmVjZW50LnJlZHVjZSgobiwgbSkgPT4gbiArIG0sIDApIC8gcmVjZW50Lmxlbmd0aClcbiAgICAgICAgICAgICAgICA6IDAsXG4gICAgICAgICAgICBiYXNlbGluZU1pbnV0ZXM6IGhpc3RvcmljYWwsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBcIlx1NjYyRlx1NTQyNlx1NjcwOVx1ODAwM1x1OEJENVx1MzAwMVx1OEJGRVx1N0EwQlx1MzAwMVx1OEVBQlx1NEY1M1x1NzJCNlx1NjAwMVx1NjIxNlx1N0VCRlx1NEUwQlx1NUI2Nlx1NEU2MFx1NTNEOFx1NTMxNlx1RkYxRlx1NTE0OFx1ODg2NVx1NTE2OFx1OEJCMFx1NUY1NVx1ODBDQ1x1NjY2Rlx1RkYwQ1x1NTE4RFx1NTFCM1x1NUI5QVx1NjYyRlx1NTQyNlx1OEMwM1x1NjU3NFx1ODI4Mlx1NTk0Rlx1MzAwMlwiLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgcmVzdWx0LnNvcnQoKGEsIGIpID0+IChhLmtleSA8IGIua2V5ID8gLTEgOiBhLmtleSA+IGIua2V5ID8gMSA6IDApKTtcbiAgcmV0dXJuIHJlc3VsdC5zbGljZSgwLCAzMCk7XG59XG4iLCAiLy8hIFx1NEUxM1x1NkNFOFx1NEZERFx1NjJBNFx1NzY4NFx1N0VBRlx1OEJBMVx1N0I5N1x1OTBFOFx1NTIwNlx1RkYxQVx1N0E5N1x1NTNFM1x1OTZDNlx1NTQwOFx1NEUwRVx1NzY3RFx1NTQwRFx1NTM1NVx1NTIyNFx1NUI5QVx1MzAwMlxuLy8hIFx1NUJGOVx1NUU5NCBjcmF0ZXMvY29yZS9zcmMvZ3VhcmQucnMgXHU3Njg0IGBhbGxvd2VkYCBcdTRFMEUgZ3VhcmRfd2luZG93cy5ycyBcdTc2ODRcbi8vISBhcHAtaWQgXHU4OUUzXHU2NzkwXHVGRjA4QVVNSUQgLyBBcHBsaWNhdGlvbkZyYW1lSG9zdCBcdTUxNzFcdTRFQUIgVVdQIFx1Njg0Nlx1NjdCNiAvIFx1NUI4Q1x1NjU3NFx1OEZEQlx1N0EwQlx1OERFRlx1NUY4NFx1RkYwOVx1MzAwMlxuLy8hIFx1NEUwRFx1NTA1QVx1NEVGQlx1NEY1NVx1Njg0Q1x1OTc2Mlx1OEMwM1x1NzUyOFx1MjAxNFx1MjAxNFx1Njc5QVx1NEUzRVx1MzAwMVx1ODA1QVx1NzEyNlx1NEUwRVx1OTUwMVx1NUM0Rlx1NjI2N1x1ODg0Q1x1NzUzMVx1NTM5Rlx1NzUxRiBndWFyZCBcdThEMUZcdThEMjNcdTMwMDJcblxuaW1wb3J0IHR5cGUgeyBQcm90ZWN0aW9uLCBXaW5kb3cgfSBmcm9tIFwiLi9tb2RlbFwiO1xuXG4vKipcbiAqIFx1NzY3RFx1NTQwRFx1NTM1NVx1NTIyNFx1NUI5QVx1RkYwOGd1YXJkOjphbGxvd2VkXHVGRjA5XHVGRjFBXG4gKiBcdTY3MkNcdThGREJcdTdBMEJcdTdBOTdcdTUzRTNcdTU5Q0JcdTdFQzhcdTY1M0VcdTg4NENcdUZGMUJvZmYgXHU2NTNFXHU4ODRDXHU0RTAwXHU1MjA3XHVGRjFCd2hpdGVsaXN0IFx1N0NCRVx1Nzg2RVx1NTMzOVx1OTE0RCBhcHBJZFx1RkYxQlxuICogbG9jayBcdTVGRkRcdTc1NjVcdTc2N0RcdTU0MERcdTUzNTVcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFsbG93ZWQoXG4gIHdpbmRvdzogV2luZG93LFxuICBvd25QaWQ6IG51bWJlcixcbiAgcHJvdGVjdGlvbjogUHJvdGVjdGlvbixcbik6IGJvb2xlYW4ge1xuICBpZiAod2luZG93LnBpZCAhPT0gbnVsbCAmJiB3aW5kb3cucGlkID09PSBvd25QaWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gKFxuICAgIHByb3RlY3Rpb24ubW9kZSA9PT0gXCJvZmZcIiB8fFxuICAgIChwcm90ZWN0aW9uLm1vZGUgPT09IFwid2hpdGVsaXN0XCIgJiZcbiAgICAgIHdpbmRvdy5hcHBJZCAhPT0gbnVsbCAmJlxuICAgICAgcHJvdGVjdGlvbi53aGl0ZWxpc3Quc29tZSgoYWxsb3dlZElkKSA9PiBhbGxvd2VkSWQgPT09IHdpbmRvdy5hcHBJZCkpXG4gICk7XG59XG5cbi8qKiBVV1AgXHU1RTk0XHU3NTI4XHU1QzAxXHU4OEM1XHU0RTNBIGBhdW1pZDp7aWR9YFx1RkYwOGd1YXJkX3dpbmRvd3M6OmlkZW50aXR5XHVGRjA5XHUzMDAyICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0QXVtaWQoaWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgYXVtaWQ6JHtpZH1gO1xufVxuXG4vKipcbiAqIEFwcGxpY2F0aW9uRnJhbWVIb3N0LmV4ZSBcdTY2MkZcdTUxNzFcdTRFQUJcdTY4NDZcdTY3QjZcdThGREJcdTdBMEJcdUZGMUFcdTVCODNcdTY3MkNcdThFQUJcdTRFMERcdTRFRTNcdTg4NjhcdTRFRkJcdTRGNTVcdTRFMDBcdTRFMkFcdTYyNThcdTdCQTFcdTVFOTRcdTc1MjhcdUZGMENcbiAqIFx1NjM4OFx1NEU4OFx1NUI4M1x1N0I0OVx1NEU4RVx1NjUzRVx1ODg0Q1x1NTE2OFx1OTBFOCBVV1AgXHU1RTk0XHU3NTI4XHUzMDAyXHU1MjI0XHU2NUFEXHU2MzA5XHU1QjhDXHU2NTc0XHU4REVGXHU1Rjg0XHU3Njg0XHU2NzAwXHU1NDBFXHU0RTAwXHU2QkI1XHUzMDAxXHU0RTBEXHU1MzNBXHU1MjA2XHU1OTI3XHU1QzBGXHU1MTk5XHUzMDAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0FwcGxpY2F0aW9uRnJhbWVIb3N0KHByb2Nlc3NQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgbmFtZSA9IHByb2Nlc3NQYXRoLnNwbGl0KC9bXFxcXC9dLykucG9wKCkgPz8gXCJcIjtcbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJhcHBsaWNhdGlvbmZyYW1laG9zdC5leGVcIjtcbn1cblxuLyoqXG4gKiBcdTUxNzFcdTRFQUJcdTY4NDZcdTY3QjZcdTdBOTdcdTUzRTNcdTc2ODRcdTYyNThcdTdCQTFcdTVFOTRcdTc1MjhcdTkwMDlcdTYyRTlcdUZGMUFcdTUzRDZcdTdCMkNcdTRFMDBcdTRFMkFcdTdDN0JcdTU0MERcdTRFM0FcbiAqIGBXaW5kb3dzLlVJLkNvcmUuQ29yZVdpbmRvd2AgXHU0RTE0IFBJRCBcdTIyNjAgXHU1QkJGXHU0RTNCIFBJRCBcdTc2ODRcdTVCNTBcdTdBOTdcdTUzRTNcbiAqIFx1RkYwOGd1YXJkX3dpbmRvd3M6OmNvbnRlbnRcdUZGMDlcdTMwMDJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlbGVjdEZyYW1lQ29udGVudFBpZChcbiAgaG9zdFBpZDogbnVtYmVyLFxuICBjaGlsZHJlbjogeyBjbGFzc05hbWU6IHN0cmluZzsgcGlkOiBudW1iZXIgfVtdLFxuKTogbnVtYmVyIHwgbnVsbCB7XG4gIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcbiAgICBpZiAoXG4gICAgICBjaGlsZC5jbGFzc05hbWUgPT09IFwiV2luZG93cy5VSS5Db3JlLkNvcmVXaW5kb3dcIiAmJlxuICAgICAgY2hpbGQucGlkICE9PSAwICYmXG4gICAgICBjaGlsZC5waWQgIT09IGhvc3RQaWRcbiAgICApIHtcbiAgICAgIHJldHVybiBjaGlsZC5waWQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuIiwgIi8vISBFbmdpbmVcdUZGMUFcdTk4ODRcdTY4QzAvXHU2M0QwXHU0RUE0L1x1NjMwMVx1NEU0NVx1NTMxNi9cdTVGRUJcdTcxNjdcdTMwMDJcdTVCRjlcdTVFOTQgY3JhdGVzL2NvcmUvc3JjL2xpYi5ycyBcdTc2ODQgRW5naW5lXHUzMDAyXG4vLyFcbi8vISBcdTYzMDFcdTRFNDVcdTUzMTZcdUZGMUFcdTY1RTdcdTVGMTVcdTY0Q0VcdTc1MjggU1FMaXRlXHVGRjFCXHU2NUIwXHU2N0I2XHU2Nzg0XHVGRjA4TUlHUkFUSU9OLm1kL0FQSS5tZFx1RkYwOVx1NEVFNSBKU09OIFx1NjU4N1x1NEVGNlx1NEUzQVx1NTUyRlx1NEUwMFx1NjU3MFx1NjM2RVx1NkU5MFx1MzAwMlxuLy8hIFx1NjcyQ1x1NUI5RVx1NzNCMFx1NjcwOVx1NEUyNFx1NzlDRFx1NUI1OFx1NTBBOFx1NTE2NVx1NTNFM1x1RkYxQVxuLy8hIC0gYEVuZ2luZS5vcGVuKHBhdGgpYFx1RkYxQVx1NTM1NSBKU09OIFx1NjU4N1x1NEVGNlx1RkYwOFx1NTM5Rlx1NUI1MFx1NTE5OVx1RkYwOVx1RkYwQ1x1NUJGOVx1NUU5NFx1NjVFNyBFbmdpbmU6Om9wZW4ocGF0aClcdUZGMUJcbi8vISAtIGBFbmdpbmUuZnJvbURhdGEoZGF0YSwgc2F2ZSlgXHVGRjFBXHU4QzAzXHU3NTI4XHU2NUI5XHU4MUVBXHU1RTI2XHU1QjU4XHU1MEE4XHVGRjA4cnVudGltZSBcdTc1MjhcdTVCODNcdTYyOEFcdTU0MENcdTRFMDBcdTRFRkQgQXBwRGF0YVxuLy8hICAgXHU2MkM2XHU2MjEwIHBsYW4uanNvbi9zdGF0ZS5qc29uIFx1NEUyNFx1NEUyQVx1NjU4N1x1NEVGNlx1RkYwOVx1MzAwMlx1NUI1OFx1NTBBOFx1N0I1Nlx1NzU2NVx1NTNFQVx1NUY3MVx1NTRDRFx1ODQzRFx1NzZEOFx1NjVCOVx1NUYwRlx1RkYwQ1x1NjgyMVx1OUE4Q1x1MzAwMVx1OEVBQlx1NEVGRFx1NzY3Qlx1OEJCMFx1MzAwMVxuLy8hICAgXHU2NTU5XHU1QjY2XHU4RjZDXHU3OUZCXHU0RTBFXHU0RkREXHU2MkE0XHU4OUM0XHU1MjE5XHU1QjhDXHU1MTY4XHU1MTcxXHU3NTI4XHUzMDAyXG5cbmltcG9ydCB7IHJlYWRGaWxlU3luYywgd3JpdGVGaWxlU3luYywgbWtkaXJTeW5jLCByZW5hbWVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBBcHBFcnJvciwgY2xvbmUgfSBmcm9tIFwiLi9lcnJvcnNcIjtcbmltcG9ydCB0eXBlIHsgQWN0aW9uIH0gZnJvbSBcIi4vbGliXCI7XG5pbXBvcnQgeyBBcHBEYXRhIH0gZnJvbSBcIi4vbGliXCI7XG5pbXBvcnQgeyBkYXRlQXQgfSBmcm9tIFwiLi90aW1lXCI7XG5pbXBvcnQgeyByZWNvbmNpbGVJZGVudGl0aWVzLCB2YWxpZGF0ZUlkZW50aXRpZXMgfSBmcm9tIFwiLi9pZGVudGl0aWVzXCI7XG5pbXBvcnQgeyByZWFkTG9jYWxEYXRhIH0gZnJvbSBcIi4vbWlncmF0aW9uXCI7XG5pbXBvcnQgeyBzdW1tYXJpZXMgfSBmcm9tIFwiLi9sZWFybmluZ1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVFZHVjYXRpb25UcmFuc2l0aW9uIH0gZnJvbSBcIi4vZWR1Y2F0aW9uXCI7XG5pbXBvcnQgeyByZWxlYXNlTG9jayB9IGZyb20gXCIuL2xvY2tcIjtcbmltcG9ydCB0eXBlIHsgU25hcHNob3QsIFRhc2tLaW5kIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IGtpbmRPZiB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyB0aW1lclJlbWFpbmluZyB9IGZyb20gXCIuL3JlbWluZGVyc1wiO1xuaW1wb3J0IHsgcGFyc2VBcHBEYXRhLCBzZXJpYWxpemVBcHBEYXRhLCBzZXJpYWxpemVUYXNrIH0gZnJvbSBcIi4vbGliXCI7XG5cbi8qKiBcdTg0M0RcdTc2RDhcdTU2REVcdThDMDNcdUZGMUFcdTY1MzZcdTUyMzBcdTc2ODRcdTY2MkZcdTVERjJcdTdFQ0ZcdThGQzdcdTY4MjFcdTlBOENcdTc2ODQgQXBwRGF0YVx1RkYxQlx1NTZERVx1OEMwM1x1NUZDNVx1OTg3Qlx1NTM5Rlx1NUI1MFx1NjZGRlx1NjM2Mlx1ODFFQVx1NURGMVx1NzY4NFx1NUI1OFx1NTBBOFx1MzAwMiAqL1xuZXhwb3J0IHR5cGUgRW5naW5lUGVyc2lzdCA9IChkYXRhOiBBcHBEYXRhKSA9PiB2b2lkO1xuXG4vKiogXHU1MzU1XHU2NTg3XHU0RUY2XHU1QjU4XHU1MEE4XHVGRjFBXHU0RTM0XHU2NUY2XHU2NTg3XHU0RUY2ICsgcmVuYW1lXHVGRjBDXHU0RkREXHU4QkMxXHU4QkZCXHU4MDA1XHU1M0VBXHU3NzBCXHU1MjMwXHU2NUU3XHU1MTg1XHU1QkI5XHU2MjE2XHU2NUIwXHU1MTg1XHU1QkI5XHUzMDAyICovXG5mdW5jdGlvbiB3cml0ZUF0b21pYyhwYXRoOiBzdHJpbmcsIGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgY29uc3QgcmF3ID0gSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplQXBwRGF0YShkYXRhKSwgbnVsbCwgMik7XG4gIGNvbnN0IHRtcCA9IGAke3BhdGh9LnRtcGA7XG4gIHdyaXRlRmlsZVN5bmModG1wLCByYXcsIFwidXRmOFwiKTtcbiAgcmVuYW1lU3luYyh0bXAsIHBhdGgpO1xufVxuXG5leHBvcnQgY2xhc3MgRW5naW5lIHtcbiAgcGF0aDogc3RyaW5nO1xuICBkYXRhOiBBcHBEYXRhO1xuICBwcml2YXRlIHJlYWRvbmx5IHNhdmU6IEVuZ2luZVBlcnNpc3Q7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcsIGRhdGE6IEFwcERhdGEsIHNhdmU6IEVuZ2luZVBlcnNpc3QpIHtcbiAgICB0aGlzLnBhdGggPSBwYXRoO1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgdGhpcy5zYXZlID0gc2F2ZTtcbiAgfVxuXG4gIC8qKiBcdTY4NENcdTk3NjJcdTkwMDJcdTkxNERcdTVDNDJcdTRFMTNcdTc1MjhcdUZGMUFcdTU0MDhcdTYyMTBcdTU2NjhcdTY1NDVcdTk2OUNcdTU0MEVcdTVGM0FcdTUyMzZcdTg5RTNcdTk2NjRcdTRGRERcdTYyQTRcdUZGMUJcdTRFMERcdTY2MkZcdTVCRjlcdTU5MTYgQWN0aW9uXHUzMDAyICovXG4gIHJlbGVhc2VGYWlsZWRQcm90ZWN0aW9uKGF0OiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBuZXh0ID0gY2xvbmUodGhpcy5kYXRhKTtcbiAgICBuZXh0LnJlY29yZChhdCwgZmFsc2UpO1xuICAgIG5leHQucmVzZXRUbyhcImZvY3VzXCIpO1xuICAgIHJlbGVhc2VMb2NrKG5leHQubG9jaywgYXQpO1xuICAgIG5leHQudmFsaWRhdGUoKTtcbiAgICB0aGlzLnBlcnNpc3QobmV4dCk7XG4gICAgdGhpcy5kYXRhID0gbmV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBcdTY1RTcgcnVudGltZSBcdTc2ODRcdTMwMENcdTY1M0VcdTVGMDNcdTVGNTNcdTUyNERcdTc1NkFcdTgzMDRcdTMwMERcdUZGMUFcdTRFMERcdTUxOTlcdTRFMTNcdTZDRThcdThCQjBcdTVGNTVcdUZGMENcdTUzRUFcdTU2REVcdTUyMzBcdTdBN0FcdTk1RjJcdTRFMTNcdTZDRThcdTMwMDJcbiAgICogXHU0RkREXHU2MkE0XHU3NTFGXHU2NTQ4XHU2NUY2XHU2MkQyXHU3RUREXHVGRjA4XHU0RTBFXHU1MTc2XHU1QjgzXHU1MTk5XHU1MkE4XHU0RjVDXHU1NDBDXHU0RTAwXHU4OUM0XHU1MjE5XHVGRjFBXHU0RTBEXHU4MEZEXHU1MDFGXHU2NTNFXHU1RjAzXHU3RUQ1XHU1RjAwXHU5NTAxXHU1QjlBXHVGRjA5XHUzMDAyXG4gICAqL1xuICBkaXNjYXJkVGltZXIoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZGF0YS5zdHJpY3RQcm90ZWN0ZWQoKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU0RTI1XHU2ODNDXHU2QTIxXHU1RjBGXHU3NTFGXHU2NTQ4XHU0RTJEXHVGRjBDXHU0RTBEXHU4MEZEXHU2M0QwXHU1MjREXHU3RUQzXHU2NzVGXHU2MjE2XHU0RkVFXHU2NTM5XHVGRjFCXHU1MjMwXHU2NUY2XHU4MUVBXHU1MkE4XHU4OUUzXHU5NjY0XCIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5kYXRhLnByb3RlY3RlZCgpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoXG4gICAgICAgIFwiXHU0RTEzXHU2Q0U4XHU0RkREXHU2MkE0XHU0RTJEXHVGRjBDXHU3RUQzXHU2NzVGXHU1MjREXHU0RTBEXHU4MEZEXHU0RkVFXHU2NTM5XHU0RUZCXHU1MkExXHU2MjE2XHU4QkExXHU2NUY2XHVGRjFCXHU1M0VGXHU2M0QwXHU1MjREXHU1QjhDXHU2MjEwXHU3NTZBXHU4MzA0XHU2MjE2XHU3RDI3XHU2MDI1XHU5MDAwXHU1MUZBXCIsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBuZXh0ID0gY2xvbmUodGhpcy5kYXRhKTtcbiAgICBuZXh0LnJlc2V0VG8oXCJmb2N1c1wiKTtcbiAgICBuZXh0LnZhbGlkYXRlKCk7XG4gICAgdGhpcy5wZXJzaXN0KG5leHQpO1xuICAgIHRoaXMuZGF0YSA9IG5leHQ7XG4gIH1cblxuICBzdGF0aWMgb3BlbihwYXRoOiBzdHJpbmcpOiBFbmdpbmUge1xuICAgIGxldCByYXc6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGlmIChwYXRoICE9PSBcIjptZW1vcnk6XCIpIHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IGRpcm5hbWUocGF0aCk7XG4gICAgICBpZiAocGFyZW50ICE9PSBcIi5cIiAmJiBwYXJlbnQgIT09IFwiXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBta2RpclN5bmMocGFyZW50LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihTdHJpbmcoZSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICByYXcgPSByZWFkRmlsZVN5bmMocGF0aCwgXCJ1dGY4XCIpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoKGUgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uKS5jb2RlICE9PSBcIkVOT0VOVFwiKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFN0cmluZyhlKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmF3ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGRhdGE6IEFwcERhdGE7XG4gICAgaWYgKHJhdyAhPT0gbnVsbCkge1xuICAgICAgZGF0YSA9IHJlYWRMb2NhbERhdGEocmF3KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YSA9IG5ldyBBcHBEYXRhKCk7XG4gICAgfVxuICAgIHJlY29uY2lsZUlkZW50aXRpZXMoY2xvbmUoZGF0YSksIGRhdGEsIG51bGwpO1xuICAgIGRhdGEudmFsaWRhdGUoKTtcbiAgICBjb25zdCBlbmdpbmUgPSBuZXcgRW5naW5lKFxuICAgICAgcGF0aCxcbiAgICAgIGRhdGEsXG4gICAgICBwYXRoID09PSBcIjptZW1vcnk6XCJcbiAgICAgICAgPyAoKSA9PiB7fVxuICAgICAgICA6IChuZXh0OiBBcHBEYXRhKSA9PiB3cml0ZUF0b21pYyhwYXRoLCBuZXh0KSxcbiAgICApO1xuICAgIGVuZ2luZS5wZXJzaXN0KGVuZ2luZS5kYXRhKTtcbiAgICByZXR1cm4gZW5naW5lO1xuICB9XG5cbiAgLyoqXG4gICAqIFx1NzUyOFx1OEMwM1x1NzUyOFx1NjVCOVx1NTJBMFx1OEY3RFx1NTk3RFx1NzY4NFx1NjU3MFx1NjM2RVx1NUVGQVx1NUYxNVx1NjRDRVx1RkYwQ1x1NUU3Nlx1NEVFNVx1OEMwM1x1NzUyOFx1NjVCOVx1N0VEOVx1NzY4NCBgc2F2ZWAgXHU4NDNEXHU3NkQ4XHUzMDAyXG4gICAqIFx1NjU3MFx1NjM2RVx1NEVDRFx1OEQ3MFx1NTQwQ1x1NEUwMFx1NTk1N1x1OEVBQlx1NEVGRFx1NzY3Qlx1OEJCMFx1NEUwRVx1NTE2OFx1OTFDRlx1NjgyMVx1OUE4Q1x1RkYxQmBzYXZlYCBcdTYyOUJcdTk1MTlcdTRGMUFcdTUzOUZcdTY4MzdcdTRGMjBcdTUxRkFcdUZGMENcdTUyQTBcdThGN0RcdTU5MzFcdThEMjVcdTY1RjZcbiAgICogXHU4QzAzXHU3NTI4XHU2NUI5XHU1NkUwXHU2QjY0XHU0RTBEXHU0RjFBXHU4OTg2XHU3NkQ2XHU2NUU3XHU2NTg3XHU0RUY2XHUzMDAyXG4gICAqL1xuICBzdGF0aWMgZnJvbURhdGEoXG4gICAgZGF0YTogQXBwRGF0YSxcbiAgICBzYXZlOiBFbmdpbmVQZXJzaXN0LFxuICAgIHBhdGggPSBcIjptZW1vcnk6XCIsXG4gICk6IEVuZ2luZSB7XG4gICAgY29uc3QgbmV4dCA9IGNsb25lKGRhdGEpO1xuICAgIHJlY29uY2lsZUlkZW50aXRpZXMoY2xvbmUoZGF0YSksIG5leHQsIG51bGwpO1xuICAgIG5leHQudmFsaWRhdGUoKTtcbiAgICBjb25zdCBlbmdpbmUgPSBuZXcgRW5naW5lKHBhdGgsIG5leHQsIHNhdmUpO1xuICAgIGVuZ2luZS5wZXJzaXN0KGVuZ2luZS5kYXRhKTtcbiAgICByZXR1cm4gZW5naW5lO1xuICB9XG5cbiAgcHJpdmF0ZSBwZXJzaXN0KGRhdGE6IEFwcERhdGEpOiB2b2lkIHtcbiAgICB0aGlzLnNhdmUoZGF0YSk7XG4gIH1cblxuICAvKiogXHU0RTBFIGRpc3BhdGNoIFx1NzZGOFx1NTQwQ1x1NzY4NFx1OEVBQlx1NEVGRC9cdTUzODZcdTUzRjJcdTg5QzRcdTUyMTlcdUZGMENcdTRGNDZcdTRFMERcdTYzMDFcdTRFNDVcdTUzMTZcdUZGMUFcdTc1MjhcdTRFOEVcdTVCQTFcdTk2MDVcdTY1ODdcdTRFRjZcdTMwMDIgKi9cbiAgcHJldmlld0FjdGlvbihhY3Rpb246IEFjdGlvbiwgYXQ6IG51bWJlcik6IEFwcERhdGEge1xuICAgIGNvbnN0IHJlc3RvcmVJZCA9ICgoKSA9PiB7XG4gICAgICBpZiAoYWN0aW9uLnR5cGUgPT09IFwicmVzdG9yZVRhc2tcIikge1xuICAgICAgICBjb25zdCByZWNvcmQgPSB0aGlzLmRhdGEuaWRlbnRpdGllcy5maW5kKFxuICAgICAgICAgIChyKSA9PiByLmlkID09PSBhY3Rpb24udGFzay5pZCAmJiByLnJldGlyZWQgJiYgci5raW5kID09PSBcInRhc2tcIixcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKHJlY29yZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKFwiXHU2Q0ExXHU2NzA5XHU1QkY5XHU1RTk0XHU3Njg0XHU1MzlGXHU0RUZCXHU1MkExXHU2MDYyXHU1OTBEXHU4QkIwXHU1RjU1XCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZWNvcmQucmVzdG9yZVRhc2sgIT09IEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZVRhc2soYWN0aW9uLnRhc2spKSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcihcIlx1NjA2Mlx1NTkwRFx1NTE4NVx1NUJCOVx1NEUwRVx1NTM5Rlx1NEVGQlx1NTJBMVx1NEUwRFx1NEUwMFx1ODFGNFx1RkYwQ1x1NTM4Nlx1NTNGMiBJRCBcdTRFMERcdTgwRkRcdTU5MERcdTc1MjhcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFjdGlvbi50YXNrLmlkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSkoKTtcbiAgICBjb25zdCBuZXh0ID0gY2xvbmUodGhpcy5kYXRhKTtcbiAgICAvLyBhcHBseSBcdTUxODVcdTkwRThcdTVERjJcdTUwNUFcdTUxNjhcdTkxQ0ZcdTY4MjFcdTlBOENcdUZGMUJyZWNvbmNpbGUgXHU1M0VBXHU2NTM5IGlkZW50aXRpZXNcdUZGMENcdTUxOERcdTlBOENcdThFQUJcdTRFRkRcdTUzNzNcdTUzRUZcdUZGMENcbiAgICAvLyBcdTkwN0ZcdTUxNERcdTVCRjlcdTY1NTlcdTVCNjZcdThCQjBcdTVGNTVcdTVGODhcdTU5MUFcdTc2ODRcdTVFOTNcdTZCQ0ZcdTZCMjFcdTUyQThcdTRGNUNcdTkxQ0RcdTU5MERcdThERDFcdTRFMDBcdTkwNERcdTY2MDJcdThEMzVcdTY4MjFcdTlBOENcdTMwMDJcbiAgICBuZXh0LmFwcGx5KGFjdGlvbiwgYXQpO1xuICAgIHZhbGlkYXRlRWR1Y2F0aW9uVHJhbnNpdGlvbih0aGlzLmRhdGEuZWR1Y2F0aW9uLCBuZXh0LmVkdWNhdGlvbik7XG4gICAgcmVjb25jaWxlSWRlbnRpdGllcyh0aGlzLmRhdGEsIG5leHQsIHJlc3RvcmVJZCk7XG4gICAgdmFsaWRhdGVJZGVudGl0aWVzKG5leHQpO1xuICAgIHJldHVybiBuZXh0O1xuICB9XG5cbiAgLyoqIFx1NTNFQVx1NjNBOFx1OEZEQlx1NjVGNlx1OTVGNFx1RkYwOFx1OEJBMVx1NjVGNi9cdTYzRDBcdTkxOTIvXHU5NTAxXHU2NzNBL1x1ODFFQVx1NTJBOFx1NUYwMFx1NURFNVx1RkYwOVx1RkYwQ1x1NEUwRFx1NzUxRlx1NjIxMFx1NUZFQlx1NzE2N1x1N0VERlx1OEJBMVx1RkYxQlx1NkJDRlx1NzlEMiB0aWNrIFx1NzUyOFx1MzAwMiAqL1xuICB0aWNrKGF0OiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBuZXh0ID0gY2xvbmUodGhpcy5kYXRhKTtcbiAgICBpZiAoIW5leHQudGljayhhdCkpIHJldHVybiBmYWxzZTtcbiAgICByZWNvbmNpbGVJZGVudGl0aWVzKHRoaXMuZGF0YSwgbmV4dCwgbnVsbCk7XG4gICAgbmV4dC52YWxpZGF0ZSgpO1xuICAgIHRoaXMucGVyc2lzdChuZXh0KTtcbiAgICB0aGlzLmRhdGEgPSBjbG9uZShuZXh0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGRpc3BhdGNoKGFjdGlvbjogQWN0aW9uLCBhdDogbnVtYmVyKTogU25hcHNob3Qge1xuICAgIGNvbnN0IG5leHQgPSB0aGlzLnByZXZpZXdBY3Rpb24oYWN0aW9uLCBhdCk7XG4gICAgdGhpcy5wZXJzaXN0KG5leHQpO1xuICAgIHRoaXMuZGF0YSA9IG5leHQ7XG4gICAgcmV0dXJuIHRoaXMuc25hcHNob3QoYXQpO1xuICB9XG5cbiAgc25hcHNob3QoYXQ6IG51bWJlcik6IFNuYXBzaG90IHtcbiAgICBjb25zdCBuZXh0ID0gY2xvbmUodGhpcy5kYXRhKTtcbiAgICBpZiAobmV4dC50aWNrKGF0KSkge1xuICAgICAgcmVjb25jaWxlSWRlbnRpdGllcyh0aGlzLmRhdGEsIG5leHQsIG51bGwpO1xuICAgICAgbmV4dC52YWxpZGF0ZSgpO1xuICAgICAgdGhpcy5wZXJzaXN0KG5leHQpO1xuICAgICAgLy8gXHU1M0VBXHU2NzA5XHU3NzFGXHU2QjYzXHU1M0Q4XHU1MzE2XHU2MjREXHU4RkRCXHU4RkQ5XHU0RTJBXHU1MjA2XHU2NTJGXHVGRjFBXHU3MEVEXHU4REVGXHU1Rjg0XHU2QkNGXHU3OUQyXHU0RTAwXHU2QjIxXHU1MTRCXHU5Njg2XHUzMDAyXG4gICAgICB0aGlzLmRhdGEgPSBjbG9uZShuZXh0KTtcbiAgICB9XG4gICAgY29uc3Qga2luZHM6IFJlY29yZDxzdHJpbmcsIFRhc2tLaW5kPiA9IHt9O1xuICAgIGZvciAoY29uc3QgdCBvZiB0aGlzLmRhdGEudGFza3MpIHtcbiAgICAgIGtpbmRzW3QuaWRdID0ga2luZE9mKHQpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgdGFza0tpbmRzOiBraW5kcyxcbiAgICAgIHJlbWFpbmluZ1NlY3M6IHRpbWVyUmVtYWluaW5nKHRoaXMuZGF0YS50aW1lciwgYXQpLFxuICAgICAgc3RhdHM6IHRoaXMuZGF0YS5zdGF0cyhhdCksXG4gICAgICBzdHVkeVByb2dyZXNzOiBzdW1tYXJpZXMobmV4dCwgYXQpLFxuICAgICAgZGF0YTogbmV4dCxcbiAgICAgIHRvZGF5OiBkYXRlQXQoYXQpLFxuICAgICAgc2VydmVyVGltZTogYXQsXG4gICAgfTtcbiAgfVxuXG4gIGV4cG9ydChhdDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICB0aGlzLnNuYXBzaG90KGF0KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplQXBwRGF0YSh0aGlzLmRhdGEpLCBudWxsLCAyKTtcbiAgfVxufVxuXG4vLyBwYXJzZUFwcERhdGEgXHU0RjlCXHU4RkQwXHU4ODRDXHU2NUY2XHU0RUNFIEpTT04gXHU3NkY0XHU2M0E1XHU2Nzg0XHU5MDIwXHU2NTcwXHU2MzZFXHVGRjA4XHU2ODIxXHU5QThDXHU1MTY1XHU1M0UzXHU4OUMxIGxpYi50cyBcdTRFMEUgaW5kZXgudHNcdUZGMDlcdTMwMDJcbmV4cG9ydCB7IHBhcnNlQXBwRGF0YSB9O1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUlPLElBQU0sV0FBTixjQUF1QixNQUFNO0FBQUEsRUFDbEMs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LEtBQUssU0FBUyxFQUFFO0FBQUEsRUFDekI7QUFBQSxFQUVBLFNBQVMsSUFBc0I7QUFDN0IsVUFBTSxPQUFPLE1BQU0sS0FBSyxJQUFJO0FBQzVCLFFBQUksS0FBSyxLQUFLLEVBQUUsR0FBRztBQUNqQiwwQkFBb0IsS0FBSyxNQUFNLE1BQU0sSUFBSTtBQUN6QyxXQUFLLFNBQVM7QUFDZCxXQUFLLFFBQVEsSUFBSTtBQUVqQixXQUFLLE9BQU8sTUFBTSxJQUFJO0FBQUEsSUFDeEI7QUFDQSxVQUFNLFFBQWtDLENBQUM7QUFDekMsZUFBVyxLQUFLLEtBQUssS0FBSyxPQUFPO0FBQy9CLFlBQU0sRUFBRSxFQUFFLElBQUksT0FBTyxDQUFDO0FBQUEsSUFDeEI7QUFDQSxXQUFPO0FBQUEsTUFDTCxXQUFXO0FBQUEsTUFDWCxlQUFlLGVBQWUsS0FBSyxLQUFLLE9BQU8sRUFBRTtBQUFBLE1BQ2pELE9BQU8sS0FBSyxLQUFLLE1BQU0sRUFBRTtBQUFBLE1BQ3pCLGVBQWUsVUFBVSxNQUFNLEVBQUU7QUFBQSxNQUNqQyxNQUFNO0FBQUEsTUFDTixPQUFPLE9BQU8sRUFBRTtBQUFBLE1BQ2hCLFlBQVk7QUFBQSxJQUNkO0FBQUEsRUFDRjtBQUFBLEVBRUEsT0FBTyxJQUFvQjtBQUN6QixTQUFLLFNBQVMsRUFBRTtBQUNoQixXQUFPLEtBQUssVUFBVSxpQkFBaUIsS0FBSyxJQUFJLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDNUQ7QUFDRjsiLAogICJuYW1lcyI6IFsicmVxdWlyZSIsICJhbGxvd2VkIiwgInRpbWVzIiwgInMiLCAiaWQiLCAicmVxdWlyZSIsICJpZCIsICJleGFtRGVhZGxpbmUiLCAiaWQiLCAiYSIsICJiIiwgImlkIiwgImlkIiwgImlkIiwgInQiLCAiaXNPYmplY3QiLCAid2Vla1N0YXJ0IiwgImJhbmQiLCAiaWQiLCAiaWQiXQp9Cg==
