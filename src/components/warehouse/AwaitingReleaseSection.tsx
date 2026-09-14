"use client";

import { AlertTriangle, CheckCircle2, PackageCheck } from "lucide-react";
import type { WorkOrderReadinessVM } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { fmtQty } from "@/components/warehouse/fmt";

export function AwaitingReleaseSection({
  awaiting,
  pending,
  onRelease,
}: {
  awaiting: WorkOrderReadinessVM[];
  pending: boolean;
  onRelease: (wo: WorkOrderReadinessVM) => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <PackageCheck size={16} /> Ordens a aguardar confirmação de stock
        <span className="text-xs font-normal text-slate-400">
          ({awaiting.length})
        </span>
      </h2>

      {awaiting.length === 0 ? (
        <p className="text-sm text-slate-500">
          Não há ordens de fabrico planeadas a aguardar lançamento.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {awaiting.map((wo) => (
            <div
              key={wo.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                wo.canRelease ? "border-slate-100" : "border-amber-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {wo.reference}{" "}
                    <span className="text-slate-400 font-normal">
                      · {wo.productRef}
                    </span>
                  </p>
                  <p className="text-sm text-slate-500">
                    {wo.productName} · {fmtQty(wo.quantityPlanned)} un
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {wo.orderReference} · {wo.companyName}
                  </p>
                </div>
                <Button
                  onClick={() => onRelease(wo)}
                  disabled={pending || !wo.canRelease}
                  size="md"
                >
                  <PackageCheck size={15} /> Confirmar e lançar
                </Button>
              </div>

              {!wo.hasBom ? (
                <p className="text-xs text-slate-400">
                  Sem ficha técnica — pode lançar sem consumo de materiais.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {wo.materials.map((m) => (
                    <div
                      key={m.materialId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-600">
                        {m.reference}{" "}
                        <span className="text-slate-400">— {m.name}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 tabular-nums ${
                          m.enough ? "text-slate-600" : "text-red-600"
                        }`}
                      >
                        {m.enough ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : (
                          <AlertTriangle size={14} className="text-red-500" />
                        )}
                        {fmtQty(m.requiredQty)} / {fmtQty(m.availableQty)} {m.unit}
                        {!m.enough && (
                          <span className="text-xs">
                            (faltam {fmtQty(m.missingQty)})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
