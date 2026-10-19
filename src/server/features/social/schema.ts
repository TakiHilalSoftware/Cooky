// Shared by the social actions (authoritative) and their forms (hints).
import { z } from "zod";

import { DISH_VISIBILITIES, GROUP_NAME_MAX, REPORT_DETAILS_MAX, REPORT_REASONS, REPORT_TARGETS } from "@/lib/social";

/** Better Auth user ids: opaque, URL-safe. */
export const personId = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const personSchema = z.object({ userId: personId });

export const searchPeopleSchema = z.object({
  query: z.string().trim().min(2, "searchTooShort").max(100),
});

export const respondToRequestSchema = z.object({
  requestId: z.uuid(),
  response: z.enum(["accept", "decline", "block"]),
});

const groupName = z.string().trim().min(1, "groupNameRequired").max(GROUP_NAME_MAX, "groupNameTooLong");
const memberIds = z
  .array(personId)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, "duplicate");

export const createGroupSchema = z.object({ name: groupName, memberIds });
export const updateGroupSchema = z.object({ id: z.uuid(), name: groupName, memberIds });
export const groupIdSchema = z.object({ id: z.uuid() });

export const dishSharingSchema = z.object({
  dishId: z.uuid(),
  visibility: z.enum(DISH_VISIBILITIES),
  groupIds: z
    .array(z.uuid())
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, "duplicate"),
});

export const copyDishSchema = z.object({ dishId: z.uuid() });

export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  // A user id or a uuid, depending on the target.
  targetId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX, "reportDetailsTooLong").optional(),
});
