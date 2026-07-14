import { Loader2 } from "lucide-react";

/** Centered spinner shown while a page segment's data is still loading. */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  );
}
