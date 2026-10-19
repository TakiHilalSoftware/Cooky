import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { processImage, sniffImage } from "./image";

/** A photo like a phone takes: sideways pixels with an EXIF "rotate 90°" tag, plus GPS and camera details. */
async function phonePhoto(width = 2000, height = 1000) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .withExif({
      IFD0: { Make: "PhoneCo", Model: "Pocket 12" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "33/1 35/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "7/1 37/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
}

describe("sniffImage", () => {
  it("goes by the bytes, not the name or MIME type", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } })
      .png()
      .toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    expect(sniffImage(await phonePhoto(8, 8))).toBe("jpeg");
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(webp)).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic")]))).toBe("heic");
  });
});

describe("processImage", () => {
  it("turns the photo upright, shrinks it to 1280 px, saves WebP and drops EXIF/GPS", async () => {
    const { full, small } = await processImage(await phonePhoto(), "dish");
    const meta = await sharp(full).metadata();
    expect(meta.format).toBe("webp");
    // 2000×1000 tagged "rotate 90°" is really 1000×2000 → fits in 1280 as 640×1280.
    expect([meta.width, meta.height]).toEqual([640, 1280]);
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    const smallMeta = await sharp(small).metadata();
    expect([smallMeta.width, smallMeta.height]).toEqual([480, 360]);
  });

  it("never enlarges a small photo", async () => {
    const tiny = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#abc" } })
      .png()
      .toBuffer();
    const meta = await sharp((await processImage(tiny, "dish")).full).metadata();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("crops profile photos square", async () => {
    const { full, small } = await processImage(await phonePhoto(), "avatar");
    expect((await sharp(full).metadata()).width).toBe(512);
    expect((await sharp(full).metadata()).height).toBe(512);
    expect((await sharp(small).metadata()).width).toBe(96);
  });

  it("refuses bytes that only look like an image", async () => {
    const broken = (await phonePhoto(64, 64)).subarray(0, 200);
    await expect(processImage(broken, "dish")).rejects.toThrow();
  });
});
