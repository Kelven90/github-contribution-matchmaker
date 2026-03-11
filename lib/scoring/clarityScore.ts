import { IssueCandidate } from "@/lib/github/mappers";

const CLARITY_KEYWORDS = [
  "steps",
  "reproduce",
  "expected",
  "actual",
  "acceptance criteria",
  "todo",
  "checklist",
  "screenshot",
  "example",
];

export function calculateClarityScore(issue: IssueCandidate) {
  let score = 0;

  const titleLength = issue.title.trim().length;
  if (titleLength >= 20 && titleLength <= 100) score += 8;
  else if (titleLength >= 10) score += 5;
  else score += 2;

  const body = issue.body?.trim() ?? "";
  const bodyLength = body.length;
  if (bodyLength >= 150 && bodyLength <= 4000) score += 8;
  else if (bodyLength >= 60) score += 5;
  else if (bodyLength > 0) score += 2;

  const lowerBody = body.toLowerCase();
  const keywordHits = CLARITY_KEYWORDS.filter((keyword) => lowerBody.includes(keyword)).length;
  score += Math.min(keywordHits * 2, 8);

  return Math.min(score, 24);
}
