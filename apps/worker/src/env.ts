/**
 * The one place that reads the Worker environment. `Env` comes from `wrangler types`
 * (bindings and vars); secrets are declared here because they are not in wrangler.jsonc.
 */
const SECRET_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "PIPELINE_SECRET",
] as const;

type SecretName = (typeof SECRET_NAMES)[number];
export type Secrets = Record<SecretName, string> & {
  SHOPIFY_CLIENT_ID?: string;
  SHOPIFY_CLIENT_SECRET?: string;
};

export type WorkerEnv = Env & Secrets;

export interface Config {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  anthropicApiKey: string;
  pipelineSecret: string;
  claudeModel: string;
  shopifyApiVersion: string;
  appVersion: string;
  imageProvider: string;
  imageDailyLimit: number;
  ai: Ai;
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
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    pipelineSecret: env.PIPELINE_SECRET,
    claudeModel: env.CLAUDE_MODEL,
    shopifyApiVersion: env.SHOPIFY_API_VERSION,
    appVersion: env.APP_VERSION,
    imageProvider: env.IMAGE_PROVIDER,
    imageDailyLimit: Number(env.IMAGE_DAILY_LIMIT) || 40,
    ai: env.AI,
  };
}
