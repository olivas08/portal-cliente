"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { actionError } from "@/lib/action-result";
import { Alert } from "@/components/ui/Alert";
import { updateOrderStatus } from "@/actions/orders";

const STAGES: { id: OrderStatus; desc: string }[] = [
  { id: "pending", desc: "Aguarda início de produção" },
  { id: "production", desc: "A ser fabricada" },
  { id: "quality", desc: "Inspeção em curso" },
  { id: "shipped", desc: "Enviado ao cliente" },
  { id: "delivered", desc: "Receção confirmada" },
];

export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleStatusChange = (next: OrderStatus) => {
    if (next === status || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateOrderStatus(orderId, next);
        const msg = actionError(res);
        if (msg) {
          setError(msg);
          return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocorreu um erro.");
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-5 border-2 border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">
          Alterar Estado da Encomenda
        </h2>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <Check size={12} /> Estado atualizado
          </span>
        )}
      </div>

      {error && <Alert className="mb-3">{error}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {STAGES.map(({ id: stageId, desc }) => {
          const label = ORDER_STATUS_LABELS[stageId];
          const isCurrent = status === stageId;
          return (
            <button
              key={stageId}
              onClick={() => handleStatusChange(stageId)}
              disabled={pending}
              className={`p-4 rounded-xl border-2 text-left transition-all disabled:opacity-60 ${
                isCurrent
                  ? "border-slate-700 bg-slate-800 text-white shadow-md scale-[1.02]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {isCurrent && <Check size={14} className="mb-1.5 text-white" />}
              <p
                className={`text-xs font-bold ${
                  isCurrent ? "text-white" : "text-slate-700"
                }`}
              >
                {label}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  isCurrent ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {desc}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-3">
        💡 Quando marcar como <strong>Expedido</strong> ou{" "}
        <strong>Entregue</strong>, a data é registada automaticamente e o
        cliente fica com essa informação visível no portal.
      </p>
    </div>
  );
}
