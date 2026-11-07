// 应试教育：学习项目总览与项目详情。
//
// 数据面：快照的 data.education（教学域）+ data.projects / data.tasks /
// data.visions / data.settings。页面自己从 assessment/submission/grade/
// correction 证据派生「待交 / 待订正 / 待复核」与作业状态，不依赖 runtime
// 的 summaries（旧快照可能没有它），也不 import core（客户端半只拿快照）。
//
// 写操作只发用户可发的 Action：selectTask + startTimer、toggleTask、
// education.confirmProgress、education.retryEvent。课程/作业/批改/复盘等
// 命令是 assistantOnly，页面只展示，不伪造表单。
import { h, useEffect, useState } from "../runtime.js";
import { t, registerCopy } from "../shared/copy.js";
import {
  PageHeader,
  Card,
  SectionTitle,
  Btn,
  IconBtn,
  Chip,
  Dot,
  Badge,
  Bar,
  Empty,
  Skeleton,
  Stat,
  Check,
  Field,
  Input,
  Modal,
  notify,
} from "../shared/ui.js";
import { useSnapshot, tryDispatch, refresh } from "../shared/store.js";
import {
  getLibraryGrant,
  authorizeLibrary,
  revokeLibraryGrant,
  scanProjectLibrary,
  scanLibrary,
  getLibraryStats,
  getLibraryItems,
  getFileToken,
  libraryFileUrl,
  registerResource,
} from "../shared/api.js";
import {
  addDays,
  dayKey,
  taskById,
  projectById,
  projectColor,
} from "../shared/derive.js";
import { registerPage } from "../app/registry.js";
import { AssignmentDialog, teachingTargetOf } from "./assignment-dialog.js";

registerCopy("education", {
  zh: {
    eyebrow: "番茄 Todo",
    title: "应试教育",
    subtitle: "目标 130+，2028 年入学，初试 2027-12-18 预估。",
    refreshTitle: "刷新",
    loading: "正在读取教学计划…",
    projectsTitle: "学习项目",
    projectsHint: "{n} 个",
    emptyProjectsTitle: "还没有学习项目",
    emptyProjectsHint:
      "学习项目由对话中的学习助手创建并绑定资料目录，这里负责展示与执行。",
    targetLabel: "目标",
    examMode: "应试模式",
    examDateLabel: "考试日期",
    countdownLabel: "考试倒计时",
    countdownNone: "未设置考试日期",
    countdownToday: "就在今天",
    daysUnit: "天",
    daysPast: "已过 {n} 天",
    unnamedProject: "未命名项目",
    resourcesCount: "{n} 份资料",
    latestProgressLabel: "最新学情",
    noProgress: "还没有学情记录",
    viewDetail: "查看详情",
    assignAction: "布置作业",
    submitAction: "提交作业",
    gradeAction: "批改作业",
    correctAction: "订正作业",
    reviewAction: "复核作业",
    todayTasks: "今日学习任务",
    todayTasksHint: "{n} 项",
    startFocus: "开始专注",
    focusStarted: "已开始专注",
    noTodayTasks: "今天没有安排学习任务。",
    lessonKind: "课程",
    openWorkbench: "打开任务详情",
    homeworkKind: "作业",
    studyTaskKind: "学习",
    reminderLabel: "提醒 {time}",
    focusMinutesLabel: "{n} 分钟",
    estimateLabel: "预计 {n} 个番茄",
    needsAttention: "需要处理",
    attentionHint: "{n} 项",
    pendingSubmit: "待交",
    pendingGrade: "待批改",
    pendingCorrection: "待订正",
    pendingReview: "待复核",
    nothingPending: "暂时没有待交、待批改、待订正或待复核的事项。",
    causeLabel: "错因",
    retestLabel: "复测 {date}",
    deadlineLabel: "截止 {date}",
    timeUnknown: "时间未定",
    nextWeek: "接下来一周",
    weekLessons: "待上课",
    weekResources: "相关资料",
    weekAssessments: "课程与考试",
    nextWeekEmpty: "这一周没有课程、资料或考试安排。",
    topicsCount: "{n} 个知识点",
    recentProgress: "最近学到哪里",
    confirm: "确认",
    confirmed: "已确认",
    sourceUser: "自己记录",
    sourceAssistant: "学习助手",
    stateStudied: "学过",
    statePracticing: "练习中",
    stateNeedsReview: "需复习",
    unnamedTopic: "未命名知识点",
    back: "返回",
    projectMissing: "这个学习项目已不存在。",
    directory: "资料目录",
    directoryEmpty: "未绑定资料目录",
    directorySharedLabel: "共享资料库",
    libraryTitle: "资料库",
    libraryAuthorized: "已授权",
    libraryUnauthorized: "未授权",
    libraryProjects: "{n} 个项目可用",
    librarySharedHint:
      "一次授权后所有学习项目共用；项目单独授权只能指向它里面的子目录。",
    libraryMissingHint:
      "授权一次，所有学习项目共用同一份资料，不必逐个项目绑定。",
    libraryAuthorize: "授权目录",
    libraryChange: "更换",
    libraryScan: "扫描",
    libraryRevoke: "取消授权",
    libraryScanning: "正在检查资料…",
    libraryScanNone: "还没有学习项目可扫描。",
    libraryScanDone: "已检查 {n} 份资料：可用 {a}，缺失 {m}，不可用 {u}",
    libraryDialogTitle: "授权共享资料库",
    libraryDialogSubtitle:
      "输入本机绝对路径，例如 /home/fuurin/exam。一次授权后所有学习项目共用；项目单独授权只能收窄到它里面的子目录。",
    libraryDialogLabel: "目录绝对路径",
    libraryDialogPlaceholder: "/home/fuurin/exam",
    libraryDialogHint:
      "只能选真实存在的普通目录；根目录、整个主目录、应用数据目录和经过符号链接的路径都会被拒绝。",
    libraryPathRequired: "请先输入资料库的绝对路径",
    librarySaving: "正在授权…",
    librarySaved: "共享资料库已授权",
    libraryRevoking: "正在取消…",
    libraryRevoked: "已取消共享资料库授权",
    libraryRevokeTitle: "取消共享资料库授权？",
    libraryRevokeWarning:
      "取消后，没有单独授权的项目会立即失去资料访问；按项目的单独授权会保留，并继续按原目录挂载。",
    libraryLoading: "正在读取资料库授权…",
    libraryUnavailable: "无法读取资料库状态，runtime 可能未连接。",
    libraryRetry: "重试",
    libraryIndexNever: "尚未生成资料库索引",
    libraryIndexStale: "索引属于旧目录，请重新扫描",
    libraryIndexScanned: "已扫描 {n} 个文件 · {time}",
    libraryIndexScanning: "正在扫描资料库…",
    libraryIndexHint:
      "索引只记录文件清单，不写入计划或备份；只有真正引用某份资料时才登记。",
    libraryIndexByKind: "按类型",
    libraryIndexByTop: "按目录",
    libraryIndexKindPdf: "PDF",
    libraryIndexKindImage: "图片",
    libraryIndexKindAudio: "音频",
    libraryIndexKindVideo: "视频",
    libraryIndexKindDoc: "文档",
    libraryIndexKindOther: "其他",
    libraryIndexRootDir: "库根目录",
    libraryIndexScan: "扫描/重新扫描",
    libraryIndexScanDone: "已扫描 {n} 个文件，用时 {ms} 毫秒",
    libraryIndexCheck: "检查已登记",
    libraryIndexCheckDone: "已检查 {n} 份登记：可用 {a}，缺失 {m}，不可用 {u}",
    libraryIndexNone:
      "还没有资料库索引。点下面的按钮扫描共享库，之后可按目录浏览全部资料。",
    libraryIndexGenerate: "扫描生成索引",
    libraryIndexSearchPlaceholder: "搜索文件名或路径",
    libraryIndexAll: "全部类型",
    libraryIndexEmpty: "没有匹配的资料。",
    libraryIndexTotal: "{n} 个文件",
    libraryIndexPage: "第 {page} / {pages} 页",
    libraryIndexPrev: "上一页",
    libraryIndexNext: "下一页",
    libraryIndexNoFilter: "未匹配到项目目录，显示全部文件",
    libraryIndexFiltered: "按目录 {dirs} 过滤",
    libraryIndexPreview: "预览",
    libraryIndexRegister: "登记",
    libraryIndexUnpreviewable: "此类型或大小不支持预览，可下载原件。",
    libraryIndexDownload: "下载原件",
    libraryIndexLoading: "正在读取索引…",
    libraryIndexLoadFailed: "索引读取失败",
    libraryIndexRegisterTitle: "登记为项目资料",
    libraryIndexRegisterSubtitle:
      "登记会写入教学记录；只在课程、作业或学情要引用这份资料时才需要。",
    libraryIndexTitleLabel: "标题",
    libraryIndexKindLabel: "类型",
    libraryIndexSourceLabel: "来源",
    libraryIndexEditionLabel: "版本",
    libraryIndexRegisterSubmit: "登记",
    libraryIndexRegistered: "已登记为项目资料",
    libraryIndexRegisterRequired: "请填写标题",
    libraryIndexFileTitle: "资料预览",
    libraryIndexFileLoading: "正在获取文件…",
    libraryIndexFileFailed: "无法读取文件",
    libraryIndexFileMeta: "{kind} · {size}",
    syllabusLabel: "考纲",
    pastPapersCount: "真题 {n} 份",
    mockPapersCount: "模拟题 {n} 份",
    resourceGroups: "资料分类",
    resourceList: "资料列表",
    resourceEmpty: "还没有资料。资料由学习助手导入并授权目录。",
    progressHistory: "学情记录",
    completedTasksTitle: "最近完成的学习任务",
    completedTasksEmpty: "还没有完成记录。",
    statResources: "资料总数",
    statLessons: "已上课",
    statAssessments: "作业与考试",
    statProgress: "学习记录",
    semesterTitle: "学期进度",
    semesterEmpty: "还没有学期计划。",
    revisionLabel: "第 {n} 版",
    weekLabel: "第 {n} 周",
    milestoneLessons: "{n} 节课",
    weeksProgress: "已进行 {n} / {m} 周",
    assessmentsTitle: "作业与考试",
    assessmentsEmpty: "没有作业或考试。",
    reviewsTitle: "每日复盘",
    reviewsEmpty: "还没有每日复盘。",
    findingsLabel: "发现",
    actionsLabel: "行动",
    eventsTitle: "教学事件",
    eventsEmpty: "没有教学事件。",
    retryEvent: "重试",
    eventPending: "待处理",
    eventRunning: "进行中",
    eventDone: "已完成",
    eventState: "状态：{state}",
    whitelistTitle: "应用白名单",
    whitelistGeneric: "使用通用白名单",
    whitelistEmpty: "白名单为空",
    visionTitle: "愿景",
    visionEmpty: "还没有关联愿景。",
    projectTasksTitle: "项目任务",
    projectTasksEmpty: "这个项目还没有任务。",
    openTasks: "未完成",
    doneTasks: "已完成",
    statusUpcoming: "未开始",
    statusMissed: "已错过",
    statusInProgress: "进行中",
    statusAwaiting: "待交",
    statusOverdue: "已逾期",
    statusSubmitted: "已提交",
    statusCorrectionDue: "待订正",
    statusNeedsReview: "待复核",
    statusGraded: "已批改",
    kindWeeklyExam: "周测",
    kindMockExam: "模拟考",
    kindRetest: "复测",
    resourceKindSyllabus: "考纲",
    resourceKindCourse: "课程",
    resourceKindBook: "教材",
    resourceKindPastPaper: "真题",
    resourceKindMockPaper: "模拟题",
    resourceKindReference: "参考",
    resourceKindAttachment: "附件",
    resourceKindAnswerSheet: "答卷",
  },
  en: {
    eyebrow: "Tomato Todo",
    title: "Study projects",
    subtitle: "Goal 130+, enrolling 2028; first exam estimated for 2027-12-18.",
    refreshTitle: "Refresh",
    loading: "Loading the study plan…",
    projectsTitle: "Study projects",
    projectsHint: "{n}",
    emptyProjectsTitle: "No study projects yet",
    emptyProjectsHint:
      "The study assistant creates projects and binds their folders in conversation; this page shows and runs them.",
    targetLabel: "Target",
    examMode: "Exam mode",
    examDateLabel: "Exam date",
    countdownLabel: "Exam countdown",
    countdownNone: "No exam date",
    countdownToday: "Today",
    daysUnit: "days",
    daysPast: "{n} days ago",
    unnamedProject: "Untitled project",
    resourcesCount: "{n} resources",
    latestProgressLabel: "Latest progress",
    noProgress: "No progress yet",
    viewDetail: "View details",
    assignAction: "Assign homework",
    submitAction: "Submit homework",
    gradeAction: "Grade homework",
    correctAction: "Correct homework",
    reviewAction: "Review homework",
    todayTasks: "Today's study tasks",
    todayTasksHint: "{n}",
    startFocus: "Start focus",
    focusStarted: "Focus started",
    noTodayTasks: "No study tasks scheduled today.",
    lessonKind: "Lesson",
    openWorkbench: "Open task details",
    homeworkKind: "Homework",
    studyTaskKind: "Study",
    reminderLabel: "Remind {time}",
    focusMinutesLabel: "{n} min",
    estimateLabel: "{n} planned pomodoros",
    needsAttention: "Needs attention",
    attentionHint: "{n}",
    pendingSubmit: "To submit",
    pendingGrade: "To grade",
    pendingCorrection: "To correct",
    pendingReview: "Needs review",
    nothingPending: "Nothing to submit, grade, correct, or review right now.",
    causeLabel: "Cause",
    retestLabel: "Retest {date}",
    deadlineLabel: "Due {date}",
    timeUnknown: "Time TBD",
    nextWeek: "Next seven days",
    weekLessons: "Lessons",
    weekResources: "Related resources",
    weekAssessments: "Courses & exams",
    nextWeekEmpty: "No lessons, resources, or exams this week.",
    topicsCount: "{n} topics",
    recentProgress: "Recently studied",
    confirm: "Confirm",
    confirmed: "Confirmed",
    sourceUser: "Self-recorded",
    sourceAssistant: "Assistant",
    stateStudied: "Studied",
    statePracticing: "Practicing",
    stateNeedsReview: "Review",
    unnamedTopic: "Untitled topic",
    back: "Back",
    projectMissing: "This study project no longer exists.",
    directory: "Resource folder",
    directoryEmpty: "No folder bound",
    directorySharedLabel: "Shared library",
    libraryTitle: "Resource library",
    libraryAuthorized: "Authorized",
    libraryUnauthorized: "Not authorized",
    libraryProjects: "{n} projects available",
    librarySharedHint:
      "Authorize once and every study project shares it; per-project grants can only narrow to a subfolder.",
    libraryMissingHint:
      "Authorize one folder and every study project shares it — no per-project binding needed.",
    libraryAuthorize: "Authorize folder",
    libraryChange: "Change",
    libraryScan: "Scan",
    libraryRevoke: "Revoke",
    libraryScanning: "Checking resources…",
    libraryScanNone: "No study projects to scan yet.",
    libraryScanDone:
      "Checked {n} resources: {a} available, {m} missing, {u} unavailable",
    libraryDialogTitle: "Authorize shared library",
    libraryDialogSubtitle:
      "Enter an absolute path on this machine, e.g. /home/fuurin/exam. One authorization covers every study project; per-project grants can only narrow to a subfolder.",
    libraryDialogLabel: "Absolute folder path",
    libraryDialogPlaceholder: "/home/fuurin/exam",
    libraryDialogHint:
      "Must be an existing ordinary folder; root, your whole home, app data folders and paths through symlinks are rejected.",
    libraryPathRequired: "Enter the absolute path of the library first",
    librarySaving: "Authorizing…",
    librarySaved: "Shared library authorized",
    libraryRevoking: "Revoking…",
    libraryRevoked: "Shared library authorization revoked",
    libraryRevokeTitle: "Revoke shared library authorization?",
    libraryRevokeWarning:
      "Projects without their own grant immediately lose resource access; per-project grants stay and keep mounting their own folders.",
    libraryLoading: "Reading library authorization…",
    libraryUnavailable:
      "Could not read the library state; runtime may be offline.",
    libraryRetry: "Retry",
    libraryIndexNever: "No library index yet",
    libraryIndexStale: "The index belongs to a previous folder; scan again.",
    libraryIndexScanned: "Scanned {n} files · {time}",
    libraryIndexScanning: "Scanning the resource library…",
    libraryIndexHint:
      "The index only stores the file list; it is not part of the plan or backups. A resource is registered only when teaching records actually reference it.",
    libraryIndexByKind: "By type",
    libraryIndexByTop: "By folder",
    libraryIndexKindPdf: "PDF",
    libraryIndexKindImage: "Images",
    libraryIndexKindAudio: "Audio",
    libraryIndexKindVideo: "Video",
    libraryIndexKindDoc: "Documents",
    libraryIndexKindOther: "Other",
    libraryIndexRootDir: "Library root",
    libraryIndexScan: "Scan / rescan",
    libraryIndexScanDone: "Scanned {n} files in {ms} ms",
    libraryIndexCheck: "Check registered",
    libraryIndexCheckDone:
      "Checked {n} registrations: {a} available, {m} missing, {u} unavailable",
    libraryIndexNone:
      "No library index yet. Scan the shared library to browse every file by folder without registering them one by one.",
    libraryIndexGenerate: "Scan to build index",
    libraryIndexSearchPlaceholder: "Search file name or path",
    libraryIndexAll: "All types",
    libraryIndexEmpty: "No matching files.",
    libraryIndexTotal: "{n} files",
    libraryIndexPage: "Page {page} / {pages}",
    libraryIndexPrev: "Previous",
    libraryIndexNext: "Next",
    libraryIndexNoFilter:
      "No project folder matched; showing all indexed files.",
    libraryIndexFiltered: "Filtered by folder {dirs}",
    libraryIndexPreview: "Preview",
    libraryIndexRegister: "Register",
    libraryIndexUnpreviewable:
      "This type or size cannot be previewed; download the original instead.",
    libraryIndexDownload: "Download original",
    libraryIndexLoading: "Reading the index…",
    libraryIndexLoadFailed: "Could not read the index",
    libraryIndexRegisterTitle: "Register as project resource",
    libraryIndexRegisterSubtitle:
      "Registration writes a teaching record. Use it only when a lesson, assignment, or progress note actually references this file.",
    libraryIndexTitleLabel: "Title",
    libraryIndexKindLabel: "Type",
    libraryIndexSourceLabel: "Source",
    libraryIndexEditionLabel: "Edition",
    libraryIndexRegisterSubmit: "Register",
    libraryIndexRegistered: "Registered as a project resource",
    libraryIndexRegisterRequired: "Enter a title",
    libraryIndexFileTitle: "Resource preview",
    libraryIndexFileLoading: "Loading file…",
    libraryIndexFileFailed: "Could not read the file",
    libraryIndexFileMeta: "{kind} · {size}",
    syllabusLabel: "Syllabus",
    pastPapersCount: "{n} past papers",
    mockPapersCount: "{n} mock papers",
    resourceGroups: "By kind",
    resourceList: "Resources",
    resourceEmpty:
      "No resources yet. The assistant imports them and authorizes the folder.",
    progressHistory: "Progress records",
    completedTasksTitle: "Recently completed study tasks",
    completedTasksEmpty: "No completed study tasks yet.",
    statResources: "Resources",
    statLessons: "Lessons attended",
    statAssessments: "Assessments",
    statProgress: "Progress records",
    semesterTitle: "Semester progress",
    semesterEmpty: "No semester plan yet.",
    revisionLabel: "v{n}",
    weekLabel: "Week {n}",
    milestoneLessons: "{n} lessons",
    weeksProgress: "{n} of {m} weeks",
    assessmentsTitle: "Assessments",
    assessmentsEmpty: "No assessments.",
    reviewsTitle: "Daily reviews",
    reviewsEmpty: "No daily reviews yet.",
    findingsLabel: "Findings",
    actionsLabel: "Actions",
    eventsTitle: "Teaching events",
    eventsEmpty: "No teaching events.",
    retryEvent: "Retry",
    eventPending: "Pending",
    eventRunning: "Running",
    eventDone: "Done",
    eventState: "State: {state}",
    whitelistTitle: "App whitelist",
    whitelistGeneric: "Using the general whitelist",
    whitelistEmpty: "Whitelist is empty",
    visionTitle: "Vision",
    visionEmpty: "No linked vision yet.",
    projectTasksTitle: "Project tasks",
    projectTasksEmpty: "No tasks in this project yet.",
    openTasks: "Open",
    doneTasks: "Done",
    statusUpcoming: "Upcoming",
    statusMissed: "Missed",
    statusInProgress: "In progress",
    statusAwaiting: "To submit",
    statusOverdue: "Overdue",
    statusSubmitted: "Submitted",
    statusCorrectionDue: "To correct",
    statusNeedsReview: "Needs review",
    statusGraded: "Graded",
    kindWeeklyExam: "Weekly exam",
    kindMockExam: "Mock exam",
    kindRetest: "Retest",
    resourceKindSyllabus: "Syllabus",
    resourceKindCourse: "Course",
    resourceKindBook: "Book",
    resourceKindPastPaper: "Past paper",
    resourceKindMockPaper: "Mock paper",
    resourceKindReference: "Reference",
    resourceKindAttachment: "Attachment",
    resourceKindAnswerSheet: "Answer sheet",
  },
  ja: {
    pendingGrade: "採点待ち",
    nothingPending: "提出・採点・訂正・再確認待ちの課題はありません。",
    assignAction: "宿題を出す",
    submitAction: "宿題を提出",
    gradeAction: "宿題を採点",
    correctAction: "宿題を訂正",
    reviewAction: "宿題を再確認",
  },
});

// ---------------------------------------------------------------- 纯函数

const RESOURCE_KINDS = [
  "syllabus",
  "course",
  "book",
  "pastPaper",
  "mockPaper",
  "reference",
  "attachment",
  "answerSheet",
];

const RESOURCE_KIND_COPY = {
  syllabus: "resourceKindSyllabus",
  course: "resourceKindCourse",
  book: "resourceKindBook",
  pastPaper: "resourceKindPastPaper",
  mockPaper: "resourceKindMockPaper",
  reference: "resourceKindReference",
  attachment: "resourceKindAttachment",
  answerSheet: "resourceKindAnswerSheet",
};

// 索引浏览分组（与 runtime library-index.mjs 的 INDEX_KINDS 对应）。
const INDEX_KINDS = ["pdf", "image", "audio", "video", "doc", "other"];
const INDEX_KIND_COPY = {
  pdf: "libraryIndexKindPdf",
  image: "libraryIndexKindImage",
  audio: "libraryIndexKindAudio",
  video: "libraryIndexKindVideo",
  doc: "libraryIndexKindDoc",
  other: "libraryIndexKindOther",
};

function indexKindLabel(kind) {
  const key = INDEX_KIND_COPY[kind];
  return key ? t(`education.${key}`) : strOr(kind);
}

function formatBytes(n) {
  const value = numOr(n, 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function strOr(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function hasTs(value) {
  const n = Number(value);
  // 上限避免异常时间戳让 Date 进入 Invalid Date 后渲染出 NaN。
  return Number.isFinite(n) && n > 0 && n < 1e12;
}

const pad2 = (n) => String(n).padStart(2, "0");

function clockOf(ts) {
  if (!hasTs(ts)) return "";
  const d = new Date(Number(ts) * 1000);
  if (!Number.isFinite(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDateTime(ts) {
  if (!hasTs(ts)) return t("education.timeUnknown");
  return `${dayKey(Number(ts))} ${clockOf(ts)}`;
}

function fmtRange(startSecs, endSecs) {
  if (!hasTs(startSecs)) return t("education.timeUnknown");
  const startDay = dayKey(Number(startSecs));
  const start = clockOf(startSecs);
  if (!hasTs(endSecs)) return `${startDay} ${start}`;
  const endDay = dayKey(Number(endSecs));
  const end = clockOf(endSecs);
  return endDay === startDay
    ? `${startDay} ${start}–${end}`
    : `${startDay} ${start} – ${endDay} ${end}`;
}

function sortDesc(list, key) {
  return asArray(list)
    .slice()
    .sort((a, b) => numOr(b && b[key], 0) - numOr(a && a[key], 0));
}

function sortAsc(list, key) {
  return asArray(list)
    .slice()
    .sort((a, b) => numOr(a && a[key], 0) - numOr(b && b[key], 0));
}

/** 旧 runtime 可能给 education:{projects:[],events:[],summaries:[]}，全部容错。 */
function normalizeEducation(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const list = (key) =>
    asArray(src[key]).filter((item) => item && typeof item === "object");
  return {
    focusTasks: list("focusTasks"),
    projects: list("projects"),
    resources: list("resources"),
    semesters: list("semesters"),
    semesterHistory: list("semesterHistory"),
    lessons: list("lessons"),
    assessments: list("assessments"),
    submissions: list("submissions"),
    grades: list("grades"),
    reviews: list("reviews"),
    events: list("events"),
    completedTasks: list("completedTasks"),
    progress: list("progress"),
    corrections: list("corrections"),
  };
}

/** 最新提交 / 最新批改 / 已接受的订正，语义对齐 learning.ts 的摘要索引。 */
function buildIndex(edu) {
  const submissionOf = new Map();
  for (const submission of edu.submissions) {
    const old = submissionOf.get(submission.assessmentId);
    if (
      old === undefined ||
      numOr(submission.submittedAt, 0) >= numOr(old.submittedAt, 0)
    ) {
      submissionOf.set(submission.assessmentId, submission);
    }
  }
  const gradeOf = new Map();
  for (const grade of edu.grades) {
    const old = gradeOf.get(grade.submissionId);
    if (
      old === undefined ||
      numOr(grade.gradedAt, 0) >= numOr(old.gradedAt, 0)
    ) {
      gradeOf.set(grade.submissionId, grade);
    }
  }
  const accepted = new Set();
  for (const correction of edu.corrections) {
    if (correction && correction.accepted === true) {
      accepted.add(`${correction.gradeId}|${correction.questionId}`);
    }
  }
  return { submissionOf, gradeOf, accepted };
}

function examDeadline(assessment) {
  const starts = numOr(assessment.startsAt, 0);
  const ends = numOr(assessment.endsAt, 0);
  return hasTs(assessment.startedAt)
    ? Number(assessment.startedAt) + (ends - starts)
    : ends;
}

/** 本地派生作业/考试状态；与 core learning.ts 的 assessmentSummary 同序。 */
function assessmentStatus(assessment, index, at) {
  const submission = index.submissionOf.get(assessment.id) || null;
  const grade = submission ? index.gradeOf.get(submission.id) || null : null;
  if (grade !== null) {
    if (grade.needsReview === true) return "needsReview";
    const errors = asArray(grade.errors);
    const pending = errors.some(
      (error) =>
        error && !index.accepted.has(`${grade.id}|${error.questionId}`),
    );
    return pending ? "correctionDue" : "graded";
  }
  if (submission !== null) return "submitted";
  const kind = assessment.kind;
  const started = hasTs(assessment.startedAt);
  if (
    kind !== "homework" &&
    !started &&
    hasTs(assessment.startsAt) &&
    dayKey(at) > dayKey(Number(assessment.startsAt))
  ) {
    return "missed";
  }
  if (
    kind !== "homework" &&
    started &&
    !hasTs(assessment.stoppedAt) &&
    at < examDeadline(assessment)
  ) {
    return "inProgress";
  }
  if (
    kind !== "homework" &&
    started &&
    (hasTs(assessment.stoppedAt) || at >= examDeadline(assessment))
  ) {
    return "awaitingSubmission";
  }
  if (kind === "homework" && at >= numOr(assessment.endsAt, 0))
    return "overdue";
  if (at < numOr(assessment.startsAt, 0) || (kind !== "homework" && !started))
    return "upcoming";
  return "awaitingSubmission";
}

function statusLabel(status) {
  const map = {
    upcoming: "statusUpcoming",
    missed: "statusMissed",
    inProgress: "statusInProgress",
    awaitingSubmission: "statusAwaiting",
    overdue: "statusOverdue",
    submitted: "statusSubmitted",
    correctionDue: "statusCorrectionDue",
    needsReview: "statusNeedsReview",
    graded: "statusGraded",
  };
  return map[status] ? t(`education.${map[status]}`) : status;
}

function statusTone(status) {
  if (status === "overdue" || status === "missed") return "danger";
  if (
    status === "awaitingSubmission" ||
    status === "correctionDue" ||
    status === "needsReview"
  ) {
    return "sun";
  }
  if (status === "inProgress") return "brand";
  if (status === "graded") return "leaf";
  return "neutral";
}

function assessmentKindLabel(kind) {
  if (kind === "homework") return t("education.homeworkKind");
  if (kind === "weeklyExam") return t("education.kindWeeklyExam");
  if (kind === "mockExam") return t("education.kindMockExam");
  if (kind === "retest") return t("education.kindRetest");
  return strOr(kind, t("education.studyTaskKind"));
}

function resourceKindLabel(kind) {
  const key = RESOURCE_KIND_COPY[kind];
  return key ? t(`education.${key}`) : strOr(kind);
}

function progressStateLabel(state) {
  if (state === "studied") return t("education.stateStudied");
  if (state === "practicing") return t("education.statePracticing");
  if (state === "needsReview") return t("education.stateNeedsReview");
  return strOr(state);
}

function progressStateTone(state) {
  if (state === "studied") return "leaf";
  if (state === "practicing") return "brand";
  if (state === "needsReview") return "sun";
  return "neutral";
}

function progressSourceLabel(source) {
  if (source === "assistant") return t("education.sourceAssistant");
  return t("education.sourceUser");
}

function eventStateLabel(state) {
  if (state === "pending") return t("education.eventPending");
  if (state === "running") return t("education.eventRunning");
  if (state === "done") return t("education.eventDone");
  return t("education.eventState", { state: strOr(state) });
}

function eventStateTone(state) {
  if (state === "done") return "leaf";
  if (state === "running") return "brand";
  return "sun";
}

function gradeScore(grade) {
  let total = 0;
  for (const award of asArray(grade && grade.awards)) {
    total += numOr(award && award.awarded, 0);
  }
  return total;
}

function assessmentTotal(assessment) {
  let total = 0;
  for (const question of asArray(assessment && assessment.questions)) {
    for (const point of asArray(question && question.scoring)) {
      total += numOr(point && point.points, 0);
    }
  }
  return total;
}

function pendingCorrections(grade, index) {
  if (grade === null || grade === undefined) return [];
  return asArray(grade.errors).filter(
    (error) => error && !index.accepted.has(`${grade.id}|${error.questionId}`),
  );
}

/** `YYYY-MM-DD` → UTC 毫秒（只用于天数差，避免夏令时抖动）。 */
function dateValue(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(strOr(key));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day);
}

function daysFromTo(fromKey, toKey) {
  const from = dateValue(fromKey);
  const to = dateValue(toKey);
  if (from === null || to === null) return null;
  return Math.round((to - from) / 86400000);
}

function semesterWeeks(semester, today) {
  const span = daysFromTo(semester.startDate, semester.endDate);
  const total = Math.max(1, Math.ceil(numOr(span, 0) / 7));
  const elapsed = numOr(daysFromTo(semester.startDate, today), 0);
  const done = Math.max(0, Math.min(total, Math.floor(elapsed / 7)));
  return { total, done };
}

// ---------------------------------------------------------------- 小组件

const ROW = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 0",
  borderBottom: "1px solid var(--tomato-line)",
};

const META = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
  marginTop: 3,
  fontSize: 11,
  color: "var(--tomato-ink-3)",
};

/** 任务行标题区做成按钮：教学任务点开工作台，普通任务点开编辑。 */
const ROW_BUTTON = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 0,
  flex: 1,
  minWidth: 0,
  padding: 0,
  margin: 0,
  border: "none",
  background: "transparent",
  fontFamily: "inherit",
  textAlign: "left",
  color: "inherit",
  cursor: "pointer",
};

function mutedText(text) {
  return h(
    "div",
    {
      style: {
        fontSize: 12,
        color: "var(--tomato-ink-3)",
        lineHeight: 1.6,
        padding: "6px 0",
      },
    },
    text,
  );
}

function subHeading(text, count) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "12px 0 2px",
      },
    },
    h(
      "div",
      {
        style: { fontSize: 12, fontWeight: 600, color: "var(--tomato-ink-2)" },
      },
      text,
    ),
    count ? h(Badge, { tone: "neutral" }, String(count)) : null,
  );
}

function InfoPill({ label, value }) {
  return h(
    "div",
    { style: { minWidth: 0 } },
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
        style: {
          fontSize: 13,
          fontWeight: 550,
          color: "var(--tomato-ink)",
          wordBreak: "break-word",
        },
      },
      value,
    ),
  );
}

function Countdown({ examDate, today }) {
  const days = daysFromTo(today, examDate);
  if (days === null) {
    return h(
      "div",
      { style: { fontSize: 13, color: "var(--tomato-ink-3)", paddingTop: 4 } },
      t("education.countdownNone"),
    );
  }
  if (days === 0) {
    return h(
      "div",
      {
        style: {
          fontSize: 22,
          fontWeight: 620,
          color: "var(--tomato-brand-deep)",
          paddingTop: 2,
        },
      },
      t("education.countdownToday"),
    );
  }
  if (days > 0) {
    return h(
      "div",
      { style: { display: "flex", alignItems: "baseline", gap: 6 } },
      h(
        "span",
        {
          className: "t-mono",
          style: {
            fontSize: 34,
            fontWeight: 620,
            lineHeight: 1,
            color: "var(--tomato-brand-deep)",
          },
        },
        String(days),
      ),
      h(
        "span",
        { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
        t("education.daysUnit"),
      ),
    );
  }
  return h(
    "div",
    {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--tomato-ink-3)",
        paddingTop: 6,
      },
    },
    t("education.daysPast", { n: Math.abs(days) }),
  );
}

function ProgressRow({ record, onConfirm }) {
  const topic = strOr(record.topic, t("education.unnamedTopic"));
  const position = strOr(record.position);
  return h(
    "div",
    { style: ROW },
    h(
      Chip,
      { tone: progressStateTone(record.state) },
      progressStateLabel(record.state),
    ),
    h(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      h(
        "div",
        {
          style: {
            fontSize: 13,
            color: "var(--tomato-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        },
        topic,
      ),
      h(
        "div",
        { style: META },
        position
          ? h("span", { style: { color: "var(--tomato-ink-2)" } }, position)
          : null,
        h("span", null, fmtDateTime(record.recordedAt)),
        h("span", null, progressSourceLabel(record.source)),
        record.confirmed === true
          ? h(Badge, { tone: "leaf" }, t("education.confirmed"))
          : null,
      ),
    ),
    record.confirmed === true
      ? null
      : h(
          Btn,
          {
            variant: "ghost",
            size: "sm",
            icon: "check",
            onClick: () => onConfirm(record.id),
          },
          t("education.confirm"),
        ),
  );
}

function TeachingTaskRow({
  task,
  data,
  onToggle,
  onFocus,
  target = null,
  onOpen,
}) {
  const project = projectById(data, task.projectId);
  const projectName = project ? strOr(project.name) : "";
  const teaching = target !== null;
  const meta = [];
  if (strOr(task.reminderTime)) {
    meta.push(t("education.reminderLabel", { time: task.reminderTime }));
  }
  if (
    Number.isFinite(Number(task.focusMinutes)) &&
    Number(task.focusMinutes) > 0
  ) {
    meta.push(
      t("education.focusMinutesLabel", { n: Number(task.focusMinutes) }),
    );
  }
  if (Number.isFinite(Number(task.estimate)) && Number(task.estimate) > 0) {
    meta.push(t("education.estimateLabel", { n: Number(task.estimate) }));
  }
  if (projectName) meta.push(projectName);
  const titleBlock = [
    h(
      "div",
      {
        key: "title",
        style: {
          fontSize: 13.5,
          color: task.completed ? "var(--tomato-ink-3)" : "var(--tomato-ink)",
          textDecoration: task.completed ? "line-through" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      strOr(task.title),
    ),
    h(
      "div",
      { key: "meta", style: META },
      h(
        Chip,
        { tone: "neutral" },
        task.kind === "lesson"
          ? t("education.lessonKind")
          : t("education.homeworkKind"),
      ),
      meta.map((text, index) => h("span", { key: index }, text)),
    ),
  ];
  return h(
    "div",
    { style: ROW },
    teaching
      ? null
      : h(Check, {
          checked: task.completed === true,
          onChange: () => onToggle(task.id),
          label: strOr(task.title),
        }),
    h(Dot, { color: projectColor(data, task.projectId) }),
    teaching
      ? h(
          "button",
          {
            type: "button",
            title: t("education.openWorkbench"),
            onClick: () => onOpen?.(target),
            style: ROW_BUTTON,
          },
          titleBlock,
        )
      : h("div", { style: { flex: 1, minWidth: 0 } }, titleBlock),
    task.completed
      ? null
      : h(
          Btn,
          {
            variant: "soft",
            size: "sm",
            icon: "play",
            onClick: () => onFocus(task.id),
          },
          t("education.startFocus"),
        ),
  );
}

function AssessmentRow({ assessment, index, at, onAssistant, onOpen }) {
  const status = assessmentStatus(assessment, index, at);
  const submission = index.submissionOf.get(assessment.id) || null;
  const grade = submission ? index.gradeOf.get(submission.id) || null : null;
  const total = assessmentTotal(assessment);
  const score = grade !== null ? gradeScore(grade) : null;
  const action =
    status === "submitted"
      ? "grade"
      : status === "correctionDue"
        ? "correct"
        : status === "needsReview"
          ? "review"
          : ["awaitingSubmission", "overdue", "missed"].includes(status)
            ? "submit"
            : null;
  const actionKey = {
    submit: "submitAction",
    grade: "gradeAction",
    correct: "correctAction",
    review: "reviewAction",
  };
  const titleBlock = [
    h(
      "div",
      {
        key: "title",
        style: {
          fontSize: 13,
          color: "var(--tomato-ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      strOr(assessment.title, t("education.unnamedProject")),
    ),
    h(
      "div",
      { key: "meta", style: META },
      h(Chip, { tone: "neutral" }, assessmentKindLabel(assessment.kind)),
      h("span", null, fmtRange(assessment.startsAt, assessment.endsAt)),
      h(
        "span",
        null,
        t("education.topicsCount", {
          n: asArray(assessment.questions).length,
        }),
      ),
    ),
  ];
  return h(
    "div",
    { style: ROW },
    h(
      "button",
      {
        type: "button",
        title: t("education.openWorkbench"),
        onClick: () => onOpen?.(assessment),
        style: ROW_BUTTON,
      },
      titleBlock,
    ),
    score !== null
      ? h(
          "span",
          {
            className: "t-mono",
            style: { fontSize: 12, color: "var(--tomato-ink-2)" },
          },
          total > 0 ? `${score} / ${total}` : String(score),
        )
      : null,
    h(Chip, { tone: statusTone(status) }, statusLabel(status)),
    action && onAssistant
      ? h(
          Btn,
          {
            variant: "ghost",
            size: "sm",
            onClick: () =>
              onAssistant(action, {
                projectId: assessment.projectId,
                assessmentId: assessment.id,
                submissionId: submission?.id,
                gradeId: grade?.id,
              }),
          },
          t(`education.${actionKey[action]}`),
        )
      : null,
  );
}

function ProjectTaskRow({ task, onToggle, target = null, onOpen }) {
  const teaching = target !== null;
  const titleBlock = [
    h(
      "div",
      {
        key: "title",
        style: {
          fontSize: 13,
          color: task.completed ? "var(--tomato-ink-3)" : "var(--tomato-ink)",
          textDecoration: task.completed ? "line-through" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      strOr(task.title),
    ),
    h(
      "div",
      { key: "meta", style: META },
      task.dueDate ? h("span", null, String(task.dueDate)) : null,
      strOr(task.reminderTime)
        ? h(
            "span",
            null,
            t("education.reminderLabel", { time: task.reminderTime }),
          )
        : null,
      Number.isFinite(Number(task.focusMinutes)) &&
        Number(task.focusMinutes) > 0
        ? h(
            "span",
            null,
            t("education.focusMinutesLabel", {
              n: Number(task.focusMinutes),
            }),
          )
        : null,
    ),
  ];
  return h(
    "div",
    { style: ROW },
    teaching
      ? null
      : h(Check, {
          checked: task.completed === true,
          onChange: () => onToggle(task.id),
          label: strOr(task.title),
        }),
    teaching
      ? h(
          "button",
          {
            type: "button",
            title: t("education.openWorkbench"),
            onClick: () => onOpen?.(target),
            style: ROW_BUTTON,
          },
          titleBlock,
        )
      : h("div", { style: { flex: 1, minWidth: 0 } }, titleBlock),
  );
}

// ---------------------------------------------------------------- 共享资料库

// 「一次授权，所有学习项目共用」的入口。授权只走 runtime 的
// /api/library/*（用户点击），不经过 MCP 或 dispatch Action：目录授权
// 只能由用户设置这条不变量在 UI 侧也照旧成立。
function LibraryCard({ library, projectIds, onChange, onReload }) {
  const [dialog, setDialog] = useState(null);
  const [directory, setDirectory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState("");
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [scanning, setScanning] = useState(false);

  const loading = library === null || library === undefined;
  const authorized =
    library !== null && library !== undefined && library.authorized === true;
  const unavailable =
    library !== null && library !== undefined && library.unavailable === true;
  const path = strOr(library?.directory);

  // 索引状态与授权状态一起刷新；授权成功后自动扫描在后台跑，没有索引时
  // 每 2.5 秒补一次状态，扫完就停。授权本身不等待扫描。
  useEffect(() => {
    if (!authorized) {
      setStats(null);
      setStatsError("");
      return undefined;
    }
    let cancelled = false;
    let timer = null;
    const load = () => {
      getLibraryStats({ timeoutMs: 8000 })
        .then((next) => {
          if (cancelled) return;
          setStats(next);
          setStatsError("");
          if (next && next.hasIndex === true && timer !== null) {
            clearInterval(timer);
            timer = null;
          }
        })
        .catch((e) => {
          if (!cancelled)
            setStatsError(e && e.userMessage ? e.userMessage : String(e));
        });
    };
    load();
    timer = setInterval(load, 2500);
    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
    };
  }, [authorized, path]);

  const openAuthorize = () => {
    setDirectory(path || "");
    setError("");
    setDialog("authorize");
  };
  const openRevoke = () => {
    setError("");
    setDialog("revoke");
  };
  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setError("");
  };

  const submit = async () => {
    const value = directory.trim();
    if (!value) {
      setError(t("education.libraryPathRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await authorizeLibrary(value);
      onChange(next);
      setDialog(null);
      setStats(null);
      setStatsError("");
      notify(t("education.librarySaved"), "brand");
    } catch (e) {
      setError(e && e.userMessage ? e.userMessage : String(e));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await revokeLibraryGrant();
      onChange(next);
      setDialog(null);
      notify(t("education.libraryRevoked"), "neutral");
    } catch (e) {
      setError(e && e.userMessage ? e.userMessage : String(e));
    } finally {
      setBusy(false);
    }
  };

  // 「扫描」只建索引：文件清单来自目录本身，不碰 education.resources。
  const scanIndex = async () => {
    setBusy(true);
    setScanning(true);
    try {
      const result = await scanLibrary();
      setStats({ ...result, authorized: true, hasIndex: true });
      notify(
        t("education.libraryIndexScanDone", {
          n: result.count,
          ms: result.durationMs,
        }),
        "brand",
      );
    } catch (e) {
      notify(e && e.userMessage ? e.userMessage : String(e), "danger");
    } finally {
      setBusy(false);
      setScanning(false);
    }
  };

  // 「检查已登记」保留原来的逐项目核查：它看的是已登记资源，不是目录索引。
  const checkRegistered = async () => {
    if (projectIds.length === 0) {
      notify(t("education.libraryScanNone"), "neutral");
      return;
    }
    setBusy(true);
    setCheck(t("education.libraryScanning"));
    try {
      const results = await Promise.all(
        projectIds.map((id) => scanProjectLibrary(id)),
      );
      const items = results.flatMap((result) =>
        result && Array.isArray(result.resources) ? result.resources : [],
      );
      const count = (state) =>
        items.filter((item) => item.state === state).length;
      const available = count("available");
      const missing = count("missing");
      setCheck(
        t("education.libraryIndexCheckDone", {
          n: items.length,
          a: available,
          m: missing,
          u: items.length - available - missing,
        }),
      );
    } catch (e) {
      setCheck("");
      notify(e && e.userMessage ? e.userMessage : String(e), "danger");
    } finally {
      setBusy(false);
    }
  };

  const statusChip = loading
    ? h(Chip, { tone: "neutral" }, t("education.libraryLoading"))
    : authorized
      ? h(Chip, { tone: "brand" }, t("education.libraryAuthorized"))
      : h(Chip, { tone: "neutral" }, t("education.libraryUnauthorized"));

  const pathBox = h(
    "div",
    {
      className: "t-mono",
      style: {
        fontSize: 12,
        lineHeight: 1.6,
        color: "var(--tomato-ink-2)",
        background: "var(--tomato-surface-2)",
        borderRadius: 9,
        padding: "9px 11px",
        wordBreak: "break-all",
      },
    },
    loading
      ? t("education.libraryLoading")
      : path ||
          (unavailable
            ? t("education.libraryUnavailable")
            : t("education.directoryEmpty")),
  );

  const statsBlock = (() => {
    if (loading || !authorized) return null;
    if (statsError)
      return h(
        "div",
        { style: { fontSize: 11.5, color: "#b8503f", marginTop: 9 } },
        statsError,
      );
    if (stats === null)
      return h(
        "div",
        {
          style: {
            fontSize: 11.5,
            color: "var(--tomato-ink-3)",
            marginTop: 9,
          },
        },
        t("education.libraryIndexLoading"),
      );
    if (stats.hasIndex !== true)
      return h(
        "div",
        { style: { marginTop: 9 } },
        h(
          "div",
          { style: { fontSize: 12, color: "var(--tomato-ink-2)" } },
          stats.stale
            ? t("education.libraryIndexStale")
            : t("education.libraryIndexNever"),
        ),
        h(
          "div",
          {
            style: {
              fontSize: 11.5,
              color: "var(--tomato-ink-3)",
              lineHeight: 1.55,
              marginTop: 4,
            },
          },
          t("education.libraryIndexHint"),
        ),
      );
    const kindChips = INDEX_KINDS.filter(
      (kind) => numOr(stats.byKind?.[kind], 0) > 0,
    ).map((kind) =>
      h(
        Chip,
        { key: kind, tone: "neutral" },
        `${indexKindLabel(kind)} ${stats.byKind[kind]}`,
      ),
    );
    const topChips = Object.entries(stats.byTop ?? {})
      .slice(0, 8)
      .map(([top, count]) =>
        h(
          Chip,
          { key: top, tone: "neutral", icon: "folder" },
          `${top === "." ? t("education.libraryIndexRootDir") : top} ${count}`,
        ),
      );
    return h(
      "div",
      { style: { marginTop: 9 } },
      h(
        "div",
        { style: { fontSize: 12, color: "var(--tomato-ink-2)" } },
        t("education.libraryIndexScanned", {
          n: stats.count,
          time: fmtDateTime(stats.scannedAt),
        }),
      ),
      h(
        "div",
        {
          style: {
            fontSize: 11.5,
            color: "var(--tomato-ink-3)",
            lineHeight: 1.55,
            marginTop: 4,
          },
        },
        t("education.libraryIndexHint"),
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 7,
          },
        },
        h(
          "span",
          { style: { fontSize: 11, color: "var(--tomato-ink-3)" } },
          t("education.libraryIndexByKind"),
        ),
        ...kindChips,
      ),
      topChips.length > 0
        ? h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                marginTop: 6,
              },
            },
            h(
              "span",
              { style: { fontSize: 11, color: "var(--tomato-ink-3)" } },
              t("education.libraryIndexByTop"),
            ),
            ...topChips,
          )
        : null,
    );
  })();

  const card = h(
    Card,
    { pad: 20 },
    h(SectionTitle, {
      icon: "folder",
      title: t("education.libraryTitle"),
      hint: authorized
        ? t("education.libraryProjects", { n: library.projects ?? 0 })
        : null,
      action: statusChip,
    }),
    pathBox,
    h(
      "div",
      {
        style: {
          fontSize: 12,
          color: "var(--tomato-ink-3)",
          lineHeight: 1.6,
          marginTop: 9,
        },
      },
      authorized
        ? t("education.librarySharedHint")
        : t("education.libraryMissingHint"),
    ),
    statsBlock,
    unavailable
      ? h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 9,
            },
          },
          h(
            "span",
            { style: { fontSize: 12, color: "#b8503f" } },
            strOr(library.reason) || t("education.libraryUnavailable"),
          ),
          onReload
            ? h(
                Btn,
                {
                  variant: "ghost",
                  size: "sm",
                  icon: "refresh",
                  onClick: onReload,
                },
                t("education.libraryRetry"),
              )
            : null,
        )
      : null,
    h(
      "div",
      { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 } },
      loading
        ? null
        : authorized
          ? [
              h(
                Btn,
                {
                  key: "change",
                  variant: "soft",
                  size: "sm",
                  icon: "folder",
                  onClick: openAuthorize,
                },
                t("education.libraryChange"),
              ),
              h(
                Btn,
                {
                  key: "scan",
                  variant: "soft",
                  size: "sm",
                  icon: "refresh",
                  onClick: scanIndex,
                  disabled: busy || scanning,
                },
                scanning
                  ? t("education.libraryIndexScanning")
                  : t("education.libraryIndexScan"),
              ),
              h(
                Btn,
                {
                  key: "check",
                  variant: "ghost",
                  size: "sm",
                  icon: "eye",
                  onClick: checkRegistered,
                  disabled: busy,
                },
                t("education.libraryIndexCheck"),
              ),
              h(
                Btn,
                {
                  key: "revoke",
                  variant: "ghost",
                  size: "sm",
                  icon: "trash",
                  onClick: openRevoke,
                },
                t("education.libraryRevoke"),
              ),
            ]
          : h(
              Btn,
              {
                variant: "primary",
                size: "sm",
                icon: "folder",
                onClick: openAuthorize,
              },
              t("education.libraryAuthorize"),
            ),
    ),
    check
      ? h(
          "div",
          {
            style: {
              fontSize: 11.5,
              color: "var(--tomato-ink-3)",
              marginTop: 9,
            },
          },
          check,
        )
      : null,
  );

  const errorLine = error
    ? h(
        "div",
        {
          style: {
            fontSize: 12,
            color: "#b8503f",
            lineHeight: 1.55,
            marginTop: 10,
          },
        },
        error,
      )
    : null;

  const authorizeDialog = h(
    Modal,
    {
      open: dialog === "authorize",
      onClose: closeDialog,
      title: t("education.libraryDialogTitle"),
      subtitle: t("education.libraryDialogSubtitle"),
      icon: "folder",
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          { variant: "ghost", onClick: closeDialog, disabled: busy },
          t("common.cancel"),
        ),
        h(
          Btn,
          { variant: "primary", onClick: submit, disabled: busy },
          busy ? t("education.librarySaving") : t("education.libraryAuthorize"),
        ),
      ),
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      h(
        Field,
        {
          label: t("education.libraryDialogLabel"),
          hint: t("education.libraryDialogHint"),
        },
        h(Input, {
          value: directory,
          onChange: (value) => {
            setDirectory(value);
            setError("");
          },
          placeholder: t("education.libraryDialogPlaceholder"),
          mono: true,
          autoFocus: true,
          onKeyDown: (e) => {
            if (e.key === "Enter") void submit();
          },
        }),
      ),
      errorLine,
    ),
  );

  const revokeDialog = h(
    Modal,
    {
      open: dialog === "revoke",
      onClose: closeDialog,
      title: t("education.libraryRevokeTitle"),
      subtitle: t("education.libraryRevokeWarning"),
      icon: "trash",
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          { variant: "ghost", onClick: closeDialog, disabled: busy },
          t("common.cancel"),
        ),
        h(
          Btn,
          { variant: "danger", onClick: revoke, disabled: busy },
          busy ? t("education.libraryRevoking") : t("education.libraryRevoke"),
        ),
      ),
    },
    errorLine ? h("div", null, errorLine) : null,
  );

  return h(
    "div",
    { style: { marginBottom: 16 } },
    card,
    authorizeDialog,
    revokeDialog,
  );
}

// ---------------------------------------------------------------- 索引浏览

// 预览对话框：图片/PDF/文本/音视频直接用 runtime 的流式文件端点。
// 预览上限 20 MiB 由服务端判定；超过或类型未知时只给下载，不硬塞进内存。
function FilePreviewDialog({ item, onClose }) {
  const open = item !== null && item !== undefined;
  const path = strOr(item?.path);
  const [access, setAccess] = useState("");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setAccess("");
    setError("");
    getFileToken({ timeoutMs: 5000 })
      .then((next) => {
        if (!cancelled) setAccess(strOr(next?.access));
      })
      .catch((e) => {
        if (!cancelled)
          setError(e && e.userMessage ? e.userMessage : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, path, reloadKey]);

  if (!open) return null;

  const previewable = item.previewable === true;
  const viewUrl = access ? libraryFileUrl(path, access, false) : "";
  const downloadUrl = access ? libraryFileUrl(path, access, true) : "";
  let body = null;
  if (!previewable) {
    body = mutedText(t("education.libraryIndexUnpreviewable"));
  } else if (error !== "") {
    body = h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { fontSize: 12.5, color: "#b8503f" } }, error),
      h(
        Btn,
        {
          variant: "ghost",
          size: "sm",
          icon: "refresh",
          onClick: () => setReloadKey((value) => value + 1),
        },
        t("education.libraryRetry"),
      ),
    );
  } else if (access === "") {
    body = h(Skeleton, { w: "100%", h: 220 });
  } else if (item.kind === "image") {
    body = h("img", {
      src: viewUrl,
      alt: strOr(item.name),
      style: {
        display: "block",
        maxWidth: "100%",
        maxHeight: "66vh",
        margin: "0 auto",
        borderRadius: 8,
      },
    });
  } else if (item.kind === "audio") {
    body = h("audio", {
      controls: true,
      src: viewUrl,
      style: { width: "100%" },
    });
  } else if (item.kind === "video") {
    body = h("video", {
      controls: true,
      src: viewUrl,
      style: { display: "block", maxWidth: "100%", maxHeight: "66vh" },
    });
  } else {
    body = h("iframe", {
      title: strOr(item.name),
      src: viewUrl,
      style: {
        width: "100%",
        height: "66vh",
        border: "none",
        borderRadius: 8,
        background: "#fff",
      },
    });
  }

  return h(
    Modal,
    {
      open,
      onClose,
      title: strOr(item.name, t("education.libraryIndexFileTitle")),
      subtitle: t("education.libraryIndexFileMeta", {
        kind: indexKindLabel(item.kind),
        size: formatBytes(item.sizeBytes),
      }),
      icon: "eye",
      width: 920,
      bodyStyle: { paddingTop: 6 },
      footer: h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
          },
        },
        error !== ""
          ? h(
              Btn,
              {
                variant: "ghost",
                size: "sm",
                icon: "refresh",
                onClick: () => setReloadKey((value) => value + 1),
              },
              t("education.libraryRetry"),
            )
          : null,
        downloadUrl
          ? h(
              "a",
              {
                href: downloadUrl,
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--tomato-brand-deep)",
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: 9,
                  background: "var(--tomato-brand-soft)",
                },
              },
              t("education.libraryIndexDownload"),
            )
          : null,
        h(
          Btn,
          { variant: "ghost", size: "sm", onClick: onClose },
          t("common.close"),
        ),
      ),
    },
    body,
  );
}

// 登记仍是可选动作：索引负责浏览，只有教学记录真的要引用时才写一条
// education.resources（kind 由用户选，系统不按扩展名猜）。
function RegisterResourceDialog({ item, projectId, onClose }) {
  const open = item !== null && item !== undefined;
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("attachment");
  const [source, setSource] = useState("");
  const [edition, setEdition] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(strOr(item?.name));
    setKind("attachment");
    setSource("");
    setEdition("");
    setError("");
  }, [open, strOr(item?.path)]);

  if (!open) return null;

  const submit = async () => {
    if (title.trim() === "") {
      setError(t("education.libraryIndexRegisterRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await registerResource(projectId, {
        title: title.trim(),
        kind,
        path: item.path,
        source: source.trim(),
        edition: edition.trim(),
        topics: [],
      });
      await refresh();
      notify(t("education.libraryIndexRegistered"), "brand");
      onClose();
    } catch (e) {
      setError(e && e.userMessage ? e.userMessage : String(e));
    } finally {
      setBusy(false);
    }
  };

  return h(
    Modal,
    {
      open,
      onClose: busy ? undefined : onClose,
      title: t("education.libraryIndexRegisterTitle"),
      subtitle: t("education.libraryIndexRegisterSubtitle"),
      icon: "tag",
      footer: h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: 8 } },
        h(
          Btn,
          { variant: "ghost", onClick: onClose, disabled: busy },
          t("common.cancel"),
        ),
        h(
          Btn,
          { variant: "primary", onClick: submit, disabled: busy },
          t("education.libraryIndexRegisterSubmit"),
        ),
      ),
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      h(
        Field,
        { label: t("education.libraryIndexTitleLabel") },
        h(Input, {
          value: title,
          onChange: (value) => {
            setTitle(value);
            setError("");
          },
          autoFocus: true,
        }),
      ),
      h(
        Field,
        { label: t("education.libraryIndexKindLabel") },
        h(Select, {
          value: kind,
          options: RESOURCE_KINDS.map((value) => ({
            value,
            label: resourceKindLabel(value),
          })),
          onChange: setKind,
        }),
      ),
      h(
        Field,
        { label: t("education.libraryIndexSourceLabel") },
        h(Input, { value: source, onChange: setSource }),
      ),
      h(
        Field,
        { label: t("education.libraryIndexEditionLabel") },
        h(Input, { value: edition, onChange: setEdition }),
      ),
      h(
        "div",
        {
          className: "t-mono",
          style: {
            fontSize: 11,
            color: "var(--tomato-ink-3)",
            background: "var(--tomato-surface-2)",
            borderRadius: 8,
            padding: "7px 9px",
            wordBreak: "break-all",
          },
        },
        strOr(item.path),
      ),
      error
        ? h("div", { style: { fontSize: 12, color: "#b8503f" } }, error)
        : null,
    ),
  );
}

// 项目详情里的资料目录浏览器：分页 + 关键词 + 类型筛选，点击预览。
function LibraryBrowser({ projectId }) {
  const limit = 40;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [registerItem, setRegisterItem] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getLibraryItems({ projectId, q, kind, offset, limit }, { timeoutMs: 15000 })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e && e.userMessage ? e.userMessage : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, q, kind, offset, reloadKey]);

  const scanIndex = async () => {
    setScanning(true);
    setError("");
    try {
      const result = await scanLibrary();
      notify(
        t("education.libraryIndexScanDone", {
          n: result.count,
          ms: result.durationMs,
        }),
        "brand",
      );
      setOffset(0);
      setReloadKey((value) => value + 1);
    } catch (e) {
      setError(e && e.userMessage ? e.userMessage : String(e));
    } finally {
      setScanning(false);
    }
  };

  if (loading && data === null)
    return h(
      "div",
      {
        style: {
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--tomato-line)",
          fontSize: 12,
          color: "var(--tomato-ink-3)",
        },
      },
      t("education.libraryIndexLoading"),
    );

  if (data !== null && data.hasIndex !== true) {
    return h(
      "div",
      {
        style: {
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--tomato-line)",
        },
      },
      mutedText(t("education.libraryIndexNone")),
      h(
        Btn,
        {
          variant: "soft",
          size: "sm",
          icon: "refresh",
          onClick: scanIndex,
          disabled: scanning,
          style: { marginTop: 8 },
        },
        scanning
          ? t("education.libraryIndexScanning")
          : t("education.libraryIndexGenerate"),
      ),
      error
        ? h(
            "div",
            { style: { fontSize: 12, color: "#b8503f", marginTop: 8 } },
            error,
          )
        : null,
    );
  }

  const items = asArray(data?.items);
  const total = numOr(data?.total, 0);
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;
  const matchedDirs = asArray(data?.matchedDirs);
  const filterHint = data
    ? data.filtered === true
      ? t("education.libraryIndexFiltered", {
          dirs: matchedDirs.join("、"),
        })
      : t("education.libraryIndexNoFilter")
    : "";

  const searchRow = h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 10,
      },
    },
    h(Input, {
      value: qInput,
      onChange: setQInput,
      placeholder: t("education.libraryIndexSearchPlaceholder"),
      style: { flex: 1, minWidth: 180 },
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          setQ(qInput.trim());
          setOffset(0);
        }
      },
    }),
    h(
      Btn,
      {
        variant: "soft",
        size: "sm",
        icon: "search",
        onClick: () => {
          setQ(qInput.trim());
          setOffset(0);
        },
      },
      t("common.search"),
    ),
    h(Select, {
      value: kind,
      options: [
        { value: "", label: t("education.libraryIndexAll") },
        ...INDEX_KINDS.map((value) => ({
          value,
          label: indexKindLabel(value),
        })),
      ],
      onChange: (value) => {
        setKind(value);
        setOffset(0);
      },
      width: 130,
    }),
    h(
      Btn,
      {
        variant: "ghost",
        size: "sm",
        icon: "refresh",
        onClick: scanIndex,
        disabled: scanning,
      },
      scanning
        ? t("education.libraryIndexScanning")
        : t("education.libraryIndexScan"),
    ),
  );

  return h(
    "div",
    {
      style: {
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid var(--tomato-line)",
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
        "div",
        { style: { fontSize: 12.5, fontWeight: 600 } },
        t("education.libraryIndexTotal", { n: total }),
      ),
      filterHint
        ? h(
            "span",
            { style: { fontSize: 11, color: "var(--tomato-ink-3)" } },
            filterHint,
          )
        : null,
    ),
    searchRow,
    error
      ? h(
          "div",
          { style: { fontSize: 12, color: "#b8503f", marginTop: 8 } },
          error,
        )
      : null,
    items.length === 0
      ? h(
          "div",
          { style: { marginTop: 10 } },
          mutedText(t("education.libraryIndexEmpty")),
        )
      : h(
          "div",
          {
            className: "t-scroll",
            style: {
              maxHeight: 380,
              overflowY: "auto",
              marginTop: 6,
              paddingRight: 4,
            },
          },
          items.map((item) =>
            h(
              "div",
              { key: strOr(item.path), style: ROW },
              h(
                "div",
                { style: { flex: 1, minWidth: 0 } },
                h(
                  "div",
                  {
                    style: {
                      fontSize: 13,
                      color: "var(--tomato-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  },
                  strOr(item.name),
                ),
                h(
                  "div",
                  { style: { ...META, overflow: "hidden" } },
                  h(Chip, { tone: "neutral" }, indexKindLabel(item.kind)),
                  h("span", null, formatBytes(item.sizeBytes)),
                  h(
                    "span",
                    {
                      style: {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    },
                    strOr(item.path),
                  ),
                ),
              ),
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flex: "none",
                  },
                },
                h(
                  Btn,
                  {
                    variant: "ghost",
                    size: "sm",
                    icon: "eye",
                    onClick: () => setPreview(item),
                  },
                  t("education.libraryIndexPreview"),
                ),
                h(
                  Btn,
                  {
                    variant: "ghost",
                    size: "sm",
                    icon: "tag",
                    onClick: () => setRegisterItem(item),
                  },
                  t("education.libraryIndexRegister"),
                ),
              ),
            ),
          ),
        ),
    total > limit
      ? h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 8,
            },
          },
          h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "chevronLeft",
              onClick: () => setOffset(Math.max(0, offset - limit)),
              disabled: offset === 0,
            },
            t("education.libraryIndexPrev"),
          ),
          h(
            "span",
            { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
            t("education.libraryIndexPage", { page, pages }),
          ),
          h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              iconRight: "chevronRight",
              onClick: () => setOffset(offset + limit),
              disabled: offset + limit >= total,
            },
            t("education.libraryIndexNext"),
          ),
        )
      : null,
    h(FilePreviewDialog, {
      item: preview,
      onClose: () => setPreview(null),
    }),
    h(RegisterResourceDialog, {
      item: registerItem,
      projectId,
      onClose: () => setRegisterItem(null),
    }),
  );
}

// ---------------------------------------------------------------- 项目详情

export function ProjectDetail({
  data,
  edu,
  study,
  project,
  today,
  at,
  index,
  library,
  onBack,
  onAssistant,
  onOpenAssignment,
}) {
  const projectId = strOr(study.projectId);
  const color = projectColor(data, projectId);
  const name =
    project && strOr(project.name)
      ? project.name
      : t("education.unnamedProject");
  const sharedLibrary =
    library && library.authorized === true ? strOr(library.directory) : "";
  const projectDirectory = strOr(study.directory);
  const sharedIds =
    library && Array.isArray(library.sharedProjects)
      ? library.sharedProjects
      : null;
  const usesSharedLibrary =
    sharedLibrary !== "" &&
    (sharedIds !== null
      ? sharedIds.includes(projectId)
      : projectDirectory === "" || projectDirectory === sharedLibrary);
  const settings =
    data.settings && typeof data.settings === "object" ? data.settings : {};
  const protection =
    settings.protection && typeof settings.protection === "object"
      ? settings.protection
      : {};

  const resources = edu.resources.filter(
    (item) => item.projectId === projectId,
  );
  const sortedResources = resources.slice().sort((a, b) => {
    const ai = RESOURCE_KINDS.indexOf(a.kind);
    const bi = RESOURCE_KINDS.indexOf(b.kind);
    return (
      (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) ||
      strOr(a.title).localeCompare(strOr(b.title))
    );
  });
  const progress = sortDesc(
    edu.progress.filter((item) => item.projectId === projectId),
    "recordedAt",
  );
  const completedTasks = sortDesc(
    edu.completedTasks.filter((item) => item.projectId === projectId),
    "completedAt",
  ).slice(0, 5);
  const semesters = edu.semesters.filter(
    (item) => item.projectId === projectId,
  );
  const assessments = sortAsc(
    edu.assessments.filter((item) => item.projectId === projectId),
    "startsAt",
  );
  const reviews = edu.reviews
    .filter((item) => item.projectId === projectId)
    .slice()
    .sort((a, b) => strOr(b.date).localeCompare(strOr(a.date)));
  const events = sortDesc(
    edu.events.filter((item) => item.projectId === projectId),
    "createdAt",
  );
  const lessons = edu.lessons.filter((item) => item.projectId === projectId);
  const attendedLessons = lessons.filter(
    (item) => item.attended === true || item.state === "ended",
  ).length;
  const projectTasks = asArray(data.tasks).filter(
    (task) => task.projectId === projectId,
  );
  const openTasks = projectTasks
    .filter((task) => task.completed !== true)
    .sort((a, b) => strOr(a.dueDate).localeCompare(strOr(b.dueDate)));
  const doneTasks = sortDesc(
    projectTasks.filter((task) => task.completed === true),
    "completedAt",
  );
  const visions = asArray(data.visions).filter(
    (vision) =>
      vision &&
      (vision.projectId === projectId ||
        (study.visionId !== null &&
          study.visionId !== undefined &&
          vision.id === study.visionId)),
  );
  const projectWhitelist =
    project && Array.isArray(project.appWhitelist)
      ? project.appWhitelist
      : null;
  const genericWhitelist = asArray(protection.whitelist);

  const onConfirm = async (id) => {
    const result = await tryDispatch({
      type: "education",
      command: { op: "confirmProgress", id },
    });
    if (!result.ok) notify(result.error, "danger");
  };

  const onRetry = async (id) => {
    const result = await tryDispatch({
      type: "education",
      command: { op: "retryEvent", id },
    });
    if (!result.ok) notify(result.error, "danger");
  };

  const onToggle = async (id) => {
    const result = await tryDispatch({ type: "toggleTask", id });
    if (!result.ok) notify(result.error, "danger");
  };

  const kindCounts = {};
  for (const resource of resources) {
    const kind = strOr(resource.kind, "other");
    kindCounts[kind] = (kindCounts[kind] || 0) + 1;
  }
  const resourceKindCount = RESOURCE_KINDS.filter(
    (kind) => kindCounts[kind],
  ).length;

  const headerCard = h(
    Card,
    { pad: 22 },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 18,
          flexWrap: "wrap",
        },
      },
      h(
        "div",
        { style: { flex: 1, minWidth: 240 } },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 12,
              flexWrap: "wrap",
            },
          },
          h(Dot, { color, size: 10 }),
          h(
            "div",
            {
              style: {
                fontSize: 22,
                fontWeight: 650,
                color: "var(--tomato-ink)",
                lineHeight: 1.25,
              },
            },
            name,
          ),
          study.examMode === true
            ? h(Chip, { tone: "brand" }, t("education.examMode"))
            : null,
        ),
        h(
          "div",
          { style: { display: "flex", gap: 22, flexWrap: "wrap" } },
          study.target
            ? h(InfoPill, {
                label: t("education.targetLabel"),
                value: study.target,
              })
            : null,
          study.examDate
            ? h(InfoPill, {
                label: t("education.examDateLabel"),
                value: study.examDate,
              })
            : null,
        ),
      ),
      h(
        "div",
        { style: { textAlign: "right", minWidth: 120 } },
        h(
          "div",
          {
            style: {
              fontSize: 11,
              color: "var(--tomato-ink-3)",
              marginBottom: 5,
            },
          },
          t("education.countdownLabel"),
        ),
        h(Countdown, { examDate: study.examDate, today }),
      ),
    ),
  );

  const statsRow = h(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14,
        marginBottom: 16,
      },
    },
    h(Stat, {
      icon: "folder",
      label: t("education.statResources"),
      value: resources.length,
      tone: "brand",
      style: { minWidth: 0 },
    }),
    h(Stat, {
      icon: "education",
      label: t("education.statLessons"),
      value: attendedLessons,
      tone: "leaf",
      style: { minWidth: 0 },
    }),
    h(Stat, {
      icon: "tasks",
      label: t("education.statAssessments"),
      value: assessments.length,
      tone: "sun",
      style: { minWidth: 0 },
    }),
    h(Stat, {
      icon: "stats",
      label: t("education.statProgress"),
      value: progress.length,
      tone: "plum",
      style: { minWidth: 0 },
    }),
  );

  const directoryCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "folder", title: t("education.directory") }),
    h(
      "div",
      {
        className: "t-mono",
        style: {
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--tomato-ink-2)",
          background: "var(--tomato-surface-2)",
          borderRadius: 9,
          padding: "9px 11px",
          wordBreak: "break-all",
        },
      },
      usesSharedLibrary
        ? `${t("education.directorySharedLabel")} · ${sharedLibrary}`
        : projectDirectory || t("education.directoryEmpty"),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 12,
        },
      },
      study.examMode === true
        ? h(Chip, { tone: "brand" }, t("education.examMode"))
        : null,
      usesSharedLibrary
        ? h(
            Chip,
            { tone: "neutral", icon: "folder" },
            t("education.directorySharedLabel"),
          )
        : null,
      study.syllabusId
        ? h(
            Chip,
            { tone: "neutral", icon: "tag" },
            `${t("education.syllabusLabel")} ${study.syllabusId}`,
          )
        : null,
      h(
        Chip,
        { tone: "neutral" },
        t("education.pastPapersCount", {
          n: asArray(study.pastPaperIds).length,
        }),
      ),
      h(
        Chip,
        { tone: "neutral" },
        t("education.mockPapersCount", {
          n: asArray(study.mockPaperIds).length,
        }),
      ),
    ),
    usesSharedLibrary ? h(LibraryBrowser, { projectId }) : null,
  );

  const resourcesCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "folder",
      title: t("education.resourceList"),
      hint: t("education.resourcesCount", { n: resources.length }),
    }),
    resources.length === 0
      ? mutedText(t("education.resourceEmpty"))
      : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 0 } },
          subHeading(t("education.resourceGroups"), resourceKindCount),
          h(
            "div",
            {
              style: {
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 10,
              },
            },
            RESOURCE_KINDS.map((kind) =>
              kindCounts[kind]
                ? h(
                    Chip,
                    { key: kind, tone: "neutral" },
                    `${resourceKindLabel(kind)} ${kindCounts[kind]}`,
                  )
                : null,
            ),
          ),
          h(
            "div",
            {
              className: "t-scroll",
              style: { maxHeight: 360, overflowY: "auto", paddingRight: 4 },
            },
            sortedResources.map((resource, resourceIndex) =>
              h(
                "div",
                { key: resource.id || `resource-${resourceIndex}`, style: ROW },
                h(
                  "div",
                  { style: { flex: 1, minWidth: 0 } },
                  h(
                    "div",
                    {
                      style: {
                        fontSize: 13,
                        color: "var(--tomato-ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    },
                    strOr(resource.title),
                  ),
                  h(
                    "div",
                    { style: META },
                    h(
                      Chip,
                      { tone: "neutral" },
                      resourceKindLabel(resource.kind),
                    ),
                    strOr(resource.source)
                      ? h("span", null, strOr(resource.source))
                      : null,
                    strOr(resource.edition)
                      ? h("span", null, strOr(resource.edition))
                      : null,
                    h(
                      "span",
                      null,
                      t("education.topicsCount", {
                        n: asArray(resource.topics).length,
                      }),
                    ),
                  ),
                  asArray(resource.topics).length > 0
                    ? h(
                        "div",
                        {
                          style: {
                            fontSize: 11,
                            color: "var(--tomato-ink-3)",
                            marginTop: 3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        },
                        asArray(resource.topics).join(" · "),
                      )
                    : null,
                ),
              ),
            ),
          ),
        ),
  );

  const progressCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "stats",
      title: t("education.progressHistory"),
      hint: t("education.attentionHint", { n: progress.length }),
    }),
    progress.length === 0
      ? mutedText(t("education.noProgress"))
      : progress.slice(0, 10).map((record, recordIndex) =>
          h(ProgressRow, {
            key: record.id || `progress-${recordIndex}`,
            record,
            onConfirm,
          }),
        ),
  );

  const completedCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "check",
      title: t("education.completedTasksTitle"),
    }),
    completedTasks.length === 0
      ? mutedText(t("education.completedTasksEmpty"))
      : completedTasks.map((item, itemIndex) =>
          h(
            "div",
            { key: item.id || `completed-${itemIndex}`, style: ROW },
            h(
              "div",
              { style: { flex: 1, minWidth: 0 } },
              h(
                "div",
                {
                  style: {
                    fontSize: 13,
                    color: "var(--tomato-ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                },
                strOr(item.title, t("education.unnamedProject")),
              ),
              h(
                "div",
                { style: META },
                h("span", null, fmtDateTime(item.completedAt)),
                asArray(item.topics).length > 0
                  ? h(
                      "span",
                      null,
                      t("education.topicsCount", {
                        n: asArray(item.topics).length,
                      }),
                    )
                  : null,
              ),
              strOr(item.notes)
                ? h(
                    "div",
                    {
                      style: {
                        fontSize: 11.5,
                        color: "var(--tomato-ink-3)",
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    },
                    item.notes,
                  )
                : null,
            ),
          ),
        ),
  );

  const semesterCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "calendar", title: t("education.semesterTitle") }),
    semesters.length === 0
      ? mutedText(t("education.semesterEmpty"))
      : semesters.map((semester, semesterIndex) => {
          const weeks = semesterWeeks(semester, today);
          return h(
            "div",
            {
              key: semester.id || `semester-${semesterIndex}`,
              style: { padding: "8px 0 14px" },
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
                "div",
                {
                  style: {
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--tomato-ink)",
                    flex: 1,
                    minWidth: 0,
                  },
                },
                strOr(semester.title, t("education.unnamedProject")),
              ),
              h(
                Chip,
                { tone: "neutral" },
                t("education.revisionLabel", {
                  n: numOr(semester.revision, 1),
                }),
              ),
              h(
                "span",
                {
                  className: "t-mono",
                  style: { fontSize: 11, color: "var(--tomato-ink-3)" },
                },
                t("education.weeksProgress", { n: weeks.done, m: weeks.total }),
              ),
            ),
            h(
              "div",
              {
                style: {
                  fontSize: 11,
                  color: "var(--tomato-ink-3)",
                  marginTop: 3,
                },
              },
              `${strOr(semester.startDate)} – ${strOr(semester.endDate)}`,
            ),
            h(Bar, {
              value: weeks.done,
              max: weeks.total,
              height: 6,
              style: { marginTop: 8, marginBottom: 8 },
            }),
            asArray(semester.milestones).map((milestone, milestoneIndex) =>
              h(
                "div",
                {
                  key: milestoneIndex,
                  style: {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 9,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--tomato-line)",
                  },
                },
                h(
                  Chip,
                  { tone: "brand" },
                  t("education.weekLabel", { n: numOr(milestone.week, 0) }),
                ),
                h(
                  "div",
                  { style: { flex: 1, minWidth: 0 } },
                  h(
                    "div",
                    {
                      style: {
                        fontSize: 12.5,
                        color: "var(--tomato-ink-2)",
                        lineHeight: 1.5,
                      },
                    },
                    asArray(milestone.topics).join(" · "),
                  ),
                  strOr(milestone.objective)
                    ? h(
                        "div",
                        {
                          style: {
                            fontSize: 11.5,
                            color: "var(--tomato-ink-3)",
                            marginTop: 2,
                            lineHeight: 1.5,
                          },
                        },
                        milestone.objective,
                      )
                    : null,
                ),
                h(
                  "span",
                  {
                    style: {
                      fontSize: 11,
                      color: "var(--tomato-ink-3)",
                      flex: "none",
                    },
                  },
                  t("education.milestoneLessons", {
                    n: numOr(milestone.lessonCount, 0),
                  }),
                ),
              ),
            ),
          );
        }),
  );

  const assessmentsCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "tasks",
      title: t("education.assessmentsTitle"),
      hint: t("education.attentionHint", { n: assessments.length }),
      action: onAssistant
        ? h(
            Btn,
            {
              variant: "soft",
              size: "sm",
              onClick: () => onAssistant("assign", { projectId }),
            },
            t("education.assignAction"),
          )
        : null,
    }),
    assessments.length === 0
      ? mutedText(t("education.assessmentsEmpty"))
      : assessments.map((assessment, assessmentIndex) =>
          h(AssessmentRow, {
            key: assessment.id || `assessment-${assessmentIndex}`,
            assessment,
            index,
            at,
            onAssistant,
            onOpen: (item) => onOpenAssignment?.({ assessmentId: item.id }),
          }),
        ),
  );

  const reviewsCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "edit", title: t("education.reviewsTitle") }),
    reviews.length === 0
      ? mutedText(t("education.reviewsEmpty"))
      : reviews.map((review, reviewIndex) =>
          h(
            "div",
            {
              key: review.id || `review-${reviewIndex}`,
              style: {
                padding: "8px 0",
                borderBottom: "1px solid var(--tomato-line)",
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
                  className: "t-mono",
                  style: { fontSize: 11.5, color: "var(--tomato-ink-3)" },
                },
                strOr(review.date),
              ),
              h(
                "span",
                { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
                t("education.findingsLabel"),
              ),
            ),
            h(
              "div",
              {
                style: {
                  fontSize: 12.5,
                  color: "var(--tomato-ink-2)",
                  lineHeight: 1.6,
                  marginTop: 3,
                },
              },
              strOr(review.findings),
            ),
            asArray(review.actions).length > 0
              ? h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      flexWrap: "wrap",
                      marginTop: 5,
                    },
                  },
                  h(
                    "span",
                    { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
                    t("education.actionsLabel"),
                  ),
                  asArray(review.actions).map((action, actionIndex) =>
                    h(
                      Chip,
                      { key: actionIndex, tone: "neutral" },
                      strOr(action),
                    ),
                  ),
                )
              : null,
          ),
        ),
  );

  const eventsCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "bell", title: t("education.eventsTitle") }),
    events.length === 0
      ? mutedText(t("education.eventsEmpty"))
      : events.map((event, eventIndex) =>
          h(
            "div",
            { key: event.id || `event-${eventIndex}`, style: ROW },
            h(
              Chip,
              { tone: eventStateTone(event.state) },
              eventStateLabel(event.state),
            ),
            h(
              "div",
              { style: { flex: 1, minWidth: 0 } },
              h(
                "div",
                {
                  style: {
                    fontSize: 12.5,
                    color: "var(--tomato-ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                },
                strOr(event.kind, t("education.unnamedTopic")),
              ),
              h(
                "div",
                { style: META },
                h("span", null, fmtDateTime(event.createdAt)),
              ),
            ),
            event.state !== "done"
              ? h(
                  Btn,
                  {
                    variant: "ghost",
                    size: "sm",
                    icon: "refresh",
                    onClick: () => onRetry(event.id),
                  },
                  t("education.retryEvent"),
                )
              : null,
          ),
        ),
  );

  const whitelistList =
    projectWhitelist !== null ? projectWhitelist : genericWhitelist;
  const whitelistCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "shield",
      title: t("education.whitelistTitle"),
      hint: projectWhitelist === null ? t("education.whitelistGeneric") : null,
    }),
    whitelistList.length === 0
      ? mutedText(t("education.whitelistEmpty"))
      : h(
          "div",
          { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          whitelistList.map((appId, appIndex) =>
            h(
              Chip,
              {
                key: `${strOr(appId)}-${appIndex}`,
                tone: "neutral",
                style: { fontFamily: "ui-monospace, monospace" },
              },
              strOr(appId),
            ),
          ),
        ),
  );

  const visionCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "leaf", title: t("education.visionTitle") }),
    visions.length === 0
      ? mutedText(t("education.visionEmpty"))
      : visions.map((vision, visionIndex) =>
          h(
            "div",
            {
              key: vision.id || `vision-${visionIndex}`,
              style: { padding: "6px 0" },
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
              strOr(vision.name, t("education.unnamedProject")),
            ),
            strOr(vision.notes)
              ? h(
                  "div",
                  {
                    style: {
                      fontSize: 12,
                      color: "var(--tomato-ink-3)",
                      marginTop: 2,
                      lineHeight: 1.6,
                    },
                  },
                  vision.notes,
                )
              : null,
          ),
        ),
  );

  const tasksCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "tasks",
      title: t("education.projectTasksTitle"),
      hint: t("education.attentionHint", { n: projectTasks.length }),
    }),
    projectTasks.length === 0
      ? mutedText(t("education.projectTasksEmpty"))
      : h(
          "div",
          {
            className: "t-scroll",
            style: { maxHeight: 320, overflowY: "auto", paddingRight: 4 },
          },
          openTasks.length > 0
            ? subHeading(t("education.openTasks"), openTasks.length)
            : null,
          openTasks.map((task, taskIndex) => {
            const target = teachingTargetOf(data, task);
            return h(ProjectTaskRow, {
              key: task.id || `open-${taskIndex}`,
              task,
              onToggle,
              target,
              onOpen: onOpenAssignment,
            });
          }),
          doneTasks.length > 0
            ? subHeading(t("education.doneTasks"), doneTasks.length)
            : null,
          doneTasks.map((task, taskIndex) => {
            const target = teachingTargetOf(data, task);
            return h(ProjectTaskRow, {
              key: task.id || `done-${taskIndex}`,
              task,
              onToggle,
              target,
              onOpen: onOpenAssignment,
            });
          }),
        ),
  );

  return h(
    "div",
    { className: "t-root" },
    h(
      Btn,
      {
        variant: "ghost",
        icon: "arrowLeft",
        onClick: onBack,
        style: { marginBottom: 12 },
      },
      t("education.back"),
    ),
    headerCard,
    h("div", { style: { height: 16 } }),
    statsRow,
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
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
        directoryCard,
        resourcesCard,
        semesterCard,
        assessmentsCard,
        reviewsCard,
        eventsCard,
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
        progressCard,
        completedCard,
        whitelistCard,
        visionCard,
        tasksCard,
      ),
    ),
  );
}

// ---------------------------------------------------------------- 页面

export function EducationPage({ onAssistant } = {}) {
  const state = useSnapshot();
  const [detailId, setDetailId] = useState(null);
  const [library, setLibrary] = useState(null);
  // 教学任务的工作台：只能从任务行/成绩行打开，普通任务不走这里。
  const [assignment, setAssignment] = useState(null);

  // 资料库授权不属于快照数据（它是本机权限，不进计划 JSON）；页面单独读一次，
  // 授权/取消/重试后由 LibraryCard 回写这份状态。
  const loadLibrary = () => {
    getLibraryGrant({ timeoutMs: 4000 })
      .then((next) => setLibrary(next))
      .catch((error) =>
        setLibrary({
          authorized: false,
          directory: null,
          projects: 0,
          sharedProjects: [],
          unavailable: true,
          reason:
            error && error.userMessage ? error.userMessage : String(error),
        }),
      );
  };
  useEffect(() => {
    loadLibrary();
  }, []);

  if (state === null) {
    return h(
      "div",
      { className: "t-root" },
      h(PageHeader, {
        eyebrow: t("education.eyebrow"),
        title: t("education.title"),
        subtitle: t("education.subtitle"),
        actions: h(IconBtn, {
          name: "refresh",
          title: t("education.refreshTitle"),
          onClick: () => refresh(),
        }),
      }),
      h(
        Card,
        { pad: 22 },
        h(SectionTitle, {
          icon: "education",
          title: t("education.projectsTitle"),
          hint: t("education.loading"),
        }),
        h(Skeleton, { w: "62%", h: 15 }),
        h(Skeleton, { w: "42%", h: 15, style: { marginTop: 10 } }),
        h(Skeleton, { w: "76%", h: 15, style: { marginTop: 10 } }),
        h(Skeleton, { w: "30%", h: 15, style: { marginTop: 10 } }),
      ),
    );
  }

  const data = state.data && typeof state.data === "object" ? state.data : {};
  const edu = normalizeEducation(data.education);
  const at = hasTs(state.serverTime)
    ? Number(state.serverTime)
    : Math.floor(Date.now() / 1000);
  const today = strOr(state.today) || dayKey(at);
  const index = buildIndex(edu);

  const header = h(PageHeader, {
    eyebrow: t("education.eyebrow"),
    title: t("education.title"),
    subtitle: t("education.subtitle"),
    actions: h(IconBtn, {
      name: "refresh",
      title: t("education.refreshTitle"),
      onClick: () => refresh(),
    }),
  });

  if (detailId !== null) {
    const study =
      edu.projects.find((item) => item.projectId === detailId) || null;
    if (study === null) {
      return h(
        "div",
        { className: "t-root" },
        h(
          Btn,
          {
            variant: "ghost",
            icon: "arrowLeft",
            onClick: () => setDetailId(null),
            style: { marginBottom: 12 },
          },
          t("education.back"),
        ),
        h(
          Card,
          { flat: true, pad: 6 },
          h(Empty, {
            icon: "education",
            title: t("education.projectMissing"),
            action: h(
              Btn,
              { variant: "soft", onClick: () => setDetailId(null) },
              t("education.back"),
            ),
          }),
        ),
      );
    }
    return h(ProjectDetail, {
      data,
      edu,
      study,
      project: projectById(data, detailId),
      today,
      at,
      index,
      library,
      onBack: () => setDetailId(null),
      onAssistant,
      onOpenAssignment: setAssignment,
    });
  }

  const startFocus = async (taskId) => {
    const selected = await tryDispatch({ type: "selectTask", id: taskId });
    if (!selected.ok) {
      notify(selected.error, "danger");
      return;
    }
    const started = await tryDispatch({ type: "startTimer" });
    if (!started.ok) {
      notify(started.error, "danger");
      return;
    }
    notify(t("education.focusStarted"), "brand");
  };

  const toggleTask = async (taskId) => {
    const result = await tryDispatch({ type: "toggleTask", id: taskId });
    if (!result.ok) notify(result.error, "danger");
  };

  const confirmProgress = async (recordId) => {
    const result = await tryDispatch({
      type: "education",
      command: { op: "confirmProgress", id: recordId },
    });
    if (!result.ok) notify(result.error, "danger");
  };

  // ---- 项目卡片
  const projectCards = edu.projects.map((study, projectIndex) => {
    const project = projectById(data, strOr(study.projectId));
    const name =
      project && strOr(project.name)
        ? project.name
        : t("education.unnamedProject");
    const color = projectColor(data, study.projectId);
    const resources = edu.resources.filter(
      (item) => item.projectId === study.projectId,
    );
    const latest = sortDesc(
      edu.progress.filter((item) => item.projectId === study.projectId),
      "recordedAt",
    )[0];
    return h(
      Card,
      { key: strOr(study.projectId) || `project-${projectIndex}`, pad: 18 },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 12 } },
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
          h(Dot, { color, size: 9 }),
          h(
            "div",
            {
              style: {
                fontSize: 15,
                fontWeight: 620,
                color: "var(--tomato-ink)",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            },
            name,
          ),
          study.examMode === true
            ? h(Chip, { tone: "brand" }, t("education.examMode"))
            : null,
        ),
        study.target
          ? h(
              "div",
              {
                style: {
                  fontSize: 11.5,
                  color: "var(--tomato-ink-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              },
              `${t("education.targetLabel")} ${study.target}`,
            )
          : null,
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
            },
          },
          h(
            "div",
            null,
            h(
              "div",
              {
                style: {
                  fontSize: 10.5,
                  color: "var(--tomato-ink-3)",
                  marginBottom: 4,
                  letterSpacing: ".06em",
                },
              },
              t("education.countdownLabel"),
            ),
            h(Countdown, { examDate: study.examDate, today }),
          ),
          h(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              },
            },
            h(
              Chip,
              { tone: "neutral" },
              t("education.resourcesCount", { n: resources.length }),
            ),
          ),
        ),
        h(
          "div",
          { style: { minHeight: 36 } },
          h(
            "div",
            {
              style: {
                fontSize: 10.5,
                color: "var(--tomato-ink-3)",
                marginBottom: 3,
              },
            },
            t("education.latestProgressLabel"),
          ),
          latest
            ? h(
                "div",
                {
                  style: {
                    fontSize: 12.5,
                    color: "var(--tomato-ink-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                },
                `${strOr(latest.topic, t("education.unnamedTopic"))}${
                  strOr(latest.position) ? ` · ${latest.position}` : ""
                }`,
              )
            : h(
                "div",
                { style: { fontSize: 12, color: "var(--tomato-ink-3)" } },
                t("education.noProgress"),
              ),
        ),
        h(
          "div",
          { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h(
            Btn,
            {
              variant: "soft",
              size: "sm",
              iconRight: "arrowRight",
              onClick: () => setDetailId(study.projectId),
            },
            t("education.viewDetail"),
          ),
          onAssistant
            ? h(
                Btn,
                {
                  variant: "ghost",
                  size: "sm",
                  onClick: () =>
                    onAssistant("assign", { projectId: study.projectId }),
                },
                t("education.assignAction"),
              )
            : null,
        ),
      ),
    );
  });

  const librarySection = h(LibraryCard, {
    library,
    projectIds: edu.projects
      .map((item) => strOr(item.projectId))
      .filter(Boolean),
    onChange: (next) => setLibrary(next),
    onReload: loadLibrary,
  });

  const projectsSection = h(
    "div",
    { style: { marginBottom: 16 } },
    h(SectionTitle, {
      icon: "education",
      title: t("education.projectsTitle"),
      hint: t("education.projectsHint", { n: edu.projects.length }),
    }),
    edu.projects.length === 0
      ? h(
          Card,
          { flat: true, pad: 6 },
          h(Empty, {
            icon: "education",
            title: t("education.emptyProjectsTitle"),
            hint: t("education.emptyProjectsHint"),
          }),
        )
      : h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 14,
            },
          },
          projectCards,
        ),
  );

  // ---- 今日学习任务
  const todayItems = [];
  for (const link of edu.focusTasks) {
    const task = taskById(data, link.taskId);
    if (!task) continue;
    const due = strOr(task.dueDate);
    if (
      due === today ||
      (due !== "" && due < today && task.completed !== true)
    ) {
      todayItems.push({ link, task });
    }
  }
  todayItems.sort((a, b) => {
    const ac = a.task.completed === true ? 1 : 0;
    const bc = b.task.completed === true ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return strOr(a.task.reminderTime).localeCompare(strOr(b.task.reminderTime));
  });

  const todayCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "focus",
      title: t("education.todayTasks"),
      hint: t("education.todayTasksHint", { n: todayItems.length }),
    }),
    todayItems.length === 0
      ? h(Empty, {
          icon: "focus",
          title: t("education.noTodayTasks"),
          style: { padding: "24px 12px" },
        })
      : todayItems.map(({ link, task }) => {
          const target =
            link.kind === "lesson"
              ? { lessonId: link.sourceId, taskId: task.id }
              : { assessmentId: link.sourceId, taskId: task.id };
          return h(TeachingTaskRow, {
            key: task.id,
            task: { ...task, kind: link.kind },
            data,
            onToggle: toggleTask,
            onFocus: startFocus,
            target,
            onOpen: setAssignment,
          });
        }),
  );

  // ---- 需要处理
  const pendingSubmit = [];
  const pendingGrade = [];
  const pendingCorrection = [];
  const pendingReview = [];
  for (const assessment of edu.assessments) {
    const status = assessmentStatus(assessment, index, at);
    const submission = index.submissionOf.get(assessment.id) || null;
    const grade = submission ? index.gradeOf.get(submission.id) || null : null;
    if (
      submission === null &&
      (status === "awaitingSubmission" ||
        status === "overdue" ||
        status === "missed")
    ) {
      pendingSubmit.push({ assessment, status });
    }
    if (grade !== null) {
      if (grade.needsReview === true) pendingReview.push({ assessment, grade });
      for (const error of pendingCorrections(grade, index)) {
        pendingCorrection.push({ assessment, grade, error });
      }
    }
    if (submission !== null && grade === null)
      pendingGrade.push({ assessment, submission });
  }

  const attentionRow = (
    key,
    color,
    title,
    kind,
    timeText,
    note,
    status,
    action,
    onAction,
  ) =>
    h(
      "div",
      { key, style: ROW },
      h(Dot, { color: color || "var(--tomato-ink-3)" }),
      h(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        h(
          "div",
          {
            style: {
              fontSize: 12.5,
              color: "var(--tomato-ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          },
          title,
        ),
        h(
          "div",
          { style: META },
          h(Chip, { tone: "neutral" }, kind),
          timeText ? h("span", null, timeText) : null,
          note
            ? h("span", { style: { color: "var(--tomato-ink-2)" } }, note)
            : null,
        ),
      ),
      status
        ? h(Chip, { tone: statusTone(status) }, statusLabel(status))
        : null,
      onAction
        ? h(Btn, { variant: "ghost", size: "sm", onClick: onAction }, action)
        : null,
    );

  const attentionTotal =
    pendingSubmit.length +
    pendingGrade.length +
    pendingCorrection.length +
    pendingReview.length;
  const attentionCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "bell",
      title: t("education.needsAttention"),
      hint: t("education.attentionHint", { n: attentionTotal }),
    }),
    attentionTotal === 0
      ? mutedText(t("education.nothingPending"))
      : h(
          "div",
          null,
          pendingSubmit.length > 0
            ? h(
                "div",
                null,
                subHeading(t("education.pendingSubmit"), pendingSubmit.length),
                pendingSubmit.map(({ assessment, status }, submitIndex) =>
                  attentionRow(
                    `submit-${assessment.id || submitIndex}`,
                    projectColor(data, assessment.projectId),
                    strOr(assessment.title, t("education.unnamedProject")),
                    assessmentKindLabel(assessment.kind),
                    t("education.deadlineLabel", {
                      date: fmtDateTime(assessment.endsAt),
                    }),
                    "",
                    status,
                    t("education.submitAction"),
                    onAssistant
                      ? () =>
                          onAssistant("submit", {
                            projectId: assessment.projectId,
                            assessmentId: assessment.id,
                          })
                      : null,
                  ),
                ),
              )
            : null,
          pendingGrade.length > 0
            ? h(
                "div",
                null,
                subHeading(t("education.pendingGrade"), pendingGrade.length),
                pendingGrade.map(({ assessment, submission }, gradeIndex) =>
                  attentionRow(
                    `grade-${submission.id || gradeIndex}`,
                    projectColor(data, assessment.projectId),
                    strOr(assessment.title, t("education.unnamedProject")),
                    assessmentKindLabel(assessment.kind),
                    fmtDateTime(submission.submittedAt),
                    "",
                    "submitted",
                    t("education.gradeAction"),
                    onAssistant
                      ? () =>
                          onAssistant("grade", {
                            projectId: assessment.projectId,
                            assessmentId: assessment.id,
                            submissionId: submission.id,
                          })
                      : null,
                  ),
                ),
              )
            : null,
          pendingCorrection.length > 0
            ? h(
                "div",
                null,
                subHeading(
                  t("education.pendingCorrection"),
                  pendingCorrection.length,
                ),
                pendingCorrection.map(
                  ({ assessment, grade, error }, errorIndex) => {
                    const note = [
                      strOr(error.cause)
                        ? `${t("education.causeLabel")} ${error.cause}`
                        : "",
                      strOr(error.retestDate)
                        ? t("education.retestLabel", { date: error.retestDate })
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return attentionRow(
                      `correction-${grade.id}-${error.questionId}-${errorIndex}`,
                      projectColor(data, assessment.projectId),
                      strOr(assessment.title, t("education.unnamedProject")),
                      assessmentKindLabel(assessment.kind),
                      fmtDateTime(grade.gradedAt),
                      note,
                      "correctionDue",
                      t("education.correctAction"),
                      onAssistant
                        ? () =>
                            onAssistant("correct", {
                              projectId: assessment.projectId,
                              assessmentId: assessment.id,
                              submissionId: grade.submissionId,
                              gradeId: grade.id,
                              questionId: error.questionId,
                            })
                        : null,
                    );
                  },
                ),
              )
            : null,
          pendingReview.length > 0
            ? h(
                "div",
                null,
                subHeading(t("education.pendingReview"), pendingReview.length),
                pendingReview.map(({ assessment, grade }, reviewIndex) =>
                  attentionRow(
                    `review-${grade.id || reviewIndex}`,
                    projectColor(data, assessment.projectId),
                    strOr(assessment.title, t("education.unnamedProject")),
                    assessmentKindLabel(assessment.kind),
                    fmtDateTime(grade.gradedAt),
                    "",
                    "needsReview",
                    t("education.reviewAction"),
                    onAssistant
                      ? () =>
                          onAssistant("review", {
                            projectId: assessment.projectId,
                            assessmentId: assessment.id,
                            submissionId: grade.submissionId,
                            gradeId: grade.id,
                          })
                      : null,
                  ),
                ),
              )
            : null,
        ),
  );

  // ---- 接下来一周
  const weekEnd = addDays(today, 7);
  const inWeek = (ts) => {
    if (!hasTs(ts)) return false;
    const key = dayKey(Number(ts));
    return key >= today && key < weekEnd;
  };
  const weekLessons = sortAsc(
    edu.lessons.filter((lesson) => inWeek(lesson.startsAt)),
    "startsAt",
  );
  const weekAssessments = sortAsc(
    edu.assessments.filter((assessment) => inWeek(assessment.startsAt)),
    "startsAt",
  );
  const relatedResourceIds = new Set();
  for (const lesson of weekLessons) {
    for (const resourceId of asArray(lesson.resourceIds))
      relatedResourceIds.add(resourceId);
  }
  const weekResources = edu.resources.filter((resource) =>
    relatedResourceIds.has(resource.id),
  );

  const weekCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, { icon: "calendarClock", title: t("education.nextWeek") }),
    weekLessons.length + weekAssessments.length + weekResources.length === 0
      ? mutedText(t("education.nextWeekEmpty"))
      : h(
          "div",
          null,
          weekLessons.length > 0
            ? h(
                "div",
                null,
                subHeading(t("education.weekLessons"), weekLessons.length),
                weekLessons.map((lesson, lessonIndex) =>
                  h(
                    "div",
                    { key: lesson.id || `lesson-${lessonIndex}`, style: ROW },
                    h(
                      "span",
                      {
                        className: "t-mono",
                        style: {
                          fontSize: 11.5,
                          color: "var(--tomato-ink-3)",
                          flex: "none",
                        },
                      },
                      fmtRange(lesson.startsAt, lesson.endsAt),
                    ),
                    h(
                      "div",
                      { style: { flex: 1, minWidth: 0 } },
                      h(
                        "div",
                        {
                          style: {
                            fontSize: 12.5,
                            color: "var(--tomato-ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        },
                        strOr(lesson.title, t("education.unnamedTopic")),
                      ),
                      h(
                        "div",
                        { style: META },
                        h(Chip, { tone: "neutral" }, t("education.lessonKind")),
                        h(
                          "span",
                          null,
                          t("education.topicsCount", {
                            n: asArray(lesson.topics).length,
                          }),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            : null,
          weekResources.length > 0
            ? h(
                "div",
                null,
                subHeading(t("education.weekResources"), weekResources.length),
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      paddingTop: 4,
                    },
                  },
                  weekResources.map((resource, resourceIndex) =>
                    h(
                      Chip,
                      {
                        key: resource.id || `week-resource-${resourceIndex}`,
                        tone: "neutral",
                      },
                      `${strOr(resource.title)} · ${resourceKindLabel(resource.kind)}`,
                    ),
                  ),
                ),
              )
            : null,
          weekAssessments.length > 0
            ? h(
                "div",
                null,
                subHeading(
                  t("education.weekAssessments"),
                  weekAssessments.length,
                ),
                weekAssessments.map((assessment, assessmentIndex) =>
                  h(
                    "div",
                    {
                      key:
                        assessment.id || `week-assessment-${assessmentIndex}`,
                      style: ROW,
                    },
                    h(
                      "span",
                      {
                        className: "t-mono",
                        style: {
                          fontSize: 11.5,
                          color: "var(--tomato-ink-3)",
                          flex: "none",
                        },
                      },
                      fmtRange(assessment.startsAt, assessment.endsAt),
                    ),
                    h(
                      "div",
                      { style: { flex: 1, minWidth: 0 } },
                      h(
                        "div",
                        {
                          style: {
                            fontSize: 12.5,
                            color: "var(--tomato-ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        },
                        strOr(assessment.title, t("education.unnamedProject")),
                      ),
                      h(
                        "div",
                        { style: META },
                        h(
                          Chip,
                          { tone: "neutral" },
                          assessmentKindLabel(assessment.kind),
                        ),
                        h(
                          "span",
                          null,
                          t("education.topicsCount", {
                            n: asArray(assessment.questions).length,
                          }),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            : null,
        ),
  );

  // ---- 最近学到哪里
  const recentProgress = sortDesc(edu.progress, "recordedAt").slice(0, 6);
  const progressCard = h(
    Card,
    { pad: 22 },
    h(SectionTitle, {
      icon: "stats",
      title: t("education.recentProgress"),
      hint: t("education.attentionHint", { n: edu.progress.length }),
    }),
    recentProgress.length === 0
      ? mutedText(t("education.noProgress"))
      : recentProgress.map((record, recordIndex) =>
          h(ProgressRow, {
            key: record.id || `progress-${recordIndex}`,
            record,
            onConfirm: confirmProgress,
          }),
        ),
  );

  return h(
    "div",
    { className: "t-root" },
    header,
    librarySection,
    projectsSection,
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
          alignItems: "start",
        },
      },
      todayCard,
      attentionCard,
    ),
    h("div", { style: { height: 16 } }),
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
          alignItems: "start",
        },
      },
      weekCard,
      progressCard,
    ),
    h(AssignmentDialog, {
      open: assignment !== null,
      onClose: () => setAssignment(null),
      assessmentId: assignment ? (assignment.assessmentId ?? null) : null,
      lessonId: assignment ? (assignment.lessonId ?? null) : null,
      data,
      today,
      now: at,
    }),
  );
}

registerPage({
  id: "education",
  order: 60,
  icon: "education",
  titleKey: "nav.education",
  Component: EducationPage,
});
