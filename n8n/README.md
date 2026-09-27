# n8n workflows

The workflows in `workflows/` are the source of truth. They are pushed to the n8n instance
with `bun run n8n:push` and pulled back with `bun run n8n:export`, so the JSON in git always
matches what runs.

## Placeholders

| Placeholder       | Resolved from                                                                 |
| ----------------- | ----------------------------------------------------------------------------- |
| `${WORKER_URL}`   | `WORKER_URL` in the root `.env`                                               |
| `{{CRED:<name>}}` | the n8n credential with that name, created from `credentials.json` if missing |

Credential values never live in the JSON. `credentials.json` names each credential and reads its
secret from the environment:

| Credential          | Type                            | Environment variable                                                          |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| Draft worker secret | Header auth `x-pipeline-secret` | `PIPELINE_SECRET` (same value as the Worker secret)                           |
| Draft replay secret | Header auth `x-replay-secret`   | `REPLAY_SECRET`                                                               |
| Shopify             | Shopify access token            | created by hand in the n8n UI (store subdomain, offline token, client secret) |

Root `.env` (gitignored) also needs `N8N_BASE_URL` and `N8N_API_KEY` (n8n Settings, API).

## Workflows

**01 Shopify product to draft.** Entry point: `POST /webhook/replay-product` with
`{ topic, shop_domain, product }`. The Worker posts here after verifying a Shopify
`products/create` or `products/update` webhook; the same endpoint replays a captured payload.
Steps: normalize the payload, call the Worker's ingest route, branch on `draft_created`, then
generate. Every HTTP node has a timeout and retries; the generate node's error output calls the
Worker's fail route so a draft never stays stuck in `drafting`.

Replay a payload:

```sh
curl -X POST "$N8N_BASE_URL/webhook/replay-product" \
  -H "x-replay-secret: $REPLAY_SECRET" -H 'content-type: application/json' \
  --data @apps/worker/fixtures/shopify-product.json
```

**02 Approved draft to Shopify.** Entry point: `POST /webhook/draft-approved`, called by the
`private.notify_draft_approved()` trigger through pg_net when a reviewer approves. It checks the
status really changed to `approved`, calls the Worker's publish route with retries, and marks
the draft failed if publishing gives up. pg_net does not retry, so the Worker route is safe to
call again by hand:

```sh
curl -X POST "$WORKER_URL/v1/drafts/<draft id>/publish" -H "x-pipeline-secret: $PIPELINE_SECRET"
```

## Shopify setup

The store's product webhooks point at the Worker (`/shopify/webhooks`), not at n8n. Register
them once, or again after changing the Worker URL:

```sh
curl -X POST "$WORKER_URL/v1/shopify/webhooks/register" -H "x-pipeline-secret: $PIPELINE_SECRET" \
  -H 'content-type: application/json' \
  -d '{"shop_domain":"<store>.myshopify.com","callback_url":"'$WORKER_URL'/shopify/webhooks"}'
```

## Instance settings

Railway variables that matter on the n8n service: `N8N_ENCRYPTION_KEY` (back it up; losing it
makes every stored credential unreadable), `N8N_HOST`, `N8N_PROTOCOL=https`, `WEBHOOK_URL`,
`N8N_EDITOR_BASE_URL`, `N8N_EXPRESS_TRUST_PROXY=true`, `N8N_PROXY_HOPS=1`, `PORT=5678`,
`GENERIC_TIMEZONE`, and the `DB_POSTGRESDB_*` variables pointing at the Postgres service over
the private network.
