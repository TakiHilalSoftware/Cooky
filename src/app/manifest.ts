import type { MetadataRoute } from "next";

/**
 * The installable app (PWA). The share target lets people send a recipe page
 * from their browser or another app straight to "Import from a link"
 * (PRD §3.2): the link arrives on the new-dish page, ready to import.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cooky",
    short_name: "Cooky",
    description: "Plan, cook, and shop without the guesswork.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f3",
    theme_color: "#e8a317",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      // PNGs for installers that need them (Android, older browsers); see scripts/generate-icons.ts.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/en/dishes/new",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
