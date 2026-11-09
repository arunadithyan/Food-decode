/* The eight FoodDecode 2.0 demo scenarios, run in a real browser against the real app. */
import { expect, test, type Page } from "@playwright/test";

const PW = "FoodDecode-demo-2026";
const run = Date.now().toString(36);

async function login(page: Page, user: string, password = PW) {
  await page.goto("/login");
  await page.fill("#u", user);
  await page.fill("#p", password);
  await page.click("form button.btn.primary");
  await page.waitForURL("**/dashboard");
}
async function verdict(page: Page) {
  await page.waitForSelector("[data-testid=verdict]");
  return page.getAttribute("[data-testid=verdict]", "data-status");
}
async function setPortion(page: Page, g: number) {
  await page.fill("[data-testid=portion-input]", String(g));
  await page.waitForTimeout(150);
}

test("1 · personalisation: a new user registers, consents and sets up a profile", async ({ page }) => {
  await page.goto("/register");
  await page.fill("#u", `e2e.${run}`);
  await page.fill("#p", "a-long-e2e-password");
  await page.check("input[type=checkbox]");
  await page.click("form button.btn.primary");
  await page.waitForURL("**/onboarding");
  await page.getByText("I agree to FoodDecode storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Vegetarian", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Peanuts (groundnut)").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Reduce sodium / salt").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Keep my scan history").click();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("greeting")).toContainText("Ready to decode your food?");
  await expect(page.getByText("Peanuts (groundnut) allergy")).toBeVisible();
  await expect(page.getByText("Vegetarian", { exact: true })).toBeVisible();
});

test("2 · same food, different profiles: Maggi is YES for one user and NO for another", async ({ page, context }) => {
  await login(page, "demo.general");
  await page.goto("/product/maggi-masala");
  expect(await verdict(page)).toBe("YES");
  await context.clearCookies();
  await login(page, "demo.jain");
  await page.goto("/product/maggi-masala");
  expect(await verdict(page)).toBe("NO");
  await expect(page.getByTestId("verdict")).toContainText(/onion|garlic/i);
});

test("3 · improved OCR: on-device OCR reads the sample label and asks the user to verify", async ({ page }) => {
  await page.goto("/scan");
  await page.getByRole("button", { name: "Try the sample label" }).click();
  await page.getByTestId("read-label").click();
  await page.waitForURL("**/scan/review", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "We extracted the following information. Please verify it." })).toBeVisible();
  await expect(page.getByTestId("f-energyKcal-100")).toHaveValue("500");
  await expect(page.getByTestId("f-sodiumMg-100")).toHaveValue("600");
  await expect(page.getByTestId("f-addedSugarG-100")).toHaveValue("26.7");
  // the user corrects a value; nothing is changed without them
  await page.getByTestId("f-fibreG-100").fill("1.5");
  const keep = page.getByTestId("keep-issues");
  if (await keep.isVisible()) await keep.check();
  await page.getByTestId("confirm-values").click();
  const s = await verdict(page);
  expect(s).not.toBe("YES"); // illustrative data never gets YES
  await expect(page.getByText("This is a fictional demo label")).toBeVisible();
});

test("4 · allergen conflict: peanut allergy + groundnut ingredient → NO with evidence", async ({ page }) => {
  await login(page, "demo.peanut");
  await page.goto("/product/maggi-masala");
  expect(await verdict(page)).toBe("NO");
  await expect(page.getByTestId("verdict")).toContainText("groundnut");
  await page.getByText("Why am I seeing this recommendation?").click();
  await expect(page.getByText("1 allergens → 2 diet")).toBeVisible();
});

test("5 · portion: 30 g → 90 g changes the answer for a sodium-watching user", async ({ page }) => {
  await login(page, "demo.bp");
  await page.goto("/product/haldiram-aloo-bhujia");
  await verdict(page);
  await setPortion(page, 30);
  expect(await verdict(page)).toBe("YES");
  await setPortion(page, 90);
  expect(await verdict(page)).toBe("CAUTION");
  await expect(page.getByTestId("verdict")).toContainText(/sodium/i);
});

test("6 · alternatives for a CAUTION product are real, lower-sodium products", async ({ page }) => {
  await login(page, "demo.bp");
  await page.goto("/product/haldiram-aloo-bhujia?amount=90");
  expect(await verdict(page)).toBe("CAUTION");
  const alts = page.getByTestId("alternatives");
  await expect(alts).toContainText("Bingo");
  await page.goto("/alternatives/haldiram-aloo-bhujia?amount=90");
  await expect(page.getByRole("heading", { name: "Recommended alternatives" })).toBeVisible();
  await expect(page.locator("table.rvt")).toContainText("Sodium");
});

test("7 · privacy: edit and delete the health profile; another user cannot see it", async ({ page, context }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/register");
  const u = `priv.${run}`;
  await page.fill("#u", u);
  await page.fill("#p", "a-long-e2e-password");
  await page.check("input[type=checkbox]");
  await page.click("form button.btn.primary");
  await page.waitForURL("**/onboarding");
  await page.goto("/profile");
  await page.getByLabel("Sesame (til)").check();
  await page.getByText("I agree to FoodDecode storing this health information").click();
  await page.getByTestId("save-profile").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.locator("ol.timeline li")).toHaveCount(1);
  // export contains it
  const exp = await page.request.get("/api/account/export");
  expect(await exp.text()).toContain("sesame");
  // a different user sees nothing of it
  await context.clearCookies();
  await login(page, "demo.general");
  const other = await page.request.get("/api/profile");
  expect(await other.text()).not.toContain("sesame");
  // back as the owner: delete
  await context.clearCookies();
  await login(page, u, "a-long-e2e-password");
  await page.goto("/profile");
  await page.getByTestId("delete-profile").click();
  await page.getByTestId("confirm-delete-profile").click();
  await expect(page.getByText("Your health profile and its history were deleted.")).toBeVisible();
  expect(await (await page.request.get("/api/profile")).json()).toMatchObject({ profile: null });
});

test("8 · offline fallback: on-device OCR and cached pages work without a network", async ({ page, context }) => {
  // first visit online: service worker installs, OCR engine files get cached
  await page.goto("/scan");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.getByRole("button", { name: "Try the sample label" }).click();
  await page.getByTestId("read-label").click();
  await page.waitForURL("**/scan/review", { timeout: 120_000 });
  // now go offline
  await context.setOffline(true);
  await page.goto("/scan");
  await expect(page.getByText("You're offline")).toBeVisible();
  await page.getByRole("button", { name: "Try the sample label" }).click();
  await page.getByTestId("read-label").click();
  await page.waitForURL("**/scan/review", { timeout: 120_000 });
  await expect(page.getByTestId("f-energyKcal-100")).toHaveValue("500");
  await page.goto("/learn/sodium");
  await expect(page.getByTestId("lesson")).toContainText("2.5");
  await context.setOffline(false);
});

test("9 · food diary: log a product and a home meal, see what is left and the streak", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page, "demo.bp");
  await page.goto("/profile");
  await expect(page.getByTestId("intake-summary")).toBeVisible();
  // log 30 g of namkeen from its product page
  await page.goto("/product/haldiram-aloo-bhujia?amount=30");
  await verdict(page);
  await page.getByTestId("ate-this").click();
  await expect(page.getByTestId("ate-msg")).toContainText("Added 30 g");
  await page.getByRole("link", { name: "See my intake →" }).click();
  await page.waitForURL("**/profile/intake");
  const before = Number((await page.getByTestId("kcal-eaten").innerText()).replace(/[^\d.]/g, ""));
  // add a home-cooked meal by hand
  await page.getByTestId("add-food").click();
  await page.getByRole("button", { name: /Enter manually/ }).click();
  await page.getByTestId("manual-name").fill("2 chapatis with dal");
  await page.getByTestId("manual-kcal").fill("420");
  await page.getByTestId("manual-submit").click();
  await expect(page.getByText("2 chapatis with dal")).toBeVisible();
  const after = Number((await page.getByTestId("kcal-eaten").innerText()).replace(/[^\d.]/g, ""));
  expect(after - before).toBeCloseTo(420, 0);
  await expect(page.getByTestId("kcal-left")).toContainText(/kcal (left|over)/);
  // the seeded synthetic days before today were on track
  expect(Number((await page.getByTestId("streak-on-track").innerText()).match(/\d+/)![0])).toBeGreaterThanOrEqual(4);
  // previous day navigation works
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page.getByTestId("intake-day")).toHaveText("Yesterday");
});
