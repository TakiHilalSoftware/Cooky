import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type * as FetchModule from "@/server/importer/fetch";

import { aiHandlers, fakeGroq } from "./support/ai";
import { browser } from "./support/browser";
import { resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

// The network side (SSRF guard, redirects) is unit-tested; here the page comes from a fake.
const page = vi.hoisted(() => ({ fetchPage: vi.fn() }));
vi.mock("@/server/importer/fetch", async (original) => ({
  ...(await original<typeof FetchModule>()),
  fetchPage: page.fetchPage,
}));

const { ImportFetchError } = await import("@/server/importer/fetch");
const { importFromUrl } = await import("@/server/actions/import");
const dishes = await import("@/server/actions/dishes");
const { getDish } = await import("@/server/features/dishes/queries");
const tries = await import("@/server/quota/tries");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  page.fetchPage.mockReset();
  fakeGroq.reset();
  hibp.use(...aiHandlers);
});

const RECIPE_URL = "https://recipes.example.com/harira";
const html = (recipe: unknown) =>
  `<html><head><meta property="og:site_name" content="Example Recipes"><script type="application/ld+json">${JSON.stringify(recipe)}</script></head></html>`;
const HARIRA = {
  "@type": "Recipe",
  name: "Harira",
  recipeYield: "6 servings",
  recipeIngredient: ["250 g lamb, diced", "1 cup lentils", "Salt, to taste"],
  recipeInstructions: [{ "@type": "HowToStep", text: "Brown the lamb." }],
};

async function signedIn(email = "amina@example.com") {
  await signUpAndVerify(email);
  await logIn(email);
  return (await userByEmail(email))!.id;
}

const used = async (userId: string) => (await tries.usageFor(userId, "import")).used;

describe("importFromUrl", () => {
  it("requires a session", async () => {
    expect(await importFromUrl({ url: RECIPE_URL, locale: "en" })).toEqual({ serverError: "unauthorized" });
  });

  it("returns a draft for the form, credits the site, and spends one try", async () => {
    const userId = await signedIn();
    page.fetchPage.mockResolvedValue({ url: new URL(RECIPE_URL), html: html(HARIRA) });
    const { data } = await importFromUrl({ url: RECIPE_URL, locale: "en" });
    expect(data).toMatchObject({
      name: "Harira",
      servings: 6,
      ingredients: [
        { amount: 250, unit: "g", name: "lamb", note: "diced" },
        { amount: 1, unit: "cup", name: "lentils", note: null },
        { amount: null, unit: null, name: "Salt", note: null },
      ],
      steps: [{ text: "Brown the lamb.", timerMinutes: null, prepDayBefore: false }],
      source: { url: RECIPE_URL, siteName: "Example Recipes" },
    });
    expect(await used(userId)).toBe(1);
  });

  it("gives the try back when the page has no recipe, can't be reached, or the link is refused", async () => {
    const userId = await signedIn();
    page.fetchPage.mockResolvedValueOnce({ url: new URL(RECIPE_URL), html: "<html>No recipe</html>" });
    expect(await importFromUrl({ url: RECIPE_URL, locale: "en" })).toEqual({ serverError: "not_found" });
    page.fetchPage.mockRejectedValueOnce(new ImportFetchError("unreachable"));
    expect(await importFromUrl({ url: RECIPE_URL, locale: "en" })).toEqual({ serverError: "unavailable" });
    page.fetchPage.mockRejectedValueOnce(new ImportFetchError("blocked"));
    expect(await importFromUrl({ url: "http://169.254.169.254/", locale: "en" })).toEqual({ serverError: "invalid" });
    expect(await used(userId)).toBe(0);
    expect((await tries.usageFor(userId, "import")).remaining).toBe(5);
  });

  it("reads a page without recipe data with the AI fallback, on the same try", async () => {
    const userId = await signedIn();
    const blog = `<html><body><nav>Menu</nav><article><h1>Grandma's harira</h1><p>${"A story about our family kitchen. ".repeat(10)}</p>
      <ul><li>250 g lamb, diced</li><li>1 cup lentils</li></ul><p>Brown the lamb, then simmer with the lentils.</p></article></body></html>`;
    page.fetchPage.mockResolvedValue({ url: new URL(RECIPE_URL), html: blog });
    fakeGroq.answer = {
      found: true,
      name: "Grandma's harira",
      servings: 6,
      ingredients: ["250 g lamb, diced", "1 cup lentils"],
      steps: ["Brown the lamb, then simmer with the lentils."],
    };
    const { data } = await importFromUrl({ url: RECIPE_URL, locale: "en" });
    expect(data).toMatchObject({
      name: "Grandma's harira",
      servings: 6,
      ingredients: [
        { amount: 250, unit: "g", name: "lamb", note: "diced" },
        { amount: 1, unit: "cup", name: "lentils", note: null },
      ],
      source: { url: RECIPE_URL, siteName: "recipes.example.com" },
    });
    // The model got the page's text, not its markup.
    const sent = JSON.stringify(fakeGroq.chatRequests[0]?.messages);
    expect(sent).toContain("Grandma's harira");
    expect(sent).not.toContain("<nav>");
    expect(await used(userId)).toBe(1);
  });

  it("gives the try back when the AI finds no recipe either", async () => {
    const userId = await signedIn();
    page.fetchPage.mockResolvedValue({
      url: new URL(RECIPE_URL),
      html: `<p>${"Just a travel story. ".repeat(20)}</p>`,
    });
    fakeGroq.answer = { found: false, name: "", servings: null, ingredients: [], steps: [] };
    expect(await importFromUrl({ url: RECIPE_URL, locale: "en" })).toEqual({ serverError: "not_found" });
    expect(await used(userId)).toBe(0);
  });

  it("on Free, the 6th import in a month opens the upgrade sheet (quota_exceeded), without fetching", async () => {
    await signedIn();
    page.fetchPage.mockResolvedValue({ url: new URL(RECIPE_URL), html: html(HARIRA) });
    for (let i = 0; i < 5; i++) expect((await importFromUrl({ url: RECIPE_URL, locale: "en" })).data).toBeDefined();
    page.fetchPage.mockClear();
    expect(await importFromUrl({ url: RECIPE_URL, locale: "en" })).toEqual({ serverError: "quota_exceeded" });
    expect(page.fetchPage).not.toHaveBeenCalled();
  });
});

describe("saving an imported dish", () => {
  const draft = {
    name: "Harira",
    difficulty: "easy" as const,
    course: "main" as const,
    servings: 6,
    seasons: [],
    dietaryTags: [],
    ingredients: [{ name: "Lentils", amount: 1, unit: "cup" as const, note: null }],
    steps: [],
    caloriesKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };

  it("credits the source on the dish page", async () => {
    await signedIn();
    const { data } = await dishes.createDish({ ...draft, source: { url: RECIPE_URL, siteName: "Example Recipes" } });
    expect((await getDish(data!.id))?.source).toEqual({ url: RECIPE_URL, siteName: "Example Recipes" });
  });

  it("refuses a source that isn't an http(s) link", async () => {
    await signedIn();
    const result = await dishes.createDish({ ...draft, source: { url: "javascript:alert(1)", siteName: "x" } });
    expect(result.validationErrors).toBeDefined();
  });

  it("a dish typed by hand has no source", async () => {
    await signedIn();
    const { data } = await dishes.createDish(draft);
    expect((await getDish(data!.id))?.source).toBeNull();
  });
});
