//! 本地日历与时刻工具。
//!
//! 契约（docs/PLAN_FORMAT.md、docs/BACKUP_FORMAT.md、API.md）：
//! 所有时间戳都是 Unix 秒，按**本机时区**解读（对应 Rust `chrono::Local`）；
//! 日期为 `YYYY-MM-DD`，时间为 `HH:MM`。日历运算按「自然日」进行，不受夏令时影响
//! （对应 Rust `NaiveDate` 的 `checked_add_days`）。

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DAY_MS = 86400000;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
const pad4 = (n: number): string => String(n).padStart(4, "0");

/** Unix 秒 → 本机日历日。 */
export function localDateOf(at: number): CalendarDate {
  const d = new Date(at * 1000);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** Unix 秒 → 本机日期 `YYYY-MM-DD`（对应 `crate::date_at`）。 */
export function dateAt(at: number): string {
  const { year, month, day } = localDateOf(at);
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/**
 * 解析 `YYYY-MM-DD`；无效或非真实日期（如 2026-02-30）返回 null。
 * 对应 `NaiveDate::parse_from_str(s, "%Y-%m-%d")`。
 */
export function parseDate(value: string): CalendarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function validDate(value: string): boolean {
  return parseDate(value) !== null;
}

/** 自然日加法（可负），与夏令时无关。 */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const t = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
  };
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** 1 = 周一 … 7 = 周日（对应 `weekday().number_from_monday()`）。 */
export function weekdayMonday(date: CalendarDate): number {
  const day = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

/** 所在周的周一（对应 templates::week_start）。 */
export function weekStart(date: CalendarDate): CalendarDate {
  return addDays(date, -(weekdayMonday(date) - 1));
}

/** 两个日历日相差的自然日数（to - from）。 */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.floor((b - a) / DAY_MS);
}

/** 日历日 → `YYYY-MM-DD`。 */
export function formatDate(date: CalendarDate): string {
  return `${pad4(date.year)}-${pad2(date.month)}-${pad2(date.day)}`;
}

/** 本机日期时刻 → Unix 秒（对应 `Local.with_ymd_and_hms(...).timestamp()`）。 */
export function atLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): number {
  return Math.floor(
    new Date(year, month - 1, day, hour, minute, second).getTime() / 1000,
  );
}

export function atLocalDate(date: CalendarDate, hour = 0, minute = 0): number {
  return atLocal(date.year, date.month, date.day, hour, minute);
}

/** `YYYY-MM-DD` → 该日本机 00:00 的 Unix 秒；无效日期返回 null。 */
export function atLocalDateString(date: string): number | null {
  const parsed = parseDate(date);
  if (parsed === null) return null;
  return atLocalDate(parsed);
}

/** Unix 秒 → 本机 `HH:MM`（对应 `t.format("%H:%M")`）。 */
export function hourMinuteString(at: number): string {
  const d = new Date(at * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Unix 秒 → 本机当天已过秒数（0–86399）。 */
export function secondsOfDay(at: number): number {
  const d = new Date(at * 1000);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/** Unix 秒 → 本机 `(hour, minute)`。 */
export function hourMinuteOf(at: number): { hour: number; minute: number } {
  const d = new Date(at * 1000);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

/**
 * 校验 `HH:MM`：长度 5、第 3 位是 `:`、数字且 小时 ≤ 23、分钟 ≤ 59。
 * 对应 templates::valid_time。
 */
export function validTime(value: string): boolean {
  return (
    value.length === 5 &&
    value.charCodeAt(2) === 58 /* ':' */ &&
    value.slice(0, 2) >= "00" &&
    value.slice(0, 2) <= "23" &&
    value.slice(3) >= "00" &&
    value.slice(3) <= "59"
  );
}

/** `HH:MM` → 分钟数；无效返回 null。 */
export function minutesOf(value: string): number | null {
  if (value.length !== 5 || value.charCodeAt(2) !== 58) return null;
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3));
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

/** 当前 Unix 秒（对应 `crate::now`）。 */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}
