import { IssueCandidate } from "@/lib/github/mappers";
import { hasAreaLabelMatch, hasAreaTextMatch, inferIssueAreasFromText } from "@/lib/scoring/areaClassifier";
import { UserPreferencePayload } from "@/types/preferences";

export function calculateTechMatchScore(issue: IssueCandidate, preferences: UserPreferencePayload) {
  let languageScore = 0;
  let areaScore = 0;

  const preferredLanguagesLower = preferences.preferredLanguages.map((language) => language.toLowerCase());
  const repoLanguageLower = issue.repoPrimaryLanguage?.toLowerCase();

  if (repoLanguageLower && preferredLanguagesLower.includes(repoLanguageLower)) {
    languageScore += 22;
  } else if (repoLanguageLower && preferredLanguagesLower.length > 0) {
    // Penalize non-matching language when preferences are explicit.
    languageScore -= 8;
  }

  const inferredAreas = inferIssueAreasFromText({
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
  });

  for (const preferredArea of preferences.preferredAreas) {
    if (hasAreaLabelMatch(issue.labels, preferredArea)) {
      areaScore += 4;
      continue;
    }

    // Fallback: infer area from issue title/body when labels are missing.
    if (
      inferredAreas.includes(preferredArea) ||
      hasAreaTextMatch({ title: issue.title, body: issue.body, labels: issue.labels }, preferredArea)
    ) {
      areaScore += 2;
    }
  }

  const maxAreaScore = Math.min(12, preferences.preferredAreas.length * 4);
  const boundedAreaScore = Math.min(areaScore, maxAreaScore);
  const total = languageScore + boundedAreaScore;

  return Math.min(Math.max(total, 0), 36);
}
