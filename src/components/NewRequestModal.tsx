"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { RequestType } from "@/lib/types";
import { REQUEST_TYPE_LABELS } from "@/lib/types";
import { createRequest } from "@/actions/requests";
import { Modal } from "@/components/ui/Modal";

export function NewRequestModal() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: "quote" as RequestType,
    subject: "",
    text: "",
  });
  const [pending, startTransition] = useTransition();

  const inputCls =
    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const id = await createRequest({
        type: form.type,
        subject: form.subject.trim(),
        text: form.text.trim(),
      });
      setShowModal(false);
      setForm({ type: "quote", subject: "", text: "" });
      if (id) router.push(`/dashboard/requerimentos/${id}`);
      else router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
      >
        <Plus size={16} /> Novo Requerimento
      </button>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Requerimento">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tipo
            </label>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as RequestType,
                }))
              }
            >
              {(Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).map(
                (t) => (
                  <option key={t} value={t}>
                    {REQUEST_TYPE_LABELS[t]}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Assunto *
            </label>
            <input
              required
              className={inputCls}
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
              placeholder="Ex: Orçamento para parafusos M12 inox"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Mensagem *
            </label>
            <textarea
              required
              rows={5}
              className={inputCls + " resize-none"}
              value={form.text}
              onChange={(e) =>
                setForm((f) => ({ ...f, text: e.target.value }))
              }
              placeholder="Descreva o seu pedido com o máximo de detalhe..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-60"
            >
              Enviar
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
