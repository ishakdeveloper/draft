import { createApp, type Deps } from "./app";
import { readConfig, type WorkerEnv } from "./env";
import { createServiceClient } from "./lib/supabase";
import { ClaudeListingGenerator } from "./lib/generator";
import { createImageProvider } from "./lib/image";

function depsFromEnv({ env }: { env: unknown }): Deps {
  const config = readConfig(env as WorkerEnv);
  return {
    db: createServiceClient(config.supabaseUrl, config.supabaseServiceRoleKey),
    generator: new ClaudeListingGenerator(config.anthropicApiKey, config.claudeModel),
    pipelineSecret: config.pipelineSecret,
    appVersion: config.appVersion,
    shopify: {
      clientId: config.shopifyClientId,
      clientSecret: config.shopifyClientSecret,
      apiVersion: config.shopifyApiVersion,
    },
    productForward: { url: config.productWebhookUrl, secret: config.replaySecret },
    fetchImpl: (input, init) => fetch(input, init),
    images: createImageProvider(config.imageProvider, config.ai),
    imageDailyLimit: config.imageDailyLimit,
  };
}

const app = createApp(depsFromEnv);

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
