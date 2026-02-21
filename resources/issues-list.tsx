import React, { useMemo, useState } from "react";
import { McpUseProvider, useWidget } from "mcp-use/react";
import { IssuesListProps } from "@/shared/sentry";

function fmt(dt: any) {
    if (!dt) return "—";
    if (dt instanceof Date) return dt.toISOString().slice(0, 16).replace("T", " ");
    if (typeof dt === "object") {
        const candidate = dt.iso ?? dt.date ?? dt.datetime ?? dt.timestamp ?? dt.value ?? dt.created ?? dt.firstSeen ?? dt.lastSeen;
        if (candidate) return fmt(candidate);
        try {
            return String(JSON.stringify(dt)).slice(0, 40) + "…";
        } catch {
            return "—";
        }
    }
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    return d.toISOString().slice(0, 16).replace("T", " ");
}

function timeAgo(dt: any) {
    if (!dt) return "—";
    const d = new Date(dt);
    const ms = d.getTime();
    if (Number.isNaN(ms)) return "—";
    const diff = Date.now() - ms;
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 0) return `${day}d ago`;
    if (hr > 0) return `${hr}h ago`;
    if (min > 0) return `${min}m ago`;
    return `${Math.max(1, sec)}s ago`;
}

function levelKind(level?: string | null) {
    const l = (level || "").toLowerCase();
    if (l === "error" || l === "fatal") return "red" as const;
    if (l === "warning") return "orange" as const;
    return "gray" as const;
}

function badge(text: string, kind: "gray" | "red" | "orange" | "green" = "gray") {
    const map: Record<typeof kind, string> = {
        gray: "bg-gray-50 text-gray-700 ring-gray-200",
        red: "bg-red-50 text-red-700 ring-red-200",
        orange: "bg-orange-50 text-orange-800 ring-orange-200",
        green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
    return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${map[kind]}`}>{text}</span>;
}

const IssuesList: React.FC = () => {
    const { props, isPending, sendFollowUpMessage } = useWidget<IssuesListProps>();
    const [openId, setOpenId] = useState<string | null>(null);

    // UI state for Analyze button
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [analyzedIds, setAnalyzedIds] = useState<Record<string, boolean>>({});
    const issues = useMemo(
        () =>
            (props?.issues ?? []).slice().sort((a, b) => {
                // sort by lastSeen desc if possible
                const ad = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
                const bd = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
                return bd - ad;
            }),
        [props]
    );

    if (isPending) {
        return (
            <McpUseProvider autoSize>
                <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-5 bg-gradient-to-b from-gray-50 to-white">
                        <div className="h-6 w-44 bg-gray-200 rounded mb-2 animate-pulse" />
                        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="px-6 pb-6">
                        <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-14 w-full bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    </div>
                </div>
            </McpUseProvider>
        );
    }

    return (
        <McpUseProvider autoSize>
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-b from-gray-50 to-white">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Sentry Issues</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Unresolved in the last <span className="font-semibold text-gray-900">{props.hoursAgo}h</span>
                                <span className="mx-2 text-gray-300">•</span>
                                <span className="font-semibold text-gray-900">{props.count}</span> issue(s)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="border-t border-gray-200">
                    <table className="w-full text-sm">
                        <thead className="bg-white">
                            <tr className="text-gray-500">
                                <th className="text-left font-semibold px-6 py-3 w-[190px]">Last seen</th>
                                <th className="text-left font-semibold px-6 py-3 w-[90px]">Events</th>
                                <th className="text-left font-semibold px-6 py-3">Summary</th>
                                <th className="px-6 py-3 w-[56px]" />
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {issues.map((it) => {
                                const isOpen = openId === it.id;
                                const fileFromMeta = (it as any)?.metadata?.filename as string | undefined;

                                return (
                                    <React.Fragment key={it.id}>
                                        <tr
                                            className={"group cursor-pointer bg-white hover:bg-gray-50/70 transition-colors " + (isOpen ? "bg-orange-50/60" : "")}
                                            onClick={() => setOpenId(isOpen ? null : it.id)}>
                                            <td className="px-6 py-4 align-top">
                                                <div className="text-gray-900 font-semibold">{timeAgo(it.lastSeen)}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{fmt(it.lastSeen)}</div>
                                            </td>

                                            <td className="px-6 py-4 align-top">
                                                <div className="inline-flex items-center gap-2">
                                                    <span className="text-gray-900 font-bold">{it.eventCount}</span>
                                                    {it.level ? badge(it.level, levelKind(it.level)) : null}
                                                </div>
                                                {it.status ? <div className="text-xs text-gray-500 mt-1">{it.status}</div> : null}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold tracking-wider text-gray-500">{it.shortId || it.id}</span>
                                                            {it.status === "unresolved" ? badge("unresolved", "orange") : null}
                                                        </div>
                                                        <div className="text-gray-900 font-semibold leading-snug mt-0.5 break-words">{it.summary ?? it.title ?? "—"}</div>
                                                        <div className="text-xs text-gray-500 mt-1 break-words">{fileFromMeta ?? it.culprit ?? ""}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 align-top text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={!!analyzedIds[it.id] || analyzingId === it.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();

                                                            setAnalyzingId(it.id);
                                                            setAnalyzedIds((m) => ({ ...m, [it.id]: true }));

                                                            sendFollowUpMessage(
                                                                `Analyze Sentry issue ${it.id}. ` +
                                                                    `Call tool diagnose-sentry-error with { "issueId": "${it.id}", "radius": 100 }. ` +
                                                                    `Then show: (1) why it crashed, (2) file+line, (3) a small code snippet, (4) proposed fix diff.`
                                                            ).finally(() => {
                                                                setAnalyzingId((cur) => (cur === it.id ? null : cur));
                                                            });
                                                        }}
                                                        className={
                                                            "cursor-pointer inline-flex items-center rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-60 " +
                                                            (analyzedIds[it.id]
                                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900")
                                                        }
                                                        title={analyzedIds[it.id] ? "Already analyzed" : "Analyze this issue"}>
                                                        {analyzingId === it.id ? "Analyzing…" : analyzedIds[it.id] ? "Analyzed" : "Analyze"}
                                                    </button>

                                                    <div
                                                        className={
                                                            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 " +
                                                            "group-hover:bg-gray-50 group-hover:text-gray-800 transition-colors"
                                                        }
                                                        aria-hidden>
                                                        <span className="text-lg leading-none">{isOpen ? "▾" : "▸"}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {isOpen && (
                                            <tr className="bg-white">
                                                <td colSpan={4} className="px-6 pb-6">
                                                    <div className="mt-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                                                        <div className="px-5 py-4 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {it.status ? badge(it.status, it.status === "unresolved" ? "orange" : "gray") : null}
                                                                {it.level ? badge(it.level, levelKind(it.level)) : null}
                                                                {badge(`First: ${fmt(it.firstSeen)}`, "gray")}
                                                                {badge(`Last: ${fmt(it.lastSeen)}`, "gray")}
                                                            </div>
                                                        </div>

                                                        <div className="p-5 grid grid-cols-1 gap-4">
                                                            <div>
                                                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Raw</div>
                                                                <pre className="rounded-xl border border-gray-200 bg-gray-900 text-gray-100 px-4 py-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                                                                    {JSON.stringify(it, null, 2)}
                                                                </pre>
                                                            </div>

                                                            {fileFromMeta || it.culprit ? (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {fileFromMeta ? (
                                                                        <div>
                                                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">File</div>
                                                                            <div className="rounded-xl border border-gray-200 bg-gray-900 text-gray-100 px-4 py-3 font-mono text-xs overflow-x-auto">
                                                                                {String(fileFromMeta).replace(/^\/+/, "")}
                                                                            </div>
                                                                        </div>
                                                                    ) : null}
                                                                    {it.culprit ? (
                                                                        <div>
                                                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Culprit</div>
                                                                            <div className="rounded-xl border border-gray-200 bg-gray-900 text-gray-100 px-4 py-3 font-mono text-xs overflow-x-auto">
                                                                                {it.culprit}
                                                                            </div>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ) : null}

                                                            {it.permalink ? (
                                                                <div className="flex justify-end">
                                                                    <a
                                                                        href={it.permalink}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-gray-50">
                                                                        Open in Sentry
                                                                        <span aria-hidden>→</span>
                                                                    </a>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {issues.length === 0 && (
                                <tr>
                                    <td className="px-6 py-14 text-center" colSpan={4}>
                                        <div className="text-sm font-semibold text-gray-900">No issues in this timeframe</div>
                                        <div className="text-xs text-gray-500 mt-1">Try a larger window (e.g., 24h) or check filters.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </McpUseProvider>
    );
};

export default IssuesList;
