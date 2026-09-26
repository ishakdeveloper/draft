import type { Json } from "@draft/shared/database";
import type { Db } from "./supabase";

export type EventStatus = "ok" | "skipped" | "error";

export interface EventScope {
  brand_id?: string | null;
  product_id?: string | null;
  draft_id?: string | null;
}

/** Records one pipeline_events row per step with its duration. Never throws: a failed log must not fail the step. */
export class StepRecorder {
  private readonly startedAt = Date.now();

  constructor(
    private readonly db: Db,
    private readonly step: string,
    private scope: EventScope = {},
    private readonly idempotencyKey: string | null = null,
  ) {}

  attach(scope: EventScope): void {
    this.scope = { ...this.scope, ...scope };
  }

  async finish(status: EventStatus, detail: unknown): Promise<void> {
    const { error } = await this.db.from("pipeline_events").insert({
      step: this.step,
      status,
      brand_id: this.scope.brand_id ?? null,
      product_id: this.scope.product_id ?? null,
      draft_id: this.scope.draft_id ?? null,
      idempotency_key: status === "error" ? null : this.idempotencyKey,
      duration_ms: Date.now() - this.startedAt,
      detail: detail as Json,
    });
    if (error) {
      console.error(
        JSON.stringify({
          message: "pipeline_events insert failed",
          step: this.step,
          error: error.message,
        }),
      );
    }
  }
}

/** A previous successful run of the same idempotent step, if any. */
export async function findCompleted(db: Db, idempotencyKey: string): Promise<Json | null> {
  const { data } = await db
    .from("pipeline_events")
    .select("detail")
    .eq("idempotency_key", idempotencyKey)
    .in("status", ["ok", "skipped"])
    .maybeSingle();
  return data?.detail ?? null;
}
