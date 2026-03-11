import { GitHubIssueItem } from "@/lib/github/queries";

export type IssueCandidate = {
  githubIssueId: number;
  issueNumber: number;
  title: string;
  body: string | null;
  url: string;
  authorLogin: string;
  commentsCount: number;
  assigneesCount: number;
  labels: string[];
  repoFullName: string;
  repoUrl: string;
  repoPrimaryLanguage: string | null;
  updatedAt: string;
  createdAt: string;
};

function parseRepoFromRepositoryUrl(repositoryUrl: string) {
  const marker = "/repos/";
  const markerIndex = repositoryUrl.indexOf(marker);

  if (markerIndex === -1) {
    return {
      fullName: "unknown/unknown",
      htmlUrl: repositoryUrl,
    };
  }

  const repoPath = repositoryUrl.slice(markerIndex + marker.length);
  return {
    fullName: repoPath,
    htmlUrl: `https://github.com/${repoPath}`,
  };
}

function normalizeLabelName(label: GitHubIssueItem["labels"][number]) {
  if (typeof label === "string") return label;
  return label.name ?? "";
}

export function mapGitHubIssueToCandidate(issue: GitHubIssueItem): IssueCandidate {
  const parsedRepo = parseRepoFromRepositoryUrl(issue.repository_url);

  return {
    githubIssueId: issue.id,
    issueNumber: issue.number,
    title: issue.title,
    body: issue.body,
    url: issue.html_url,
    authorLogin: issue.user.login,
    commentsCount: issue.comments,
    assigneesCount: issue.assignees.length,
    labels: issue.labels.map(normalizeLabelName).filter(Boolean),
    repoFullName: issue.repository?.full_name ?? parsedRepo.fullName,
    repoUrl: issue.repository?.html_url ?? parsedRepo.htmlUrl,
    repoPrimaryLanguage: issue.repository?.language ?? null,
    updatedAt: issue.updated_at,
    createdAt: issue.created_at,
  };
}

export function isRecentlyUpdated(isoDate: string, days = 90) {
  const updatedAt = new Date(isoDate).getTime();
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return Number.isFinite(updatedAt) && updatedAt >= threshold;
}
