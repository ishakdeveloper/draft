import { createMiddleware } from "hono/factory";
import { AppError } from "./errors";

/**
 * Constant-time comparison. Both sides are hashed to a fixed 32 bytes first so length
 * differences do not leak, then compared byte by byte without early exit. Written with
 * Web Crypto only so it runs the same on Workers and under bun:test.
 */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const HEADER = "x-pipeline-secret";

export function requirePipelineSecret(expected: string) {
  return createMiddleware(async (c, next) => {
    const provided = c.req.header(HEADER) ?? "";
    if (!expected || !(await secretsMatch(provided, expected))) {
      throw new AppError("unauthorized", `missing or invalid ${HEADER} header`);
    }
    await next();
  });
}
