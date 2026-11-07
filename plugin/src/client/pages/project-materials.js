// 项目资料：目录授权、索引浏览、批量导入与清单导出。
//
// 为什么授权入口必须放在项目页：用户点进一个项目时已经带着「这个项目的资料在
// 哪」的意图；把授权只留在应试教育页，三态（共享库 / 专属目录 / 未授权）与
// 索引浏览就分处两页，用户看到空列表也不知道是没索引还是没授权。授权只写
// grant，不移动、不复制磁盘上的文件；导入也只登记清单，不打开文件内容。
import { h, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import {
  Btn,
  Card,
  Check,
  Chip,
  Empty,
  Field,
  IconBtn,
  Input,
  Modal,
  SectionTitle,
  Select,
  Skeleton,
  notify,
} from "../shared/ui.js";
import { todayKey } from "../shared/derive.js";
import { FilePreview } from "../shared/file-preview.js";
import { refresh } from "../shared/store.js";
import {
  authorizeProjectDirectory,
  getFileToken,
  getLibraryGrant,
  getLibraryItems,
  getLibraryStats,
  getProjectGrant,
  getProjectResources,
  importProjectResources,
  libraryFileUrl,
  cleanupProjectResources,
  scanLibrary,
  scanProjectLibrary,
} from "../shared/api.js";

registerCopy("project", {
  zh: {
    grantTitle: "资料目录",
    grantStatusLoading: "读取授权状态…",
    grantStatusError: "授权状态读取失败",
    grantUnauthorized: "未授权",
    grantShared: "共享资料库",
    grantOwn: "项目专属目录",
    grantLoading: "读取授权状态…",
    grantNotAuthorizedHint:
      "这个项目还没有资料目录。先授权共享资料库根目录或专属子目录，才能浏览、导入并按资料绑定应试内容。",
    grantNotAuthorizedNoLibraryHint:
      "共享资料库也尚未授权。可以先在这里给项目一个专属目录，或到「应试教育」页授权整个资料库。",
    grantSharedHint:
      "本项目使用共享资料库根目录；索引覆盖整个共享库，导入时按项目目录筛选。",
    grantOwnHint:
      "本项目使用共享库内的专属子目录；浏览与导入都只在这个目录范围内。",
    grantReadOnly: "授权只是读取许可，不移动文件。",
    grantAuthorize: "授权目录",
    grantChange: "更换",
    grantUseShared: "使用共享库",
    grantUsingShared: "使用中",
    grantSwitching: "正在切换…",
    grantRefresh: "刷新",
    grantPathRequired: "请填写绝对路径",
    grantModalTitle: "授权项目资料目录",
    grantModalSubtitle:
      "选择一个已存在的绝对目录；授权只给读取许可，不移动任何文件。",
    grantPathLabel: "绝对路径",
    grantModalHint:
      "必须在共享资料库内（若已授权）；不能是根目录、整个主目录或应用内部目录。",
    grantSaved: "资料目录已授权",
    grantSharedMissing:
      "共享资料库尚未授权，请先到「应试教育」页授权整个资料库。",
    grantSharedDone: "已切换为使用共享资料库",
    grantConfirm: "授权",
    importAvailable: "索引内 {n} 个文件",
    importSelected: "导入选中（{n}）",
    importAll: "导入本目录全部",
    importAllCount: "导入本目录全部（{n} 个）",
    importConfirmTitle: "导入本目录全部资料？",
    importConfirmBody:
      "将把本项目目录下的 {n} 个索引条目登记为项目资料；已登记过的路径会自动跳过。只登记清单，不复制或移动文件。",
    importConfirmSubmit: "导入 {n} 个",
    importBusy: "正在导入…",
    importDone: "已登记 {registered} 条，跳过 {skipped} 条（已登记过）",
    selectItem: "选择 {name}",
    clearSelection: "取消选择",
    exportHint: "只导出元数据，不导出文件内容。",
    exportIndexJson: "索引 JSON",
    exportIndexCsv: "索引 CSV",
    exportEmpty: "没有可导出的条目",
    exportDone: "已导出 {n} 条",
    registeredTitle: "已登记资料",
    registeredHint: "这些是写进教学记录的登记，不是磁盘文件本身。",
    registeredCount: "{n} 份已登记",
    registeredEmpty: "还没有登记任何资料",
    registeredEmptyHint: "在上方索引里勾选导入，或整目录导入。",
    checkStates: "检查状态",
    checkingStates: "正在检查…",
    cleanupMissing: "移除失效",
    cleanupTitle: "移除失效的资料登记？",
    cleanupBody:
      "只移除仍然缺失、且没有被课程、作业或批改记录引用的登记；仍被引用的会保留。磁盘上的文件不会被删除。",
    cleanupConfirm: "移除失效",
    cleanupBusy: "正在清理…",
    cleanupDone: "已移除 {n} 条失效登记",
    cleanupEmpty: "没有可清理的失效登记",
    statesChecked: "可用 {a}，缺失 {m}，不可用 {u}",
    stateAvailable: "可用",
    stateMissing: "缺失",
    stateUnavailable: "不可用",
    registeredRange: "{a}–{b} / {total}",
    registeredPrev: "上一页",
    registeredNext: "下一页",
    exportJson: "清单 JSON",
    exportCsv: "清单 CSV",
    exporting: "正在导出…",
  },
  en: {
    grantTitle: "Materials folder",
    grantStatusLoading: "Reading authorization…",
    grantStatusError: "Could not read authorization",
    grantUnauthorized: "Not authorized",
    grantShared: "Shared library",
    grantOwn: "Project folder",
    grantLoading: "Reading authorization…",
    grantNotAuthorizedHint:
      "This project has no materials folder yet. Authorize the shared library root or a project subfolder before browsing, importing, or binding exam materials.",
    grantNotAuthorizedNoLibraryHint:
      "The shared library is not authorized either. Give this project its own folder here, or authorize the whole library on the study page.",
    grantSharedHint:
      "This project uses the shared library root; the index covers the whole library and imports are filtered by project folder.",
    grantOwnHint:
      "This project uses a subfolder inside the shared library; browsing and importing stay inside that folder.",
    grantReadOnly:
      "Authorization is read-only permission; files are never moved.",
    grantAuthorize: "Authorize folder",
    grantChange: "Change",
    grantUseShared: "Use shared library",
    grantUsingShared: "In use",
    grantSwitching: "Switching…",
    grantRefresh: "Refresh",
    grantPathRequired: "Enter an absolute path",
    grantModalTitle: "Authorize the project materials folder",
    grantModalSubtitle:
      "Choose an existing absolute folder; authorization only grants read access and never moves a file.",
    grantPathLabel: "Absolute path",
    grantModalHint:
      "It must be inside the shared library when one is authorized; the root, the whole home folder, and app data folders are rejected.",
    grantSaved: "Materials folder authorized",
    grantSharedMissing:
      "The shared library is not authorized; authorize the whole library on the study page first.",
    grantSharedDone: "Switched to the shared library",
    grantConfirm: "Authorize",
    importAvailable: "{n} files in the index",
    importSelected: "Import selected ({n})",
    importAll: "Import this folder",
    importAllCount: "Import this folder ({n})",
    importConfirmTitle: "Import every material in this folder?",
    importConfirmBody:
      "This registers {n} index entries from this project folder as materials; paths already registered are skipped. Only the list is registered — no file is copied or moved.",
    importConfirmSubmit: "Import {n}",
    importBusy: "Importing…",
    importDone: "Registered {registered}, skipped {skipped} already registered",
    selectItem: "Select {name}",
    clearSelection: "Clear selection",
    exportHint: "Metadata only; file contents are never exported.",
    exportIndexJson: "Index JSON",
    exportIndexCsv: "Index CSV",
    exportEmpty: "Nothing to export",
    exportDone: "Exported {n} rows",
    registeredTitle: "Registered materials",
    registeredHint:
      "These entries are written into the teaching records; they are not the files themselves.",
    registeredCount: "{n} registered",
    registeredEmpty: "No materials registered yet",
    registeredEmptyHint:
      "Select entries in the index above, or import the whole folder.",
    checkStates: "Check status",
    checkingStates: "Checking…",
    cleanupMissing: "Remove missing",
    cleanupTitle: "Remove missing material entries?",
    cleanupBody:
      "Only entries that are still missing and are not referenced by lessons, homework, or grading records are removed; referenced entries stay. Files on disk are never deleted.",
    cleanupConfirm: "Remove missing",
    cleanupBusy: "Removing…",
    cleanupDone: "Removed {n} missing entries",
    cleanupEmpty: "No missing entries to remove",
    statesChecked: "{a} available, {m} missing, {u} unavailable",
    stateAvailable: "Available",
    stateMissing: "Missing",
    stateUnavailable: "Unavailable",
    registeredRange: "{a}–{b} / {total}",
    registeredPrev: "Previous",
    registeredNext: "Next",
    exportJson: "List JSON",
    exportCsv: "List CSV",
    exporting: "Exporting…",
  },
  ja: {
    grantTitle: "資料フォルダ",
    grantStatusLoading: "認可状態を読み込み中…",
    grantStatusError: "認可状態を読み込めません",
    grantUnauthorized: "未認可",
    grantShared: "共有ライブラリ",
    grantOwn: "プロジェクト専用フォルダ",
    grantLoading: "認可状態を読み込み中…",
    grantNotAuthorizedHint:
      "このプロジェクトには資料フォルダがありません。共有ライブラリのルートか専用サブフォルダを認可すると、閲覧・取り込み・試験資料の紐付けができます。",
    grantNotAuthorizedNoLibraryHint:
      "共有ライブラリも未認可です。ここで専用フォルダを認可するか、学習ページでライブラリ全体を認可してください。",
    grantSharedHint:
      "このプロジェクトは共有ライブラリのルートを使います。索引はライブラリ全体を対象にし、取り込みはプロジェクトのフォルダで絞り込みます。",
    grantOwnHint:
      "このプロジェクトは共有ライブラリ内の専用サブフォルダを使います。閲覧と取り込みはそのフォルダ内だけです。",
    grantReadOnly: "認可は読み取り許可だけです。ファイルは移動しません。",
    grantAuthorize: "フォルダを認可",
    grantChange: "変更",
    grantUseShared: "共有ライブラリを使う",
    grantUsingShared: "使用中",
    grantSwitching: "切り替え中…",
    grantRefresh: "更新",
    grantPathRequired: "絶対パスを入力してください",
    grantModalTitle: "プロジェクト資料フォルダを認可",
    grantModalSubtitle:
      "既存の絶対フォルダを選択してください。認可は読み取り許可だけで、ファイルは移動しません。",
    grantPathLabel: "絶対パス",
    grantModalHint:
      "共有ライブラリが認可済みならその内側である必要があります。ルート、ホーム全体、アプリ内部フォルダは拒否されます。",
    grantSaved: "資料フォルダを認可しました",
    grantSharedMissing:
      "共有ライブラリが未認可です。先に学習ページでライブラリ全体を認可してください。",
    grantSharedDone: "共有ライブラリの使用に切り替えました",
    grantConfirm: "認可",
    importAvailable: "索引内 {n} ファイル",
    importSelected: "選択をインポート（{n}）",
    importAll: "このフォルダをすべてインポート",
    importAllCount: "このフォルダをすべてインポート（{n}）",
    importConfirmTitle: "このフォルダの資料をすべてインポートしますか？",
    importConfirmBody:
      "このプロジェクトのフォルダにある {n} 件の索引を資料として登録します。登録済みのパスは自動でスキップされます。一覧の登録だけで、ファイルのコピーや移動は行いません。",
    importConfirmSubmit: "{n} 件をインポート",
    importBusy: "インポート中…",
    importDone: "{registered} 件を登録、{skipped} 件をスキップ（登録済み）",
    selectItem: "{name} を選択",
    clearSelection: "選択を解除",
    exportHint: "メタデータのみを出力します。ファイルの中身は出力しません。",
    exportIndexJson: "索引 JSON",
    exportIndexCsv: "索引 CSV",
    exportEmpty: "出力できる項目がありません",
    exportDone: "{n} 件を出力しました",
    registeredTitle: "登録済み資料",
    registeredHint:
      "教学記録に書き込まれた登録です。ディスク上のファイルそのものではありません。",
    registeredCount: "{n} 件登録済み",
    registeredEmpty: "登録済みの資料はまだありません",
    registeredEmptyHint:
      "上の索引で選択してインポートするか、フォルダごとインポートしてください。",
    checkStates: "状態を確認",
    checkingStates: "確認中…",
    cleanupMissing: "欠落を削除",
    cleanupTitle: "欠落した資料登録を削除しますか？",
    cleanupBody:
      "まだ欠落していて、授業・宿題・採点記録から参照されていない登録だけを削除します。参照中のものは残ります。ディスク上のファイルは削除しません。",
    cleanupConfirm: "欠落を削除",
    cleanupBusy: "削除中…",
    cleanupDone: "欠落した登録を {n} 件削除しました",
    cleanupEmpty: "削除できる欠落登録はありません",
    statesChecked: "利用可 {a}、欠落 {m}、利用不可 {u}",
    stateAvailable: "利用可",
    stateMissing: "欠落",
    stateUnavailable: "利用不可",
    registeredRange: "{a}–{b} / {total}",
    registeredPrev: "前へ",
    registeredNext: "次へ",
    exportJson: "一覧 JSON",
    exportCsv: "一覧 CSV",
    exporting: "出力中…",
  },
});

const LIBRARY_PAGE = 30;
const RESOURCE_PAGE = 30;
const KINDS = ["pdf", "image", "doc", "audio", "video", "other"];

function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** 索引条目容错：缺 name/ext 时从 path 推；未知字段不影响列表。 */
function normalizeItem(raw) {
  const path = String((raw && raw.path) || "");
  const name = String((raw && raw.name) || path.split("/").pop() || path);
  const ext = String(
    (raw && raw.ext) || (name.includes(".") ? name.split(".").pop() : ""),
  ).toLowerCase();
  return {
    path,
    name,
    ext,
    sizeBytes: Number(raw && raw.sizeBytes) || 0,
    mtime: raw && raw.mtime,
    kind: String((raw && raw.kind) || ""),
    mimeType: String((raw && raw.mimeType) || ""),
    previewable: raw && raw.previewable !== false,
  };
}

function indexKindLabel(kind) {
  const key = `project.libraryKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  return t(key);
}

function resourceKindLabel(kind) {
  return t(
    `education.resourceKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`,
  );
}

function errorText(error) {
  return (error && (error.userMessage || error.message)) || String(error);
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(columns, rows) {
  return (
    [
      columns.join(","),
      ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(",")),
    ].join("\n") + "\n"
  );
}

/** 清单只在浏览器里生成：不新增后端导出端点，也不读文件内容。 */
function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function collectLibraryItems(projectId) {
  const all = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await getLibraryItems({ projectId, offset, limit: 100 });
    const list = Array.isArray(page && page.items) ? page.items : [];
    total = Number(page && page.total) || 0;
    if (list.length === 0) break;
    all.push(...list.map(normalizeItem));
    offset += list.length;
  }
  return all;
}

async function collectProjectResources(projectId) {
  const all = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await getProjectResources(projectId, {
      offset,
      limit: 100,
    });
    const list = Array.isArray(page && page.resources) ? page.resources : [];
    total = Number(page && page.total) || 0;
    if (list.length === 0) break;
    all.push(...list);
    offset += list.length;
  }
  return all;
}

// ---------------------------------------------------------------- 预览

let fileTokenPromise = null;

/** 令牌随 runtime 进程有效；失败后清掉缓存，下次点击再试。 */
function cachedFileToken() {
  if (fileTokenPromise === null) {
    fileTokenPromise = getFileToken()
      .then((result) => (result && result.access) || "")
      .catch((error) => {
        fileTokenPromise = null;
        throw error;
      });
  }
  return fileTokenPromise;
}

/**
 * 资料预览：令牌由本页取，渲染交给 shared/file-preview.js（图片/音视频内联、
 * PDF iframe、Markdown 自己排版）；取令牌失败时把服务端错误当作不可预览说明。
 */
function LibraryPreview({ item, onClose }) {
  const [access, setAccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return undefined;
    let cancelled = false;
    setAccess("");
    setError("");
    cachedFileToken()
      .then((value) => {
        if (!cancelled) setAccess(value);
      })
      .catch((caught) => {
        if (!cancelled) setError(errorText(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [item && item.path]);

  if (!item) return null;
  return h(FilePreview, {
    open: true,
    onClose,
    name: item.name,
    kind: item.kind,
    sizeBytes: item.sizeBytes,
    viewUrl: access ? libraryFileUrl(item.path, access) : "",
    downloadUrl: access ? libraryFileUrl(item.path, access, true) : "",
    previewable: item.previewable !== false && error === "",
    emptyHint: error !== "" ? error : t("project.previewUnsupported"),
  });
}

// ---------------------------------------------------------------- 授权

function alertBox(message) {
  return h(
    "div",
    {
      role: "alert",
      style: {
        padding: "9px 12px",
        borderRadius: 10,
        background: "var(--tomato-brand-soft)",
        color: "var(--tomato-brand-deep)",
        fontSize: 12.5,
        lineHeight: 1.65,
        wordBreak: "break-word",
      },
    },
    message,
  );
}

function mutedHint(message) {
  return h(
    "div",
    {
      style: { fontSize: 11.5, color: "var(--tomato-ink-3)", lineHeight: 1.65 },
    },
    message,
  );
}

/**
 * 资料区的总入口：授权三态 + 索引浏览 + 批量导入。
 * 未授权时不请求索引，直接给出本页的授权引导，避免「空白 = 没资料」的误读。
 */
export function ProjectMaterialsSection({ project, onChanged }) {
  const projectId = project.id;
  const [grant, setGrant] = useState(null);
  const [grantError, setGrantError] = useState("");
  const [library, setLibrary] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [indexReload, setIndexReload] = useState(0);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  const [directory, setDirectory] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharedBusy, setSharedBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setGrant(null);
    setGrantError("");
    setLibrary(null);
    setAuthorizeOpen(false);
    setDirectory("");
    setActionError("");
    setIndexReload(0);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setGrant(null);
    setGrantError("");
    getProjectGrant(projectId)
      .then((result) => {
        if (!cancelled) setGrant(result);
      })
      .catch((error) => {
        if (!cancelled) setGrantError(errorText(error));
      });
    getLibraryGrant()
      .then((result) => {
        if (!cancelled) setLibrary(result);
      })
      .catch(() => {
        if (!cancelled) setLibrary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const loading = grant === null && grantError === "";
  const authorized = grant !== null && grant.authorized === true;
  const shared = authorized && grant.shared === true;
  const libraryReady =
    library !== null &&
    library !== undefined &&
    library.authorized === true &&
    typeof library.directory === "string" &&
    library.directory !== "";

  function acceptGrant(next) {
    setGrant(next);
    setGrantError("");
    setActionError("");
    setIndexReload((value) => value + 1);
    refresh();
    onChanged?.();
  }

  function openAuthorize() {
    setDirectory((grant && grant.directory) || "");
    setActionError("");
    setAuthorizeOpen(true);
  }

  function closeAuthorize() {
    if (busy) return;
    setAuthorizeOpen(false);
    setActionError("");
  }

  async function submitAuthorize() {
    if (busy) return;
    const value = directory.trim();
    if (value === "") {
      setActionError(t("project.grantPathRequired"));
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const next = await authorizeProjectDirectory(projectId, value);
      acceptGrant(next);
      setAuthorizeOpen(false);
      notify(t("project.grantSaved"), "brand");
    } catch (error) {
      // 服务端的目录校验文案更具体（不在共享库内、重叠、不是目录），原样显示。
      setActionError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function useSharedLibrary() {
    if (sharedBusy) return;
    setSharedBusy(true);
    setActionError("");
    try {
      const nextLibrary = await getLibraryGrant();
      setLibrary(nextLibrary);
      if (
        !nextLibrary ||
        nextLibrary.authorized !== true ||
        typeof nextLibrary.directory !== "string" ||
        nextLibrary.directory === ""
      ) {
        setActionError(t("project.grantSharedMissing"));
        return;
      }
      const next = await authorizeProjectDirectory(
        projectId,
        nextLibrary.directory,
      );
      acceptGrant(next);
      notify(t("project.grantSharedDone"), "brand");
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setSharedBusy(false);
    }
  }

  const statusChip = loading
    ? h(Chip, { tone: "neutral" }, t("project.grantStatusLoading"))
    : grantError !== ""
      ? h(Chip, { tone: "danger" }, t("project.grantStatusError"))
      : !authorized
        ? h(Chip, { tone: "neutral" }, t("project.grantUnauthorized"))
        : shared
          ? h(Chip, { tone: "brand", icon: "folder" }, t("project.grantShared"))
          : h(Chip, { tone: "leaf", icon: "folder" }, t("project.grantOwn"));

  const grantHint = !authorized
    ? libraryReady
      ? t("project.grantNotAuthorizedHint")
      : t("project.grantNotAuthorizedNoLibraryHint")
    : shared
      ? t("project.grantSharedHint")
      : t("project.grantOwnHint");

  const pathText = loading
    ? t("project.grantLoading")
    : grantError !== ""
      ? t("project.grantStatusError")
      : grant && grant.directory
        ? grant.directory
        : authorized
          ? t("project.grantUnauthorized")
          : t("project.grantUnauthorized");

  const grantPanel = h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 9,
        padding: "13px 15px",
        marginBottom: 16,
        borderRadius: 12,
        background: "var(--tomato-surface-2)",
      },
    },
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
            fontSize: 13,
            fontWeight: 600,
            color: "var(--tomato-ink)",
            marginRight: 2,
          },
        },
        t("project.grantTitle"),
      ),
      statusChip,
      h("div", { style: { flex: 1 } }),
      h(
        Btn,
        {
          variant: "plain",
          size: "sm",
          icon: "refresh",
          disabled: loading || busy || sharedBusy,
          onClick: () => setReloadKey((value) => value + 1),
        },
        t("project.grantRefresh"),
      ),
    ),
    h(
      "div",
      {
        className: "t-mono",
        style: {
          fontSize: 11.5,
          lineHeight: 1.6,
          color: "var(--tomato-ink-2)",
          background: "var(--tomato-surface)",
          borderRadius: 9,
          padding: "9px 11px",
          wordBreak: "break-all",
        },
      },
      pathText,
    ),
    mutedHint(grantHint),
    !authorized && grant && grant.reason
      ? h(
          "div",
          {
            style: { fontSize: 12, color: "#b8503f", lineHeight: 1.6 },
          },
          grant.reason,
        )
      : null,
    mutedHint(t("project.grantReadOnly")),
    grantError !== "" ? alertBox(grantError) : null,
    actionError !== "" ? alertBox(actionError) : null,
    h(
      "div",
      {
        style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 },
      },
      h(
        Btn,
        {
          variant: authorized ? "soft" : "primary",
          size: "sm",
          icon: "folder",
          disabled: loading || busy || sharedBusy,
          onClick: openAuthorize,
        },
        authorized ? t("project.grantChange") : t("project.grantAuthorize"),
      ),
      h(
        Btn,
        {
          variant: "ghost",
          size: "sm",
          icon: "folder",
          disabled: !libraryReady || shared || loading || busy || sharedBusy,
          title: libraryReady ? undefined : t("project.grantSharedMissing"),
          onClick: useSharedLibrary,
        },
        sharedBusy ? t("project.grantSwitching") : t("project.grantUseShared"),
      ),
      shared
        ? h(
            Chip,
            { tone: "brand", icon: "check" },
            t("project.grantUsingShared"),
          )
        : null,
    ),
  );

  const authorizeDialog = h(
    Modal,
    {
      open: authorizeOpen,
      onClose: closeAuthorize,
      icon: "folder",
      title: t("project.grantModalTitle"),
      subtitle: t("project.grantModalSubtitle"),
      width: 520,
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          { variant: "ghost", disabled: busy, onClick: closeAuthorize },
          t("common.cancel"),
        ),
        h(
          Btn,
          {
            variant: "primary",
            icon: "folder",
            disabled: busy,
            onClick: submitAuthorize,
          },
          busy ? t("project.grantSwitching") : t("project.grantConfirm"),
        ),
      ),
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      h(
        Field,
        {
          label: t("project.grantPathLabel"),
          hint: t("project.grantModalHint"),
        },
        h(Input, {
          value: directory,
          onChange: (value) => {
            setDirectory(value);
            setActionError("");
          },
          placeholder: "/home/you/materials/project",
          mono: true,
          autoFocus: true,
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitAuthorize();
            }
          },
        }),
      ),
      actionError !== "" ? alertBox(actionError) : null,
    ),
  );

  return h(
    Card,
    null,
    h(SectionTitle, {
      icon: "folder",
      title: t("project.libraryTitle"),
      hint: t("project.libraryHint"),
    }),
    grantPanel,
    loading || grantError !== ""
      ? null
      : !authorized
        ? h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "14px 16px",
                borderRadius: 12,
                background: "var(--tomato-surface-2)",
              },
            },
            h(
              "div",
              {
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--tomato-ink)",
                },
              },
              t("project.libraryUnauthorized"),
            ),
            mutedHint(t("project.libraryUnauthorizedHint")),
            h(
              Btn,
              {
                variant: "primary",
                size: "sm",
                icon: "folder",
                disabled: busy,
                onClick: openAuthorize,
              },
              t("project.grantAuthorize"),
            ),
          )
        : h(ProjectIndexBrowser, {
            key: projectId,
            project,
            reloadKey: indexReload,
            onImported: () => {
              setIndexReload((value) => value + 1);
              onChanged?.();
            },
          }),
    authorizeDialog,
  );
}

// ---------------------------------------------------------------- 索引浏览 + 导入

export function ProjectIndexBrowser({ project, reloadKey, onImported }) {
  const projectId = project.id;
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [missing, setMissing] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [allCount, setAllCount] = useState(null);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [localReload, setLocalReload] = useState(0);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importingAll, setImportingAll] = useState(false);
  const [importError, setImportError] = useState("");
  const [lastImport, setLastImport] = useState(null);
  const [confirmImportAll, setConfirmImportAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const bump = () => setLocalReload((value) => value + 1);

  useEffect(() => {
    setOffset(0);
    setQuery("");
    setAppliedQuery("");
    setKind("");
    setMissing(false);
    setStats(null);
    setStatsError("");
    setItems([]);
    setTotal(0);
    setAllCount(null);
    setPreview(null);
    setSelected(new Set());
    setImportError("");
    setLastImport(null);
    setExportError("");
  }, [projectId]);

  // 关键词防抖：输入每个字符都请求一次索引没有必要，也会让分页跳动。
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(query.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    getLibraryStats()
      .then((result) => {
        if (cancelled) return;
        setStats(result);
        setStatsError("");
        if (result && result.hasIndex === false) setMissing(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error && error.status === 404) setMissing(true);
        else setStatsError(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey, localReload]);

  useEffect(() => {
    if (missing) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    getLibraryItems({
      projectId,
      q: appliedQuery,
      kind,
      offset,
      limit: LIBRARY_PAGE,
    })
      .then((result) => {
        if (cancelled) return;
        if (result && result.hasIndex === false) {
          setMissing(true);
          setItems([]);
          setTotal(0);
          return;
        }
        const list = Array.isArray(result && result.items) ? result.items : [];
        setItems(list.map(normalizeItem));
        setTotal(Math.max(0, Number(result && result.total) || 0));
      })
      .catch((error) => {
        if (cancelled) return;
        if (error && error.status === 404) setMissing(true);
        else setLoadError(errorText(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, appliedQuery, kind, offset, missing, reloadKey, localReload]);

  // 「导入本目录全部」在确认前就要显示数量，所以单独取一次不带搜索/类型过滤的总数。
  useEffect(() => {
    if (missing) {
      setAllCount(null);
      return undefined;
    }
    let cancelled = false;
    getLibraryItems({ projectId, offset: 0, limit: 1 })
      .then((result) => {
        if (cancelled) return;
        if (result && result.hasIndex === false) setMissing(true);
        else setAllCount(Math.max(0, Number(result && result.total) || 0));
      })
      .catch(() => {
        if (!cancelled) setAllCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, missing, reloadKey, localReload]);

  async function scan() {
    if (scanning) return;
    setScanning(true);
    try {
      const result = await scanLibrary();
      notify(
        t("project.libraryScanDone", {
          n: Number(result && result.count) || 0,
        }),
        "brand",
      );
      setMissing(false);
      bump();
    } catch (error) {
      notify(errorText(error), "danger");
    } finally {
      setScanning(false);
    }
  }

  function toggleSelected(path) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function acceptImport(result) {
    const registered = Number(result && result.registered) || 0;
    const skipped = Number(result && result.skipped) || 0;
    setLastImport({ registered, skipped });
    setImportError("");
    setSelected(new Set());
    notify(
      t("project.importDone", { registered, skipped }),
      registered > 0 ? "brand" : "neutral",
    );
    bump();
    onImported?.();
  }

  async function importSelected() {
    if (importing || importingAll || selected.size === 0) return;
    setImporting(true);
    setImportError("");
    setLastImport(null);
    try {
      const result = await importProjectResources(projectId, {
        paths: Array.from(selected),
      });
      acceptImport(result);
    } catch (error) {
      // 选中条目不在索引、文件已被移走等错误都原样展示，方便用户重新扫描。
      setImportError(errorText(error));
    } finally {
      setImporting(false);
    }
  }

  function openImportAll() {
    setImportError("");
    setConfirmImportAll(true);
  }

  function closeImportAll() {
    if (importingAll) return;
    setConfirmImportAll(false);
    setImportError("");
  }

  async function importAll() {
    if (importingAll || importing) return;
    setImportingAll(true);
    setImportError("");
    setLastImport(null);
    try {
      // 省略 paths：由 runtime 按项目目录映射取索引里的全部条目。
      const result = await importProjectResources(projectId);
      acceptImport(result);
      setConfirmImportAll(false);
    } catch (error) {
      setImportError(errorText(error));
    } finally {
      setImportingAll(false);
    }
  }

  async function exportIndex(format) {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const all = await collectLibraryItems(projectId);
      if (all.length === 0) {
        notify(t("project.exportEmpty"), "neutral");
        return;
      }
      const rows = all.map((item) => ({
        path: item.path,
        name: item.name,
        ext: item.ext,
        kind: item.kind,
        sizeBytes: item.sizeBytes,
        mtime: item.mtime,
      }));
      const columns = ["path", "name", "ext", "kind", "sizeBytes", "mtime"];
      const text =
        format === "csv"
          ? rowsToCsv(columns, rows)
          : JSON.stringify(rows, null, 2);
      downloadText(
        `tomato-project-${projectId}-index-${todayKey()}.${format}`,
        text,
        format === "csv" ? "text/csv;charset=utf-8" : "application/json",
      );
      notify(t("project.exportDone", { n: rows.length }), "brand");
    } catch (error) {
      setExportError(errorText(error));
    } finally {
      setExporting(false);
    }
  }

  const kindOptions = [
    { value: "", label: t("project.libraryKindAll") },
    ...KINDS.map((value) => ({
      value,
      label: indexKindLabel(value),
    })),
  ];
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + LIBRARY_PAGE, total);

  const missingBlock = h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 12,
        background: "var(--tomato-surface-2)",
      },
    },
    h(
      "div",
      {
        style: { fontSize: 13, fontWeight: 600, color: "var(--tomato-ink)" },
      },
      t("project.libraryMissing"),
    ),
    mutedHint(t("project.libraryMissingHint")),
    h(
      "div",
      { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
      h(
        Btn,
        {
          variant: "soft",
          size: "sm",
          icon: "refresh",
          disabled: scanning,
          onClick: scan,
        },
        scanning ? t("project.libraryScanning") : t("project.libraryScan"),
      ),
    ),
  );

  const listBlock = h(
    "div",
    null,
    h(
      "div",
      {
        style: {
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        },
      },
      h(
        "div",
        { style: { position: "relative", flex: "1 1 220px", minWidth: 0 } },
        h(Icon, {
          name: "search",
          size: 14,
          style: {
            position: "absolute",
            left: 11,
            top: 10,
            color: "var(--tomato-ink-3)",
            pointerEvents: "none",
          },
        }),
        h(Input, {
          value: query,
          onChange: setQuery,
          placeholder: t("project.librarySearch"),
          maxLength: 120,
          style: { paddingLeft: 32, height: 34, fontSize: 12.5 },
        }),
      ),
      h(Select, {
        value: kind,
        options: kindOptions,
        onChange: (value) => {
          setKind(value);
          setOffset(0);
        },
        width: 132,
      }),
      h(
        Btn,
        {
          variant: "ghost",
          size: "sm",
          icon: "refresh",
          disabled: loading,
          onClick: () => setLocalReload((value) => value + 1),
        },
        t("project.libraryRefresh"),
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 10,
        },
      },
      h(
        "span",
        {
          className: "t-mono",
          style: { fontSize: 11, color: "var(--tomato-ink-3)" },
        },
        allCount !== null ? t("project.importAvailable", { n: allCount }) : "",
      ),
      selected.size > 0
        ? h(
            Btn,
            {
              variant: "plain",
              size: "sm",
              disabled: importing || importingAll,
              onClick: () => setSelected(new Set()),
            },
            t("project.clearSelection"),
          )
        : null,
      h("div", { style: { flex: 1 } }),
      h(
        Btn,
        {
          variant: "soft",
          size: "sm",
          icon: "plus",
          disabled: importing || importingAll || selected.size === 0,
          onClick: importSelected,
        },
        importing
          ? t("project.importBusy")
          : t("project.importSelected", { n: selected.size }),
      ),
      h(
        Btn,
        {
          variant: "ghost",
          size: "sm",
          icon: "folder",
          disabled:
            importing || importingAll || allCount === null || allCount === 0,
          onClick: openImportAll,
        },
        allCount !== null
          ? t("project.importAllCount", { n: allCount })
          : t("project.importAll"),
      ),
    ),
    lastImport !== null
      ? h(
          "div",
          {
            role: "status",
            style: {
              padding: "7px 11px",
              marginBottom: 10,
              borderRadius: 9,
              background: "var(--tomato-surface-2)",
              color: "var(--tomato-ink-2)",
              fontSize: 11.5,
            },
          },
          t("project.importDone", lastImport),
        )
      : null,
    importError !== "" ? alertBox(importError) : null,
    loadError !== "" ? alertBox(loadError) : null,
    items.length === 0
      ? h(
          "div",
          { style: { padding: "16px 4px" } },
          loading
            ? h(Skeleton, { w: "52%", h: 13 })
            : h(Empty, {
                icon: "folder",
                title: t("project.libraryEmpty"),
                hint: t("project.libraryEmptyHint"),
              }),
        )
      : h(
          "div",
          null,
          items.map((item, index) =>
            h(
              "div",
              {
                key: item.path || index,
                className: "t-row",
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 44,
                  padding: "6px 6px",
                  borderBottom:
                    index === items.length - 1
                      ? "none"
                      : "1px solid var(--tomato-line)",
                },
              },
              h(Check, {
                checked: selected.has(item.path),
                label: t("project.selectItem", { name: item.name }),
                disabled: importing || importingAll,
                onChange: () => toggleSelected(item.path),
              }),
              h(Icon, {
                name: "folder",
                size: 15,
                style: { color: "var(--tomato-ink-3)", flex: "none" },
              }),
              h(
                "button",
                {
                  type: "button",
                  onClick: () => setPreview(item),
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
                      fontSize: 12.5,
                      color: "var(--tomato-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  item.name,
                ),
                h(
                  "span",
                  {
                    className: "t-mono",
                    style: {
                      maxWidth: "100%",
                      fontSize: 10.5,
                      color: "var(--tomato-ink-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  item.path,
                ),
              ),
              item.sizeBytes
                ? h(
                    "span",
                    {
                      className: "t-mono",
                      style: {
                        fontSize: 10.5,
                        color: "var(--tomato-ink-3)",
                        flex: "none",
                      },
                    },
                    fmtSize(item.sizeBytes),
                  )
                : null,
              h(IconBtn, {
                name: "eye",
                size: 15,
                box: 28,
                title: t("project.preview"),
                onClick: () => setPreview(item),
              }),
            ),
          ),
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
                flexWrap: "wrap",
              },
            },
            h(
              "span",
              {
                className: "t-mono",
                style: { fontSize: 11, color: "var(--tomato-ink-3)" },
              },
              total > 0
                ? t("project.libraryRange", {
                    a: pageStart,
                    b: pageEnd,
                    total,
                  })
                : t("project.libraryCount", { n: 0 }),
            ),
            h("div", { style: { flex: 1 } }),
            h(
              Btn,
              {
                variant: "ghost",
                size: "sm",
                icon: "arrowLeft",
                disabled: offset <= 0 || loading,
                onClick: () => setOffset(Math.max(0, offset - LIBRARY_PAGE)),
              },
              t("project.libraryPrev"),
            ),
            h(
              Btn,
              {
                variant: "ghost",
                size: "sm",
                iconRight: "arrowRight",
                disabled: offset + LIBRARY_PAGE >= total || loading,
                onClick: () => setOffset(offset + LIBRARY_PAGE),
              },
              t("project.libraryNext"),
            ),
          ),
        ),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
          flexWrap: "wrap",
        },
      },
      h(
        "span",
        {
          style: {
            flex: "1 1 220px",
            fontSize: 11,
            color: "var(--tomato-ink-3)",
            lineHeight: 1.6,
          },
        },
        t("project.exportHint"),
      ),
      h(
        Btn,
        {
          variant: "plain",
          size: "sm",
          icon: "download",
          disabled: exporting,
          onClick: () => exportIndex("json"),
        },
        t("project.exportIndexJson"),
      ),
      h(
        Btn,
        {
          variant: "plain",
          size: "sm",
          icon: "download",
          disabled: exporting,
          onClick: () => exportIndex("csv"),
        },
        t("project.exportIndexCsv"),
      ),
    ),
    exportError !== "" ? alertBox(exportError) : null,
  );

  const importAllDialog = h(
    Modal,
    {
      open: confirmImportAll,
      onClose: closeImportAll,
      icon: "folder",
      title: t("project.importConfirmTitle"),
      subtitle: t("project.importConfirmBody", { n: allCount ?? 0 }),
      width: 520,
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          { variant: "ghost", disabled: importingAll, onClick: closeImportAll },
          t("common.cancel"),
        ),
        h(
          Btn,
          {
            variant: "primary",
            icon: "plus",
            disabled: importingAll || allCount === 0,
            onClick: importAll,
          },
          importingAll
            ? t("project.importBusy")
            : t("project.importConfirmSubmit", { n: allCount ?? 0 }),
        ),
      ),
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      h(
        "div",
        {
          className: "t-mono",
          style: {
            fontSize: 11.5,
            color: "var(--tomato-ink-3)",
            wordBreak: "break-all",
          },
        },
        (project && project.name) || projectId,
      ),
      importError !== "" ? alertBox(importError) : null,
    ),
  );

  return h(
    "div",
    null,
    statsError !== "" ? alertBox(statsError) : null,
    missing ? missingBlock : listBlock,
    h(LibraryPreview, { item: preview, onClose: () => setPreview(null) }),
    importAllDialog,
  );
}

// ---------------------------------------------------------------- 已登记 + 导出

function stateChip(state) {
  if (state === "available")
    return h(Chip, { tone: "leaf" }, t("project.stateAvailable"));
  if (state === "missing")
    return h(Chip, { tone: "danger" }, t("project.stateMissing"));
  if (state === "unavailable")
    return h(Chip, { tone: "neutral" }, t("project.stateUnavailable"));
  return null;
}

export function ProjectRegisteredSection({ project, reloadKey, onChanged }) {
  const projectId = project.id;
  const [resources, setResources] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [states, setStates] = useState(null);
  const [stateBusy, setStateBusy] = useState(false);
  const [stateError, setStateError] = useState("");
  const [scanSummary, setScanSummary] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [localReload, setLocalReload] = useState(0);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupError, setCleanupError] = useState("");

  useEffect(() => {
    setOffset(0);
    setStates(null);
    setScanSummary("");
    setStateError("");
    setExportError("");
    setCleanupOpen(false);
    setCleanupError("");
  }, [projectId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    getProjectResources(projectId, { offset, limit: RESOURCE_PAGE })
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result && result.resources)
          ? result.resources
          : [];
        setResources(list);
        setTotal(Math.max(0, Number(result && result.total) || 0));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorText(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, offset, reloadKey, localReload]);

  async function loadStates() {
    const result = await scanProjectLibrary(projectId);
    const list = Array.isArray(result && result.resources)
      ? result.resources
      : [];
    const map = new Map(
      list.map((entry) => [
        entry.id,
        { state: entry.state, sizeBytes: entry.sizeBytes },
      ]),
    );
    setStates(map);
    const count = (state) =>
      list.filter((entry) => entry.state === state).length;
    setScanSummary(
      t("project.statesChecked", {
        a: count("available"),
        m: count("missing"),
        u: list.length - count("available") - count("missing"),
      }),
    );
    return map;
  }

  async function checkStates() {
    if (stateBusy || exporting) return;
    setStateBusy(true);
    setStateError("");
    try {
      await loadStates();
    } catch (error) {
      setStateError(errorText(error));
    } finally {
      setStateBusy(false);
    }
  }

  async function cleanupMissing() {
    if (cleanupBusy) return;
    setCleanupBusy(true);
    setCleanupError("");
    try {
      // 不带 ids：服务端只清「仍缺失且没有教学引用」的登记；有引用会保留并
      // 由 core 拒绝，错误原样显示。磁盘文件永远不删。
      const result = await cleanupProjectResources(projectId);
      const removed = Number(result && result.removed) || 0;
      notify(
        removed > 0
          ? t("project.cleanupDone", { n: removed })
          : t("project.cleanupEmpty"),
        removed > 0 ? "brand" : "neutral",
      );
      setCleanupOpen(false);
      setStates(null);
      setScanSummary("");
      setLocalReload((value) => value + 1);
      onChanged?.();
    } catch (error) {
      setCleanupError(errorText(error));
    } finally {
      setCleanupBusy(false);
    }
  }

  async function exportList(format) {
    if (exporting || stateBusy) return;
    setExporting(true);
    setExportError("");
    try {
      const all = await collectProjectResources(projectId);
      if (all.length === 0) {
        notify(t("project.exportEmpty"), "neutral");
        return;
      }
      // 清单要求带 state；导出时现扫一次，避免把上次检查的旧状态写进文件。
      const map = await loadStates();
      const rows = all.map((resource) => ({
        id: resource.id || "",
        title: resource.title || "",
        kind: resource.kind || "",
        path: resource.path || "",
        state: (map.get(resource.id) || {}).state || "",
      }));
      const columns = ["id", "title", "kind", "path", "state"];
      const text =
        format === "csv"
          ? rowsToCsv(columns, rows)
          : JSON.stringify(rows, null, 2);
      downloadText(
        `tomato-project-${projectId}-resources-${todayKey()}.${format}`,
        text,
        format === "csv" ? "text/csv;charset=utf-8" : "application/json",
      );
      notify(t("project.exportDone", { n: rows.length }), "brand");
    } catch (error) {
      setExportError(errorText(error));
    } finally {
      setExporting(false);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + RESOURCE_PAGE, total);

  const cleanupDialog = h(
    Modal,
    {
      open: cleanupOpen,
      onClose: () => (cleanupBusy ? null : setCleanupOpen(false)),
      icon: "trash",
      title: t("project.cleanupTitle"),
      subtitle: t("project.cleanupBody"),
      width: 520,
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          {
            variant: "ghost",
            disabled: cleanupBusy,
            onClick: () => setCleanupOpen(false),
          },
          t("common.cancel"),
        ),
        h(
          Btn,
          {
            variant: "danger",
            icon: "trash",
            disabled: cleanupBusy,
            onClick: cleanupMissing,
          },
          cleanupBusy ? t("project.cleanupBusy") : t("project.cleanupConfirm"),
        ),
      ),
    },
    cleanupError !== "" ? alertBox(cleanupError) : null,
  );

  return h(
    "div",
    null,
    h(
      Card,
      null,
      h(SectionTitle, {
        icon: "folder",
        title: t("project.registeredTitle"),
        hint: t("project.registeredCount", { n: total }),
        action: h(
          "div",
          { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "trash",
              disabled: cleanupBusy || stateBusy || exporting || loading,
              onClick: () => {
                setCleanupError("");
                setCleanupOpen(true);
              },
            },
            cleanupBusy
              ? t("project.cleanupBusy")
              : t("project.cleanupMissing"),
          ),
          h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "refresh",
              disabled: stateBusy || exporting || loading,
              onClick: checkStates,
            },
            stateBusy ? t("project.checkingStates") : t("project.checkStates"),
          ),
          h(
            Btn,
            {
              variant: "soft",
              size: "sm",
              icon: "download",
              disabled: exporting || stateBusy || loading,
              onClick: () => exportList("json"),
            },
            exporting ? t("project.exporting") : t("project.exportJson"),
          ),
          h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "download",
              disabled: exporting || stateBusy || loading,
              onClick: () => exportList("csv"),
            },
            t("project.exportCsv"),
          ),
        ),
      }),
      mutedHint(t("project.registeredHint")),
      scanSummary !== ""
        ? h(
            "div",
            {
              style: {
                marginTop: 7,
                fontSize: 11.5,
                color: "var(--tomato-ink-3)",
              },
            },
            scanSummary,
          )
        : null,
      stateError !== "" ? alertBox(stateError) : null,
      exportError !== "" ? alertBox(exportError) : null,
      h("div", { style: { marginTop: 10 } }),
      loading && resources.length === 0
        ? h(Skeleton, { w: "52%", h: 13 })
        : resources.length === 0
          ? h(Empty, {
              icon: "folder",
              title: t("project.registeredEmpty"),
              hint: t("project.registeredEmptyHint"),
            })
          : h(
              "div",
              null,
              resources.map((resource, index) => {
                const info = states ? states.get(resource.id) : null;
                return h(
                  "div",
                  {
                    key: resource.id || `resource-${index}`,
                    className: "t-row",
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 44,
                      padding: "6px 6px",
                      borderBottom:
                        index === resources.length - 1
                          ? "none"
                          : "1px solid var(--tomato-line)",
                    },
                  },
                  h(Icon, {
                    name: "folder",
                    size: 15,
                    style: { color: "var(--tomato-ink-3)", flex: "none" },
                  }),
                  h(
                    "div",
                    {
                      style: {
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      },
                    },
                    h(
                      "span",
                      {
                        style: {
                          fontSize: 12.5,
                          color: "var(--tomato-ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      },
                      resource.title || resource.path,
                    ),
                    h(
                      "span",
                      {
                        className: "t-mono",
                        style: {
                          fontSize: 10.5,
                          color: "var(--tomato-ink-3)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      },
                      resource.path,
                    ),
                  ),
                  resource.kind
                    ? h(
                        Chip,
                        { tone: "neutral" },
                        resourceKindLabel(resource.kind),
                      )
                    : null,
                  info && info.sizeBytes
                    ? h(
                        "span",
                        {
                          className: "t-mono",
                          style: {
                            fontSize: 10.5,
                            color: "var(--tomato-ink-3)",
                            flex: "none",
                          },
                        },
                        fmtSize(info.sizeBytes),
                      )
                    : null,
                  info ? stateChip(info.state) : null,
                );
              }),
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    flexWrap: "wrap",
                  },
                },
                h(
                  "span",
                  {
                    className: "t-mono",
                    style: { fontSize: 11, color: "var(--tomato-ink-3)" },
                  },
                  total > 0
                    ? t("project.registeredRange", {
                        a: pageStart,
                        b: pageEnd,
                        total,
                      })
                    : t("project.registeredCount", { n: 0 }),
                ),
                h("div", { style: { flex: 1 } }),
                h(
                  Btn,
                  {
                    variant: "ghost",
                    size: "sm",
                    icon: "arrowLeft",
                    disabled: offset <= 0 || loading,
                    onClick: () =>
                      setOffset(Math.max(0, offset - RESOURCE_PAGE)),
                  },
                  t("project.registeredPrev"),
                ),
                h(
                  Btn,
                  {
                    variant: "ghost",
                    size: "sm",
                    iconRight: "arrowRight",
                    disabled: offset + RESOURCE_PAGE >= total || loading,
                    onClick: () => setOffset(offset + RESOURCE_PAGE),
                  },
                  t("project.registeredNext"),
                ),
              ),
            ),
    ),
    cleanupDialog,
  );
}
