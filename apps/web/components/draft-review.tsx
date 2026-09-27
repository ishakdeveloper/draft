"use client";

import type { DraftStatus, ListingContent, Translations } from "@draft/shared";
import { useForm } from "@tanstack/react-form";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FieldErrors } from "@/components/field-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ReviewFormSchema, buildReviewUpdate, type ReviewIntent } from "@/lib/review";
import { sanitizeListingHtml } from "@/lib/sanitize-html";
import { createClient } from "@/lib/supabase/client";

interface Props {
  draftId: string;
  status: DraftStatus;
  defaultLocale: string;
  targetLocales: string[];
  content: ListingContent;
  translations: Translations;
  reviewNote: string | null;
}

const LOCALE_LABEL: Record<string, string> = {
  en: "English",
  de: "German",
  nl: "Dutch",
  fr: "French",
};

function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={over ? "text-destructive" : "text-muted-foreground"}>
      {value.length}/{max}
    </span>
  );
}

export function DraftReview({
  draftId,
  status,
  defaultLocale,
  targetLocales,
  content,
  translations,
  reviewNote,
}: Props) {
  const router = useRouter();
  const editable = status === "pending_review";

  const form = useForm({
    defaultValues: { content, review_note: reviewNote ?? "" },
    validators: { onSubmit: ReviewFormSchema },
    onSubmitMeta: { intent: "save" as ReviewIntent },
    onSubmit: async ({ value, meta }) => {
      const result = buildReviewUpdate(meta.intent, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Runs as the reviewer: RLS, the column grant and the transition trigger decide if this is allowed.
      const { data, error } = await createClient()
        .from("listing_drafts")
        .update(result.update)
        .eq("id", draftId)
        .eq("status", "pending_review")
        .select("id, status")
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) {
        toast.error("This draft is no longer waiting for review. The page has been refreshed.");
        router.refresh();
        return;
      }
      toast.success(
        meta.intent === "approve"
          ? "Approved. It will be written to Shopify."
          : meta.intent === "reject"
            ? "Rejected."
            : "Changes saved.",
      );
      router.refresh();
    },
  });

  const otherLocales = targetLocales.filter((l) => l !== defaultLocale);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit({ intent: "save" });
      }}
      className="space-y-6"
    >
      <Tabs defaultValue={defaultLocale}>
        <TabsList>
          <TabsTrigger value={defaultLocale}>
            {LOCALE_LABEL[defaultLocale] ?? defaultLocale}
          </TabsTrigger>
          {otherLocales.map((locale) => (
            <TabsTrigger key={locale} value={locale}>
              {LOCALE_LABEL[locale] ?? locale}
              {translations[locale as keyof Translations] ? null : (
                <span className="ml-1 text-muted-foreground">·</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={defaultLocale} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Proposed listing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <form.Field name="content.title">
                {(field) => (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <Label htmlFor={field.name}>Title</Label>
                      <CharCount value={field.state.value} max={70} />
                    </div>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      disabled={!editable}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <FieldErrors errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>

              <form.Field name="content.description_html">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={field.name}>Description</Label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Textarea
                        id={field.name}
                        rows={8}
                        className="font-mono text-xs"
                        value={field.state.value}
                        disabled={!editable}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <div
                        aria-label="Description preview"
                        className="listing-html rounded-md border bg-muted/40 p-3 text-sm"
                        dangerouslySetInnerHTML={{ __html: sanitizeListingHtml(field.state.value) }}
                      />
                    </div>
                    <FieldErrors errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>

              <form.Field name="content.bullets" mode="array">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label>Key points</Label>
                    <ul className="space-y-2">
                      {field.state.value.map((_, i) => (
                        <li key={i} className="flex gap-2">
                          <form.Field name={`content.bullets[${i}]`}>
                            {(sub) => (
                              <Input
                                aria-label={`Key point ${i + 1}`}
                                value={sub.state.value}
                                disabled={!editable}
                                onBlur={sub.handleBlur}
                                onChange={(e) => sub.handleChange(e.target.value)}
                              />
                            )}
                          </form.Field>
                          {editable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove key point ${i + 1}`}
                              disabled={field.state.value.length <= 3}
                              onClick={() => field.removeValue(i)}
                            >
                              <X />
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {editable && field.state.value.length < 6 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => field.pushValue("")}
                      >
                        <Plus /> Add key point
                      </Button>
                    ) : null}
                    <FieldErrors errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>

              <div className="grid gap-4 md:grid-cols-2">
                <form.Field name="content.seo_title">
                  {(field) => (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <Label htmlFor={field.name}>SEO title</Label>
                        <CharCount value={field.state.value} max={60} />
                      </div>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        disabled={!editable}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <FieldErrors errors={field.state.meta.errors} />
                    </div>
                  )}
                </form.Field>
                <form.Field name="content.seo_description">
                  {(field) => (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <Label htmlFor={field.name}>SEO description</Label>
                        <CharCount value={field.state.value} max={155} />
                      </div>
                      <Textarea
                        id={field.name}
                        rows={3}
                        value={field.state.value}
                        disabled={!editable}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <FieldErrors errors={field.state.meta.errors} />
                    </div>
                  )}
                </form.Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {otherLocales.map((locale) => {
          const t = translations[locale as keyof Translations];
          return (
            <TabsContent key={locale} value={locale} className="mt-4">
              <Card>
                <CardContent className="space-y-3 py-6 text-sm">
                  {t ? (
                    <>
                      <p className="font-medium">{t.title}</p>
                      <div
                        className="listing-html"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeListingHtml(t.description_html),
                        }}
                      />
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {t.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Not translated yet. The {LOCALE_LABEL[locale] ?? locale} version appears here
                      when the translate step runs.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <Card>
        <CardContent className="space-y-4 py-5">
          <form.Field name="review_note">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Note {editable ? "(required to reject)" : null}</Label>
                <Textarea
                  id={field.name}
                  rows={2}
                  placeholder={editable ? "What should change, or why this is good to go" : ""}
                  value={field.state.value}
                  disabled={!editable}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          {editable ? (
            <form.Subscribe selector={(s) => [s.isSubmitting, s.isDirty] as const}>
              {([submitting, dirty]) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => void form.handleSubmit({ intent: "approve" })}
                  >
                    Approve and publish
                  </Button>
                  <Button type="submit" variant="outline" disabled={submitting || !dirty}>
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-auto text-destructive hover:text-destructive"
                    disabled={submitting}
                    onClick={() => void form.handleSubmit({ intent: "reject" })}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </form.Subscribe>
          ) : (
            <p className="text-sm text-muted-foreground">
              {status === "approved"
                ? "Approved. Waiting for the store update to finish."
                : status === "published"
                  ? "This version is live in the store."
                  : "This version can no longer be edited."}
            </p>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
