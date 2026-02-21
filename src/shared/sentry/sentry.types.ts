import { SentryIssueSummary } from "./sentry.schemas";

export type SentryIssueDetail = SentryIssueSummary & {
    type?: string;
    annotations?: unknown[];
    assignedTo?: Record<string, unknown> | null;
};

export type SentryIssueEvent = {
    id: string;
    title?: string;
    message?: string;
    timestamp?: string;
    entries?: Array<{ type: string; data?: Record<string, unknown> }>;
    exception?: unknown;
    contexts?: unknown;
    tags?: unknown;
};

