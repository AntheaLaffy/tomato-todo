// src-client splice source: FocusTab + TasksTab tab bodies (contract in src-client/README.md).

Object.assign(COPY.zh, {
  // ---- FocusTab (fa_) ----
  fa_loading: "加载中…",
  fa_loadFailed: "读取今日数据失败，稍后自动重试",
  fa_modeFocus: "专注",
  fa_modeShort: "短休息",
  fa_modeLong: "长休息",
  fa_running: "进行中",
  fa_paused: "已暂停",
  fa_idle: "未开始",
  fa_start: "开始",
  fa_resume: "继续",
  fa_pause: "暂停",
  fa_stop: "停止",
  fa_cycle: "第 {n} 轮",
  fa_writeFailed: "写入失败，请确认运行时可用",
  fa_statDueLabel: "今日待办",
  fa_statFocusLabel: "今日投入（分钟）",
  fa_todayTasks: "今日任务",
  fa_todayEmpty: "今天没有待办任务",
  fa_due: "截止 {date}",
  fa_remind: "提醒 {time}",
  fa_untitled: "（无标题）",
  // ---- TasksTab (ta_) ----
  ta_newPlaceholder: "新任务标题，回车添加",
  ta_add: "添加",
  ta_writeFailed: "写入失败，请确认运行时可用",
  ta_empty: "还没有任务，先加一件吧",
  ta_due: "截止 {date}",
  ta_untitled: "（无标题）",
  ta_markDone: "标记完成",
});

Object.assign(COPY.en, {
  // ---- FocusTab (fa_) ----
  fa_loading: "Loading…",
  fa_loadFailed: "Couldn't read today's data; retrying automatically",
  fa_modeFocus: "Focus",
  fa_modeShort: "Short break",
  fa_modeLong: "Long break",
  fa_running: "Running",
  fa_paused: "Paused",
  fa_idle: "Idle",
  fa_start: "Start",
  fa_resume: "Resume",
  fa_pause: "Pause",
  fa_stop: "Stop",
  fa_cycle: "Round {n}",
  fa_writeFailed: "Write failed, check that the runtime is running",
  fa_statDueLabel: "Due today",
  fa_statFocusLabel: "Focused (min)",
  fa_todayTasks: "Today's tasks",
  fa_todayEmpty: "Nothing due today",
  fa_due: "Due {date}",
  fa_remind: "Remind {time}",
  fa_untitled: "(untitled)",
  // ---- TasksTab (ta_) ----
  ta_newPlaceholder: "New task, press Enter",
  ta_add: "Add",
  ta_writeFailed: "Write failed, check that the runtime is running",
  ta_empty: "No tasks yet",
  ta_due: "Due {date}",
  ta_untitled: "(untitled)",
  ta_markDone: "Mark as done",
});

// ---------------------------------------------------------------- FocusTab (fa_)

const FA_DEFAULT_SECONDS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

function fa_num(x) {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function fa_mode_of(m) {
  const s = typeof m === "string" ? m.toLowerCase() : "";
  if (
    s === "short" ||
    s === "shortbreak" ||
    s === "short_break" ||
    s === "break"
  )
    return "short";
  if (s === "long" || s === "longbreak" || s === "long_break") return "long";
  return "focus";
}

// Tolerant narrow: the timer shape is not finalized, so accept several field
// spellings (remainingSeconds|remaining|secondsLeft, totalSeconds|duration)
// and fall back to sane per-mode defaults when fields are missing.
function fa_timer(t) {
  const out = {
    status: "idle",
    mode: "focus",
    remaining: FA_DEFAULT_SECONDS.focus,
    total: FA_DEFAULT_SECONDS.focus,
    cycle: null,
  };
  if (!t || typeof t !== "object") return out;
  const st = typeof t.status === "string" ? t.status.toLowerCase() : "";
  out.status =
    st === "running" || st === "active" || st === "started"
      ? "running"
      : st === "paused"
        ? "paused"
        : "idle";
  out.mode = fa_mode_of(t.mode);
  let remaining = fa_num(t.remainingSeconds);
  if (remaining == null) remaining = fa_num(t.remaining);
  if (remaining == null) remaining = fa_num(t.secondsLeft);
  let total = fa_num(t.totalSeconds);
  if (total == null) total = fa_num(t.duration);
  if (total == null) total = fa_num(t.durationSeconds);
  if (total == null || total <= 0)
    total = FA_DEFAULT_SECONDS[out.mode] || FA_DEFAULT_SECONDS.focus;
  if (remaining == null) remaining = total;
  out.remaining = Math.min(total, Math.max(0, remaining));
  out.total = total;
  let cycle = fa_num(t.cycle);
  if (cycle == null) cycle = fa_num(t.round);
  out.cycle = Number.isInteger(cycle) && cycle >= 1 ? cycle : null;
  return out;
}

function fa_task(tk) {
  if (!tk || typeof tk !== "object") return null;
  const title =
    typeof tk.title === "string" && tk.title.trim() !== ""
      ? tk.title
      : typeof tk.name === "string" && tk.name.trim() !== ""
        ? tk.name
        : null;
  return {
    id: tk.id != null ? String(tk.id) : null,
    title,
    completed: tk.completed === true || tk.done === true,
    due:
      typeof tk.dueDate === "string"
        ? tk.dueDate
        : typeof tk.due_date === "string"
          ? tk.due_date
          : null,
    reminder:
      typeof tk.reminderTime === "string"
        ? tk.reminderTime
        : typeof tk.remindAt === "string"
          ? tk.remindAt
          : null,
  };
}

function fa_mmss(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return (
    String(Math.floor(s / 60)).padStart(2, "0") +
    ":" +
    String(s % 60).padStart(2, "0")
  );
}

function fa_taskMeta(copy, tk) {
  if (tk.due) return t(copy, "fa_due", { date: tk.due });
  if (tk.reminder) return t(copy, "fa_remind", { time: tk.reminder });
  return null;
}

const fa_safe = (fn) => () => {
  try {
    fn();
  } catch (err) {
    // event handlers must not throw
  }
};

// Timer ring artwork: track uses the theme border token, the progress arc is
// the project's literal tomato red (allowed for artwork only).
function fa_ring(timer) {
  const R = 56;
  const C = 2 * Math.PI * R;
  const frac =
    timer.total > 0
      ? Math.min(1, Math.max(0, timer.remaining / timer.total))
      : 0;
  const children = [
    h("circle", {
      key: "track",
      cx: 64,
      cy: 64,
      r: R,
      fill: "none",
      stroke: T.border2,
      strokeWidth: 9,
    }),
  ];
  if (frac > 0) {
    children.push(
      h("circle", {
        key: "arc",
        cx: 64,
        cy: 64,
        r: R,
        fill: "none",
        stroke: "#d96d55",
        strokeWidth: 9,
        strokeLinecap: "round",
        strokeDasharray: String(C),
        strokeDashoffset: String(C * (1 - frac)),
        transform: "rotate(-90 64 64)",
      }),
    );
  }
  return h(
    "svg",
    { viewBox: "0 0 128 128", width: 136, height: 136, "aria-hidden": true },
    children,
  );
}

const fa_rootStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  alignItems: "flex-start",
};
const fa_cardStyle = {
  background: T.layer1,
  border: "1px solid " + T.border1,
  borderRadius: 12,
  padding: 16,
};
const fa_timerCardStyle = {
  ...fa_cardStyle,
  width: 240,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};
const fa_ringStyle = { position: "relative", width: 136, height: 136 };
const fa_ringTextStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  gap: 2,
};
const fa_chipRowStyle = { display: "flex", alignItems: "center", gap: 8 };
const fa_chipStyle = (bg, color) => ({
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  background: bg,
  color: color || T.text,
});
const fa_btnRowStyle = { display: "flex", gap: 8, marginTop: 2 };
const fa_btnBase = {
  border: "none",
  borderRadius: 8,
  padding: "7px 14px",
  fontSize: 13,
  fontWeight: 600,
};
const fa_btnPrimary = (disabled) => ({
  ...fa_btnBase,
  background: T.brand,
  color: T.brandInvert,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
});
const fa_btnGhost = (disabled) => ({
  ...fa_btnBase,
  background: T.layer2,
  color: T.text,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
});
const fa_btnPlain = (disabled) => ({
  ...fa_btnBase,
  background: "transparent",
  border: "1px solid " + T.border1,
  color: T.text2,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
});
const fa_errorStyle = { color: T.error, fontSize: 12 };
const fa_statRowStyle = { display: "flex", gap: 12, flexWrap: "wrap" };
const fa_statCardStyle = {
  flex: 1,
  minWidth: 120,
  background: T.layer1,
  border: "1px solid " + T.border1,
  borderRadius: 12,
  padding: "12px 14px",
};
const fa_statValueStyle = { fontSize: 20, fontWeight: 700, color: T.text };
const fa_statLabelStyle = { fontSize: 12, color: T.text2, marginTop: 2 };
const fa_listCardStyle = { ...fa_cardStyle, flex: 1, minWidth: 260 };
const fa_listHeadStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: T.text,
  marginBottom: 4,
};
const fa_taskRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "6px 0",
};

function FocusTab({ copy, snap, refresh, every }) {
  const [todayRaw, setTodayRaw] = useState(null);
  const [faFetchFailed, setFaFetchFailed] = useState(false);
  const [faBusy, setFaBusy] = useState(null); // 'start' | 'pause' | 'stop' | null
  const [faError, setFaError] = useState(false);

  const fa_load = useCallback(() => {
    fetchJson(API_BASE + "/api/today", { timeoutMs: 4000 })
      .then((d) => {
        setTodayRaw(d);
        setFaFetchFailed(false);
      })
      .catch(() => setFaFetchFailed(true));
  }, []);

  useEffect(() => {
    fa_load();
    const stop = every(fa_load, 3000);
    return () => {
      if (typeof stop === "function") stop();
    };
  }, [fa_load, every]);

  const fa_send = (action) => {
    if (faBusy) return;
    setFaBusy(action);
    sendJson("/api/focus/" + action, "POST", {})
      .then(() => {
        setFaError(false);
        refresh();
        fa_load();
      })
      .catch(() => setFaError(true))
      .finally(() => setFaBusy(null));
  };

  if (todayRaw == null) {
    return h(
      "div",
      {
        style: {
          color: faFetchFailed ? T.error : T.text2,
          fontSize: 13,
          padding: 8,
        },
      },
      t(copy, faFetchFailed ? "fa_loadFailed" : "fa_loading"),
    );
  }

  const tdy = normalizeToday(todayRaw);
  const timer = fa_timer(tdy.timer);
  const todayTasks = Array.isArray(tdy.tasks)
    ? tdy.tasks.map(fa_task).filter((tk) => tk !== null)
    : [];
  const statusLabel =
    timer.status === "running"
      ? t(copy, "fa_running")
      : timer.status === "paused"
        ? t(copy, "fa_paused")
        : t(copy, "fa_idle");
  const modeLabel =
    timer.mode === "short"
      ? t(copy, "fa_modeShort")
      : timer.mode === "long"
        ? t(copy, "fa_modeLong")
        : t(copy, "fa_modeFocus");
  const statusBg =
    timer.status === "running"
      ? "var(--dsw-alias-state-success-tertiary)"
      : timer.status === "paused"
        ? "var(--dsw-alias-state-warn-tertiary)"
        : T.layer2;
  const busy = faBusy !== null;
  const startLabel =
    timer.status === "paused" ? t(copy, "fa_resume") : t(copy, "fa_start");

  const stats = [];
  if (tdy.dueCount != null) {
    stats.push(
      h("div", { key: "due", style: fa_statCardStyle }, [
        h("div", { key: "v", style: fa_statValueStyle }, String(tdy.dueCount)),
        h(
          "div",
          { key: "l", style: fa_statLabelStyle },
          t(copy, "fa_statDueLabel"),
        ),
      ]),
    );
  }
  if (tdy.focusMinutes != null) {
    stats.push(
      h("div", { key: "focus", style: fa_statCardStyle }, [
        h(
          "div",
          { key: "v", style: fa_statValueStyle },
          String(tdy.focusMinutes),
        ),
        h(
          "div",
          { key: "l", style: fa_statLabelStyle },
          t(copy, "fa_statFocusLabel"),
        ),
      ]),
    );
  }

  return h("div", { style: fa_rootStyle }, [
    h("div", { key: "timer", style: fa_timerCardStyle }, [
      h("div", { key: "ring", style: fa_ringStyle }, [
        fa_ring(timer),
        h("div", { key: "text", style: fa_ringTextStyle }, [
          h(
            "div",
            {
              key: "clock",
              style: {
                fontSize: 26,
                fontWeight: 700,
                color: T.text,
                fontVariantNumeric: "tabular-nums",
              },
            },
            fa_mmss(timer.remaining),
          ),
          h(
            "div",
            { key: "sub", style: { fontSize: 11, color: T.text3 } },
            statusLabel,
          ),
        ]),
      ]),
      h("div", { key: "chips", style: fa_chipRowStyle }, [
        h("span", { key: "mode", style: fa_chipStyle(T.layer2) }, modeLabel),
        timer.cycle != null
          ? h(
              "span",
              { key: "cycle", style: fa_chipStyle(T.layer2, T.text2) },
              t(copy, "fa_cycle", { n: timer.cycle }),
            )
          : null,
      ]),
      h("div", { key: "btns", style: fa_btnRowStyle }, [
        h(
          "button",
          {
            key: "start",
            style: fa_btnPrimary(busy || timer.status === "running"),
            disabled: busy || timer.status === "running",
            onClick: fa_safe(() => fa_send("start")),
          },
          busy && faBusy === "start" ? startLabel + "…" : startLabel,
        ),
        h(
          "button",
          {
            key: "pause",
            style: fa_btnGhost(busy || timer.status !== "running"),
            disabled: busy || timer.status !== "running",
            onClick: fa_safe(() => fa_send("pause")),
          },
          busy && faBusy === "pause"
            ? t(copy, "fa_pause") + "…"
            : t(copy, "fa_pause"),
        ),
        h(
          "button",
          {
            key: "stop",
            style: fa_btnPlain(busy || timer.status === "idle"),
            disabled: busy || timer.status === "idle",
            onClick: fa_safe(() => fa_send("stop")),
          },
          busy && faBusy === "stop"
            ? t(copy, "fa_stop") + "…"
            : t(copy, "fa_stop"),
        ),
      ]),
      faError
        ? h(
            "div",
            { key: "err", style: fa_errorStyle },
            t(copy, "fa_writeFailed"),
          )
        : null,
    ]),
    h(
      "div",
      {
        key: "side",
        style: {
          flex: 1,
          minWidth: 260,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        },
      },
      [
        stats.length > 0
          ? h("div", { key: "stats", style: fa_statRowStyle }, stats)
          : null,
        h("div", { key: "tasks", style: fa_listCardStyle }, [
          h(
            "div",
            { key: "head", style: fa_listHeadStyle },
            t(copy, "fa_todayTasks"),
          ),
          todayTasks.length === 0
            ? h(
                "div",
                {
                  key: "empty",
                  style: { color: T.text2, fontSize: 13, paddingTop: 4 },
                },
                t(copy, "fa_todayEmpty"),
              )
            : todayTasks.map((tk, i) =>
                h(
                  "div",
                  {
                    key: tk.id != null ? "t" + tk.id : "t" + i,
                    style:
                      i > 0
                        ? {
                            ...fa_taskRowStyle,
                            borderTop: "1px solid " + T.border2,
                          }
                        : fa_taskRowStyle,
                  },
                  [
                    h(
                      "span",
                      {
                        key: "title",
                        style: {
                          flex: 1,
                          minWidth: 0,
                          fontSize: 13,
                          color: tk.completed ? T.text3 : T.text,
                          textDecoration: tk.completed
                            ? "line-through"
                            : "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      },
                      tk.title != null ? tk.title : t(copy, "fa_untitled"),
                    ),
                    fa_taskMeta(copy, tk) != null
                      ? h(
                          "span",
                          {
                            key: "meta",
                            style: {
                              fontSize: 11,
                              color: T.text3,
                              flexShrink: 0,
                            },
                          },
                          fa_taskMeta(copy, tk),
                        )
                      : null,
                  ],
                ),
              ),
        ]),
      ],
    ),
  ]);
}

// ---------------------------------------------------------------- TasksTab (ta_)

function ta_task(tk) {
  if (!tk || typeof tk !== "object") return null;
  const title =
    typeof tk.title === "string" && tk.title.trim() !== ""
      ? tk.title
      : typeof tk.name === "string" && tk.name.trim() !== ""
        ? tk.name
        : null;
  return {
    id: tk.id != null ? String(tk.id) : null,
    title,
    completed: tk.completed === true || tk.done === true,
    due:
      typeof tk.dueDate === "string"
        ? tk.dueDate
        : typeof tk.due_date === "string"
          ? tk.due_date
          : null,
    project:
      typeof tk.project === "string" && tk.project.trim() !== ""
        ? tk.project
        : null,
    reminder: typeof tk.reminderTime === "string" ? tk.reminderTime : null,
  };
}

// Incomplete first; within each group sort by due date ascending, tasks
// without a due date last (Array#sort is stable, so ties keep source order).
function ta_sort(list) {
  const arr = list.slice();
  const dueKey = (tk) => (tk.due ? tk.due : "\uffff");
  arr.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = dueKey(a);
    const db = dueKey(b);
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  });
  return arr;
}

// The completed checkmark is artwork; the literal tomato red is by design.
function ta_checkIcon(size) {
  return h(
    "svg",
    { viewBox: "0 0 16 16", width: size, height: size, "aria-hidden": true },
    [
      h("path", {
        d: "M3.5 8.5 6.5 11.5 12.5 5",
        fill: "none",
        stroke: "#d96d55",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      }),
    ],
  );
}

const ta_safe = (fn) => () => {
  try {
    fn();
  } catch (err) {
    // event handlers must not throw
  }
};

const ta_rootStyle = { display: "flex", flexDirection: "column" };
const ta_formStyle = { display: "flex", gap: 8, marginBottom: 12 };
const ta_inputStyle = {
  flex: 1,
  minWidth: 0,
  background: T.layer1,
  border: "1px solid " + T.border1,
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: T.text,
  outline: "none",
};
const ta_addBtnStyle = (disabled) => ({
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  background: T.brand,
  color: T.brandInvert,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
});
const ta_errorStyle = { color: T.error, fontSize: 12, marginBottom: 8 };
const ta_listStyle = {
  background: T.layer1,
  border: "1px solid " + T.border1,
  borderRadius: 12,
  overflow: "hidden",
};
const ta_rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
};
const ta_checkStyle = (disabled) => ({
  width: 18,
  height: 18,
  borderRadius: 6,
  border: "1px solid " + T.border1,
  background: "transparent",
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  flexShrink: 0,
});
const ta_dueChipStyle = {
  padding: "1px 8px",
  borderRadius: 999,
  fontSize: 11,
  background: T.layer2,
  color: T.text2,
};

function TasksTab({ copy, snap, refresh }) {
  const [taTitle, setTaTitle] = useState("");
  const [taAdding, setTaAdding] = useState(false);
  const [taAddError, setTaAddError] = useState(false);
  const [taBusyId, setTaBusyId] = useState(null); // task id whose complete request is in flight
  const [taRowError, setTaRowError] = useState(null); // task id whose complete request failed

  const tasks = useMemo(
    () =>
      ta_sort(
        (snap && Array.isArray(snap.tasks) ? snap.tasks : [])
          .map(ta_task)
          .filter((tk) => tk !== null),
      ),
    [snap],
  );

  const ta_submit = () => {
    try {
      const title = typeof taTitle === "string" ? taTitle.trim() : "";
      if (!title || taAdding) return;
      setTaAdding(true);
      sendJson("/api/tasks", "POST", { title })
        .then(() => {
          setTaTitle("");
          setTaAddError(false);
          refresh();
        })
        .catch(() => setTaAddError(true))
        .finally(() => setTaAdding(false));
    } catch (err) {
      // never throw from a handler
    }
  };

  const ta_complete = (task) => {
    try {
      if (!task || task.id == null || taBusyId != null) return;
      setTaBusyId(task.id);
      sendJson(
        "/api/tasks/" + encodeURIComponent(task.id) + "/complete",
        "POST",
        {},
      )
        .then(() => {
          setTaRowError(null);
          refresh();
        })
        .catch(() => setTaRowError(task.id))
        .finally(() => setTaBusyId(null));
    } catch (err) {
      // never throw from a handler
    }
  };

  return h("div", { style: ta_rootStyle }, [
    h("div", { key: "form", style: ta_formStyle }, [
      h("input", {
        key: "in",
        style: ta_inputStyle,
        value: taTitle,
        placeholder: t(copy, "ta_newPlaceholder"),
        disabled: taAdding,
        onChange: (e) => setTaTitle(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") ta_submit();
        },
      }),
      h(
        "button",
        {
          key: "add",
          style: ta_addBtnStyle(taAdding),
          disabled: taAdding,
          onClick: ta_safe(ta_submit),
        },
        taAdding ? t(copy, "ta_add") + "…" : t(copy, "ta_add"),
      ),
    ]),
    taAddError
      ? h(
          "div",
          { key: "adderr", style: ta_errorStyle },
          t(copy, "ta_writeFailed"),
        )
      : null,
    tasks.length === 0
      ? h(
          "div",
          {
            key: "empty",
            style: { color: T.text2, fontSize: 13, padding: "16px 4px" },
          },
          t(copy, "ta_empty"),
        )
      : h(
          "div",
          { key: "list", style: ta_listStyle },
          tasks.map((task, i) =>
            h(
              "div",
              {
                key: task.id != null ? task.id : "row" + i,
                style:
                  i > 0
                    ? { ...ta_rowStyle, borderTop: "1px solid " + T.border2 }
                    : ta_rowStyle,
              },
              [
                h(
                  "button",
                  {
                    key: "check",
                    style: ta_checkStyle(task.id == null || taBusyId != null),
                    disabled: task.id == null || taBusyId != null,
                    "aria-label": t(copy, "ta_markDone"),
                    title: t(copy, "ta_markDone"),
                    onClick: ta_safe(() => ta_complete(task)),
                  },
                  task.completed ? ta_checkIcon(12) : null,
                ),
                h("div", { key: "body", style: { flex: 1, minWidth: 0 } }, [
                  h(
                    "div",
                    {
                      key: "title",
                      style: {
                        fontSize: 13,
                        color: task.completed ? T.text3 : T.text,
                        textDecoration: task.completed
                          ? "line-through"
                          : "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    },
                    task.title != null ? task.title : t(copy, "ta_untitled"),
                  ),
                  task.due || task.project
                    ? h(
                        "div",
                        {
                          key: "meta",
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 3,
                          },
                        },
                        [
                          task.due
                            ? h(
                                "span",
                                { key: "due", style: ta_dueChipStyle },
                                t(copy, "ta_due", { date: task.due }),
                              )
                            : null,
                          task.project
                            ? h(
                                "span",
                                {
                                  key: "proj",
                                  style: { fontSize: 11, color: T.text3 },
                                },
                                task.project,
                              )
                            : null,
                        ],
                      )
                    : null,
                  taRowError === task.id
                    ? h(
                        "div",
                        {
                          key: "rowerr",
                          style: { fontSize: 11, color: T.error, marginTop: 3 },
                        },
                        t(copy, "ta_writeFailed"),
                      )
                    : null,
                ]),
              ],
            ),
          ),
        ),
  ]);
}
