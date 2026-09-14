"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
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

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog primitive used by every modal in the app: overlay, panel,
 * header (title + optional description + close button). Callers render
 * only the body content (form, wizard steps, etc.) as children.
 *
 * Traps focus, closes on Escape, restores focus to the opener, and moves
 * initial focus into the panel.
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
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        className={`relative bg-white rounded-2xl shadow-xl w-full ${MAX_WIDTH_CLASSES[maxWidth]} ${
          scrollable ? "max-h-[90vh] overflow-y-auto" : ""
        }`}
      >
        <div
          className={`flex items-center justify-between p-5 border-b border-slate-100 ${
            scrollable ? "sticky top-0 bg-white" : ""
          }`}
        >
          <div>
            <h2 id={titleId} className="font-semibold text-slate-800">
              {title}
            </h2>
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
