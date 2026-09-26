# Conventions

## Layout and naming

- Bun workspaces: `apps/*`, `packages/*`. Scripts run through `bun run`.
- File names are kebab-case (`draft-review.tsx`, `content-hash.ts`). No PascalCase files.
- Tests live in a `__tests__` folder beside the code they cover, named `*.test.ts`, and use `bun:test`.

## Configuration

- Each app reads environment in exactly one typed place (`apps/worker/src/env.ts`,
  `apps/web/lib/env.ts`). Nothing else touches `process.env` or the Workers `env`.
- Only `NEXT_PUBLIC_*` reaches the browser. The service role key exists in the worker only.

## Database

- Plain SQL migrations in `supabase/migrations`, numbered `NNNN_name.sql`, applied to the
  linked remote project. No local Supabase stack.
- Every tenant table has RLS on. Policies call `private.is_brand_member()` and wrap
  `auth.uid()` in a subselect. Helper functions live in the `private` schema.
- Status transitions are enforced in `private.enforce_draft_transition()` and mirrored in
  `packages/shared/src/transitions.ts`. Change both together.
- Types are generated, never hand-written: `bun run db:types`.

## Pipeline rules

- Nothing in code promotes a draft to `approved`. Only a signed-in reviewer does.
- Every worker step is idempotent and records a `pipeline_events` row.
- The idempotency marker (`publish_hash`) is written before the outbound Shopify call.
- External adapters sit behind an interface with a stub default (`ImageProvider`).

## Web

- Server components do the auth guard and the reads. Every write is a client form
  hitting Supabase under RLS. No server actions for writes.
- shadcn/ui primitives with theme tokens; TanStack Form + Zod for forms.

## Copy

- Plain language. No em dashes in user-facing text.

## Gate

- `bun run gate` must be green before a commit. One commit per slice of work.
- Commit messages describe the code change only.
