import { expect, test, type Page } from "@playwright/test";

/**
 * The reviewer's path through the app, against the linked Supabase project. It edits and
 * restores a seeded draft but never approves: approving publishes to the connected store.
 */
const email = process.env.TEST_REVIEWER_EMAIL ?? "";
const password = process.env.TEST_REVIEWER_PASSWORD ?? "";
const MEMBER_DRAFT = "30000000-0000-0000-0000-000000000002"; // Oat Milk Cleanser, Nordkind Skin
const OTHER_BRAND_DRAFT = "30000000-0000-0000-0000-000000000003"; // Velora Wellness

test.skip(!email || !password, "TEST_REVIEWER_EMAIL and TEST_REVIEWER_PASSWORD are not set");

async function signIn(page: Page, next = "/drafts") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/drafts");
  await expect(page).toHaveURL(/\/login\?next=%2Fdrafts/);
  await expect(page.getByRole("heading", { name: "Sign in to review listings" })).toBeVisible();
});

test("wrong credentials show the error and stay on sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid login credentials")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("the queue shows only the reviewer's brands", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Oat Milk Cleanser" })).toBeVisible();
  await expect(page.getByText("Evening Bath Salts")).toHaveCount(0);
  const brandFilter = page.getByLabel("Filter by brand");
  await expect(brandFilter.getByRole("link", { name: "Nordkind Skin" })).toBeVisible();
  await expect(brandFilter.getByRole("link", { name: "Velora Wellness" })).toHaveCount(0);
});

test("a reviewer edits a draft, saves, and the edit persists", async ({ page }) => {
  await signIn(page, `/drafts/${MEMBER_DRAFT}`);
  const title = page.getByLabel("Title", { exact: true });
  const original = await title.inputValue();
  const edited = `${original.replace(/ \(e2e \d+\)$/, "")} (e2e ${Date.now() % 100000})`;

  await title.fill(edited);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(edited);

  // Restore the seed so the next run starts from the same state.
  await page.getByLabel("Title", { exact: true }).fill(original.replace(/ \(e2e \d+\)$/, ""));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
});

test("rejecting without a note is refused and changes nothing", async ({ page }) => {
  await signIn(page, `/drafts/${MEMBER_DRAFT}`);
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Add a note saying what was wrong")).toBeVisible();
  await page.reload();
  await expect(page.getByText("To review").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve and publish" })).toBeEnabled();
});

test("another brand's draft is not found", async ({ page }) => {
  await signIn(page);
  await page.goto(`/drafts/${OTHER_BRAND_DRAFT}`);
  await expect(page.getByText("belongs to a brand you do not review")).toBeVisible();
});
