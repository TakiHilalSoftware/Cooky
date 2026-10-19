import "server-only";

import { and, asc, count, desc, eq, inArray, isNotNull, isNull, max, or, sql } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { getDb, type Executor } from "@/server/db/client";
import {
  catalogDishes,
  collectionDishes,
  cookLog,
  dishRatings,
  dishes,
  dishIngredients,
  dishNotes,
  dishSources,
  dishSteps,
  favorites,
} from "@/server/db/schema";
import { inLocale, loadCatalogContents } from "@/server/features/discover/queries";
import type { AppLocale } from "@/i18n/routing";
import { loadCollectionAllowance, loadCollections, loadDishCollectionIds } from "@/server/features/collections/queries";
import { getEntitlement, limitFor } from "@/server/quota/entitlement";
import { matches } from "@/server/features/ingredients/service";
import { photoUrls, smallPhotoUrl } from "@/server/storage/photos";
import { storageConfigured } from "@/server/storage/r2";

import type { PhotoSlotDto } from "@/server/features/photos/dto";

import { findViewableDish, notBlockedSql } from "@/server/features/social/policy";
import { loadBasics, loadDishSharing, loadPeople } from "@/server/features/social/queries";

import type {
  DishAllowanceDto,
  DishCookingDto,
  DishDto,
  DishFormDto,
  DishListDto,
  FriendDishDto,
  ReviewsDto,
  StepDto,
} from "./dto";
import type { dishListFiltersSchema } from "./schema";
import { findOwnDish } from "./policy";
import { dishAllowance, scaleAmount } from "./service";

type DishListFilters = ReturnType<(typeof dishListFiltersSchema)["parse"]>;

/** How many dishes the person has against their plan's cap (`plan_limits`, never a constant). */
export async function loadDishAllowance(userId: string, executor: Executor = getDb()): Promise<DishAllowanceDto> {
  const [[row], { plan }] = await Promise.all([
    executor
      .select({ n: count() })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt))),
    getEntitlement(userId),
  ]);
  const { limit } = await limitFor(plan, "dishes", executor);
  return dishAllowance(row?.n ?? 0, limit);
}

/**
 * Ids of the caller's dishes whose name or an ingredient matches `wanted`,
 * by the one matching service: "oil" finds "Olive oil", never "Boiled".
 */
async function dishesMatching(userId: string, wanted: string): Promise<string[]> {
  const own = and(eq(dishes.userId, userId), isNull(dishes.deletedAt));
  const db = getDb();
  const [named, lines] = await Promise.all([
    db.select({ dishId: dishes.id, name: dishes.name }).from(dishes).where(own),
    db
      .select({ dishId: dishIngredients.dishId, name: dishIngredients.name })
      .from(dishIngredients)
      .innerJoin(dishes, eq(dishes.id, dishIngredients.dishId))
      .where(own),
  ]);
  return [...new Set([...named, ...lines].filter((row) => matches(row.name, wanted)).map((row) => row.dishId))];
}

/**
 * The outer dish's id, always table-qualified: inside a correlated subquery an
 * unqualified "id" would mean the subquery's own table (Drizzle drops the
 * table name when a query has a single table in FROM).
 */
const outerDishId = sql`${dishes}.${sql.identifier("id")}`;

/** My Dishes: the caller's box, filtered, most recently changed first. */
export const listMyDishes = cache(
  async (filters: DishListFilters, locale: AppLocale = "en"): Promise<DishListDto | null> => {
    const session = await getSession();
    if (!session) return null;
    const userId = session.user.id;
    const db = getDb();

    const own = and(eq(dishes.userId, userId), isNull(dishes.deletedAt));
    const [matching, userCollections, collectionAllowance] = await Promise.all([
      filters.q ? dishesMatching(userId, filters.q) : Promise.resolve([]),
      loadCollections(userId),
      loadCollectionAllowance(userId),
    ]);
    // Someone else's (or a deleted) collection id simply isn't a filter.
    const activeCollection = userCollections.find((c) => c.id === filters.collection) ?? null;
    const search = filters.q
      ? or(
          // The name or an ingredient matches ("lentils" finds the soup)…
          matching.length > 0 ? inArray(dishes.id, matching) : undefined,
          // …or the name is a close spelling ("taijne" → "Tajine").
          sql`word_similarity(${filters.q}, ${dishes.name}) > 0.4`,
        )
      : undefined;

    const rows = await db
      .select({
        id: dishes.id,
        name: dishes.name,
        followsCatalog: dishes.followsCatalog,
        catalogDishId: dishes.catalogDishId,
        course: dishes.course,
        difficulty: dishes.difficulty,
        servings: dishes.servings,
        dietaryTags: dishes.dietaryTags,
        imageKey: dishes.imageKey,
        favorite: sql<boolean>`${favorites.dishId} is not null`,
        ingredientCount: sql<number>`(select count(*)::int from ${dishIngredients} where ${dishIngredients.dishId} = ${outerDishId})`,
        stepCount: sql<number>`(select count(*)::int from ${dishSteps} where ${dishSteps.dishId} = ${outerDishId})`,
        timerSeconds: sql<
          number | null
        >`(select sum(${dishSteps.timerSeconds})::int from ${dishSteps} where ${dishSteps.dishId} = ${outerDishId})`,
      })
      .from(dishes)
      .leftJoin(favorites, and(eq(favorites.dishId, dishes.id), eq(favorites.userId, userId)))
      .where(
        and(
          own,
          filters.course ? eq(dishes.course, filters.course) : undefined,
          filters.favorites ? sql`${favorites.dishId} is not null` : undefined,
          activeCollection
            ? inArray(
                dishes.id,
                db
                  .select({ id: collectionDishes.dishId })
                  .from(collectionDishes)
                  .where(eq(collectionDishes.collectionId, activeCollection.id)),
              )
            : undefined,
          search,
        ),
      )
      .orderBy(desc(dishes.updatedAt));

    const [allowance, catalogNames, photoUrlList] = await Promise.all([
      loadDishAllowance(userId),
      catalogNamesFor(
        rows.filter((r) => r.followsCatalog && r.catalogDishId).map((r) => r.catalogDishId!),
        locale,
      ),
      Promise.all(rows.map((r) => smallPhotoUrl(r.imageKey))),
    ]);
    return {
      dishes: rows.map(({ timerSeconds, followsCatalog, catalogDishId, imageKey: _key, ...row }, index) => ({
        ...row,
        photoUrl: photoUrlList[index] ?? null,
        // A saved Discover dish shows its name in the viewer's language until it's edited.
        name: (followsCatalog && catalogDishId && catalogNames.get(catalogDishId)) || row.name,
        timerMinutes: timerSeconds ? Math.round(timerSeconds / 60) : null,
      })),
      total: allowance.count,
      allowance,
      collections: userCollections,
      collectionAllowance,
      activeCollection,
    };
  },
);

/** A dish the caller just deleted (still restorable), for the Undo toast. */
export const getDeletedDish = cache(async (dishId: string): Promise<{ id: string; name: string } | null> => {
  const session = await getSession();
  if (!session) return null;
  const [dish] = await getDb()
    .select({ id: dishes.id, name: dishes.name })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.userId, session.user.id), isNotNull(dishes.deletedAt)))
    .limit(1);
  return dish ?? null;
});

/** For "New dish": may the caller add one? */
export const getMyDishAllowance = cache(async (): Promise<DishAllowanceDto | null> => {
  const session = await getSession();
  return session ? loadDishAllowance(session.user.id) : null;
});

async function loadContents(dishId: string) {
  const db = getDb();
  const [ingredients, steps] = await Promise.all([
    db
      .select({
        name: dishIngredients.name,
        amount: dishIngredients.amount,
        unit: dishIngredients.unit,
        note: dishIngredients.note,
      })
      .from(dishIngredients)
      .where(eq(dishIngredients.dishId, dishId))
      .orderBy(asc(dishIngredients.position)),
    db
      .select({ text: dishSteps.text, timerSeconds: dishSteps.timerSeconds, prepDayBefore: dishSteps.prepDayBefore })
      .from(dishSteps)
      .where(eq(dishSteps.dishId, dishId))
      .orderBy(asc(dishSteps.position)),
  ]);
  const toStep = (s: (typeof steps)[number]): StepDto => ({
    text: s.text,
    timerMinutes: s.timerSeconds === null ? null : Math.round(s.timerSeconds / 60),
    prepDayBefore: s.prepDayBefore,
  });
  return { ingredients, steps: steps.map(toStep) };
}

/**
 * What a dish says: its own name, ingredients and steps, or, for a saved
 * Discover dish nobody has edited yet, the catalog's in the viewer's language.
 */
export async function contentsFor(
  dish: { id: string; name: string; followsCatalog: boolean; catalogDishId: string | null },
  locale: AppLocale,
) {
  if (dish.followsCatalog && dish.catalogDishId) {
    const fromCatalog = await loadCatalogContents(dish.catalogDishId, locale);
    if (fromCatalog.name) return fromCatalog;
  }
  return { name: dish.name, ...(await loadContents(dish.id)) };
}

export async function catalogNamesFor(ids: string[], locale: AppLocale): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: catalogDishes.id, en: catalogDishes.nameEn, fr: catalogDishes.nameFr, ar: catalogDishes.nameAr })
    .from(catalogDishes)
    .where(inArray(catalogDishes.id, ids));
  return new Map(rows.map((r) => [r.id, inLocale({ en: r.en, fr: r.fr, ar: r.ar }, locale)]));
}

/** The dish page, with ingredients scaled to `servings` on the server. */
export const getDish = cache(
  async (dishId: string, servings?: number, locale: AppLocale = "en"): Promise<DishDto | null> => {
    const session = await getSession();
    if (!session) return null;
    const userId = session.user.id;
    const dish = await findOwnDish(userId, dishId);
    if (!dish) return null;

    const db = getDb();
    const [
      contents,
      [note],
      [favorite],
      allowance,
      collectionIds,
      userCollections,
      collectionAllowance,
      [source],
      photo,
      cooking,
    ] = await Promise.all([
      contentsFor(dish, locale),
      db
        .select({ text: dishNotes.text })
        .from(dishNotes)
        .where(and(eq(dishNotes.dishId, dish.id), eq(dishNotes.userId, userId)))
        .limit(1),
      db
        .select({ dishId: favorites.dishId })
        .from(favorites)
        .where(and(eq(favorites.dishId, dish.id), eq(favorites.userId, userId)))
        .limit(1),
      loadDishAllowance(userId),
      loadDishCollectionIds(userId, dish.id),
      loadCollections(userId),
      loadCollectionAllowance(userId),
      db
        .select({ url: dishSources.url, siteName: dishSources.siteName })
        .from(dishSources)
        .where(eq(dishSources.dishId, dish.id))
        .limit(1),
      photoUrls(dish.imageKey),
      loadDishCooking(userId, dish.id),
    ]);
    const [sharing, reviews] = await Promise.all([loadDishSharing(userId, dish), loadReviews(userId, dish)]);

    const shownServings = servings ?? dish.servings;
    const nutrition = {
      caloriesKcal: dish.caloriesKcal,
      proteinG: dish.proteinG,
      carbsG: dish.carbsG,
      fatG: dish.fatG,
    };
    return {
      id: dish.id,
      name: contents.name,
      difficulty: dish.difficulty,
      course: dish.course,
      seasons: dish.seasons,
      dietaryTags: dish.dietaryTags,
      servings: dish.servings,
      shownServings,
      ingredients: contents.ingredients.map((i) => ({
        ...i,
        amount: scaleAmount(i.amount, dish.servings, shownServings),
      })),
      steps: contents.steps,
      nutrition: Object.values(nutrition).some((v) => v !== null) ? nutrition : null,
      favorite: Boolean(favorite),
      note: note?.text ?? null,
      readOnly: allowance.readOnly,
      source: source ?? null,
      photo,
      cooking,
      photosEnabled: storageConfigured(),
      collectionIds,
      collections: userCollections,
      collectionAllowance,
      sharing,
      reviews,
    };
  },
);

const REVIEWS_SHOWN = 20;

/**
 * What others said about a dish: everyone but its owner, minus anyone blocked
 * either way with the viewer. The owner's own rating lives in `cooking`.
 */
async function loadReviews(viewerId: string, dish: { id: string; userId: string }): Promise<ReviewsDto> {
  const where = and(
    eq(dishRatings.dishId, dish.id),
    sql`${dishRatings.userId} <> ${dish.userId}`,
    notBlockedSql(viewerId, dishRatings.userId),
  );
  const [rows, [summary]] = await Promise.all([
    getDb()
      .select({
        id: dishRatings.id,
        userId: dishRatings.userId,
        stars: dishRatings.stars,
        review: dishRatings.review,
        at: dishRatings.updatedAt,
      })
      .from(dishRatings)
      .where(where)
      .orderBy(desc(dishRatings.updatedAt))
      .limit(REVIEWS_SHOWN),
    getDb()
      .select({ n: count(), average: sql<string | null>`avg(${dishRatings.stars})` })
      .from(dishRatings)
      .where(where),
  ]);
  const people = await loadBasics(rows.map((r) => r.userId));
  return {
    count: summary?.n ?? 0,
    average: summary?.average ? Math.round(Number(summary.average) * 10) / 10 : null,
    items: rows.flatMap((r) => {
      const person = people.get(r.userId);
      return person ? [{ id: r.id, person, stars: r.stars, review: r.review, at: r.at.toISOString() }] : [];
    }),
  };
}

/** A dish a friend shared with the viewer, read-only, scaled on the server like the viewer's own. */
export const getFriendDish = cache(
  async (dishId: string, servings?: number, locale: AppLocale = "en"): Promise<FriendDishDto | null> => {
    const session = await getSession();
    if (!session) return null;
    const viewerId = session.user.id;
    const found = await findViewableDish(viewerId, dishId);
    if (!found || found.isOwner) return null;
    const { dish } = found;
    const [contents, [owner], photo, reviews, [copy]] = await Promise.all([
      contentsFor(dish, locale),
      loadPeople(viewerId, [dish.userId]),
      photoUrls(dish.imageKey),
      loadReviews(viewerId, dish),
      getDb()
        .select({ id: dishes.id })
        .from(dishes)
        .where(and(eq(dishes.userId, viewerId), eq(dishes.copiedFromDishId, dish.id), isNull(dishes.deletedAt)))
        .limit(1),
    ]);
    if (!owner) return null;
    const shownServings = servings ?? dish.servings;
    const nutrition = {
      caloriesKcal: dish.caloriesKcal,
      proteinG: dish.proteinG,
      carbsG: dish.carbsG,
      fatG: dish.fatG,
    };
    return {
      id: dish.id,
      name: contents.name,
      difficulty: dish.difficulty,
      course: dish.course,
      seasons: dish.seasons,
      dietaryTags: dish.dietaryTags,
      servings: dish.servings,
      shownServings,
      ingredients: contents.ingredients.map((i) => ({
        ...i,
        amount: scaleAmount(i.amount, dish.servings, shownServings),
      })),
      steps: contents.steps,
      nutrition: Object.values(nutrition).some((v) => v !== null) ? nutrition : null,
      photo,
      reviews,
      owner,
      myCopyId: copy?.id ?? null,
    };
  },
);

/** The edit form's starting values (only for the owner). */
export const getDishForEdit = cache(async (dishId: string, locale: AppLocale = "en"): Promise<DishFormDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const dish = await findOwnDish(session.user.id, dishId);
  if (!dish) return null;
  const { name, ...contents } = await contentsFor(dish, locale);
  return {
    id: dish.id,
    name,
    difficulty: dish.difficulty,
    course: dish.course,
    servings: dish.servings,
    seasons: dish.seasons,
    dietaryTags: dish.dietaryTags,
    ...contents,
    caloriesKcal: dish.caloriesKcal,
    proteinG: dish.proteinG,
    carbsG: dish.carbsG,
    fatG: dish.fatG,
  };
});

/** The photo slot on the edit page (only for the owner). */
export const getDishPhotoSlot = cache(async (dishId: string): Promise<PhotoSlotDto | null> => {
  const session = await getSession();
  if (!session) return null;
  const dish = await findOwnDish(session.user.id, dishId);
  if (!dish) return null;
  return { photo: await photoUrls(dish.imageKey), enabled: storageConfigured() };
});

/** How often and how recently the person cooked a dish, and their rating. */
export async function loadDishCooking(userId: string, dishId: string): Promise<DishCookingDto> {
  const db = getDb();
  const [[history], [rating]] = await Promise.all([
    db
      .select({ times: count(), last: max(cookLog.date) })
      .from(cookLog)
      .where(and(eq(cookLog.userId, userId), eq(cookLog.dishId, dishId))),
    db
      .select({ stars: dishRatings.stars, review: dishRatings.review })
      .from(dishRatings)
      .where(and(eq(dishRatings.userId, userId), eq(dishRatings.dishId, dishId)))
      .limit(1),
  ]);
  const timesCooked = history?.times ?? 0;
  return { timesCooked, lastCooked: history?.last ?? null, rating: rating ?? null, canRate: timesCooked > 0 };
}
