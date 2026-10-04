import type { NextConfig } from "next";
import pkg from "./package.json";

/** "" locally; "/<repo>" for a GitHub Pages project site (set by the deploy workflow). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Fully static site (GitHub Pages). All pages are prerendered; the service worker makes them work offline.
  output: "export",
  basePath,
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version, NEXT_PUBLIC_BASE_PATH: basePath },
  // Static hosting has no image optimisation server; mascots / icons are small SVG / PNG anyway.
  images: { unoptimized: true },
};

export default nextConfig;
