export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "UNAUTHENTICATED" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED",
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Record") {
    super(`${what} not found`, "NOT_FOUND");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, "FORBIDDEN");
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super("You must be signed in", "UNAUTHENTICATED");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message, "VALIDATION", fieldErrors);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message, "CONFLICT", fieldErrors);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Please wait and try again.") {
    super(message, "RATE_LIMITED");
  }
}

/** Translate known Prisma errors (e.g. unique constraint) into AppErrors. */
export function mapPrismaError(err: unknown, uniqueField?: string): never {
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e?.code === "P2002") {
    const target = e.meta?.target;
    const field = uniqueField ?? (Array.isArray(target) ? (target.at(-1) ?? "value") : "value");
    throw new ConflictError(`A record with this ${field} already exists`, { [field]: [`This ${field} is already in use`] });
  }
  if (e?.code === "P2025") throw new NotFoundError();
  throw err;
}
