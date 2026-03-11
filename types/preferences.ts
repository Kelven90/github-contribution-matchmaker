export type SkillLevel = "beginner" | "intermediate";

export type ContributionArea = string;

export type PreferredIssueSize = "very_small" | "small" | "medium";

export interface UserPreferencePayload {
  skillLevel: SkillLevel;
  preferredLanguages: string[];
  preferredAreas: ContributionArea[];
  preferredIssueSize: PreferredIssueSize;
  activeReposOnly: boolean;
}