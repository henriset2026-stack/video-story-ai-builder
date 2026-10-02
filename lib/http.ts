import "server-only";
import type { z } from "zod";
import { AppError, logError, toAppError } from "@/lib/errors";

// Route-handler helpers: validated input, safe JSON errors, per-client keys and rate limiting.

const MAX_BODY_BYTES = 512 * 1024;

export function errorResponse(error: unknown, context: string): Response {
  const appError = toAppError(error);
  if (appError.status >= 500 || appError.code === "INTERNAL") logError(context, appError);
  return Response.json({ error: { code: appError.code, message: appError.userMessage } }, { status: appError.status });
}

/** Parses and validates a JSON body. The first validation message is safe to show users. */
export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new AppError("VALIDATION", { userMessage: "Request is too large." });

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("too large");
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new AppError("VALIDATION", { userMessage: "Invalid request body." });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", { userMessage: parsed.error.issues[0]?.message ?? "Invalid input." });
  }
  return parsed.data;
}

/** Best-effort client identifier for rate limiting (behind Vercel, x-forwarded-for is set by the platform). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "anonymous";
}

// ---- Rate limiting -----------------------------------------------------------------------------

export interface RateLimiter {
  /** Records a hit and returns whether it is allowed. */
  hit(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

/**
 * In-memory sliding window. Good enough for a single instance / development; on serverless each
 * instance keeps its own window, so swap in a shared store (e.g. Upstash Redis) behind this interface.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async hit(key: string) {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.ceil((this.windowMs - (now - recent[0])) / 1000) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.hits.delete(this.hits.keys().next().value!); // bound memory
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export const generationLimiter: RateLimiter = new MemoryRateLimiter(5, 60_000);
export const regenerationLimiter: RateLimiter = new MemoryRateLimiter(15, 60_000);

export async function enforceRateLimit(limiter: RateLimiter, request: Request): Promise<void> {
  const { allowed } = await limiter.hit(clientKey(request));
  if (!allowed) throw new AppError("RATE_LIMITED");
}
