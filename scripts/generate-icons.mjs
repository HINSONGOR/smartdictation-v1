// Generates PWA icons into public/icons with no external dependencies.
// Usage: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BRAND = [0xea, 0x58, 0x0c];
const PAPER = [0xff, 0xff, 0xff];
const LINE = [0xfd, 0xba, 0x74];

// ---- signed distance helpers (coordinates normalised to 0..1) ----------
function sdRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r, hy = (y1 - y0) / 2 - r;
  const dx = Math.abs(x - cx) - hx, dy = Math.abs(y - cy) - hy;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

function sdSegment(x, y, ax, ay, bx, by, r) {
  const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay;
  const h = Math.max(0, Math.min(1, (px * vx + py * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - vx * h, py - vy * h) - r;
}

/**
 * @param {number} size     output pixels
 * @param {boolean} rounded transparent rounded corners ("any" icon) vs full-bleed (maskable / apple)
 * @param {number} scale    content scale around centre (maskable safe zone)
 */
function render(size, rounded, scale) {
  const SS = 4; // supersampling
  const rgba = Buffer.alloc(size * size * 4);

  const sample = (nx, ny) => {
    if (rounded && sdRoundRect(nx, ny, 0, 0, 1, 1, 0.22) > 0) return null;
    // map into content space
    const x = 0.5 + (nx - 0.5) / scale;
    const y = 0.5 + (ny - 0.5) / scale;
    let color = BRAND;
    if (sdRoundRect(x, y, 0.26, 0.2, 0.74, 0.8, 0.06) <= 0) color = PAPER;
    const t = 0.018;
    if (
      sdSegment(x, y, 0.34, 0.34, 0.66, 0.34, t) <= 0 ||
      sdSegment(x, y, 0.34, 0.45, 0.66, 0.45, t) <= 0 ||
      sdSegment(x, y, 0.34, 0.56, 0.5, 0.56, t) <= 0
    ) color = LINE;
    const c = 0.04;
    if (sdSegment(x, y, 0.5, 0.63, 0.57, 0.7, c) <= 0 || sdSegment(x, y, 0.57, 0.7, 0.68, 0.56, c) <= 0) color = BRAND;
    return color;
  };

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng(size, size, rgba);
}

// ---- minimal PNG encoder ---------------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
const outputs = {
  "icon-192.png": render(192, true, 1),
  "icon-512.png": render(512, true, 1),
  "icon-maskable-512.png": render(512, false, 0.8),
  "apple-touch-icon.png": render(180, false, 0.9),
};
for (const [name, png] of Object.entries(outputs)) {
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`wrote public/icons/${name} (${png.length} bytes)`);
}
