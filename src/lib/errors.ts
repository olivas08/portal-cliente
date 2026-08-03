/**
 * Domain error hierarchy. Server actions still throw these (the UI reads
 * `error.message` for toasts), but typing them lets us reason about failure
 * modes and, later, map them to a uniform Result contract if needed.
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autorizado.") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message);
  }
}

/**
 * Uniform result returned by server actions. Expected domain failures
 * (`AppError`) are returned as `{ error }` instead of thrown, because Next.js
 * redacts thrown Server Action messages in production builds (the client would
 * only ever see a generic "digest" error). Returning the message lets the UI
 * surface the real reason (e.g. "Stock insuficiente…").
 */
export type ActionResult = { error: string } | void;

/**
 * Generic over the wrapped action's return value so actions that must hand
 * back data on success (e.g. a created record's id, for client-side
 * navigation) can still use the same guard as void-returning ones — callers
 * that don't need a value simply instantiate `T = void`, matching the
 * original `ActionResult` shape.
 */
export async function guardAction<T = void>(
  fn: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
