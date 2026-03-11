import { DIFFICULTY_BANDS, DIFFICULTY_PROFILE, DIFFICULTY_WEIGHTS, ISSUE_SIZE, SKILL_FIT, SKILL_TARGET_DIFFICULTY } from "@/lib/config/scoring";
import { IssueCandidate } from "@/lib/github/mappers";
import { PreferredIssueSize, SkillLevel } from "@/types/preferences";

export type DifficultyBand = "easy" | "moderate" | "hard";

export type DifficultyProfile = {
  commentsP40: number;
  commentsP70: number;
  commentsP90: number;
  assigneesP70: number;
  bodyLengthP35: number;
  bodyLengthP60: number;
  bodyLengthP85: number;
};

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * ratio)));
  return values[index];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function buildDifficultyProfile(issues: IssueCandidate[]): DifficultyProfile {
  const comments = issues.map((issue) => issue.commentsCount).sort((a, b) => a - b);
  const assignees = issues.map((issue) => issue.assigneesCount).sort((a, b) => a - b);
  const bodyLengths = issues.map((issue) => issue.body?.length ?? 0).sort((a, b) => a - b);

  return {
    commentsP40: Math.max(DIFFICULTY_PROFILE.COMMENTS_P40_MIN, percentile(comments, 0.4)),
    commentsP70: Math.max(DIFFICULTY_PROFILE.COMMENTS_P70_MIN, percentile(comments, 0.7)),
    commentsP90: Math.max(DIFFICULTY_PROFILE.COMMENTS_P90_MIN, percentile(comments, 0.9)),
    assigneesP70: Math.max(DIFFICULTY_PROFILE.ASSIGNEES_P70_MIN, percentile(assignees, 0.7)),
    bodyLengthP35: Math.max(DIFFICULTY_PROFILE.BODY_LENGTH_P35_MIN, percentile(bodyLengths, 0.35)),
    bodyLengthP60: Math.max(DIFFICULTY_PROFILE.BODY_LENGTH_P60_MIN, percentile(bodyLengths, 0.6)),
    bodyLengthP85: Math.max(DIFFICULTY_PROFILE.BODY_LENGTH_P85_MIN, percentile(bodyLengths, 0.85)),
  };
}

export function calculateDifficultyScore(issue: IssueCandidate, profile: DifficultyProfile) {
  const commentsFactor = clamp(issue.commentsCount / profile.commentsP90, 0, 1);
  const assigneeFactor = clamp(issue.assigneesCount / 3, 0, 1);
  const bodyFactor = clamp((issue.body?.length ?? 0) / (profile.bodyLengthP60 * 2), 0, 1);
  const labelsFactor = clamp(issue.labels.length / 8, 0, 1);

  return (
    Math.round(
      (commentsFactor * DIFFICULTY_WEIGHTS.COMMENTS +
        assigneeFactor * DIFFICULTY_WEIGHTS.ASSIGNEES +
        bodyFactor * DIFFICULTY_WEIGHTS.BODY_LENGTH +
        labelsFactor * DIFFICULTY_WEIGHTS.LABELS) * 10
    ) / 10
  );
}

export function toDifficultyBand(score: number): DifficultyBand {
  if (score < DIFFICULTY_BANDS.EASY_MAX_EXCLUSIVE) return "easy";
  if (score < DIFFICULTY_BANDS.MODERATE_MAX_EXCLUSIVE) return "moderate";
  return "hard";
}

export function calculateSkillFitScore(skillLevel: SkillLevel, difficultyScore: number) {
  const target = SKILL_TARGET_DIFFICULTY[skillLevel];
  const distance = Math.abs(difficultyScore - target);
  return Math.max(0, SKILL_FIT.MAX_SCORE - distance * SKILL_FIT.DISTANCE_PENALTY_PER_POINT);
}

export function calculateIssueSizeFitScore(
  preferredIssueSize: PreferredIssueSize,
  issue: IssueCandidate,
  profile: DifficultyProfile
) {
  const loweredLabels = issue.labels.map((label) => label.toLowerCase());
  const bodyLength = issue.body?.length ?? 0;

  const commentsNorm = clamp(issue.commentsCount / profile.commentsP90, 0, 1);
  const bodyNorm = clamp(bodyLength / profile.bodyLengthP85, 0, 1);
  const assigneesNorm = clamp(issue.assigneesCount / profile.assigneesP70, 0, 1);

  const beginnerLabelHints = ISSUE_SIZE.BEGINNER_LABEL_HINTS;
  const heavierLabelHints = ISSUE_SIZE.HEAVIER_LABEL_HINTS;
  const hasBeginnerHint = loweredLabels.some((label) => beginnerLabelHints.some((hint) => label.includes(hint)));
  const hasHeavierHint = loweredLabels.some((label) => heavierLabelHints.some((hint) => label.includes(hint)));

  let labelComplexity: number = ISSUE_SIZE.LABEL_COMPLEXITY_BASE;
  if (hasBeginnerHint) labelComplexity += ISSUE_SIZE.BEGINNER_LABEL_ADJUSTMENT;
  if (hasHeavierHint) labelComplexity += ISSUE_SIZE.HEAVIER_LABEL_ADJUSTMENT;
  labelComplexity = clamp(labelComplexity, 0, 1);

  const sizeComplexityScore =
    commentsNorm * ISSUE_SIZE.WEIGHTS.COMMENTS +
    bodyNorm * ISSUE_SIZE.WEIGHTS.BODY_LENGTH +
    assigneesNorm * ISSUE_SIZE.WEIGHTS.ASSIGNEES +
    labelComplexity * ISSUE_SIZE.WEIGHTS.LABEL_COMPLEXITY;

  let targetComplexity: number;
  switch (preferredIssueSize) {
    case "very_small":
      targetComplexity = ISSUE_SIZE.TARGET_COMPLEXITY.very_small;
      break;
    case "small":
      targetComplexity = ISSUE_SIZE.TARGET_COMPLEXITY.small;
      break;
    case "medium":
      targetComplexity = ISSUE_SIZE.TARGET_COMPLEXITY.medium;
      break;
    default:
      targetComplexity = ISSUE_SIZE.TARGET_COMPLEXITY.small;
      break;
  }

  const distance = Math.abs(sizeComplexityScore - targetComplexity);
  return Math.max(0, ISSUE_SIZE.MAX_SCORE - distance * ISSUE_SIZE.DISTANCE_PENALTY_PER_POINT);
}
