/**
 * Client-side helper to read the `{ error }` payload that server actions
 * return for expected domain failures (see `guardAction` in `errors.ts`).
 * Returns the message when the action failed, or `null` on success.
 */
export function actionError(res: unknown): string | null {
  if (res && typeof res === "object" && "error" in res) {
    const e = (res as { error?: unknown }).error;
    if (typeof e === "string" && e.length > 0) return e;
  }
  return null;
}
