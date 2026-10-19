// URL params of admin pages, parsed leniently: anything odd falls back to the default.
import { z } from "zod";

import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from "@/lib/admin";
import { REPORT_STATUSES } from "@/lib/social";

export const pageParam = z.coerce.number().int().min(1).max(10_000).catch(1);
export const queryParam = z.string().trim().max(100).catch("");
export const reportStatusParam = z.enum(REPORT_STATUSES).catch("open");
export const feedbackStatusParam = z.enum(FEEDBACK_STATUSES).nullable().catch(null);
export const feedbackKindParam = z.enum(FEEDBACK_KINDS).nullable().catch(null);
export const contentTabParam = z.enum(["reviews", "shared"]).catch("reviews");
