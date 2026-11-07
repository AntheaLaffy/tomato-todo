// 偏好设置：番茄钟、学习计划、体验与提醒、桌面集成、网络、数据与备份。
//
// 数据来源只有一个：/api/state 的 data.settings。页面把快照克隆成本地草稿，
// 用户改动只落在草稿里，点「保存设置」时把完整 Settings 一次 submit 给
// saveSettings（必须完整：core 校验全部字段，且不能把 protection 清掉）。
// 离开页面不自动保存，避免轮询/卸载时序里把半截草稿写进 runtime。
import { h, useState, useEffect, useRef } from "../runtime.js";
import { t, registerCopy, useLocale } from "../shared/copy.js";
import {
  PageHeader,
  Card,
  SectionTitle,
  Btn,
  Chip,
  Input,
  Select,
  Toggle,
  Segmented,
  Modal,
  Divider,
  Empty,
  Skeleton,
  notify,
} from "../shared/ui.js";
import { useSnapshot, tryDispatch } from "../shared/store.js";
import { registerPage } from "../app/registry.js";

registerCopy("prefs", {
  zh: {
    eyebrow: "番茄 Todo",
    title: "偏好设置",
    subtitle: "番茄钟、学习计划、提醒与数据。所有更改保存到本机。",
    save: "保存设置",
    saving: "保存中…",
    saved: "设置已保存",
    unsaved: "有未保存的更改",
    discard: "放弃更改",
    loading: "正在读取设置…",
    offlineTitle: "运行时未连接",
    offlineHint: "设置读不到时不会伪造默认值；等 runtime 恢复后自动读取。",
    saveFailed: "保存失败：{error}",
    rangeError: "{label} 需要是 {min}–{max} 的整数",
    unitMin: "分钟",
    unitRound: "轮",
    unitCount: "个",
    sectionFocus: "专注与休息",
    sectionFocusHint: "默认时长只影响下一次重置，正在进行的计时不受影响。",
    focusMinutes: "专注时长",
    shortBreak: "短休息",
    longBreak: "长休息",
    longBreakEvery: "长休息间隔",
    dailyGoal: "每日番茄目标",
    autoBreak: "自动开始休息",
    autoBreakHint: "专注结束后自动进入休息计时。",
    autoFocus: "自动开始下一轮",
    autoFocusHint: "休息结束后继续当前任务剩余轮次。",
    autoStartTasks: "到时间自动开始",
    autoStartTasksHint:
      "任务提醒时刻到达时自动开始专注；计时、锁机或考试中不抢占。",
    sectionPlan: "学习计划",
    sectionPlanHint:
      "计划文件只交换任务与安排，保留完成进度和专注历史；导入按 ID 合并。",
    exportPlan: "导出计划",
    importPlan: "导入计划",
    exportPending: "运行时导出端点尚未就绪，暂不可用。",
    exportFailed: "导出失败：{error}",
    exportDone: "已导出",
    planImported: "计划已导入",
    planImportFailed: "导入计划失败：{error}",
    importInvalid: "文件不是合法的 JSON",
    importReadFailed: "读取文件失败：{error}",
    sectionExperience: "体验与提醒",
    language: "界面语言",
    languageHint: "与 DSH 的语言设置同步；首次启动按浏览器或系统语言选择。",
    appearance: "外观主题",
    appearanceNote:
      "外观跟随 DSH「设置 → 外观」的深浅色偏好；番茄皮肤自动覆盖纸色系。",
    simpleMode: "简洁模式",
    simpleModeNote: "界面密度由 DSH 接管；番茄主视图保持纸色导航与九页布局。",
    personaBackdrop: "角色背景板",
    personaBackdropHint:
      "在普通页面背景显示当前人格的立绘；专注与保护界面不显示。",
    sound: "关键节点音效",
    soundHint: "开始、暂停、完成与提醒的短音效。",
    soundVolume: "音效音量",
    mute: "静音",
    notifications: "桌面通知",
    notificationsHint: "番茄完成与任务提醒发送系统通知。",
    alwaysOnTop: "窗口置顶",
    alwaysOnTopHint: "由 DSH 窗口管理器决定是否支持。",
    preview: "试听",
    previewHint: "音效试听随沉浸模式音效一起接入，当前保留入口。",
    previewPending: "音效试听尚未接入",
    sectionDesktop: "桌面集成",
    desktopHint: "DSH 形态下这些能力由系统与 DSH 承担，插件不单独提供开关。",
    autostart: "登录后自动启动",
    autostartValue:
      "由安装脚本与 systemd 用户服务管理（见 docs/CROSS_PLATFORM.md）。",
    tray: "关闭窗口后留在托盘",
    trayValue: "DSH 没有系统托盘；关闭主视图不影响 runtime 继续计时与提醒。",
    quit: "退出应用",
    quitValue: "从 DSH 退出；退出前会自动保存计时与设置。",
    sectionNetwork: "网络代理",
    networkHint:
      "插件只直连本机 runtime（127.0.0.1），不经过外部网络代理；代理由 DSH 与系统设置决定。",
    sectionData: "数据与备份",
    dataHint:
      "完整备份包含任务、完成进度、专注历史、设置和锁机规则；导入会用备份替换当前数据。",
    exportBackup: "导出备份",
    importBackup: "导入备份",
    backupImported: "备份已导入",
    backupImportFailed: "导入备份失败：{error}",
    confirmBackupTitle: "导入备份？",
    confirmBackupBody:
      "导入会用备份文件替换当前任务、进度、历史与设置，建议先导出当前备份。严格模式与保护规则不会因此被绕开。",
    confirmImport: "确认导入",
    fileFilter: "JSON 文件",
    exportBackupPending: "运行时导出端点尚未就绪，暂不可用。",
  },
  en: {
    eyebrow: "Tomato Todo",
    title: "Preferences",
    subtitle:
      "Pomodoro, study plans, reminders and data. Everything is saved on this device.",
    save: "Save settings",
    saving: "Saving…",
    saved: "Settings saved",
    unsaved: "Unsaved changes",
    discard: "Discard changes",
    loading: "Reading settings…",
    offlineTitle: "Runtime offline",
    offlineHint:
      "Settings are never faked; they load automatically when the runtime is back.",
    saveFailed: "Couldn't save: {error}",
    rangeError: "{label} must be an integer between {min} and {max}",
    unitMin: "min",
    unitRound: "rounds",
    unitCount: "pomodoros",
    sectionFocus: "Focus & breaks",
    sectionFocusHint:
      "Defaults apply after the next reset; a running timer is untouched.",
    focusMinutes: "Focus length",
    shortBreak: "Short break",
    longBreak: "Long break",
    longBreakEvery: "Long break every",
    dailyGoal: "Daily pomodoro goal",
    autoBreak: "Start breaks automatically",
    autoBreakHint: "Enter a break timer as soon as focus ends.",
    autoFocus: "Start the next round automatically",
    autoFocusHint: "Continue the current task after a break.",
    autoStartTasks: "Start on time automatically",
    autoStartTasksHint:
      "Start focus when a task's reminder time arrives; never interrupt a timer, lock or exam.",
    sectionPlan: "Study plan",
    sectionPlanHint:
      "Plan files exchange tasks and schedules only; progress and focus history are preserved. Import merges by ID.",
    exportPlan: "Export plan",
    importPlan: "Import plan",
    exportPending: "The runtime export endpoint is not ready yet.",
    exportFailed: "Export failed: {error}",
    exportDone: "Exported",
    planImported: "Plan imported",
    planImportFailed: "Plan import failed: {error}",
    importInvalid: "This file is not valid JSON",
    importReadFailed: "Couldn't read the file: {error}",
    sectionExperience: "Experience & reminders",
    language: "Language",
    languageHint: "Synced with DSH settings; first launch follows your browser or system language.",
    appearance: "Appearance",
    appearanceNote:
      "Appearance follows DSH Settings → Appearance; the tomato skin layers the paper palette on top.",
    simpleMode: "Compact mode",
    simpleModeNote:
      "UI density is managed by DSH; the tomato main view keeps its navigation and nine pages.",
    personaBackdrop: "Persona backdrop",
    personaBackdropHint:
      "Shows the current persona's artwork on ordinary page backgrounds; hidden in focus and guard views.",
    sound: "Key-moment sounds",
    soundHint: "Short cues for start, pause, completion and reminders.",
    soundVolume: "Sound volume",
    mute: "Mute",
    notifications: "Desktop notifications",
    notificationsHint:
      "System notifications for finished pomodoros and task reminders.",
    alwaysOnTop: "Always on top",
    alwaysOnTopHint:
      "Whether this is supported depends on the DSH window manager.",
    preview: "Preview",
    previewHint:
      "Sound preview arrives with the immersive sound layer; the entry stays for now.",
    previewPending: "Sound preview is not wired up yet",
    sectionDesktop: "Desktop integration",
    desktopHint:
      "In the DSH form these are handled by the system and DSH; the plugin adds no switches.",
    autostart: "Start at login",
    autostartValue:
      "Managed by the install script and a systemd user service (see docs/CROSS_PLATFORM.md).",
    tray: "Keep running in the tray after closing",
    trayValue:
      "DSH has no system tray; closing the main view does not stop timers or reminders.",
    quit: "Quit the app",
    quitValue: "Quit through DSH; timers and settings are saved before exit.",
    sectionNetwork: "Network proxy",
    networkHint:
      "The plugin only talks to the local runtime (127.0.0.1); proxies follow DSH and system settings.",
    sectionData: "Data & backups",
    dataHint:
      "A full backup contains tasks, progress, focus history, settings and lock schedules; importing replaces current data.",
    exportBackup: "Export backup",
    importBackup: "Import backup",
    backupImported: "Backup imported",
    backupImportFailed: "Backup import failed: {error}",
    confirmBackupTitle: "Import this backup?",
    confirmBackupBody:
      "Importing replaces current tasks, progress, history and settings. Export a backup first. Strict-mode and guard rules are never bypassed.",
    confirmImport: "Import",
    fileFilter: "JSON files",
    exportBackupPending: "The runtime export endpoint is not ready yet.",
  },
});

/** 快照里的 Settings → 可编辑草稿；只深拷贝 protection，别改到快照对象。 */
function cloneSettings(settings) {
  const source = settings || {};
  const protection = source.protection || {};
  return {
    ...source,
    protection: {
      mode:
        protection.mode === "lock" || protection.mode === "whitelist"
          ? protection.mode
          : "off",
      whitelist: Array.isArray(protection.whitelist)
        ? [...protection.whitelist]
        : [],
      strict: !!protection.strict,
    },
  };
}

/** soundVolume 在 core 是 0–100；旧数据可能是 0–1 的比例，显示时归一。 */
function volumeOf(settings) {
  const raw = Number(settings && settings.soundVolume);
  if (!Number.isFinite(raw)) return 100;
  if (raw > 0 && raw <= 1) return Math.round(raw * 100);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 浏览器端 JSON 下载：端点只给 JSON，文件生成在页面这一层。 */
function downloadJson(filename, payload) {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* 浏览器差异：清理失败不影响下载 */
    }
  }, 0);
}

/** File.text() 的兼容读法（旧 WebView 只有 FileReader）。 */
async function readFileText(file) {
  if (file && typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsText(file);
  });
}

/** 设置行：左标签 + 说明，右侧控件；没有标签时整行给控件（Toggle 自带标签）。 */
function SettingRow({ label, hint, children }) {
  if (!label && !hint) {
    return h(
      "div",
      { style: { display: "flex", alignItems: "center", padding: "10px 0" } },
      h("div", { style: { flex: 1, minWidth: 0 } }, children),
    );
  }
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 0",
        flexWrap: "wrap",
      },
    },
    h(
      "div",
      { style: { flex: 1, minWidth: 190 } },
      h(
        "div",
        { style: { fontSize: 13.5, color: "var(--tomato-ink)" } },
        label,
      ),
      hint
        ? h(
            "div",
            {
              style: {
                fontSize: 11.5,
                color: "var(--tomato-ink-3)",
                marginTop: 2,
                lineHeight: 1.55,
              },
            },
            hint,
          )
        : null,
    ),
    h(
      "div",
      {
        style: { display: "flex", alignItems: "center", gap: 8, flex: "none" },
      },
      children,
    ),
  );
}

/** 数字设置：输入框保留文本，失焦/回车才写回草稿。 */
function NumberSetting({
  label,
  hint,
  value,
  min,
  max,
  unit,
  onChange,
  disabled = false,
}) {
  const [text, setText] = useState(String(value ?? 0));
  useEffect(() => {
    setText(String(value ?? 0));
  }, [value]);
  const commit = () => {
    const parsed = Number.parseInt(String(text).replace(/[^\d-]/g, ""), 10);
    onChange(Number.isFinite(parsed) ? parsed : min);
  };
  return h(
    SettingRow,
    { label, hint },
    h(Input, {
      value: text,
      onChange: (next) => setText(next),
      onBlur: commit,
      onKeyDown: (event) => {
        if (event.key === "Enter") commit();
      },
      inputMode: "numeric",
      disabled,
      style: { width: 84, textAlign: "center" },
    }),
    h(
      "span",
      { style: { fontSize: 12, color: "var(--tomato-ink-3)", minWidth: 34 } },
      unit,
    ),
    h(
      "span",
      {
        className: "t-mono",
        style: { fontSize: 11, color: "var(--tomato-ink-3)", opacity: 0.8 },
      },
      `${min}–${max}`,
    ),
  );
}

/** 只读说明行：旧桌面应用能力在 DSH 形态下的归属说明。 */
function InfoRow({ label, value }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "10px 0",
        flexWrap: "wrap",
      },
    },
    h(
      "div",
      {
        style: {
          flex: 1,
          minWidth: 190,
          fontSize: 13.5,
          color: "var(--tomato-ink)",
        },
      },
      label,
    ),
    h(
      "div",
      {
        style: {
          flex: 1,
          minWidth: 220,
          textAlign: "right",
          fontSize: 12,
          color: "var(--tomato-ink-3)",
          lineHeight: 1.6,
        },
      },
      value,
    ),
  );
}

function PreferencesPage(props) {
  const language = useLocale();
  const state = useSnapshot();
  const liveSettings =
    state && state.data && state.data.settings ? state.data.settings : null;

  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exportErrors, setExportErrors] = useState({ plan: "", backup: "" });
  const [pendingBackup, setPendingBackup] = useState(null);
  const planInputRef = useRef(null);
  const backupInputRef = useRef(null);

  // 服务端设置变化时同步草稿——但用户有未保存改动时不覆盖。
  useEffect(() => {
    if (dirty) return;
    setDraft(liveSettings ? cloneSettings(liveSettings) : null);
  }, [liveSettings, dirty]);

  const model = draft || (liveSettings ? cloneSettings(liveSettings) : null);
  const api = (props && props.api) || null;

  const update = (patch) => {
    const base = draft || (liveSettings ? cloneSettings(liveSettings) : null);
    if (!base) return;
    setDraft({ ...base, ...patch });
    setDirty(true);
    setError("");
  };

  const buildPayload = () => {
    const base = cloneSettings(model || liveSettings);
    return {
      ...base,
      focusMinutes: Math.trunc(Number(base.focusMinutes)),
      shortBreakMinutes: Math.trunc(Number(base.shortBreakMinutes)),
      longBreakMinutes: Math.trunc(Number(base.longBreakMinutes)),
      longBreakEvery: Math.trunc(Number(base.longBreakEvery)),
      dailyGoal: Math.trunc(Number(base.dailyGoal)),
      soundVolume: volumeOf(base),
    };
  };

  const validate = (payload) => {
    const checks = [
      [payload.focusMinutes, 1, 180, t("prefs.focusMinutes")],
      [payload.shortBreakMinutes, 1, 60, t("prefs.shortBreak")],
      [payload.longBreakMinutes, 1, 120, t("prefs.longBreak")],
      [payload.longBreakEvery, 2, 12, t("prefs.longBreakEvery")],
      [payload.dailyGoal, 1, 30, t("prefs.dailyGoal")],
      [payload.soundVolume, 0, 100, t("prefs.soundVolume")],
    ];
    for (const [value, min, max, label] of checks) {
      if (!Number.isInteger(value) || value < min || value > max) {
        return t("prefs.rangeError", { label, min, max });
      }
    }
    return "";
  };

  const save = async () => {
    const payload = buildPayload();
    const problem = validate(payload);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    const result = await tryDispatch({
      type: "saveSettings",
      settings: payload,
    });
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      notify(t("prefs.saved"), "brand");
    } else {
      setError(t("prefs.saveFailed", { error: result.error }));
      notify(result.error, "danger");
    }
  };

  const discard = () => {
    setDraft(liveSettings ? cloneSettings(liveSettings) : null);
    setDirty(false);
    setError("");
  };

  const runExport = async (kind) => {
    setExportError("");
    const fn =
      api && (kind === "plan" ? api.getExportPlan : api.getExportBackup);
    if (typeof fn !== "function") {
      setExportError(t("prefs.exportPending"));
      return;
    }
    try {
      const payload = await fn();
      const stamp = (state && state.today) || localDateKey();
      downloadJson(`tomato-${kind}-${stamp}.json`, payload);
      notify(t("prefs.exportDone"), "brand");
    } catch (e) {
      const message = (e && (e.userMessage || e.message)) || String(e);
      setExportError(t("prefs.exportFailed", { error: message }));
    }
  };

  const pickFile = (kind) => {
    const ref = kind === "plan" ? planInputRef : backupInputRef;
    if (ref.current && typeof ref.current.click === "function")
      ref.current.click();
  };

  const onFilePicked = async (kind, event) => {
    const input = event.target;
    const file = input && input.files && input.files[0];
    if (input) input.value = "";
    if (!file) return;
    let payload;
    try {
      const text = await readFileText(file);
      payload = JSON.parse(text);
    } catch (e) {
      notify(t("prefs.importInvalid"), "danger");
      return;
    }
    if (kind === "plan") {
      const result = await tryDispatch({ type: "importPlan", plan: payload });
      if (result.ok) notify(t("prefs.planImported"), "brand");
      else
        notify(t("prefs.planImportFailed", { error: result.error }), "danger");
      return;
    }
    setPendingBackup(payload);
  };

  const confirmBackupImport = async () => {
    const payload = pendingBackup;
    setPendingBackup(null);
    if (!payload) return;
    const result = await tryDispatch({ type: "import", data: payload });
    if (result.ok) notify(t("prefs.backupImported"), "brand");
    else
      notify(t("prefs.backupImportFailed", { error: result.error }), "danger");
  };

  const header = h(PageHeader, {
    eyebrow: t("prefs.eyebrow"),
    title: t("prefs.title"),
    subtitle: t("prefs.subtitle"),
    actions: h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8 } },
      dirty
        ? h(Chip, { tone: "sun" }, t("prefs.unsaved"))
        : h(Chip, { tone: "neutral", icon: "check" }, t("common.saved")),
      dirty
        ? h(
            Btn,
            {
              variant: "plain",
              size: "md",
              onClick: discard,
              disabled: saving,
            },
            t("prefs.discard"),
          )
        : null,
      h(
        Btn,
        {
          variant: "primary",
          size: "md",
          icon: "check",
          onClick: save,
          disabled: !dirty || saving,
        },
        saving ? t("prefs.saving") : t("prefs.save"),
      ),
    ),
  });

  if (!state) {
    return h(
      "div",
      { className: "t-root" },
      header,
      h(
        Card,
        { pad: 22 },
        h(Skeleton, { w: "42%", h: 18 }),
        h("div", { style: { height: 12 } }),
        h(Skeleton, { w: "70%" }),
        h("div", { style: { height: 10 } }),
        h(Skeleton, { w: "58%" }),
      ),
    );
  }

  if (!liveSettings || !model) {
    return h(
      "div",
      { className: "t-root" },
      header,
      h(
        Card,
        { pad: 6 },
        h(Empty, {
          icon: "settings",
          title: t("prefs.offlineTitle"),
          hint: t("prefs.offlineHint"),
        }),
      ),
    );
  }

  const volume = volumeOf(model);
  // 现有值可能不在预设档位上：把它补进列表，避免 Segmented 一个都不选中。
  const volumeValues = [0, 25, 50, 75, 100];
  if (!volumeValues.includes(volume)) volumeValues.push(volume);
  volumeValues.sort((a, b) => a - b);
  const volumeOptions = volumeValues.map((value) => ({
    value,
    label: value === 0 ? t("prefs.mute") : `${value}%`,
  }));

  const focusCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "timer",
      title: t("prefs.sectionFocus"),
      hint: t("prefs.sectionFocusHint"),
    }),
    h(NumberSetting, {
      label: t("prefs.focusMinutes"),
      value: model.focusMinutes,
      min: 1,
      max: 180,
      unit: t("prefs.unitMin"),
      onChange: (value) => update({ focusMinutes: value }),
    }),
    h(Divider, null),
    h(NumberSetting, {
      label: t("prefs.shortBreak"),
      value: model.shortBreakMinutes,
      min: 1,
      max: 60,
      unit: t("prefs.unitMin"),
      onChange: (value) => update({ shortBreakMinutes: value }),
    }),
    h(Divider, null),
    h(NumberSetting, {
      label: t("prefs.longBreak"),
      value: model.longBreakMinutes,
      min: 1,
      max: 120,
      unit: t("prefs.unitMin"),
      onChange: (value) => update({ longBreakMinutes: value }),
    }),
    h(Divider, null),
    h(NumberSetting, {
      label: t("prefs.longBreakEvery"),
      value: model.longBreakEvery,
      min: 2,
      max: 12,
      unit: t("prefs.unitRound"),
      onChange: (value) => update({ longBreakEvery: value }),
    }),
    h(Divider, null),
    h(NumberSetting, {
      label: t("prefs.dailyGoal"),
      value: model.dailyGoal,
      min: 1,
      max: 30,
      unit: t("prefs.unitCount"),
      onChange: (value) => update({ dailyGoal: value }),
    }),
    h(Divider, null),
    h(
      SettingRow,
      null,
      h(Toggle, {
        checked: !!model.autoBreak,
        onChange: (checked) => update({ autoBreak: checked }),
        label: t("prefs.autoBreak"),
        hint: t("prefs.autoBreakHint"),
        style: { width: "100%" },
      }),
    ),
    h(Divider, null),
    h(
      SettingRow,
      null,
      h(Toggle, {
        checked: !!model.autoFocus,
        onChange: (checked) => update({ autoFocus: checked }),
        label: t("prefs.autoFocus"),
        hint: t("prefs.autoFocusHint"),
        style: { width: "100%" },
      }),
    ),
    h(Divider, null),
    h(
      SettingRow,
      null,
      h(Toggle, {
        checked: !!model.autoStartTasks,
        onChange: (checked) => update({ autoStartTasks: checked }),
        label: t("prefs.autoStartTasks"),
        hint: t("prefs.autoStartTasksHint"),
        style: { width: "100%" },
      }),
    ),
  );

  const planCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "folder",
      title: t("prefs.sectionPlan"),
      hint: t("prefs.sectionPlanHint"),
    }),
    h(
      "div",
      { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
      h(
        Btn,
        {
          variant: "soft",
          icon: "download",
          onClick: () => runExport("plan"),
        },
        t("prefs.exportPlan"),
      ),
      h(
        Btn,
        { variant: "ghost", icon: "upload", onClick: () => pickFile("plan") },
        t("prefs.importPlan"),
      ),
      h("input", {
        ref: planInputRef,
        type: "file",
        accept: ".json,application/json",
        style: { display: "none" },
        onChange: (event) => onFilePicked("plan", event),
      }),
    ),
    exportErrors.plan
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
          exportErrors.plan,
        )
      : null,
  );

  const experienceCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "bell", title: t("prefs.sectionExperience") }),
    h(SettingRow, { label: t("prefs.language"), hint: t("prefs.languageHint") },
      h(Select, {
        value: language,
        width: 142,
        options: [
          { value: "zh", label: "中文" },
          { value: "en", label: "English" },
          { value: "ja", label: "日本語" },
        ],
        onChange: (next) => props.onLanguageChange?.(next),
      }),
    ),
    h(Divider, null),
    h(InfoRow, {
      label: t("prefs.appearance"),
      value: t("prefs.appearanceNote"),
    }),
    h(Divider, null),
    h(InfoRow, {
      label: t("prefs.simpleMode"),
      value: t("prefs.simpleModeNote"),
    }),
    h(Divider, null),
    h(
      SettingRow,
      null,
      h(Toggle, {
        checked: !!model.personaBackdrop,
        onChange: (checked) => update({ personaBackdrop: checked }),
        label: t("prefs.personaBackdrop"),
        hint: t("prefs.personaBackdropHint"),
        style: { width: "100%" },
      }),
    ),
    h(Divider, null),
    h(
      SettingRow,
      null,
      h(Toggle, {
        checked: !!model.sound,
        onChange: (checked) => update({ sound: checked }),
        label: t("prefs.sound"),
        hint: t("prefs.soundHint"),
        style: { width: "100%" },
      }),
    ),
    h(Divider, null),
    h(
      SettingRow,
      { label: t("prefs.soundVolume") },
      h(Segmented, {
        items: volumeOptions,
        value: volume,
        onChange: (value) => update({ soundVolume: Number(value) }),
        size: "sm",
        style: { opacity: model.sound ? 1 : 0.55 },
      }),
      h(
        Btn,
        {
          variant: "plain",
          size: "sm",
          disabled: true,
          title: t("prefs.previewHint"),
        },
        t("prefs.preview"),
      ),
    ),
    h(Divider, null),
    h(
      SettingRow,
      null,
      h(Toggle, {
        checked: !!model.notifications,
        onChange: (checked) => update({ notifications: checked }),
        label: t("prefs.notifications"),
        hint: t("prefs.notificationsHint"),
        style: { width: "100%" },
      }),
    ),
    h(Divider, null),
    h(
      SettingRow,
      null,
      h(Toggle, {
        checked: !!model.alwaysOnTop,
        onChange: (checked) => update({ alwaysOnTop: checked }),
        label: t("prefs.alwaysOnTop"),
        hint: t("prefs.alwaysOnTopHint"),
        style: { width: "100%" },
      }),
    ),
  );

  const desktopCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "sparkle",
      title: t("prefs.sectionDesktop"),
      hint: t("prefs.desktopHint"),
    }),
    h(InfoRow, {
      label: t("prefs.autostart"),
      value: t("prefs.autostartValue"),
    }),
    h(Divider, null),
    h(InfoRow, { label: t("prefs.tray"), value: t("prefs.trayValue") }),
    h(Divider, null),
    h(InfoRow, { label: t("prefs.quit"), value: t("prefs.quitValue") }),
  );

  const networkCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "refresh", title: t("prefs.sectionNetwork") }),
    h(
      "div",
      {
        style: { fontSize: 12, color: "var(--tomato-ink-3)", lineHeight: 1.7 },
      },
      t("prefs.networkHint"),
    ),
  );

  const dataCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "download",
      title: t("prefs.sectionData"),
      hint: t("prefs.dataHint"),
    }),
    h(
      "div",
      { style: { display: "flex", gap: 10, flexWrap: "wrap" } },
      h(
        Btn,
        {
          variant: "soft",
          icon: "download",
          onClick: () => runExport("backup"),
        },
        t("prefs.exportBackup"),
      ),
      h(
        Btn,
        { variant: "ghost", icon: "upload", onClick: () => pickFile("backup") },
        t("prefs.importBackup"),
      ),
      h("input", {
        ref: backupInputRef,
        type: "file",
        accept: ".json,application/json",
        style: { display: "none" },
        onChange: (event) => onFilePicked("backup", event),
      }),
    ),
    exportErrors.backup
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
          exportErrors.backup,
        )
      : null,
  );

  return h(
    "div",
    { className: "t-root" },
    header,
    error
      ? h(
          "div",
          {
            style: {
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 11,
              background: "var(--tomato-brand-soft)",
              color: "var(--tomato-brand-deep)",
              fontSize: 12.5,
              lineHeight: 1.6,
            },
          },
          error,
        )
      : null,
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
          alignItems: "start",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 0,
          },
        },
        focusCard,
        planCard,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 0,
          },
        },
        experienceCard,
        desktopCard,
        networkCard,
        dataCard,
      ),
    ),
    h(
      "div",
      {
        style: {
          marginTop: 18,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11.5,
          color: "var(--tomato-ink-3)",
        },
      },
      h("span", {
        style: {
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dirty ? "var(--tomato-sun)" : "var(--tomato-leaf)",
          flex: "none",
        },
      }),
      dirty ? t("prefs.unsaved") : t("common.savedLocal"),
    ),
    h(Modal, {
      open: pendingBackup !== null,
      onClose: () => setPendingBackup(null),
      title: t("prefs.confirmBackupTitle"),
      icon: "upload",
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
        t("prefs.confirmBackupBody"),
      ),
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          { variant: "ghost", onClick: () => setPendingBackup(null) },
          t("common.cancel"),
        ),
        h(
          Btn,
          { variant: "primary", icon: "check", onClick: confirmBackupImport },
          t("prefs.confirmImport"),
        ),
      ),
    }),
  );
}

registerPage({
  id: "preferences",
  order: 90,
  icon: "settings",
  titleKey: "nav.preferences",
  Component: PreferencesPage,
});
