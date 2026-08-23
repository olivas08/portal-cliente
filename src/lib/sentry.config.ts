import type { Options } from "@sentry/core";

/**
 * Shared Sentry init options. Only sends when `NEXT_PUBLIC_SENTRY_DSN` is set.
 * Free-tier friendly: error monitoring + light tracing, no Session Replay.
 */
export function getSentryInitOptions(): Options {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  };
}
