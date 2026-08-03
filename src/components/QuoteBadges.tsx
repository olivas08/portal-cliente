import type { QuoteStatus } from "@/lib/types";
import { QUOTE_STATUS_LABELS } from "@/lib/types";

const statusCfg: Record<QuoteStatus, { cls: string; dot: string; pulse?: boolean }> = {
  draft: {
    cls: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-400",
  },
  sent: {
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    pulse: true,
  },
  accepted: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  rejected: {
    cls: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { cls, dot, pulse } = statusCfg[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`}
      />
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
