import { SkillLevel } from "@/types/preferences";

export const DIFFICULTY_PROFILE = {
  COMMENTS_P40_MIN: 1,
  COMMENTS_P70_MIN: 2,
  COMMENTS_P90_MIN: 4,
  ASSIGNEES_P70_MIN: 1,
  BODY_LENGTH_P35_MIN: 80,
  BODY_LENGTH_P60_MIN: 120,
  BODY_LENGTH_P85_MIN: 220,
} as const;

export const DIFFICULTY_WEIGHTS = {
  COMMENTS: 45,
  ASSIGNEES: 30,
  BODY_LENGTH: 15,
  LABELS: 10,
} as const;

export const DIFFICULTY_BANDS = {
  EASY_MAX_EXCLUSIVE: 35,
  MODERATE_MAX_EXCLUSIVE: 65,
} as const;

export const SKILL_TARGET_DIFFICULTY: Record<SkillLevel, number> = {
  beginner: 30,
  intermediate: 55,
};

export const SKILL_FIT = {
  MAX_SCORE: 14,
  DISTANCE_PENALTY_PER_POINT: 0.25,
} as const;

export const ACCESSIBILITY_MULTIPLIER: Record<SkillLevel, number> = {
  beginner: 1.0,
  intermediate: 0.5,
};

export const ISSUE_SIZE = {
  BEGINNER_LABEL_HINTS: ["good first issue", "first-timers-only", "help wanted", "up-for-grabs"],
  HEAVIER_LABEL_HINTS: ["epic", "needs discussion", "design", "architecture", "rfc"],
  LABEL_COMPLEXITY_BASE: 0.5,
  BEGINNER_LABEL_ADJUSTMENT: -0.25,
  HEAVIER_LABEL_ADJUSTMENT: 0.3,
  TARGET_COMPLEXITY: {
    very_small: 25,
    small: 45,
    medium: 70,
  },
  MAX_SCORE: 10,
  DISTANCE_PENALTY_PER_POINT: 0.2,
  WEIGHTS: {
    COMMENTS: 45,
    BODY_LENGTH: 25,
    ASSIGNEES: 20,
    LABEL_COMPLEXITY: 10,
  },
} as const;

export const PENALTIES = {
  STALE_DAYS: {
    LEVEL_1: 120,
    LEVEL_2: 180,
    LEVEL_3: 365,
  },
  STALE_POINTS: {
    LEVEL_1: 5,
    LEVEL_2: 9,
    LEVEL_3: 14,
  },
  ASSIGNEE_POINTS_PER_PERSON: 4,
  ASSIGNEE_POINTS_CAP: 10,
  COMMENTS_THRESHOLDS: {
    LEVEL_1: 12,
    LEVEL_2: 20,
    LEVEL_3: 40,
  },
  COMMENTS_POINTS: {
    LEVEL_1: 2,
    LEVEL_2: 5,
    LEVEL_3: 8,
  },
  PENALTY_CAP: 30,
} as const;
