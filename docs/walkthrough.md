# Walkthrough

A five minute tour of the product, end to end.

1. **Create or edit a product in Shopify.** Give it a vendor that maps to a brand (Lumière
   Botanica, Nordkind Skin or Velora Wellness) and a rough description.
2. **Watch n8n.** Workflow "01 Shopify product to draft" runs: ingest, generate, image,
   translate. Each node shows its input, output and time.
3. **Open the review app.** The new draft appears in the queue without a refresh. Open it:
   the proposed listing on the left with a live preview of the description, the current
   Shopify listing, the hero image and the pipeline timeline on the right.
4. **Check the languages.** The German, Dutch and French tabs show the adapted listing and its
   SEO fields.
5. **Edit and approve.** Change a bullet, then Approve and publish. Reject needs a note.
6. **Back in Shopify.** The product has the new title, description and SEO fields, and the
   translations are registered for every enabled language.
7. **Back in n8n.** The update webhook that the publish caused was received and skipped as
   `echo_of_publish`, so the pipeline does not loop.

Things to try: open a draft of a brand you are not a member of (not found), approve twice
(the second write is refused), or turn off a language in Shopify and publish (the skip is
logged instead of failing).
