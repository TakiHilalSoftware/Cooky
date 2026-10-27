import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { COOKY_ICON_PATH, COOKY_ICON_VIEWBOX } from "@/components/brand/brand-icon-path";
import { asAppLocale, directionOf } from "@/i18n/routing";

// The share preview for every page under a locale (PRD §3.6 "rich preview"; ROADMAP Phase 8).
export const alt = "Cooky";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
      <svg width="300" height="300" viewBox={COOKY_ICON_VIEWBOX}>
        <path fill="#1e7656" fillRule="evenodd" d={COOKY_ICON_PATH} />
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
