import { describe, expect, it, vi } from "vitest";

// Storage signs any key it's given; a null key (no upload) has no link.
vi.mock("@/server/storage/photos", () => ({
  smallPhotoUrl: async (key: string | null) => (key ? `signed:${key}-sm` : null),
  photoUrls: async (key: string | null) => (key ? { url: `signed:${key}`, smallUrl: `signed:${key}-sm` } : null),
}));

const { dishPhoto, dishSmallPhotoUrl } = await import("./photo");

const CATALOG = "/images/dishes/shakshuka.jpg";

describe("dishSmallPhotoUrl", () => {
  it("prefers the person's own photo over the Discover one", async () => {
    expect(await dishSmallPhotoUrl({ imageKey: "u/1/a.webp", catalogPhotoUrl: CATALOG })).toBe("signed:u/1/a.webp-sm");
  });

  it("falls back to the photo of the Discover dish it was saved from", async () => {
    expect(await dishSmallPhotoUrl({ imageKey: null, catalogPhotoUrl: CATALOG })).toBe(CATALOG);
  });

  it("is null for a dish with neither (the cover shows instead)", async () => {
    expect(await dishSmallPhotoUrl({ imageKey: null, catalogPhotoUrl: null })).toBeNull();
  });
});

describe("dishPhoto", () => {
  it("uses the catalog photo for both sizes when there's no upload", async () => {
    expect(await dishPhoto({ imageKey: null, catalogPhotoUrl: CATALOG })).toEqual({ url: CATALOG, smallUrl: CATALOG });
  });

  it("keeps the uploaded photo's two sizes", async () => {
    expect(await dishPhoto({ imageKey: "k.webp", catalogPhotoUrl: CATALOG })).toEqual({
      url: "signed:k.webp",
      smallUrl: "signed:k.webp-sm",
    });
  });

  it("is null for a dish with neither", async () => {
    expect(await dishPhoto({ imageKey: null, catalogPhotoUrl: null })).toBeNull();
  });
});
