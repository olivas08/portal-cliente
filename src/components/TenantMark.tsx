"use client";

import Image from "next/image";
import { TENANT } from "@/lib/branding";

/**
 * Discreet factory mark. Renders nothing when NEXT_PUBLIC_TENANT_LOGO is
 * unset (demo / preview). The Equiproin asset has a solid black background,
 * so we sit it on black rather than fighting the PNG.
 */
export function TenantMark({
  size = "md",
}: {
  size?: "sm" | "md";
}) {
  if (!TENANT.logo) return null;

  const dims = size === "sm" ? { width: 96, height: 30 } : { width: 148, height: 46 };

  return (
    <div className="flex flex-col items-center gap-1">
      {size === "md" && (
        <p className="text-[10px] uppercase tracking-wider text-slate-400">
          Fábrica
        </p>
      )}
      <div className="bg-black rounded-md px-2 py-1">
        <Image
          src={TENANT.logo}
          alt={TENANT.name}
          width={dims.width}
          height={dims.height}
          className="object-contain"
        />
      </div>
    </div>
  );
}
