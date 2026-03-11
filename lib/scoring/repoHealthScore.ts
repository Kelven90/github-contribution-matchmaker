import { IssueCandidate } from "@/lib/github/mappers";

function hasOwnerAndRepo(fullName: string) {
  const segments = fullName.split("/");
  return segments.length === 2 && Boolean(segments[0]) && Boolean(segments[1]);
}

function isLikelyGithubRepoUrl(repoUrl: string) {
  try {
    const parsed = new URL(repoUrl);
    return parsed.hostname === "github.com";
  } catch {
    return false;
  }
}

export function calculateRepoHealthScore(issue: IssueCandidate) {
  let score = 0;

  if (hasOwnerAndRepo(issue.repoFullName)) score += 6;
  if (isLikelyGithubRepoUrl(issue.repoUrl)) score += 4;
  if (issue.repoPrimaryLanguage) score += 4;

  const issueUpdatedAtMs = new Date(issue.updatedAt).getTime();
  if (Number.isFinite(issueUpdatedAtMs)) {
    const ageDays = (Date.now() - issueUpdatedAtMs) / (1000 * 60 * 60 * 24);
    if (ageDays <= 30) score += 6;
    else if (ageDays <= 90) score += 4;
    else if (ageDays <= 180) score += 2;
  }

  return Math.min(score, 20);
}
