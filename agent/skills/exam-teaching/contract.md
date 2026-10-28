# 教学工具字段（Rust serde camelCase）

调用 `education({"command":{"op":"操作名", ...}})`。以下字段均必填，Option字段可为null。ID用新UUID，更新配置沿用原ID；时间为Unix秒（按本机时区构造），日期YYYY-MM-DD。

- `saveProject`：`project` 对象，字段见 ProjectStudy。
- `saveResource`：`resource` 对象，字段见 Resource。
- `saveSemester`：`semester` 对象，字段见 Semester。
- `saveLesson`：`lesson` 对象，字段见 Lesson。
- `publishAssessment`：`assessment` 对象，字段见 Assessment。
- `submit`：`submission` 对象，字段见 Submission。
- `grade`：`grade` 对象，字段见 Grade。
- `saveReview`：`review` 对象，字段见 Review。
- `attendLesson`：`id`、`progress`。
- `confirmPrinted` / `startExam` / `finishEvent` / `retryEvent`：`id`。
- claimEvent 仅供宿主领取事件，模型无需调用。

## Education

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

`homework | weeklyExam | mockExam`
