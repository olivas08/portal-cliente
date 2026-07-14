"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Upload, Download, Trash2, Loader2 } from "lucide-react";
import type { OrderAttachmentVM } from "@/lib/types";
import {
  uploadOrderDocument,
  deleteOrderDocument,
  getOrderDocumentDownloadUrl,
} from "@/actions/documents";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload/list/download/delete panel for an order's ad-hoc attachments. */
export function OrderAttachments({
  orderId,
  attachments,
  currentUserId,
  isAdmin,
}: {
  orderId: string;
  attachments: OrderAttachmentVM[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpload = (formData: FormData) => {
    setError(null);
    startUpload(async () => {
      try {
        await uploadOrderDocument(orderId, formData);
        formRef.current?.reset();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Falha ao enviar o ficheiro."
        );
      }
    });
  };

  const handleDownload = async (documentId: string) => {
    setError(null);
    setDownloadingId(documentId);
    try {
      const url = await getOrderDocumentDownloadUrl(documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o link.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (documentId: string) => {
    setError(null);
    setDeletingId(documentId);
    startUpload(async () => {
      try {
        await deleteOrderDocument(documentId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Falha ao remover o ficheiro."
        );
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Paperclip size={16} className="text-slate-400" />
        Anexos
      </h3>

      <form ref={formRef} action={handleUpload} className="flex items-center gap-2 mb-4">
        <input
          type="file"
          name="file"
          required
          className="flex-1 min-w-0 text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-soft transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {isUploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          Enviar
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {attachments.map((doc) => {
          const canDelete = isAdmin || doc.uploadedById === currentUserId;
          return (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {doc.fileName}
                </p>
                <p className="text-xs text-slate-400">
                  {formatSize(doc.sizeBytes)} · {doc.uploadedByName}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDownload(doc.id)}
                  disabled={downloadingId === doc.id}
                  className="p-1.5 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  aria-label={`Transferir ${doc.fileName}`}
                >
                  <Download size={15} />
                </button>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    aria-label={`Remover ${doc.fileName}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {attachments.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Sem anexos.</p>
        )}
      </div>
    </div>
  );
}
