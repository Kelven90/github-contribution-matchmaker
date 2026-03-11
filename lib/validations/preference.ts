import { z } from "zod";

export const preferenceSchema = z.object({
  skillLevel: z.enum(["beginner", "intermediate"]),
  preferredLanguages: z.array(z.string()).min(1, "Pick at least one language"),
  preferredAreas: z.array(z.string().min(1, "Area cannot be empty")).min(1, "Pick at least one area"),
  preferredIssueSize: z.enum(["very_small", "small", "medium"]),
  activeReposOnly: z.boolean(),
});

export type PreferenceInput = z.infer<typeof preferenceSchema>;