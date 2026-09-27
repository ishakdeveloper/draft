# Runbook

## Where things run

| Part       | Where                              | Deploy                                   |
| ---------- | ---------------------------------- | ---------------------------------------- |
| Worker     | Cloudflare Workers, `draft-worker` | `cd apps/worker && bunx wrangler deploy` |
| Review app | Vercel, project `draft-web`        | Push to `main` (Git integration)         |
| n8n        | Railway, n8n + Postgres template   | `bun run n8n:push` for workflows         |
| Database   | Supabase                           | Apply `supabase/migrations/*` in order   |

## Secrets

| Where                          | Names                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker (`wrangler secret put`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `PIPELINE_SECRET`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `REPLAY_SECRET` |
| Vercel                         | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                                 |
| n8n credentials                | Draft worker secret, Draft replay secret, Draft approval secret (see `n8n/README.md`)                                                              |
| n8n service (Railway)          | `N8N_ENCRYPTION_KEY` (back it up), `WEBHOOK_URL`, `N8N_HOST`, DB variables                                                                         |
| Supabase Vault                 | `n8n_draft_approved_url`, `n8n_webhook_secret`                                                                                                     |
| GitHub Actions                 | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TEST_REVIEWER_EMAIL`, `TEST_REVIEWER_PASSWORD`                                                        |

## Health checks

```sh
curl -s "$WORKER_URL/healthz"
curl -s "$N8N_BASE_URL/healthz"
```

## Common tasks

Re-run a step for a draft (every step is safe to repeat):

```sh
curl -X POST "$WORKER_URL/v1/drafts/<id>/generate"  -H "x-pipeline-secret: $PIPELINE_SECRET" -d '{"force":true}'
curl -X POST "$WORKER_URL/v1/drafts/<id>/translate" -H "x-pipeline-secret: $PIPELINE_SECRET" -d '{"force":true}'
curl -X POST "$WORKER_URL/v1/drafts/<id>/image"     -H "x-pipeline-secret: $PIPELINE_SECRET" -d '{"force":true}'
```

Publish an approved draft whose approval webhook was lost:

```sh
curl -X POST "$WORKER_URL/v1/drafts/<id>/publish" -H "x-pipeline-secret: $PIPELINE_SECRET"
```

Replay a product event without touching Shopify:

```sh
curl -X POST "$N8N_BASE_URL/webhook/replay-product" -H "x-replay-secret: $REPLAY_SECRET" \
  -H 'content-type: application/json' --data @apps/worker/fixtures/shopify-product.json
```

Re-register the store's product webhooks (after changing the Worker URL):

```sh
curl -X POST "$WORKER_URL/v1/shopify/webhooks/register" -H "x-pipeline-secret: $PIPELINE_SECRET" \
  -H 'content-type: application/json' \
  -d '{"shop_domain":"<store>.myshopify.com","callback_url":"'$WORKER_URL'/shopify/webhooks"}'
```

## Debugging a product that "did nothing"

1. `pipeline_events` for the product, newest first. Every step and every skip is a row with a
   reason (`brand_unknown`, `echo_of_publish`, `duplicate_source`, `in_flight`,
   `daily_limit_reached`).
2. n8n Executions for the workflow: node-by-node input, output and timing.
3. Worker logs (Cloudflare dashboard, Observability): structured JSON per request.
4. For publishes: `net._http_response` shows whether the approval webhook reached n8n.

## Rotating a secret

Change it in one place and its mirror together: `PIPELINE_SECRET` (Worker and the n8n "Draft
worker secret"), `REPLAY_SECRET` (Worker and "Draft replay secret"), the approval secret (Vault
`n8n_webhook_secret` and "Draft approval secret"). `SHOPIFY_CLIENT_SECRET` also signs webhooks,
so rotate it in the Dev Dashboard and the Worker at the same time.
