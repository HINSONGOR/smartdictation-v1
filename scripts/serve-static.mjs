// Serves the static export in out/ the way GitHub Pages does, for local testing:
//  - under an optional base path (NEXT_PUBLIC_BASE_PATH, e.g. /smartdictation-v1)
//  - "/foo" → foo.html, "/dir/" → dir/index.html, unknown → 404.html (status 404)
// Usage: node scripts/serve-static.mjs [port] [basePath]   e.g. node scripts/serve-static.mjs 3200 /smartdictation-v1
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "out");
const port = Number(process.argv[2] ?? 3200);
const base = (process.argv[3] ?? process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const candidates = [join(root, rel), join(root, `${rel}.html`), join(root, rel, "index.html")];
  return candidates.find((file) => file.startsWith(root) && existsSync(file) && statSync(file).isFile());
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (base && url.pathname === base) {
    res.writeHead(301, { Location: `${base}/` }).end();
    return;
  }
  if (base && !url.pathname.startsWith(`${base}/`)) {
    res.writeHead(404).end("Not under base path");
    return;
  }
  const file = resolveFile(url.pathname.slice(base.length) || "/");
  const target = file ?? join(root, "404.html");
  res.writeHead(file ? 200 : 404, {
    "Content-Type": TYPES[extname(target)] ?? "application/octet-stream",
    // GitHub Pages sends a 10-minute cache; mimic it (the service worker is fetched bypassing it).
    "Cache-Control": "max-age=600",
  });
  createReadStream(target).pipe(res);
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}${base}/`));
