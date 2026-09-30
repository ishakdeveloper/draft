import type { VerifiedClaim } from "@draft/shared";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description_html: "Description",
  bullets: "Key points",
  seo_title: "SEO title",
  seo_description: "SEO description",
};

/**
 * What the source does and does not support. Deliberately advisory: it never blocks approval,
 * it tells the reviewer which sentences to look at.
 */
export function ClaimReport({
  claims,
  checkedAt,
}: {
  claims: VerifiedClaim[] | null;
  checkedAt: string | null;
}) {
  if (!claims) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fact check</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {checkedAt ? "No statements were found to check." : "Not checked yet."}
        </CardContent>
      </Card>
    );
  }

  const unverified = claims.filter((c) => !c.verified);
  const verified = claims.filter((c) => c.verified);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Fact check</span>
          <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
            {verified.length}/{claims.length} supported
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {unverified.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleCheck size={14} className="text-success" />
            Every statement is backed by the product text.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <CircleAlert size={14} className="text-warning" />
              {unverified.length} statement{unverified.length === 1 ? "" : "s"} the product text
              does not support
            </p>
            <ul className="space-y-2">
              {unverified.map((claim, i) => (
                <li
                  key={`${claim.field}-${i}`}
                  className="rounded-md border border-warning/40 bg-warning/5 p-2.5"
                >
                  <p className="text-sm">{claim.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {FIELD_LABEL[claim.field] ?? claim.field}
                    {claim.note ? ` · ${claim.note}` : null}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Either edit them out, or approve anyway if you know they are true. This never blocks
              approval.
            </p>
          </div>
        )}

        {verified.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {verified.length} supported statement{verified.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1.5">
              {verified.map((claim, i) => (
                <li key={`${claim.field}-${i}`} className="text-xs">
                  <span className="text-foreground">{claim.text}</span>
                  {claim.source_span ? (
                    <span className="text-muted-foreground"> · source: “{claim.source_span}”</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
