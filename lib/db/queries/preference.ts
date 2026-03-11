import { prisma } from "@/lib/db/prisma";
import { PreferenceInput } from "@/lib/validations/preference";

const DEMO_USER_EMAIL = "demo@example.com";

export async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: "Demo User",
    },
  });
}

export async function upsertUserPreferences(userId: string, data: PreferenceInput) {
  return prisma.userPreference.upsert({
    where: { userId },
    update: {
      skillLevel: data.skillLevel,
      preferredLanguages: data.preferredLanguages,
      preferredAreas: data.preferredAreas,
      preferredIssueSize: data.preferredIssueSize,
      activeReposOnly: data.activeReposOnly,
    },
    create: {
      userId,
      skillLevel: data.skillLevel,
      preferredLanguages: data.preferredLanguages,
      preferredAreas: data.preferredAreas,
      preferredIssueSize: data.preferredIssueSize,
      activeReposOnly: data.activeReposOnly,
    },
  });
}

export async function getUserPreferences(userId: string) {
  return prisma.userPreference.findUnique({
    where: { userId },
  });
}