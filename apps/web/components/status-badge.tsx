import type { DraftStatus } from "@draft/shared";
import { cn } from "@/lib/utils";

const STYLES: Record<DraftStatus, { label: string; className: string }> = {
  drafting: { label: "Drafting", className: "bg-muted text-muted-foreground" },
  pending_review: {
    label: "To review",
    className: "bg-warning/15 text-foreground ring-warning/40",
  },
  approved: { label: "Approved", className: "bg-accent text-accent-foreground ring-primary/20" },
  published: { label: "Published", className: "bg-success/15 text-foreground ring-success/40" },
  rejected: {
    label: "Rejected",
    className: "bg-muted text-muted-foreground line-through decoration-1",
  },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive ring-destructive/30" },
};

export function StatusBadge({ status, className }: { status: DraftStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-transparent ring-inset",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
