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

**01 Shopify product to draft.** Entry points: the Shopify triggers (`products/create`,
`products/update`) and a `POST /webhook/replay-product` webhook that accepts the same
`{ topic, shop_domain, product }` body the Worker takes, for replaying a captured payload.
Steps: normalize the payload, call the Worker's ingest route, branch on `draft_created`, then
generate. Every HTTP node has a timeout and retries; the generate node's error output calls the
Worker's fail route so a draft never stays stuck in `drafting`.

Replay a payload:

```sh
curl -X POST "$N8N_BASE_URL/webhook/replay-product" \
  -H "x-replay-secret: $REPLAY_SECRET" -H 'content-type: application/json' \
  --data @apps/worker/fixtures/shopify-product.json
```

## Instance settings

Railway variables that matter on the n8n service: `N8N_ENCRYPTION_KEY` (back it up; losing it
makes every stored credential unreadable), `N8N_HOST`, `N8N_PROTOCOL=https`, `WEBHOOK_URL`,
`N8N_EDITOR_BASE_URL`, `N8N_EXPRESS_TRUST_PROXY=true`, `N8N_PROXY_HOPS=1`, `PORT=5678`,
`GENERIC_TIMEZONE`, and the `DB_POSTGRESDB_*` variables pointing at the Postgres service over
the private network.
