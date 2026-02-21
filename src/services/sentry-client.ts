import { env } from "@/config/env";
import { SentryIssueDetail, SentryIssueEvent, SentryIssueSummary } from "@/shared/sentry";

type SentryClientOptions = {
  baseUrl?: string;
  authToken?: string;
};

type ListIssuesArgs = {
  hoursAgo: number;
  limit: number;
};

type GetIssueArgs = {
  issueId: string;
};

type ListIssueEventsArgs = GetIssueArgs & {
  limit: number;
};

export const createSentryClient = (options: SentryClientOptions = {}) => {
  const baseUrl = (options.baseUrl ?? env.SENTRY_BASE_URL).replace(/\/$/, "");
  const authToken = options.authToken ?? env.SENTRY_AUTH_TOKEN;

  const resolveProject = () => ({
    orgSlug: env.SENTRY_ORG_SLUG,
    projectSlug: env.SENTRY_PROJECT_SLUG,
  });

  const request = async <T>(path: string, params?: Record<string, string | number>) => {
    const url = new URL(`${baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Sentry API failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  };

  const toSummary = (issue: any): SentryIssueSummary => ({
    id: issue.id,
    shortId: issue.shortId,
    title: issue.title,
    culprit: issue.culprit,
    permalink: issue.permalink,
    eventCount: issue.count,
    lastSeen: issue.lastSeen,
    firstSeen: issue.firstSeen,
    level: issue.level,
    status: issue.status,
    metadata: issue.metadata,
  });

  const listIssues = async ({ hoursAgo = 24, limit }: ListIssuesArgs) => {
    const { orgSlug, projectSlug } = resolveProject();
    const searchQuery = `is:unresolved lastSeen:-${hoursAgo}h`;
    const issues = await request<any[]>(
      `/projects/${orgSlug}/${projectSlug}/issues/`,
      {
        query: searchQuery,
        per_page: limit,
      }
    );

    return issues.map(toSummary);
  };

  const getIssue = async ({ issueId }: GetIssueArgs): Promise<SentryIssueDetail> => {
    const issue = await request<any>(`/issues/${issueId}/`);
    return {
      ...toSummary(issue),
      type: issue.type,
      annotations: issue.annotations,
      assignedTo: issue.assignedTo ?? null,
    };
  };

  const listIssueEvents = async ({ issueId, limit }: ListIssueEventsArgs) => {
    const { orgSlug, projectSlug } = resolveProject();
    const events = await request<any[]>(
      `/issues/${issueId}/events/`,
      {
        per_page: limit,
      }
    );

    return events.map(
      (event): SentryIssueEvent => ({
        id: event.id,
        title: event.title,
        message: event.message,
        timestamp: event.dateCreated,
        entries: event.entries,
        exception: event.exception,
        contexts: event.contexts,
        tags: event.tags,
      })
    );
  };

  return {
    listIssues,
    getIssue,
    listIssueEvents,
  };
};
