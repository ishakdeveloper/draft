import type { PipelineEvent } from "@/lib/queries";
import { formatDuration } from "@/lib/review";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<string, string> = {
  ingest: "Received from Shopify",
  generate: "Listing written",
  translate: "Translated",
  image: "Hero image",
  fail: "Marked failed",
  "publish.prepare": "Publish prepared",
  "publish.complete": "Published to Shopify",
};

const DOT: Record<string, string> = {
  ok: "bg-success",
  skipped: "bg-muted-foreground/50",
  error: "bg-destructive",
  started: "bg-warning",
};

function describe(event: PipelineEvent): string | null {
  const detail = (event.detail ?? {}) as Record<string, unknown>;
  if (typeof detail.reason === "string") return detail.reason.replaceAll("_", " ");
  if (typeof detail.message === "string") return detail.message;
  if (typeof detail.model === "string" && detail.model !== "seed") return detail.model;
  return null;
}

export function PipelineTimeline({ events }: { events: PipelineEvent[] }) {
  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">No pipeline activity yet.</p>;
  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const note = describe(event);
        return (
          <li key={event.id} className="flex gap-3 text-sm">
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[event.status] ?? "bg-muted")}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{STEP_LABEL[event.step] ?? event.step}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {formatDuration(event.duration_ms)}
                </span>
              </div>
              {note ? (
                <p className="truncate text-xs text-muted-foreground" title={note}>
                  {note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
