import type { Education, Submission, Grade, Correction } from "./education";

interface TeachingIndex {
  submissions: Map<string, Submission[]>;
  latestSubmission: Map<string, Submission>;
  grades: Map<string, Grade[]>;
  latestGrade: Map<string, Grade>;
  corrections: Map<string, Map<string, Correction[]>>;
  accepted: Map<string, Set<string>>;
}
const indices = new WeakMap<Education, TeachingIndex>();
/** Reuse one pass through submission and grading history for the entire snapshot. */
export function teachingIndex(e: Education): TeachingIndex {
  const cached = indices.get(e);
  if (cached) return cached;
  const index: TeachingIndex = {
    submissions: new Map(),
    latestSubmission: new Map(),
    grades: new Map(),
    latestGrade: new Map(),
    corrections: new Map(),
    accepted: new Map(),
  };
  for (const item of e.submissions) {
    const entries = index.submissions.get(item.assessmentId) || [];
    entries.push(item);
    index.submissions.set(item.assessmentId, entries);
    const last = index.latestSubmission.get(item.assessmentId);
    if (!last || item.submittedAt >= last.submittedAt)
      index.latestSubmission.set(item.assessmentId, item);
  }
  for (const entries of index.submissions.values())
    entries.sort((a, b) => a.submittedAt - b.submittedAt);
  for (const item of e.grades) {
    const entries = index.grades.get(item.submissionId) || [];
    entries.push(item);
    index.grades.set(item.submissionId, entries);
    const last = index.latestGrade.get(item.submissionId);
    if (!last || item.gradedAt >= last.gradedAt)
      index.latestGrade.set(item.submissionId, item);
  }
  for (const item of e.corrections) {
    const questions =
      index.corrections.get(item.gradeId) || new Map<string, Correction[]>();
    const entries = questions.get(item.questionId) || [];
    entries.push(item);
    questions.set(item.questionId, entries);
    index.corrections.set(item.gradeId, questions);
    if (item.accepted) {
      const accepted = index.accepted.get(item.gradeId) || new Set<string>();
      accepted.add(item.questionId);
      index.accepted.set(item.gradeId, accepted);
    }
  }
  indices.set(e, index);
  return index;
}
