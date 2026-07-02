import type { RequestStatus, RequestType } from "@/lib/types";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/types";

const statusCfg: Record<RequestStatus, { cls: string; dot: string; pulse?: boolean }> = {
  open: {
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    pulse: true,
  },
  in_review: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    pulse: true,
  },
  responded: {
    cls: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  closed: {
    cls: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-400",
  },
};

const typeCls: Record<RequestType, string> = {
  quote: "bg-emerald-50 text-emerald-700 border-emerald-200",
  complaint: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  other: "bg-slate-100 text-slate-600 border-slate-200",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { cls, dot, pulse } = statusCfg[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`}
      />
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

export function RequestTypeBadge({ type }: { type: RequestType }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${typeCls[type]}`}
    >
      {REQUEST_TYPE_LABELS[type]}
    </span>
  );
}
