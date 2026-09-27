export type ErrorCode =
  | "unauthorized"
  | "validation"
  | "brand_unknown"
  | "draft_not_found"
  | "invalid_transition"
  | "llm_failed"
  | "storage_failed"
  | "shopify_failed"
  | "database"
  | "config"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  validation: 400,
  brand_unknown: 422,
  draft_not_found: 404,
  invalid_transition: 409,
  llm_failed: 502,
  storage_failed: 502,
  shopify_failed: 502,
  database: 500,
  config: 500,
  internal: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
  request_id: string;
}

export function toErrorBody(err: unknown, requestId: string): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined && { details: err.details }),
        },
        request_id: requestId,
      },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 500, body: { error: { code: "internal", message }, request_id: requestId } };
}
