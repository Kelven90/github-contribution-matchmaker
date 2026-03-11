import { IssueCandidate } from "@/lib/github/mappers";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function calculateFreshnessScore(issue: IssueCandidate) {
  const updatedAtMs = new Date(issue.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) {
    return 0;
  }

  const ageDays = (Date.now() - updatedAtMs) / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) return 30;
  if (ageDays <= 30) return 24;
  if (ageDays <= 90) return 16;
  if (ageDays <= 180) return 8;

  return clamp(3 - (ageDays - 180) / 120, 0, 3);
}
