// Assistant hand-off: send stable record ids, then use plugin-owned Host tools.
import { registerCopy, t } from '../shared/copy.js';

registerCopy('assistantPrompt', {
  zh: {
    assign: '请为这个学习项目布置一份作业。先用 tomato_get_education 读取项目、资料、学情和已有作业，再拟定题目、固定答案及逐点评分标准；先展示方案让我确认，再发布。',
    submit: '请协助我提交这份作业。先用 tomato_get_education 读取作业题目、要求和关联资料，带我核对答案或附件；确认内容完整后再提交。不要替我编造答案。',
    grade: '请批改这份已提交的作业。先用 tomato_get_education 读取原题、固定答案、评分点、答卷和关联资料，逐题给出评分依据，再记录批改结果和订正要求。',
    correct: '请协助我订正这份作业。先用 tomato_get_education 读取原题、答卷、批改错误与已有订正，逐题引导我完成订正，确认后再提交。',
    review: '请复核这份作业的批改或订正。先用 tomato_get_education 读取原题、答卷、批改记录和订正证据，再根据评分标准处理待复核项。',
    triage: '请处理这些待批改或待复核的作业。按记录 ID 分页用 tomato_get_education 读取各项目、原题、固定答案、评分点、答卷、批改及订正证据，先说明各项状态，再逐项处理。',
    context: '对应的番茄 Todo 记录标识（用插件的 tomato_get_education 读取最新记录，tomato_education 写入；不要依赖已断开的 MCP 会话）：',
    unavailable: '暂时无法写入学习助手草稿，请先打开一个 DSH 会话。',
  },
  en: {
    assign: 'Please assign homework for this study project. First use tomato_get_education to read its project, resources, progress and existing assessments. Draft questions, fixed answers and point-by-point scoring criteria; show me the proposal for confirmation before publishing.',
    submit: 'Help me submit this homework. First use tomato_get_education to read its questions, requirements and related resources. Check my answers or attachments with me, then submit only when complete. Do not invent answers.',
    grade: 'Grade this submitted homework. First use tomato_get_education to read the questions, fixed answers, scoring points, submission and related resources. Give evidence for each score, then record the grade and corrections.',
    correct: 'Help me correct this homework. First use tomato_get_education to read the questions, submission, graded errors and existing corrections. Guide me question by question and submit after confirmation.',
    review: 'Review this homework grade or correction. First use tomato_get_education to read the questions, submission, grade and correction evidence, then resolve the pending review against the scoring criteria.',
    triage: 'Handle these submitted or pending-review assessments. Use tomato_get_education by record ID to read each project, questions, fixed answers, scoring points, submissions, grades and corrections. Explain each status, then handle them one by one.',
    context: 'Tomato Todo record identifiers (read current records with the plugin tool tomato_get_education; write with tomato_education; do not rely on a disconnected MCP session):',
    unavailable: 'Could not prefill the learning assistant. Open a DSH session first.',
  },
  ja: {
    assign: 'この学習プロジェクトの宿題を出してください。まず tomato_get_education でプロジェクト、資料、学習状況、既存の課題を確認し、問題・確定解答・採点基準を作成してください。公開前に案を提示して確認を求めてください。',
    submit: 'この宿題の提出を手伝ってください。まず tomato_get_education で問題、要件、関連資料を確認し、私の解答や添付ファイルを一緒に点検してください。内容を確認してから提出し、解答を捏造しないでください。',
    grade: '提出済みの宿題を採点してください。まず tomato_get_education で問題、確定解答、採点項目、答案、関連資料を確認し、各設問の根拠を示して採点と訂正事項を記録してください。',
    correct: 'この宿題の訂正を手伝ってください。まず tomato_get_education で問題、答案、誤答、既存の訂正を確認し、一問ずつ導いてください。確認後に提出してください。',
    review: 'この宿題の採点または訂正を再確認してください。まず tomato_get_education で問題、答案、採点、訂正の証拠を確認し、採点基準に従って保留中の項目を処理してください。',
    triage: '採点待ち・再確認待ちの課題を処理してください。記録 ID ごとに tomato_get_education でプロジェクト、問題、確定解答、採点基準、答案、採点、訂正の証拠を確認し、各課題の状態を説明してから順に処理してください。',
    context: '番茄 Todo の記録 ID（プラグインの tomato_get_education で最新記録を読み、tomato_education で書き込む。切断された MCP 接続には依存しない）：',
    unavailable: '学習アシスタントの入力欄を準備できません。先に DSH セッションを開いてください。',
  },
});

export function assistantPrompt(kind, records) {
  const request = t(`assistantPrompt.${kind}`);
  const refs = Array.isArray(records) ? records : [records];
  return `${request}\n\n${t('assistantPrompt.context')}\n${JSON.stringify(refs, null, 2)}`;
}
