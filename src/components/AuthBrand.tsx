"use client";

import Image from "next/image";
import { PRODUCT } from "@/lib/branding";
import { TenantMark } from "@/components/TenantMark";

/** Operon wordmark + optional factory mark, shared by unauthenticated pages. */
export function AuthBrand() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center bg-white rounded-2xl mb-4 p-3 shadow-sm border border-slate-100">
        <Image
          src={PRODUCT.logo}
          alt={PRODUCT.name}
          width={200}
          height={48}
          className="object-contain"
          priority
        />
      </div>
      <p className="text-slate-500 text-sm mt-1">{PRODUCT.modules.portal}</p>
      <div className="mt-4 flex justify-center">
        <TenantMark />
      </div>
    </div>
  );
}
