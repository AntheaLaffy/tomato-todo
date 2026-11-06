//! 教学执行：课程/作业到普通待办的一对一来源关联、改期更新、明确参与、
//! 提交完成与重复作业抑制；计划导出排除并保留教学待办。
//! 对应 crates/core/src/teaching_tasks.rs。

import { AppError, ensure } from "./errors";
import { id } from "./ids";
import type { AppData } from "./lib";
import type { TeachingTask, TeachingTaskKind } from "./model";
import { dateAt, hourMinuteString } from "./time";
import { recordSession, resetTo, startTimer } from "./reminders";

export function teachingTask(
  data: AppData,
  taskId: string,
): TeachingTask | undefined {
  return data.education.focusTasks.find((link) => link.taskId === taskId);
}

/** 教学来源拥有安排：课程/作业生成或更新普通待办，改期改内容随来源走。 */
export function materializeTeachingTasks(data: AppData, at: number): boolean {
  const enabled = new Set(
    data.education.projects.filter((p) => p.examMode).map((p) => p.projectId),
  );
  const sources: {
    kind: TeachingTaskKind;
    sourceId: string;
    projectId: string;
    title: string;
    notes: string;
    startsAt: number;
    minutes: number;
  }[] = [];
  for (const lesson of data.education.lessons) {
    if (
      enabled.has(lesson.projectId) &&
      dateAt(lesson.startsAt) >= dateAt(at)
    ) {
      sources.push({
        kind: "lesson",
        sourceId: lesson.id,
        projectId: lesson.projectId,
        title: lesson.title,
        notes: lesson.topics.join("、"),
        startsAt: lesson.startsAt,
        minutes: 45,
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
        minutes: Math.max(1, minutes),
      });
    }
  }
  const links = new Map<string, TeachingTask>();
  for (const link of data.education.focusTasks) {
    links.set(link.sourceId, link);
  }
  const positions = new Map<string, number>();
  data.tasks.forEach((task, i) => positions.set(task.id, i));
  const submissions = new Map<
    string,
    { submittedAt: number; unfinished: boolean }
  >();
  for (const submission of data.education.submissions) {
    const last = submissions.get(submission.assessmentId);
    if (last === undefined || submission.submittedAt >= last.submittedAt) {
      submissions.set(submission.assessmentId, {
        submittedAt: submission.submittedAt,
        unfinished: submission.unfinished,
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
    minutes,
  } of sources) {
    const link = links.get(sourceId);
    const taskId =
      link !== undefined && link.kind === kind ? link.taskId : undefined;
    const position = taskId !== undefined ? positions.get(taskId) : undefined;
    if (taskId !== undefined && position === undefined) {
      continue;
    }
    const dueDate = dateAt(startsAt);
    const isLesson = kind === "lesson";
    const reminder = isLesson ? hourMinuteString(startsAt) : null;
    const focus = isLesson ? 45 : Math.min(minutes, data.settings.focusMinutes);
    const estimate = Math.max(1, Math.ceil(minutes / focus));
    const scrap = isLesson
      ? (() => {
          const d = new Date(startsAt * 1000);
          return Math.max(0, 1440 - d.getHours() * 60 - d.getMinutes() - 45);
        })()
      : 0;
    let index: number;
    if (position !== undefined) {
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
        tags: [isLesson ? "课程" : "作业"],
        subtasks: [],
      });
      changed = true;
      index = data.tasks.length - 1;
    }
    const task = data.tasks[index]!;
    if (
      !task.completed &&
      (task.title !== title ||
        task.notes !== notes ||
        task.projectId !== projectId ||
        task.dueDate !== dueDate ||
        task.reminderTime !== reminder ||
        task.focusMinutes !== focus ||
        task.estimate !== estimate ||
        task.scrapMinutes !== scrap)
    ) {
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
        if (last === undefined || last.unfinished) return null;
        return last.submittedAt;
      })();
      if (
        task.completed !== (submitted !== null) ||
        task.completedAt !== submitted
      ) {
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

/** 明确完成课程待办 = 参与课程；作业只能从作业入口提交。 */
export function completeTeachingTask(
  data: AppData,
  taskId: string,
  at: number,
): void {
  const link = teachingTask(data, taskId);
  if (link === undefined) return;
  if (link.kind === "homework") {
    throw new AppError("请从作业入口提交答卷，提交完成后会自动完成待办");
  }
  const lesson = data.education.lessons.find((l) => l.id === link.sourceId);
  ensure(lesson !== undefined, "课程不存在");
  lesson.attended = true;
  if (lesson.progress.trim().length === 0) {
    lesson.progress =
      "本人从今日专注确认课程任务完成，具体学习位置待补充；掌握情况待复测";
  }
  if (at >= lesson.endsAt) {
    lesson.state = "ended";
    if (lesson.aiEnabled) {
      data.education.event(lesson.projectId, "homework", lesson.id, at);
    }
  }
}

/** 自动计时不确认课程参与：只有明确开始/完成才算参与。 */
export function startTeachingTask(data: AppData, at: number): void {
  if (data.timer.mode !== "focus") return;
  const link =
    data.timer.taskId !== null
      ? teachingTask(data, data.timer.taskId)
      : undefined;
  if (link === undefined || link.kind !== "lesson") return;
  const lesson = data.education.lessons.find((l) => l.id === link.sourceId);
  if (lesson !== undefined) {
    if (at >= lesson.startsAt && at < lesson.endsAt) {
      lesson.attended = true;
    }
  }
}

/** 来源关联一对一、同项目、实例为唯一普通任务。 */
export function validateTeachingTasks(data: AppData): void {
  const tasks = new Set<string>();
  const sources = new Set<string>();
  for (const link of data.education.focusTasks) {
    const task = data.tasks.find((t) => t.id === link.taskId);
    ensure(task !== undefined, "教学待办关联的任务不存在");
    const project = (() => {
      if (link.kind === "lesson") {
        return (
          data.education.lessons.find((l) => l.id === link.sourceId)
            ?.projectId ?? null
        );
      }
      return (
        data.education.assessments.find(
          (a) => a.id === link.sourceId && a.kind === "homework",
        )?.projectId ?? null
      );
    })();
    ensure(project !== null, "教学待办来源不存在或类型不符");
    if (
      task.projectId !== project ||
      tasks.has(link.taskId) ||
      sources.has(link.sourceId) ||
      task.templateId !== null ||
      task.habitId !== null ||
      task.recurring
    ) {
      throw new AppError("教学来源必须关联同项目的唯一普通任务");
    }
    tasks.add(link.taskId);
    sources.add(link.sourceId);
  }
}
