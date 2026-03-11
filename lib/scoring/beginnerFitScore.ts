import { IssueCandidate } from "@/lib/github/mappers";

function includesLabel(labels: string[], expected: string[]) {
  const lower = labels.map((label) => label.toLowerCase());
  return expected.some((term) => lower.some((label) => label.includes(term)));
}

export function calculateBeginnerFitScore(issue: IssueCandidate) {
  let score = 0;

  if (includesLabel(issue.labels, ["good first issue", "first-timers-only"])) {
    score += 14;
  } else if (includesLabel(issue.labels, ["help wanted", "easy"])) {
    score += 8;
  }

  if (issue.assigneesCount === 0) score += 6;
  else if (issue.assigneesCount === 1) score += 2;

  if (issue.commentsCount <= 5) score += 6;
  else if (issue.commentsCount <= 12) score += 3;

  return Math.min(score, 26);
}
