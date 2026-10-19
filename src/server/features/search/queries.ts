import "server-only";

import { and, desc, eq, isNull, or, sql, type AnyColumn } from "drizzle-orm";

import type { AppLocale } from "@/i18n/routing";
import { getDb } from "@/server/db/client";
import { catalogDishes, dishes, events, friendships, profiles, user } from "@/server/db/schema";
import { inLocale } from "@/server/features/discover/queries";
import { notBlockedSql, sharedWithSql } from "@/server/features/social/policy";

import type { SearchResultsDto } from "./dto";

const PER_GROUP = 6;

/**
 * Global search (PRD §3.5): the person's dishes, dishes friends share with
 * them, Discover, their friends and events, typo-tolerant (substring or
 * trigram word similarity, accents ignored).
 */
export async function searchEverything(userId: string, q: string, locale: AppLocale): Promise<SearchResultsDto> {
  const db = getDb();
  // LIKE wildcards in what was typed are literal characters.
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const near = (column: AnyColumn) =>
    or(
      sql`unaccent(${column}) ilike unaccent(${like})`,
      sql`word_similarity(unaccent(${q}), unaccent(${column})) > 0.45`,
    );
  const rank = (column: AnyColumn) => sql`word_similarity(unaccent(${q}), unaccent(${column}))`;
  const catalogName =
    locale === "fr" ? catalogDishes.nameFr : locale === "ar" ? catalogDishes.nameAr : catalogDishes.nameEn;

  const friendIds = db
    .select({
      id: sql<string>`case when ${friendships.userAId} = ${userId} then ${friendships.userBId} else ${friendships.userAId} end`,
    })
    .from(friendships)
    .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)));

  const [mine, shared, catalog, planned, people] = await Promise.all([
    db
      .select({ id: dishes.id, name: dishes.name })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt), near(dishes.name)))
      .orderBy(desc(rank(dishes.name)))
      .limit(PER_GROUP),
    db
      .select({ id: dishes.id, name: dishes.name })
      .from(dishes)
      .where(and(sharedWithSql(userId), near(dishes.name)))
      .orderBy(desc(rank(dishes.name)))
      .limit(PER_GROUP),
    db
      .select({
        slug: catalogDishes.slug,
        en: catalogDishes.nameEn,
        fr: catalogDishes.nameFr,
        ar: catalogDishes.nameAr,
      })
      .from(catalogDishes)
      .where(
        or(
          near(catalogDishes.nameEn),
          sql`${catalogName} is not null and unaccent(${catalogName}) ilike unaccent(${like})`,
        ),
      )
      .orderBy(desc(rank(catalogDishes.nameEn)))
      .limit(PER_GROUP),
    db
      .select({ id: events.id, name: events.name, date: events.date })
      .from(events)
      .where(and(eq(events.userId, userId), near(events.name)))
      .orderBy(desc(events.date))
      .limit(PER_GROUP),
    db
      .select({ id: profiles.userId, name: profiles.displayName })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.userId))
      .where(
        and(
          sql`${profiles.userId} in ${friendIds}`,
          notBlockedSql(userId, profiles.userId),
          near(profiles.displayName),
        ),
      )
      .orderBy(desc(rank(profiles.displayName)))
      .limit(PER_GROUP),
  ]);
  return {
    dishes: mine,
    shared,
    friends: people,
    discover: catalog.map((c) => ({ slug: c.slug, name: inLocale({ en: c.en, fr: c.fr, ar: c.ar }, locale) })),
    events: planned,
  };
}
