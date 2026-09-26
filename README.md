# Draft

Draft turns a product in Shopify into a reviewed, multi-language listing. When a
product is created or updated, a pipeline writes the listing copy in the brand's
voice, translates it, renders a hero image, and queues the result for a reviewer.
Approved listings are written back to Shopify. Nothing reaches the store without a
person approving it.

## Parts

| Path              | What it is                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/worker`     | Cloudflare Worker (Hono, TypeScript). Owns the pipeline: ingest, generate, translate, image, publish. Idempotent per step. |
| `apps/web`        | Next.js review app. Supabase Auth, row level security per brand, live updates.                                             |
| `packages/shared` | Zod schemas, content hash, ingest decision and status transitions shared by worker and web.                                |
| `supabase/`       | Migrations (schema, RLS, storage, realtime, approval webhook) and seed.                                                    |
| `n8n/`            | Exported workflows that connect Shopify webhooks to the worker and approvals back to Shopify.                              |
| `docs/`           | Architecture, runbook, walkthrough.                                                                                        |

## Flow

1. Shopify fires `products/create` or `products/update` to n8n.
2. n8n calls the worker's ingest route. The worker maps the product's vendor to a
   brand and hashes title and body. Echoes of its own publish and edits that do not
   change the copy are skipped and logged.
3. n8n calls generate, translate and image in turn. Each step writes to Supabase and
   records a `pipeline_events` row.
4. A reviewer sees the draft appear in the web app, edits it, and approves or
   rejects it. Row level security scopes everything to the reviewer's brands; a
   database trigger allows only the approve and reject transitions from a user.
5. Approval fires a database webhook to n8n, which asks the worker for the publish
   payload, updates the Shopify product, and marks the draft published.

## Development

```sh
bun install
bun run gate          # format, typecheck, lint, secret scan, tests
```

Migrations are applied and `packages/shared/src/database.types.ts` is regenerated through the
Supabase MCP (`apply_migration`, `generate_typescript_types`), see AGENTS.md.

Environment variables are listed in each app's `.env.example`. Secrets never go in
the repo.
