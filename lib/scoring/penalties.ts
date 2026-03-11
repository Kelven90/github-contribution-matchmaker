import { PENALTIES } from "@/lib/config/scoring";
import { IssueCandidate } from "@/lib/github/mappers";

export function calculatePenaltyScore(issue: IssueCandidate) {
  let penalty = 0;

  const updatedAtMs = new Date(issue.updatedAt).getTime();
  if (Number.isFinite(updatedAtMs)) {
    const ageDays = (Date.now() - updatedAtMs) / (1000 * 60 * 60 * 24);
    if (ageDays > PENALTIES.STALE_DAYS.LEVEL_3) penalty += PENALTIES.STALE_POINTS.LEVEL_3;
    else if (ageDays > PENALTIES.STALE_DAYS.LEVEL_2) penalty += PENALTIES.STALE_POINTS.LEVEL_2;
    else if (ageDays > PENALTIES.STALE_DAYS.LEVEL_1) penalty += PENALTIES.STALE_POINTS.LEVEL_1;
  }

  if (issue.assigneesCount > 0) {
    penalty += Math.min(issue.assigneesCount * PENALTIES.ASSIGNEE_POINTS_PER_PERSON, PENALTIES.ASSIGNEE_POINTS_CAP);
  }

  if (issue.commentsCount > PENALTIES.COMMENTS_THRESHOLDS.LEVEL_3) penalty += PENALTIES.COMMENTS_POINTS.LEVEL_3;
  else if (issue.commentsCount > PENALTIES.COMMENTS_THRESHOLDS.LEVEL_2) penalty += PENALTIES.COMMENTS_POINTS.LEVEL_2;
  else if (issue.commentsCount > PENALTIES.COMMENTS_THRESHOLDS.LEVEL_1) penalty += PENALTIES.COMMENTS_POINTS.LEVEL_1;

  return Math.min(penalty, PENALTIES.PENALTY_CAP);
}
