// ⌘K / Ctrl+K 搜索对话框：跨任务找东西，并复用手势与帮助提示。
//
// 为什么任务优先：旧版搜索的主要用途是「找到那件想做的事然后开始」，所以
// 结果只列任务（标题/备注/标签匹配），行内展示项目与日期，点一下直接打开
// 任务对话框；空查询时给最近的未完成任务，避免空白页。
// 页面只负责挂载本组件与处理 onOpenTask/onCreate，快捷键监听由 useSearchHotkey
// 统一提供，focus/tasks 两页各自挂一份（框架同一时刻只渲染一页）。
import { h, useEffect, useRef, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import { IconBtn, Input, Kbd, Modal } from "../shared/ui.js";
import { useSnapshot } from "../shared/store.js";
import { isOverdue, projectById } from "../shared/derive.js";

registerCopy("search", {
  zh: {
    title: "找一件想做的事",
    subtitle: "搜索任务标题、标签或备注；回车打开第一条。",
    placeholder: "搜索任务、备注或标签…",
    idleTitle: "最近的待办",
    empty: "没有匹配的任务",
    emptyHint: "换个关键词，或者用这个关键词新建一件。",
    create: "用「{q}」新建任务",
    open: "打开",
    project: "项目",
    noProject: "收件箱",
    completed: "已完成",
    overdue: "已逾期",
    today: "今天",
    untitled: "（无标题）",
    hotkeys: "快捷键",
    hotkeyNew: "新建任务",
    hotkeySearch: "搜索任务",
    hotkeySpace: "开始 / 暂停计时",
    hotkeyEsc: "关闭弹窗",
    tip: "输入文字时不会触发计时快捷键。",
    count: "{n} 条结果",
    help: "帮助",
  },
  en: {
    title: "Find one thing",
    subtitle: "Search titles, tags, and notes. Enter opens the first result.",
    placeholder: "Search tasks, notes or tags…",
    idleTitle: "Recent tasks",
    empty: "No matching tasks",
    emptyHint: "Try another keyword, or create one with this word.",
    create: "Create a task titled “{q}”",
    open: "Open",
    project: "Project",
    noProject: "Inbox",
    completed: "Done",
    overdue: "Overdue",
    today: "Today",
    untitled: "(untitled)",
    hotkeys: "Shortcuts",
    hotkeyNew: "New task",
    hotkeySearch: "Search tasks",
    hotkeySpace: "Start / pause timer",
    hotkeyEsc: "Close dialog",
    tip: "Timer shortcuts are ignored while typing.",
    count: "{n} results",
    help: "Help",
  },
});

/** 监听 Ctrl/Cmd+K 与 Ctrl/Cmd+F，打开搜索对话框。 */
export function useSearchHotkey(onOpen) {
  const callback = useRef(onOpen);
  callback.current = onOpen;
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handler = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = String(event.key ?? "").toLowerCase();
      if (key !== "k" && key !== "f") return;
      event.preventDefault();
      callback.current?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}

function matches(task, query) {
  if (query === "") return true;
  const haystack = `${task.title ?? ""} ${task.notes ?? ""} ${
    Array.isArray(task.tags) ? task.tags.join(" ") : ""
  }`.toLowerCase();
  return haystack.includes(query);
}

function sortResults(a, b) {
  const done = Number(!!a.completed) - Number(!!b.completed);
  if (done !== 0) return done;
  const dueA = a.dueDate ?? "9999-12-31";
  const dueB = b.dueDate ?? "9999-12-31";
  if (dueA !== dueB) return dueA.localeCompare(dueB);
  return String(a.title ?? "").localeCompare(String(b.title ?? ""));
}

/** 搜索结果行。 */
function ResultRow({ task, project, onPick }) {
  const overdue = isOverdue(task, task.todayKey || "");
  return h(
    "button",
    {
      type: "button",
      className: "t-row",
      onClick: () => onPick(task),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        padding: "10px 12px",
        borderRadius: 11,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
      },
    },
    h(Icon, {
      name: task.completed ? "check" : "tasks",
      size: 17,
      style: {
        color: task.completed ? "var(--tomato-leaf)" : "var(--tomato-ink-3)",
      },
    }),
    h(
      "span",
      { style: { flex: 1, minWidth: 0 } },
      h(
        "span",
        {
          style: {
            display: "block",
            fontSize: 13.5,
            color: task.completed ? "var(--tomato-ink-3)" : "var(--tomato-ink)",
            textDecoration: task.completed ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
        task.title || t("search.untitled"),
      ),
      h(
        "span",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 3,
            fontSize: 11.5,
          },
        },
        project
          ? h(
              "span",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--tomato-ink-3)",
                },
              },
              h("span", {
                style: {
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: project.color || "var(--tomato-ink-3)",
                },
              }),
              project.name,
            )
          : h(
              "span",
              { style: { color: "var(--tomato-ink-3)" } },
              t("search.noProject"),
            ),
        task.dueDate
          ? h(
              "span",
              {
                style: {
                  color: overdue ? "var(--tomato-sun)" : "var(--tomato-ink-3)",
                },
              },
              task.dueDate === task.todayKey ? t("search.today") : task.dueDate,
            )
          : null,
        Array.isArray(task.tags) && task.tags.length > 0
          ? h(
              "span",
              {
                style: {
                  color: "var(--tomato-ink-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              },
              `#${task.tags.slice(0, 2).join(" #")}`,
            )
          : null,
      ),
    ),
    h(Icon, {
      name: "arrowRight",
      size: 14,
      style: { color: "var(--tomato-ink-3)" },
    }),
  );
}

/**
 * SearchDialog：open 为 true 时渲染。
 * props: { open, onClose, onOpenTask(taskId), onCreate(query), help? }
 */
export function SearchDialog({ open, onClose, onOpenTask, onCreate }) {
  const state = useSnapshot();
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    const timer = setTimeout(() => {
      try {
        inputRef.current?.focus?.();
      } catch {
        /* 无 DOM 环境 */
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const data = (state && state.data) || {};
  const todayKey = (state && state.today) || "";
  const allTasks = Array.isArray(data.tasks) ? data.tasks : [];
  const normalized = query.trim().toLowerCase();
  const results = allTasks
    .filter((task) => matches(task, normalized))
    .sort(sortResults)
    .slice(0, normalized === "" ? 8 : 30);

  const pick = (task) => {
    onClose?.();
    onOpenTask?.(task.id);
  };

  const body = h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 220,
      },
    },
    h(
      "div",
      {
        style: { position: "relative", display: "flex", alignItems: "center" },
      },
      h(Icon, {
        name: "search",
        size: 16,
        style: {
          position: "absolute",
          left: 12,
          color: "var(--tomato-ink-3)",
          pointerEvents: "none",
        },
      }),
      h(Input, {
        value: query,
        onChange: setQuery,
        placeholder: t("search.placeholder"),
        inputRef,
        autoFocus: true,
        style: { paddingLeft: 36, height: 40, fontSize: 14 },
        onKeyDown: (event) => {
          if (event.key === "Enter" && results.length > 0) {
            event.preventDefault();
            pick(results[0]);
          }
        },
      }),
      query !== ""
        ? h(IconBtn, {
            name: "x",
            size: 14,
            box: 26,
            title: t("common.close"),
            onClick: () => setQuery(""),
            style: { position: "absolute", right: 8 },
          })
        : null,
    ),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8 } },
      h(
        "span",
        {
          style: {
            fontSize: 11.5,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--tomato-ink-3)",
          },
        },
        normalized === ""
          ? t("search.idleTitle")
          : t("search.count", { n: results.length }),
      ),
      h("span", {
        style: { flex: 1, height: 1, background: "var(--tomato-line)" },
      }),
    ),
    results.length > 0
      ? h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 1 } },
          results.map((task) =>
            h(ResultRow, {
              key: task.id,
              task: { ...task, todayKey },
              project: projectById(data, task.projectId),
              onPick: pick,
            }),
          ),
        )
      : h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "28px 12px",
              textAlign: "center",
            },
          },
          h(Icon, {
            name: "search",
            size: 22,
            style: { color: "var(--tomato-ink-3)" },
          }),
          h(
            "div",
            { style: { fontSize: 13.5, color: "var(--tomato-ink-2)" } },
            t("search.empty"),
          ),
          h(
            "div",
            {
              style: {
                fontSize: 12,
                color: "var(--tomato-ink-3)",
                lineHeight: 1.6,
              },
            },
            t("search.emptyHint"),
          ),
          onCreate && query.trim() !== ""
            ? h(
                "button",
                {
                  type: "button",
                  className: "t-btn t-btn-soft",
                  onClick: () => {
                    const title = query.trim();
                    onClose?.();
                    onCreate(title);
                  },
                  style: {
                    padding: "7px 14px",
                    fontSize: 12.5,
                    height: "auto",
                  },
                },
                t("search.create", { q: query.trim() }),
              )
            : null,
        ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px 14px",
          paddingTop: 8,
          borderTop: "1px solid var(--tomato-line)",
          fontSize: 11.5,
          color: "var(--tomato-ink-3)",
        },
      },
      h(
        "span",
        { style: { display: "inline-flex", alignItems: "center", gap: 5 } },
        h(Kbd, null, "Ctrl K"),
        t("search.hotkeySearch"),
      ),
      h(
        "span",
        { style: { display: "inline-flex", alignItems: "center", gap: 5 } },
        h(Kbd, null, "N"),
        t("search.hotkeyNew"),
      ),
      h(
        "span",
        { style: { display: "inline-flex", alignItems: "center", gap: 5 } },
        h(Kbd, null, "Space"),
        t("search.hotkeySpace"),
      ),
      h(
        "span",
        { style: { display: "inline-flex", alignItems: "center", gap: 5 } },
        h(Kbd, null, "Esc"),
        t("search.hotkeyEsc"),
      ),
      h("span", { style: { flex: 1 } }),
      h("span", { style: { color: "var(--tomato-ink-3)" } }, t("search.tip")),
    ),
  );

  return h(
    Modal,
    {
      open,
      onClose,
      icon: "search",
      title: t("search.title"),
      subtitle: t("search.subtitle"),
      width: 560,
      bodyStyle: { minHeight: 220 },
    },
    body,
  );
}
