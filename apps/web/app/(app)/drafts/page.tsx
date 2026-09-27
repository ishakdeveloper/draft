import Link from "next/link";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countDraftsByStatus, listBrands, listDrafts } from "@/lib/queries";
import { STATUS_TABS, isDraftStatus, parseContent, timeAgo } from "@/lib/review";
import { cn } from "@/lib/utils";

export const metadata = { title: "Review queue" };

type SearchParams = Promise<{ status?: string; brand?: string }>;

function href(status: string, brand: string | null) {
  const params = new URLSearchParams({ status });
  if (brand) params.set("brand", brand);
  return `/drafts?${params.toString()}`;
}

export default async function DraftsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = isDraftStatus(params.status) ? params.status : "pending_review";
  const brands = await listBrands();
  const brand = brands.find((b) => b.slug === params.brand) ?? null;

  const [counts, drafts] = await Promise.all([
    countDraftsByStatus(brand?.id ?? null),
    listDrafts(status, brand?.id ?? null),
  ]);

  return (
    <div className="space-y-6">
      <RealtimeRefresh />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listings written from Shopify products. Nothing is published until you approve it.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by brand">
          <Link
            href={href(status, null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              !brand ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            All brands
          </Link>
          {brands.map((b) => (
            <Link
              key={b.id}
              href={href(status, b.slug)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                brand?.id === b.id
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              {b.name}
            </Link>
          ))}
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b [scrollbar-width:none]"
        aria-label="Status"
      >
        {STATUS_TABS.map((tab) => {
          const active = tab.status === status;
          const count = counts.get(tab.status) ?? 0;
          return (
            <Link
              key={tab.status}
              href={href(tab.status, brand?.slug ?? null)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                active
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Nothing here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "pending_review"
              ? "When a product is created or edited in Shopify, its new listing shows up here."
              : "No drafts with this status yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden md:table-cell">Proposed title</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((d) => (
                <TableRow key={d.id} className="group">
                  <TableCell>
                    <Link href={`/drafts/${d.id}`} className="font-medium group-hover:underline">
                      {d.product.title}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      v{d.version}
                    </span>
                    {d.product.product_type ? (
                      <p className="text-xs text-muted-foreground">{d.product.product_type}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                    {parseContent(d.content)?.title ?? "–"}
                  </TableCell>
                  <TableCell className="text-sm">{d.brand.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                    {timeAgo(d.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
