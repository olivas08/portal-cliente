"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PricingSettingsVM } from "@/lib/types";
import { updatePricingSettings } from "@/actions/quotes";
import { actionError } from "@/lib/action-result";

const FIELDS: { key: keyof PricingSettingsVM; label: string; suffix: string }[] = [
  { key: "steelPriceEurKg", label: "Preço do inox", suffix: "€/kg" },
  { key: "laserEurPerMinute", label: "Corte a laser", suffix: "€/min" },
  { key: "bendEurPerBend", label: "Quinagem", suffix: "€/dobra" },
  { key: "weldingEurPerMinute", label: "Soldadura", suffix: "€/min" },
  { key: "finishingEurPerM2", label: "Acabamento", suffix: "€/m²" },
  { key: "defaultMarginPercent", label: "Margem por defeito", suffix: "%" },
];

export function PricingSettingsForm({ pricing }: { pricing: PricingSettingsVM }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(pricing[f.key])])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload = Object.fromEntries(
      FIELDS.map((f) => [f.key, Number(form[f.key].replace(",", "."))]),
    ) as unknown as PricingSettingsVM;

    startTransition(async () => {
      const res = await updatePricingSettings(payload);
      const msg = actionError(res);
      if (msg) setError(msg);
      else setSaved(true);
    });
  }

  return (
    <>
      <Link
        href="/admin/orcamentos"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5 w-fit"
      >
        <ArrowLeft size={16} /> Voltar aos orçamentos
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Definições de Orçamentação</h1>
        <p className="text-slate-500 text-sm mt-1">
          Estes valores são usados para calcular o custo de cada linha de um novo
          orçamento. Alterá-los não afeta orçamentos já criados.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4 max-w-lg"
      >
        {FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-slate-600">{f.label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className="w-28 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={form[f.key]}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              />
              <span className="text-xs text-slate-400 w-14">{f.suffix}</span>
            </div>
          </div>
        ))}

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-600 font-medium">Definições guardadas.</p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-soft disabled:opacity-60 transition-colors"
          >
            Guardar
          </button>
        </div>
      </form>
    </>
  );
}
