import { agentCall, dispatch, saveAgentFile, getSnapshot } from "./api";
import type { Snapshot, Project } from "./types";
import { invoke, isTauri } from "@tauri-apps/api/core";
export interface ProjectStudy {
  projectId: string;
  directory: string;
  examMode: boolean;
  visionId: string | null;
  target: string;
  examDate: string | null;
  syllabusId: string | null;
  pastPaperIds: string[];
  mockPaperIds: string[];
}
export interface Resource {
  id: string;
  projectId: string;
  title: string;
  kind: string;
  path: string;
  source: string;
  edition: string;
  topics: string[];
}
export interface Semester {
  id: string;
  projectId: string;
  title: string;
  startDate: string;
  endDate: string;
  revision: number;
  baseline: string;
  evidence: string[];
  rationale: string;
  milestones: {
    week: number;
    topics: string[];
    resourceIds: string[];
    objective: string;
    lessonCount: number;
  }[];
}
export interface Lesson {
  id: string;
  projectId: string;
  semesterId: string;
  semesterRevision: number;
  title: string;
  topics: string[];
  resourceIds: string[];
  startsAt: number;
  endsAt: number;
  aiEnabled: boolean;
  attended: boolean;
  progress: string;
  state: string;
}
export interface Question {
  id: string;
  prompt: string;
  topics: string[];
  sourceIds: string[];
  extension: boolean;
  estimatedMinutes: number;
  answer: string;
  acceptableAlternatives: string;
  scoring: { id: string; description: string; points: number }[];
}
export interface Assessment {
  id: string;
  projectId: string;
  semesterId: string;
  semesterRevision: number;
  lessonId: string | null;
  title: string;
  kind: string;
  revision: number;
  startsAt: number;
  endsAt: number;
  instructions: string;
  reviewEvidence: string;
  questions: Question[];
  publishedAt: number;
  printedAt: number | null;
  startedAt: number | null;
  stoppedAt: number | null;
}
export interface Submission {
  id: string;
  assessmentId: string;
  submittedAt: number;
  resourceIds: string[];
  answers: string;
  unfinished: boolean;
  questionTimes: { questionId: string; localTime: string }[];
}
export interface Grade {
  id: string;
  submissionId: string;
  assessmentRevision: number;
  gradedAt: number;
  awards: {
    questionId: string;
    pointId: string;
    awarded: number;
    evidence: string;
  }[];
  errors: {
    questionId: string;
    cause: string;
    evidence: string;
    correction: string;
    nextCheck: string;
    retestDate: string;
    confirmed: boolean;
  }[];
  needsReview: boolean;
  feedback: string;
}
export interface Review {
  id: string;
  date: string;
  projectId: string;
  gradeIds: string[];
  findings: string;
  actions: string[];
}
export interface Education {
  projects: ProjectStudy[];
  resources: Resource[];
  semesters: Semester[];
  semesterHistory: Semester[];
  lessons: Lesson[];
  assessments: Assessment[];
  submissions: Submission[];
  grades: Grade[];
  reviews: Review[];
  events: {
    id: string;
    projectId: string;
    kind: string;
    sourceId: string;
    state: string;
    createdAt: number;
  }[];
}
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const when = (n: number) =>
  new Date(n * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const kinds: Record<string, string> = {
  syllabus: "考纲",
  course: "课程",
  book: "教材",
  pastPaper: "真题",
  mockPaper: "模拟题",
  reference: "参考资料",
  attachment: "聊天资料",
  answerSheet: "答题卡",
};
export async function chooseProjectDirectory(): Promise<string | null> {
  return isTauri() ? invoke<string | null>("choose_project_directory") : null;
}
export function educationCard(snapshot: Snapshot, project: Project): string {
  const e = snapshot.data.education,
    p = e.projects.find((p) => p.projectId === project.id),
    rs = e.resources.filter((r) => r.projectId === project.id);
  const options = (kind: string, ids: string[]) =>
    rs
      .filter((r) => r.kind === kind)
      .map(
        (r) =>
          `<option value="${esc(r.id)}" ${ids.includes(r.id) ? "selected" : ""}>${esc(r.title)}</option>`,
      )
      .join("");
  const lessons = e.lessons
    .filter((l) => l.projectId === project.id)
    .sort((a, b) => a.startsAt - b.startsAt);
  const assessments = e.assessments
    .filter((a) => a.projectId === project.id)
    .sort((a, b) => b.startsAt - a.startsAt);
  const review = e.reviews.filter((r) => r.projectId === project.id).slice(-3);
  const today = e.assessments.filter(
    (a) =>
      a.kind === "homework" &&
      new Date(a.startsAt * 1000).toLocaleDateString() ===
        new Date(snapshot.serverTime * 1000).toLocaleDateString(),
  );
  const minutes = today
    .flatMap((a) => a.questions)
    .reduce((n, q) => n + q.estimatedMinutes, 0);
  return `<section class="card education-card" data-study-project="${esc(project.id)}"><div class="card-heading"><h2>项目资料与应试教学</h2><button class="button secondary small-button" data-teaching-request="${esc(project.id)}">让助手备课</button></div><p>资料目录：${esc(p?.directory || "尚未绑定，上传和教学前必须授权")} <button class="text-button" data-study-directory="${esc(project.id)}">选择 / 重新授权</button></p>
 ${
   p
     ? `<details><summary>${p.examMode ? "应试模式已开启" : "配置应试模式"}</summary><form class="study-config" data-project="${esc(project.id)}"><label class="form-field"><span>愿景（必选）</span><select name="visionId"><option value="">请选择</option>${snapshot.data.visions.map((v) => `<option value="${esc(v.id)}" ${p.visionId === v.id ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label><label class="form-field"><span>院校、专业、考试年份、科目及目标分数</span><textarea name="target">${esc(p.target)}</textarea></label><label class="form-field"><span>考试日期</span><input type="date" name="examDate" value="${esc(p.examDate)}"></label><label class="form-field"><span>考纲</span><select name="syllabusId"><option value="">请选择</option>${options("syllabus", p.syllabusId ? [p.syllabusId] : [])}</select></label><div class="form-grid"><label class="form-field"><span>真题（可多选）</span><select name="pastPaperIds" multiple>${options("pastPaper", p.pastPaperIds)}</select></label><label class="form-field"><span>模拟题（可多选）</span><select name="mockPaperIds" multiple>${options("mockPaper", p.mockPaperIds)}</select></label></div><label><input type="checkbox" name="examMode" ${p.examMode ? "checked" : ""}>开启应试模式，作业由助手生成</label><button class="button secondary" type="submit">保存教学配置</button></form></details><div class="button-row"><label class="form-field"><span>导入资料类型</span><select class="study-resource-kind">${Object.entries(
         kinds,
       )
         .map(([k, v]) => `<option value="${k}">${v}</option>`)
         .join(
           "",
         )}</select></label><label class="button secondary">导入资料<input class="study-upload" type="file" multiple hidden data-project="${esc(project.id)}"></label></div>`
     : ""
 }
 <details><summary>项目资源 ${rs.length}</summary>${rs.map((r) => `<p><strong>${esc(r.title)}</strong> · ${esc(kinds[r.kind] || r.kind)}<br><small>${esc(r.path)} · ${esc(r.source)}</small></p>`).join("") || "<p>还没有资料。</p>"}</details>
 <details><summary>学期进度计划</summary>${
   e.semesters
     .filter((s) => s.projectId === project.id)
     .map(
       (s) =>
         `<article><h3>${esc(s.title)} · v${s.revision}</h3><p>${esc(s.startDate)} — ${esc(s.endDate)}</p><p>起点：${esc(s.baseline)}</p><p>${esc(s.rationale)}</p>${s.evidence.map((x) => `<p>依据：${esc(x)}</p>`).join("")}${s.milestones.map((m) => `<p>第${m.week}周 · ${m.lessonCount}节 · ${esc(m.topics.join("、"))}<br>${esc(m.objective)}</p>`).join("")}</article>`,
     )
     .join("") || "<p>请让助手核对考纲、资源和学情后制定学期计划。</p>"
 }</details>
 <p>今日全科作业供给：${minutes} / 180 分钟（估时）；19:00–22:00 晚间作业，22:00 收取，次日08:30复盘。</p>
 <details open><summary>课程 ${lessons.length} · 每节45分钟</summary>${
   lessons
     .slice(-30)
     .map(
       (l) =>
         `<article class="study-row"><strong>${esc(l.title)}</strong><p>${when(l.startsAt)} — ${when(l.endsAt)} · ${esc({ planned: "待上课", active: "上课中", ended: "已下课", missed: "缺课" }[l.state] || l.state)} · ${esc(l.topics.join("、"))}</p>${l.state === "active" ? `<button class="button secondary small-button" data-attend-lesson="${esc(l.id)}">${l.attended ? "更新学习进度" : "确认参与课程"}</button>` : ""}<p>${esc(l.progress)}</p></article>`,
     )
     .join("") || "<p>暂无课程。</p>"
 }</details>
 <details open><summary>作业与考试 ${assessments.length}</summary>${
   assessments
     .slice(0, 20)
     .map((a) => {
       const subs = e.submissions.filter((s) => s.assessmentId === a.id),
         grades = e.grades.filter((g) =>
           subs.some((s) => s.id === g.submissionId),
         );
       return `<article class="study-row"><h3>${esc(a.title)} · ${a.kind === "homework" ? "作业" : a.kind === "weeklyExam" ? "周考" : "全真模拟"}</h3><p>${when(a.startsAt)} — ${when(a.endsAt)}${a.stoppedAt ? " · 已到点，请停笔" : ""}</p><p>${esc(a.instructions)}</p><details><summary>查看题目</summary>${a.questions.map((q) => `<p><strong>${esc(q.id)}${q.extension ? "（拓展）" : ""}</strong> ${esc(q.prompt)}</p>`).join("")}</details><div class="button-row"><button class="button secondary small-button" data-paper="${esc(a.id)}">下载可打印试卷和答题卡</button>${a.kind !== "homework" ? `<button class="button secondary small-button" data-printed="${esc(a.id)}">${a.printedAt ? "已确认打印" : "确认打印完成"}</button>${!a.startedAt ? `<button class="button secondary small-button" data-exam-start="${esc(a.id)}">开始考试</button>` : ""}` : ""}${a.kind === "homework" || a.stoppedAt ? `<button class="button secondary small-button" data-study-submit="${esc(a.id)}">提交答案 / 答题卡</button>` : ""}</div><p>${subs.length}次提交 · ${grades.length}次批改</p>${grades.map((g) => `<details><summary>${g.needsReview ? "待复核" : "已批改"} · ${g.awards.reduce((n, p) => n + p.awarded, 0)}分</summary><p>${esc(g.feedback)}</p>${g.awards.map((p) => `<p>${esc(p.questionId)} / ${esc(p.pointId)}：${p.awarded}分 · ${esc(p.evidence)}</p>`).join("")}${g.errors.map((x) => `<p><strong>${esc(x.questionId)}：${esc(x.cause)}${x.confirmed ? "" : "（待确认）"}</strong><br>证据：${esc(x.evidence)}<br>纠正：${esc(x.correction)}<br>下次检查：${esc(x.nextCheck)}<br>复测：${esc(x.retestDate)}</p>`).join("")}</details>`).join("")}</article>`;
     })
     .join("") || "<p>课程结束后，助手根据已学进度准备作业。</p>"
 }</details>
 <details><summary>每日复盘</summary>${review.map((r) => `<p>${esc(r.date)}：${esc(r.findings)}</p><ul>${r.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`).join("") || "<p>暂无复盘。</p>"}</details><details><summary>教学事件</summary>${e.events
   .filter((x) => x.projectId === project.id)
   .slice(-15)
   .map(
     (x) =>
       `<p>${esc(x.kind)} · ${esc(x.state)} ${x.state !== "done" ? `<button class="text-button" data-event-retry="${esc(x.id)}">${x.state === "running" ? "中断后重新执行" : "请求执行"}</button>` : ""}</p>`,
   )
   .join("")}</details></section>`;
}
export function printablePaper(a: Assessment): string {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(a.title)}</title><style>body{font:16px serif;line-height:1.7;margin:20mm}article{break-inside:avoid;margin-bottom:18mm}section{break-before:page}.space{height:65mm;border-bottom:1px solid #aaa}small{display:block}</style><h1>${esc(a.title)}</h1><p>试卷ID：${esc(a.id)} · v${a.revision} · ${when(a.startsAt)} — ${when(a.endsAt)}</p><p>${esc(a.instructions)}</p>${a.questions.map((q) => `<article><h2>${esc(q.id)}${q.extension ? "（拓展）" : ""}（${q.scoring.reduce((n, p) => n + p.points, 0)}分）</h2><p style="white-space:pre-wrap">${esc(q.prompt)}</p></article>`).join("")}<section><h1>答题卡</h1><p>姓名：____________　试卷：${esc(a.id)}　日期：____________</p><p>每题完成后记录本机显示的当地时刻，精确到时、分；考试结束立即停笔并拍照上传。</p>${a.questions.map((q) => `<article><h2>${esc(q.id)}</h2><small>完成时刻：____:____　返回修改时刻：____:____</small><div class="space"></div></article>`).join("")}</section></html>`;
}
export function mountEducation(
  snapshot: Snapshot,
  hooks: {
    accept: (s: Snapshot) => void;
    toast: (s: string) => void;
    ask: (s: string) => void;
    modal: (s: string) => void;
    close: () => void;
  },
): void {
  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
    } catch (e) {
      hooks.toast(String(e));
    }
  };
  const command = async (command: Record<string, unknown>) =>
    hooks.accept(await dispatch({ type: "education", command }));
  document
    .querySelectorAll<HTMLFormElement>(".study-config")
    .forEach((form) => {
      form.onsubmit = (e) => {
        e.preventDefault();
        void run(async () => {
          const f = new FormData(form),
            old = snapshot.data.education.projects.find(
              (p) => p.projectId === form.dataset.project,
            )!;
          await command({
            op: "saveProject",
            project: {
              ...old,
              visionId: f.get("visionId") || null,
              target: String(f.get("target")),
              examDate: f.get("examDate") || null,
              syllabusId: f.get("syllabusId") || null,
              pastPaperIds: f.getAll("pastPaperIds"),
              mockPaperIds: f.getAll("mockPaperIds"),
              examMode: f.has("examMode"),
            },
          });
          hooks.toast("教学配置已保存");
        });
      };
    });
  const bind = (selector: string, fn: (el: HTMLElement) => Promise<unknown>) =>
    document
      .querySelectorAll<HTMLElement>(selector)
      .forEach((el) => (el.onclick = () => void run(() => fn(el))));
  bind("[data-study-directory]", async (el) => {
    let directory = await chooseProjectDirectory();
    if (!isTauri())
      directory = prompt("输入并授权此项目的资料目录（本机绝对路径）");
    if (directory)
      hooks.accept(
        await agentCall<Snapshot>({
          op: "authorize_project_directory",
          projectId: el.dataset.studyDirectory,
          directory,
        }),
      );
  });
  bind("[data-teaching-request]", async (el) =>
    hooks.ask(
      `请读取 exam-teaching 技能，为项目 ${el.dataset.teachingRequest} 核对愿景、考纲、真题、模拟题和资源。结合学情与联网查证的同科目经验，制定有依据的学期进度并安排课程、周末周考。跨项目每天上午4节、下午2至4节，每节45分钟；19–22点为全科作业，22点提交、次日08:30复盘。缺少条件先向我补齐。`,
    ),
  );
  bind("[data-attend-lesson]", async (el) => {
    const progress = prompt("记录当前学习进度（下课后仍以实际进度为准）");
    if (progress !== null)
      await command({
        op: "attendLesson",
        id: el.dataset.attendLesson,
        progress,
      });
  });
  bind("[data-paper]", async (el) => {
    const a = snapshot.data.education.assessments.find(
      (a) => a.id === el.dataset.paper,
    )!;
    await saveAgentFile(printablePaper(a), `${a.title}.html`, "text/html");
  });
  bind("[data-printed]", async (el) =>
    command({ op: "confirmPrinted", id: el.dataset.printed }),
  );
  bind("[data-exam-start]", async (el) =>
    command({ op: "startExam", id: el.dataset.examStart }),
  );
  bind("[data-event-retry]", async (el) =>
    command({ op: "retryEvent", id: el.dataset.eventRetry }),
  );
  bind("[data-study-submit]", async (el) => {
    const a = snapshot.data.education.assessments.find(
      (a) => a.id === el.dataset.studySubmit,
    )!;
    hooks.modal(
      `<h2>提交 ${esc(a.title)}</h2><form id="study-submit-form"><label class="form-field"><span>文字答案 / 提交说明</span><textarea name="answers"></textarea></label><label class="form-field"><span>上传答题卡照片或文件</span><input type="file" name="files" multiple></label>${a.questions.map((q) => `<label class="form-field"><span>${esc(q.id)} 完成时刻（本机HH:MM）</span><input type="time" name="time:${esc(q.id)}"></label>`).join("")}<label><input type="checkbox" name="unfinished">本次未完成</label><div class="modal-actions"><button type="button" id="study-submit-cancel" class="button secondary">取消</button><button class="button primary" type="submit">提交并等待批改</button></div></form>`,
    );
    document.getElementById("study-submit-cancel")!.onclick = hooks.close;
    const form = document.querySelector<HTMLFormElement>("#study-submit-form")!;
    form.onsubmit = (e) => {
      e.preventDefault();
      void run(async () => {
        const f = new FormData(form),
          ids: string[] = [];
        for (const file of f.getAll("files"))
          if (file instanceof File && file.size) {
            const r = await upload(file, a.projectId);
            ids.push(r.id);
          }
        await command({
          op: "submit",
          submission: {
            id: crypto.randomUUID(),
            assessmentId: a.id,
            submittedAt: 0,
            resourceIds: ids,
            answers: String(f.get("answers")),
            unfinished: f.has("unfinished"),
            questionTimes: a.questions
              .filter((q) => f.get(`time:${q.id}`))
              .map((q) => ({
                questionId: q.id,
                localTime: f.get(`time:${q.id}`),
              })),
          },
        });
        hooks.close();
      });
    };
  });
  document.querySelectorAll<HTMLInputElement>(".study-upload").forEach(
    (input) =>
      (input.onchange = () =>
        void run(async () => {
          const kind = input
            .closest(".education-card")!
            .querySelector<HTMLSelectElement>(".study-resource-kind")!.value;
          for (const file of Array.from(input.files || [])) {
            const attachment = await upload(file, input.dataset.project!);
            const fresh = await getSnapshot();
            const resource = fresh.data.education.resources.find(
              (r) => r.id === attachment.id,
            )!;
            await command({
              op: "saveResource",
              resource: { ...resource, kind },
            });
          }
          hooks.toast("资料已导入项目");
        })),
  );
}
async function upload(file: File, projectId: string): Promise<{ id: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < bytes.length; i += 32768)
    raw += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return agentCall({
    op: "upload_attachment",
    projectId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    data: btoa(raw),
  });
}

export function educationBanner(snapshot: Snapshot): string {
  const exam = snapshot.data.education.assessments.find(
    (a) => a.startedAt && !a.stoppedAt,
  );
  if (exam)
    return `<section class="reminder-banner"><strong>考试中：${esc(exam.title)} · 本机时间 <span class="teaching-local-clock"></span></strong><p>请独立作答，每题完成后在纸质答题卡填写本机HH:MM时刻。${when(exam.endsAt)}停笔，随后拍照上传。</p><button class="text-button" data-page="project:${esc(exam.projectId)}">查看考试与提交入口</button></section>`;
  const lesson = snapshot.data.education.lessons.find(
    (l) => l.state === "active",
  );
  return lesson
    ? `<section class="reminder-banner"><strong>上课中：${esc(lesson.title)} · ${when(lesson.endsAt)}下课</strong><button class="text-button" data-attend-lesson="${esc(lesson.id)}">${lesson.attended ? "更新学习进度" : "确认参与课程"}</button><button class="text-button" data-page="project:${esc(lesson.projectId)}">打开项目资料</button></section>`
    : "";
}
