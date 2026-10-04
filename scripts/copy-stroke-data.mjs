// Copies Hanzi Writer stroke-order data (one JSON per character) into public/stroke-data
// so stroke animations load from this app (local data, works offline once cached).
// Runs automatically before `npm run dev` / `npm run build`. Skips if already up to date.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "hanzi-writer-data");
const target = join(root, "public", "stroke-data");

if (!existsSync(source)) {
  console.warn("[stroke-data] hanzi-writer-data not installed — stroke animations will be unavailable.");
  process.exit(0);
}

const files = readdirSync(source).filter((f) => f.endsWith(".json") && f !== "package.json");
mkdirSync(target, { recursive: true });
const existing = new Set(readdirSync(target));

let copied = 0;
for (const file of files) {
  if (existing.has(file)) continue;
  copyFileSync(join(source, file), join(target, file));
  copied++;
}
// Licence must travel with the data (Arphic Public License).
copyFileSync(join(source, "ARPHICPL.TXT"), join(target, "ARPHICPL.TXT"));

console.log(`[stroke-data] ${files.length} characters available (${copied} newly copied).`);
