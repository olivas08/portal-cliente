import type { RequestStatus, RequestType } from "@/lib/types";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/types";

const statusCls: Record<RequestStatus, string> = {
  open: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  responded: "bg-purple-100 text-purple-700",
  closed: "bg-slate-100 text-slate-500",
};

const typeCls: Record<RequestType, string> = {
  quote: "bg-emerald-100 text-emerald-700",
  complaint: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  other: "bg-slate-100 text-slate-600",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusCls[status]}`}
    >
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

export function RequestTypeBadge({ type }: { type: RequestType }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeCls[type]}`}
    >
      {REQUEST_TYPE_LABELS[type]}
    </span>
  );
}
