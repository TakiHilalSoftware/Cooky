import "server-only";

import { and, count, desc, eq, gt, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";

import { PLAN_PRICES, type PaidPlan } from "@config/plans";
import { ADMIN_PAGE_SIZE, type FeedbackKind, type FeedbackStatus } from "@/lib/admin";
import type { ReportStatus } from "@/lib/social";
import { getSession, isAdmin } from "@/server/auth/session";
import { lockedUntil } from "@/server/auth/lockout";
import { getDb } from "@/server/db/client";
import {
  auditLog,
  catalogDishes,
  catalogIngredients,
  catalogSteps,
  dishes,
  dishRatings,
  entitlements,
  feedback,
  messages,
  profiles,
  reports,
  session,
  subscriptions,
  usageCounters,
  user,
} from "@/server/db/schema";
import { escapeLike } from "@/server/features/social/service";

import type {
  AdminOverviewDto,
  AdminUserDetailDto,
  AdminUserRowDto,
  AuditEntryDto,
  CatalogDishFormDto,
  CatalogRowDto,
  FeedbackDto,
  Paged,
  ReportDto,
  ReviewModerationDto,
  SharedDishModerationDto,
} from "./dto";

/** Every admin read starts here: the role comes from the database session, never the client. */
export const requireAdmin = cache(async () => {
  const s = await getSession();
  return s && isAdmin(s) ? s : null;
});

const DAY_MS = 24 * 60 * 60 * 1000;

function paged<T>(rows: T[], total: number, page: number): Paged<T> {
  return { rows, page, total, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}
const offsetOf = (page: number) => (page - 1) * ADMIN_PAGE_SIZE;
const nameOf = (r: { displayName: string | null; name: string }) => r.displayName ?? r.name;

/** PRD §3.8 overview: people, money, content and try usage at a glance. */
export const getAdminOverview = cache(async (now = new Date()): Promise<AdminOverviewDto | null> => {
  if (!(await requireAdmin())) return null;
  const db = getDb();
  // Every try period that's running now started within the last month (Free: the UTC month;
  // paid: the billing month), so this sums the current periods of everyone.
  const currentPeriods = new Date(now.getTime() - 31 * DAY_MS);
  const [[users], [newUsers], live, [catalog], [mine], [shared], [reviews], [openReports], [openFeedback], tries] =
    await Promise.all([
      db.select({ n: count() }).from(user),
      db
        .select({ n: count() })
        .from(user)
        .where(gt(user.createdAt, new Date(now.getTime() - 7 * DAY_MS))),
      db
        .select({ plan: subscriptions.plan, interval: subscriptions.interval, status: subscriptions.status })
        .from(subscriptions)
        .where(inArray(subscriptions.status, ["trialing", "active", "past_due"])),
      db.select({ n: count() }).from(catalogDishes),
      db.select({ n: count() }).from(dishes).where(isNull(dishes.deletedAt)),
      db
        .select({ n: count() })
        .from(dishes)
        .where(and(isNull(dishes.deletedAt), ne(dishes.visibility, "private"))),
      db
        .select({ n: count() })
        .from(dishRatings)
        .where(sql`coalesce(trim(${dishRatings.review}), '') <> ''`),
      db.select({ n: count() }).from(reports).where(eq(reports.status, "open")),
      db.select({ n: count() }).from(feedback).where(eq(feedback.status, "open")),
      db
        .select({ feature: usageCounters.feature, used: sql<number>`sum(${usageCounters.used})::int` })
        .from(usageCounters)
        .where(gt(usageCounters.periodStart, currentPeriods))
        .groupBy(usageCounters.feature),
    ]);
  const paying = live.filter((s) => s.status !== "trialing");
  const mrrCents = paying.reduce((sum, s) => {
    const price = PLAN_PRICES[s.plan as PaidPlan][s.interval];
    return sum + (s.interval === "year" ? Math.round(price / 12) : price);
  }, 0);
  return {
    users: users?.n ?? 0,
    newThisWeek: newUsers?.n ?? 0,
    mrrCents,
    activeSubscriptions: paying.length,
    trials: live.length - paying.length,
    catalogDishes: catalog?.n ?? 0,
    userDishes: mine?.n ?? 0,
    sharedDishes: shared?.n ?? 0,
    writtenReviews: reviews?.n ?? 0,
    openReports: openReports?.n ?? 0,
    openFeedback: openFeedback?.n ?? 0,
    triesThisMonth: tries.map((t) => ({ feature: t.feature, used: t.used })),
  };
});

const userColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  emailVerified: user.emailVerified,
  role: user.role,
  banned: user.banned,
  status: user.status,
  displayName: profiles.displayName,
  plan: entitlements.plan,
  source: entitlements.source,
  periodEnd: entitlements.periodEnd,
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  emailVerified: boolean;
  role: string | null;
  banned: boolean | null;
  status: "active" | "pending_deletion";
  displayName: string | null;
  plan: AdminUserRowDto["plan"] | null;
  source: AdminUserRowDto["planSource"];
};

function toUserRow(r: UserRow): AdminUserRowDto {
  return {
    id: r.id,
    displayName: nameOf(r),
    email: r.email,
    createdAt: r.createdAt.toISOString(),
    emailVerified: r.emailVerified,
    isAdmin: r.role === "admin",
    suspended: r.banned === true,
    pendingDeletion: r.status === "pending_deletion",
    plan: r.plan ?? "free",
    planSource: r.plan ? r.source : null,
  };
}

/** Users by name or email, newest first. */
export async function listUsers(q: string, page: number): Promise<Paged<AdminUserRowDto> | null> {
  if (!(await requireAdmin())) return null;
  const like = `%${escapeLike(q.trim())}%`;
  const where = q.trim()
    ? or(ilike(user.email, like), ilike(user.name, like), ilike(profiles.displayName, like))
    : undefined;
  const base = () =>
    getDb()
      .select(userColumns)
      .from(user)
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .leftJoin(entitlements, eq(entitlements.userId, user.id));
  const [rows, [total]] = await Promise.all([
    base().where(where).orderBy(desc(user.createdAt)).limit(ADMIN_PAGE_SIZE).offset(offsetOf(page)),
    getDb().select({ n: count() }).from(user).leftJoin(profiles, eq(profiles.userId, user.id)).where(where),
  ]);
  return paged(rows.map(toUserRow), total?.n ?? 0, page);
}

export async function getAdminUser(userId: string): Promise<AdminUserDetailDto | null> {
  const admin = await requireAdmin();
  if (!admin) return null;
  const db = getDb();
  const [row] = await db
    .select(userColumns)
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .leftJoin(entitlements, eq(entitlements.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return null;
  const [[dishCount], [sessions], [against], locked] = await Promise.all([
    db
      .select({ n: count() })
      .from(dishes)
      .where(and(eq(dishes.userId, userId), isNull(dishes.deletedAt))),
    db
      .select({ n: count() })
      .from(session)
      .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date()))),
    db
      .select({ n: count() })
      .from(reports)
      .where(and(eq(reports.targetType, "user"), eq(reports.targetId, userId))),
    lockedUntil(row.email),
  ]);
  return {
    ...toUserRow(row),
    dishCount: dishCount?.n ?? 0,
    activeSessions: sessions?.n ?? 0,
    lockedUntil: locked?.toISOString() ?? null,
    compEndsAt: row.source === "comp" ? (row.periodEnd?.toISOString() ?? null) : null,
    reportsAgainst: against?.n ?? 0,
    isSelf: admin.user.id === userId,
  };
}

/** The Discover catalog with how often each dish was saved and which translations are missing. */
export async function listCatalog(q: string, page: number): Promise<Paged<CatalogRowDto> | null> {
  if (!(await requireAdmin())) return null;
  const like = `%${escapeLike(q.trim())}%`;
  const where: SQL | undefined = q.trim()
    ? or(
        ilike(catalogDishes.nameEn, like),
        ilike(catalogDishes.nameFr, like),
        ilike(catalogDishes.nameAr, like),
        ilike(catalogDishes.country, like),
      )
    : undefined;
  const saves = getDb()
    .select({ catalogDishId: dishes.catalogDishId, n: count().as("n") })
    .from(dishes)
    .where(isNull(dishes.deletedAt))
    .groupBy(dishes.catalogDishId)
    .as("saves");
  const [rows, [total]] = await Promise.all([
    getDb()
      .select({
        id: catalogDishes.id,
        slug: catalogDishes.slug,
        en: catalogDishes.nameEn,
        fr: catalogDishes.nameFr,
        ar: catalogDishes.nameAr,
        country: catalogDishes.country,
        course: catalogDishes.course,
        featured: catalogDishes.featured,
        saves: sql<number>`coalesce(${saves.n}, 0)::int`,
        // A translation counts as missing if the dish's name or any line or step lacks it.
        missingFr: sql<boolean>`(${catalogDishes.nameFr} is null or ${catalogDishes.descriptionFr} is null
          or exists (select 1 from ${catalogIngredients} ci where ci.catalog_dish_id = ${catalogDishes.id} and ci.name_fr is null)
          or exists (select 1 from ${catalogSteps} cs where cs.catalog_dish_id = ${catalogDishes.id} and cs.text_fr is null))`,
        missingAr: sql<boolean>`(${catalogDishes.nameAr} is null or ${catalogDishes.descriptionAr} is null
          or exists (select 1 from ${catalogIngredients} ci where ci.catalog_dish_id = ${catalogDishes.id} and ci.name_ar is null)
          or exists (select 1 from ${catalogSteps} cs where cs.catalog_dish_id = ${catalogDishes.id} and cs.text_ar is null))`,
      })
      .from(catalogDishes)
      .leftJoin(saves, eq(saves.catalogDishId, catalogDishes.id))
      .where(where)
      .orderBy(catalogDishes.nameEn)
      .limit(ADMIN_PAGE_SIZE)
      .offset(offsetOf(page)),
    getDb().select({ n: count() }).from(catalogDishes).where(where),
  ]);
  return paged(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.en,
      country: r.country,
      course: r.course,
      featured: r.featured,
      saves: r.saves,
      missing: [...(r.missingFr ? (["fr"] as const) : []), ...(r.missingAr ? (["ar"] as const) : [])],
    })),
    total?.n ?? 0,
    page,
  );
}

const texts = (en: string | null, fr: string | null, ar: string | null) => ({
  en: en ?? "",
  fr: fr ?? "",
  ar: ar ?? "",
});

export async function getCatalogDishForEdit(id: string): Promise<CatalogDishFormDto | null> {
  if (!(await requireAdmin())) return null;
  const db = getDb();
  const [dish] = await db.select().from(catalogDishes).where(eq(catalogDishes.id, id)).limit(1);
  if (!dish) return null;
  const [lines, steps] = await Promise.all([
    db
      .select()
      .from(catalogIngredients)
      .where(eq(catalogIngredients.catalogDishId, id))
      .orderBy(catalogIngredients.position),
    db.select().from(catalogSteps).where(eq(catalogSteps.catalogDishId, id)).orderBy(catalogSteps.position),
  ]);
  return {
    id: dish.id,
    slug: dish.slug,
    country: dish.country,
    course: dish.course,
    difficulty: dish.difficulty,
    servings: dish.servings,
    seasons: dish.seasons,
    dietaryTags: dish.dietaryTags,
    collections: dish.collections,
    featured: dish.featured,
    name: texts(dish.nameEn, dish.nameFr, dish.nameAr),
    description: texts(dish.descriptionEn, dish.descriptionFr, dish.descriptionAr),
    ingredients: lines.map((l) => ({
      amount: l.amount,
      unit: l.unit,
      name: texts(l.nameEn, l.nameFr, l.nameAr),
      note: texts(l.noteEn, l.noteFr, l.noteAr),
    })),
    steps: steps.map((s) => ({
      text: texts(s.textEn, s.textFr, s.textAr),
      timerMinutes: s.timerSeconds === null ? null : Math.round(s.timerSeconds / 60),
    })),
  };
}

/** Written reviews, newest first (Content → Reviews). */
export async function listRecentReviews(page: number): Promise<Paged<ReviewModerationDto> | null> {
  if (!(await requireAdmin())) return null;
  const written = sql`coalesce(trim(${dishRatings.review}), '') <> ''`;
  const [rows, [total]] = await Promise.all([
    getDb()
      .select({
        id: dishRatings.id,
        dishId: dishes.id,
        dishName: dishes.name,
        name: user.name,
        displayName: profiles.displayName,
        stars: dishRatings.stars,
        review: dishRatings.review,
        at: dishRatings.updatedAt,
      })
      .from(dishRatings)
      .innerJoin(dishes, eq(dishes.id, dishRatings.dishId))
      .innerJoin(user, eq(user.id, dishRatings.userId))
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .where(written)
      .orderBy(desc(dishRatings.updatedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offsetOf(page)),
    getDb().select({ n: count() }).from(dishRatings).where(written),
  ]);
  return paged(
    rows.map((r) => ({
      id: r.id,
      dishId: r.dishId,
      dishName: r.dishName,
      author: nameOf(r),
      stars: r.stars,
      review: r.review ?? "",
      at: r.at.toISOString(),
    })),
    total?.n ?? 0,
    page,
  );
}

/** Dishes shared with friends or groups, newest first (Content → Shared dishes). */
export async function listSharedDishes(page: number): Promise<Paged<SharedDishModerationDto> | null> {
  if (!(await requireAdmin())) return null;
  const where = and(isNull(dishes.deletedAt), ne(dishes.visibility, "private"));
  const [rows, [total]] = await Promise.all([
    getDb()
      .select({
        id: dishes.id,
        dishName: dishes.name,
        ownerId: dishes.userId,
        name: user.name,
        displayName: profiles.displayName,
        visibility: dishes.visibility,
        at: dishes.updatedAt,
      })
      .from(dishes)
      .innerJoin(user, eq(user.id, dishes.userId))
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .where(where)
      .orderBy(desc(dishes.updatedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offsetOf(page)),
    getDb().select({ n: count() }).from(dishes).where(where),
  ]);
  return paged(
    rows.map((r) => ({
      id: r.id,
      name: r.dishName,
      owner: nameOf(r),
      ownerId: r.ownerId,
      visibility: r.visibility === "groups" ? ("groups" as const) : ("friends" as const),
      at: r.at.toISOString(),
    })),
    total?.n ?? 0,
    page,
  );
}

/** The reports queue, with a preview of each reported thing. */
export async function listReports(status: ReportStatus, page: number): Promise<Paged<ReportDto> | null> {
  if (!(await requireAdmin())) return null;
  const db = getDb();
  const [rows, [total]] = await Promise.all([
    db
      .select({ report: reports, name: user.name, displayName: profiles.displayName })
      .from(reports)
      .leftJoin(user, eq(user.id, reports.reporterId))
      .leftJoin(profiles, eq(profiles.userId, reports.reporterId))
      .where(eq(reports.status, status))
      .orderBy(desc(reports.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offsetOf(page)),
    db.select({ n: count() }).from(reports).where(eq(reports.status, status)),
  ]);
  const previews = await Promise.all(rows.map(({ report }) => previewOf(report.targetType, report.targetId)));
  return paged(
    rows.map(({ report, name, displayName }, i) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolution: report.resolution,
      reporter: name ? (displayName ?? name) : null,
      at: report.createdAt.toISOString(),
      preview: previews[i] ?? null,
    })),
    total?.n ?? 0,
    page,
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What a report points at, for the admin to judge (null once it's gone). */
async function previewOf(type: ReportDto["targetType"], id: string): Promise<ReportDto["preview"]> {
  const db = getDb();
  if (type === "user") {
    const [row] = await db
      .select({ name: user.name, displayName: profiles.displayName, email: user.email })
      .from(user)
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, id))
      .limit(1);
    return row ? { title: nameOf(row), text: row.email, ownerId: id } : null;
  }
  if (!UUID.test(id)) return null;
  if (type === "dish") {
    const [row] = await db
      .select({ name: dishes.name, ownerId: dishes.userId })
      .from(dishes)
      .where(eq(dishes.id, id))
      .limit(1);
    return row ? { title: row.name, text: null, ownerId: row.ownerId } : null;
  }
  if (type === "message") {
    const [row] = await db
      .select({ content: messages.content, ownerId: messages.senderId, deletedAt: messages.deletedAt })
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);
    // Moderators see a reported message even after its author deleted it, until it's wiped.
    return row ? { title: row.deletedAt ? "(deleted)" : "", text: row.content || null, ownerId: row.ownerId } : null;
  }
  const [row] = await db
    .select({ review: dishRatings.review, stars: dishRatings.stars, ownerId: dishRatings.userId, dish: dishes.name })
    .from(dishRatings)
    .innerJoin(dishes, eq(dishes.id, dishRatings.dishId))
    .where(eq(dishRatings.id, id))
    .limit(1);
  return row ? { title: `${row.dish} · ${row.stars}★`, text: row.review, ownerId: row.ownerId } : null;
}

export async function listFeedback(
  filters: { status: FeedbackStatus | null; kind: FeedbackKind | null },
  page: number,
): Promise<Paged<FeedbackDto> | null> {
  if (!(await requireAdmin())) return null;
  const where = and(
    filters.status ? eq(feedback.status, filters.status) : undefined,
    filters.kind ? eq(feedback.kind, filters.kind) : undefined,
  );
  const [rows, [total]] = await Promise.all([
    getDb()
      .select({ f: feedback, name: user.name, email: user.email, displayName: profiles.displayName })
      .from(feedback)
      .leftJoin(user, eq(user.id, feedback.userId))
      .leftJoin(profiles, eq(profiles.userId, feedback.userId))
      .where(where)
      .orderBy(desc(feedback.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offsetOf(page)),
    getDb().select({ n: count() }).from(feedback).where(where),
  ]);
  return paged(
    rows.map(({ f, name, email, displayName }) => ({
      id: f.id,
      kind: f.kind,
      status: f.status,
      message: f.message,
      author: name ? (displayName ?? name) : null,
      email,
      locale: f.locale,
      userAgent: f.userAgent,
      at: f.createdAt.toISOString(),
    })),
    total?.n ?? 0,
    page,
  );
}

/** The audit log, newest first, optionally narrowed to actions starting with `action`. */
export async function listAudit(action: string, page: number): Promise<Paged<AuditEntryDto> | null> {
  if (!(await requireAdmin())) return null;
  const where = action.trim() ? ilike(auditLog.action, `${escapeLike(action.trim())}%`) : undefined;
  const [rows, [total]] = await Promise.all([
    getDb()
      .select({ a: auditLog, name: user.name, displayName: profiles.displayName })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorId))
      .leftJoin(profiles, eq(profiles.userId, auditLog.actorId))
      .where(where)
      .orderBy(desc(auditLog.at))
      .limit(ADMIN_PAGE_SIZE)
      .offset(offsetOf(page)),
    getDb().select({ n: count() }).from(auditLog).where(where),
  ]);
  return paged(
    rows.map(({ a, name, displayName }) => ({
      id: a.id,
      action: a.action,
      actor: name ? (displayName ?? name) : null,
      targetType: a.targetType,
      targetId: a.targetId,
      meta: a.meta ? JSON.stringify(a.meta) : null,
      at: a.at.toISOString(),
    })),
    total?.n ?? 0,
    page,
  );
}
