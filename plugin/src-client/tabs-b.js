// tabs-b.js — 拼接源：整段复制进 plugin/client.js 工厂函数体内，替换 StatsTab/SettingsTab 占位。
// 只依赖工厂作用域已有名字（h、T、t、COPY、API_BASE、fetchJson、normalizeHealth、StatusDot），无 import/export/顶层 return。

Object.assign(COPY.zh, {
  st_loading: "加载中…",
  st_noStats: "暂无统计数据——连上番茄运行时并专注一次后，这里会出现图表",
  st_todayMin: "今日投入（分钟）",
  st_todayPomo: "今日番茄（个）",
  st_todayDone: "今日完成（件）",
  st_streak: "连续天数（天）",
  st_totalHr: "累计投入（小时）",
  st_week: "近七天（分钟）",
  se_runtime: "运行时",
  se_status: "连接状态",
  se_online: "在线",
  se_offline: "未连接",
  se_service: "服务",
  se_version: "版本",
  se_guard: "专注保护",
  se_attach: "接入状态",
  se_attachYes: "已接入",
  se_backend: "后端",
  se_lockState: "锁定状态",
  se_locked: "已锁定",
  se_unlocked: "未锁定",
  se_whitelistLabel: "白名单",
  se_whitelistCount: "{n} 个",
  se_guardNone:
    "未接入 guard——专注保护是可选组件，由运行时拉起；当前运行时未上报 guard 状态",
  se_dataDir: "数据目录",
  se_readOnly:
    "此处为只读状态展示；runtime 与 guard 的配置由安装脚本与运行时管理。",
});

Object.assign(COPY.en, {
  st_loading: "Loading…",
  st_noStats:
    "No stats yet — connect the tomato runtime and finish a focus session to see charts here",
  st_todayMin: "Focused today (min)",
  st_todayPomo: "Pomodoros today",
  st_todayDone: "Completed today",
  st_streak: "Day streak",
  st_totalHr: "Total focus (h)",
  st_week: "Last 7 days (min)",
  se_runtime: "Runtime",
  se_status: "Connection",
  se_online: "Online",
  se_offline: "Not connected",
  se_service: "Service",
  se_version: "Version",
  se_guard: "Focus guard",
  se_attach: "Attached",
  se_attachYes: "Attached",
  se_backend: "Backend",
  se_lockState: "Lock state",
  se_locked: "Locked",
  se_unlocked: "Unlocked",
  se_whitelistLabel: "Whitelist",
  se_whitelistCount: "{n} allowlisted",
  se_guardNone:
    "No guard attached. Focus protection is an optional component started by the runtime; the runtime is not reporting guard status.",
  se_dataDir: "Data directory",
  se_readOnly:
    "Read-only status view. Runtime and guard configuration is managed by install scripts and the runtime.",
});

// ---- 统计页签：容忍式窄化与格式化（st_ 前缀）----

function st_num(...vals) {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
      return Number(v);
  }
  return null;
}

// 'YYYY-MM-DD' → 本地时区 Date；日期必须真实存在（拒绝 2 月 30 这类）。
function st_parseDate(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
    return null;
  return dt;
}

function st_dateKey(dt) {
  const p = (n) => String(n).padStart(2, "0");
  return dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate());
}

// 每天一条：{date, seconds} 或 {date, minutes}，统一折算成秒。
function st_daySeconds(d) {
  if (!d || typeof d !== "object") return 0;
  if (typeof d.seconds === "number" && Number.isFinite(d.seconds))
    return Math.max(0, Math.round(d.seconds));
  if (typeof d.minutes === "number" && Number.isFinite(d.minutes))
    return Math.max(0, Math.round(d.minutes * 60));
  return 0;
}

// 把服务端的天数组收敛成恰好 7 个槽位（旧→新）：
// 有可解析日期时，以最大日期为锚补齐缺失的日历日（缺某天补 0）；
// 完全没有日期时，把条目（旧→新）铺到以今天结尾的最近 N 天上，星期标签仍然有意义。
function st_weekSlots(days) {
  if (!Array.isArray(days) || days.length === 0) return [];
  const parsed = days.map((d) => ({
    dt: st_parseDate(d && d.date),
    seconds: st_daySeconds(d),
  }));
  const dated = parsed.filter((e) => e.dt);
  if (dated.length === 0) {
    const count = Math.min(parsed.length, 7);
    const today = new Date();
    const slots = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - (6 - i),
      );
      const idx = parsed.length - count + (i - (7 - count));
      slots.push({
        dt,
        seconds: idx >= 0 && idx < parsed.length ? parsed[idx].seconds : 0,
      });
    }
    return slots;
  }
  let maxDt = dated[0].dt;
  for (const e of dated) if (e.dt > maxDt) maxDt = e.dt;
  const byKey = new Map();
  for (const e of parsed) if (e.dt) byKey.set(st_dateKey(e.dt), e.seconds);
  const slots = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(
      maxDt.getFullYear(),
      maxDt.getMonth(),
      maxDt.getDate() - (6 - i),
    );
    slots.push({ dt, seconds: byKey.get(st_dateKey(dt)) || 0 });
  }
  return slots;
}

// 容忍多种字段名（camelCase / snake_case）与 {stats: {...}} 嵌套；读不出任何字段时返回 null。
function st_normalizeStats(p) {
  if (!p || typeof p !== "object") return null;
  const inner = p.stats && typeof p.stats === "object" ? p.stats : p;
  let days = null;
  const rawDays = Array.isArray(inner.days)
    ? inner.days
    : Array.isArray(inner.last7Days)
      ? inner.last7Days
      : Array.isArray(inner.week)
        ? inner.week
        : null;
  if (rawDays) {
    days = rawDays.map((d) => ({
      date: d && typeof d.date === "string" ? d.date : null,
      seconds: st_daySeconds(d),
    }));
  }
  const todaySeconds = st_num(inner.todaySeconds, inner.today_seconds);
  const todayPomodoros = st_num(inner.todayPomodoros, inner.today_pomodoros);
  const todayCompleted = st_num(inner.todayCompleted, inner.today_completed);
  const streakDays = st_num(inner.streakDays, inner.streak);
  const totalSeconds = st_num(inner.totalSeconds, inner.total_seconds);
  const hasAny =
    todaySeconds !== null ||
    todayPomodoros !== null ||
    todayCompleted !== null ||
    streakDays !== null ||
    totalSeconds !== null ||
    days !== null;
  if (!hasAny) return null;
  return {
    todaySeconds,
    todayPomodoros,
    todayCompleted,
    streakDays,
    totalSeconds,
    days,
  };
}

// 全 0 且没有 days 数组视为无数据（空态）；有 days 就画图，哪怕全是 0。
function st_hasData(s) {
  if (!s) return false;
  if (s.days && s.days.length > 0) return true;
  return (
    (s.todaySeconds != null && s.todaySeconds > 0) ||
    (s.todayPomodoros != null && s.todayPomodoros > 0) ||
    (s.todayCompleted != null && s.todayCompleted > 0) ||
    (s.streakDays != null && s.streakDays > 0) ||
    (s.totalSeconds != null && s.totalSeconds > 0)
  );
}

function st_fmtInt(n) {
  return n == null ? "—" : String(Math.round(n));
}

function st_fmtMin(n) {
  return n == null ? "—" : String(Math.round(n / 60));
}

// 累计投入（小时），四舍五入到 0.1。
function st_fmtHours(n) {
  return n == null ? "—" : (Math.round((n / 3600) * 10) / 10).toFixed(1);
}

const st_BAR_MAX = 96;
const st_BAR_MIN = 6;

// 高度按当日最大值归一；最大为 0 时全部给最低高度。
function st_barHeights(slots) {
  let max = 0;
  for (const s of slots) if (s.seconds > max) max = s.seconds;
  return slots.map((s) =>
    max === 0
      ? st_BAR_MIN
      : st_BAR_MIN + Math.round((s.seconds / max) * (st_BAR_MAX - st_BAR_MIN)),
  );
}

const st_gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 12,
};
const st_cardStyle = {
  background: T.layer1,
  border: `1px solid ${T.border1}`,
  borderRadius: 12,
  padding: "14px 16px",
};
const st_emptyStyle = {
  padding: "36px 12px",
  textAlign: "center",
  color: T.text2,
  fontSize: 13,
  lineHeight: 1.6,
};

function StatsTab({ copy, snap, every }) {
  const [stats, setStats] = useState(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchJson(API_BASE + "/api/stats", { timeoutMs: 4000 })
        .then((d) => {
          if (alive) setStats(st_normalizeStats(d));
        })
        .catch(() => {
          // 取不到就保留上次结果；snap.stats 继续充当回退。
        })
        .finally(() => {
          if (alive) setSettled(true);
        });
    };
    load();
    const stop = every(load, 30000);
    return () => {
      alive = false;
      if (typeof stop === "function") stop();
    };
  }, [every]);

  // snap.stats 只作首屏回退；自取成功后就以 /api/stats 为准。
  const snapStats = st_normalizeStats(snap && snap.stats);
  const shown = stats || snapStats;

  if (!shown) {
    return h(
      "div",
      { style: st_emptyStyle },
      t(copy, settled ? "st_noStats" : "st_loading"),
    );
  }
  if (!st_hasData(shown)) {
    return h("div", { style: st_emptyStyle }, t(copy, "st_noStats"));
  }

  const slots = st_weekSlots(shown.days);
  const heights = st_barHeights(slots);
  const daysArr =
    Array.isArray(copy.days) && copy.days.length === 7 ? copy.days : null;

  const cards = [
    { key: "st_todayMin", value: st_fmtMin(shown.todaySeconds) },
    { key: "st_todayPomo", value: st_fmtInt(shown.todayPomodoros) },
    { key: "st_todayDone", value: st_fmtInt(shown.todayCompleted) },
    { key: "st_streak", value: st_fmtInt(shown.streakDays) },
    { key: "st_totalHr", value: st_fmtHours(shown.totalSeconds) },
  ];

  return h("div", { style: { display: "flex", flexDirection: "column" } }, [
    h(
      "div",
      { key: "cards", style: st_gridStyle },
      cards.map((c) =>
        h("div", { key: c.key, style: st_cardStyle }, [
          h(
            "div",
            {
              key: "num",
              style: {
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1.1,
                color: T.text,
                fontVariantNumeric: "tabular-nums",
              },
            },
            c.value,
          ),
          h(
            "div",
            {
              key: "label",
              style: { marginTop: 6, fontSize: 12, color: T.text2 },
            },
            t(copy, c.key),
          ),
        ]),
      ),
    ),
    slots.length > 0
      ? h("div", { key: "chart", style: { ...st_cardStyle, marginTop: 12 } }, [
          h(
            "div",
            {
              key: "head",
              style: { fontSize: 13, fontWeight: 600, color: T.text },
            },
            t(copy, "st_week"),
          ),
          h(
            "div",
            { key: "bars", style: { display: "flex", gap: 8, marginTop: 14 } },
            slots.map((s, i) =>
              h(
                "div",
                {
                  key: i,
                  style: {
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  },
                },
                [
                  h(
                    "div",
                    {
                      key: "slot",
                      style: {
                        height: st_BAR_MAX + 8,
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                      },
                    },
                    [
                      h("div", {
                        key: "bar",
                        "aria-hidden": true,
                        style: {
                          width: "58%",
                          maxWidth: 30,
                          minWidth: 8,
                          height: heights[i],
                          borderRadius: "5px 5px 0 0",
                          background: "#d96d55",
                        },
                      }),
                    ],
                  ),
                  h(
                    "div",
                    {
                      key: "min",
                      style: {
                        marginTop: 8,
                        fontSize: 11,
                        color: T.text2,
                        fontVariantNumeric: "tabular-nums",
                      },
                    },
                    String(Math.round(s.seconds / 60)),
                  ),
                  h(
                    "div",
                    {
                      key: "day",
                      style: { marginTop: 2, fontSize: 11, color: T.text3 },
                    },
                    daysArr ? daysArr[s.dt.getDay()] : "",
                  ),
                ],
              ),
            ),
          ),
        ])
      : null,
  ]);
}

// ---- 设置页签：只读状态展示（se_ 前缀）----

const se_cardStyle = {
  background: T.layer1,
  border: `1px solid ${T.border1}`,
  borderRadius: 12,
  padding: "14px 16px",
};
const se_cardHeadStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: T.text,
  marginBottom: 2,
};
const se_rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 0",
  borderBottom: `1px solid ${T.border2}`,
};
const se_labelStyle = { color: T.text2, fontSize: 12, flexShrink: 0 };
const se_valueStyle = {
  color: T.text,
  fontSize: 13,
  fontWeight: 500,
  textAlign: "right",
  minWidth: 0,
  overflowWrap: "anywhere",
};
const se_noteStyle = {
  marginTop: 12,
  fontSize: 12,
  lineHeight: 1.6,
  color: T.text3,
};
const se_monoStyle = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 12,
  color: T.text,
  overflowWrap: "anywhere",
  padding: "7px 0",
};

function se_dotText(ok, text) {
  return h(
    "span",
    { style: { display: "inline-flex", alignItems: "center", gap: 6 } },
    [h(StatusDot, { key: "dot", ok }), h("span", { key: "t" }, text)],
  );
}

function se_kvRow(label, value, key) {
  return h("div", { key, style: se_rowStyle }, [
    h("span", { key: "k", style: se_labelStyle }, label),
    h("span", { key: "v", style: se_valueStyle }, value),
  ]);
}

function SettingsTab({ copy, hlt, every }) {
  const [self, setSelf] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchJson(API_BASE + "/health", { timeoutMs: 4000 })
        .then((d) => {
          const n = normalizeHealth(d);
          if (alive && n) setSelf(n);
        })
        .catch(() => {
          // 自取失败保留上次结果；hlt 继续充当实时回退。
        });
    };
    load();
    const stop = every(load, 30000);
    return () => {
      alive = false;
      if (typeof stop === "function") stop();
    };
  }, [every]);

  // 自取成功以自取为准；未成功过就用面板持续轮询的 hlt（prop 变化时自动跟随）。
  const health = self || hlt;
  const online = !!health && health.ok !== false;
  const g = health ? health.guard : null;
  const attached = !!g && g.available !== false;

  return h("div", { style: { display: "flex", flexDirection: "column" } }, [
    h("div", { key: "runtime", style: se_cardStyle }, [
      h("div", { key: "head", style: se_cardHeadStyle }, t(copy, "se_runtime")),
      se_kvRow(
        t(copy, "se_status"),
        se_dotText(online, t(copy, online ? "se_online" : "se_offline")),
        "status",
      ),
      se_kvRow(
        t(copy, "se_service"),
        health && health.service ? health.service : "—",
        "service",
      ),
      se_kvRow(
        t(copy, "se_version"),
        health && health.version ? health.version : "—",
        "version",
      ),
    ]),
    h("div", { key: "guard", style: { ...se_cardStyle, marginTop: 12 } }, [
      h("div", { key: "head", style: se_cardHeadStyle }, t(copy, "se_guard")),
      attached
        ? [
            se_kvRow(
              t(copy, "se_attach"),
              se_dotText(true, t(copy, "se_attachYes")),
              "attach",
            ),
            se_kvRow(
              t(copy, "se_backend"),
              g.backend ? g.backend : "—",
              "backend",
            ),
            se_kvRow(
              t(copy, "se_lockState"),
              t(copy, g.locked ? "se_locked" : "se_unlocked"),
              "locked",
            ),
            se_kvRow(
              t(copy, "se_whitelistLabel"),
              t(copy, "se_whitelistCount", {
                n: Array.isArray(g.whitelist) ? g.whitelist.length : 0,
              }),
              "whitelist",
            ),
            se_kvRow("PID", g.pid != null ? String(g.pid) : "—", "pid"),
            g.message
              ? h(
                  "div",
                  {
                    key: "msg",
                    style: { marginTop: 8, fontSize: 12, color: T.text3 },
                  },
                  g.message,
                )
              : null,
          ]
        : h(
            "div",
            {
              key: "none",
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 0",
                fontSize: 13,
                color: T.text2,
              },
            },
            se_dotText(false, t(copy, "se_guardNone")),
          ),
    ]),
    h("div", { key: "data", style: { ...se_cardStyle, marginTop: 12 } }, [
      h("div", { key: "head", style: se_cardHeadStyle }, t(copy, "se_dataDir")),
      h(
        "div",
        { key: "dir", style: se_monoStyle },
        health && health.dataDir ? health.dataDir : "—",
      ),
    ]),
    h("div", { key: "note", style: se_noteStyle }, t(copy, "se_readOnly")),
  ]);
}
