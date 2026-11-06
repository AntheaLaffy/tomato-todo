// 任务对话框：新建与编辑任务的唯一入口（今日专注 / 全部任务 / ⌘K 共用）。
//
// 为什么放在 pages/ 而不是 shared/：它只服务任务视图，文案、字段组合和保存
// 语义都属于「任务」这一页域；focus/tasks/search 三个模块都从本文件 import
// TaskDialog，避免三处各写一份表单导致字段漂移。
//
// 语义（对齐 @tomato/core 的 saveTask / TaskDraft）：
// - 新建与编辑走同一 Action，区别只在 id 是否为 null；编辑不会改模板/重复来源。
// - 计划日期必填（core validateReminderTask 要求）；提醒时刻需要计划日期。
// - 「预计番茄数」是完成度分母：任务行显示 已完成轮次/预计番茄数。
import { h, useEffect, useRef, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import {
  Btn,
  Check,
  Divider,
  Field,
  IconBtn,
  Input,
  Modal,
  Select,
  TextArea,
  notify,
} from "../shared/ui.js";
import { tryDispatch } from "../shared/store.js";

registerCopy("task", {
  zh: {
    newTitle: "直接创建实例",
    editTitle: "编辑实例",
    newSubtitle: "写下想完成的一件事，日期和专注时段可以慢慢补。",
    editSubtitle: "日期、完成状态和专注记录属于这一次执行；改模板请去模板编辑。",
    title: "任务名称",
    titlePlaceholder: "想完成什么？",
    project: "所属项目",
    noProject: "不分类",
    dueDate: "计划日期",
    reminder: "提醒时刻",
    reminderHint: "留空表示只放进当日待办，不单独提醒",
    focusMinutes: "单次专注时长",
    focusMinutesHint: "留空沿用设置里的 {n} 分钟",
    estimate: "预计番茄数",
    estimateHint: "完成度按完成的专注轮次计",
    focusPreview: "约 {n} 分钟专注（不含休息），含休息约 {m} 分钟",
    priority: "优先级",
    scrap: "重修窗口",
    scrapHint: "计划块结束后仍可补做的分钟数；0 表示到点作废",
    tags: "标签",
    tagsPlaceholder: "用逗号分隔，例如：数学, 错题",
    notes: "备注",
    notesPlaceholder: "补充资料、位置或提醒自己的话…",
    subtasks: "子任务",
    subtaskPlaceholder: "添加一个子任务",
    addSubtask: "添加子任务",
    removeSubtask: "删除子任务",
    titleRequired: "任务名称不能为空",
    dateRequired: "请选择计划日期",
    focusInvalid: "单次专注时长需为 1–180 分钟",
    estimateInvalid: "预计番茄数需为 1–99",
    scrapInvalid: "重修窗口需为 0–10080 分钟",
    tooManyTags: "标签最多 20 个，每个不超过 40 字",
    subtaskEmpty: "子任务名称不能为空",
    saved: "任务已保存",
    created: "任务已创建",
    deleted: "任务已删除",
    deleteTitle: "删除这个任务？",
    deleteBody: "专注记录会保留在统计里；这一步不能撤销。",
    deleteConfirm: "确认删除",
    edit: "编辑",
    new: "新建",
    untouched: "未命名步骤",
  },
  en: {
    newTitle: "Create task",
    editTitle: "Edit task",
    newSubtitle: "One thing at a time. Dates and focus blocks can come later.",
    editSubtitle: "Date, completion and sessions belong to this instance; edit the template to change the pattern.",
    title: "Title",
    titlePlaceholder: "What do you want to finish?",
    project: "Project",
    noProject: "No project",
    dueDate: "Planned date",
    reminder: "Reminder",
    reminderHint: "Leave empty to just list it for the day",
    focusMinutes: "Focus per session",
    focusMinutesHint: "Empty uses the {n} min default",
    estimate: "Pomodoros planned",
    estimateHint: "Progress counts completed focus rounds",
    focusPreview: "About {n} min focus (breaks excluded), {m} min with breaks",
    priority: "Priority",
    scrap: "Repair window",
    scrapHint: "Minutes still usable after the plan block; 0 voids it on time",
    tags: "Tags",
    tagsPlaceholder: "Comma separated, e.g. math, mistakes",
    notes: "Notes",
    notesPlaceholder: "References, location, or a note to yourself…",
    subtasks: "Subtasks",
    subtaskPlaceholder: "Add a subtask",
    addSubtask: "Add subtask",
    removeSubtask: "Remove subtask",
    titleRequired: "Title is required",
    dateRequired: "Pick a planned date",
    focusInvalid: "Focus per session must be 1–180 minutes",
    estimateInvalid: "Planned pomodoros must be 1–99",
    scrapInvalid: "Repair window must be 0–10080 minutes",
    tooManyTags: "At most 20 tags, each under 40 characters",
    subtaskEmpty: "Subtask title is required",
    saved: "Task saved",
    created: "Task created",
    deleted: "Task deleted",
    deleteTitle: "Delete this task?",
    deleteBody: "Focus history stays in stats. This cannot be undone.",
    deleteConfirm: "Delete",
    edit: "Edit",
    new: "New",
    untouched: "Untitled step",
  },
});

const PRIORITY_KEYS = ["priorityNone", "priorityLow", "priorityMedium", "priorityHigh"];

registerCopy("task", {
  zh: {
    priorityNone: "无",
    priorityLow: "低",
    priorityMedium: "中",
    priorityHigh: "高",
  },
  en: {
    priorityNone: "None",
    priorityLow: "Low",
    priorityMedium: "Medium",
    priorityHigh: "High",
  },
});

/** 新建子任务 id：crypto 不可用时退回时间戳 + 随机串。 */
function newId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* 非安全上下文退回下面 */
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 数字输入框的原始字符串 → 整数；空串返回 null。 */
function intOf(raw, fallback = null) {
  if (raw === null || raw === undefined) return fallback;
  const text = String(raw).trim();
  if (text === "") return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** 新建任务的空白草稿；initialTitle 用于「搜索无结果 → 用关键词新建」。 */
export function blankTaskDraft(today, initialTitle = "") {
  return {
    id: null,
    title: initialTitle ?? "",
    notes: "",
    projectId: "",
    dueDate: today ?? "",
    reminderTime: "",
    focusMinutes: "",
    scrapMinutes: "0",
    priority: 0,
    estimate: "1",
    tagsText: "",
    subtasks: [],
  };
}

/** 把已有 Task 翻成草稿（字符串字段便于受控输入）。 */
export function taskToDraft(task) {
  return {
    id: task.id,
    title: task.title ?? "",
    notes: task.notes ?? "",
    projectId: task.projectId ?? "",
    dueDate: task.dueDate ?? "",
    reminderTime: task.reminderTime ?? "",
    focusMinutes:
      task.focusMinutes === null || task.focusMinutes === undefined ? "" : String(task.focusMinutes),
    scrapMinutes: String(task.scrapMinutes ?? 0),
    priority: Number(task.priority) || 0,
    estimate: String(Math.max(1, Number(task.estimate) || 1)),
    tagsText: Array.isArray(task.tags) ? task.tags.join(", ") : "",
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((sub) => ({ id: sub.id, title: sub.title, done: !!sub.done }))
      : [],
  };
}

/**
 * TaskDialog：open 为 true 时渲染。
 * props:
 * - open, onClose
 * - task: 编辑目标（null = 新建）
 * - today: 今天 YYYY-MM-DD
 * - projects: data.projects
 * - settings: data.settings
 * - initialTitle: 新建时预填标题（搜索无结果时用关键词新建）
 */
export function TaskDialog({
  open,
  onClose,
  task = null,
  today = "",
  projects = [],
  settings = {},
  initialTitle = "",
}) {
  const editing = task !== null && task !== undefined;
  const taskId = editing ? task.id : null;
  const [draft, setDraft] = useState(() =>
    editing ? taskToDraft(task) : blankTaskDraft(today, initialTitle),
  );
  const [subInput, setSubInput] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subInputRef = useRef(null);

  // 打开时按目标重置；用 taskId 而不是 task 作为依赖，避免轮询换新对象时清空输入。
  useEffect(() => {
    if (!open) return;
    setDraft(editing ? taskToDraft(task) : blankTaskDraft(today, initialTitle));
    setSubInput("");
    setError(null);
    setBusy(false);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, today, initialTitle]);

  if (!open) return null;

  const patch = (next) => setDraft((current) => ({ ...current, ...next }));
  const defaultFocus = Number(settings.focusMinutes) || 45;
  const focusValue = intOf(draft.focusMinutes, defaultFocus);
  const estimateValue = intOf(draft.estimate, 1);
  const workMinutes = Math.max(1, estimateValue) * Math.max(1, focusValue);
  const longEvery = Math.max(1, Number(settings.longBreakEvery) || 4);
  let breakMinutes = 0;
  for (let i = 1; i < Math.max(1, estimateValue); i += 1) {
    breakMinutes +=
      i % longEvery === 0
        ? Number(settings.longBreakMinutes) || 15
        : Number(settings.shortBreakMinutes) || 5;
  }
  const blockMinutes = workMinutes + breakMinutes;

  const addSubtask = () => {
    const title = subInput.trim();
    if (title === "") return;
    patch({ subtasks: [...draft.subtasks, { id: newId(), title, done: false }] });
    setSubInput("");
  };

  const submit = async () => {
    if (busy) return;
    const title = String(draft.title ?? "").trim();
    if (title === "") {
      setError(t("task.titleRequired"));
      return;
    }
    if (!draft.dueDate) {
      setError(t("task.dateRequired"));
      return;
    }
    const estimate = intOf(draft.estimate, 1);
    if (estimate === null || estimate < 1 || estimate > 99) {
      setError(t("task.estimateInvalid"));
      return;
    }
    const focusMinutes =
      draft.focusMinutes === null || String(draft.focusMinutes).trim() === ""
        ? null
        : intOf(draft.focusMinutes, null);
    if (focusMinutes !== null && (focusMinutes < 1 || focusMinutes > 180)) {
      setError(t("task.focusInvalid"));
      return;
    }
    const scrapMinutes = intOf(draft.scrapMinutes, 0);
    if (scrapMinutes === null || scrapMinutes < 0 || scrapMinutes > 10080) {
      setError(t("task.scrapInvalid"));
      return;
    }
    const tags = String(draft.tagsText ?? "")
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    if (tags.length > 20 || tags.some((tag) => Array.from(tag).length > 40)) {
      setError(t("task.tooManyTags"));
      return;
    }
    if (draft.subtasks.some((sub) => String(sub.title ?? "").trim() === "")) {
      setError(t("task.subtaskEmpty"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await tryDispatch({
      type: "saveTask",
      task: {
        id: taskId,
        title,
        notes: String(draft.notes ?? ""),
        projectId: draft.projectId ? draft.projectId : null,
        dueDate: draft.dueDate || null,
        reminderTime: draft.reminderTime ? draft.reminderTime : null,
        focusMinutes,
        scrapMinutes,
        priority: Number(draft.priority) || 0,
        estimate,
        tags,
        subtasks: draft.subtasks.map((sub) => ({
          id: sub.id || newId(),
          title: String(sub.title ?? "").trim(),
          done: !!sub.done,
        })),
        repeat: "none",
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      return;
    }
    notify(editing ? t("task.saved") : t("task.created"), "brand");
    onClose?.();
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const result = await tryDispatch({ type: "deleteTask", id: taskId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      return;
    }
    notify(t("task.deleted"), "neutral");
    onClose?.();
  };

  const priorityOptions = PRIORITY_KEYS.map((key, value) => ({
    value: String(value),
    label: t(`task.${key}`),
  }));

  const body = confirmDelete
    ? h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 14 } },
        h(
          "div",
          {
            style: {
              padding: "14px 16px",
              borderRadius: 13,
              background: "var(--tomato-surface-2)",
              color: "var(--tomato-ink-2)",
              fontSize: 13,
              lineHeight: 1.65,
            },
          },
          t("task.deleteBody"),
        ),
        h(
          "div",
          { style: { fontSize: 13.5, color: "var(--tomato-ink)", fontWeight: 550 } },
          draft.title || t("task.untouched"),
        ),
      )
    : h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 16 } },
        h(Field, { label: t("task.title") }, h(Input, {
          value: draft.title,
          onChange: (value) => patch({ title: value }),
          placeholder: t("task.titlePlaceholder"),
          maxLength: 200,
          autoFocus: true,
        })),
        h(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
          h(
            Field,
            { label: t("task.project") },
            h(Select, {
              value: draft.projectId,
              options: [
                { value: "", label: t("task.noProject") },
                ...projects.map((project) => ({ value: project.id, label: project.name })),
              ],
              onChange: (value) => patch({ projectId: value }),
              width: "100%",
            }),
          ),
          h(
            Field,
            { label: t("task.dueDate") },
            h(Input, {
              type: "date",
              value: draft.dueDate,
              onChange: (value) => patch({ dueDate: value }),
            }),
          ),
          h(
            Field,
            { label: t("task.reminder"), hint: t("task.reminderHint") },
            h(Input, {
              type: "time",
              value: draft.reminderTime,
              onChange: (value) => patch({ reminderTime: value }),
            }),
          ),
          h(
            Field,
            {
              label: t("task.focusMinutes"),
              hint: t("task.focusMinutesHint", { n: defaultFocus }),
            },
            h(Input, {
              type: "number",
              value: draft.focusMinutes,
              onChange: (value) => patch({ focusMinutes: value }),
              placeholder: String(defaultFocus),
            }),
          ),
          h(
            Field,
            { label: t("task.estimate"), hint: t("task.estimateHint") },
            h(Input, {
              type: "number",
              value: draft.estimate,
              onChange: (value) => patch({ estimate: value }),
            }),
          ),
          h(
            Field,
            { label: t("task.priority") },
            h(Select, {
              value: String(draft.priority),
              options: priorityOptions,
              onChange: (value) => patch({ priority: Number(value) }),
              width: "100%",
            }),
          ),
          h(
            Field,
            { label: t("task.scrap"), hint: t("task.scrapHint") },
            h(Input, {
              type: "number",
              value: draft.scrapMinutes,
              onChange: (value) => patch({ scrapMinutes: value }),
            }),
          ),
          h(
            Field,
            { label: t("task.tags") },
            h(Input, {
              value: draft.tagsText,
              onChange: (value) => patch({ tagsText: value }),
              placeholder: t("task.tagsPlaceholder"),
            }),
          ),
        ),
        h(
          "div",
          {
            style: { fontSize: 12, color: "var(--tomato-ink-3)", display: "flex", alignItems: "center", gap: 6 },
          },
          h(Icon, { name: "timer", size: 14 }),
          t("task.focusPreview", { n: workMinutes, m: blockMinutes }),
        ),
        h(Field, { label: t("task.notes") }, h(TextArea, {
          value: draft.notes,
          onChange: (value) => patch({ notes: value }),
          placeholder: t("task.notesPlaceholder"),
          rows: 3,
          style: { maxHeight: 160 },
        })),
        h(Divider, null),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 8 } },
          h(
            "div",
            { style: { fontSize: 12, fontWeight: 550, color: "var(--tomato-ink-2)" } },
            t("task.subtasks"),
          ),
          draft.subtasks.length > 0
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 4 } },
                draft.subtasks.map((sub, index) =>
                  h(
                    "div",
                    {
                      key: sub.id ?? index,
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        minHeight: 32,
                        padding: "2px 4px",
                        borderRadius: 9,
                      },
                    },
                    h(Check, {
                      checked: sub.done,
                      label: sub.title || t("task.untouched"),
                      onChange: (checked) =>
                        patch({
                          subtasks: draft.subtasks.map((item, i) =>
                            i === index ? { ...item, done: checked } : item,
                          ),
                        }),
                    }),
                    h(
                      "div",
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                          fontSize: 13,
                          color: sub.done ? "var(--tomato-ink-3)" : "var(--tomato-ink)",
                          textDecoration: sub.done ? "line-through" : "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      },
                      sub.title,
                    ),
                    h(IconBtn, {
                      name: "x",
                      size: 14,
                      box: 28,
                      title: t("task.removeSubtask"),
                      onClick: () =>
                        patch({ subtasks: draft.subtasks.filter((_, i) => i !== index) }),
                    }),
                  ),
                ),
              )
            : h(
                "div",
                { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
                t("task.subtaskPlaceholder"),
              ),
          h(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            h(Input, {
              value: subInput,
              onChange: setSubInput,
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSubtask();
                }
              },
              placeholder: t("task.subtaskPlaceholder"),
              maxLength: 200,
              inputRef: subInputRef,
            }),
            h(Btn, {
              variant: "soft",
              size: "sm",
              icon: "plus",
              title: t("task.addSubtask"),
              onClick: addSubtask,
            }),
          ),
        ),
        error
          ? h(
              "div",
              {
                style: {
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--tomato-brand-soft)",
                  color: "var(--tomato-brand-deep)",
                  fontSize: 12.5,
                },
                role: "alert",
              },
              error,
            )
          : null,
      );

  const footer = confirmDelete
    ? h(
        "div",
        { style: { display: "flex", gap: 9, marginLeft: "auto" } },
        h(Btn, {
          variant: "ghost",
          size: "sm",
          onClick: () => setConfirmDelete(false),
          disabled: busy,
        }, t("common.cancel")),
        h(Btn, {
          variant: "danger",
          size: "sm",
          icon: "trash",
          onClick: remove,
          disabled: busy,
        }, t("task.deleteConfirm")),
      )
    : h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 9, width: "100%" } },
        editing
          ? h(Btn, {
              variant: "danger",
              size: "sm",
              icon: "trash",
              onClick: () => setConfirmDelete(true),
              disabled: busy,
            }, t("common.delete"))
          : null,
        h("div", { style: { flex: 1 } }),
        h(Btn, { variant: "plain", size: "sm", onClick: onClose, disabled: busy }, t("common.cancel")),
        h(Btn, {
          variant: "primary",
          size: "sm",
          icon: "check",
          onClick: submit,
          disabled: busy,
        }, editing ? t("common.save") : t("common.add")),
      );

  return h(Modal, {
    open,
    onClose: () => {
      if (!busy) onClose?.();
    },
    icon: confirmDelete ? "trash" : editing ? "edit" : "plus",
    title: confirmDelete ? t("task.deleteTitle") : editing ? t("task.editTitle") : t("task.newTitle"),
    subtitle: confirmDelete ? undefined : editing ? t("task.editSubtitle") : t("task.newSubtitle"),
    width: 620,
    footer,
  }, body);
}
