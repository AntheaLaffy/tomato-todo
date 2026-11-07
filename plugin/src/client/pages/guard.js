// 专注保护：保护模式、严格模式、应用白名单与 guard 运行状态。
//
// 为什么整页只有一个 Settings 写入口：core 的 saveSettings 要求完整 Settings，
// 保护设置只是其中一个字段；页面每次改动都浅拷贝当前快照里的 settings，再整体
// 覆写 protection。这样既不会丢其他设置，也不会把旧版的 allowedApps 字段带回去。
// 保护规则不可绕开：本页不提供任何解锁入口，严格模式生效时写操作会被 core 拒绝。
import { h, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import {
  PageHeader,
  Card,
  Btn,
  IconBtn,
  Chip,
  Dot,
  Badge,
  Toggle,
  Input,
  Field,
  Skeleton,
  SectionTitle,
  notify,
} from "../shared/ui.js";
import { Icon } from "../shared/icons.js";
import { useSnapshot, tryDispatch, getSnapshot } from "../shared/store.js";
import { getApps } from "../shared/api.js";
import { protectionView } from "../shared/derive.js";
import { registerPage } from "../app/registry.js";

registerCopy("guard", {
  zh: {
    eyebrow: "番茄 Todo",
    title: "专注保护",
    subtitle:
      "专注开始后，由原生 guard 把非白名单窗口切回，让注意力只留在一件事上。",
    refresh: "刷新",
    modesTitle: "保护模式",
    modesHint: "点击切换，立即保存",
    modeOff: "自由专注",
    modeOffDesc: "不锁定任何窗口，只做番茄计时。",
    modeLock: "界面锁定",
    modeLockDesc: "专注时全屏遮住其他窗口，只看得到计时。",
    modeWhitelist: "应用白名单",
    modeWhitelistDesc: "只允许白名单里的应用留在前台。",
    current: "当前",
    strictSection: "自律",
    strictLabel: "严格模式",
    strictHint: "保护生效时不能提前退出，只能等计时结束。",
    strictOffHint:
      "当前是自由专注；严格模式会在开启界面锁定或应用白名单后才生效。",
    strictActiveHint: "严格模式正在生效：不能提前退出，页面不提供解锁入口。",
    whitelistTitle: "应用白名单",
    whitelistHint: "以整个应用 id 为单位，不需要填窗口标题。",
    whitelistDisabled: "切换到「应用白名单」后即可编辑。",
    whitelistEmpty: "白名单还是空的；下面挑几个常用应用，或手动输入 app id。",
    manualTitle: "手动添加",
    addApp: "添加",
    appPlaceholder: "输入应用 id，如 code",
    removeApp: "移除 {name}",
    appRequired: "请先输入应用 id",
    appNoSpace: "应用 id 不能包含空白",
    appExists: "这个应用已经在白名单里",
    appAdded: "已加入白名单：{name}",
    appRemoved: "已从白名单移除：{name}",
    suggestionsTitle: "建议应用",
    refreshApps: "刷新应用",
    refreshBusy: "正在枚举…",
    refreshFound: "找到 {n} 个已安装应用。",
    refreshEmpty: "没有找到可添加的已安装应用。",
    refreshFailed: "读不到应用列表：{error}",
    appsHint: "来自桌面入口（app_id 即 .desktop 文件名），未启动的应用也能选。",
    noSuggestions: "没有可添加的建议应用。",
    semanticsTitle: "白名单如何工作",
    semantics: [
      "白名单以整个应用 id 为单位，而不是某个窗口或标签页。",
      "保护生效时，guard 约每 0.6 秒检查一次前台窗口，把不在白名单里的切回去。",
      "系统级快捷键、全屏游戏和多显示器可能让切回失效，个别窗口需要手动处理。",
      "白名单只在保护真正生效时起作用：专注正在运行，且模式不是「自由专注」。",
      "项目可以设置专属白名单替代通用白名单，优先于这里的配置。",
    ],
    statusTitle: "guard 运行状态",
    statusAvailable: "guard 正在运行",
    statusUnavailable: "guard 未运行",
    statusUnavailableHint: "保护规则会保存，但界面不会真的被锁定。",
    backend: "后端",
    locked: "锁定状态",
    lockedYes: "锁定中",
    lockedNo: "未锁定",
    pid: "进程 PID",
    guardWhitelist: "guard 白名单",
    count: "{n} 个应用",
    unknown: "未知",
    activeBadge: "保护生效中",
    idleBadge: "未在保护",
    activeHint: "保护已生效；严格模式下不能提前退出，页面不提供解锁入口。",
    idleHint: "开始一个专注，保护才会实际接管。",
  },
  en: {
    eyebrow: "Tomato Todo",
    title: "Focus guard",
    subtitle:
      "Once focus starts, the native guard sends non-whitelisted windows back so attention stays on one thing.",
    refresh: "Refresh",
    modesTitle: "Protection mode",
    modesHint: "Click to switch; saved immediately",
    modeOff: "Free focus",
    modeOffDesc: "Nothing is locked; only the pomodoro timer runs.",
    modeLock: "Screen lock",
    modeLockDesc:
      "While focusing, a full-screen layer covers every other window except the timer.",
    modeWhitelist: "App whitelist",
    modeWhitelistDesc: "Only apps on the whitelist may stay in the foreground.",
    current: "Current",
    strictSection: "Discipline",
    strictLabel: "Strict mode",
    strictHint:
      "While protection is active you cannot exit early; wait for the timer to end.",
    strictOffHint:
      "Free focus is selected; strict mode applies once screen lock or the app whitelist is on.",
    strictActiveHint:
      "Strict mode is active: no early exit, and this page offers no unlock action.",
    whitelistTitle: "App whitelist",
    whitelistHint: "Entries are whole app ids, not window titles.",
    whitelistDisabled: "Switch to “App whitelist” to edit this list.",
    whitelistEmpty:
      "The whitelist is empty. Pick a common app below, or type an app id.",
    manualTitle: "Add manually",
    addApp: "Add",
    appPlaceholder: "App id, e.g. code",
    removeApp: "Remove {name}",
    appRequired: "Enter an app id first",
    appNoSpace: "App ids cannot contain whitespace",
    appExists: "That app is already on the whitelist",
    appAdded: "Added to whitelist: {name}",
    appRemoved: "Removed from whitelist: {name}",
    suggestionsTitle: "Suggested apps",
    refreshApps: "Refresh apps",
    refreshBusy: "Scanning…",
    refreshFound: "{n} installed apps found.",
    refreshEmpty: "No installed apps left to add.",
    refreshFailed: "Could not read the app list: {error}",
    appsHint:
      "Read from desktop entries — the app id is the .desktop file name, so apps that are not running can still be picked.",
    noSuggestions: "No suggested apps left to add.",
    semanticsTitle: "How the whitelist works",
    semantics: [
      "The whitelist works by whole app id, not by window or tab.",
      "While protection is active the guard checks the foreground window about every 0.6 seconds and sends back anything not whitelisted.",
      "System shortcuts, full-screen games, and multiple monitors can defeat the switch-back; some windows need manual handling.",
      "The whitelist only applies while protection is truly active: a focus timer is running and the mode is not Free focus.",
      "A project can define its own whitelist to replace the general one; it takes precedence over this configuration.",
    ],
    statusTitle: "Guard status",
    statusAvailable: "Guard is running",
    statusUnavailable: "Guard is not running",
    statusUnavailableHint:
      "Protection rules are saved, but the screen will not actually be locked.",
    backend: "Backend",
    locked: "Lock state",
    lockedYes: "Locked",
    lockedNo: "Not locked",
    pid: "Process PID",
    guardWhitelist: "Guard whitelist",
    count: "{n} apps",
    unknown: "Unknown",
    activeBadge: "Protection active",
    idleBadge: "Not protecting",
    activeHint:
      "Protection is active; strict mode cannot be exited early, and this page offers no unlock action.",
    idleHint: "Start a focus session for protection to take over.",
  },
});

const MODES = [
  { value: "off", icon: "sun", title: "modeOff", desc: "modeOffDesc" },
  { value: "lock", icon: "lock", title: "modeLock", desc: "modeLockDesc" },
  {
    value: "whitelist",
    icon: "shield",
    title: "modeWhitelist",
    desc: "modeWhitelistDesc",
  },
];

// 旧版常用 app id：runtime 没有应用枚举端点，用它作为冷启动建议。
const LEGACY_APPS = [
  "firefox",
  "code",
  "ChatGPT",
  "wps-office",
  "bili-live-hime",
  "kitty",
];

/** 读 protection，兼容旧快照的 allowedApps 字段；写回一律用 whitelist。 */
function readProtection(settings) {
  const raw = (settings && settings.protection) || {};
  const list = Array.isArray(raw.whitelist)
    ? raw.whitelist
    : Array.isArray(raw.allowedApps)
      ? raw.allowedApps
      : [];
  const seen = new Set();
  const whitelist = [];
  for (const item of list) {
    const app = String(item ?? "").trim();
    if (app === "" || seen.has(app)) continue;
    seen.add(app);
    whitelist.push(app);
  }
  return {
    mode: raw.mode === "lock" || raw.mode === "whitelist" ? raw.mode : "off",
    whitelist,
    strict: !!raw.strict,
  };
}

/** 从快照已知来源重建设备上的建议列表（项目白名单、当前白名单、guard 白名单、旧版常用）。 */
function buildSuggestions(state, whitelist) {
  const data = (state && state.data) || {};
  const settings = data.settings || {};
  const rawProtection = settings.protection || {};
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const guard = (state && state.guard) || {};
  const guardList = Array.isArray(guard.whitelist) ? guard.whitelist : [];
  const sources = [
    ...LEGACY_APPS,
    ...(Array.isArray(rawProtection.whitelist) ? rawProtection.whitelist : []),
    ...(Array.isArray(rawProtection.allowedApps)
      ? rawProtection.allowedApps
      : []),
    ...projects.flatMap((project) =>
      Array.isArray(project.appWhitelist) ? project.appWhitelist : [],
    ),
    ...guardList,
  ];
  const seen = new Set(whitelist);
  const out = [];
  for (const raw of sources) {
    const app = String(raw ?? "").trim();
    if (app === "" || /\s/.test(app) || seen.has(app)) continue;
    seen.add(app);
    out.push(app);
    if (out.length >= 24) break;
  }
  return out;
}

function ModeCard({ option, selected, onSelect }) {
  return h(
    Card,
    {
      role: "button",
      tabIndex: 0,
      "aria-pressed": selected,
      onClick: onSelect,
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      },
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "16px 16px",
        cursor: "pointer",
        border: selected
          ? "1px solid var(--tomato-brand)"
          : "1px solid var(--tomato-line)",
        background: selected
          ? "var(--tomato-brand-soft)"
          : "var(--tomato-surface)",
        boxShadow: "none",
        transition: "border-color .2s ease, background .2s ease",
      },
    },
    h(
      "span",
      {
        style: {
          width: 36,
          height: 36,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          flex: "none",
          background: selected
            ? "var(--tomato-surface)"
            : "var(--tomato-surface-2)",
          color: selected ? "var(--tomato-brand-deep)" : "var(--tomato-ink-2)",
        },
      },
      h(Icon, { name: option.icon, size: 19 }),
    ),
    h(
      "div",
      { style: { minWidth: 0, flex: 1 } },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          },
        },
        h(
          "span",
          {
            style: {
              fontSize: 14,
              fontWeight: 620,
              color: "var(--tomato-ink)",
            },
          },
          t("guard." + option.title),
        ),
        selected ? h(Badge, { tone: "brand" }, t("guard.current")) : null,
      ),
      h(
        "div",
        {
          style: {
            fontSize: 12,
            color: "var(--tomato-ink-3)",
            lineHeight: 1.55,
            marginTop: 4,
          },
        },
        t("guard." + option.desc),
      ),
    ),
  );
}

function StatusCell({ label, value }) {
  return h(
    "div",
    {
      style: {
        minWidth: 0,
        padding: "9px 11px",
        borderRadius: 10,
        background: "var(--tomato-surface-2)",
      },
    },
    h(
      "div",
      {
        style: { fontSize: 11, color: "var(--tomato-ink-3)", marginBottom: 3 },
      },
      label,
    ),
    h(
      "div",
      {
        className: "t-mono",
        style: {
          fontSize: 12.5,
          color: "var(--tomato-ink)",
          wordBreak: "break-all",
        },
      },
      value,
    ),
  );
}

function GuardSkeleton() {
  return h(
    "div",
    { className: "t-root" },
    h(PageHeader, {
      eyebrow: t("guard.eyebrow"),
      title: t("guard.title"),
      subtitle: t("guard.subtitle"),
    }),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 18 } },
      h(
        Card,
        null,
        h(Skeleton, { w: "34%", h: 15 }),
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: 12,
              marginTop: 16,
              flexWrap: "wrap",
            },
          },
          [
            h(Skeleton, { key: 1, w: 200, h: 96, r: 14 }),
            h(Skeleton, { key: 2, w: 200, h: 96, r: 14 }),
            h(Skeleton, { key: 3, w: 200, h: 96, r: 14 }),
          ],
        ),
      ),
      h(
        Card,
        null,
        h(Skeleton, { w: "46%", h: 14 }),
        h(Skeleton, { w: "68%", h: 12, style: { marginTop: 14 } }),
        h(Skeleton, { w: "58%", h: 12, style: { marginTop: 8 } }),
      ),
    ),
  );
}

export function GuardPage({ refresh }) {
  const state = useSnapshot();
  const [draft, setDraft] = useState("");
  // 应用枚举是页面里唯一「按需拉一次」的数据：白名单要的是还没启动的应用，
  // 所以不能靠快照推。null = 还没点过刷新。
  const [apps, setApps] = useState(null);
  const [appsBusy, setAppsBusy] = useState(false);
  if (state === null) return h(GuardSkeleton, null);

  const data = state.data || {};
  const settings = data.settings || {};
  const protection = readProtection(settings);
  const view = protectionView(state);
  const guard =
    state.guard && typeof state.guard === "object" ? state.guard : {};
  const available = guard.available === true;
  const guardWhitelist = Array.isArray(guard.whitelist) ? guard.whitelist : [];
  const active = !!view.active;
  const whitelist = protection.whitelist;
  const editable = protection.mode === "whitelist";
  // 建议列表两种来源：还没刷新时用配置里出现过的 app id；刷新后用真实枚举，
  // 名称给人看、id 写进白名单（两者在常见应用里不同，例如 文件 ↔ nautilus）。
  const suggestions =
    apps !== null
      ? apps.filter((app) => !whitelist.includes(app.id)).slice(0, 24)
      : buildSuggestions(state, whitelist).map((id) => ({ id, name: id }));
  const semantics = t("guard.semantics");
  const semanticItems = Array.isArray(semantics) ? semantics : [];
  const pid =
    guard.pid === null || guard.pid === undefined
      ? t("guard.unknown")
      : String(guard.pid);

  /** 从最新快照读 settings，按 patch 覆写 protection 后整体提交。 */
  async function saveProtection(patch) {
    const snapshot = getSnapshot() || state;
    const latest =
      (snapshot && snapshot.data && snapshot.data.settings) || settings;
    const nextProtection = { ...readProtection(latest), ...patch };
    const result = await tryDispatch({
      type: "saveSettings",
      settings: { ...(latest || {}), protection: nextProtection },
    });
    if (!result.ok) notify(result.error, "danger");
    return result.ok;
  }

  async function selectMode(mode) {
    if (mode === protection.mode) return;
    await saveProtection({ mode });
  }

  async function setStrict(value) {
    await saveProtection({ strict: value });
  }

  function latestWhitelist() {
    const snapshot = getSnapshot() || state;
    const latest =
      (snapshot && snapshot.data && snapshot.data.settings) || settings;
    return readProtection(latest).whitelist;
  }

  async function addApp(raw) {
    const value = String(raw ?? "").trim();
    if (value === "") {
      notify(t("guard.appRequired"), "danger");
      return;
    }
    if (/\s/.test(value)) {
      notify(t("guard.appNoSpace"), "danger");
      return;
    }
    const current = latestWhitelist();
    if (current.includes(value)) {
      notify(t("guard.appExists"), "danger");
      return;
    }
    const ok = await saveProtection({ whitelist: [...current, value] });
    if (ok) {
      setDraft("");
      notify(t("guard.appAdded", { name: value }), "brand");
    }
  }

  async function removeApp(app) {
    const current = latestWhitelist();
    const next = current.filter((item) => item !== app);
    const ok = await saveProtection({ whitelist: next });
    if (ok) notify(t("guard.appRemoved", { name: app }), "brand");
  }

  async function refreshApps() {
    if (appsBusy) return;
    setAppsBusy(true);
    try {
      const result = await getApps();
      const list = Array.isArray(result && result.apps) ? result.apps : [];
      const known = new Set(buildSuggestions(state, []));
      const ranked = list
        .map((app) => ({
          id: String(app.id ?? ""),
          name: String(app.name ?? app.id ?? ""),
          known: known.has(app.id),
        }))
        .filter((app) => app.id !== "")
        .sort((a, b) => Number(b.known) - Number(a.known) || a.name.localeCompare(b.name, "zh-Hans-CN"));
      setApps(ranked);
      if (ranked.length === 0) notify(t("guard.refreshEmpty"), "neutral");
      else notify(t("guard.refreshFound", { n: ranked.length }), "brand");
    } catch (error) {
      const message = (error && (error.userMessage || error.message)) || "未知错误";
      notify(t("guard.refreshFailed", { error: message }), "danger");
    } finally {
      setAppsBusy(false);
    }
  }

  return h(
    "div",
    { className: "t-root" },
    h(PageHeader, {
      eyebrow: t("guard.eyebrow"),
      title: t("guard.title"),
      subtitle: t("guard.subtitle"),
      actions: h(IconBtn, {
        name: "refresh",
        title: t("guard.refresh"),
        onClick: () => refresh?.(),
      }),
    }),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 18 } },

      // ---- 三种保护模式 ----
      h(
        Card,
        null,
        h(SectionTitle, {
          icon: "shield",
          title: t("guard.modesTitle"),
          hint: t("guard.modesHint"),
        }),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 12,
            },
          },
          MODES.map((option) =>
            h(ModeCard, {
              key: option.value,
              option,
              selected: protection.mode === option.value,
              onSelect: () => selectMode(option.value),
            }),
          ),
        ),
      ),

      // ---- 严格模式 ----
      h(
        Card,
        null,
        h(SectionTitle, { icon: "lock", title: t("guard.strictSection") }),
        h(Toggle, {
          checked: protection.strict,
          onChange: setStrict,
          label: t("guard.strictLabel"),
          hint: t("guard.strictHint"),
        }),
        protection.mode === "off"
          ? h(
              "div",
              {
                style: {
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--tomato-ink-3)",
                  lineHeight: 1.6,
                },
              },
              t("guard.strictOffHint"),
            )
          : null,
        active && protection.strict
          ? h(
              "div",
              {
                style: {
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--tomato-brand-deep)",
                  lineHeight: 1.6,
                },
              },
              t("guard.strictActiveHint"),
            )
          : null,
      ),

      // ---- 白名单编辑器 ----
      h(
        Card,
        null,
        h(SectionTitle, {
          icon: "shield",
          title: t("guard.whitelistTitle"),
          hint: t("guard.whitelistHint"),
        }),
        editable
          ? null
          : h(
              "div",
              {
                style: {
                  fontSize: 12,
                  color: "var(--tomato-ink-3)",
                  marginBottom: 10,
                  lineHeight: 1.6,
                },
              },
              t("guard.whitelistDisabled"),
            ),
        whitelist.length === 0
          ? h(
              "div",
              {
                style: {
                  fontSize: 12.5,
                  color: "var(--tomato-ink-3)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                },
              },
              t("guard.whitelistEmpty"),
            )
          : h(
              "div",
              {
                style: {
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 12,
                  opacity: editable ? 1 : 0.6,
                },
              },
              whitelist.map((app) =>
                h(
                  "span",
                  {
                    key: app,
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      paddingRight: 2,
                      borderRadius: 8,
                      background: "var(--tomato-brand-soft)",
                      flex: "none",
                    },
                  },
                  h(
                    Chip,
                    { tone: "brand", style: { background: "transparent" } },
                    app,
                  ),
                  h(IconBtn, {
                    name: "x",
                    box: 18,
                    size: 11,
                    disabled: !editable,
                    title: t("guard.removeApp", { name: app }),
                    onClick: () => removeApp(app),
                  }),
                ),
              ),
            ),
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              flexWrap: "wrap",
            },
          },
          h(
            Field,
            {
              label: t("guard.manualTitle"),
              style: { flex: "1 1 220px", minWidth: 0 },
            },
            h(Input, {
              value: draft,
              disabled: !editable,
              placeholder: t("guard.appPlaceholder"),
              onChange: setDraft,
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addApp(draft);
                }
              },
            }),
          ),
          h(
            Btn,
            {
              variant: "soft",
              icon: "plus",
              disabled: !editable,
              onClick: () => addApp(draft),
            },
            t("guard.addApp"),
          ),
          h(
            Btn,
            {
              variant: "ghost",
              icon: "refresh",
              disabled: appsBusy,
              onClick: refreshApps,
            },
            appsBusy ? t("guard.refreshBusy") : t("guard.refreshApps"),
          ),
        ),
        h(
          "div",
          { style: { marginTop: 14 } },
          h(
            "div",
            {
              style: {
                fontSize: 11.5,
                color: "var(--tomato-ink-3)",
                marginBottom: 7,
              },
            },
            t("guard.suggestionsTitle"),
          ),
          apps !== null
            ? h(
                "div",
                {
                  style: {
                    fontSize: 11,
                    color: "var(--tomato-ink-3)",
                    marginBottom: 8,
                  },
                },
                t("guard.appsHint"),
              )
            : null,
          suggestions.length === 0
            ? h(
                "div",
                { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
                t("guard.noSuggestions"),
              )
            : h(
                "div",
                { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
                suggestions.map((app) =>
                  h(
                    Chip,
                    {
                      key: app.id,
                      icon: "plus",
                      tone: "neutral",
                      title: app.name === app.id ? undefined : app.id,
                      style: editable ? undefined : { opacity: 0.55 },
                      onClick: editable ? () => addApp(app.id) : undefined,
                    },
                    app.name,
                  ),
                ),
              ),
        ),
      ),

      // ---- 白名单语义 ----
      h(
        Card,
        null,
        h(SectionTitle, { icon: "leaf", title: t("guard.semanticsTitle") }),
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 8,
            },
          },
          semanticItems.map((item, index) =>
            h(
              "div",
              {
                key: index,
                style: {
                  display: "flex",
                  gap: 9,
                  fontSize: 12.5,
                  color: "var(--tomato-ink-2)",
                  lineHeight: 1.65,
                },
              },
              h(Dot, {
                color: "var(--tomato-brand)",
                size: 5,
                style: { marginTop: 8 },
              }),
              h("span", { style: { minWidth: 0 } }, item),
            ),
          ),
        ),
      ),

      // ---- guard 运行状态 ----
      h(
        Card,
        null,
        h(SectionTitle, {
          icon: "timer",
          title: t("guard.statusTitle"),
          action: h(IconBtn, {
            name: "refresh",
            title: t("guard.refresh"),
            onClick: () => refresh?.(),
          }),
        }),
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            },
          },
          h(Dot, {
            color: available
              ? "var(--tomato-leaf)"
              : "var(--dsw-alias-state-error-primary)",
            size: 8,
          }),
          h(
            "span",
            {
              style: {
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--tomato-ink)",
              },
            },
            available
              ? t("guard.statusAvailable")
              : t("guard.statusUnavailable"),
          ),
          h(
            Badge,
            { tone: active ? "brand" : "neutral" },
            active ? t("guard.activeBadge") : t("guard.idleBadge"),
          ),
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
            },
          },
          h(StatusCell, {
            label: t("guard.backend"),
            value: guard.backend || t("guard.unknown"),
          }),
          h(StatusCell, {
            label: t("guard.locked"),
            value: guard.locked ? t("guard.lockedYes") : t("guard.lockedNo"),
          }),
          h(StatusCell, { label: t("guard.pid"), value: pid }),
          h(StatusCell, {
            label: t("guard.guardWhitelist"),
            value: t("guard.count", { n: guardWhitelist.length }),
          }),
        ),
        !available
          ? h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 11,
                  background: "var(--tomato-surface-2)",
                },
              },
              h(
                "span",
                {
                  style: {
                    flex: "1 1 220px",
                    fontSize: 12,
                    color: "var(--tomato-ink-2)",
                    lineHeight: 1.6,
                  },
                },
                t("guard.statusUnavailableHint"),
              ),
              h(
                Btn,
                {
                  size: "sm",
                  variant: "soft",
                  icon: "refresh",
                  onClick: () => refresh?.(),
                },
                t("guard.refresh"),
              ),
            )
          : null,
        h(
          "div",
          {
            style: {
              marginTop: 12,
              fontSize: 12,
              color: "var(--tomato-ink-3)",
              lineHeight: 1.6,
            },
          },
          active ? t("guard.activeHint") : t("guard.idleHint"),
        ),
      ),
    ),
  );
}

registerPage({
  id: "guard",
  order: 70,
  icon: "shield",
  titleKey: "nav.guard",
  Component: GuardPage,
});
