// DSH 设置-通用 里的一行：番茄氛围（观感开关，不影响学习数据）。
//
// 一行包含三件事：
// - 氛围总开关（localStorage）：关掉天空层/地面层，只留下纸色配色。
// - 时段：自动跟随本地时间，或手动固定晨光/白天/黄昏/夜读。
// - 角色背景板（settings.personaBackdrop）：旧版数据语义，写回 core Settings，
//   换设备也一致。
import { h, useState, useEffect } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Toggle, Select, Dot } from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { getSkinPrefs, setSkinPrefs, subscribeSkinPrefs } from "./prefs.js";

registerCopy("skinprefs", {
  zh: {
    title: "番茄氛围",
    desc: "打开 DSH 就在慢学习的纸色氛围里：窗光、微尘与线描书桌。不影响学习数据。",
    ambience: "氛围层",
    daypart: "时段",
    auto: "跟随时间",
    morning: "晨光",
    day: "白天",
    dusk: "黄昏",
    night: "夜读",
    backdrop: "角色背景板",
    backdropOff: "已隐藏插画，只留窗光",
    backdropUnavailable: "运行时未连接，暂时无法修改背景板",
    saveFailed: "保存失败：{error}",
  },
  en: {
    title: "Tomato ambience",
    desc: "Opening DSH lands you in a slow study mood: window light, drifting motes and a line-art desk. Study data is untouched.",
    ambience: "Ambience layer",
    daypart: "Time of day",
    auto: "Follow clock",
    morning: "Morning",
    day: "Daylight",
    dusk: "Dusk",
    night: "Night reading",
    backdrop: "Illustration",
    backdropOff: "Illustration hidden; window light remains",
    backdropUnavailable: "Runtime offline — illustration can't be changed now",
    saveFailed: "Couldn't save: {error}",
  },
});

function Row({ label, hint, children, dim = false }) {
  return h(
    "div",
    {
      className: "t-root",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "9px 0",
        minWidth: 0,
        opacity: dim ? 0.6 : 1,
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
            fontWeight: 550,
            color: "var(--dsw-alias-label-primary, var(--tomato-ink))",
          },
        },
        label,
      ),
      hint
        ? h(
            "div",
            {
              style: {
                fontSize: 11.5,
                lineHeight: 1.5,
                marginTop: 2,
                color: "var(--dsw-alias-label-tertiary, var(--tomato-ink-3))",
              },
            },
            hint,
          )
        : null,
    ),
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, flex: "none" } }, children),
  );
}

export function TomatoSkinSettingsRow() {
  const state = useSnapshot();
  const [prefs, setPrefs] = useState(getSkinPrefs());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => subscribeSkinPrefs(setPrefs), []);

  const settings = (state && state.data && state.data.settings) || null;
  const backdrop = settings ? !!settings.personaBackdrop : true;

  const toggleBackdrop = async (next) => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const res = await tryDispatch({ type: "saveSettings", settings: { ...settings, personaBackdrop: next } });
    setSaving(false);
    if (!res.ok) setError(res.error);
  };

  return h(
    "div",
    { className: "t-root", style: { display: "flex", flexDirection: "column", gap: 2 } },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 650,
          color: "var(--dsw-alias-label-primary, var(--tomato-ink))",
          marginBottom: 2,
        },
      },
      h(Dot, { color: "var(--tomato-brand)", size: 6 }),
      t("skinprefs.title"),
    ),
    h(
      "div",
      {
        style: {
          fontSize: 11.5,
          lineHeight: 1.6,
          color: "var(--dsw-alias-label-tertiary, var(--tomato-ink-3))",
          marginBottom: 4,
        },
      },
      t("skinprefs.desc"),
    ),
    h(
      Row,
      { label: t("skinprefs.ambience") },
      h(Toggle, {
        checked: prefs.ambience,
        onChange: (next) => setSkinPrefs({ ambience: next }),
      }),
    ),
    h(
      Row,
      { label: t("skinprefs.daypart") },
      h(Select, {
        value: prefs.daypart,
        width: 132,
        options: [
          { value: "auto", label: t("skinprefs.auto") },
          { value: "morning", label: t("skinprefs.morning") },
          { value: "day", label: t("skinprefs.day") },
          { value: "dusk", label: t("skinprefs.dusk") },
          { value: "night", label: t("skinprefs.night") },
        ],
        onChange: (next) => setSkinPrefs({ daypart: next }),
      }),
    ),
    h(
      Row,
      {
        label: t("skinprefs.backdrop"),
        hint: settings ? (backdrop ? undefined : t("skinprefs.backdropOff")) : t("skinprefs.backdropUnavailable"),
        dim: !settings || saving,
      },
      h(Toggle, {
        checked: backdrop,
        onChange: (next) => {
          if (!settings || saving) return;
          toggleBackdrop(next);
        },
      }),
    ),
    error
      ? h(
          "div",
          {
            style: {
              fontSize: 11.5,
              color: "var(--dsw-alias-state-error-primary, #b8503f)",
              paddingTop: 2,
            },
          },
          t("skinprefs.saveFailed", { error }),
        )
      : null,
  );
}
