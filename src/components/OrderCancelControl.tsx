"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import type { OrderStatus } from "@/lib/types";
import { cancelOrder, reactivateOrder } from "@/actions/orders";
import { Modal } from "@/components/ui/Modal";

interface Props {
  orderId: string;
  status: OrderStatus;
  isAdmin: boolean;
}

/**
 * Cancel / reject / reactivate controls for an order.
 * - Admin: may cancel any non-delivered order (button reads "Rejeitar" while
 *   pending, "Cancelar" afterwards) and may reopen a cancelled one.
 * - Client: may only annul their own order while it is still pending.
 * Anything outside these windows renders nothing.
 */
export function OrderCancelControl({ orderId, status, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const isCancelled = status === "cancelled";
  const isDelivered = status === "delivered";

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await cancelOrder(orderId, reason);
        setOpen(false);
        setReason("");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.",
        );
      }
    });
  };

  const handleReactivate = () => {
    startTransition(async () => {
      try {
        await reactivateOrder(orderId);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ocorreu um erro. Tente novamente.",
        );
      }
    });
  };

  // Admin can reopen a cancelled order.
  if (isCancelled) {
    if (!isAdmin) return null;
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 mb-5 border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-600">
          Esta encomenda está cancelada. Pode reabri-la para retomar a produção.
        </p>
        <button
          onClick={handleReactivate}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-brand bg-accent rounded-lg hover:bg-accent-dark disabled:opacity-60"
        >
          <RotateCcw size={15} /> {pending ? "A reabrir..." : "Reabrir encomenda"}
        </button>
      </div>
    );
  }

  // Delivered orders can't be cancelled.
  if (isDelivered) return null;
  // Clients can only annul while pending.
  if (!isAdmin && status !== "pending") return null;

  const isPending = status === "pending";
  const verb = !isAdmin ? "Anular encomenda" : isPending ? "Rejeitar" : "Cancelar";
  const title = !isAdmin
    ? "Anular encomenda"
    : isPending
    ? "Rejeitar encomenda"
    : "Cancelar encomenda";

  return (
    <>
      <div className="flex justify-end mb-5">
        <button
          onClick={() => {
            setError("");
            setOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Ban size={15} /> {verb}
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form onSubmit={handleCancel} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Motivo *
            </label>
            <textarea
              required
              rows={3}
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isAdmin
                  ? "Ex: rutura de stock de matéria-prima, especificação inviável..."
                  : "Ex: já não preciso desta encomenda..."
              }
            />
            <p className="text-xs text-slate-400 mt-1">
              O motivo fica visível para a outra parte.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              {pending ? "A processar..." : "Confirmar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
