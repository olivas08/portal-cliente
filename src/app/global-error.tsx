"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Algo correu mal</h1>
        <p className="text-sm text-neutral-600">
          Ocorreu um erro inesperado. Tente novamente ou contacte o suporte se o
          problema persistir.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
