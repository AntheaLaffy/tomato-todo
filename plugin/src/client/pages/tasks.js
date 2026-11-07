// 全部任务：工具条 + 全局排序的清单 + 只读模板视图 + 底部内联添加。
// 项目由工具条筛选，每条任务的元信息仍显示所属项目。
//
// 写操作全部走 tryDispatch（永不抛）；批量操作逐个提交而不是伪造批量 Action，
// 因为 core 的 saveTask/deleteTask 才是唯一权威，失败时停在第一个错误上并说明。
// 模板 tab 的编辑/印刷/同步接在 template-dialog.js 与 print-dialog.js：列表只负责
// 展示规则摘要与行内入口，表单语义与 Action 字段都在对话框里，避免两处漂移。
import { h, Fragment, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import {
  Btn,
  Card,
  Check,
  Chip,
  Dot,
  Dropdown,
  Empty,
  IconBtn,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  notify,
} from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import {
  addDays,
  dayLabel,
  fmtMinutes,
  isCatchUp,
  isOverdue,
  projectColor,
  projectById,
  taskById,
  taskRounds,
  timerView,
  todayKey,
} from "../shared/derive.js";
import { registerPage } from "../app/registry.js";
import { subscribeTasksFilter, takeTasksFilter } from "../app/navigation.js";
import { openImmersive } from "../app/immersive.js";
import { TaskDialog } from "./task-dialog.js";
import { TemplateDialog } from "./template-dialog.js";
import { PrintDialog } from "./print-dialog.js";
import { SearchDialog, useSearchHotkey } from "./search.js";

registerCopy("tasks", {
  zh: {
    eyebrow: "全部任务",
    headline: "把想做的事，慢慢完成。",
    countLine: "还有 {n} 件事等着你。",
    loadingTasks: "正在读取任务…",
    loadingHint: "等运行时连上就会显示任务；不会显示假数据。",
    newTask: "新建任务",
    searchPlaceholder: "搜索标题、标签或备注",
    clearSearch: "清空搜索",
    allProjects: "全部项目",
    noProject: "未分类",
    inbox: "收件箱",
    allPriorities: "全部优先级",
    priorityHigh: "高",
    priorityMedium: "中",
    priorityLow: "低",
    priorityNone: "无",
    sortTime: "按时间",
    sortPriority: "优先级",
    sortCreated: "创建顺序",
    tabActive: "待完成",
    tabCompleted: "已完成",
    tabAll: "全部",
    tabTemplates: "模板",
    selectMode: "选择",
    selectDone: "完成选择",
    batchSelected: "已选 {n} 项",
    batchComplete: "完成",
    batchMove: "移动",
    batchDelete: "删除",
    batchCancel: "取消",
    batchDeleteTitle: "删除选中的任务？",
    batchDeleteBody: "选中的 {n} 个任务会被移除，已有专注记录会保留在统计里。",
    batchDeleted: "已删除 {n} 个任务",
    batchCompleted: "已完成 {n} 个任务",
    batchMoved: "已移动 {n} 个任务",
    moveTitle: "移动到哪一天？",
    moveHint: "选中的任务会保留标题、项目、提醒与专注设置，只改计划日期。",
    moveDate: "新的计划日期",
    moveConfirm: "移动",
    moveFailed: "移动失败：{error}",
    deleteTitle: "删除这个任务？",
    deleteBody: "专注记录会保留在统计里；这一步不能撤销。",
    deleteConfirm: "确认删除",
    deleted: "任务已删除",
    perSession: "{n} 分钟/次",
    overdue: "已逾期",
    catchUp: "待补",
    habitKind: "习惯",
    startFocus: "开始专注",
    focusOn: "专注于 {title}",
    pauseFocus: "暂停专注",
    moreActions: "更多操作",
    timerBusy: "请先结束当前计时",
    selectTask: "选择任务 {title}",
    completeTask: "完成任务 {title}",
    reopenTask: "重新打开任务 {title}",
    untitled: "未命名任务",
    addPlaceholder: "添加一个想完成的任务",
    addSubmit: "添加",
    fullEdit: "完整编辑",
    added: "任务已添加",
    templateUnnamed: "未命名模板",
    printingOnce: "单次 · {date}{time}",
    printingCalendar: "日历 · {n} 个时段",
    printingWeekly: "每周 · {n} 个时段",
    printingNone: "还没有印刷规则",
    printingNoDate: "未定",
    printingTimes: " · {times}",
    autoPrint: "自动印刷",
    manualPrint: "手动",
    printAhead: "提前 {n} 天",
    templateEstimate: "预计 {n} 个番茄",
    templateFocus: "每次 {minutes}",
    templateDefaultFocus: "每次 {minutes}（默认）",
    templatesHint:
      "模板保留形状与印刷规则；印刷生成的实例之后与模板互不覆盖，需要时手动同步。",
    templatesTitle: "模板与印刷",
    newTemplate: "新建模板",
    editTemplate: "编辑模板",
    printTemplateAction: "印刷模板",
    syncTemplate: "同步形状到未完成实例",
    templateSynced: "模板形状已同步到未完成实例",
    syncingTemplate: "同步中…",
    emptyActive: "还没有任务，先加一件吧",
    emptyActiveHint: "写下想做的事，把第一步留给现在。",
    emptyCompleted: "每一次完成，都值得被记录",
    emptyCompletedHint: "完成的任务会出现在这里。",
    emptyAll: "还没有任务",
    emptyAllHint: "写下想做的事，把第一步留给现在。",
    emptySearch: "没有找到匹配的任务",
    emptySearchHint: "试试其他关键词，或清空筛选。",
    emptyTemplates: "还没有模板",
    emptyTemplatesHint: "模板保留形状，实例记录每一次执行。",
  },
  en: {
    eyebrow: "ALL TASKS",
    headline: "Finish things, little by little.",
    countLine: "{n} things still waiting for you.",
    loadingTasks: "Reading tasks…",
    loadingHint: "Tasks show up once the runtime is back; nothing is faked.",
    newTask: "New task",
    searchPlaceholder: "Search titles, tags or notes",
    clearSearch: "Clear search",
    allProjects: "All projects",
    noProject: "No project",
    inbox: "Inbox",
    allPriorities: "All priorities",
    priorityHigh: "High",
    priorityMedium: "Medium",
    priorityLow: "Low",
    priorityNone: "None",
    sortTime: "By date",
    sortPriority: "Priority",
    sortCreated: "Created",
    tabActive: "To do",
    tabCompleted: "Done",
    tabAll: "All",
    tabTemplates: "Templates",
    selectMode: "Select",
    selectDone: "Done selecting",
    batchSelected: "{n} selected",
    batchComplete: "Complete",
    batchMove: "Move",
    batchDelete: "Delete",
    batchCancel: "Cancel",
    batchDeleteTitle: "Delete selected tasks?",
    batchDeleteBody:
      "The {n} selected tasks will be removed; focus history stays in stats.",
    batchDeleted: "Deleted {n} tasks",
    batchCompleted: "Completed {n} tasks",
    batchMoved: "Moved {n} tasks",
    moveTitle: "Move to which day?",
    moveHint:
      "Selected tasks keep their title, project, reminder and focus settings; only the planned date changes.",
    moveDate: "New planned date",
    moveConfirm: "Move",
    moveFailed: "Couldn't move: {error}",
    deleteTitle: "Delete this task?",
    deleteBody: "Focus history stays in stats. This cannot be undone.",
    deleteConfirm: "Delete",
    deleted: "Task deleted",
    perSession: "{n} min per session",
    overdue: "Overdue",
    catchUp: "Catch up",
    habitKind: "Habit",
    startFocus: "Start focus",
    focusOn: "Focus on {title}",
    pauseFocus: "Pause focus",
    moreActions: "More actions",
    timerBusy: "Finish the current timer first",
    selectTask: "Select {title}",
    completeTask: "Complete {title}",
    reopenTask: "Reopen {title}",
    untitled: "Untitled task",
    addPlaceholder: "Add something you want to finish",
    addSubmit: "Add",
    fullEdit: "Full edit",
    added: "Task added",
    templateUnnamed: "Untitled template",
    printingOnce: "Once · {date}{time}",
    printingCalendar: "Calendar · {n} slots",
    printingWeekly: "Weekly · {n} slots",
    printingNone: "No printing rule yet",
    printingNoDate: "Unscheduled",
    printingTimes: " · {times}",
    autoPrint: "Auto print",
    manualPrint: "Manual",
    printAhead: "{n} days ahead",
    templateEstimate: "{n} pomodoros planned",
    templateFocus: "{minutes} per session",
    templateDefaultFocus: "{minutes} per session (default)",
    templatesHint:
      "Templates keep the shape and the printing rule; printed instances stay decoupled, sync them when needed.",
    templatesTitle: "Templates & printing",
    newTemplate: "New template",
    editTemplate: "Edit template",
    printTemplateAction: "Print template",
    syncTemplate: "Sync shape to unfinished instances",
    templateSynced: "Template shape synced to unfinished instances",
    syncingTemplate: "Syncing…",
    emptyActive: "No tasks yet — add one",
    emptyActiveHint: "Write down one thing and start with the first step.",
    emptyCompleted: "Every finish is worth keeping",
    emptyCompletedHint: "Completed tasks show up here.",
    emptyAll: "No tasks yet",
    emptyAllHint: "Write down one thing and start with the first step.",
    emptySearch: "No matching tasks",
    emptySearchHint: "Try another keyword, or clear the filters.",
    emptyTemplates: "No templates yet",
    emptyTemplatesHint: "Templates keep the shape; instances record each run.",
  },
});

const PRIORITY_KEYS = [
  "priorityNone",
  "priorityLow",
  "priorityMedium",
  "priorityHigh",
];

/** 优先级容错：旧数据可能缺字段或给字符串。 */
function priorityOf(task) {
  const n = Number(task && task.priority);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.trunc(n))) : 0;
}

/** 搜索命中：标题、备注、标签，大小写不敏感。 */
function matchesQuery(task, query) {
  if (query === "") return true;
  const tags = Array.isArray(task.tags) ? task.tags.join(" ") : "";
  const haystack =
    `${task.title ?? ""} ${task.notes ?? ""} ${tags}`.toLowerCase();
  return haystack.includes(query);
}

/** 时间排序的空值兜底：没有日期的排最后，没有提醒时刻的排当天最后。 */
const NO_DATE = "9999-12-31";
const NO_TIME = "99:99";

function compareByTime(a, b) {
  return (
    String(a.dueDate || NO_DATE).localeCompare(String(b.dueDate || NO_DATE)) ||
    String(a.reminderTime || NO_TIME).localeCompare(
      String(b.reminderTime || NO_TIME),
    ) ||
    (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)
  );
}

/** 排序：time = 到期日升序 + 提醒时刻；priority = 优先级降序 + 到期日；created = 新→旧。
 *  导出给项目页复用，避免两处对同一批任务给出不同顺序。 */
export function sortTasks(tasks, sort) {
  const items = tasks.slice();
  items.sort((a, b) => {
    if (sort === "priority") {
      const byPriority = priorityOf(b) - priorityOf(a);
      if (byPriority !== 0) return byPriority;
      return compareByTime(a, b);
    }
    if (sort === "created") {
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    }
    return compareByTime(a, b);
  });
  return items;
}

/** 模板印刷规则的人读摘要；缺字段时按「没有规则」处理，不让脏数据崩页面。 */
function printingSummary(template, today) {
  const rule = template && template.printing;
  if (!rule || !rule.kind) return t("tasks.printingNone");
  if (rule.kind === "once") {
    const date = rule.date ? dayLabel(rule.date, today) : "";
    const time = rule.time ? ` ${rule.time}` : "";
    return t("tasks.printingOnce", {
      date: date || t("tasks.printingNoDate"),
      time,
    });
  }
  if (rule.kind === "calendar") {
    const slots = Array.isArray(rule.slots) ? rule.slots : [];
    const n = slots.reduce(
      (sum, slot) => sum + (Array.isArray(slot.dates) ? slot.dates.length : 0),
      0,
    );
    return t("tasks.printingCalendar", { n });
  }
  if (rule.kind === "weekly") {
    const slots = Array.isArray(rule.slots) ? rule.slots : [];
    const times = Array.from(
      new Set(slots.map((slot) => slot.time).filter(Boolean)),
    );
    const summary = t("tasks.printingWeekly", { n: slots.length });
    return times.length > 0
      ? `${summary}${t("tasks.printingTimes", { times: times.join(" / ") })}`
      : summary;
  }
  return t("tasks.printingNone");
}

/** 编辑/移动共用的完整 TaskDraft：复制原字段，只改 patch 里的项。 */
function taskDraft(task, patch) {
  return {
    id: task.id,
    title: task.title ?? "",
    notes: task.notes ?? "",
    projectId: task.projectId ?? null,
    dueDate: task.dueDate ?? null,
    reminderTime: task.reminderTime ?? null,
    focusMinutes: task.focusMinutes ?? null,
    scrapMinutes: Number(task.scrapMinutes) || 0,
    priority: priorityOf(task),
    estimate: Math.max(1, Number(task.estimate) || 1),
    tags: Array.isArray(task.tags) ? task.tags.slice() : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((sub) => ({
          id: sub.id,
          title: sub.title,
          done: !!sub.done,
        }))
      : [],
    ...patch,
    repeat: "none",
  };
}

// ---------------------------------------------------------------- 统计条

function SummaryStrip({ counts }) {
  const items = [
    {
      key: "all",
      icon: "tasks",
      label: t("tasks.tabAll"),
      n: counts.all,
      tone: "neutral",
    },
    {
      key: "active",
      icon: "clock",
      label: t("tasks.tabActive"),
      n: counts.active,
      tone: "brand",
    },
    {
      key: "completed",
      icon: "check",
      label: t("tasks.tabCompleted"),
      n: counts.completed,
      tone: "leaf",
    },
    {
      key: "templates",
      icon: "sparkle",
      label: t("tasks.tabTemplates"),
      n: counts.templates,
      tone: "neutral",
    },
  ];
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      },
    },
    items.map((item) =>
      h(
        Chip,
        {
          key: item.key,
          tone: item.tone,
          icon: item.icon,
          style: { height: 24, padding: "0 10px", fontSize: 12 },
        },
        `${item.label} ${t("common.tasksCount", { n: item.n })}`,
      ),
    ),
  );
}

// ---------------------------------------------------------------- 工具条

function Toolbar({
  tab,
  onTab,
  counts,
  query,
  onQuery,
  projectId,
  onProjectId,
  projects,
  priority,
  onPriority,
  sort,
  onSort,
  selecting,
  onToggleSelecting,
}) {
  const tabItems = [
    { value: "active", label: `${t("tasks.tabActive")} ${counts.active}` },
    {
      value: "completed",
      label: `${t("tasks.tabCompleted")} ${counts.completed}`,
    },
    { value: "all", label: `${t("tasks.tabAll")} ${counts.all}` },
    {
      value: "templates",
      label: `${t("tasks.tabTemplates")} ${counts.templates}`,
    },
  ];
  const projectOptions = [
    { value: "all", label: t("tasks.allProjects") },
    { value: "none", label: t("tasks.noProject") },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  const priorityOptions = [
    { value: "all", label: t("tasks.allPriorities") },
    ...["priorityHigh", "priorityMedium", "priorityLow", "priorityNone"].map(
      (key, index) => ({
        value: String(3 - index),
        label: t(`tasks.${key}`),
      }),
    ),
  ];
  const sortOptions = [
    { value: "time", label: t("tasks.sortTime") },
    { value: "priority", label: t("tasks.sortPriority") },
    { value: "created", label: t("tasks.sortCreated") },
  ];
  return h(
    Card,
    { pad: 14, style: { marginBottom: 14 } },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
      },
      h(Segmented, { items: tabItems, value: tab, onChange: onTab }),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flex: "1 1 420px",
            minWidth: 0,
          },
        },
        h(
          "div",
          {
            style: {
              position: "relative",
              display: "flex",
              alignItems: "center",
              flex: "0 1 220px",
              minWidth: 150,
            },
          },
          h(Icon, {
            name: "search",
            size: 15,
            style: {
              position: "absolute",
              left: 11,
              color: "var(--tomato-ink-3)",
              pointerEvents: "none",
            },
          }),
          h(Input, {
            value: query,
            onChange: onQuery,
            placeholder: t("tasks.searchPlaceholder"),
            style: { paddingLeft: 33, height: 32, fontSize: 12.5 },
            maxLength: 120,
          }),
          query !== ""
            ? h(IconBtn, {
                name: "x",
                size: 13,
                box: 24,
                title: t("tasks.clearSearch"),
                onClick: () => onQuery(""),
                style: { position: "absolute", right: 6 },
              })
            : null,
        ),
        h(Select, {
          value: projectId,
          options: projectOptions,
          onChange: onProjectId,
          width: 132,
        }),
        h(Select, {
          value: priority,
          options: priorityOptions,
          onChange: onPriority,
          width: 118,
        }),
        h(Select, {
          value: sort,
          options: sortOptions,
          onChange: onSort,
          width: 118,
        }),
        h(
          Btn,
          {
            variant: "ghost",
            size: "sm",
            icon: "filter",
            onClick: onToggleSelecting,
            style: { height: 32 },
          },
          selecting ? t("tasks.selectDone") : t("tasks.selectMode"),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------- 批量操作条

function BatchBar({ count, busy, onComplete, onMove, onDelete, onCancel }) {
  return h(
    Card,
    {
      flat: true,
      pad: "10px 12px",
      style: {
        marginBottom: 12,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        background: "var(--tomato-brand-soft)",
        borderColor: "transparent",
      },
    },
    h(
      "span",
      {
        style: {
          fontSize: 12.5,
          fontWeight: 620,
          color: "var(--tomato-brand-deep)",
        },
      },
      t("tasks.batchSelected", { n: count }),
    ),
    h("span", { style: { flex: 1 } }),
    h(
      Btn,
      {
        variant: "soft",
        size: "sm",
        icon: "check",
        onClick: onComplete,
        disabled: busy || count === 0,
      },
      t("tasks.batchComplete"),
    ),
    h(
      Btn,
      {
        variant: "soft",
        size: "sm",
        icon: "calendar",
        onClick: onMove,
        disabled: busy || count === 0,
      },
      t("tasks.batchMove"),
    ),
    h(
      Btn,
      {
        variant: "danger",
        size: "sm",
        icon: "trash",
        onClick: onDelete,
        disabled: busy || count === 0,
      },
      t("tasks.batchDelete"),
    ),
    h(
      Btn,
      { variant: "plain", size: "sm", onClick: onCancel, disabled: busy },
      t("tasks.batchCancel"),
    ),
  );
}

// ---------------------------------------------------------------- 任务行

const META_ITEM = { display: "inline-flex", alignItems: "center", gap: 4 };

function TaskRow({
  task,
  today,
  data,
  timer,
  picked,
  selecting,
  last,
  onPick,
  onToggle,
  onEdit,
  onPlay,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const completed = !!task.completed;
  const estimate = Math.max(1, Number(task.estimate) || 1);
  const rounds = taskRounds(data, task.id);
  const achieved = rounds >= estimate;
  const project = projectById(data, task.projectId);
  const overdue = isOverdue(task, today);
  const catchUp = isCatchUp(data, task, today);
  const isHabit = !!(data.taskKinds && data.taskKinds[task.id] === "habit");
  const running = !!timer.running && timer.taskId === task.id;
  const isPicked = Array.isArray(picked) && picked.includes(task.id);
  const displayTitle = task.title || t("tasks.untitled");
  const tags = Array.isArray(task.tags) ? task.tags.slice(0, 2) : [];
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const subtaskDone = subtasks.filter((sub) => sub.done).length;

  const menuItems = [
    {
      id: "edit",
      label: t("common.edit"),
      icon: "edit",
      onClick: () => onEdit(task),
    },
    ...(completed
      ? []
      : [
          {
            id: "focus",
            label: t("tasks.startFocus"),
            icon: "focus",
            onClick: () => onPlay(task),
          },
        ]),
    { divider: true },
    {
      id: "delete",
      label: t("common.delete"),
      icon: "trash",
      danger: true,
      onClick: () => onDelete(task),
    },
  ];

  const meta = h(
    "span",
    {
      style: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "4px 10px",
        marginTop: 3,
        fontSize: 11.5,
        lineHeight: 1.5,
        color: "var(--tomato-ink-3)",
      },
    },
    isHabit
      ? h(
          Chip,
          { tone: "leaf", icon: "habit", style: { height: 19, fontSize: 11 } },
          t("tasks.habitKind"),
        )
      : null,
    task.reminderTime
      ? h(
          "span",
          { style: META_ITEM },
          h(Icon, { name: "clock", size: 12 }),
          task.reminderTime,
        )
      : null,
    task.focusMinutes != null
      ? h(
          "span",
          { style: META_ITEM },
          t("tasks.perSession", { n: task.focusMinutes }),
        )
      : null,
    project
      ? h(
          "span",
          { style: META_ITEM },
          h(Dot, { color: projectColor(data, project.id), size: 6 }),
          project.name,
        )
      : null,
    task.dueDate
      ? h(
          "span",
          { style: META_ITEM },
          h(Icon, { name: "calendar", size: 12 }),
          dayLabel(task.dueDate, today),
        )
      : null,
    overdue ? h(Chip, { tone: "danger" }, t("tasks.overdue")) : null,
    catchUp ? h(Chip, { tone: "sun" }, t("tasks.catchUp")) : null,
    subtasks.length > 0
      ? h(
          "span",
          { style: META_ITEM },
          h(Icon, { name: "check", size: 12 }),
          `${subtaskDone}/${subtasks.length}`,
        )
      : null,
    tags.map((tag, index) =>
      h(
        Chip,
        {
          key: `tag-${index}`,
          tone: "neutral",
          style: { height: 19, fontSize: 11, maxWidth: 140 },
        },
        `#${tag}`,
      ),
    ),
  );

  const body = h(
    "button",
    {
      type: "button",
      onClick: selecting ? undefined : () => onEdit(task),
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: 0,
        border: "none",
        background: "transparent",
        fontFamily: "inherit",
        textAlign: "left",
        color: "inherit",
        cursor: selecting ? "default" : "pointer",
      },
    },
    h(
      "span",
      {
        style: {
          maxWidth: "100%",
          fontSize: 13.5,
          fontWeight: completed ? 450 : 560,
          color: completed ? "var(--tomato-ink-3)" : "var(--tomato-ink)",
          textDecoration: completed ? "line-through" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      displayTitle,
    ),
    meta,
  );

  const trailing = h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 4, flex: "none" } },
    h(
      "span",
      {
        className: "t-mono",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: achieved ? "var(--tomato-leaf)" : "var(--tomato-ink-3)",
        },
      },
      h(Icon, { name: "tomato", size: 13 }),
      `${rounds}/${estimate}`,
    ),
    !completed && !selecting
      ? h(IconBtn, {
          name: running ? "pause" : "play",
          size: 16,
          box: 32,
          title: running
            ? t("tasks.pauseFocus")
            : t("tasks.focusOn", { title: displayTitle }),
          onClick: () => onPlay(task),
        })
      : null,
    !selecting
      ? h(
          "div",
          { style: { position: "relative" } },
          h(IconBtn, {
            name: "more",
            size: 16,
            box: 32,
            title: t("tasks.moreActions"),
            onClick: () => setMenuOpen((open) => !open),
          }),
          h(Dropdown, {
            open: menuOpen,
            items: menuItems,
            onClose: () => setMenuOpen(false),
            align: "right",
            width: 180,
          }),
        )
      : null,
  );

  return h(
    "div",
    {
      className: "t-row",
      onClick: selecting ? () => onPick(task) : undefined,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        minHeight: 56,
        padding: "7px 8px",
        borderRadius: 12,
        ...(isPicked ? { background: "var(--tomato-brand-soft)" } : {}),
        cursor: selecting ? "pointer" : undefined,
        borderBottom: last ? "none" : "1px solid var(--tomato-line)",
      },
    },
    h(Check, {
      checked: selecting ? isPicked : completed,
      label: selecting
        ? t("tasks.selectTask", { title: displayTitle })
        : completed
          ? t("tasks.reopenTask", { title: displayTitle })
          : t("tasks.completeTask", { title: displayTitle }),
      onChange: () => (selecting ? onPick(task) : onToggle(task)),
    }),
    body,
    trailing,
  );
}

// ---------------------------------------------------------------- 模板视图

function TemplateList({
  templates,
  today,
  data,
  defaultFocus,
  onNew,
  onEdit,
  onPrint,
  onSync,
  syncingId,
}) {
  const hint = h(
    "div",
    {
      style: {
        padding: "10px 10px 2px",
        fontSize: 11.5,
        lineHeight: 1.6,
        color: "var(--tomato-ink-3)",
      },
    },
    t("tasks.templatesHint"),
  );
  const header = h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "2px 10px 10px",
        flexWrap: "wrap",
      },
    },
    h(Icon, {
      name: "sparkle",
      size: 16,
      style: { color: "var(--tomato-brand-deep)" },
    }),
    h(
      "div",
      {
        style: {
          fontSize: 13,
          fontWeight: 620,
          color: "var(--tomato-ink)",
          flex: 1,
          minWidth: 0,
        },
      },
      t("tasks.templatesTitle"),
    ),
    h(
      Btn,
      {
        variant: "soft",
        size: "sm",
        icon: "plus",
        onClick: onNew,
        disabled: !onNew,
      },
      t("tasks.newTemplate"),
    ),
  );
  if (templates.length === 0) {
    return h(
      "div",
      null,
      h(Empty, {
        icon: "calendar",
        title: t("tasks.emptyTemplates"),
        hint: t("tasks.emptyTemplatesHint"),
        action: onNew
          ? h(
              Btn,
              { variant: "primary", size: "sm", icon: "plus", onClick: onNew },
              t("tasks.newTemplate"),
            )
          : null,
      }),
      hint,
    );
  }
  return h(
    "div",
    null,
    header,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      templates.map((template, index) => {
        if (!template) return null;
        const shape = template.shape || {};
        const project = projectById(data, shape.projectId);
        const estimate = Math.max(1, Number(shape.estimate) || 1);
        const focus =
          shape.focusMinutes != null ? Number(shape.focusMinutes) : null;
        const tags = Array.isArray(shape.tags) ? shape.tags.slice(0, 4) : [];
        const ahead = Number(template.printAheadDays);
        return h(
          "div",
          {
            key: template.id,
            className: "t-row",
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "12px 10px",
              borderRadius: 12,
              borderBottom:
                index === templates.length - 1
                  ? "none"
                  : "1px solid var(--tomato-line)",
            },
          },
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              },
            },
            h(
              "span",
              {
                style: {
                  minWidth: 0,
                  fontSize: 13.5,
                  fontWeight: 560,
                  color: "var(--tomato-ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              },
              shape.title || t("tasks.templateUnnamed"),
            ),
            h(
              Chip,
              {
                tone: template.automatic ? "brand" : "neutral",
                icon: template.automatic ? "refresh" : "edit",
              },
              template.automatic
                ? t("tasks.autoPrint")
                : t("tasks.manualPrint"),
            ),
            h("div", { style: { flex: 1 } }),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 2 } },
              h(IconBtn, {
                name: "edit",
                size: 16,
                box: 30,
                title: t("tasks.editTemplate"),
                onClick: () => onEdit?.(template),
              }),
              h(IconBtn, {
                name: "play",
                size: 16,
                box: 30,
                title: t("tasks.printTemplateAction"),
                onClick: () => onPrint?.(template),
              }),
              h(IconBtn, {
                name: "refresh",
                size: 16,
                box: 30,
                title:
                  syncingId === template.id
                    ? t("tasks.syncingTemplate")
                    : t("tasks.syncTemplate"),
                disabled: syncingId !== null,
                onClick: () => onSync?.(template),
              }),
            ),
          ),
          h(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "4px 10px",
                fontSize: 11.5,
                lineHeight: 1.5,
                color: "var(--tomato-ink-3)",
              },
            },
            project
              ? h(
                  "span",
                  { style: META_ITEM },
                  h(Dot, { color: projectColor(data, project.id), size: 6 }),
                  project.name,
                )
              : h(
                  "span",
                  { style: META_ITEM },
                  h(Dot, { color: "var(--tomato-ink-3)", size: 6 }),
                  t("tasks.noProject"),
                ),
            h(
              "span",
              { style: META_ITEM },
              h(Icon, { name: "calendarClock", size: 12 }),
              printingSummary(template, today),
            ),
            Number.isFinite(ahead) && ahead >= 0
              ? h(
                  "span",
                  { style: META_ITEM },
                  t("tasks.printAhead", { n: ahead }),
                )
              : null,
            h(
              "span",
              { style: META_ITEM },
              t("tasks.templateEstimate", { n: estimate }),
            ),
            h(
              "span",
              { style: META_ITEM },
              focus != null && focus > 0
                ? t("tasks.templateFocus", { minutes: fmtMinutes(focus) })
                : t("tasks.templateDefaultFocus", {
                    minutes: fmtMinutes(defaultFocus),
                  }),
            ),
            tags.map((tag, tagIndex) =>
              h(
                Chip,
                {
                  key: `tag-${tagIndex}`,
                  tone: "neutral",
                  style: { height: 19, fontSize: 11 },
                },
                `#${tag}`,
              ),
            ),
          ),
        );
      }),
    ),
    hint,
  );
}

// ---------------------------------------------------------------- 底部添加

function AddBar({ value, onChange, onAdd, onFullEdit, busy }) {
  return h(
    Card,
    {
      flat: true,
      pad: "8px 12px",
      style: {
        marginTop: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      },
    },
    h(Icon, {
      name: "plus",
      size: 17,
      style: { color: "var(--tomato-brand)" },
    }),
    h(Input, {
      value,
      onChange,
      onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onAdd();
        }
      },
      placeholder: t("tasks.addPlaceholder"),
      maxLength: 200,
      style: { flex: "1 1 240px", minWidth: 160, height: 36 },
    }),
    h(
      Btn,
      {
        variant: "soft",
        size: "sm",
        icon: "plus",
        onClick: onAdd,
        disabled: busy || value.trim() === "",
      },
      t("tasks.addSubmit"),
    ),
    h(
      Btn,
      { variant: "plain", size: "sm", icon: "edit", onClick: onFullEdit },
      t("tasks.fullEdit"),
    ),
  );
}

// ---------------------------------------------------------------- 页面

function TasksPage() {
  const state = useSnapshot();
  const [tab, setTab] = useState("active");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("time");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [editor, setEditor] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [templateEditor, setTemplateEditor] = useState(null);
  const [printDialog, setPrintDialog] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

  useSearchHotkey(() => setSearchOpen(true));

  // 侧栏「我的项目」点了某个项目：挂载时取走挂起的筛选值，之后订阅继续响应
  // （已经在本页时 setActivePageId 不会重挂，所以要订阅而不是只读一次）。
  useEffect(() => {
    const apply = (value) => {
      if (value === undefined) return;
      setProjectId(value === null ? "all" : value);
      setTab("active");
    };
    apply(takeTasksFilter());
    return subscribeTasksFilter(apply);
  }, []);

  const data = (state && state.data) || {};
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const templates = Array.isArray(data.templates) ? data.templates : [];
  const settings = data.settings || {};
  const today = (state && state.today) || todayKey(state && state.serverTime);
  // derive 的待补判定读 data.taskKinds，而快照把 taskKinds 放在 state 顶层。
  const viewData = { ...data, taskKinds: (state && state.taskKinds) || {} };
  const timer = timerView(state);
  const defaultFocus = Math.max(1, Number(settings.focusMinutes) || 45);

  const counts = {
    all: tasks.length,
    active: tasks.filter((task) => !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
    templates: templates.length,
  };

  const normalizedQuery = query.trim().toLowerCase();
  const knownProject = new Set(projects.map((project) => project.id));
  const visible = sortTasks(
    tasks.filter((task) => {
      if (tab === "completed" && !task.completed) return false;
      if (tab === "active" && task.completed) return false;
      if (projectId === "none") {
        if (task.projectId && knownProject.has(task.projectId)) return false;
      } else if (projectId !== "all" && task.projectId !== projectId) {
        return false;
      }
      if (priority !== "all" && priorityOf(task) !== Number(priority))
        return false;
      return matchesQuery(task, normalizedQuery);
    }),
    sort,
  );
  const editingTask = editor && editor.id ? taskById(data, editor.id) : null;
  const dialogOpen = !!editor && (!editor.id || !!editingTask);
  const editingTemplate =
    templateEditor && templateEditor.id
      ? templates.find(
          (template) => template && template.id === templateEditor.id,
        ) || null
      : null;
  const templateDialogOpen =
    !!templateEditor && (!templateEditor.id || !!editingTemplate);
  const prints = Array.isArray(data.prints) ? data.prints : [];

  const showToastError = (error) =>
    notify(error || t("common.writeFailed"), "danger");

  const changeTab = (next) => {
    setTab(next);
    if (next === "templates") {
      setPicked([]);
      setSelecting(false);
    }
  };

  const toggleSelecting = () => {
    if (selecting) {
      setPicked([]);
      setSelecting(false);
    } else {
      setSelecting(true);
    }
  };

  const pickTask = (task) => {
    setPicked((current) =>
      current.includes(task.id)
        ? current.filter((id) => id !== task.id)
        : [...current, task.id],
    );
  };

  const toggleComplete = async (task) => {
    const result = await tryDispatch({ type: "toggleTask", id: task.id });
    if (!result.ok) showToastError(result.error);
  };

  // 播放语义与今日页一致：同任务在跑就暂停；计时器忙就拒绝；否则三步开始。
  const playTask = async (task) => {
    if (!task || task.completed) return;
    if (timer.running && timer.taskId === task.id) {
      const result = await tryDispatch({ type: "pauseTimer" });
      if (!result.ok) showToastError(result.error);
      return;
    }
    if (timer.running || timer.remainingSecs < timer.totalSecs) {
      notify(t("tasks.timerBusy"), "brand");
      return;
    }
    const steps = [
      { type: "selectTask", id: task.id },
      { type: "setMode", mode: "focus" },
      { type: "startTimer" },
    ];
    for (const action of steps) {
      const result = await tryDispatch(action);
      if (!result.ok) {
        showToastError(result.error);
        return;
      }
    }
    // 只有用户主动开始才进沉浸；轮询不会自动弹（与今日专注页一致）。
    openImmersive();
  };

  const clearSelection = () => {
    setPicked([]);
    setSelecting(false);
  };

  const runBatchComplete = async () => {
    if (batchBusy) return;
    const targets = tasks.filter(
      (task) => picked.includes(task.id) && !task.completed,
    );
    if (targets.length === 0) {
      clearSelection();
      return;
    }
    setBatchBusy(true);
    let failure = null;
    for (const task of targets) {
      const result = await tryDispatch({ type: "toggleTask", id: task.id });
      if (!result.ok) {
        failure = result.error;
        break;
      }
    }
    setBatchBusy(false);
    if (failure) {
      showToastError(failure);
      return;
    }
    notify(t("tasks.batchCompleted", { n: targets.length }), "brand");
    clearSelection();
  };

  const requestDelete = (task) => {
    setPendingDelete({ ids: [task.id], batch: false });
  };

  const requestBatchDelete = () => {
    if (picked.length === 0) return;
    setPendingDelete({ ids: picked.slice(), batch: true });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || batchBusy) return;
    const ids = pendingDelete.ids;
    const batch = pendingDelete.batch;
    setBatchBusy(true);
    let failure = null;
    for (const id of ids) {
      const result = await tryDispatch({ type: "deleteTask", id });
      if (!result.ok) {
        failure = result.error;
        break;
      }
    }
    setBatchBusy(false);
    if (failure) {
      showToastError(failure);
      return;
    }
    setPendingDelete(null);
    if (batch) {
      clearSelection();
      notify(t("tasks.batchDeleted", { n: ids.length }), "neutral");
    } else {
      setPicked((current) => current.filter((id) => !ids.includes(id)));
      notify(t("tasks.deleted"), "neutral");
    }
  };

  const openMove = () => {
    if (picked.length === 0) return;
    setMoveDate(addDays(today, 1));
    setMoveOpen(true);
  };

  const runBatchMove = async () => {
    if (batchBusy || !moveDate) return;
    const targets = tasks.filter((task) => picked.includes(task.id));
    if (targets.length === 0) {
      setMoveOpen(false);
      clearSelection();
      return;
    }
    setBatchBusy(true);
    let failure = null;
    for (const task of targets) {
      const result = await tryDispatch({
        type: "saveTask",
        task: taskDraft(task, { dueDate: moveDate }),
      });
      if (!result.ok) {
        failure = result.error;
        break;
      }
    }
    setBatchBusy(false);
    if (failure) {
      notify(
        t("tasks.moveFailed", { error: failure || t("common.writeFailed") }),
        "danger",
      );
      return;
    }
    setMoveOpen(false);
    notify(t("tasks.batchMoved", { n: targets.length }), "brand");
    clearSelection();
  };

  const addTask = async () => {
    const title = draftTitle.trim();
    if (title === "" || adding) return;
    setAdding(true);
    const result = await tryDispatch({
      type: "saveTask",
      task: {
        id: null,
        title,
        notes: "",
        projectId: null,
        dueDate: today,
        reminderTime: null,
        focusMinutes: null,
        scrapMinutes: 0,
        priority: 0,
        estimate: 1,
        tags: [],
        subtasks: [],
        repeat: "none",
      },
    });
    setAdding(false);
    if (!result.ok) {
      showToastError(result.error);
      return;
    }
    setDraftTitle("");
    notify(t("tasks.added"), "brand");
  };

  const openTemplate = (template) => {
    setTemplateEditor(template && template.id ? { id: template.id } : {});
  };

  const openPrint = (template) => {
    setPrintDialog({
      templateId: template && template.id ? template.id : null,
    });
  };

  const runSyncTemplate = async (template) => {
    if (!template || syncingId !== null) return;
    setSyncingId(template.id);
    const result = await tryDispatch({ type: "syncTemplate", id: template.id });
    setSyncingId(null);
    if (!result.ok) {
      showToastError(result.error);
      return;
    }
    notify(t("tasks.templateSynced"), "brand");
  };

  const header = h(PageHeader, {
    eyebrow: t("tasks.eyebrow"),
    title: t("tasks.headline"),
    subtitle: state
      ? t("tasks.countLine", { n: counts.active })
      : t("common.loading"),
    actions: h(
      Fragment,
      null,
      h(
        Btn,
        {
          variant: "ghost",
          icon: "search",
          onClick: () => setSearchOpen(true),
        },
        t("common.search"),
      ),
      h(
        Btn,
        { variant: "primary", icon: "plus", onClick: () => setEditor({}) },
        t("tasks.newTask"),
      ),
    ),
  });

  // 首次渲染没有快照：给页头 + 骨架，不猜数据；所有 hooks 已在此之上调用完。
  if (!state) {
    return h(
      "div",
      { className: "t-root" },
      header,
      h(
        Card,
        { pad: 24 },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 12 } },
          h(Skeleton, { w: "34%", h: 14 }),
          h(Skeleton, { w: "62%", h: 14 }),
          h(Skeleton, { w: "48%", h: 14 }),
          h(Skeleton, { w: "72%", h: 14 }),
        ),
      ),
      h(
        "div",
        { style: { marginTop: 14 } },
        h(Empty, {
          icon: "tasks",
          title: t("tasks.loadingTasks"),
          hint: t("tasks.loadingHint"),
        }),
      ),
    );
  }

  const emptyProps = normalizedQuery
    ? {
        icon: "search",
        title: t("tasks.emptySearch"),
        hint: t("tasks.emptySearchHint"),
      }
    : tab === "completed"
      ? {
          icon: "check",
          title: t("tasks.emptyCompleted"),
          hint: t("tasks.emptyCompletedHint"),
        }
      : tab === "all"
        ? {
            icon: "tasks",
            title: t("tasks.emptyAll"),
            hint: t("tasks.emptyAllHint"),
          }
        : {
            icon: "leaf",
            title: t("tasks.emptyActive"),
            hint: t("tasks.emptyActiveHint"),
            action: h(
              Btn,
              { variant: "soft", icon: "plus", onClick: () => setEditor({}) },
              t("tasks.newTask"),
            ),
          };

  const rowProps = {
    today,
    data: viewData,
    timer,
    selecting,
    picked,
    onPick: pickTask,
    onToggle: toggleComplete,
    onEdit: (task) => setEditor({ id: task.id }),
    onPlay: playTask,
    onDelete: requestDelete,
  };

  return h(
    "div",
    { className: "t-root" },
    header,
    h(SummaryStrip, { counts }),
    h(Toolbar, {
      tab,
      onTab: changeTab,
      counts,
      query,
      onQuery: setQuery,
      projectId,
      onProjectId: setProjectId,
      projects,
      priority,
      onPriority: setPriority,
      sort,
      onSort: setSort,
      selecting,
      onToggleSelecting: toggleSelecting,
    }),
    selecting
      ? h(BatchBar, {
          count: picked.length,
          busy: batchBusy,
          onComplete: runBatchComplete,
          onMove: openMove,
          onDelete: requestBatchDelete,
          onCancel: clearSelection,
        })
      : null,
    tab === "templates"
      ? h(
          Card,
          { pad: 16 },
          h(TemplateList, {
            templates,
            today,
            data: viewData,
            defaultFocus,
            onNew: () => openTemplate(null),
            onEdit: openTemplate,
            onPrint: openPrint,
            onSync: runSyncTemplate,
            syncingId,
          }),
        )
      : h(
          Card,
          { pad: 12 },
          visible.length === 0
            ? h(Empty, emptyProps)
            : h(
                "div",
                null,
                visible.map((task, index) =>
                  h(TaskRow, {
                    key: task.id,
                    task,
                    last: index === visible.length - 1,
                    ...rowProps,
                  }),
                ),
              ),
        ),
    tab === "templates"
      ? null
      : h(AddBar, {
          value: draftTitle,
          onChange: setDraftTitle,
          onAdd: addTask,
          onFullEdit: () => setEditor({}),
          busy: adding,
        }),
    h(TaskDialog, {
      open: dialogOpen,
      task: editingTask,
      today,
      projects,
      settings,
      initialTitle: editor && editor.title ? editor.title : "",
      onClose: () => setEditor(null),
    }),
    h(TemplateDialog, {
      open: templateDialogOpen,
      template: editingTemplate,
      today,
      data: viewData,
      settings,
      onClose: () => setTemplateEditor(null),
    }),
    h(PrintDialog, {
      open: printDialog !== null,
      templates,
      prints,
      today,
      initialTemplateId: printDialog ? printDialog.templateId : null,
      onClose: () => setPrintDialog(null),
    }),
    h(SearchDialog, {
      open: searchOpen,
      onClose: () => setSearchOpen(false),
      onOpenTask: (id) => setEditor({ id }),
      onCreate: (title) => setEditor({ title }),
    }),
    h(Modal, {
      open: pendingDelete !== null,
      onClose: () => {
        if (!batchBusy) setPendingDelete(null);
      },
      icon: "trash",
      title:
        pendingDelete && pendingDelete.batch
          ? t("tasks.batchDeleteTitle")
          : t("tasks.deleteTitle"),
      width: 460,
      children: h(
        "div",
        {
          style: {
            fontSize: 13,
            color: "var(--tomato-ink-2)",
            lineHeight: 1.7,
          },
        },
        pendingDelete && pendingDelete.batch
          ? t("tasks.batchDeleteBody", { n: pendingDelete.ids.length })
          : t("tasks.deleteBody"),
      ),
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          {
            variant: "ghost",
            onClick: () => setPendingDelete(null),
            disabled: batchBusy,
          },
          t("common.cancel"),
        ),
        h(
          Btn,
          {
            variant: "danger",
            icon: "trash",
            onClick: confirmDelete,
            disabled: batchBusy,
          },
          t("tasks.deleteConfirm"),
        ),
      ),
    }),
    h(Modal, {
      open: moveOpen,
      onClose: () => {
        if (!batchBusy) setMoveOpen(false);
      },
      icon: "calendar",
      title: t("tasks.moveTitle"),
      subtitle: t("tasks.moveHint"),
      width: 440,
      children: h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        h(
          "div",
          {
            style: {
              fontSize: 12,
              fontWeight: 550,
              color: "var(--tomato-ink-2)",
            },
          },
          t("tasks.moveDate"),
        ),
        h(Input, { type: "date", value: moveDate, onChange: setMoveDate }),
      ),
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          {
            variant: "ghost",
            onClick: () => setMoveOpen(false),
            disabled: batchBusy,
          },
          t("common.cancel"),
        ),
        h(
          Btn,
          {
            variant: "primary",
            icon: "check",
            onClick: runBatchMove,
            disabled: batchBusy || !moveDate,
          },
          t("tasks.moveConfirm"),
        ),
      ),
    }),
  );
}

registerPage({
  id: "tasks",
  order: 20,
  icon: "tasks",
  titleKey: "nav.tasks",
  Component: TasksPage,
  badge: (snapshot) => {
    const list =
      snapshot && snapshot.data && Array.isArray(snapshot.data.tasks)
        ? snapshot.data.tasks
        : null;
    if (!list) return null;
    return list.filter((task) => !task.completed).length;
  },
});
