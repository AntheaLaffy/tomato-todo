// 作业 / 考试 / 课程工作台：教学任务唯一的详情入口。
//
// 为什么不是 TaskDialog 的变体：应试任务由助手经 education 命令发布，标题、
// 日期、题目与评分点都不归用户改；这里只做三件事——看绑定的资料与试卷、
// 在考试时间窗内开始/停笔、提交答案或答卷。课程任务同理，只记录学习进度。
// 普通任务仍走 TaskDialog，入口由 teachingTargetOf() 明确区分。
//
// 数据面：快照的 data.education（assessments/lessons/submissions/grades/
// focusTasks/projects/resources）+ data.projects。默认 /api/state 省略教学
// 资源明细（体积），所以打开时按需取 ?education=lite 的目录，再逐条查文件
// 信息；预览统一交给 shared/file-preview.js，不在这里另写一套。
import { h, useEffect, useMemo, useState } from "../runtime.js";
import { registerCopy, t } from "../shared/copy.js";
import { Icon } from "../shared/icons.js";
import {
  Btn,
  Check,
  Chip,
  Divider,
  Empty,
  Field,
  Input,
  Modal,
  SectionTitle,
  TextArea,
  Toggle,
  notify,
} from "../shared/ui.js";
import { FilePreview } from "../shared/file-preview.js";
import { tryDispatch } from "../shared/store.js";
import {
  getFileToken,
  getLibraryItems,
  getResourceInfo,
  getStateWithResources,
  registerResource,
  resourceFileUrl,
} from "../shared/api.js";

registerCopy("assignment", {
  zh: {
    materialsHomework: "资料与试卷",
    materialsLesson: "课程资料",
    materialsHint:
      "这次作业/考试绑定的资料与试卷；预览在弹窗内打开，下载取原件。",
    materialsEmpty: "这次作业没有绑定资料",
    lessonMaterialsEmpty: "这节课没有绑定资料",
    related: "相关资料",
    relatedHint: "项目考纲、真题与模拟题",
    preview: "预览",
    download: "下载",
    previewBlocked: "超过 20 MiB 或类型不支持，请下载原件",
    sizeUnknown: "—",
    loading: "正在读取资料…",
    loadFailed: "资料读取失败：{error}",
    fileTokenFailed: "文件地址不可用：{error}",
    instructions: "说明",
    topics: "知识点",
    submission: "提交",
    submittedAt: "提交于 {time}",
    answers: "答案",
    answersEmpty: "没有填写答案文本",
    attachments: "答卷附件",
    attachmentsEmpty: "没有上传答卷文件",
    unfinished: "标记为未完成",
    unfinishedTag: "未完成",
    waitingGrade: "已提交，等待批改",
    gradedAt: "批改于 {time}",
    needsReview: "批改待复核",
    lockedHint: "提交不可覆盖；需要重交请让助手发布新版本。",
    answerLabel: "答案文本",
    answerPlaceholder: "把答案写在这里，最多 50000 字",
    answerCount: "{n} / 50000",
    answerSheets: "答卷文件",
    answerSheetsHint: "从项目已登记的答卷里多选；考试至少选一份纸质答题卡。",
    answerSheetsEmpty: "项目里还没有登记答卷文件",
    registerSheet: "从资料库选文件并登记为答卷",
    pickerTitle: "选择答卷文件",
    pickerSubtitle: "选一条共享资料库索引里的文件，登记为这个项目的答卷。",
    pickerSearch: "搜索文件",
    pickerEmpty: "资料库里没有可用文件",
    pickerNoIndex: "还没有共享资料库索引，请先到应试教育页扫描资料库。",
    pickerError: "读取资料库失败：{error}",
    register: "登记为答卷",
    registering: "登记中…",
    registered: "已登记为答卷",
    registerFailed: "登记失败：{error}",
    submitHomework: "提交作业",
    submitExam: "提交试卷",
    submitting: "提交中…",
    submitDone: "已提交",
    examStart: "开始考试",
    examStop: "停笔",
    examTitle: "考试",
    examStartHint: "开始考试前需要助手已确认打印，且只能在考试安排当天开始。",
    examRunning: "考试进行中，停笔后才能上传答题卡。",
    examStopped: "已停笔，可以上传答题卡并提交。",
    examNotPrinted: "试卷尚未确认打印，现在开始会被 core 拒绝。",
    examStartedAt: "开始于 {time}",
    examStoppedAt: "停笔于 {time}",
    lessonProgress: "学习进度",
    lessonProgressEmpty: "还没有记录学习进度",
    progressPlaceholder: "这次课学到哪里、掌握到什么程度",
    saveProgress: "记录学习进度",
    savingProgress: "保存中…",
    progressSaved: "学习进度已记录",
    progressWindow: "只能在上课时间窗内记录参与。",
    progressRequired: "请先写一句学习进度",
    lessonAttended: "已参与",
    lessonUpcoming: "待上课",
    missingTitle: "记录不存在",
    missingHint: "这条作业/课程可能已被删除，刷新后再试。",
  },
  en: {
    materialsHomework: "Materials & papers",
    materialsLesson: "Lesson materials",
    materialsHint:
      "Files bound to this assignment; preview opens in a dialog, download saves the original.",
    materialsEmpty: "No materials are bound to this assignment",
    lessonMaterialsEmpty: "No materials are bound to this lesson",
    related: "Related materials",
    relatedHint: "Syllabus, past papers and mock papers for the project",
    preview: "Preview",
    download: "Download",
    previewBlocked:
      "Over 20 MiB or not previewable — download the original instead",
    sizeUnknown: "—",
    loading: "Loading materials…",
    loadFailed: "Could not load materials: {error}",
    fileTokenFailed: "File links unavailable: {error}",
    instructions: "Notes",
    topics: "Topics",
    submission: "Submission",
    submittedAt: "Submitted {time}",
    answers: "Answers",
    answersEmpty: "No answer text",
    attachments: "Answer sheets",
    attachmentsEmpty: "No files attached",
    unfinished: "Mark as unfinished",
    unfinishedTag: "Unfinished",
    waitingGrade: "Submitted, waiting to be graded",
    gradedAt: "Graded {time}",
    needsReview: "Grading needs review",
    lockedHint:
      "A submission cannot be overwritten; ask the assistant to publish a new version to resubmit.",
    answerLabel: "Answer text",
    answerPlaceholder: "Write the answer here, up to 50000 characters",
    answerCount: "{n} / 50000",
    answerSheets: "Answer files",
    answerSheetsHint:
      "Pick from the project's registered answer sheets; exams need at least one scanned sheet.",
    answerSheetsEmpty: "No answer sheets registered for this project",
    registerSheet: "Pick a library file and register it as an answer sheet",
    pickerTitle: "Choose an answer sheet",
    pickerSubtitle:
      "Pick a file from the shared library index and register it as this project's answer sheet.",
    pickerSearch: "Search files",
    pickerEmpty: "No usable files in the library",
    pickerNoIndex:
      "The shared library index is missing; scan it on the Education page first.",
    pickerError: "Could not read the library: {error}",
    register: "Register as answer sheet",
    registering: "Registering…",
    registered: "Registered as an answer sheet",
    registerFailed: "Could not register: {error}",
    submitHomework: "Submit homework",
    submitExam: "Submit exam",
    submitting: "Submitting…",
    submitDone: "Submitted",
    examStart: "Start exam",
    examStop: "Stop writing",
    examTitle: "Exam",
    examStartHint:
      "The assistant must confirm printing first, and the exam can only start on its scheduled day.",
    examRunning:
      "Exam in progress; stop writing before uploading answer sheets.",
    examStopped: "Stopped — you can upload answer sheets and submit.",
    examNotPrinted:
      "Printing has not been confirmed; core will reject a start.",
    examStartedAt: "Started {time}",
    examStoppedAt: "Stopped {time}",
    lessonProgress: "Study progress",
    lessonProgressEmpty: "No study progress recorded yet",
    progressPlaceholder:
      "Where did this lesson get to, and how well is it understood?",
    saveProgress: "Record progress",
    savingProgress: "Saving…",
    progressSaved: "Study progress recorded",
    progressWindow: "Attendance can only be recorded inside the lesson window.",
    progressRequired: "Write one line of study progress first",
    lessonAttended: "Attended",
    lessonUpcoming: "Scheduled",
    missingTitle: "Record not found",
    missingHint:
      "This assignment or lesson may have been removed; refresh and try again.",
  },
  ja: {
    materialsHomework: "教材と問題",
    materialsLesson: "授業資料",
    materialsHint:
      "この課題に紐づく資料です。プレビューはダイアログで開き、ダウンロードは原本を保存します。",
    materialsEmpty: "この課題には資料が紐づいていません",
    lessonMaterialsEmpty: "この授業には資料が紐づいていません",
    related: "関連資料",
    relatedHint: "プロジェクトのシラバス・過去問・模擬問題",
    preview: "プレビュー",
    download: "ダウンロード",
    previewBlocked:
      "20 MiB を超えるかプレビュー不可です。原本をダウンロードしてください",
    sizeUnknown: "—",
    loading: "資料を読み込み中…",
    loadFailed: "資料を読み込めません：{error}",
    fileTokenFailed: "ファイル URL を利用できません：{error}",
    instructions: "説明",
    topics: "知識点",
    submission: "提出",
    submittedAt: "{time} に提出",
    answers: "解答",
    answersEmpty: "解答テキストはありません",
    attachments: "答案ファイル",
    attachmentsEmpty: "添付ファイルはありません",
    unfinished: "未完成として記録",
    unfinishedTag: "未完成",
    waitingGrade: "提出済み、採点待ち",
    gradedAt: "{time} に採点",
    needsReview: "採点の再確認待ち",
    lockedHint:
      "提出は上書きできません。再提出が必要ならアシスタントに新しい版を出してもらってください。",
    answerLabel: "解答テキスト",
    answerPlaceholder: "ここに解答を書きます（最大 50000 文字）",
    answerCount: "{n} / 50000",
    answerSheets: "答案ファイル",
    answerSheetsHint:
      "プロジェクトに登録済みの答案から複数選択します。試験は答案用紙が最低 1 枚必要です。",
    answerSheetsEmpty: "このプロジェクトには答案が登録されていません",
    registerSheet: "資料庫からファイルを選んで答案として登録",
    pickerTitle: "答案ファイルを選択",
    pickerSubtitle:
      "共有資料庫の索引から 1 件選び、このプロジェクトの答案として登録します。",
    pickerSearch: "ファイルを検索",
    pickerEmpty: "資料庫に使えるファイルがありません",
    pickerNoIndex:
      "共有資料庫の索引がありません。先に教育ページでスキャンしてください。",
    pickerError: "資料庫を読み込めません：{error}",
    register: "答案として登録",
    registering: "登録中…",
    registered: "答案として登録しました",
    registerFailed: "登録できません：{error}",
    submitHomework: "宿題を提出",
    submitExam: "答案を提出",
    submitting: "提出中…",
    submitDone: "提出しました",
    examStart: "試験を開始",
    examStop: "筆記終了",
    examTitle: "試験",
    examStartHint:
      "開始前にアシスタントの印刷確認が必要で、開始できるのは試験当日だけです。",
    examRunning: "試験中です。筆記終了後に答案をアップロードしてください。",
    examStopped: "筆記終了。答案をアップロードして提出できます。",
    examNotPrinted: "印刷が未確認です。いま開始すると core に拒否されます。",
    examStartedAt: "{time} に開始",
    examStoppedAt: "{time} に終了",
    lessonProgress: "学習進捗",
    lessonProgressEmpty: "学習進捗はまだありません",
    progressPlaceholder: "どこまで進み、どこまで理解できたか",
    saveProgress: "学習進捗を記録",
    savingProgress: "保存中…",
    progressSaved: "学習進捗を記録しました",
    progressWindow: "参加を記録できるのは授業時間内だけです。",
    progressRequired: "学習進捗を一言書いてください",
    lessonAttended: "参加済み",
    lessonUpcoming: "予定",
    missingTitle: "記録がありません",
    missingHint: "この課題または授業は削除された可能性があります。",
  },
});

/** 答案文本上限：与 core 的 checkText(…, 50000) 对齐。 */
const MAX_ANSWERS = 50000;
const PICKER_LIMIT = 40;

const ROW = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 44,
  padding: "7px 4px",
  borderBottom: "1px solid var(--tomato-line)",
};
const META = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "3px 10px",
  marginTop: 2,
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "var(--tomato-ink-3)",
};
const MUTED = {
  fontSize: 12.5,
  lineHeight: 1.65,
  color: "var(--tomato-ink-3)",
};
const ELLIPSIS = {
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const LINK_BTN = {
  height: 28,
  padding: "0 10px",
  fontSize: 12.5,
  borderRadius: 9,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flex: "none",
  textDecoration: "none",
  color: "var(--tomato-ink-2)",
};

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

const ASSESSMENT_STATUS_COPY = {
  upcoming: "statusUpcoming",
  inProgress: "statusInProgress",
  awaiting: "statusAwaiting",
  overdue: "statusOverdue",
  submitted: "statusSubmitted",
  graded: "statusGraded",
  needsReview: "statusNeedsReview",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function strOr(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function hasTs(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n < 1e12;
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string" || value === "" || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function msgOf(error) {
  if (error && typeof error.userMessage === "string") return error.userMessage;
  if (error && typeof error.message === "string") return error.message;
  return String(error);
}

const pad2 = (n) => String(n).padStart(2, "0");

function fmtDateTime(ts) {
  if (!hasTs(ts)) return t("education.timeUnknown");
  const d = new Date(Number(ts) * 1000);
  if (!Number.isFinite(d.getTime())) return t("education.timeUnknown");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtRange(start, end) {
  if (!hasTs(start)) return t("education.timeUnknown");
  const startDate = new Date(Number(start) * 1000);
  const startDay = `${startDate.getFullYear()}-${pad2(startDate.getMonth() + 1)}-${pad2(startDate.getDate())}`;
  const startClock = `${pad2(startDate.getHours())}:${pad2(startDate.getMinutes())}`;
  if (!hasTs(end)) return `${startDay} ${startClock}`;
  const endDate = new Date(Number(end) * 1000);
  const endDay = `${endDate.getFullYear()}-${pad2(endDate.getMonth() + 1)}-${pad2(endDate.getDate())}`;
  const endClock = `${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}`;
  return endDay === startDay
    ? `${startDay} ${startClock}–${endClock}`
    : `${startDay} ${startClock} – ${endDay} ${endClock}`;
}

function fmtBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return t("assignment.sizeUnknown");
  const units = ["B", "KiB", "MiB", "GiB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function basenameOf(path) {
  const text = String(path ?? "");
  const index = text.lastIndexOf("/");
  return index >= 0 ? text.slice(index + 1) : text;
}

/** 预览类型分组（file-preview.js 只区分 image/audio/video/文本/其余 iframe）。 */
function previewKindOf(name) {
  const ext = String(name ?? "")
    .split(".")
    .pop()
    ?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(ext))
    return "image";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (["md", "markdown", "txt", "csv", "json", "log"].includes(ext))
    return "doc";
  return "other";
}

function projectOf(data, projectId) {
  return (
    asArray(data && data.projects).find(
      (item) => item && item.id === projectId,
    ) || null
  );
}

function assessmentKindLabel(kind) {
  if (kind === "homework") return t("education.homeworkKind");
  if (kind === "weeklyExam") return t("education.kindWeeklyExam");
  if (kind === "mockExam") return t("education.kindMockExam");
  if (kind === "retest") return t("education.kindRetest");
  return strOr(kind);
}

function resourceKindLabel(kind) {
  const key = RESOURCE_KIND_COPY[kind];
  return key ? t(`education.${key}`) : strOr(kind);
}

/**
 * 任务 → 教学来源。作业/课程都经由 core 的 education.focusTasks 一对一关联
 * 到普通任务；老数据里也可能有 assessment.taskId 直接指向任务，作为兜底。
 *
 * 返回 `{ assessmentId, taskId }`、`{ lessonId, taskId }` 或 null；调用方据此
 * 决定走 TaskDialog（普通任务）还是本工作台（教学任务）。
 */
export function teachingTargetOf(data, task) {
  if (!task || typeof task !== "object") return null;
  const taskId = strOr(task.id);
  if (taskId === "") return null;
  const education = (data && data.education) || {};
  const link = asArray(education.focusTasks).find(
    (item) => item && item.taskId === taskId,
  );
  if (link) {
    const sourceId = strOr(link.sourceId);
    if (link.kind === "lesson") {
      const lesson = asArray(education.lessons).find(
        (item) => item && item.id === sourceId,
      );
      return lesson ? { lessonId: lesson.id, taskId } : null;
    }
    const assessment = asArray(education.assessments).find(
      (item) => item && item.id === sourceId,
    );
    return assessment ? { assessmentId: assessment.id, taskId } : null;
  }
  const byTask = asArray(education.assessments).find(
    (item) => item && item.taskId === taskId,
  );
  return byTask ? { assessmentId: byTask.id, taskId } : null;
}

function latestSubmissionOf(education, assessmentId) {
  let latest = null;
  for (const item of asArray(education.submissions)) {
    if (!item || item.assessmentId !== assessmentId) continue;
    if (
      latest === null ||
      numOr(item.submittedAt) >= numOr(latest.submittedAt)
    ) {
      latest = item;
    }
  }
  return latest;
}

function latestGradeOf(education, submissionId) {
  let latest = null;
  for (const item of asArray(education.grades)) {
    if (!item || item.submissionId !== submissionId) continue;
    if (latest === null || numOr(item.gradedAt) >= numOr(latest.gradedAt)) {
      latest = item;
    }
  }
  return latest;
}

function assessmentStateOf(assessment, submission, grade, at) {
  if (grade) return grade.needsReview === true ? "needsReview" : "graded";
  if (submission) return "submitted";
  if (assessment.kind !== "homework") {
    if (hasTs(assessment.stoppedAt)) return "awaiting";
    if (hasTs(assessment.startedAt)) return "inProgress";
    return "upcoming";
  }
  if (hasTs(assessment.endsAt) && at >= Number(assessment.endsAt))
    return "overdue";
  if (hasTs(assessment.startsAt) && at < Number(assessment.startsAt))
    return "upcoming";
  return "awaiting";
}

function statusChipOf(key, label) {
  const tone =
    key === "overdue" || key === "missed"
      ? "danger"
      : key === "needsReview" || key === "awaiting"
        ? "sun"
        : key === "inProgress"
          ? "brand"
          : key === "graded" || key === "attended"
            ? "leaf"
            : "neutral";
  return h(Chip, { tone }, label);
}

function errorBlock(message) {
  if (!message) return null;
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
        lineHeight: 1.6,
      },
    },
    message,
  );
}

function newSubmissionId() {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    )
      return crypto.randomUUID();
  } catch {
    /* 老浏览器退回时间戳 + 随机串 */
  }
  return `submission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AssignmentDialog({
  open = false,
  onClose,
  assessmentId = null,
  lessonId = null,
  data = null,
  today = "",
  now = null,
}) {
  const education = (data && data.education) || {};
  const assessments = asArray(education.assessments);
  const lessons = asArray(education.lessons);
  const assessment = assessmentId
    ? assessments.find((item) => item && item.id === assessmentId) || null
    : null;
  const lesson = lessonId
    ? lessons.find((item) => item && item.id === lessonId) || null
    : null;
  const subject = assessment || lesson;
  const projectId =
    subject && typeof subject.projectId === "string" ? subject.projectId : "";
  const project = projectOf(data, projectId);
  const projectStudy =
    asArray(education.projects).find(
      (item) => item && item.projectId === projectId,
    ) || null;
  const isExam = assessment !== null && assessment.kind !== "homework";
  const at =
    Number.isFinite(Number(now)) && Number(now) > 0
      ? Number(now)
      : Math.floor(Date.now() / 1000);

  const submission = assessment
    ? latestSubmissionOf(education, assessment.id)
    : null;
  const grade = submission ? latestGradeOf(education, submission.id) : null;

  const materialIds = assessment
    ? unique(
        asArray(assessment.questions).flatMap((question) =>
          asArray(question && question.sourceIds),
        ),
      )
    : unique(asArray(lesson && lesson.resourceIds));
  const relatedIds = projectStudy
    ? unique([
        projectStudy.syllabusId,
        ...asArray(projectStudy.pastPaperIds),
        ...asArray(projectStudy.mockPaperIds),
      ])
    : [];
  const submissionIds = submission
    ? unique(asArray(submission.resourceIds))
    : [];
  const infoIds = unique([...materialIds, ...relatedIds]);
  const infoKey = infoIds.join("|");

  const [access, setAccess] = useState("");
  const [tokenError, setTokenError] = useState(null);
  const [fetchedCatalog, setFetchedCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [fileInfo, setFileInfo] = useState({});
  const [answers, setAnswers] = useState("");
  const [unfinished, setUnfinished] = useState(false);
  const [pickedSheets, setPickedSheets] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [examBusy, setExamBusy] = useState(false);
  const [examError, setExamError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerApplied, setPickerApplied] = useState("");
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);
  const [pickerNoIndex, setPickerNoIndex] = useState(false);
  const [registeringPath, setRegisteringPath] = useState(null);
  const [progressDraft, setProgressDraft] = useState("");
  const [progressError, setProgressError] = useState(null);
  const [progressBusy, setProgressBusy] = useState(false);

  // 打开/换记录时清空草稿：作业 A 的答案不能带进作业 B，提交版本号也必须重发。
  useEffect(() => {
    if (!open) return;
    setAnswers("");
    setUnfinished(false);
    setPickedSheets([]);
    setSubmitError(null);
    setPendingId(null);
    setExamError(null);
    setPreview(null);
    setPickerOpen(false);
    setPickerQuery("");
    setPickerApplied("");
    setPickerItems([]);
    setPickerError(null);
    setPickerNoIndex(false);
    setRegisteringPath(null);
    setProgressDraft(
      lesson && typeof lesson.progress === "string" ? lesson.progress : "",
    );
    setProgressError(null);
  }, [open, assessmentId, lessonId]);

  // 文件令牌与资源目录：两者都是只读，失败互不影响（一个用于下载，一个用于标题）。
  useEffect(() => {
    if (!open || projectId === "") return undefined;
    let cancelled = false;
    setAccess("");
    setTokenError(null);
    setFetchedCatalog([]);
    setCatalogError(null);
    setLoadingCatalog(true);
    getFileToken({ timeoutMs: 5000 })
      .then((result) => {
        if (!cancelled)
          setAccess(result && result.access ? String(result.access) : "");
      })
      .catch((error) => {
        if (!cancelled) setTokenError(msgOf(error));
      });
    getStateWithResources({ timeoutMs: 8000 })
      .then((result) => {
        if (cancelled) return;
        const resources = asArray(
          result && result.data && result.data.education
            ? result.data.education.resources
            : null,
        );
        setFetchedCatalog(resources);
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(msgOf(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // 每条资料的大小/可预览性单独查：失败按未知处理，仍允许下载。
  useEffect(() => {
    if (!open || infoIds.length === 0) return undefined;
    let cancelled = false;
    const ids = infoIds;
    Promise.all(
      ids.map((id) =>
        getResourceInfo(id, { timeoutMs: 5000 })
          .then((info) => [id, info])
          .catch(() => [id, null]),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      const next = {};
      for (const [id, info] of pairs) if (info) next[id] = info;
      setFileInfo(next);
    });
    return () => {
      cancelled = true;
    };
    // infoKey 已经覆盖 ids 的内容；用字符串避免数组每次渲染都重新请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, infoKey]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const timer = setTimeout(() => setPickerApplied(pickerQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [pickerOpen, pickerQuery]);

  useEffect(() => {
    if (!pickerOpen || projectId === "" || pickerNoIndex) return undefined;
    let cancelled = false;
    setPickerLoading(true);
    setPickerError(null);
    getLibraryItems(
      { projectId, q: pickerApplied, limit: PICKER_LIMIT },
      { timeoutMs: 15000 },
    )
      .then((result) => {
        if (cancelled) return;
        if (result && result.hasIndex === false) {
          setPickerNoIndex(true);
          setPickerItems([]);
          return;
        }
        setPickerItems(
          asArray(result && result.items).filter(
            (item) => item && typeof item.path === "string" && item.path !== "",
          ),
        );
      })
      .catch((error) => {
        if (!cancelled) setPickerError(msgOf(error));
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, pickerApplied, projectId, pickerNoIndex]);

  // 快照里的 resources 默认是空数组；内联目录补上标题/kind，fetch 到的目录
  // 覆盖同 id（后者更新），两者合起来足以在没有后端明细的情况下渲染。
  const catalog = useMemo(() => {
    const map = new Map();
    for (const item of asArray(
      data && data.education ? data.education.resources : null,
    )) {
      if (item && typeof item.id === "string") map.set(item.id, item);
    }
    for (const item of fetchedCatalog) {
      if (item && typeof item.id === "string")
        map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    }
    return map;
  }, [data, fetchedCatalog]);

  const resourceOf = (id) =>
    catalog.get(id) || { id, projectId, title: id, kind: "", path: "" };
  const displayName = (resource) => {
    const info = fileInfo[resource.id];
    return (
      strOr(resource.title) ||
      strOr(info && info.name) ||
      basenameOf(resource.path) ||
      resource.id
    );
  };
  const answerSheets = Array.from(catalog.values())
    .filter(
      (item) =>
        item &&
        item.projectId === projectId &&
        item.kind === "answerSheet" &&
        typeof item.id === "string",
    )
    .sort((a, b) => strOr(a.title).localeCompare(strOr(b.title)));

  const materialRows = materialIds.map(resourceOf);
  const relatedRows = relatedIds
    .filter((id) => !materialIds.includes(id))
    .map(resourceOf);
  const attachmentRows = submissionIds.map(resourceOf);

  const lessonWindowOpen =
    lesson !== null &&
    hasTs(lesson.startsAt) &&
    hasTs(lesson.endsAt) &&
    at >= Number(lesson.startsAt) &&
    at < Number(lesson.endsAt);

  const resourceRow = (resource) => {
    const info = fileInfo[resource.id] || null;
    const name = displayName(resource);
    const previewable = info === null || info.canPreview !== false;
    const viewUrl =
      access !== "" && previewable
        ? resourceFileUrl(resource.id, access, false)
        : "";
    const downloadUrl =
      access !== "" ? resourceFileUrl(resource.id, access, true) : "";
    const fileHint =
      access === ""
        ? tokenError
          ? t("assignment.fileTokenFailed", { error: tokenError })
          : t("assignment.loading")
        : t("assignment.previewBlocked");
    return h(
      "div",
      { key: resource.id, style: ROW },
      h(Icon, {
        name: "folder",
        size: 15,
        style: { color: "var(--tomato-ink-3)", flex: "none" },
      }),
      h(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        h(
          "div",
          {
            style: {
              ...ELLIPSIS,
              fontSize: 12.5,
              color: "var(--tomato-ink)",
            },
          },
          name,
        ),
        h(
          "div",
          { style: META },
          resource.kind
            ? h(Chip, { tone: "neutral" }, resourceKindLabel(resource.kind))
            : null,
          h("span", { className: "t-mono" }, fmtBytes(info && info.sizeBytes)),
          resource.path
            ? h(
                "span",
                { className: "t-mono", style: ELLIPSIS, title: resource.path },
                resource.path,
              )
            : null,
        ),
      ),
      previewable && viewUrl
        ? h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "eye",
              onClick: () => setPreview(resource),
            },
            t("assignment.preview"),
          )
        : h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "eye",
              disabled: true,
              title: fileHint,
            },
            t("assignment.preview"),
          ),
      downloadUrl
        ? h(
            "a",
            {
              href: downloadUrl,
              title: t("assignment.download"),
              style: LINK_BTN,
              className: "t-root t-btn t-btn-ghost",
            },
            h(Icon, { name: "download", size: 15 }),
            t("assignment.download"),
          )
        : h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "download",
              disabled: true,
              title: fileHint,
            },
            t("assignment.download"),
          ),
    );
  };

  const openPicker = () => {
    setPickerOpen(true);
    setPickerQuery("");
    setPickerApplied("");
    setPickerItems([]);
    setPickerError(null);
    setPickerNoIndex(false);
  };

  const toggleSheet = (id) => {
    setPickedSheets((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
    setSubmitError(null);
  };

  const submit = async () => {
    if (busy || !assessment) return;
    const id = pendingId || newSubmissionId();
    setBusy(true);
    setSubmitError(null);
    const result = await tryDispatch({
      type: "education",
      command: {
        op: "submit",
        submission: {
          id,
          assessmentId: assessment.id,
          submittedAt: Math.floor(Date.now() / 1000),
          resourceIds: pickedSheets,
          answers,
          unfinished: !!unfinished,
          questionTimes: [],
        },
      },
    });
    setBusy(false);
    if (!result.ok) {
      // 同一个 id 留给下次重试：失败后换 id 会掩盖「已经写入」的情况。
      setPendingId(id);
      setSubmitError(result.error || t("common.writeFailed"));
      return;
    }
    setPendingId(null);
    setAnswers("");
    setPickedSheets([]);
    setUnfinished(false);
    notify(t("assignment.submitDone"), "brand");
  };

  const examOp = async (op) => {
    if (examBusy || !assessment) return;
    setExamBusy(true);
    setExamError(null);
    const result = await tryDispatch({
      type: "education",
      command: { op, id: assessment.id },
    });
    setExamBusy(false);
    if (!result.ok) setExamError(result.error || t("common.writeFailed"));
  };

  const saveProgress = async () => {
    if (progressBusy || !lesson) return;
    if (progressDraft.trim() === "") {
      setProgressError(t("assignment.progressRequired"));
      return;
    }
    setProgressBusy(true);
    setProgressError(null);
    const result = await tryDispatch({
      type: "education",
      command: { op: "attendLesson", id: lesson.id, progress: progressDraft },
    });
    setProgressBusy(false);
    if (!result.ok) {
      setProgressError(result.error || t("common.writeFailed"));
      return;
    }
    notify(t("assignment.progressSaved"), "brand");
  };

  const registerSheet = async (item) => {
    if (registeringPath !== null || !item) return;
    setRegisteringPath(strOr(item.path));
    setPickerError(null);
    try {
      const created = await registerResource(
        projectId,
        {
          title: strOr(item.name) || basenameOf(item.path),
          kind: "answerSheet",
          path: String(item.path),
          source: "",
          edition: "",
          topics: [],
        },
        { timeoutMs: 8000 },
      );
      const entry =
        created && created.resource ? created.resource : created || null;
      if (entry && typeof entry.id === "string") {
        setFetchedCatalog((current) => [
          ...current.filter((row) => row.id !== entry.id),
          entry,
        ]);
        setPickedSheets((current) => unique([...current, entry.id]));
      }
      setPickerOpen(false);
      notify(t("assignment.registered"), "brand");
    } catch (error) {
      setPickerError(t("assignment.registerFailed", { error: msgOf(error) }));
    } finally {
      setRegisteringPath(null);
    }
  };

  if (!open) return null;

  if (!subject) {
    return h(
      Modal,
      {
        open,
        onClose,
        icon: "tasks",
        title: t("assignment.missingTitle"),
        footer: h(
          "div",
          { style: { display: "flex", justifyContent: "flex-end" } },
          h(
            Btn,
            { variant: "plain", size: "sm", onClick: onClose },
            t("common.close"),
          ),
        ),
      },
      h(Empty, {
        icon: "search",
        title: t("assignment.missingTitle"),
        hint: t("assignment.missingHint"),
      }),
    );
  }

  const kindLabel = assessment
    ? assessmentKindLabel(assessment.kind)
    : t("education.lessonKind");
  const statusKey = assessment
    ? assessmentStateOf(assessment, submission, grade, at)
    : lesson.attended === true
      ? "attended"
      : lesson.state === "missed"
        ? "missed"
        : "upcoming";
  const statusLabel = assessment
    ? ASSESSMENT_STATUS_COPY[statusKey]
      ? t(`education.${ASSESSMENT_STATUS_COPY[statusKey]}`)
      : statusKey
    : statusKey === "attended"
      ? t("assignment.lessonAttended")
      : statusKey === "missed"
        ? t("education.statusMissed")
        : t("assignment.lessonUpcoming");

  const canSubmit = assessment !== null && submission === null;
  const examStarted = assessment !== null && hasTs(assessment.startedAt);
  const examStopped = assessment !== null && hasTs(assessment.stoppedAt);
  const examPrintable = assessment !== null && hasTs(assessment.printedAt);
  const submitDisabled =
    busy ||
    (isExam && !examStopped) ||
    (assessment !== null && submission !== null);

  const header = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10 } },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
        },
      },
      h(
        Chip,
        { tone: isExam ? "sun" : assessment ? "brand" : "leaf", icon: "tasks" },
        kindLabel,
      ),
      h(
        Chip,
        {
          tone: "neutral",
          icon: "clock",
          style: { fontVariantNumeric: "tabular-nums" },
        },
        fmtRange(subject.startsAt, subject.endsAt),
      ),
      project
        ? h(
            Chip,
            { tone: "neutral", icon: "folder" },
            strOr(project.name, projectId),
          )
        : null,
      statusChipOf(statusKey, statusLabel),
    ),
    assessment && strOr(assessment.instructions) !== ""
      ? h(
          "div",
          {
            style: {
              padding: "10px 13px",
              borderRadius: 11,
              background: "var(--tomato-surface-2)",
              fontSize: 12.5,
              lineHeight: 1.7,
              color: "var(--tomato-ink-2)",
              whiteSpace: "pre-wrap",
            },
          },
          h(
            "div",
            {
              style: {
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".04em",
                color: "var(--tomato-ink-3)",
                marginBottom: 4,
              },
            },
            t("assignment.instructions"),
          ),
          assessment.instructions,
        )
      : null,
    lesson && asArray(lesson.topics).length > 0
      ? h(
          "div",
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 5,
            },
          },
          h(
            "span",
            { style: { fontSize: 11.5, color: "var(--tomato-ink-3)" } },
            t("assignment.topics"),
          ),
          asArray(lesson.topics).map((topic, index) =>
            h(Chip, { key: index, tone: "neutral" }, strOr(topic)),
          ),
        )
      : null,
  );

  let materialsBody;
  if (loadingCatalog && materialRows.length === 0) {
    materialsBody = h("div", { style: MUTED }, t("assignment.loading"));
  } else if (materialRows.length === 0) {
    materialsBody = h(Empty, {
      icon: "folder",
      title: assessment
        ? t("assignment.materialsEmpty")
        : t("assignment.lessonMaterialsEmpty"),
      style: { padding: "22px 12px" },
    });
  } else {
    materialsBody = h("div", null, materialRows.map(resourceRow));
  }

  const materialsSection = h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 4 } },
    h(SectionTitle, {
      icon: "folder",
      title: assessment
        ? t("assignment.materialsHomework")
        : t("assignment.materialsLesson"),
      hint: t("assignment.materialsHint"),
    }),
    materialsBody,
    catalogError
      ? errorBlock(t("assignment.loadFailed", { error: catalogError }))
      : null,
  );

  const relatedSection =
    relatedRows.length === 0
      ? null
      : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 4 } },
          h(SectionTitle, {
            icon: "tag",
            title: t("assignment.related"),
            hint: t("assignment.relatedHint"),
          }),
          h("div", null, relatedRows.map(resourceRow)),
        );

  const tokenNote = tokenError
    ? errorBlock(t("assignment.fileTokenFailed", { error: tokenError }))
    : null;

  const examSection = !isExam
    ? null
    : h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 10 } },
        h(SectionTitle, {
          icon: "timer",
          title: t("assignment.examTitle"),
        }),
        h(
          "div",
          { style: MUTED },
          !examStarted
            ? t("assignment.examStartHint")
            : !examStopped
              ? t("assignment.examRunning")
              : t("assignment.examStopped"),
        ),
        !examPrintable && !examStarted
          ? errorBlock(t("assignment.examNotPrinted"))
          : null,
        examStarted && !examStopped
          ? h(
              "div",
              { style: MUTED },
              t("assignment.examStartedAt", {
                time: fmtDateTime(assessment.startedAt),
              }),
            )
          : null,
        examStopped
          ? h(
              "div",
              { style: MUTED },
              t("assignment.examStartedAt", {
                time: fmtDateTime(assessment.startedAt),
              }),
              " · ",
              t("assignment.examStoppedAt", {
                time: fmtDateTime(assessment.stoppedAt),
              }),
            )
          : null,
        !examStarted
          ? h(
              "div",
              null,
              h(
                Btn,
                {
                  variant: "soft",
                  size: "md",
                  icon: "play",
                  disabled: examBusy || !examPrintable,
                  title: examPrintable
                    ? t("assignment.examStartHint")
                    : t("assignment.examNotPrinted"),
                  onClick: () => examOp("startExam"),
                },
                t("assignment.examStart"),
              ),
            )
          : !examStopped
            ? h(
                "div",
                null,
                h(
                  Btn,
                  {
                    variant: "soft",
                    size: "md",
                    icon: "stop",
                    disabled: examBusy,
                    onClick: () => examOp("endExam"),
                  },
                  t("assignment.examStop"),
                ),
              )
            : null,
        errorBlock(examError),
      );

  let submissionSection = null;
  if (assessment && submission !== null) {
    submissionSection = h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 10 } },
      h(SectionTitle, {
        icon: "check",
        title: t("assignment.submission"),
        hint: t("assignment.submittedAt", {
          time: fmtDateTime(submission.submittedAt),
        }),
      }),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
        continuationGrade(grade),
        submission.unfinished === true
          ? h(
              Chip,
              { tone: "sun", icon: "clock" },
              t("assignment.unfinishedTag"),
            )
          : null,
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 5 } },
        h(
          "div",
          {
            style: {
              fontSize: 12,
              fontWeight: 550,
              color: "var(--tomato-ink-2)",
            },
          },
          t("assignment.answers"),
        ),
        strOr(submission.answers) === ""
          ? h("div", { style: MUTED }, t("assignment.answersEmpty"))
          : h(
              "div",
              {
                className: "t-scroll",
                style: {
                  maxHeight: 180,
                  overflowY: "auto",
                  padding: "10px 13px",
                  borderRadius: 10,
                  background: "var(--tomato-surface-2)",
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  color: "var(--tomato-ink-2)",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                },
              },
              submission.answers,
            ),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 5 } },
        h(
          "div",
          {
            style: {
              fontSize: 12,
              fontWeight: 550,
              color: "var(--tomato-ink-2)",
            },
          },
          t("assignment.attachments"),
        ),
        attachmentRows.length === 0
          ? h("div", { style: MUTED }, t("assignment.attachmentsEmpty"))
          : h("div", null, attachmentRows.map(resourceRow)),
      ),
      h("div", { style: MUTED }, t("assignment.lockedHint")),
      errorBlock(submitError),
    );
  } else if (assessment) {
    submissionSection = h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 12 } },
      h(SectionTitle, {
        icon: "upload",
        title: t("assignment.submission"),
        hint: t("assignment.lockedHint"),
      }),
      h(
        Field,
        {
          label: t("assignment.answerLabel"),
          hint: t("assignment.answerCount", { n: answers.length }),
        },
        h(TextArea, {
          value: answers,
          rows: 5,
          placeholder: t("assignment.answerPlaceholder"),
          onChange: (value) => {
            setAnswers(String(value ?? "").slice(0, MAX_ANSWERS));
            setSubmitError(null);
          },
        }),
      ),
      h(Toggle, {
        checked: unfinished,
        onChange: setUnfinished,
        label: t("assignment.unfinished"),
      }),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 7 } },
        h(
          "div",
          {
            style: {
              fontSize: 12,
              fontWeight: 550,
              color: "var(--tomato-ink-2)",
            },
          },
          t("assignment.answerSheets"),
        ),
        h("div", { style: MUTED }, t("assignment.answerSheetsHint")),
        answerSheets.length === 0
          ? h("div", { style: MUTED }, t("assignment.answerSheetsEmpty"))
          : h(
              "div",
              null,
              answerSheets.map((resource) =>
                h(
                  "div",
                  {
                    key: resource.id,
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 38,
                      padding: "4px 2px",
                      borderBottom: "1px solid var(--tomato-line)",
                    },
                  },
                  h(Check, {
                    checked: pickedSheets.includes(resource.id),
                    label: displayName(resource),
                    onChange: () => toggleSheet(resource.id),
                  }),
                  h(
                    "div",
                    { style: { flex: 1, minWidth: 0 } },
                    h(
                      "div",
                      { style: { ...ELLIPSIS, fontSize: 12.5 } },
                      displayName(resource),
                    ),
                    resource.path
                      ? h(
                          "div",
                          {
                            className: "t-mono",
                            style: { ...META, marginTop: 1 },
                          },
                          resource.path,
                        )
                      : null,
                  ),
                ),
              ),
            ),
        h(
          "div",
          null,
          h(
            Btn,
            {
              variant: "ghost",
              size: "sm",
              icon: "plus",
              onClick: openPicker,
            },
            t("assignment.registerSheet"),
          ),
        ),
      ),
      errorBlock(submitError),
    );
  }

  const lessonSection = lesson
    ? h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 10 } },
        h(SectionTitle, {
          icon: "education",
          title: t("assignment.lessonProgress"),
          hint:
            lesson.attended === true
              ? t("assignment.lessonAttended")
              : t("assignment.progressWindow"),
        }),
        strOr(lesson.progress) === ""
          ? h("div", { style: MUTED }, t("assignment.lessonProgressEmpty"))
          : h(
              "div",
              {
                style: {
                  padding: "10px 13px",
                  borderRadius: 10,
                  background: "var(--tomato-surface-2)",
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  color: "var(--tomato-ink-2)",
                  whiteSpace: "pre-wrap",
                },
              },
              lesson.progress,
            ),
        h(TextArea, {
          value: progressDraft,
          rows: 3,
          placeholder: t("assignment.progressPlaceholder"),
          onChange: (value) => {
            setProgressDraft(String(value ?? ""));
            setProgressError(null);
          },
        }),
        !lessonWindowOpen
          ? h("div", { style: MUTED }, t("assignment.progressWindow"))
          : null,
        h(
          "div",
          null,
          h(
            Btn,
            {
              variant: "primary",
              size: "md",
              icon: "check",
              disabled: progressBusy || !lessonWindowOpen,
              onClick: saveProgress,
            },
            progressBusy
              ? t("assignment.savingProgress")
              : t("assignment.saveProgress"),
          ),
        ),
        errorBlock(progressError),
      )
    : null;

  const footer = h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 9, width: "100%" } },
    h(
      "div",
      { style: { flex: 1, fontSize: 11.5, color: "var(--tomato-ink-3)" } },
      isExam && !examStopped ? t("assignment.examRunning") : "",
    ),
    h(
      Btn,
      {
        variant: "plain",
        size: "sm",
        onClick: onClose,
        disabled: busy,
      },
      t("common.close"),
    ),
    canSubmit
      ? h(
          Btn,
          {
            variant: "primary",
            size: "sm",
            icon: "check",
            disabled: submitDisabled,
            title:
              isExam && !examStopped
                ? t("assignment.examRunning")
                : t("assignment.lockedHint"),
            onClick: submit,
          },
          busy
            ? t("assignment.submitting")
            : isExam
              ? t("assignment.submitExam")
              : t("assignment.submitHomework"),
        )
      : null,
  );

  return h(
    "div",
    null,
    h(
      Modal,
      {
        open,
        onClose: () => {
          if (!busy && !progressBusy) onClose?.();
        },
        icon: isExam ? "timer" : assessment ? "tasks" : "education",
        title: strOr(subject.title, kindLabel),
        subtitle: `${kindLabel} · ${fmtRange(subject.startsAt, subject.endsAt)}`,
        width: 760,
        footer,
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 16 } },
        header,
        materialsSection,
        relatedSection,
        tokenNote,
        examSection ? h(Divider, null) : null,
        examSection,
        submissionSection ? h(Divider, null) : null,
        submissionSection,
        lessonSection ? h(Divider, null) : null,
        lessonSection,
      ),
    ),
    h(FilePreview, {
      open: preview !== null,
      onClose: () => setPreview(null),
      name: preview ? displayName(preview) : "",
      kind: preview ? previewKindOf(displayName(preview)) : "other",
      sizeBytes: preview ? fileInfo[preview.id]?.sizeBytes : undefined,
      viewUrl:
        preview && access !== ""
          ? resourceFileUrl(preview.id, access, false)
          : "",
      downloadUrl:
        preview && access !== ""
          ? resourceFileUrl(preview.id, access, true)
          : "",
      previewable:
        preview === null ||
        fileInfo[preview.id] === undefined ||
        fileInfo[preview.id].canPreview !== false,
      emptyHint: t("assignment.previewBlocked"),
    }),
    pickerOpen
      ? h(
          Modal,
          {
            open: pickerOpen,
            onClose:
              registeringPath === null ? () => setPickerOpen(false) : undefined,
            icon: "search",
            title: t("assignment.pickerTitle"),
            subtitle: t("assignment.pickerSubtitle"),
            width: 680,
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 10 } },
            h(Input, {
              value: pickerQuery,
              onChange: (value) => setPickerQuery(String(value ?? "")),
              placeholder: t("assignment.pickerSearch"),
              maxLength: 120,
            }),
            pickerError ? errorBlock(pickerError) : null,
            pickerNoIndex
              ? h("div", { style: MUTED }, t("assignment.pickerNoIndex"))
              : null,
            pickerLoading
              ? h("div", { style: MUTED }, t("assignment.loading"))
              : pickerItems.length === 0
                ? h(Empty, {
                    icon: "folder",
                    title: t("assignment.pickerEmpty"),
                  })
                : h(
                    "div",
                    {
                      className: "t-scroll",
                      style: { maxHeight: 360, overflowY: "auto" },
                    },
                    pickerItems.map((item, index) =>
                      h(
                        "div",
                        {
                          key: strOr(item.path) || index,
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 2px",
                            borderBottom: "1px solid var(--tomato-line)",
                          },
                        },
                        h(
                          "div",
                          { style: { flex: 1, minWidth: 0 } },
                          h(
                            "div",
                            { style: { ...ELLIPSIS, fontSize: 12.5 } },
                            strOr(item.name) || basenameOf(item.path),
                          ),
                          h(
                            "div",
                            {
                              className: "t-mono",
                              style: { ...META, marginTop: 1 },
                            },
                            strOr(item.path),
                            item.sizeBytes
                              ? ` · ${fmtBytes(item.sizeBytes)}`
                              : "",
                          ),
                        ),
                        h(
                          Btn,
                          {
                            variant: "soft",
                            size: "sm",
                            icon: "plus",
                            disabled: registeringPath !== null,
                            onClick: () => registerSheet(item),
                          },
                          registeringPath === strOr(item.path)
                            ? t("assignment.registering")
                            : t("assignment.register"),
                        ),
                      ),
                    ),
                  ),
          ),
        )
      : null,
  );
}

/** 提交后的批改状态：已批改附带时间，待复核单独标色。 */
function continuationGrade(grade) {
  if (!grade)
    return h(
      Chip,
      { tone: "sun", icon: "clock" },
      t("assignment.waitingGrade"),
    );
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
    h(
      Chip,
      { tone: "leaf", icon: "check" },
      t("assignment.gradedAt", { time: fmtDateTime(grade.gradedAt) }),
    ),
    grade.needsReview === true
      ? h(Chip, { tone: "sun", icon: "bell" }, t("assignment.needsReview"))
      : null,
  );
}
