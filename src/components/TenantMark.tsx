"use client";

import { TENANT } from "@/lib/branding";

/**
 * Discreet factory mark. Renders nothing when NEXT_PUBLIC_TENANT_LOGO is
 * unset (demo / preview). Served as a plain <img> so Next's image optimizer
 * cannot swap the src after first paint (which was hiding the logo).
 */
export function TenantMark({
  size = "md",
}: {
  size?: "sm" | "md";
}) {
  if (!TENANT.logo) return null;

  const dims = size === "sm" ? { width: 110, height: 47 } : { width: 141, height: 60 };

  return (
    <div className="flex flex-col items-center gap-1">
      {size === "md" && (
        <p className="text-[10px] uppercase tracking-wider text-slate-400">
          Fábrica
        </p>
      )}
      {/* Native img: the file is already a transparent PNG (141×60). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TENANT.logo}
        alt={TENANT.name}
        width={dims.width}
        height={dims.height}
        className="object-contain"
      />
    </div>
  );
}
