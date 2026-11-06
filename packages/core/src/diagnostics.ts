//! 可解释的本地信号。不调模型、不猜缺失数据、不自动下结论。
//! 对应 crates/core/src/diagnostics.rs。

import { dateAt, minutesOf, parseDate, addDays, formatDate } from "./time";
import type { Snapshot, Task } from "./model";
import { isHabit } from "./model";
import { windowMinutes } from "./reminders";
import { blocksOnDate, overlapMinutes, requiredMinutes } from "./blocks";

export interface Anomaly {
  key: string;
  kind: string;
  title: string;
  severity: string;
  evidence: Record<string, unknown>;
  question: string;
}

function signal(
  key: string,
  kind: string,
  title: string,
  severity: string,
  evidence: Record<string, unknown>,
  question: string,
): Anomaly {
  return { key, kind, title, severity, evidence, question };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * 容量是显式用户预算，否则取历史活跃日中位数，最后落到每日目标。
 * 基线是证据，不是可用时间。
 */
export function diagnose(
  snapshot: Snapshot,
  capacityMinutes: number | null,
): Anomaly[] {
  const data = snapshot.data;
  const at = snapshot.serverTime;
  const today = parseDate(snapshot.today)!;
  const weekStart = formatDate(addDays(today, -7));
  const monthStart = formatDate(addDays(today, -28));
  const byDay = new Map<string, number>();
  for (const s of data.sessions) {
    const date = dateAt(s.endedAt);
    if (date >= monthStart && date < snapshot.today) {
      byDay.set(date, (byDay.get(date) ?? 0) + Math.floor(s.durationSecs / 60));
    }
  }
  const activeMinutes = [...byDay.values()].filter((m) => m >= 20);
  const historical = activeMinutes.length >= 5 ? median(activeMinutes) : null;
  const capacity =
    capacityMinutes !== null
      ? capacityMinutes
      : historical !== null
        ? Math.max(30, historical)
        : data.settings.dailyGoal * data.settings.focusMinutes;
  const capacitySource =
    capacityMinutes !== null
      ? "用户设置的日预算"
      : historical !== null
        ? "近28天至少5个活跃日的中位数（并非可用时间）"
        : "每日番茄目标预算（并非可用时间）";
  const completedRounds = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.completed && s.taskId !== null) {
      completedRounds.set(s.taskId, (completedRounds.get(s.taskId) ?? 0) + 1);
    }
  }
  const result: Anomaly[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const date = formatDate(addDays(today, offset));
    const tasks = data.tasks.filter(
      (t) => t.dueDate === date && !t.completed && !data.taskIsVoid(t),
    );
    const minutes = tasks.reduce(
      (n, t) =>
        n +
        Math.max(0, t.estimate - (completedRounds.get(t.id) ?? 0)) *
          (t.focusMinutes ?? data.settings.focusMinutes),
      0,
    );
    const day = parseDate(date);
    const blockedMinutes = requiredMinutes(data.blocks, date);
    if (capacity > 0 && minutes * 100 > capacity * 130) {
      result.push(
        signal(
          `overload/${date}`,
          "overload",
          "计划用时高于当前预算",
          "warning",
          {
            date,
            remainingPlannedMinutes: minutes,
            budgetMinutes: capacity,
            budgetSource: capacitySource,
            blockedMinutes,
            taskIds: tasks.slice(0, 30).map((t) => t.id),
          },
          "这些任务的预计用时是否准确？这一天有额外可用时间，还是需要减量或挪动？",
        ),
      );
    }
    if (
      offset === 1 &&
      historical !== null &&
      tasks.length > 0 &&
      minutes * 100 < capacity * 30
    ) {
      result.push(
        signal(
          `underload/${date}`,
          "underload",
          "明日安排明显低于近期投入",
          "notice",
          {
            date,
            plannedMinutes: minutes,
            baselineMinutes: capacity,
            baselineSource: capacitySource,
            blockedMinutes,
          },
          "明天是有意休息、课程占用，还是计划尚未补齐？不要仅凭空闲推断应该加任务。",
        ),
      );
    }
    const timed: { start: number; task: Task }[] = tasks
      .map((t) => ({
        start: t.reminderTime !== null ? (minutesOf(t.reminderTime) ?? -1) : -1,
        task: t,
      }))
      .filter((x) => x.start >= 0)
      .sort(
        (a, b) =>
          a.start - b.start ||
          (a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0),
      );
    // 需专心的时段才构成真实冲突；水课正是并行作业的地方，保持安静。
    if (day !== null) {
      const required = blocksOnDate(data.blocks, date).filter(
        (b) => b.attention === "required",
      );
      for (const { start, task } of timed) {
        const end = start + windowMinutes(task, data.settings);
        for (const band of required) {
          const overlap = overlapMinutes(band, date, start, end);
          if (overlap > 0) {
            result.push(
              signal(
                `block/${date}/${task.id}/${band.id}`,
                "blockConflict",
                "计划时段落在需专心的课程内",
                "warning",
                {
                  date,
                  taskId: task.id,
                  taskTitle: task.title,
                  blockId: band.id,
                  blockTitle: band.title,
                  blockStart: band.start,
                  blockEnd: band.end,
                  overlapMinutes: overlap,
                },
                "这段安排和要专心听的课重叠：能挪到水课时段或课后吗？如果确实要课上做，说明后我不会再把它当冲突。",
              ),
            );
          }
        }
      }
    }
    // 记录延伸到最右侧的区间；只与相邻比较会漏掉一个长课程覆盖多个短任务。
    let previous: { end: number; task: Task } | null = null;
    for (const { start, task } of timed) {
      const end = start + windowMinutes(task, data.settings);
      if (previous !== null) {
        const prev = previous;
        if (start < prev.end) {
          const ids = [prev.task.id, task.id].sort();
          const band =
            day === null
              ? null
              : data.blocks.find(
                  (b) =>
                    b.attention === "light" &&
                    overlapMinutes(b, date, start, Math.min(prev.end, end)) > 0,
                );
          result.push(
            signal(
              `collision/${date}/${ids[0]}/${ids[1]}`,
              "collision",
              "两个计划时段重叠",
              "warning",
              {
                date,
                taskIds: ids,
                titles: [prev.task.title, task.title],
                overlapMinutes: Math.min(prev.end, end) - start,
                includesBreaks: true,
                blockTitle: band?.title ?? null,
              },
              "这两个安排能否同时完成？如果是在同一课程内做作业，请说明，避免把允许的并行误判为冲突。",
            ),
          );
        }
        if (end <= previous.end) {
          continue;
        }
      }
      previous = { end, task };
    }
  }
  const habits = new Map<
    string,
    { scheduled: number; missed: number; ids: string[] }
  >();
  for (const t of data.tasks) {
    if (
      !isHabit(t) ||
      t.dueDate === null ||
      !(t.dueDate >= weekStart && t.dueDate < snapshot.today)
    ) {
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
  for (const [id, { scheduled, missed, ids }] of habits) {
    if (scheduled >= 4 && missed >= 3 && missed * 100 >= scheduled * 50) {
      result.push(
        signal(
          `habit/${id}`,
          "habitAbsence",
          "近一周习惯多次未完成",
          "warning",
          {
            habitId: id,
            observedOccurrences: scheduled,
            missedOccurrences: missed,
            windowStart: weekStart,
            windowEnd: snapshot.today,
            taskIds: ids,
          },
          "是时间安排不合适、任务太难、外部占用，还是已经不想继续这个习惯？先确认原因再改计划。",
        ),
      );
    }
  }
  const recentSessions = data.sessions.filter(
    (s) => s.source === "timer" && s.endedAt >= at - 7 * 86400,
  );
  const late = recentSessions.filter((s) => {
    const hour = new Date(s.endedAt * 1000).getHours();
    return !(hour >= 6 && hour < 23);
  });
  const distinctLate = new Set(late.map((s) => dateAt(s.endedAt)));
  if (distinctLate.size >= 3) {
    result.push(
      signal(
        "rhythm/late",
        "rhythmDrift",
        "近一周多天有深夜专注记录",
        "notice",
        {
          lateDates: [...distinctLate],
          lateSessionCount: late.length,
          window: "23:00–06:00 本机时间",
          sampleSessions: recentSessions.length,
        },
        "这是临时安排还是符合你的作息？结合你确认的睡眠和课程信息判断，不以统一作息评价用户。",
      ),
    );
  }
  const recentDays = [...byDay.keys()].filter((d) => d >= weekStart).length;
  if (historical !== null && recentDays >= 3) {
    const recent = [...byDay.entries()]
      .filter(([d]) => d >= weekStart)
      .map(([, m]) => m);
    if (
      recent.reduce((n, m) => n + m, 0) * 100 <
      historical * recent.length * 40
    ) {
      result.push(
        signal(
          "engagement/drop",
          "engagementDrop",
          "近期记录的投入明显下降",
          "notice",
          {
            recentActiveDays: recent.length,
            recentMeanMinutes:
              recent.length > 0
                ? Math.floor(recent.reduce((n, m) => n + m, 0) / recent.length)
                : 0,
            baselineMinutes: historical,
          },
          "是否有考试、课程、身体状态或线下学习变化？先补全记录背景，再决定是否调整节奏。",
        ),
      );
    }
  }
  result.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return result.slice(0, 30);
}
