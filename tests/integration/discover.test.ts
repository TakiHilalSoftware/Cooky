import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

const schema = await import("@/server/db/schema");
const { loadMoreDiscover, saveCatalogDish } = await import("@/server/actions/discover");
const dishes = await import("@/server/actions/dishes");
const { getCatalogDish, getDiscover, getHomeDishes, getStarterDishes } = await import(
  "@/server/features/discover/queries"
);
const { DISCOVER_PAGE_SIZE } = await import("@/lib/dishes");
const { getDish, getDishForEdit, listMyDishes } = await import("@/server/features/dishes/queries");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
});

async function signedIn(email = "amina@example.com") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  return (await userByEmail(email))!.id;
}

const slugs = (cards: { slug: string }[]) => cards.map((c) => c.slug).sort();

describe("getDiscover (public)", () => {
  it("lists the whole catalog for visitors, featured first, with 12+ countries", async () => {
    const data = await getDiscover({}, "en");
    expect(data.signedIn).toBe(false);
    expect(data.dishes.length).toBeGreaterThanOrEqual(24);
    expect(data.featured.length).toBeGreaterThan(0);
    expect(data.countries.length).toBeGreaterThanOrEqual(12);
    expect(data.dishes.every((d) => !d.saved)).toBe(true);
  });

  it("filters by country, course, diet and collection", async () => {
    expect((await getDiscover({ country: "TN" }, "en")).dishes.every((d) => d.country === "TN")).toBe(true);
    expect((await getDiscover({ course: "dessert" }, "en")).dishes.every((d) => d.course === "dessert")).toBe(true);
    expect((await getDiscover({ diet: "vegan" }, "en")).dishes.every((d) => d.dietaryTags.includes("vegan"))).toBe(
      true,
    );
    expect(slugs((await getDiscover({ collection: "eid_sweets" }, "en")).dishes)).toEqual([
      "almond-ghriba",
      "mouhalabieh",
    ]);
  });

  it("'ingredients you have': all of them first, then any, in any language", async () => {
    const all = await getDiscover({ have: "chickpeas, tahini" }, "en");
    expect(all.matchMode).toBe("all");
    expect(slugs(all.dishes)).toEqual(["hummus"]);
    // French and Arabic names match too, whatever the page language.
    expect(slugs((await getDiscover({ have: "pois chiches, tahini" }, "en")).dishes)).toEqual(["hummus"]);
    expect(slugs((await getDiscover({ have: "حمص، طحينة" }, "fr")).dishes)).toEqual(["hummus"]);

    const any = await getDiscover({ have: "tahini, saffron" }, "en");
    expect(any.matchMode).toBe("any");
    expect(slugs(any.dishes)).toEqual(["chicken-tagine-preserved-lemon", "hummus"]);
    expect((await getDiscover({ have: "durian" }, "en")).matchMode).toBe("none");
  });

  it("speaks the viewer's language", async () => {
    const harira = (await getDiscover({}, "ar")).dishes.find((d) => d.slug === "harira");
    expect(harira?.name).toBe("الحريرة");
    const dish = await getCatalogDish("harira", "fr");
    expect(dish?.ingredients[0]).toMatchObject({ name: "Agneau", note: "coupé en dés" });
  });

  it("scales the catalog dish on the server and 404s unknown slugs", async () => {
    const dish = await getCatalogDish("harira", "en", 12);
    expect(dish?.shownServings).toBe(12);
    expect(dish?.ingredients[0]?.amount).toBe(500);
    expect(await getCatalogDish("no-such-dish", "en")).toBeNull();
  });
});

describe("saveCatalogDish", () => {
  it("requires a session", async () => {
    expect(await saveCatalogDish({ slug: "harira", locale: "en" })).toEqual({ serverError: "unauthorized" });
  });

  it("saves a linked copy once (saving again returns it), and Discover marks it saved", async () => {
    const userId = await signedIn();
    const first = await saveCatalogDish({ slug: "harira", locale: "en" });
    expect(first.data?.alreadySaved).toBe(false);
    const again = await saveCatalogDish({ slug: "harira", locale: "fr" });
    expect(again.data).toEqual({ dishId: first.data!.dishId, alreadySaved: true });

    const [row] = await db().select().from(schema.dishes).where(eq(schema.dishes.userId, userId));
    expect(row).toMatchObject({ name: "Harira", followsCatalog: true });
    expect(row?.catalogDishId).not.toBeNull();
    // By name, so the dish is on the first page whatever "for you" ranks first.
    expect((await getDiscover({ sort: "name", country: "MA" }, "en")).dishes.find((d) => d.slug === "harira")?.saved).toBe(
      true,
    );
    expect((await getCatalogDish("harira", "en"))?.savedDishId).toBe(first.data!.dishId);
    // Its ingredients are linked to the dictionary like any dish.
    const lines = await db()
      .select()
      .from(schema.dishIngredients)
      .where(eq(schema.dishIngredients.dishId, first.data!.dishId));
    expect(lines.filter((l) => l.ingredientId !== null).length).toBeGreaterThan(5);
  });

  it("the copy follows the viewer's language until it's edited", async () => {
    await signedIn();
    const { data } = await saveCatalogDish({ slug: "harira", locale: "en" });
    const id = data!.dishId;
    expect((await getDish(id, undefined, "fr"))?.ingredients[0]).toMatchObject({ name: "Agneau" });
    expect((await getDish(id, undefined, "ar"))?.name).toBe("الحريرة");
    expect((await listMyDishes({ favorites: false }, "ar"))?.dishes[0]?.name).toBe("الحريرة");

    const edit = await getDishForEdit(id, "fr");
    expect(edit?.name).toBe("Harira");
    expect(edit?.ingredients[0]?.name).toBe("Agneau");
    await dishes.updateDish({ ...edit!, name: "Ma harira", ingredients: edit!.ingredients, steps: edit!.steps });
    // Edited in French: it's the person's own text now, in every language.
    expect((await getDish(id, undefined, "en"))?.name).toBe("Ma harira");
    expect((await getDish(id, undefined, "en"))?.ingredients[0]?.name).toBe("Agneau");
  });

  it("counts against the dish cap (the upgrade sheet), and 404s unknown slugs", async () => {
    const userId = await signedIn();
    await db()
      .insert(schema.dishes)
      .values(
        Array.from({ length: 50 }, (_, i) => ({
          userId,
          name: `D${i}`,
          difficulty: "easy" as const,
          course: "main" as const,
          servings: 2,
        })),
      );
    expect(await saveCatalogDish({ slug: "harira", locale: "en" })).toEqual({ serverError: "quota_exceeded" });
    expect(await saveCatalogDish({ slug: "nope", locale: "en" })).toEqual({ serverError: "not_found" });
  });

  it("a deleted copy doesn't count as saved; saving again makes a new one", async () => {
    await signedIn();
    const { data } = await saveCatalogDish({ slug: "hummus", locale: "en" });
    await dishes.deleteDish({ id: data!.dishId });
    const again = await saveCatalogDish({ slug: "hummus", locale: "en" });
    expect(again.data?.alreadySaved).toBe(false);
    expect(again.data?.dishId).not.toBe(data!.dishId);
  });
});

/** Extra catalog rows so the list runs past one page; removed again after each test. */
async function withExtraDishes(n: number) {
  await db()
    .insert(schema.catalogDishes)
    .values(
      Array.from({ length: n }, (_, i) => ({
        slug: `zz-paging-${String(i).padStart(2, "0")}`,
        country: "JP",
        course: "main" as const,
        difficulty: "easy" as const,
        servings: 2,
        source: "test",
        nameEn: `Zz paging ${String(i).padStart(2, "0")}`,
        descriptionEn: "A dish for paging tests.",
      })),
    );
}

describe("Discover paging and order", () => {
  afterEach(async () => {
    await db().delete(schema.catalogDishes).where(eq(schema.catalogDishes.source, "test"));
  });

  it("shows one page, counts them all, and the next page continues without repeats", async () => {
    await withExtraDishes(30);
    const first = await getDiscover({ sort: "name" }, "en");
    expect(first.dishes).toHaveLength(DISCOVER_PAGE_SIZE);
    expect(first.total).toBeGreaterThan(DISCOVER_PAGE_SIZE * 2);
    expect(first.nextPage).toBe(2);

    const second = await loadMoreDiscover({ sort: "name", page: 2, locale: "en" });
    expect(second.data?.dishes).toHaveLength(DISCOVER_PAGE_SIZE);
    const shown = [...first.dishes, ...second.data!.dishes].map((d) => d.slug);
    expect(new Set(shown).size).toBe(shown.length);
    // A refresh at ?page=2 renders exactly what scrolling had shown.
    expect((await getDiscover({ sort: "name", page: 2 }, "en")).dishes.map((d) => d.slug)).toEqual(shown);
  });

  it("the last page says there's nothing after it", async () => {
    await withExtraDishes(30);
    const { total } = await getDiscover({ sort: "name" }, "en");
    const lastPage = Math.ceil(total / DISCOVER_PAGE_SIZE);
    const last = await loadMoreDiscover({ sort: "name", page: lastPage, locale: "en" });
    expect(last.data?.nextPage).toBeNull();
    expect(last.data?.dishes.length).toBe(total - (lastPage - 1) * DISCOVER_PAGE_SIZE);
  });

  it("keeps the filters when scrolling on", async () => {
    await withExtraDishes(30);
    const more = await loadMoreDiscover({ country: "JP", sort: "name", page: 2, locale: "en" });
    expect(more.data?.dishes.every((d) => d.country === "JP")).toBe(true);
  });

  it("rejects a first page or an absurd one (the page itself renders those)", async () => {
    expect((await loadMoreDiscover({ page: 1, locale: "en" })).validationErrors).toBeDefined();
    expect((await loadMoreDiscover({ page: 5000, locale: "en" })).validationErrors).toBeDefined();
  });

  it("visitors get the popular order, even if the URL asks for one made for someone", async () => {
    expect((await getDiscover({}, "en")).sort).toBe("popular");
    expect((await getDiscover({ sort: "for_you" }, "en")).sort).toBe("popular");
    expect((await getDiscover({ sort: "newest" }, "en")).sort).toBe("newest");
  });

  it("popular puts what people save first", async () => {
    await signedIn("one@example.com");
    await saveCatalogDish({ slug: "tabbouleh", locale: "en" });
    browser.reset();
    expect((await getDiscover({}, "en")).dishes[0]?.slug).toBe("tabbouleh");
  });

  it("featured dishes only on the unfiltered first screen", async () => {
    expect((await getDiscover({}, "en")).featured.length).toBeGreaterThan(0);
    expect((await getDiscover({ course: "main" }, "en")).featured).toEqual([]);
  });
});

describe("for you", () => {
  it("is the default once signed in and sinks dishes outside their diet", async () => {
    const userId = await signedIn();
    await db().update(schema.profiles).set({ dietaryPrefs: ["vegan"] }).where(eq(schema.profiles.userId, userId));
    const data = await getDiscover({}, "en");
    expect(data.sort).toBe("for_you");
    const firstOffDiet = data.dishes.findIndex((d) => !d.dietaryTags.includes("vegan"));
    const lastVegan = data.dishes.findLastIndex((d) => d.dietaryTags.includes("vegan"));
    expect(firstOffDiet).toBeGreaterThan(lastVegan);
  });

  it("names the ingredients from their kitchen, never staples", async () => {
    const userId = await signedIn();
    await db()
      .insert(schema.pantryItems)
      .values([
        { userId, name: "chickpeas", key: "chickpeas" },
        { userId, name: "tahini", key: "tahini" },
        { userId, name: "salt", key: "salt", isStaple: true },
      ]);
    const hummus = (await getDiscover({}, "en")).dishes.find((d) => d.slug === "hummus");
    expect(hummus?.reason).toMatchObject({ kind: "have" });
    expect(hummus?.reason?.kind === "have" && hummus.reason.names.map((n) => n.toLowerCase())).not.toContain("salt");
  });

  it("the landing page shows the same picks all day, never one already saved", async () => {
    await signedIn();
    await saveCatalogDish({ slug: "harira", locale: "en" });
    const home = await getHomeDishes("en");
    expect(home.personalized).toBe(true);
    expect(home.dishes.map((d) => d.slug)).not.toContain("harira");
    expect((await getHomeDishes("en")).dishes.map((d) => d.slug)).toEqual(home.dishes.map((d) => d.slug));
  });

  it("visitors see featured dishes on the landing page; the starter pack favours photos", async () => {
    const home = await getHomeDishes("en");
    expect(home.personalized).toBe(false);
    expect(home.countryCount).toBeGreaterThanOrEqual(12);
    await signedIn();
    const starter = await getStarterDishes("en");
    expect(starter.length).toBeGreaterThan(0);
    expect(starter.slice(0, 6).every((d) => d.photoUrl !== null)).toBe(true);
  });
});
