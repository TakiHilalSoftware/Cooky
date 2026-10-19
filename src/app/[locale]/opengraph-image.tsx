import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { asAppLocale, directionOf } from "@/i18n/routing";

// The share preview for every page under a locale (PRD §3.6 "rich preview"; ROADMAP Phase 8).
export const alt = "Cooky";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STAR =
  "M12 0.5L15.37 3.87L20.13 3.87L20.13 8.63L23.5 12L20.13 15.37L20.13 20.13L15.37 20.13L12 23.5L8.63 20.13L3.87 20.13L3.87 15.37L0.5 12L3.87 8.63L3.87 3.87L8.63 3.87Z";
const INNER =
  "M12 7.6L13.29 8.89L15.11 8.89L15.11 10.71L16.4 12L15.11 13.29L15.11 15.11L13.29 15.11L12 16.4L10.71 15.11L8.89 15.11L8.89 13.29L7.6 12L8.89 10.71L8.89 8.89L10.71 8.89Z";

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asAppLocale((await params).locale);
  const [t, font] = await Promise.all([
    getTranslations({ locale, namespace: "og" }),
    readFile(join(process.cwd(), "assets/fonts/ReadexPro.ttf")),
  ]);
  const rtl = directionOf(locale) === "rtl";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: rtl ? "row-reverse" : "row",
        alignItems: "center",
        gap: 64,
        padding: "72px 88px",
        background: "#f7f8f3",
        color: "#1f2a24",
        fontFamily: "Readex Pro",
      }}
    >
      <svg width="300" height="300" viewBox="0 0 24 24">
        <path fill="#e8a317" d={STAR} />
        <path fill="#1e7656" d={INNER} />
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: rtl ? "flex-end" : "flex-start",
          textAlign: rtl ? "right" : "left",
          gap: 20,
          flex: 1,
        }}
      >
        <div style={{ fontSize: 112, lineHeight: 1, color: "#1e7656" }}>Cooky</div>
        <Words text={t("headline")} rtl={rtl} style={{ fontSize: 52, lineHeight: 1.25 }} />
        <Words text={t("line")} rtl={rtl} style={{ fontSize: 30, lineHeight: 1.4, color: "#56645c" }} />
      </div>
    </div>,
    { ...size, fonts: [{ name: "Readex Pro", data: font, style: "normal", weight: 600 }] },
  );
}

/**
 * The image renderer lays text out left to right only. Each word is its own
 * box here, so right-to-left text keeps its word order and wraps from the right.
 */
function Words({ text, rtl, style }: { text: string; rtl: boolean; style: Record<string, string | number> }) {
  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexWrap: "wrap",
        flexDirection: rtl ? "row-reverse" : "row",
        columnGap: "0.28em",
      }}
    >
      {text.split(/\s+/).map((word, i) => (
        <span key={i}>{word}</span>
      ))}
    </div>
  );
}
