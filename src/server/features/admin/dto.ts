// What the admin panel may show. Types only: safe for the UI. Admin pages are
// admin-only (checked on the server), so these may carry emails, never secrets.
import type { Plan } from "@config/plans";
import type { FeedbackKind, FeedbackStatus } from "@/lib/admin";
import type { CatalogCollection, Course, DietaryTag, Difficulty, Season, Unit } from "@/lib/dishes";
import type { ReportReason, ReportStatus, ReportTarget } from "@/lib/social";

export type Paged<T> = { rows: T[]; page: number; pageCount: number; total: number };

export type AdminOverviewDto = {
  users: number;
  newThisWeek: number;
  /** Monthly recurring revenue in euro cents (yearly plans count as a twelfth). */
  mrrCents: number;
  activeSubscriptions: number;
  trials: number;
  catalogDishes: number;
  userDishes: number;
  sharedDishes: number;
  writtenReviews: number;
  openReports: number;
  openFeedback: number;
  /** Tries used this calendar month, per metered feature. */
  triesThisMonth: { feature: string; used: number }[];
};

export type AdminUserRowDto = {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  isAdmin: boolean;
  suspended: boolean;
  pendingDeletion: boolean;
  plan: Plan;
  /** comp = granted by an admin. */
  planSource: "stripe" | "trial" | "comp" | null;
};

export type AdminUserDetailDto = AdminUserRowDto & {
  dishCount: number;
  activeSessions: number;
  /** Locked out after failed logins, until this ISO time. */
  lockedUntil: string | null;
  compEndsAt: string | null;
  reportsAgainst: number;
  isSelf: boolean;
};

export type CatalogRowDto = {
  id: string;
  slug: string;
  name: string;
  country: string;
  course: Course;
  /** How many people saved it to their box. */
  saves: number;
  missing: ("fr" | "ar")[];
  featured: boolean;
};

export type CatalogTexts = { en: string; fr: string; ar: string };

export type CatalogDishFormDto = {
  id: string | null;
  slug: string;
  country: string;
  course: Course;
  difficulty: Difficulty;
  servings: number;
  seasons: Season[];
  dietaryTags: DietaryTag[];
  collections: CatalogCollection[];
  featured: boolean;
  name: CatalogTexts;
  description: CatalogTexts;
  ingredients: { amount: number | null; unit: Unit | null; name: CatalogTexts; note: CatalogTexts }[];
  steps: { text: CatalogTexts; timerMinutes: number | null }[];
};

export type ReviewModerationDto = {
  id: string;
  dishId: string;
  dishName: string;
  author: string;
  stars: number;
  review: string;
  at: string;
};

export type SharedDishModerationDto = {
  id: string;
  name: string;
  owner: string;
  ownerId: string;
  visibility: "friends" | "groups";
  at: string;
};

export type ReportDto = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution: string | null;
  reporter: string | null;
  at: string;
  /** What was reported, as the admin needs to judge it. */
  preview: { title: string; text: string | null; ownerId: string | null } | null;
};

export type FeedbackDto = {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  message: string;
  author: string | null;
  email: string | null;
  locale: string;
  userAgent: string | null;
  at: string;
};

export type AuditEntryDto = {
  id: string;
  action: string;
  actor: string | null;
  targetType: string | null;
  targetId: string | null;
  meta: string | null;
  at: string;
};
