"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  AlertCircle,
  RotateCcw,
  Check,
} from "lucide-react";
import type { NonConformityVM } from "@/lib/types";
import { NC_DISPOSITION_LABELS } from "@/lib/types";
import { reworkStep, resolveNonConformity } from "@/actions/production";
import { actionError } from "@/lib/action-result";
import { BreadcrumbSetter } from "@/components/BreadcrumbContext";

interface Props {
  nonConformities: NonConformityVM[];
}

export function QualityView({ nonConformities }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  return (
    <>
      <BreadcrumbSetter text="Qualidade" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <ShieldAlert size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Qualidade</h1>
          <p className="text-sm text-slate-500">
            Não-conformidades em aberto no chão de fábrica
          </p>
        </div>
        <Link
          href="/admin/producao"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Produção
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        {nonConformities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Check size={32} className="text-emerald-500 mb-2" />
            <p className="text-sm text-slate-500">
              Sem não-conformidades em aberto.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {nonConformities.map((nc) => (
              <div
                key={nc.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 text-sm">
                      {nc.workOrderRef}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        nc.disposition === "rework"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {NC_DISPOSITION_LABELS[nc.disposition]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {nc.quantity} un
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5 truncate">
                    {nc.reason}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {nc.productName}
                    {nc.stepName ? ` · ${nc.stepName}` : ""}
                    {nc.operatorName ? ` · ${nc.operatorName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {nc.canRework && nc.stepId && (
                    <button
                      onClick={() => run(() => reworkStep(nc.stepId!))}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 text-slate-900 text-sm font-semibold px-3 py-2 hover:bg-amber-400 disabled:opacity-60"
                    >
                      <RotateCcw size={14} /> Reprocessar
                    </button>
                  )}
                  <button
                    onClick={() => run(() => resolveNonConformity(nc.id))}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 px-3 py-2 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Check size={14} /> Resolver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
