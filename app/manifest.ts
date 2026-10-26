import type { MetadataRoute } from "next";
import { withBase } from "@/lib/basePath";

// Generated at build time into the static export.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBase("/"),
    name: "SmartStudy",
    short_name: "SmartStudy",
    description: "SmartStudy — family study app: planner, dictation, notes, photo scan and AI prompts.",
    start_url: withBase("/dashboard"),
    scope: withBase("/"),
    display: "standalone",
    orientation: "any",
    background_color: "#fff8f1",
    theme_color: "#c2410c",
    lang: "zh-HK",
    icons: [
      { src: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
