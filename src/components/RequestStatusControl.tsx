"use client";

import { useState, useTransition } from "react";
import type { RequestStatus } from "@/lib/types";
import { REQUEST_STATUS_LABELS } from "@/lib/types";
import { actionError } from "@/lib/action-result";
import { Alert } from "@/components/ui/Alert";
import { updateRequestStatus } from "@/actions/requests";

const ALL_STATUSES: RequestStatus[] = [
  "open",
  "in_review",
  "responded",
  "closed",
];

export function RequestStatusControl({
  requestId,
  status,
}: {
  requestId: string;
  status: RequestStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = (s: RequestStatus) => {
    if (s === status || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateRequestStatus(requestId, s);
        const msg = actionError(res);
        if (msg) setError(msg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-2">Alterar estado:</p>
      {error && <Alert className="mb-2">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            disabled={pending}
            onClick={() => handleStatusChange(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-60 ${
              status === s
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            }`}
          >
            {REQUEST_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
