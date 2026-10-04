// Generates public/sw.js from scripts/sw.template.js with a fresh version and the precache lists.
// Runs before `npm run dev` / `npm run build`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routes = JSON.parse(readFileSync(join(root, "scripts", "pwa-routes.json"), "utf8"));
const listDir = (dir) =>
  readdirSync(join(root, "public", dir))
    .filter((f) => !f.startsWith("."))
    .map((f) => `/${dir}/${f}`);

// Same prefix as next.config.ts basePath ("" locally, "/<repo>" on GitHub Pages).
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const staticFiles = ["/manifest.webmanifest", ...listDir("icons"), ...listDir("mascots")];
const version = Date.now().toString(36);
const prefixed = (paths) => paths.map((p) => base + p);

const source = readFileSync(join(root, "scripts", "sw.template.js"), "utf8")
  .replace("__VERSION__", version)
  .replace("__BASE__", JSON.stringify(base))
  .replace("__ROUTES__", JSON.stringify(prefixed(routes)))
  .replace("__STATIC_FILES__", JSON.stringify(prefixed(staticFiles)));

writeFileSync(join(root, "public", "sw.js"), source);
console.log(
  `[sw] public/sw.js version ${version}${base ? ` (base ${base})` : ""} — ${routes.length} pages, ${staticFiles.length} static files`,
);
