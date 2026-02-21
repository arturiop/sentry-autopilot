import { z } from "zod";

export const sentryIssueSummarySchema = z.object({
    id: z.string(),
    shortId: z.string().optional().default(""),
    title: z.string().optional().default(""),
    summary: z.string().optional(),
    culprit: z.string().nullable().optional(),
    permalink: z.string().nullable().optional(),
    eventCount: z.coerce.number().optional().default(0),
    lastSeen: z.string().nullable().optional(),
    firstSeen: z.string().nullable().optional(),
    level: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    metadata: z.any().optional(),
});

export type SentryIssueSummary = z.infer<typeof sentryIssueSummarySchema>;

export const issuesListPropsSchema = z.object({
    hoursAgo: z.number(),
    limit: z.number(),
    count: z.number(),
    issues: z.array(sentryIssueSummarySchema),
});

export type IssuesListProps = z.infer<typeof issuesListPropsSchema>;
