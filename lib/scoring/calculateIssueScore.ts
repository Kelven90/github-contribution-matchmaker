import { IssueCandidate } from "@/lib/github/mappers";
import { ACCESSIBILITY_MULTIPLIER } from "@/lib/config/scoring";
import { calculateBeginnerFitScore } from "@/lib/scoring/beginnerFitScore";
import { calculateClarityScore } from "@/lib/scoring/clarityScore";
import {
  DifficultyProfile,
  buildDifficultyProfile,
  calculateDifficultyScore,
  calculateIssueSizeFitScore,
  calculateSkillFitScore,
  toDifficultyBand,
} from "@/lib/scoring/difficultyModel";
import { calculateFreshnessScore } from "@/lib/scoring/freshnessScore";
import { calculatePenaltyScore } from "@/lib/scoring/penalties";
import { calculateRepoHealthScore } from "@/lib/scoring/repoHealthScore";
import { calculateTechMatchScore } from "@/lib/scoring/techMatchScore";
import { ContributionArea, PreferredIssueSize, SkillLevel, UserPreferencePayload } from "@/types/preferences";

export type IssueScoreBreakdown = {
  freshnessScore: number;
  repoHealthScore: number;
  clarityScore: number;
  beginnerFitScore: number;
  techMatchScore: number;
  skillFitScore: number;
  issueSizeFitScore: number;
  difficultyScore: number;
  difficultyBand: "easy" | "moderate" | "hard";
  penaltyScore: number;
  finalScore: number;
  explanationText: string;
};

export type ScoredIssueCandidate = IssueCandidate & {
  score: IssueScoreBreakdown;
};

const VALID_SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate"];
const VALID_ISSUE_SIZES: PreferredIssueSize[] = ["very_small", "small", "medium"];

function toSkillLevel(value: string): SkillLevel {
  return VALID_SKILL_LEVELS.includes(value as SkillLevel) ? (value as SkillLevel) : "beginner";
}

function toIssueSize(value: string): PreferredIssueSize {
  return VALID_ISSUE_SIZES.includes(value as PreferredIssueSize) ? (value as PreferredIssueSize) : "small";
}

function toContributionAreas(values: string[]): ContributionArea[] {
  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["frontend"];
}

export function normalizePreferenceInput(preferences: {
  skillLevel: string;
  preferredLanguages: string[];
  preferredAreas: string[];
  preferredIssueSize: string;
  activeReposOnly: boolean;
}): UserPreferencePayload {
  return {
    skillLevel: toSkillLevel(preferences.skillLevel),
    preferredLanguages: preferences.preferredLanguages,
    preferredAreas: toContributionAreas(preferences.preferredAreas),
    preferredIssueSize: toIssueSize(preferences.preferredIssueSize),
    activeReposOnly: preferences.activeReposOnly,
  };
}

function buildExplanation(
  issue: IssueCandidate,
  preferences: UserPreferencePayload,
  scores: Omit<IssueScoreBreakdown, "finalScore" | "explanationText">
) {
  const reasons: string[] = [];

  if (scores.freshnessScore >= 20) reasons.push("recently updated");
  if (scores.beginnerFitScore >= 16) reasons.push("strong accessibility/newcomer-friendly signals");
  else if (scores.beginnerFitScore >= 8) reasons.push("some accessibility/newcomer-friendly signals");
  if (scores.techMatchScore >= 12 && issue.repoPrimaryLanguage) {
    reasons.push(`matches your preferred language (${issue.repoPrimaryLanguage})`);
  }
  if (scores.skillFitScore >= 10) {
    reasons.push(`difficulty fits your ${preferences.skillLevel} profile (${scores.difficultyBand})`);
  }
  if (scores.issueSizeFitScore >= 7) {
    reasons.push(`aligns with preferred issue size (${preferences.preferredIssueSize})`);
  }
  if (scores.clarityScore >= 16) reasons.push("issue description appears clear");

  if (reasons.length === 0) {
    reasons.push(`partially matches your ${preferences.skillLevel} profile`);
  }

  return reasons.join(", ");
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getAccessibilityMultiplier(skillLevel: SkillLevel) {
  return ACCESSIBILITY_MULTIPLIER[skillLevel];
}

export function calculateIssueScore(
  issue: IssueCandidate,
  preferences: UserPreferencePayload,
  difficultyProfile: DifficultyProfile
): IssueScoreBreakdown {
  const freshnessScore = calculateFreshnessScore(issue);
  const repoHealthScore = calculateRepoHealthScore(issue);
  const clarityScore = calculateClarityScore(issue);
  const beginnerFitScoreBase = calculateBeginnerFitScore(issue);
  const beginnerFitScore = beginnerFitScoreBase * getAccessibilityMultiplier(preferences.skillLevel);
  const techMatchScore = calculateTechMatchScore(issue, preferences);
  const difficultyScore = calculateDifficultyScore(issue, difficultyProfile);
  const difficultyBand = toDifficultyBand(difficultyScore);
  const skillFitScore = calculateSkillFitScore(preferences.skillLevel, difficultyScore);
  const issueSizeFitScore = calculateIssueSizeFitScore(preferences.preferredIssueSize, issue, difficultyProfile);
  const penaltyScore = calculatePenaltyScore(issue);
  const preferenceSpecificityWeight = clamp(
    (preferences.preferredLanguages.length + preferences.preferredAreas.length) / 6,
    0.8,
    1.8
  );

  const rawFinalScore =
    freshnessScore +
    repoHealthScore +
    clarityScore +
    beginnerFitScore +
    techMatchScore * preferenceSpecificityWeight +
    skillFitScore +
    issueSizeFitScore -
    penaltyScore;

  const finalScore = round1(Math.max(0, rawFinalScore));
  const explanationText = buildExplanation(issue, preferences, {
    freshnessScore,
    repoHealthScore,
    clarityScore,
    beginnerFitScore,
    techMatchScore,
    skillFitScore,
    issueSizeFitScore,
    difficultyScore,
    difficultyBand,
    penaltyScore,
  });

  return {
    freshnessScore: round1(freshnessScore),
    repoHealthScore: round1(repoHealthScore),
    clarityScore: round1(clarityScore),
    beginnerFitScore: round1(beginnerFitScore),
    techMatchScore: round1(techMatchScore),
    skillFitScore: round1(skillFitScore),
    issueSizeFitScore: round1(issueSizeFitScore),
    difficultyScore: round1(difficultyScore),
    difficultyBand,
    penaltyScore: round1(penaltyScore),
    finalScore,
    explanationText,
  };
}

export function scoreIssues<T extends IssueCandidate>(
  issues: T[],
  preferences: UserPreferencePayload
): Array<T & { score: IssueScoreBreakdown }> {
  const difficultyProfile = buildDifficultyProfile(issues);

  return issues
    .map((issue) => ({
      ...issue,
      score: calculateIssueScore(issue, preferences, difficultyProfile),
    }))
    .sort((a, b) => b.score.finalScore - a.score.finalScore);
}
