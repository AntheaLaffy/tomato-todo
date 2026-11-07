// 项目专属白名单：专注保护页（全部项目）与项目详情页（单个项目）共用。
//
// 为什么必须共用：语义来自 core 的 `effectiveWhitelist()`——专注某项目的任务
// 时，项目清单**替代**通用清单（不是追加）；项目清单为 null 时跟随通用。两处
// 各写一套，迟早出现「保护页能清空、项目页只能追加」这种两套行为。这里只保留
// 一个编辑器，两个入口只决定「编辑哪一个项目」。
//
// 保存模型与 guard 页的通用白名单一致：从最新快照读 appWhitelist，整体提交
// `setProjectWhitelist`。空列表在语义上等于「没有专属清单」，因此保存空列表
// 写入 null（跟随通用），而不是一个会锁死所有应用的 []。
import { h, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "./copy.js";
import {
  Btn,
  Card,
  Chip,
  Dot,
  Field,
  IconBtn,
  Input,
  Modal,
  SectionTitle,
  notify,
} from "./ui.js";
import { getApps } from "./api.js";
import { tryDispatch } from "./store.js";

registerCopy("pw", {
  zh: {
    title: "项目专属白名单",
    hint: "替代通用清单（不是追加）；不设置时跟随通用。",
    allHint: "每个项目可以覆盖通用白名单；不设置时跟随通用。",
    follow: "跟随通用",
    count: "{n} 个应用",
    edit: "编辑",
    clear: "跟随通用",
    none: "还没有项目，先创建学习项目。",
    empty: "还没有专属清单；从建议应用中选择，或手动输入 app id。",
    dialogHint: "保存后只影响这个项目的专注；清空并保存等于跟随通用清单。",
    saved: "已保存「{name}」的项目白名单",
    followed: "「{name}」已改为跟随通用白名单",
    manualTitle: "手动添加",
    addApp: "添加",
    appPlaceholder: "输入应用 id，如 code",
    removeApp: "移除 {name}",
    appRequired: "请先输入应用 id",
    appNoSpace: "应用 id 不能包含空白",
    appExists: "这个应用已经在清单里",
    suggestionsTitle: "建议应用",
    refreshApps: "刷新应用",
    refreshBusy: "正在枚举…",
    appsFailed: "读不到应用列表：{error}",
    noSuggestions: "没有可添加的运行中应用。",
    reset: "重置",
    save: "保存",
  },
  en: {
    title: "Project whitelist",
    hint: "Replaces the general list (it does not add to it); follow the general one when unset.",
    allHint:
      "Each project can override the general whitelist; unset means follow it.",
    follow: "Follow general",
    count: "{n} apps",
    edit: "Edit",
    clear: "Follow general",
    none: "No projects yet; create a study project first.",
    empty:
      "No project-specific list yet. Pick a running app or type an app id.",
    dialogHint:
      "Saving only affects focus sessions for this project; saving an empty list means follow the general one.",
    saved: "Saved the whitelist for “{name}”",
    followed: "“{name}” now follows the general whitelist",
    manualTitle: "Add manually",
    addApp: "Add",
    appPlaceholder: "App id, e.g. code",
    removeApp: "Remove {name}",
    appRequired: "Enter an app id first",
    appNoSpace: "App ids cannot contain whitespace",
    appExists: "That app is already on the list",
    suggestionsTitle: "Suggested apps",
    refreshApps: "Refresh apps",
    refreshBusy: "Scanning…",
    appsFailed: "Could not read the app list: {error}",
    noSuggestions: "No running apps left to add.",
    reset: "Reset",
    save: "Save",
  },
  ja: {
    title: "プロジェクト専用ホワイトリスト",
    hint: "一般のリストを置き換えます（追加ではありません）。未設定なら一般に従います。",
    allHint:
      "プロジェクトごとに一般のホワイトリストを上書きできます。未設定なら一般に従います。",
    follow: "一般に従う",
    count: "{n}件のアプリ",
    edit: "編集",
    clear: "一般に従う",
    none: "プロジェクトがありません。先に学習プロジェクトを作成してください。",
    empty:
      "専用リストはまだありません。実行中のアプリから選ぶか、アプリIDを入力してください。",
    dialogHint:
      "保存はこのプロジェクトの集中だけに影響します。空のまま保存すると一般のリストに従います。",
    saved: "「{name}」のプロジェクトホワイトリストを保存しました",
    followed: "「{name}」は一般のホワイトリストに従うようになりました",
    manualTitle: "手動で追加",
    addApp: "追加",
    appPlaceholder: "アプリID（例: code）",
    removeApp: "{name} を削除",
    appRequired: "先にアプリIDを入力してください",
    appNoSpace: "アプリIDに空白は使用できません",
    appExists: "そのアプリはすでにリストにあります",
    suggestionsTitle: "推奨アプリ",
    refreshApps: "アプリを更新",
    refreshBusy: "スキャン中…",
    appsFailed: "アプリ一覧を読み取れませんでした: {error}",
    noSuggestions: "追加できる実行中のアプリはありません。",
    reset: "リセット",
    save: "保存",
  },
});

/** 项目清单：null = 跟随通用；数组 = 替代通用（空数组也是「明确不要应用」）。 */
function whitelistOf(project) {
  return Array.isArray(project && project.appWhitelist)
    ? project.appWhitelist
    : null;
}

function sameList(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** 运行中应用 → 建议条目；只按 app id 去重，名称仅用于展示。 */
function normalizeApps(result) {
  const list = Array.isArray(result && result.apps) ? result.apps : [];
  const seen = new Set();
  const apps = [];
  for (const app of list) {
    const id = String(app && app.id !== undefined ? app.id : "").trim();
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    apps.push({ id, name: String((app && app.name) || id) });
  }
  apps.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  return apps;
}

/** 编辑器本体：已选 chips + 手动输入 + 建议应用。两种模式共用。 */
function WhitelistEditor({
  selected,
  draft,
  onDraft,
  onAdd,
  onRemove,
  apps,
  appsBusy,
  onRefreshApps,
  disabled = false,
}) {
  const suggestions = [];
  for (const app of apps ?? []) {
    if (selected.includes(app.id)) continue;
    suggestions.push(app);
    if (suggestions.length >= 18) break;
  }
  return h(
    "div",
    null,
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          minHeight: 30,
        },
      },
      selected.length === 0
        ? h(
            "div",
            { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
            t("pw.empty"),
          )
        : selected.map((app) =>
            h(
              "span",
              {
                key: app,
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  paddingLeft: 8,
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
                disabled,
                title: t("pw.removeApp", { name: app }),
                onClick: () => onRemove(app),
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
          marginTop: 12,
          flexWrap: "wrap",
        },
      },
      h(
        Field,
        {
          label: t("pw.manualTitle"),
          style: { flex: "1 1 220px", minWidth: 0 },
        },
        h(Input, {
          value: draft,
          disabled,
          placeholder: t("pw.appPlaceholder"),
          onChange: onDraft,
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd(draft);
            }
          },
        }),
      ),
      h(
        Btn,
        {
          variant: "soft",
          icon: "plus",
          disabled,
          onClick: () => onAdd(draft),
        },
        t("pw.addApp"),
      ),
      h(
        Btn,
        {
          variant: "ghost",
          icon: "refresh",
          disabled: disabled || appsBusy,
          onClick: onRefreshApps,
        },
        appsBusy ? t("pw.refreshBusy") : t("pw.refreshApps"),
      ),
    ),
    apps === null
      ? null
      : h(
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
            t("pw.suggestionsTitle"),
          ),
          suggestions.length === 0
            ? h(
                "div",
                { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
                t("pw.noSuggestions"),
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
                      onClick: disabled ? undefined : () => onAdd(app.id),
                    },
                    app.name,
                  ),
                ),
              ),
        ),
  );
}

/**
 * 项目白名单卡片。
 *
 * props:
 * - `projects`：全部项目（全部项目模式；专注保护页用）
 * - `project`：单个项目（单项目模式；项目详情页用）
 *
 * 两种模式共用 `WhitelistEditor` 与同一条 Action，区别只在入口：全部项目模式
 * 逐行编辑、对话框保存；单项目模式直接在本页编辑。
 */
export function ProjectWhitelistCard({ projects = [], project = null }) {
  const single = project !== null && project !== undefined;
  const [apps, setApps] = useState(null); // null = 还没枚举过
  const [appsBusy, setAppsBusy] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // 单项目模式：本地草稿；dirty 期间不让轮询把用户正在改的选择覆盖掉。
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState(() =>
    single ? (whitelistOf(project) ?? []) : [],
  );
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(null); // 全部项目模式：{id,name,selected}

  const savedList = single ? whitelistOf(project) : null;
  const savedKey = JSON.stringify(savedList);
  const projectId = single ? project.id : null;

  useEffect(() => {
    if (!single || dirty) return;
    setSelected(savedList ?? []);
    // 只按项目 id / 已保存清单同步；对象本身每次轮询都会换新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, savedKey, dirty]);

  const suggestionsLoaded = apps !== null;

  async function loadApps() {
    if (appsBusy) return;
    setAppsBusy(true);
    try {
      setApps(normalizeApps(await getApps()));
    } catch (e) {
      setApps([]);
      notify(
        t("pw.appsFailed", {
          error: (e && (e.userMessage || e.message)) || "unknown",
        }),
        "danger",
      );
    } finally {
      setAppsBusy(false);
    }
  }

  /** 校验一条 app id；返回 null 表示无效（错误已写进 error）。 */
  function checkApp(raw, list) {
    const app = String(raw ?? "").trim();
    if (app === "") {
      setError(t("pw.appRequired"));
      return null;
    }
    if (/\s/.test(app)) {
      setError(t("pw.appNoSpace"));
      return null;
    }
    if (list.includes(app)) {
      setError(t("pw.appExists"));
      return null;
    }
    setError(null);
    return app;
  }

  // ---- 单项目模式 ----

  function addSingle(raw) {
    const app = checkApp(raw, selected);
    if (app === null) return;
    setSelected([...selected, app]);
    setDraft("");
    setDirty(true);
  }

  function removeSingle(app) {
    setSelected(selected.filter((item) => item !== app));
    setDirty(true);
  }

  async function saveSingle(list) {
    if (busy || !single) return;
    setBusy(true);
    setError(null);
    const next = list.length > 0 ? list : null;
    const result = await tryDispatch({
      type: "setProjectWhitelist",
      id: project.id,
      whitelist: next,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      return false;
    }
    setDirty(false);
    notify(
      next === null
        ? t("pw.followed", { name: project.name })
        : t("pw.saved", { name: project.name }),
      "brand",
    );
    return true;
  }

  // ---- 全部项目模式 ----

  function openEditor(target) {
    setEditing({
      id: target.id,
      name: target.name,
      selected: whitelistOf(target) ? [...whitelistOf(target)] : [],
    });
    setDraft("");
    setError(null);
    if (apps === null && !appsBusy) void loadApps();
  }

  function addEditing(raw) {
    if (editing === null) return;
    const app = checkApp(raw, editing.selected);
    if (app === null) return;
    setEditing({ ...editing, selected: [...editing.selected, app] });
    setDraft("");
  }

  function removeEditing(app) {
    if (editing === null) return;
    setEditing({
      ...editing,
      selected: editing.selected.filter((item) => item !== app),
    });
  }

  async function saveEditing() {
    if (editing === null || busy) return;
    setBusy(true);
    setError(null);
    const next = editing.selected.length > 0 ? editing.selected : null;
    const result = await tryDispatch({
      type: "setProjectWhitelist",
      id: editing.id,
      whitelist: next,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || t("common.writeFailed"));
      return;
    }
    notify(
      next === null
        ? t("pw.followed", { name: editing.name })
        : t("pw.saved", { name: editing.name }),
      "brand",
    );
    setEditing(null);
  }

  async function followGeneral(target) {
    if (busy) return;
    setBusy(true);
    const result = await tryDispatch({
      type: "setProjectWhitelist",
      id: target.id,
      whitelist: null,
    });
    setBusy(false);
    if (!result.ok) {
      notify(result.error || t("common.writeFailed"), "danger");
      return;
    }
    setEditing(null);
    notify(t("pw.followed", { name: target.name }), "brand");
  }

  const singleList = whitelistOf(project);
  const changed = single && dirty && !sameList(selected, singleList ?? []);
  const singleSuggestions = selected;

  const singleBody = single
    ? h(
        "div",
        { style: { marginTop: 12 } },
        h(WhitelistEditor, {
          selected: singleSuggestions,
          draft,
          onDraft: setDraft,
          onAdd: addSingle,
          onRemove: removeSingle,
          apps,
          appsBusy,
          onRefreshApps: loadApps,
        }),
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 14,
              flexWrap: "wrap",
            },
          },
          h(
            Btn,
            {
              variant: "primary",
              size: "sm",
              icon: "check",
              disabled: busy,
              onClick: () => saveSingle(selected),
            },
            t("pw.save"),
          ),
          changed
            ? h(
                Btn,
                {
                  variant: "plain",
                  size: "sm",
                  disabled: busy,
                  onClick: () => {
                    setSelected(singleList ?? []);
                    setDirty(false);
                    setError(null);
                  },
                },
                t("pw.reset"),
              )
            : null,
          h("div", { style: { flex: 1 } }),
          singleList === null
            ? h(
                "span",
                { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
                t("pw.follow"),
              )
            : h(
                Btn,
                {
                  variant: "ghost",
                  size: "sm",
                  disabled: busy,
                  onClick: () => saveSingle([]),
                },
                t("pw.follow"),
              ),
        ),
        error
          ? h(
              "div",
              {
                role: "alert",
                style: {
                  marginTop: 10,
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--tomato-brand-soft)",
                  color: "var(--tomato-brand-deep)",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                },
              },
              error,
            )
          : null,
      )
    : null;

  const allBody = !single
    ? h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 2 } },
        projects.length === 0
          ? h(
              "div",
              { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
              t("pw.none"),
            )
          : projects.map((item) => {
              const list = whitelistOf(item);
              return h(
                "div",
                {
                  key: item.id,
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 2px",
                    borderBottom: "1px solid var(--tomato-line)",
                    flexWrap: "wrap",
                  },
                },
                h(Dot, { color: item.color || "var(--tomato-ink-3)" }),
                h(
                  "span",
                  { style: { fontSize: 12.5, color: "var(--tomato-ink)" } },
                  item.name,
                ),
                h(
                  "span",
                  { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
                  list === null
                    ? t("pw.follow")
                    : t("pw.count", { n: list.length }),
                ),
                h("div", { style: { flex: 1 } }),
                h(
                  Btn,
                  {
                    variant: "ghost",
                    size: "sm",
                    onClick: () => openEditor(item),
                  },
                  t("pw.edit"),
                ),
                list === null
                  ? null
                  : h(
                      Btn,
                      {
                        variant: "plain",
                        size: "sm",
                        disabled: busy,
                        onClick: () => followGeneral(item),
                      },
                      t("pw.clear"),
                    ),
              );
            }),
      )
    : null;

  return h(
    "div",
    null,
    h(
      Card,
      null,
      h(SectionTitle, {
        icon: "lock",
        title: t("pw.title"),
        hint: single ? t("pw.hint") : t("pw.allHint"),
      }),
      single ? singleBody : allBody,
    ),
    !single && editing !== null
      ? h(
          Modal,
          {
            open: true,
            onClose: () => (busy ? null : setEditing(null)),
            icon: "lock",
            title: t("pw.title"),
            subtitle: t("pw.dialogHint"),
            footer: h(
              "div",
              { style: { display: "flex", gap: 9, width: "100%" } },
              h("div", { style: { flex: 1 } }),
              h(
                Btn,
                {
                  variant: "plain",
                  size: "sm",
                  disabled: busy,
                  onClick: () => setEditing(null),
                },
                t("common.cancel"),
              ),
              h(
                Btn,
                {
                  variant: "primary",
                  size: "sm",
                  icon: "check",
                  disabled: busy,
                  onClick: saveEditing,
                },
                t("common.save"),
              ),
            ),
          },
          h(
            "div",
            {
              style: {
                fontSize: 13,
                fontWeight: 600,
                color: "var(--tomato-ink)",
                marginBottom: 10,
              },
            },
            editing.name,
          ),
          h(WhitelistEditor, {
            selected: editing.selected,
            draft,
            onDraft: setDraft,
            onAdd: addEditing,
            onRemove: removeEditing,
            apps,
            appsBusy,
            onRefreshApps: loadApps,
          }),
          error
            ? h(
                "div",
                {
                  role: "alert",
                  style: {
                    marginTop: 10,
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "var(--tomato-brand-soft)",
                    color: "var(--tomato-brand-deep)",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  },
                },
                error,
              )
            : null,
        )
      : null,
  );
}
