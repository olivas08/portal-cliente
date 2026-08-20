"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

const MAX_WIDTH_CLASSES = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
} as const;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional helper text shown under the title. */
  description?: ReactNode;
  /** Overrides the accessible label when `title` isn't a plain string. */
  ariaLabel?: string;
  /** Dialog panel width. Defaults to `lg`. */
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES;
  /** Caps the panel height and makes it independently scrollable, with a sticky header. Use for longer forms/wizards. */
  scrollable?: boolean;
  children: ReactNode;
}

/**
 * Shared dialog primitive used by every modal in the app: overlay, panel,
 * header (title + optional description + close button). Callers render
 * only the body content (form, wizard steps, etc.) as children.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  maxWidth = "lg",
  scrollable = false,
  children,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        className={`bg-white rounded-2xl shadow-xl w-full ${MAX_WIDTH_CLASSES[maxWidth]} ${
          scrollable ? "max-h-[90vh] overflow-y-auto" : ""
        }`}
      >
        <div
          className={`flex items-center justify-between p-5 border-b border-slate-100 ${
            scrollable ? "sticky top-0 bg-white" : ""
          }`}
        >
          <div>
            <h2 className="font-semibold text-slate-800">{title}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
