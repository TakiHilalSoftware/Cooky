import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type * as FetchModule from "@/server/importer/fetch";

import { browser } from "./support/browser";
import { db, resetData, userByEmail } from "./support/db";
import { logIn, signUpAndVerify } from "./support/flows";
import { hibp } from "./support/hibp";
import { fakeR2, r2Handlers } from "./support/r2";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/notify/email/send", () => ({ sendEmail }));

// The SSRF guard is unit-tested; an imported photo comes from a fake here.
const remote = vi.hoisted(() => ({ fetchImage: vi.fn() }));
vi.mock("@/server/importer/fetch", async (original) => ({
  ...(await original<typeof FetchModule>()),
  fetchImage: remote.fetchImage,
}));

const schema = await import("@/server/db/schema");
const photos = await import("@/server/actions/photos");
const dishes = await import("@/server/actions/dishes");
const { getDish, listMyDishes } = await import("@/server/features/dishes/queries");
const { getAccountSummary } = await import("@/server/features/account/queries");
const { purgeDeleted, DELETED_TTL_MS } = await import("@/server/features/dishes/cleanup");

beforeAll(() => hibp.listen({ onUnhandledFrame: "error" }));
afterAll(() => hibp.close());
beforeEach(async () => {
  await resetData();
  browser.reset();
  fakeR2.reset();
  remote.fetchImage.mockReset();
  hibp.use(...r2Handlers);
});

const DISH = {
  name: "Harira",
  difficulty: "easy" as const,
  course: "main" as const,
  servings: 4,
  seasons: [],
  dietaryTags: [],
  ingredients: [{ name: "Lentils", amount: 1, unit: "cup" as const, note: null }],
  steps: [],
  caloriesKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

async function signedIn(email = "amina@example.com") {
  browser.reset();
  await signUpAndVerify(email);
  await logIn(email);
  return (await userByEmail(email))!.id;
}

async function addDish() {
  const { data } = await dishes.createDish(DISH);
  return data!.id;
}

/** A phone-style JPEG with GPS in its EXIF. */
const jpeg = () =>
  sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#c85" } })
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "33/1 35/1 0/1" } })
    .jpeg()
    .toBuffer();

function form(fields: Record<string, string | Blob>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const imageKeyOf = async (dishId: string) =>
  (await db().select({ key: schema.dishes.imageKey }).from(schema.dishes).where(eq(schema.dishes.id, dishId)))[0]?.key;

describe("dish photos", () => {
  it("requires a session", async () => {
    const result = await photos.uploadDishPhoto(form({ dishId: crypto.randomUUID(), photo: new Blob([await jpeg()]) }));
    expect(result).toEqual({ serverError: "unauthorized" });
    expect(fakeR2.objects.size).toBe(0);
  });

  it("stores a re-encoded WebP (full + small) under the owner's prefix, without EXIF, and shows it through signed links", async () => {
    const userId = await signedIn();
    const id = await addDish();
    const { data } = await photos.uploadDishPhoto(
      form({ dishId: id, photo: new Blob([await jpeg()], { type: "image/jpeg" }) }),
    );

    const keys = [...fakeR2.objects.keys()].sort();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(new RegExp(`^u/${userId}/[0-9a-f-]{36}-sm\\.webp$`));
    for (const key of keys) {
      const object = fakeR2.objects.get(key)!;
      expect(object.contentType).toBe("image/webp");
      const meta = await sharp(object.body).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
    }
    expect((await sharp(fakeR2.objects.get(keys[1]!)!.body).metadata()).width).toBe(1280);

    // The browser only ever gets short-lived signed URLs.
    expect(data?.photo?.url).toContain("X-Amz-Expires=600");
    const dish = await getDish(id);
    expect(dish?.photo?.url).toContain(`/cooky-test/${keys[1]}`);
    expect(dish?.photosEnabled).toBe(true);
    expect((await listMyDishes({ favorites: false }))?.dishes[0]?.photoUrl).toContain(keys[0]);
  });

  it("replacing a photo removes the old one; removing clears it", async () => {
    await signedIn();
    const id = await addDish();
    await photos.uploadDishPhoto(form({ dishId: id, photo: new Blob([await jpeg()]) }));
    const first = await imageKeyOf(id);
    await photos.uploadDishPhoto(form({ dishId: id, photo: new Blob([await jpeg()]) }));
    const second = await imageKeyOf(id);
    expect(second).not.toBe(first);
    expect([...fakeR2.objects.keys()].every((key) => key.startsWith(second!.replace(/\.webp$/, "")))).toBe(true);

    expect((await photos.removeDishPhoto({ id })).data).toEqual({ photo: null });
    expect(await imageKeyOf(id)).toBeNull();
    expect(fakeR2.objects.size).toBe(0);
    expect((await getDish(id))?.photo).toBeNull();
  });

  it("refuses files that aren't images, whatever they claim to be, and stores nothing", async () => {
    await signedIn();
    const id = await addDish();
    const svg = new Blob(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], {
      type: "image/jpeg",
    });
    expect(await photos.uploadDishPhoto(form({ dishId: id, photo: svg }))).toEqual({ serverError: "invalid" });
    const truncated = new Blob([(await jpeg()).subarray(0, 300)], { type: "image/jpeg" });
    expect(await photos.uploadDishPhoto(form({ dishId: id, photo: truncated }))).toEqual({ serverError: "invalid" });
    const huge = new Blob([new Uint8Array([0xff, 0xd8, 0xff, ...new Uint8Array(5 * 1024 * 1024)])]);
    expect(await photos.uploadDishPhoto(form({ dishId: id, photo: huge }))).toEqual({ serverError: "invalid" });
    expect(await photos.uploadDishPhoto(form({ dishId: "not-a-uuid", photo: new Blob([await jpeg()]) }))).toEqual({
      serverError: "invalid",
    });
    expect(fakeR2.objects.size).toBe(0);
  });

  it("someone else's dish looks missing, and nothing is stored", async () => {
    await signedIn("amina@example.com");
    const theirs = await addDish();
    await signedIn("karim@example.com");
    expect(await photos.uploadDishPhoto(form({ dishId: theirs, photo: new Blob([await jpeg()]) }))).toEqual({
      serverError: "not_found",
    });
    expect(await photos.removeDishPhoto({ id: theirs })).toEqual({ serverError: "not_found" });
    expect(fakeR2.objects.size).toBe(0);
  });

  it("when storage fails, the dish keeps its current photo and the person is told to retry", async () => {
    await signedIn();
    const id = await addDish();
    fakeR2.failPuts = true;
    const result = await photos.uploadDishPhoto(form({ dishId: id, photo: new Blob([await jpeg()]) }));
    expect(result).toEqual({ serverError: "unavailable" });
    expect(await imageKeyOf(id)).toBeNull();
  });

  it("the daily purge removes a deleted dish's photo from storage", async () => {
    await signedIn();
    const id = await addDish();
    await photos.uploadDishPhoto(form({ dishId: id, photo: new Blob([await jpeg()]) }));
    await dishes.deleteDish({ id });
    expect(fakeR2.objects.size).toBe(2); // Still restorable with Undo.
    await purgeDeleted(new Date(Date.now() + DELETED_TTL_MS + 60_000));
    expect(fakeR2.objects.size).toBe(0);
  });
});

describe("imported photos", () => {
  const source = { url: "https://recipes.example.com/harira", siteName: "Example Recipes" };

  it("are copied into storage when the imported dish is saved", async () => {
    await signedIn();
    remote.fetchImage.mockResolvedValue(new Uint8Array(await jpeg()));
    const { data } = await dishes.createDish({
      ...DISH,
      source: { ...source, imageUrl: "https://cdn.example.com/harira.jpg" },
    });
    expect(remote.fetchImage).toHaveBeenCalledWith("https://cdn.example.com/harira.jpg", 5 * 1024 * 1024);
    expect(await imageKeyOf(data!.id)).toMatch(/\.webp$/);
    expect(fakeR2.objects.size).toBe(2);
  });

  it("a photo that can't be fetched never stops the dish from saving", async () => {
    await signedIn();
    remote.fetchImage.mockRejectedValue(new Error("unreachable"));
    const { data } = await dishes.createDish({
      ...DISH,
      source: { ...source, imageUrl: "https://cdn.example.com/gone.jpg" },
    });
    expect(data?.id).toBeDefined();
    expect(await imageKeyOf(data!.id)).toBeNull();
  });
});

describe("profile photo", () => {
  it("is cropped square, shown in the account menu, and removable", async () => {
    await signedIn();
    const { data } = await photos.uploadAvatar(form({ photo: new Blob([await jpeg()]) }));
    expect(data?.photo?.smallUrl).toContain("-sm.webp");
    const full = [...fakeR2.objects.entries()].find(([key]) => !key.endsWith("-sm.webp"))![1];
    const meta = await sharp(full.body).metadata();
    expect([meta.width, meta.height]).toEqual([512, 512]);
    expect((await getAccountSummary())?.avatarUrl).toContain("-sm.webp");

    await photos.removeAvatar({});
    expect(fakeR2.objects.size).toBe(0);
    expect((await getAccountSummary())?.avatarUrl).toBeNull();
  });

  it("requires a session", async () => {
    expect(await photos.uploadAvatar(form({ photo: new Blob([await jpeg()]) }))).toEqual({
      serverError: "unauthorized",
    });
  });
});
