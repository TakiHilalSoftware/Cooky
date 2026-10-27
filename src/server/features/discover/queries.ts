import "server-only";

import { and, arrayContains, asc, count, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { cache } from "react";

import type { AppLocale } from "@/i18n/routing";
import { hasFilters } from "@/lib/discover-url";
import { DISCOVER_PAGE_SIZE, type DiscoverSort } from "@/lib/dishes";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { catalogDishes, catalogIngredients, catalogSteps, dishes } from "@/server/db/schema";
import { loadHave } from "@/server/features/cook/queries";
import type { RankLine } from "@/server/features/cook/service";
import { scaleAmount } from "@/server/features/dishes/service";
import { dictionaryMatcher, type MatchableLine } from "@/server/features/ingredients/dictionary";
import { filterByIngredients } from "@/server/features/ingredients/service";
import { loadProfile } from "@/server/features/profile/queries";
import { requestToday } from "@/server/time";
import { loadWeatherContext } from "@/server/weather/queries";
import { favouredSeasons } from "@/server/weather/service";

import type {
  CatalogCardDto,
  CatalogDishDto,
  CatalogPickDto,
  DiscoverDto,
  DiscoverPageDto,
  HomeDishesDto,
  SuggestionReason,
} from "./dto";
import type { DiscoverFilters } from "./schema";
import { pickForYou, sortCatalog, type CatalogCandidate, type SuggestContext } from "./service";

type Localized = { en: string; fr: string | null; ar: string | null };

/** A catalog text in the viewer's language; English when that translation is missing. */
export const inLocale = (text: Localized, locale: AppLocale) =>
  (locale === "fr" ? text.fr : locale === "ar" ? text.ar : null) ?? text.en;

type CatalogRow = typeof catalogDishes.$inferSelect;

/** "Picked for you" on Discover and the landing page. */
const PICKS = 10;
/** The starter pack's grid (PRD §3.1). */
const STARTER_PICKS = 12;

function toCard(row: CatalogRow, locale: AppLocale, saved: Set<string>, timers: Map<string, number>): CatalogCardDto {
  return {
    slug: row.slug,
    name: inLocale({ en: row.nameEn, fr: row.nameFr, ar: row.nameAr }, locale),
    description: inLocale({ en: row.descriptionEn, fr: row.descriptionFr, ar: row.descriptionAr }, locale),
    country: row.country,
    course: row.course,
    difficulty: row.difficulty,
    servings: row.servings,
    dietaryTags: row.dietaryTags,
    collections: row.collections,
    timerMinutes: timers.get(row.id) ?? null,
    saved: saved.has(row.id),
    photoUrl: row.photoUrl,
  };
}

/** Catalog ids the person already has a (live) copy of. */
async function savedCatalogIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await getDb()
    .select({ id: dishes.catalogDishId })
    .from(dishes)
    .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt), isNotNull(dishes.catalogDishId)));
  return new Set(rows.map((r) => r.id).filter((id): id is string => id !== null));
}

async function timerMinutes(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: catalogSteps.catalogDishId, seconds: sql<number>`sum(${catalogSteps.timerSeconds})::int` })
    .from(catalogSteps)
    .where(inArray(catalogSteps.catalogDishId, ids))
    .groupBy(catalogSteps.catalogDishId);
  return new Map(rows.filter((r) => r.seconds).map((r) => [r.id, Math.round(r.seconds / 60)]));
}

/** Catalog rows as cards for one viewer: their language, what they've saved, total step time. */
export async function toCatalogCards(
  rows: CatalogRow[],
  locale: AppLocale,
  userId: string | null,
): Promise<CatalogCardDto[]> {
  const [saved, timers] = await Promise.all([savedCatalogIds(userId), timerMinutes(rows.map((r) => r.id))]);
  return rows.map((row) => toCard(row, locale, saved, timers));
}

/** How many people keep a copy of each catalog dish (an aggregate: no one is named). */
async function saveCounts(): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ id: dishes.catalogDishId, n: count() })
    .from(dishes)
    .where(and(isNull(dishes.deletedAt), isNotNull(dishes.catalogDishId)))
    .groupBy(dishes.catalogDishId);
  return new Map(rows.flatMap((r) => (r.id ? [[r.id, r.n] as const] : [])));
}

type CatalogLine = { id: string; en: string; fr: string | null; ar: string | null; ingredientId: string | null };

async function catalogLines(ids: string[]): Promise<Map<string, CatalogLine[]>> {
  const byDish = new Map<string, CatalogLine[]>();
  if (ids.length === 0) return byDish;
  const rows = await getDb()
    .select({
      id: catalogIngredients.catalogDishId,
      en: catalogIngredients.nameEn,
      fr: catalogIngredients.nameFr,
      ar: catalogIngredients.nameAr,
      ingredientId: catalogIngredients.ingredientId,
    })
    .from(catalogIngredients)
    .where(inArray(catalogIngredients.catalogDishId, ids))
    .orderBy(catalogIngredients.catalogDishId, asc(catalogIngredients.position));
  for (const row of rows) {
    const list = byDish.get(row.id) ?? [];
    list.push(row);
    byDish.set(row.id, list);
  }
  return byDish;
}

/** Countries of the catalog dishes someone saved: a taste signal for their picks. */
async function likedCountries(userId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ country: catalogDishes.country, n: count() })
    .from(dishes)
    .innerJoin(catalogDishes, eq(catalogDishes.id, dishes.catalogDishId))
    .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt)))
    .groupBy(catalogDishes.country);
  return new Map(rows.map((r) => [r.country, r.n]));
}

/** What "for you" knows about a person: kitchen, diet, weather, taste. The seed turns over daily. */
const loadSuggestContext = cache(async (userId: string, locale: AppLocale): Promise<SuggestContext> => {
  const [have, weather, profile, today, liked] = await Promise.all([
    loadHave(userId, locale),
    loadWeatherContext(userId),
    loadProfile(userId),
    requestToday(),
    likedCountries(userId),
  ]);
  return {
    have: have.map((h) => h.item),
    keyHave: have.filter((h) => !h.isStaple).map((h) => h.item),
    favoured: favouredSeasons(weather.mood, weather.season),
    mood: weather.mood,
    dietaryPrefs: profile?.dietaryPrefs ?? [],
    likedCountries: liked,
    seed: `${userId}:${today}`,
  };
});

function filterSql(filters: DiscoverFilters): SQL | undefined {
  return and(
    filters.country ? eq(catalogDishes.country, filters.country) : undefined,
    filters.course ? eq(catalogDishes.course, filters.course) : undefined,
    filters.diet ? arrayContains(catalogDishes.dietaryTags, [filters.diet]) : undefined,
    filters.collection ? arrayContains(catalogDishes.collections, [filters.collection]) : undefined,
  );
}

/** The order in effect: the URL's, unless it asks "for you" without an account. */
function sortFor(filters: DiscoverFilters, signedIn: boolean): DiscoverSort {
  if (filters.sort && (filters.sort !== "for_you" || signedIn)) return filters.sort;
  return signedIn ? "for_you" : "popular";
}

type Listing = {
  /** Every matching row, in display order. */
  ordered: CatalogRow[];
  /** Why each dish sits where it does ("for you" only). */
  reasons: Map<string, SuggestionReason | null>;
  candidates: CatalogCandidate[];
  context: SuggestContext | null;
  saved: Set<string>;
  matchMode: DiscoverDto["matchMode"];
  sort: DiscoverSort;
  userId: string | null;
};

/**
 * Discover's list for one viewer, in order: the filters in SQL, then
 * "ingredients you have" (any language), then the sort. Light at catalog
 * scale (hundreds of rows); only the shown page gets cards built.
 */
const loadListing = cache(async (filters: DiscoverFilters, locale: AppLocale): Promise<Listing> => {
  const session = await getSession();
  const userId = session?.user.id ?? null;
  const sort = sortFor(filters, userId !== null);
  let rows = await getDb().select().from(catalogDishes).where(filterSql(filters));

  const wanted = (filters.have ?? "")
    .split(/[,،]/)
    .map((w) => w.trim())
    .filter(Boolean);
  // Ingredient lines are only needed to match "ingredients you have" or to rank for one person.
  const needLines = wanted.length > 0 || userId !== null;
  const [saved, saves, lines, context] = await Promise.all([
    savedCatalogIds(userId),
    saveCounts(),
    needLines ? catalogLines(rows.map((r) => r.id)) : Promise.resolve(new Map<string, CatalogLine[]>()),
    userId ? loadSuggestContext(userId, locale) : Promise.resolve(null),
  ]);

  let matchMode: DiscoverDto["matchMode"] = null;
  if (wanted.length > 0 && rows.length > 0) {
    // Every language's name counts: "tomate" finds a dish whatever language the page is in.
    const linesOf = (id: string): MatchableLine[] =>
      (lines.get(id) ?? []).map((l) => ({
        names: [l.en, l.fr, l.ar].filter((n): n is string => Boolean(n)),
        ingredientId: l.ingredientId,
      }));
    const result = filterByIngredients(rows, (d) => linesOf(d.id), wanted, await dictionaryMatcher(wanted));
    matchMode = result.mode;
    rows = result.items;
  }

  const candidates = rows.map(
    (row): CatalogCandidate => ({
      id: row.id,
      name: inLocale({ en: row.nameEn, fr: row.nameFr, ar: row.nameAr }, locale),
      country: row.country,
      seasons: row.seasons,
      dietaryTags: row.dietaryTags,
      lines: (lines.get(row.id) ?? []).map(
        (l): RankLine => ({ name: l.en, displayName: inLocale(l, locale), ingredientId: l.ingredientId }),
      ),
      featured: row.featured,
      translated: locale === "en" || (locale === "fr" ? row.nameFr : row.nameAr) !== null,
      saves: saves.get(row.id) ?? 0,
      saved: saved.has(row.id),
      createdAt: row.createdAt,
    }),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const order = sortCatalog(candidates, sort, locale, context);
  const ordered = order.flatMap((d) => byId.get(d.id) ?? []);
  const reasons = new Map(order.map((d) => [d.id, d.reason]));
  return { ordered, reasons, candidates, context, saved, matchMode, sort, userId };
});

async function cardsFor(rows: CatalogRow[], locale: AppLocale, saved: Set<string>): Promise<CatalogCardDto[]> {
  const timers = await timerMinutes(rows.map((r) => r.id));
  return rows.map((row) => toCard(row, locale, saved, timers));
}

/** One slice of the ordered list, as cards with their reasons. */
async function listCards(listing: Listing, from: number, to: number, locale: AppLocale): Promise<CatalogPickDto[]> {
  const rows = listing.ordered.slice(from, to);
  const cards = await cardsFor(rows, locale, listing.saved);
  return cards.map((card, i) => ({ ...card, reason: listing.reasons.get(rows[i]!.id) ?? null }));
}

/** Today's picks for a signed-in person, each with its reason. */
async function picksFrom(
  listing: Listing,
  candidates: CatalogCandidate[],
  locale: AppLocale,
  limit: number,
): Promise<CatalogPickDto[]> {
  if (!listing.context) return [];
  const byId = new Map(listing.ordered.map((r) => [r.id, r]));
  const picks = pickForYou(candidates, listing.context, limit).flatMap((p) => {
    const row = byId.get(p.id);
    return row ? [{ row, reason: p.reason }] : [];
  });
  const cards = await cardsFor(
    picks.map((p) => p.row),
    locale,
    listing.saved,
  );
  return cards.map((card, i) => ({ ...card, reason: picks[i]?.reason ?? null }));
}

const nextPageOf = (page: number, total: number) => (page * DISCOVER_PAGE_SIZE < total ? page + 1 : null);

/**
 * Discover (public, PRD §3.3): featured dishes on the unfiltered first
 * screen, then the catalog in the chosen order ("for you" by default when
 * signed in, each dish with its reason), `filters.page` pages deep so a
 * refresh or Back lands where the person had scrolled to.
 */
export const getDiscover = cache(async (filters: DiscoverFilters, locale: AppLocale): Promise<DiscoverDto> => {
  const listing = await loadListing(filters, locale);
  const page = filters.page ?? 1;
  const [shown, featured, countryRows] = await Promise.all([
    listCards(listing, 0, page * DISCOVER_PAGE_SIZE, locale),
    !hasFilters(filters)
      ? cardsFor(
          listing.ordered.filter((r) => r.featured),
          locale,
          listing.saved,
        )
      : Promise.resolve([]),
    getDb().selectDistinct({ country: catalogDishes.country }).from(catalogDishes),
  ]);
  return {
    featured,
    dishes: shown,
    total: listing.ordered.length,
    nextPage: nextPageOf(page, listing.ordered.length),
    sort: listing.sort,
    countries: countryRows.map((r) => r.country).sort(),
    matchMode: listing.matchMode,
    signedIn: listing.userId !== null,
  };
});

/** One more page of Discover's list while scrolling: the same order the page itself used. */
export async function loadDiscoverPage(
  filters: DiscoverFilters,
  page: number,
  locale: AppLocale,
): Promise<DiscoverPageDto> {
  const listing = await loadListing(filters, locale);
  return {
    dishes: await listCards(listing, (page - 1) * DISCOVER_PAGE_SIZE, page * DISCOVER_PAGE_SIZE, locale),
    nextPage: nextPageOf(page, listing.ordered.length),
  };
}

/**
 * The landing page's dishes (PRD §3.0): today's picks for a signed-in person
 * (stable all day, so saving one never reshuffles the rest), featured
 * dishes for visitors.
 */
export const getHomeDishes = cache(async (locale: AppLocale): Promise<HomeDishesDto> => {
  const listing = await loadListing({}, locale);
  const countryCount = new Set(listing.ordered.map((r) => r.country)).size;
  if (listing.context) {
    return { dishes: await picksFrom(listing, listing.candidates, locale, PICKS), personalized: true, countryCount };
  }
  const featured = await cardsFor(
    listing.ordered.filter((r) => r.featured).slice(0, PICKS),
    locale,
    listing.saved,
  );
  return { dishes: featured.map((card) => ({ ...card, reason: null })), personalized: false, countryCount };
});

/**
 * The starter pack's grid (PRD §3.1): picks for this person, not yet in
 * their box, varied across countries, dishes with a photo first.
 */
export const getStarterDishes = cache(async (locale: AppLocale): Promise<CatalogPickDto[]> => {
  const listing = await loadListing({}, locale);
  const photographed = new Set(listing.ordered.filter((r) => r.photoUrl).map((r) => r.id));
  const picks = await picksFrom(
    listing,
    listing.candidates.filter((c) => photographed.has(c.id)),
    locale,
    STARTER_PICKS,
  );
  return picks.length > 0 ? picks : picksFrom(listing, listing.candidates, locale, STARTER_PICKS);
});

/** The catalog dish page (public), with ingredients scaled to `servings` on the server. */
export const getCatalogDish = cache(
  async (slug: string, locale: AppLocale, servings?: number): Promise<CatalogDishDto | null> => {
    const session = await getSession();
    const db = getDb();
    const [row] = await db.select().from(catalogDishes).where(eq(catalogDishes.slug, slug)).limit(1);
    if (!row) return null;
    const [contents, timers, savedCopy] = await Promise.all([
      loadCatalogContents(row.id, locale),
      timerMinutes([row.id]),
      session
        ? db
            .select({ id: dishes.id })
            .from(dishes)
            .where(and(eq(dishes.userId, session.user.id), eq(dishes.catalogDishId, row.id), isNull(dishes.deletedAt)))
            .limit(1)
        : Promise.resolve([]),
    ]);
    const savedDishId = savedCopy[0]?.id ?? null;
    const shownServings = servings ?? row.servings;
    return {
      ...toCard(row, locale, new Set(savedDishId ? [row.id] : []), timers),
      seasons: row.seasons,
      shownServings,
      ingredients: contents.ingredients.map((i) => ({
        ...i,
        amount: scaleAmount(i.amount, row.servings, shownServings),
      })),
      steps: contents.steps,
      savedDishId,
      signedIn: Boolean(session),
    };
  },
);

/** A catalog dish's name, ingredients and steps in one language (also what a saved copy shows). */
export async function loadCatalogContents(catalogDishId: string, locale: AppLocale) {
  const db = getDb();
  const [[row], lines, steps] = await Promise.all([
    db.select().from(catalogDishes).where(eq(catalogDishes.id, catalogDishId)).limit(1),
    db
      .select()
      .from(catalogIngredients)
      .where(eq(catalogIngredients.catalogDishId, catalogDishId))
      .orderBy(asc(catalogIngredients.position)),
    db
      .select()
      .from(catalogSteps)
      .where(eq(catalogSteps.catalogDishId, catalogDishId))
      .orderBy(asc(catalogSteps.position)),
  ]);
  return {
    name: row ? inLocale({ en: row.nameEn, fr: row.nameFr, ar: row.nameAr }, locale) : "",
    ingredients: lines.map((l) => ({
      name: inLocale({ en: l.nameEn, fr: l.nameFr, ar: l.nameAr }, locale),
      amount: l.amount,
      unit: l.unit,
      note: l.noteEn ? inLocale({ en: l.noteEn, fr: l.noteFr, ar: l.noteAr }, locale) : null,
    })),
    steps: steps.map((s) => ({
      text: inLocale({ en: s.textEn, fr: s.textFr, ar: s.textAr }, locale),
      timerMinutes: s.timerSeconds === null ? null : Math.round(s.timerSeconds / 60),
      prepDayBefore: false,
    })),
  };
}
