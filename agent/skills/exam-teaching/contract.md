# 教学工具字段（Rust serde camelCase）

调用 `education({"command":{"op":"操作名", ...}})`。以下字段均必填，Option字段可为null。ID用新UUID，更新配置沿用原ID；时间为Unix秒（按本机时区构造），日期YYYY-MM-DD。

- `saveProject`：`project` 对象，字段见 ProjectStudy。
- `saveResource`：`resource` 对象，字段见 Resource；文件改名或搬移后沿用同一ID更新相对路径。
- `removeResources`：`ids` 数组；只能移除不被配置、当前或历史学期、课程、题目、答卷或订正引用的登记，不删除原文件。
- `saveSemester`：`semester` 对象，字段见 Semester。
- `saveLesson`：`lesson` 对象，字段见 Lesson。
- `publishAssessment`：`assessment` 对象，字段见 Assessment。
- `submit`：`submission` 对象，字段见 Submission。
- `grade`：`grade` 对象，字段见 Grade。
- `saveReview`：`review` 对象，字段见 Review。
- `recordProgress`：`record` 对象，字段见 ProgressRecord；助手提交的来源强制设为 `assistant`，初始 `confirmed=false`；用户在对话中明确确认后，再独立调用 `confirmProgress`。
- `confirmProgress`：`id`；用户明确确认已有记录时可直接确认，项目页也可操作。
- `submitCorrection`：`correction` 对象，字段见 Correction；检查结果由独立事件保存。
- `reviewCorrection`：`id`、`accepted`、`feedback`。
- `attendLesson`：`id`、`progress`。
- `confirmPrinted` / `startExam` / `endExam` / `finishEvent` / `retryEvent`：`id`。
- `claimEvent`：`id`。内置助手的事件由宿主预先领取；外部 agent 接管自动执行后，先领取 `pending` 事件，再保存实际产物并 `finishEvent`。不要重复领取 `running` 事件；失败事件仅在用户要求继续时用 `retryEvent` 重试。

## Education

- `focusTasks`: 核心维护的 `{taskId, sourceId, kind}` 数组；`kind=lesson | homework`，关联普通任务与本项目课程/作业。只读来源关联，不自行填写或改写，不重复建任务。
- `projects`: ProjectStudy[]
- `resources`: Resource[]
- `semesters`: Semester[]
- `semesterHistory`: Semester[]
- `lessons`: Lesson[]
- `assessments`: Assessment[]
- `submissions`: Submission[]
- `grades`: Grade[]
- `reviews`: Review[]
- `events`: TeachingEvent[]
- `completedTasks`: 已完成学习任务的不可变快照（任务 ID、标题、笔记、主题、完成时间），任务删除后仍可追溯。
- `progress`: 逐条学情记录；助手来源固定标记为assistant，来源与确认状态分开保存，旧记录不可改写。
- `corrections`: 逐题订正提交和检查结果；通过订正不等于独立复测。

## ProjectStudy

- `projectId`: string
- `directory`: string
- `examMode`: boolean
- `visionId`: string | null
- `target`: string
- `examDate`: string | null
- `syllabusId`: string | null
- `pastPaperIds`: string[]
- `mockPaperIds`: string[]

## Resource

- `id`: string
- `projectId`: string
- `title`: string
- `kind`: ResourceKind
- `path`: string
- `source`: string
- `edition`: string
- `topics`: string[]

## Milestone

- `week`: integer
- `topics`: string[]
- `resourceIds`: string[]
- `objective`: string
- `lessonCount`: integer

## Semester

- `id`: string
- `projectId`: string
- `title`: string
- `startDate`: string
- `endDate`: string
- `revision`: integer
- `baseline`: string
- `evidence`: string[]
- `rationale`: string
- `milestones`: Milestone[]

## Lesson

- `id`: string
- `projectId`: string
- `semesterId`: string
- `semesterRevision`: integer
- `title`: string
- `topics`: string[]
- `resourceIds`: string[]
- `startsAt`: integer
- `endsAt`: integer
- `aiEnabled`: boolean
- `attended`: boolean
- `progress`: string
- `state`: LessonState

## ScoringPoint

- `id`: string
- `description`: string
- `points`: integer

## Question

- `id`: string
- `prompt`: string
- `topics`: string[]
- `sourceIds`: string[]
- `extension`: boolean
- `estimatedMinutes`: integer
- `answer`: string
- `acceptableAlternatives`: string
- `scoring`: ScoringPoint[]

## Assessment

- `id`: string
- `projectId`: string
- `semesterId`: string
- `semesterRevision`: integer
- `lessonId`: string | null
- `taskId`: string | null；来自已完成学习任务的作业引用原任务，`lessonId=null`。
- `retestOfGradeId`: string | null；仅 `kind=retest` 时引用本项目原批改。
- `title`: string
- `kind`: AssessmentKind
- `revision`: integer
- `startsAt`: integer
- `endsAt`: integer
- `instructions`: string
- `reviewEvidence`: string
- `questions`: Question[]
- `publishedAt`: integer
- `printedAt`: integer | null
- `startedAt`: integer | null
- `stoppedAt`: integer | null

## Submission

- `id`: string
- `assessmentId`: string
- `submittedAt`: integer
- `resourceIds`: string[]
- `answers`: string
- `unfinished`: boolean
- `questionTimes`: QuestionTime[]

## QuestionTime

- `questionId`: string
- `localTime`: string

## PointAward

- `questionId`: string
- `pointId`: string
- `awarded`: integer
- `evidence`: string

## ErrorAnalysis

- `questionId`: string
- `cause`: string
- `evidence`: string
- `correction`: string
- `nextCheck`: string
- `retestDate`: string
- `confirmed`: boolean

## Grade

- `id`: string
- `submissionId`: string
- `assessmentRevision`: integer
- `gradedAt`: integer
- `awards`: PointAward[]
- `errors`: ErrorAnalysis[]
- `needsReview`: boolean
- `feedback`: string

## Review

- `id`: string
- `date`: string
- `projectId`: string
- `gradeIds`: string[]
- `findings`: string
- `actions`: string[]

## TeachingEvent

- `id`: string
- `projectId`: string
- `kind`: string
- `sourceId`: string
- `state`: string
- `createdAt`: integer

## ResourceKind

`syllabus | course | book | pastPaper | mockPaper | reference | attachment | answerSheet`

## LessonState

`planned | active | ended | missed`

## AssessmentKind

`homework | weeklyExam | mockExam | retest`
