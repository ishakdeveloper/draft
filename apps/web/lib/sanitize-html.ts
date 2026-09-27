const ALLOWED = new Set(["p", "ul", "ol", "li", "strong", "em", "b", "i", "br"]);
const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?<\/\1\s*>/gi;

/**
 * Reduce product HTML (from Shopify or the model) to a handful of formatting tags with no
 * attributes, so it can be rendered with dangerouslySetInnerHTML. Anything else becomes text.
 */
export function sanitizeListingHtml(html: string | null | undefined): string {
  let out = (html ?? "").replace(DROP_WITH_CONTENT, "").replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g, (match, tag: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED.has(name)) return "";
    if (name === "br") return "<br>";
    return match.startsWith("</") ? `</${name}>` : `<${name}>`;
  });
  // Any "<" that is not one of the rebuilt tags is text.
  return out.replace(/<(?!\/?(?:p|ul|ol|li|strong|em|b|i|br)>)/g, "&lt;");
}
