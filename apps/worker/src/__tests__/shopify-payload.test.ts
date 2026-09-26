import { describe, expect, it } from "bun:test";
import fixture from "../../fixtures/shopify-product.json";
import { IngestRequestSchema, productGid, tagList } from "../lib/shopify-payload";

describe("IngestRequestSchema", () => {
  it("accepts the fixture and keeps extra fields", () => {
    const parsed = IngestRequestSchema.parse(fixture);
    expect(parsed.product.id).toBe(9000000000002);
    expect(parsed.product.vendor).toBe("Nordkind Skin");
  });
  it("rejects a product without a title", () => {
    expect(IngestRequestSchema.safeParse({ shop_domain: "x", product: { id: 1 } }).success).toBe(
      false,
    );
  });
});

describe("tagList", () => {
  it("splits Shopify's comma string and trims", () => {
    expect(tagList("face, toner ,new,")).toEqual(["face", "toner", "new"]);
  });
  it("passes arrays through", () => {
    expect(tagList(["a", " b "])).toEqual(["a", "b"]);
  });
  it("handles missing tags", () => {
    expect(tagList(undefined)).toEqual([]);
  });
});

describe("productGid", () => {
  it("falls back to the numeric id", () => {
    expect(productGid({ id: 5, title: "t" })).toBe("gid://shopify/Product/5");
  });
});
