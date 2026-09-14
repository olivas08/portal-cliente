import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const STYLES = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const;

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
} as const;

export function Alert({
  tone = "error",
  children,
  className = "",
}: {
  tone?: keyof typeof STYLES;
  children: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${STYLES[tone]} ${className}`}
    >
      <Icon size={16} className="shrink-0" />
      {children}
    </div>
  );
}
