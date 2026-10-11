import "server-only";
import { z } from "zod";

// Validated server configuration. Server-only: importing this from a Client Component fails the build,
// so secrets such as AI_PROVIDER_API_KEY and FIREBASE_PRIVATE_KEY can never reach the browser.

export const AI_PROVIDERS = ["anthropic", "openai", "gemini"] as const;
export type AIProviderName = (typeof AI_PROVIDERS)[number];

export const DEFAULT_MODELS: Record<AIProviderName, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5-mini",
  gemini: "gemini-2.5-flash",
};

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const EnvSchema = z.object({
  AI_PROVIDER: z.enum(AI_PROVIDERS).default("anthropic"),
  AI_PROVIDER_API_KEY: optionalString,
  AI_MODEL: optionalString,
  /** OpenAI-compatible endpoint (e.g. an AI router). Only used when AI_PROVIDER=openai. */
  AI_BASE_URL: z
    .url({ protocol: /^https$/, error: "AI_BASE_URL must be an https URL" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  AI_MOCK_MODE: bool,
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(600_000).default(120_000),
  AI_MOCK_LATENCY_MS: z.coerce.number().int().min(0).max(5_000).default(250),
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: optionalString,
  /** Service-account private key. Hosts often store it with literal "\n"; those are restored below. */
  FIREBASE_PRIVATE_KEY: optionalString,
  /** Set by the Firebase emulator (e.g. "127.0.0.1:8080"); the Admin SDK then needs no credentials. */
  FIRESTORE_EMULATOR_HOST: optionalString,
  STORAGE_DRIVER: z.enum(["firestore", "local"]).optional(),
  LOCAL_DATA_DIR: z.string().default(".data"),
});

export interface AppConfig {
  ai: {
    provider: AIProviderName;
    apiKey: string | undefined;
    model: string;
    /** Base URL for the OpenAI-compatible provider, without a trailing slash. */
    baseUrl: string | undefined;
    /** True when AI_MOCK_MODE is set or no API key is configured. */
    mock: boolean;
    mockReason: "env" | "missing-key" | null;
    timeoutMs: number;
    mockLatencyMs: number;
  };
  storage: {
    driver: "firestore" | "local";
    firebase: {
      projectId: string | undefined;
      clientEmail: string | undefined;
      privateKey: string | undefined;
      usingEmulator: boolean;
    };
    localDataDir: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Report which variables are wrong without echoing their values.
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Invalid environment configuration: ${keys}`);
  }
  const e = parsed.data;
  const usingEmulator = Boolean(e.FIRESTORE_EMULATOR_HOST);
  const firestoreConfigured = Boolean(
    e.FIREBASE_PROJECT_ID && (usingEmulator || (e.FIREBASE_CLIENT_EMAIL && e.FIREBASE_PRIVATE_KEY)),
  );
  const mockReason = e.AI_MOCK_MODE ? "env" : !e.AI_PROVIDER_API_KEY ? "missing-key" : null;

  return {
    ai: {
      provider: e.AI_PROVIDER,
      apiKey: e.AI_PROVIDER_API_KEY,
      model: e.AI_MODEL ?? DEFAULT_MODELS[e.AI_PROVIDER],
      baseUrl: e.AI_BASE_URL?.replace(/\/+$/, ""),
      mock: mockReason !== null,
      mockReason,
      timeoutMs: e.AI_TIMEOUT_MS,
      mockLatencyMs: e.AI_MOCK_LATENCY_MS,
    },
    storage: {
      driver: e.STORAGE_DRIVER ?? (firestoreConfigured ? "firestore" : "local"),
      firebase: {
        projectId: e.FIREBASE_PROJECT_ID,
        clientEmail: e.FIREBASE_CLIENT_EMAIL,
        privateKey: e.FIREBASE_PRIVATE_KEY?.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n"),
        usingEmulator,
      },
      localDataDir: e.LOCAL_DATA_DIR,
    },
  };
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

/** Non-secret view of the configuration, safe to render on the Settings page. */
export function getPublicStatus() {
  const c = getConfig();
  return {
    aiProvider: c.ai.mock ? "mock" : c.ai.provider,
    aiModel: c.ai.mock ? "deterministic mock data" : c.ai.model,
    /** Host only (never the full URL or key), e.g. "router.bynara.id". */
    aiHost: !c.ai.mock && c.ai.provider === "openai" && c.ai.baseUrl ? new URL(c.ai.baseUrl).host : null,
    mockMode: c.ai.mock,
    mockReason: c.ai.mockReason,
    storage: c.storage.driver,
    firestoreConfigured: Boolean(
      c.storage.firebase.projectId &&
        (c.storage.firebase.usingEmulator || (c.storage.firebase.clientEmail && c.storage.firebase.privateKey)),
    ),
    /** Firebase project id is not secret; shown so operators can confirm which project is in use. */
    firebaseProjectId: c.storage.driver === "firestore" ? (c.storage.firebase.projectId ?? null) : null,
  };
}
