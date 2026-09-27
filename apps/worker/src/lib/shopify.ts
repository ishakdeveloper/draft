import { AppError } from "./errors";
import type { Db } from "./supabase";

/** The part of fetch the Worker uses, so tests can pass a plain function. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ShopifySettings {
  clientId: string | null;
  clientSecret: string | null;
  apiVersion: string;
}

const REFRESH_MARGIN_MS = 10 * 60 * 1000;

function base64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Constant-time string comparison over equal-length hashes. */
async function equalSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= (xa[i] ?? 0) ^ (ya[i] ?? 0);
  return diff === 0;
}

/** Shopify signs each webhook body with the app's client secret (HMAC-SHA256, base64). */
export async function verifyShopifyHmac(
  rawBody: ArrayBuffer,
  header: string | null | undefined,
  clientSecret: string,
): Promise<boolean> {
  if (!header) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = base64(await crypto.subtle.sign("HMAC", key, rawBody));
  return equalSecret(header, expected);
}

export function requireShopifyCredentials(settings: ShopifySettings): {
  clientId: string;
  clientSecret: string;
} {
  if (!settings.clientId || !settings.clientSecret) {
    throw new AppError("config", "SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set");
  }
  return { clientId: settings.clientId, clientSecret: settings.clientSecret };
}

/**
 * Access token for a brand's shop. Dev Dashboard apps get 24 hour tokens through the
 * client-credentials grant, so the token is cached in brand_secrets (service role only)
 * and refreshed ten minutes before it expires.
 */
export async function getAccessToken(
  db: Db,
  brand: { id: string; shopify_domain: string },
  settings: ShopifySettings,
  fetchImpl: FetchLike = (i, init) => fetch(i, init),
): Promise<string> {
  const { data: cached } = await db
    .from("brand_secrets")
    .select("shopify_access_token, token_expires_at")
    .eq("brand_id", brand.id)
    .maybeSingle();
  if (
    cached?.shopify_access_token &&
    (!cached.token_expires_at ||
      Date.parse(cached.token_expires_at) - Date.now() > REFRESH_MARGIN_MS)
  ) {
    return cached.shopify_access_token;
  }

  const { clientId, clientSecret } = requireShopifyCredentials(settings);
  const res = await fetchImpl(`https://${brand.shopify_domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  } | null;
  if (!res.ok || !body?.access_token) {
    throw new AppError(
      "shopify_failed",
      `token request failed (${res.status}): ${body?.error ?? "no token"}`,
    );
  }

  const expiresAt = body.expires_in
    ? new Date(Date.now() + body.expires_in * 1000).toISOString()
    : null;
  const { error } = await db.from("brand_secrets").upsert({
    brand_id: brand.id,
    shopify_access_token: body.access_token,
    token_expires_at: expiresAt,
  });
  if (error)
    console.error(JSON.stringify({ message: "token cache write failed", error: error.message }));
  return body.access_token;
}

export interface GraphqlResult<T> {
  data: T;
  apiVersion: string | null;
}

export async function shopifyGraphql<T>(
  shop: string,
  token: string,
  apiVersion: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: FetchLike = (i, init) => fetch(i, init),
): Promise<GraphqlResult<T>> {
  const res = await fetchImpl(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": token },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) throw new AppError("shopify_failed", `shopify ${res.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length || !body.data) {
    throw new AppError(
      "shopify_failed",
      body.errors?.map((e) => e.message).join("; ") ?? "empty response",
    );
  }
  return { data: body.data, apiVersion: res.headers.get("x-shopify-api-version") };
}

export const PRODUCT_UPDATE = /* GraphQL */ `
  mutation DraftPublish($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        title
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const WEBHOOK_CREATE = /* GraphQL */ `
  mutation DraftWebhook($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
      webhookSubscription {
        id
        topic
      }
      userErrors {
        field
        message
      }
    }
  }
`;
