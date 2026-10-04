# SmartDictation 智能默書 · V1.0.0

A private / family dictation PWA for Chinese (Cantonese / Mandarin) and English school dictation.
Works on iPhone, iPad and desktop, fully offline, with all data stored on the device.

> 使用說明 for parents is inside the app: **設定 → 使用說明** (`/help`).

## Features (V1)

- Up to 8 student profiles + owner (parent) settings — local profile switching with PINs (not secure auth)
- Word lists: **生字／詞語** or **課文（混合）** (words + paragraphs); paste a whole passage → auto split
  into paragraphs and sentences (at 。！？，；), reviewed before saving; list type locked after creation
- Dictation: paper (reveal + self-mark, whole paragraph after its last sentence) or typing (auto check,
  textbook-strict: case and punctuation); punctuation read aloud; Cantonese / Mandarin; repeat / slower;
  stroke-order animation (Hanzi Writer)
- Mistake review with mastery (2 correct in a row), learning progress page with a 14-day chart
- 11 themes (6 colour + 5 cartoon with original mascots), zh-HK / English UI
- Offline PWA (service worker), backup export / import (merge or replace)

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000 (service worker disabled in dev)
npm run build      # production build (also copies stroke data and generates public/sw.js)
npm start          # serve out/ like GitHub Pages (node scripts/serve-static.mjs [port] [basePath])
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test           # Vitest: services, rules, theme contrast (WCAG), PWA route coverage
```

Requires Node 20+ (developed on Node 24). `predev` / `prebuild` copy `hanzi-writer-data` into
`public/stroke-data/` (~31 MB, git-ignored, Arphic Public License included) and generate `public/sw.js`.

## Deploy (GitHub Pages)

Live: **https://hinsongor.github.io/smartdictation-v1/**

Every push to `main` runs `.github/workflows/deploy.yml`: lint, typecheck, tests, then a static export
(`out/`) built with `NEXT_PUBLIC_BASE_PATH=/<repo>` and published to Pages.

## Project layout

```
app/          Next.js App Router pages (all static — no dynamic segments, for offline use)
components/   UI by feature: dictation/, mistakes/, stats/, student/, backup/, stroke/, theme/, ui/ …
lib/          Services + business rules (dictation/, mistakes/, stats/, backup/, student/, tts/, stroke/)
lib/data/     Repository interfaces + Local implementation (localStorage + seed JSON)
lib/i18n/     zh-HK / en messages, help content
types/        Domain types
scripts/      Build helpers (stroke data, service worker template, precache route list)
```

Architecture rules (UI → Service → Repository → Data, swappable data source for V2) are in
[ARCHITECTURE.md](ARCHITECTURE.md).

## V1 known limitations

**Data & security**
- All data is stored only in this browser on this device (no sync). Clearing site data loses it —
  export backups regularly (the home screen reminds after 14 days).
- PINs (student and owner) are stored in plain text locally; they are a convenience lock, not security.
  The backup file contains student PINs and is not encrypted.
- Forgotten owner PIN: clear site data (PIN returns to 0000) and restore learning data from a backup.
- Merging backups keeps this device's version of a record that exists on both devices (no field-level merge).

**Speech**
- Web Speech voices depend on the device. Some desktops have no Cantonese (zh-HK) or Mandarin voice and
  fall back to the browser default; offline speech needs on-device voices (normally present on iPhone / iPad).

**Dictation rules**
- Answer checking is character-exact: no Traditional ↔ Simplified conversion; English is case-sensitive.
- Automatic sentence split is rule-based: “Mr. Chan” is split; a line break can be used to split by hand.
- Mastery threshold (2) and the mistake list per list item are fixed; the same word in two lists counts twice.
- Leaving a practice midway does not save progress.

**Offline / PWA**
- Stroke data for a character is available offline only after a practice containing it was opened online.
- Offline in-app navigation reloads the page (≈1 s) because client-side navigation data isn't cached.
- `navigator.onLine` may stay true on Wi-Fi without internet, so the offline banner may not appear
  (the app still works from cache).

**Other**
- Progress chart covers the last 14 days only; streaks use the device's local time zone.
- The mobile bottom bar has no Progress tab (reached from the home screen card).

## Version 2 (planned, not in V1)

Cloud database (Firestore / Supabase) with sync, OCR word-list capture, AI assistance, Cloud TTS voices,
Smart Learning. The repository layer is designed so V2 can swap the data source without changing UI or services.
