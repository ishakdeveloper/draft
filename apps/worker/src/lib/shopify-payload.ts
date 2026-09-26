import { z } from "zod";

/** The subset of a Shopify products/create|update webhook payload the pipeline uses. */
export const ShopifyProductSchema = z.object({
  id: z.coerce.number().int().positive(),
  admin_graphql_api_id: z.string().optional(),
  title: z.string().min(1),
  body_html: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  product_type: z.string().nullable().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.string().nullable().optional(),
  updated_at: z.string().optional(),
});
export type ShopifyProduct = z.infer<typeof ShopifyProductSchema>;

export const IngestRequestSchema = z.object({
  topic: z.string().default("products/update"),
  shop_domain: z.string().min(1),
  product: ShopifyProductSchema.passthrough(),
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export function tagList(tags: ShopifyProduct["tags"]): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => t.trim()).filter(Boolean);
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function productGid(product: ShopifyProduct): string {
  return product.admin_graphql_api_id ?? `gid://shopify/Product/${product.id}`;
}
