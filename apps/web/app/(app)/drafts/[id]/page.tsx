import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftReview } from "@/components/draft-review";
import { ClaimReport } from "@/components/claim-report";
import { PipelineTimeline } from "@/components/pipeline-timeline";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDraft, heroImageUrl, listEvents } from "@/lib/queries";
import { parseClaims, parseContent, parseTranslations, timeAgo } from "@/lib/review";
import { sanitizeListingHtml } from "@/lib/sanitize-html";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = UUID.test(id) ? await getDraft(id) : null;
  return { title: draft ? draft.product.title : "Draft" };
}

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const draft = await getDraft(id);
  if (!draft) notFound();

  const [events, imageUrl] = await Promise.all([
    listEvents(draft.id),
    heroImageUrl(draft.image_path),
  ]);
  const content = parseContent(draft.content);
  const claims = parseClaims(draft.claims);
  const translations = parseTranslations(draft.translations);
  const failure = (draft.error ?? null) as { message?: string; step?: string } | null;

  return (
    <div className="space-y-6">
      <RealtimeRefresh draftId={draft.id} />

      <div>
        <Link href="/drafts" className="text-sm text-muted-foreground hover:text-foreground">
          ← Review queue
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{draft.product.title}</h1>
          <StatusBadge status={draft.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {draft.brand.name} · version {draft.version} · created {timeAgo(draft.created_at)}
          {draft.model && draft.model !== "seed" ? <> · written by {draft.model}</> : null}
        </p>
      </div>

      {failure?.message ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p className="font-medium text-destructive">
            The {failure.step ?? "pipeline"} step failed
          </p>
          <p className="mt-1 break-words text-muted-foreground">{failure.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {content ? (
            <DraftReview
              draftId={draft.id}
              status={draft.status}
              defaultLocale={draft.brand.default_locale}
              targetLocales={draft.brand.target_locales}
              content={content}
              translations={translations}
              reviewNote={draft.review_note}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {draft.status === "drafting"
                  ? "The listing is being written. This page updates when it is ready."
                  : "No listing was written for this version."}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <ClaimReport claims={claims} checkedAt={draft.claims_checked_at} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Shopify listing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">{draft.product.title}</p>
              <div
                className="listing-html text-muted-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitizeListingHtml(draft.product.body_html) || "<p>Empty</p>",
                }}
              />
              {draft.product.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {draft.product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Hero image</CardTitle>
            </CardHeader>
            <CardContent>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Generated image for ${draft.product.title}`}
                  className="aspect-square w-full rounded-md object-cover"
                />
              ) : (
                <div className="grid aspect-square place-items-center rounded-md border border-dashed text-xs text-muted-foreground">
                  No image yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <PipelineTimeline events={events} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
