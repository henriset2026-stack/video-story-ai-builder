// Application errors with safe, user-facing messages. Internal details stay in `cause`
// and are only ever written to server logs (never returned to the client).

export const ERROR_CODES = {
  VALIDATION: { status: 400, message: "Please check your input and try again." },
  NOT_FOUND: { status: 404, message: "This project doesn't exist or was deleted." },
  RATE_LIMITED: {
    status: 429,
    message: "You're creating videos too quickly. Please wait a moment and try again.",
  },
  AI_FAILED: {
    status: 502,
    message: "Something went wrong while creating your story. Please try again.",
  },
  AI_INVALID_RESPONSE: {
    status: 502,
    message: "Something went wrong while creating your story. Please try again.",
  },
  AI_TIMEOUT: { status: 504, message: "The AI took too long to respond. Please try again." },
  AI_RATE_LIMITED: {
    status: 503,
    message: "The AI service is busy right now. Please wait a minute and try again.",
  },
  DB_FAILED: {
    status: 503,
    message: "We couldn't reach the project database. Please try again.",
  },
  INTERNAL: { status: 500, message: "Something went wrong. Please try again." },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Safe to show to users. */
  readonly userMessage: string;

  constructor(code: ErrorCode, options: { userMessage?: string; cause?: unknown; detail?: string } = {}) {
    super(options.detail ?? code, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code].status;
    this.userMessage = options.userMessage ?? ERROR_CODES[code].message;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new AppError("AI_TIMEOUT", { cause: error });
  }
  return new AppError("INTERNAL", { cause: error });
}

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, // PEM keys (Firebase service accounts)
  /sk-[a-zA-Z0-9_-]{10,}/g, // OpenAI / Anthropic / router style keys
  /AIza[0-9A-Za-z_-]{20,}/g, // Google API keys
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWTs / OAuth tokens
];

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, "[redacted]"), value);
}

/** Server-side log with secrets redacted. Never log request bodies or env values. */
export function logError(context: string, error: unknown): void {
  const appError = error instanceof AppError ? error : null;
  const root = appError?.cause ?? error;
  const message = root instanceof Error ? `${root.name}: ${root.message}` : String(root);
  console.error(`[${context}]${appError ? ` ${appError.code}` : ""} ${redactSecrets(message)}`);
}
