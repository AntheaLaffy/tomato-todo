// 数据统计：把专注过的时间变成看得见的形状，而不是排行榜。
//
// 页面只读：数字来自 /api/state 的 stats（固定 28 天 DayStat）与 data.sessions；
// 聚合、格式化全部走 shared/derive.js，避免第二套统计口径。state 为 null（首帧）
// 或旧样例数据缺字段时按空数据渲染，不抛错。
import { h } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import {
  PageHeader,
  Card,
  SectionTitle,
  Stat,
  Bar,
  Badge,
  Empty,
  IconBtn,
  Dot,
} from "../shared/ui.js";
import {
  recentDays,
  projectTimeDistribution,
  focusTrail,
  fmtMinutes,
  toMinutes,
  weekdayIndex,
  todayKey,
} from "../shared/derive.js";
import { registerPage } from "../app/registry.js";

registerCopy("stats", {
  zh: {
    eyebrow: "YOUR TIME, WELL SPENT",
    subtitle: "不和别人比较，只看见自己的每一点进步。",
    refresh: "刷新",
    labelTotalMinutes: "累计专注",
    unitMinutes: "分钟",
    hintTotal: "所有专注时段的累计",
    labelPomodoros: "完成番茄",
    unitCount: "个",
    hintPomodoros: "完成的专注轮次",
    labelStreak: "连续专注天数",
    unitDays: "天",
    hintStreak: "每天都开始一次专注",
    labelMissed: "习惯缺勤",
    unitTimes: "次",
    hintMissed: "近 28 天未完成的定时习惯",
    last7: "最近 7 天",
    total: "共 {value}",
    where: "时间花在哪里",
    noProjects: "还没有项目专注记录",
    noProjectsHint: "完成一次专注后，这里会按项目汇总时间。",
    daily: "每日记录",
    dailyHint: "最近 {n} 天",
    colDate: "日期",
    colCompleted: "完成",
    colMissed: "缺勤",
    colVoided: "作废",
    trail: "专注足迹",
    trailCount: "最近 {n} 条",
    unknownTask: "未知任务",
    completed: "已完成",
    supplement: "按预计补足",
    endedEarly: "提前结束",
    noTrail: "还没有专注记录",
    noTrailHint: "开始第一个番茄，这里会留下足迹。",
    noDays: "还没有每日统计",
    noDaysHint: "统计按天累积，稍后回来看。",
  },
  en: {
    eyebrow: "YOUR TIME, WELL SPENT",
    subtitle:
      "No comparison — only your own quiet progress, one day at a time.",
    refresh: "Refresh",
    labelTotalMinutes: "Total focus",
    unitMinutes: "min",
    hintTotal: "Summed across every focus session",
    labelPomodoros: "Pomodoros",
    unitCount: "pcs",
    hintPomodoros: "Focus rounds completed",
    labelStreak: "Focus streak",
    unitDays: "days",
    hintStreak: "A day counts once you start focusing",
    labelMissed: "Missed habits",
    unitTimes: "times",
    hintMissed: "Scheduled habits left undone in the last 28 days",
    last7: "Last 7 days",
    total: "Total {value}",
    where: "Where the time went",
    noProjects: "No project focus yet",
    noProjectsHint:
      "Finish a focus session and its time will be grouped by project here.",
    daily: "Daily log",
    dailyHint: "Last {n} days",
    colDate: "Date",
    colCompleted: "Done",
    colMissed: "Missed",
    colVoided: "Voided",
    trail: "Focus trail",
    trailCount: "Latest {n}",
    unknownTask: "Untitled task",
    completed: "Completed",
    supplement: "Filled from estimate",
    endedEarly: "Ended early",
    noTrail: "No sessions yet",
    noTrailHint: "Start your first pomodoro and it will leave a trace here.",
    noDays: "No daily stats yet",
    noDaysHint: "Stats build up day by day; check back soon.",
  },
});

const pad2 = (n) => String(n).padStart(2, "0");

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Unix 秒 → 本地 `M/D HH:MM`；手写格式化（不用 locale 字符串，便于测试）。 */
function fmtSessionTime(unixSecs) {
  const secs = Number(unixSecs);
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const d = new Date(secs * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 每日记录里的数字格：0 用「·」，非 0 用等宽数字。 */
function NumCell({ value, color }) {
  const n = Number(value) || 0;
  return h(
    "div",
    {
      className: n === 0 ? undefined : "t-mono",
      style: { fontSize: 12.5, color: n === 0 ? "var(--tomato-ink-3)" : color },
    },
    n === 0 ? "·" : String(n),
  );
}

/** session → 状态徽章（按预计补足 / 已完成 / 提前结束）。 */
function trailStatus(session) {
  if (session && session.source === "taskEstimate") {
    return { label: t("stats.supplement"), tone: "neutral" };
  }
  if (session && session.completed) {
    return { label: t("stats.completed"), tone: "leaf" };
  }
  return { label: t("stats.endedEarly"), tone: "sun" };
}

const GRID_COLUMNS = "1.3fr 1fr 1fr 1fr";

const rowGridStyle = {
  display: "grid",
  gridTemplateColumns: GRID_COLUMNS,
  alignItems: "center",
  height: 34,
  padding: "0 10px",
  borderBottom: "1px solid var(--tomato-line)",
};

/** 7 天条形图：列底对齐、柱顶圆角 8px，今日柱用深品牌色。 */
function WeekChart({ days, today }) {
  const scale = Math.max(60, ...days.map((day) => day.minutes));
  const barArea = 112;
  const weekLabels = t("common.week");
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        height: 150,
      },
    },
    days.map((day) => {
      const isToday = day.date === today;
      const height =
        day.minutes > 0
          ? Math.max(4, Math.round((day.minutes / scale) * barArea))
          : 2;
      const label = isToday
        ? t("common.today")
        : Array.isArray(weekLabels)
          ? weekLabels[weekdayIndex(day.date)]
          : "";
      return h(
        "div",
        {
          key: day.date,
          style: {
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 5,
          },
        },
        h(
          "div",
          {
            className: "t-mono",
            style: {
              height: 12,
              fontSize: 10.5,
              lineHeight: "12px",
              color: isToday
                ? "var(--tomato-brand-deep)"
                : "var(--tomato-ink-3)",
            },
          },
          day.minutes > 0 ? String(day.minutes) : "",
        ),
        h("div", {
          style: {
            width: "100%",
            maxWidth: 34,
            height,
            borderRadius: "8px 8px 2px 2px",
            background: isToday
              ? "var(--tomato-brand-deep)"
              : "var(--tomato-brand)",
          },
        }),
        h(
          "div",
          {
            style: {
              height: 14,
              fontSize: 11,
              lineHeight: "14px",
              whiteSpace: "nowrap",
              color: isToday
                ? "var(--tomato-brand-deep)"
                : "var(--tomato-ink-3)",
              fontWeight: isToday ? 600 : 400,
            },
          },
          label,
        ),
      );
    }),
  );
}

function StatsPage({ state, refresh }) {
  const data = (state && state.data) || {};
  const stats = (state && state.stats) || {};

  const stateToday = state && state.today;
  const today = DAY_KEY_RE.test(String(stateToday))
    ? stateToday
    : todayKey(state && state.serverTime);

  // 过滤掉旧样例里的空条目，避免把 null 传进 derive 的日期聚合。
  const days = (Array.isArray(stats.days) ? stats.days : []).filter(
    (day) => day && typeof day === "object",
  );
  const totalMinutes = Math.round((Number(stats.totalSeconds) || 0) / 60);
  const totalPomodoros = Number(stats.totalPomodoros) || 0;
  const streak = Number(stats.streak) || 0;
  const missedTotal = days.reduce(
    (sum, day) => sum + (Number(day && day.missed) || 0),
    0,
  );

  const week = recentDays({ days }, 7, today);
  const weekTotal = week.reduce((sum, day) => sum + day.minutes, 0);

  const sessions = (Array.isArray(data.sessions) ? data.sessions : []).filter(
    (session) => session && typeof session === "object",
  );
  const sessionData = {
    projects: Array.isArray(data.projects) ? data.projects : [],
    sessions,
  };
  const distribution = projectTimeDistribution(sessionData);
  const topMinutes = distribution.length > 0 ? distribution[0].minutes : 1;
  const trail = focusTrail(sessionData, 12);
  const dayRows = days.slice(-14).reverse();

  const header = h(PageHeader, {
    eyebrow: t("stats.eyebrow"),
    title: t("nav.stats"),
    subtitle: t("stats.subtitle"),
    actions: h(IconBtn, {
      name: "refresh",
      title: t("stats.refresh"),
      onClick: typeof refresh === "function" ? refresh : undefined,
    }),
  });

  const statRow = h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 16 } },
    h(Stat, {
      icon: "clock",
      label: t("stats.labelTotalMinutes"),
      value: totalMinutes,
      unit: t("stats.unitMinutes"),
      hint: t("stats.hintTotal"),
      tone: "brand",
      style: { flex: "1 1 200px" },
    }),
    h(Stat, {
      icon: "tomato",
      label: t("stats.labelPomodoros"),
      value: totalPomodoros,
      unit: t("stats.unitCount"),
      hint: t("stats.hintPomodoros"),
      tone: "leaf",
      style: { flex: "1 1 200px" },
    }),
    h(Stat, {
      icon: "flame",
      label: t("stats.labelStreak"),
      value: streak,
      unit: t("stats.unitDays"),
      hint: t("stats.hintStreak"),
      tone: "sun",
      style: { flex: "1 1 200px" },
    }),
    h(Stat, {
      icon: "moon",
      label: t("stats.labelMissed"),
      value: missedTotal,
      unit: t("stats.unitTimes"),
      hint: t("stats.hintMissed"),
      tone: "plum",
      style: { flex: "1 1 200px" },
    }),
  );

  const weekCard = h(
    Card,
    { pad: 22, style: { flex: "1 1 320px", minWidth: 320 } },
    h(SectionTitle, {
      icon: "stats",
      title: t("stats.last7"),
      hint: t("stats.total", { value: fmtMinutes(weekTotal) }),
    }),
    h(WeekChart, { days: week, today }),
    h("div", {
      style: { height: 1, background: "var(--tomato-line)", marginTop: 6 },
    }),
  );

  const projectCard = h(
    Card,
    { pad: 22, style: { flex: "1 1 320px", minWidth: 320 } },
    h(SectionTitle, { icon: "folder", title: t("stats.where") }),
    distribution.length === 0
      ? h(Empty, {
          icon: "folder",
          title: t("stats.noProjects"),
          hint: t("stats.noProjectsHint"),
        })
      : h(
          "div",
          null,
          distribution.map((row, index) =>
            h(
              "div",
              {
                key: row.name,
                style: {
                  marginBottom: index === distribution.length - 1 ? 0 : 12,
                },
              },
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 6,
                  },
                },
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      minWidth: 0,
                    },
                  },
                  h(Dot, {
                    color: row.color || "var(--tomato-brand)",
                    size: 7,
                  }),
                  h(
                    "div",
                    {
                      style: {
                        fontSize: 12.5,
                        color: "var(--tomato-ink-2)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    },
                    row.name,
                  ),
                ),
                h(
                  "div",
                  {
                    className: "t-mono",
                    style: {
                      fontSize: 11.5,
                      color: "var(--tomato-ink-3)",
                      flex: "none",
                    },
                  },
                  fmtMinutes(row.minutes),
                ),
              ),
              h(Bar, {
                value: row.minutes,
                max: topMinutes,
                height: 8,
                color: row.color || "var(--tomato-brand)",
              }),
            ),
          ),
        ),
  );

  const dailyCard = h(
    Card,
    { pad: 22, style: { marginBottom: 16 } },
    h(SectionTitle, {
      icon: "calendar",
      title: t("stats.daily"),
      hint:
        dayRows.length > 0 ? t("stats.dailyHint", { n: dayRows.length }) : null,
    }),
    dayRows.length === 0
      ? h(Empty, {
          icon: "stats",
          title: t("stats.noDays"),
          hint: t("stats.noDaysHint"),
        })
      : h(
          "div",
          null,
          h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: GRID_COLUMNS,
                alignItems: "center",
                padding: "0 10px 8px",
                fontSize: 11.5,
                color: "var(--tomato-ink-3)",
                borderBottom: "1px solid var(--tomato-line)",
              },
            },
            h("div", null, t("stats.colDate")),
            h("div", null, t("stats.colCompleted")),
            h("div", null, t("stats.colMissed")),
            h("div", null, t("stats.colVoided")),
          ),
          dayRows.map((rawDay, index) => {
            const day = rawDay || {};
            const date = typeof day.date === "string" ? day.date : "";
            const isToday = date !== "" && date === today;
            const dateLabel =
              date.length >= 10 ? date.slice(5).replace("-", "/") : date;
            return h(
              "div",
              {
                key: date || `row-${index}`,
                style: {
                  ...rowGridStyle,
                  background: isToday
                    ? "var(--tomato-surface-2)"
                    : "transparent",
                  borderRadius: 8,
                },
              },
              h(
                "div",
                {
                  className: "t-mono",
                  style: {
                    fontSize: 12.5,
                    color: isToday
                      ? "var(--tomato-brand-deep)"
                      : "var(--tomato-ink-2)",
                  },
                },
                dateLabel,
              ),
              h(NumCell, { value: day.completed, color: "var(--tomato-leaf)" }),
              h(NumCell, { value: day.missed, color: "var(--tomato-sun)" }),
              h(NumCell, { value: day.voided, color: "var(--tomato-ink-2)" }),
            );
          }),
        ),
  );

  const trailCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "clock",
      title: t("stats.trail"),
      hint: t("stats.trailCount", { n: trail.length }),
    }),
    trail.length === 0
      ? h(Empty, {
          icon: "clock",
          title: t("stats.noTrail"),
          hint: t("stats.noTrailHint"),
        })
      : h(
          "div",
          null,
          trail.map((session, index) => {
            const status = trailStatus(session);
            return h(
              "div",
              {
                key: session.id || `trail-${index}`,
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom:
                    index === trail.length - 1
                      ? "1px solid transparent"
                      : "1px solid var(--tomato-line)",
                },
              },
              h(
                "div",
                { style: { flex: 1, minWidth: 0 } },
                h(
                  "div",
                  {
                    style: {
                      fontSize: 13,
                      color: "var(--tomato-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  session.taskTitle || t("stats.unknownTask"),
                ),
                session.projectName
                  ? h(
                      "div",
                      {
                        style: {
                          fontSize: 11.5,
                          color: "var(--tomato-ink-3)",
                          marginTop: 2,
                        },
                      },
                      session.projectName,
                    )
                  : null,
              ),
              h(
                "div",
                {
                  className: "t-mono",
                  style: {
                    fontSize: 11.5,
                    color: "var(--tomato-ink-3)",
                    flex: "none",
                  },
                },
                fmtSessionTime(session.endedAt),
              ),
              h(
                "div",
                {
                  className: "t-mono",
                  style: {
                    fontSize: 12,
                    color: "var(--tomato-ink-2)",
                    flex: "none",
                    minWidth: 56,
                    textAlign: "right",
                  },
                },
                fmtMinutes(toMinutes(session.durationSecs)),
              ),
              h(Badge, { tone: status.tone }, status.label),
            );
          }),
        ),
  );

  return h(
    "div",
    { className: "t-root" },
    header,
    statRow,
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "stretch",
          gap: 16,
          marginBottom: 16,
        },
      },
      weekCard,
      projectCard,
    ),
    dailyCard,
    trailCard,
  );
}

registerPage({
  id: "stats",
  order: 40,
  icon: "stats",
  titleKey: "nav.stats",
  Component: StatsPage,
});
