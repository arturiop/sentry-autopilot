import { useMemo } from "react";
import { useWidget } from "mcp-use/react";

type Props = {
  issueId: string;
  filePath: string;
  summary: string;
  diff: string;
  // optional extras (safe if not provided)
  error?: string;
};

function DiffLine({ line, index }: { line: string; index: number }) {
  const kind =
    line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff --git") || line.startsWith("index ")
      ? "meta"
      : line.startsWith("@@")
        ? "hunk"
        : line.startsWith("+")
          ? "add"
          : line.startsWith("-")
            ? "del"
            : "ctx";

  const cls =
    kind === "meta"
      ? "text-neutral-300"
      : kind === "hunk"
        ? "text-sky-300"
        : kind === "add"
          ? "text-emerald-200"
          : kind === "del"
            ? "text-rose-200"
            : "text-neutral-100";

  const bg =
    kind === "add"
      ? "bg-emerald-500/10"
      : kind === "del"
        ? "bg-rose-500/10"
        : kind === "hunk"
          ? "bg-sky-500/10"
          : "";

  return (
    <div className={`grid grid-cols-[52px_1fr] gap-3 px-3 py-[2px] ${bg}`}>
      <div className="select-none text-right text-[11px] leading-5 text-neutral-500">{index}</div>
      <div className={`whitespace-pre font-mono text-[12px] leading-5 ${cls}`}>{line || " "}</div>
    </div>
  );
}

export default function PatchViewer() {
  const { props, theme } = useWidget<Props>();

  const lines = useMemo(() => {
    const raw = typeof props.diff === "string" ? props.diff : "";
    // Keep trailing newline behavior stable
    const arr = raw.replace(/\r\n/g, "\n").split("\n");
    return arr;
  }, [props.diff]);

  return (
    <div data-theme={theme} className="rounded-2xl border border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {props.issueId ? (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                Issue {props.issueId}
              </span>
            ) : null}
            {props.filePath ? (
              <span className="truncate text-[12px] font-medium text-gray-600">{props.filePath}</span>
            ) : null}
          </div>
          {props.summary ? (
            <div className="mt-2 text-sm font-semibold text-gray-900">{props.summary}</div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-neutral-100">
          Diff
        </span>
      </div>

      {/* Error (optional) */}
      {props.error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 whitespace-pre-wrap">
          {props.error}
        </div>
      ) : null}

      {/* Diff Panel */}
      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <div className="text-[11px] font-semibold text-neutral-200">Patch</div>
          <div className="text-[11px] text-neutral-400">{lines.length} lines</div>
        </div>

        <div className="max-h-[520px] overflow-auto">
          {lines.map((line, i) => (
            <DiffLine key={i} line={line} index={i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}