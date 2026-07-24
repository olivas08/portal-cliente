"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { operatorLogout } from "@/actions/production";

export function OperatorLogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await operatorLogout();
          router.refresh();
        })
      }
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 disabled:opacity-60"
    >
      <LogOut size={16} /> Sair
    </button>
  );
}
