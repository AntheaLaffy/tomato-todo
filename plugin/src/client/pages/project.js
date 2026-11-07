// 项目详情页：一个项目的任务、专属白名单与资料。
//
// 为什么需要独立页：侧栏项目曾经只是「全部任务 + 项目筛选」，表达不了项目
// 自己的白名单（core 的 effectiveWhitelist 语义）与资料目录；用户点项目期望
// 看到「这个项目现在有什么、要做什么」，而不是全库清单再自己筛。
//
// 本页不复制全部任务的工具条：只保留项目语境下真正需要的动作（勾选完成、
// 开始专注、点标题编辑），排序复用 tasks.js 的 sortTasks，任务表单复用
// TaskDialog，白名单复用 shared/project-whitelist.js。
import { h, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import {
  Btn,
  Card,
  Check,
  Chip,
  Dot,
  Empty,
  Field,
  IconBtn,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Skeleton,
  notify,
} from "../shared/ui.js";
import {
  dayLabel,
  isOverdue,
  projectColor,
  taskRounds,
  timerView,
  todayKey,
} from "../shared/derive.js";
import { tryDispatch } from "../shared/store.js";
import { registerPage } from "../app/registry.js";
import { getActiveProjectId, setActivePageId } from "../app/navigation.js";
import { openImmersive } from "../app/immersive.js";
import { TaskDialog } from "./task-dialog.js";
import { sortTasks } from "./tasks.js";
import { ProjectWhitelistCard } from "../shared/project-whitelist.js";
import {
  ProjectIndexBrowser,
  ProjectMaterialsSection,
  ProjectRegisteredSection,
} from "./project-materials.js";
import { ProjectEducationBinding } from "./project-binding.js";

registerCopy("project", {
  zh: {
    eyebrow: "项目",
    back: "全部任务",
    countLine: "未完成 {a} / 已完成 {b}",
    newTask: "新建任务",
    editProject: "编辑项目",
    deleteProject: "删除项目",
    activeTab: "未完成 {n}",
    completedTab: "已完成 {n}",
    activeEmpty: "这个项目还没有未完成任务",
    activeEmptyHint: "从「新建任务」开始，任务会自动归到这个项目。",
    completedEmpty: "还没有完成的任务",
    completedEmptyHint: "完成的任务会出现在这里。",
    tasksTitle: "任务",
    newTaskHint: "新建的任务默认属于这个项目",
    startFocus: "开始专注",
    pauseFocus: "暂停专注",
    focusOn: "专注于 {title}",
    timerBusy: "请先结束当前计时",
    completeTask: "完成任务 {title}",
    reopenTask: "重新打开任务 {title}",
    untitled: "未命名任务",
    perSession: "{n} 分钟/次",
    overdue: "已逾期",
    editTitle: "编辑项目",
    editHint: "只改这个项目的名称与颜色；资料目录在下方「项目资料」里维护。",
    nameLabel: "项目名称",
    colorLabel: "颜色",
    nameRequired: "项目名称不能为空",
    saved: "项目已更新",
    deleteTitle: "删除这个项目？",
    deleteBody:
      "项目里的任务会保留，但不再归属这个项目；已有教学历史的项目不能删除。",
    deleteConfirm: "确认删除",
    deleted: "项目已删除",
    notFound: "项目不存在或已删除",
    notFoundHint: "它可能已经被删除；回到全部任务继续。",
    noProject: "还没有选择项目",
    noProjectHint: "从左侧「我的项目」点一个项目进来。",
    libraryTitle: "项目资料",
    libraryHint: "来自共享资料库索引，按项目目录过滤。",
    libraryMissing: "资料库尚未建索引",
    libraryMissingHint:
      "先在本页授权资料目录，然后扫描一次；这里会列出该项目目录下的文件。",
    libraryUnauthorized: "资料目录尚未授权",
    libraryUnauthorizedHint: "先在本页授权共享资料库根目录或项目专属目录。",
    libraryScan: "扫描资料库",
    libraryScanning: "正在扫描…",
    libraryScanDone: "已索引 {n} 个文件",
    libraryScanFailed: "扫描失败：{error}",
    libraryRefresh: "刷新",
    librarySearch: "搜索资料名或路径",
    libraryKindAll: "全部类型",
    libraryKindPdf: "PDF",
    libraryKindImage: "图片",
    libraryKindDoc: "文档",
    libraryKindAudio: "音频",
    libraryKindVideo: "视频",
    libraryKindOther: "其他",
    libraryEmpty: "这个项目还没有资料",
    libraryEmptyHint: "资料来自项目绑定的目录；换个关键词或扫描后再看。",
    libraryError: "读不到资料：{error}",
    libraryRange: "{a}–{b} / {total}",
    libraryPrev: "上一页",
    libraryNext: "下一页",
    libraryCount: "{n} 个文件",
    preview: "预览",
    previewUnsupported: "此类型或大小不支持预览，可下载原件。",
    previewLoading: "正在读取…",
    previewFailed: "读取失败：{error}",
    previewOpen: "在新标签页打开",
    previewDownload: "下载",
    previewSize: "大小",
    previewModified: "修改时间",
    previewPath: "路径",
  },
  en: {
    eyebrow: "PROJECT",
    back: "All tasks",
    countLine: "{a} to do / {b} done",
    newTask: "New task",
    editProject: "Edit project",
    deleteProject: "Delete project",
    activeTab: "To do {n}",
    completedTab: "Done {n}",
    activeEmpty: "No open tasks in this project",
    activeEmptyHint: "Start with “New task”; it will belong to this project.",
    completedEmpty: "Nothing completed yet",
    completedEmptyHint: "Completed tasks show up here.",
    tasksTitle: "Tasks",
    newTaskHint: "New tasks belong to this project by default",
    startFocus: "Start focus",
    pauseFocus: "Pause focus",
    focusOn: "Focus on {title}",
    timerBusy: "Finish the current timer first",
    completeTask: "Complete {title}",
    reopenTask: "Reopen {title}",
    untitled: "Untitled task",
    perSession: "{n} min per session",
    overdue: "Overdue",
    editTitle: "Edit project",
    editHint:
      "Only the name and color change here; the folder lives under “Project materials” below.",
    nameLabel: "Project name",
    colorLabel: "Color",
    nameRequired: "Project name is required",
    saved: "Project updated",
    deleteTitle: "Delete this project?",
    deleteBody:
      "Its tasks stay but lose the project; projects with teaching history cannot be deleted.",
    deleteConfirm: "Delete",
    deleted: "Project deleted",
    notFound: "Project not found or deleted",
    notFoundHint: "It may have been deleted; go back to all tasks.",
    noProject: "No project selected",
    noProjectHint: "Pick one from “My projects” in the sidebar.",
    libraryTitle: "Project materials",
    libraryHint:
      "From the shared library index, filtered to this project folder.",
    libraryMissing: "The library has no index yet",
    libraryMissingHint:
      "Authorize the folder here, then scan once; files under this project folder will show up here.",
    libraryUnauthorized: "Materials folder not authorized",
    libraryUnauthorizedHint:
      "Authorize the shared library root or a project folder here first.",
    libraryScan: "Scan library",
    libraryScanning: "Scanning…",
    libraryScanDone: "Indexed {n} files",
    libraryScanFailed: "Scan failed: {error}",
    libraryRefresh: "Refresh",
    librarySearch: "Search names or paths",
    libraryKindAll: "All types",
    libraryKindPdf: "PDF",
    libraryKindImage: "Images",
    libraryKindDoc: "Documents",
    libraryKindAudio: "Audio",
    libraryKindVideo: "Video",
    libraryKindOther: "Other",
    libraryEmpty: "No materials in this project yet",
    libraryEmptyHint:
      "Materials come from the project folder; try another keyword or scan again.",
    libraryError: "Could not read materials: {error}",
    libraryRange: "{a}–{b} / {total}",
    libraryPrev: "Previous",
    libraryNext: "Next",
    libraryCount: "{n} files",
    preview: "Preview",
    previewUnsupported: "This type or size cannot be previewed; download it.",
    previewLoading: "Reading…",
    previewFailed: "Could not read: {error}",
    previewOpen: "Open in a new tab",
    previewDownload: "Download",
    previewSize: "Size",
    previewModified: "Modified",
    previewPath: "Path",
  },
  ja: {
    eyebrow: "プロジェクト",
    back: "すべてのタスク",
    countLine: "未完了 {a} / 完了 {b}",
    newTask: "タスク作成",
    editProject: "プロジェクトを編集",
    deleteProject: "プロジェクトを削除",
    activeTab: "未完了 {n}",
    completedTab: "完了 {n}",
    activeEmpty: "このプロジェクトに未完了のタスクはありません",
    activeEmptyHint: "「タスク作成」から始めると、このプロジェクトに属します。",
    completedEmpty: "完了したタスクはまだありません",
    completedEmptyHint: "完了したタスクはここに表示されます。",
    tasksTitle: "タスク",
    newTaskHint: "新しいタスクはこのプロジェクトに属します",
    startFocus: "集中開始",
    pauseFocus: "一時停止",
    focusOn: "{title} に集中",
    timerBusy: "先に現在のタイマーを終了してください",
    completeTask: "{title} を完了",
    reopenTask: "{title} を再開",
    untitled: "無題のタスク",
    perSession: "{n}分/回",
    overdue: "期限切れ",
    editTitle: "プロジェクトを編集",
    editHint:
      "ここでは名前と色だけを変更します。資料フォルダは下の「プロジェクト資料」で管理します。",
    nameLabel: "プロジェクト名",
    colorLabel: "色",
    nameRequired: "プロジェクト名を入力してください",
    saved: "プロジェクトを更新しました",
    deleteTitle: "このプロジェクトを削除しますか？",
    deleteBody:
      "タスクは残りますが、プロジェクトには属さなくなります。教学履歴のあるプロジェクトは削除できません。",
    deleteConfirm: "削除する",
    deleted: "プロジェクトを削除しました",
    notFound: "プロジェクトが存在しないか削除されました",
    notFoundHint:
      "削除された可能性があります。すべてのタスクに戻ってください。",
    noProject: "プロジェクトが選択されていません",
    noProjectHint: "左の「マイプロジェクト」から選んでください。",
    libraryTitle: "プロジェクト資料",
    libraryHint:
      "共有ライブラリの索引から、このプロジェクトのフォルダで絞り込みます。",
    libraryMissing: "ライブラリの索引がまだありません",
    libraryMissingHint:
      "このページで資料フォルダを認可してから一度スキャンしてください。このプロジェクトのフォルダ内のファイルがここに表示されます。",
    libraryUnauthorized: "資料フォルダが未認可です",
    libraryUnauthorizedHint:
      "このページで共有ライブラリのルートかプロジェクト専用フォルダを認可してください。",
    libraryScan: "ライブラリをスキャン",
    libraryScanning: "スキャン中…",
    libraryScanDone: "{n}件のファイルを索引しました",
    libraryScanFailed: "スキャンに失敗しました: {error}",
    libraryRefresh: "更新",
    librarySearch: "名前またはパスを検索",
    libraryKindAll: "すべての種類",
    libraryKindPdf: "PDF",
    libraryKindImage: "画像",
    libraryKindDoc: "文書",
    libraryKindAudio: "音声",
    libraryKindVideo: "動画",
    libraryKindOther: "その他",
    libraryEmpty: "このプロジェクトにはまだ資料がありません",
    libraryEmptyHint:
      "資料はプロジェクトのフォルダから取得します。キーワードを変えるか再スキャンしてください。",
    libraryError: "資料を読み取れません: {error}",
    libraryRange: "{a}–{b} / {total}",
    libraryPrev: "前へ",
    libraryNext: "次へ",
    libraryCount: "{n}件のファイル",
    preview: "プレビュー",
    previewUnsupported:
      "この種類またはサイズはプレビューできません。ダウンロードしてください。",
    previewLoading: "読み込み中…",
    previewFailed: "読み込みに失敗しました: {error}",
    previewOpen: "新しいタブで開く",
    previewDownload: "ダウンロード",
    previewSize: "サイズ",
    previewModified: "更新日時",
    previewPath: "パス",
  },
});

const PROJECT_COLORS = [
  "#df7561",
  "#d5a553",
  "#7e9a6e",
  "#75aabb",
  "#a97c8f",
  "#b08a5a",
  "#8b8fc7",
  "#6fa8a0",
];

// ---------------------------------------------------------------- 任务行

function ProjectTaskRow({
  task,
  today,
  data,
  timer,
  last,
  onToggle,
  onEdit,
  onPlay,
}) {
  const completed = !!task.completed;
  const estimate = Math.max(1, Number(task.estimate) || 1);
  const rounds = taskRounds(data, task.id);
  const achieved = rounds >= estimate;
  const overdue = isOverdue(task, today);
  const running = !!timer.running && timer.taskId === task.id;
  const displayTitle = task.title || t("project.untitled");
  return h(
    "div",
    {
      className: "t-row",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 11,
        minHeight: 56,
        padding: "7px 8px",
        borderRadius: 12,
        borderBottom: last ? "none" : "1px solid var(--tomato-line)",
      },
    },
    h(Check, {
      checked: completed,
      label: completed
        ? t("project.reopenTask", { title: displayTitle })
        : t("project.completeTask", { title: displayTitle }),
      onChange: () => onToggle(task),
    }),
    h(
      "button",
      {
        type: "button",
        onClick: () => onEdit(task),
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
          cursor: "pointer",
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
      h(
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
        task.reminderTime
          ? h(
              "span",
              {
                style: { display: "inline-flex", alignItems: "center", gap: 4 },
              },
              h(Icon, { name: "clock", size: 12 }),
              task.reminderTime,
            )
          : null,
        task.focusMinutes != null
          ? h("span", null, t("project.perSession", { n: task.focusMinutes }))
          : null,
        task.dueDate
          ? h(
              "span",
              {
                style: { display: "inline-flex", alignItems: "center", gap: 4 },
              },
              h(Icon, { name: "calendar", size: 12 }),
              dayLabel(task.dueDate, today),
            )
          : null,
        overdue ? h(Chip, { tone: "danger" }, t("project.overdue")) : null,
      ),
    ),
    h(
      "div",
      {
        style: { display: "flex", alignItems: "center", gap: 4, flex: "none" },
      },
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
      !completed
        ? h(IconBtn, {
            name: running ? "pause" : "play",
            size: 16,
            box: 32,
            title: running
              ? t("project.pauseFocus")
              : t("project.focusOn", { title: displayTitle }),
            onClick: () => onPlay(task),
          })
        : null,
    ),
  );
}

// ---------------------------------------------------------------- 页面

export function ProjectPage({ state, projectId }) {
  const snapshotProjectId = getActiveProjectId();
  const currentId = projectId ?? snapshotProjectId;
  const data = (state && state.data) || {};
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const project = projects.find((item) => item.id === currentId) || null;
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const settings = data.settings || {};
  const today = (state && state.today) || todayKey(state && state.serverTime);
  const viewData = { ...data, taskKinds: (state && state.taskKinds) || {} };
  const timer = timerView(state);

  const [tab, setTab] = useState("active");
  const [editor, setEditor] = useState(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PROJECT_COLORS[0]);
  const [editError, setEditError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [busy, setBusy] = useState(false);
  // 授权/导入后通知「已登记」和「应试绑定」重新取数；不把整页数据塞进一个 effect。
  const [materialsVersion, setMaterialsVersion] = useState(0);
  const education = data.education || {};
  const studyProfiles = Array.isArray(education.projects)
    ? education.projects
    : [];
  const studyProfile = project
    ? studyProfiles.find((entry) => entry && entry.projectId === project.id) ||
      null
    : null;

  // 同一页切换项目（侧栏点另一个项目）时重挂状态，而不是把上一个项目的
  // 对话框/标签页带过去。
  useEffect(() => {
    setTab("active");
    setEditor(null);
    setEditProjectOpen(false);
    setDeleteOpen(false);
    setDeleteError(null);
  }, [currentId]);

  const projectTasks = project
    ? tasks.filter((task) => task.projectId === project.id)
    : [];
  const counts = {
    active: projectTasks.filter((task) => !task.completed).length,
    completed: projectTasks.filter((task) => task.completed).length,
  };
  const visible = sortTasks(
    projectTasks.filter((task) =>
      tab === "completed" ? task.completed : !task.completed,
    ),
    "time",
  );
  const editingTask =
    editor && editor.id
      ? projectTasks.find((task) => task.id === editor.id) || null
      : null;
  const taskDialogOpen = !!editor && (!editor.id || !!editingTask);

  function showError(error) {
    notify(error || t("common.writeFailed"), "danger");
  }

  async function toggleComplete(task) {
    const result = await tryDispatch({ type: "toggleTask", id: task.id });
    if (!result.ok) showError(result.error);
  }

  // 与全部任务页同一套播放语义：同任务在跑就暂停；计时器忙就拒绝；否则三步开始。
  async function playTask(task) {
    if (!task || task.completed) return;
    if (timer.running && timer.taskId === task.id) {
      const result = await tryDispatch({ type: "pauseTimer" });
      if (!result.ok) showError(result.error);
      return;
    }
    if (timer.running || timer.remainingSecs < timer.totalSecs) {
      notify(t("project.timerBusy"), "brand");
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
        showError(result.error);
        return;
      }
    }
    openImmersive();
  }

  function openEditProject() {
    if (!project) return;
    setEditName(project.name);
    setEditColor(project.color || PROJECT_COLORS[0]);
    setEditError(null);
    setEditProjectOpen(true);
  }

  async function saveProject(event) {
    event?.preventDefault?.();
    if (!project || busy) return;
    const name = editName.trim();
    if (name === "") {
      setEditError(t("project.nameRequired"));
      return;
    }
    setBusy(true);
    setEditError(null);
    const result = await tryDispatch({
      type: "saveProject",
      id: project.id,
      name,
      color: editColor || PROJECT_COLORS[0],
      directory: null,
    });
    setBusy(false);
    if (!result.ok) {
      setEditError(result.error || t("common.writeFailed"));
      return;
    }
    setEditProjectOpen(false);
    notify(t("project.saved"), "brand");
  }

  async function confirmDeleteProject() {
    if (!project || busy) return;
    setBusy(true);
    setDeleteError(null);
    const result = await tryDispatch({ type: "deleteProject", id: project.id });
    setBusy(false);
    if (!result.ok) {
      // core 会拒绝带教学历史的项目；原样展示它的说明，不另造一句。
      setDeleteError(result.error || t("common.writeFailed"));
      return;
    }
    setDeleteOpen(false);
    notify(t("project.deleted"), "neutral");
    setActivePageId("tasks");
  }

  const back = h(
    Btn,
    {
      variant: "plain",
      size: "sm",
      icon: "arrowLeft",
      onClick: () => setActivePageId("tasks"),
      style: { marginBottom: 14, paddingLeft: 4 },
    },
    t("project.back"),
  );

  if (!state) {
    return h(
      "div",
      { className: "t-root" },
      back,
      h(
        Card,
        null,
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 12 } },
          h(Skeleton, { w: "30%", h: 22 }),
          h(Skeleton, { w: "52%", h: 13 }),
          h(Skeleton, { w: "68%", h: 13 }),
        ),
      ),
    );
  }

  if (!currentId) {
    return h(
      "div",
      { className: "t-root" },
      back,
      h(Empty, {
        icon: "folder",
        title: t("project.noProject"),
        hint: t("project.noProjectHint"),
        action: h(
          Btn,
          {
            variant: "soft",
            icon: "arrowLeft",
            onClick: () => setActivePageId("tasks"),
          },
          t("project.back"),
        ),
      }),
    );
  }

  if (project === null) {
    return h(
      "div",
      { className: "t-root" },
      back,
      h(Empty, {
        icon: "folder",
        title: t("project.notFound"),
        hint: t("project.notFoundHint"),
        action: h(
          Btn,
          {
            variant: "soft",
            icon: "arrowLeft",
            onClick: () => setActivePageId("tasks"),
          },
          t("project.back"),
        ),
      }),
    );
  }

  const header = h(PageHeader, {
    eyebrow: t("project.eyebrow"),
    title: h(
      "span",
      { style: { display: "inline-flex", alignItems: "center", gap: 10 } },
      h(Dot, { color: projectColor(data, project.id), size: 11 }),
      project.name,
    ),
    subtitle: t("project.countLine", {
      a: counts.active,
      b: counts.completed,
    }),
    actions: h(
      "div",
      { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      h(
        Btn,
        {
          variant: "primary",
          icon: "plus",
          onClick: () => setEditor({}),
        },
        t("project.newTask"),
      ),
      h(
        Btn,
        { variant: "ghost", icon: "edit", onClick: openEditProject },
        t("project.editProject"),
      ),
      h(
        Btn,
        {
          variant: "danger",
          icon: "trash",
          onClick: () => {
            setDeleteError(null);
            setDeleteOpen(true);
          },
        },
        t("project.deleteProject"),
      ),
    ),
  });

  return h(
    "div",
    { className: "t-root" },
    back,
    header,
    h(
      Card,
      { pad: 12, style: { marginBottom: 16 } },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 10,
          },
        },
        h(
          "div",
          {
            style: {
              fontSize: 13.5,
              fontWeight: 620,
              color: "var(--tomato-ink)",
              marginRight: "auto",
            },
          },
          t("project.tasksTitle"),
        ),
        h(Segmented, {
          items: [
            {
              value: "active",
              label: t("project.activeTab", { n: counts.active }),
            },
            {
              value: "completed",
              label: t("project.completedTab", { n: counts.completed }),
            },
          ],
          value: tab,
          onChange: setTab,
          size: "sm",
        }),
      ),
      visible.length === 0
        ? h(Empty, {
            icon: tab === "completed" ? "check" : "leaf",
            title:
              tab === "completed"
                ? t("project.completedEmpty")
                : t("project.activeEmpty"),
            hint:
              tab === "completed"
                ? t("project.completedEmptyHint")
                : t("project.activeEmptyHint"),
            action:
              tab === "completed"
                ? null
                : h(
                    Btn,
                    {
                      variant: "soft",
                      icon: "plus",
                      onClick: () => setEditor({}),
                    },
                    t("project.newTask"),
                  ),
          })
        : visible.map((task, index) =>
            h(ProjectTaskRow, {
              key: task.id,
              task,
              today,
              data: viewData,
              timer,
              last: index === visible.length - 1,
              onToggle: toggleComplete,
              onEdit: (target) => setEditor({ id: target.id }),
              onPlay: playTask,
            }),
          ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 16,
        },
      },
      h(ProjectWhitelistCard, { project }),
      h(ProjectMaterialsSection, {
        project,
        onChanged: () => setMaterialsVersion((value) => value + 1),
      }),
      h(ProjectRegisteredSection, {
        project,
        reloadKey: materialsVersion,
      }),
      h(ProjectEducationBinding, {
        project,
        profile: studyProfile,
        reloadKey: materialsVersion,
      }),
    ),
    h(TaskDialog, {
      open: taskDialogOpen,
      task: editingTask,
      today,
      projects,
      settings,
      initialTitle: editor && editor.title ? editor.title : "",
      initialProjectId: project.id,
      onClose: () => setEditor(null),
    }),
    h(
      Modal,
      {
        open: editProjectOpen,
        onClose: () => (busy ? null : setEditProjectOpen(false)),
        icon: "edit",
        title: t("project.editTitle"),
        subtitle: t("project.editHint"),
        width: 460,
        footer: h(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
          h(
            Btn,
            {
              variant: "plain",
              disabled: busy,
              onClick: () => setEditProjectOpen(false),
            },
            t("common.cancel"),
          ),
          h(
            Btn,
            {
              variant: "primary",
              icon: "check",
              disabled: busy,
              onClick: saveProject,
            },
            t("common.save"),
          ),
        ),
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 14 } },
        h(
          Field,
          { label: t("project.nameLabel") },
          h(Input, {
            value: editName,
            onChange: setEditName,
            maxLength: 80,
            autoFocus: true,
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveProject(event);
              }
            },
          }),
        ),
        h(
          Field,
          { label: t("project.colorLabel") },
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            PROJECT_COLORS.map((color) =>
              h("button", {
                key: color,
                type: "button",
                "aria-label": color,
                onClick: () => setEditColor(color),
                style: {
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  background: color,
                  border:
                    editColor === color
                      ? "2px solid var(--tomato-ink)"
                      : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                },
              }),
            ),
            h(Input, {
              type: "color",
              value: editColor,
              onChange: setEditColor,
              style: { width: 42, padding: "2px 4px" },
            }),
          ),
        ),
        editError
          ? h(
              "div",
              {
                role: "alert",
                style: {
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--tomato-brand-soft)",
                  color: "var(--tomato-brand-deep)",
                  fontSize: 12.5,
                },
              },
              editError,
            )
          : null,
      ),
    ),
    h(
      Modal,
      {
        open: deleteOpen,
        onClose: () => (busy ? null : setDeleteOpen(false)),
        icon: "trash",
        title: t("project.deleteTitle"),
        width: 460,
        footer: h(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
          h(
            Btn,
            {
              variant: "ghost",
              disabled: busy,
              onClick: () => setDeleteOpen(false),
            },
            t("common.cancel"),
          ),
          h(
            Btn,
            {
              variant: "danger",
              icon: "trash",
              disabled: busy,
              onClick: confirmDeleteProject,
            },
            t("project.deleteConfirm"),
          ),
        ),
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 10 } },
        h(
          "div",
          {
            style: {
              fontSize: 13,
              color: "var(--tomato-ink-2)",
              lineHeight: 1.7,
            },
          },
          t("project.deleteBody"),
        ),
        h(
          "div",
          {
            style: {
              fontSize: 13.5,
              fontWeight: 550,
              color: "var(--tomato-ink)",
            },
          },
          project.name,
        ),
        deleteError
          ? h(
              "div",
              {
                role: "alert",
                style: {
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--tomato-brand-soft)",
                  color: "var(--tomato-brand-deep)",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                },
              },
              deleteError,
            )
          : null,
      ),
    ),
  );
}

// 冒烟测试需要单独渲染资料区各块（SSR 不执行 useEffect，整页首屏停在
// 「读取授权状态」），只在上报测试钩子时暴露，不在生产页面挂全局对象。
if (typeof window !== "undefined" && window.__TOMATO_TEST__) {
  window.__tomatoProjectParts = {
    ProjectIndexBrowser,
    ProjectMaterialsSection,
    ProjectRegisteredSection,
    ProjectEducationBinding,
  };
}

registerPage({
  id: "project",
  order: 25,
  icon: "folder",
  titleKey: "nav.project",
  Component: ProjectPage,
  // 侧栏九页导航不直接列出项目页：它只从项目列表（openProject）或面包屑进入。
  hidden: true,
});
