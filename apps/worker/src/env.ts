/**
 * The one place that reads the Worker environment. `Env` comes from `wrangler types`
 * (bindings and vars); secrets are declared here because they are not in wrangler.jsonc.
 */
const SECRET_NAMES = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PIPELINE_SECRET"] as const;

type SecretName = (typeof SECRET_NAMES)[number];
export type Secrets = Record<SecretName, string> & {
  /** Only needed by the generate step; ingest and fail work without it. */
  ANTHROPIC_API_KEY?: string;
  /** Only needed when MODEL_PROVIDER is openai. */
  OPENAI_API_KEY?: string;
  SHOPIFY_CLIENT_ID?: string;
  SHOPIFY_CLIENT_SECRET?: string;
  /** Header secret n8n expects on its product webhook. */
  REPLAY_SECRET?: string;
};

export type WorkerEnv = Env & Secrets;

export interface Config {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  anthropicApiKey: string | null;
  pipelineSecret: string;
  claudeModel: string;
  modelProvider: string;
  openaiApiKey: string | null;
  openaiModel: string;
  shopifyApiVersion: string;
  appVersion: string;
  imageProvider: string;
  imageDailyLimit: number;
  ai: Ai;
  shopifyClientId: string | null;
  shopifyClientSecret: string | null;
  productWebhookUrl: string;
  replaySecret: string | null;
}

export class MissingSecretError extends Error {
  constructor(public readonly names: string[]) {
    super(`missing secrets: ${names.join(", ")}`);
  }
}

export function readConfig(env: WorkerEnv): Config {
  const missing = SECRET_NAMES.filter((name) => !env[name]);
  if (missing.length > 0) throw new MissingSecretError(missing);
  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? null,
    pipelineSecret: env.PIPELINE_SECRET,
    claudeModel: env.CLAUDE_MODEL,
    modelProvider: env.MODEL_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY ?? null,
    openaiModel: env.OPENAI_MODEL,
    shopifyApiVersion: env.SHOPIFY_API_VERSION,
    appVersion: env.APP_VERSION,
    imageProvider: env.IMAGE_PROVIDER,
    imageDailyLimit: Number(env.IMAGE_DAILY_LIMIT) || 40,
    ai: env.AI,
    shopifyClientId: env.SHOPIFY_CLIENT_ID ?? null,
    shopifyClientSecret: env.SHOPIFY_CLIENT_SECRET ?? null,
    productWebhookUrl: env.N8N_PRODUCT_WEBHOOK_URL,
    replaySecret: env.REPLAY_SECRET ?? null,
  };
}
