import "server-only";

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  assistantMessages,
  assistantThreads,
  auditLog,
  consents,
  conversations,
  cookLog,
  dataExports,
  dishes,
  dishRatings,
  entitlements,
  eventDishes,
  events,
  feedback,
  friendGroupMembers,
  friendGroups,
  friendRequests,
  messages,
  pantryItems,
  plannedMeals,
  profiles,
  reports,
  session,
  shoppingItems,
  shoppingLists,
  subscriptions,
  user,
  userBlocks,
} from "@/server/db/schema";
import { env } from "@/server/env";
import { buildBackup } from "@/server/features/backup/service";
import { loadBasics, loadFriendIds } from "@/server/features/social/queries";
import { enqueue } from "@/server/outbox/enqueue";
import { putObject, storageConfigured } from "@/server/storage/r2";

/** Ready exports can be downloaded for this long (PRD §3.1: a short-lived link). */
export const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Everything Cooky holds about the person (GDPR export), as plain JSON. Other
 * people appear by display name only, never by email; storage keys and
 * internal flags are left out.
 */
export async function buildDataExport(userId: string, now = new Date()) {
  const db = getDb();
  const [[account], [profile], consentRows, recipes] = await Promise.all([
    db.select().from(user).where(eq(user.id, userId)).limit(1),
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.select().from(consents).where(eq(consents.userId, userId)),
    buildBackup(userId, now),
  ]);
  const [ratings, pantry, cooks, planned, ownEvents, threads, sessions, auditRows, reportRows, feedbackRows] =
    await Promise.all([
      db
        .select({ dish: dishes.name, stars: dishRatings.stars, review: dishRatings.review, at: dishRatings.updatedAt })
        .from(dishRatings)
        .innerJoin(dishes, eq(dishes.id, dishRatings.dishId))
        .where(eq(dishRatings.userId, userId)),
      db.select().from(pantryItems).where(eq(pantryItems.userId, userId)),
      db
        .select({ date: cookLog.date, dish: dishes.name, mealSlot: cookLog.mealSlot, source: cookLog.source })
        .from(cookLog)
        .innerJoin(dishes, eq(dishes.id, cookLog.dishId))
        .where(eq(cookLog.userId, userId))
        .orderBy(asc(cookLog.date)),
      db
        .select({ date: plannedMeals.date, dish: dishes.name, mealSlot: plannedMeals.mealSlot })
        .from(plannedMeals)
        .innerJoin(dishes, eq(dishes.id, plannedMeals.dishId))
        .where(eq(plannedMeals.userId, userId))
        .orderBy(asc(plannedMeals.date)),
      db.select().from(events).where(eq(events.userId, userId)).orderBy(asc(events.date)),
      db.select().from(assistantThreads).where(eq(assistantThreads.userId, userId)),
      db.select().from(session).where(eq(session.userId, userId)),
      db
        .select({ action: auditLog.action, at: auditLog.at })
        .from(auditLog)
        .where(eq(auditLog.actorId, userId))
        .orderBy(desc(auditLog.at))
        .limit(1000),
      db.select().from(reports).where(eq(reports.reporterId, userId)),
      db.select().from(feedback).where(eq(feedback.userId, userId)),
    ]);

  const [eventCourses, threadMessages, list] = await Promise.all([
    ownEvents.length
      ? db
          .select({ eventId: eventDishes.eventId, course: eventDishes.course, dish: dishes.name })
          .from(eventDishes)
          .innerJoin(dishes, eq(dishes.id, eventDishes.dishId))
          .where(
            inArray(
              eventDishes.eventId,
              ownEvents.map((e) => e.id),
            ),
          )
      : [],
    threads.length
      ? db
          .select()
          .from(assistantMessages)
          .where(
            inArray(
              assistantMessages.threadId,
              threads.map((t) => t.id),
            ),
          )
          .orderBy(asc(assistantMessages.createdAt))
      : [],
    db.select({ id: shoppingLists.id }).from(shoppingLists).where(eq(shoppingLists.ownerId, userId)).limit(1),
  ]);
  const shopping = list[0] ? await db.select().from(shoppingItems).where(eq(shoppingItems.listId, list[0].id)) : [];

  return {
    format: "cooky-data-export",
    version: 1,
    exportedAt: now.toISOString(),
    account: account
      ? {
          name: account.name,
          email: account.email,
          emailVerified: account.emailVerified,
          twoFactorEnabled: Boolean(account.twoFactorEnabled),
          createdAt: iso(account.createdAt),
        }
      : null,
    profile: profile
      ? {
          displayName: profile.displayName,
          locale: profile.locale,
          accent: profile.accent,
          theme: profile.theme,
          textSize: profile.textSize,
          city: profile.city,
          dietaryPrefs: profile.dietaryPrefs,
          mealTimes: profile.mealTimes,
          notificationsOff: profile.notificationsOff,
          onboardedAt: iso(profile.onboardedAt),
        }
      : null,
    consents: consentRows.map((c) => ({ document: c.document, version: c.version, acceptedAt: iso(c.acceptedAt) })),
    recipes,
    ratings: ratings.map((r) => ({ ...r, at: iso(r.at) })),
    kitchen: pantry.map((p) => ({ name: p.name, staple: p.isStaple })),
    cooked: cooks,
    planned,
    events: ownEvents.map((e) => ({
      name: e.name,
      date: e.date,
      guests: e.guests,
      courses: eventCourses.filter((c) => c.eventId === e.id).map(({ course, dish }) => ({ course, dish })),
    })),
    shoppingList: shopping.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, checked: i.checked })),
    assistant: threads.map((t) => ({
      title: t.title,
      messages: threadMessages
        .filter((m) => m.threadId === t.id)
        .map((m) => ({ role: m.role, content: m.content, at: iso(m.createdAt) })),
    })),
    ...(await socialSection(userId)),
    reportsFiled: reportRows.map((r) => ({
      about: r.targetType,
      reason: r.reason,
      details: r.details,
      status: r.status,
      at: iso(r.createdAt),
    })),
    feedback: feedbackRows.map((f) => ({ kind: f.kind, message: f.message, status: f.status, at: iso(f.createdAt) })),
    billing: await billingSection(userId),
    security: {
      devices: sessions.map((s) => ({ userAgent: s.userAgent, ip: s.ipAddress, since: iso(s.createdAt) })),
      activity: auditRows.map((a) => ({ action: a.action, at: iso(a.at) })),
    },
  };
}

async function socialSection(userId: string) {
  const db = getDb();
  const [friends, requests, blocks, groups, members, chats] = await Promise.all([
    loadFriendIds(userId),
    db
      .select()
      .from(friendRequests)
      .where(or(eq(friendRequests.fromUserId, userId), eq(friendRequests.toUserId, userId))),
    db.select().from(userBlocks).where(eq(userBlocks.blockerId, userId)),
    db.select().from(friendGroups).where(eq(friendGroups.ownerId, userId)),
    db
      .select({ groupId: friendGroupMembers.groupId, memberId: friendGroupMembers.memberId })
      .from(friendGroupMembers)
      .innerJoin(friendGroups, eq(friendGroups.id, friendGroupMembers.groupId))
      .where(eq(friendGroups.ownerId, userId)),
    db
      .select()
      .from(conversations)
      .where(or(eq(conversations.userAId, userId), eq(conversations.userBId, userId))),
  ]);
  const chatMessages = chats.length
    ? await db
        .select()
        .from(messages)
        .where(
          and(
            inArray(
              messages.conversationId,
              chats.map((c) => c.id),
            ),
            isNull(messages.deletedAt),
          ),
        )
        .orderBy(asc(messages.createdAt))
    : [];
  const otherOf = (c: (typeof chats)[number]) => (c.userAId === userId ? c.userBId : c.userAId);
  const names = await loadBasics([
    ...friends.map((f) => f.id),
    ...requests.flatMap((r) => [r.fromUserId, r.toUserId]),
    ...blocks.map((b) => b.blockedId),
    ...members.map((m) => m.memberId),
    ...chats.map(otherOf),
  ]);
  const name = (id: string) => names.get(id)?.displayName ?? null;
  return {
    friends: friends.map((f) => ({ name: name(f.id), since: iso(f.since) })),
    friendRequests: requests.map((r) => ({
      direction: r.fromUserId === userId ? "sent" : "received",
      person: name(r.fromUserId === userId ? r.toUserId : r.fromUserId),
      status: r.status,
      at: iso(r.sentAt),
    })),
    blocked: blocks.map((b) => name(b.blockedId)),
    groups: groups.map((g) => ({
      name: g.name,
      members: members.filter((m) => m.groupId === g.id).map((m) => name(m.memberId)),
    })),
    conversations: chats.map((c) => ({
      with: name(otherOf(c)),
      messages: chatMessages
        .filter((m) => m.conversationId === c.id)
        .map((m) => ({
          fromMe: m.senderId === userId,
          text: m.content,
          at: iso(m.createdAt),
          editedAt: iso(m.editedAt),
        })),
    })),
  };
}

async function billingSection(userId: string) {
  const db = getDb();
  const [[entitlement], subs] = await Promise.all([
    db.select().from(entitlements).where(eq(entitlements.userId, userId)).limit(1),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
  ]);
  return {
    plan: entitlement?.plan ?? "free",
    source: entitlement?.source ?? null,
    subscriptions: subs.map((s) => ({
      plan: s.plan,
      interval: s.interval,
      status: s.status,
      periodStart: iso(s.currentPeriodStart),
      periodEnd: iso(s.currentPeriodEnd),
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    })),
  };
}

/**
 * The outbox job: builds the file, stores it privately (R2, or the row itself
 * when storage isn't set up locally), and makes it downloadable for a day.
 */
export async function runDataExport(exportId: string, now = new Date()): Promise<{ userId: string } | null> {
  const db = getDb();
  const [row] = await db.select().from(dataExports).where(eq(dataExports.id, exportId)).limit(1);
  if (!row || row.status === "ready") return null;
  await db.update(dataExports).set({ status: "running" }).where(eq(dataExports.id, row.id));
  try {
    const body = JSON.stringify(await buildDataExport(row.userId, now), null, 2);
    const ready = {
      status: "ready" as const,
      sizeBytes: Buffer.byteLength(body),
      finishedAt: now,
      expiresAt: new Date(now.getTime() + EXPORT_TTL_MS),
    };
    if (storageConfigured()) {
      const objectKey = `u/${row.userId}/exports/${row.id}.json`;
      await putObject(objectKey, Buffer.from(body), "application/json");
      await db
        .update(dataExports)
        .set({ ...ready, objectKey })
        .where(eq(dataExports.id, row.id));
    } else {
      await db
        .update(dataExports)
        .set({ ...ready, content: body })
        .where(eq(dataExports.id, row.id));
    }
    await db.transaction(async (tx) => {
      const [owner] = await tx.select({ email: user.email }).from(user).where(eq(user.id, row.userId)).limit(1);
      if (owner) {
        await enqueue(tx, {
          kind: "email",
          payload: { template: "dataExportReady", userId: row.userId, to: owner.email, url: settingsDataUrl() },
        });
      }
    });
    return { userId: row.userId };
  } catch (err) {
    await db.update(dataExports).set({ status: "failed", finishedAt: now }).where(eq(dataExports.id, row.id));
    throw err;
  }
}

function settingsDataUrl(): string {
  // Links are built from the validated APP_URL, never from a request (ARCHITECTURE §5.13).
  return new URL("/settings/data", env.NEXT_PUBLIC_APP_URL).toString();
}
