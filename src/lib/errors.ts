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
