"use client";

import { ArrowRightLeft } from "lucide-react";
import type { StockMovementVM } from "@/lib/types";
import { formatInstantPt } from "@/lib/format";
import { fmtQty } from "@/components/warehouse/fmt";

export function StockMovementsSection({
  movements,
}: {
  movements: StockMovementVM[];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <ArrowRightLeft size={16} /> Movimentos recentes
      </h2>
      {movements.length === 0 ? (
        <p className="text-sm text-slate-500">Sem movimentos registados.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium text-right">Quantidade</th>
                <th className="px-4 py-3 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mv) => (
                <tr
                  key={mv.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatInstantPt(mv.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {mv.materialRef}{" "}
                    <span className="text-slate-400">— {mv.materialName}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{mv.reasonLabel}</td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      mv.delta >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {mv.delta >= 0 ? "+" : ""}
                    {fmtQty(mv.delta)} {mv.unit}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {mv.workOrderRef ? `${mv.workOrderRef} · ` : ""}
                    {mv.note ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
