# SmartDictation — Architecture

Private / family-use dictation PWA. V1: Next.js + TypeScript + Tailwind CSS, Local Data, Web Speech API.

## Layering

```
UI (app/, components/)
  ↓  useApp().services
Service (lib/student, lib/dictation, lib/mistakes, lib/settings, lib/tts)
  ↓  repository interfaces (lib/data/repositories.ts)
Repository implementation (V1: lib/data/local/*)
  ↓
Data source (V1: browser localStorage + bundled seed JSON in lib/data/seed)
```

TTS follows the same idea:

```
UI → TTSService → TTSProvider (V1: WebSpeechTTSProvider) → browser SpeechSynthesis
```

## Rules

1. **UI never touches data directly.** Components / pages call services only.
   Enforced by ESLint (`no-restricted-imports` on `@/lib/data` inside `app/` and `components/`).
2. **Repositories are decoupled from the data source.**
   V1 uses Local Data. V2 can replace it with Google Cloud Firestore, Supabase or any other
   database **without changing UI or the main business logic (services)**:
   - Repository interfaces (`lib/data/repositories.ts`) use only domain types from `types/`
     and are fully async (`Promise`), so a network database can implement them as-is.
   - No storage details (localStorage keys, Firestore refs, SQL rows) leak above `lib/data`.
   - The data source is chosen in exactly one place: `createRepositories()` in `lib/data/index.ts`,
     selected by `APP_CONFIG.dataSource` in `lib/config.ts`.
   - To add a source: implement `Repositories` in e.g. `lib/data/firestore/`, add a case to
     `createRepositories()`, change `APP_CONFIG.dataSource`.
3. **Student isolation.** Every learning record (`DictationList`, `MistakeRecord`, …) carries `studentId`.
   Student-scoped repositories only expose `listByStudent` / `getForStudent` / `removeForStudent`.
   Only Owner Settings can list all student profiles.
4. **PIN is not authentication.** Student / owner PINs are a local profile-switching convenience on a
   shared family device, stored as plain local data in V1.
5. **No hard-coded colours in components.** Colours, radius, shadow, font and background pattern are CSS
   variables per theme in `app/globals.css`, exposed as Tailwind tokens (`bg-surface`, `text-primary`,
   `rounded-card`, `rounded-control`, `shadow-card`, …). Theme presets (basic / cartoon + mascot) are
   registered in `lib/theme`; mascot artwork lives in `public/mascots/*.svg`.
   To add a theme: add its name in `types/settings.ts`, a preset in `lib/theme`, a `[data-theme]` block
   in `globals.css` and i18n names — `lib/theme/themes.test.ts` checks they are complete.
6. **No hard-coded UI text.** All strings go through `t()` (`lib/i18n`). `zh-HK` is the key source of truth;
   `en` must provide every key (type-checked).
7. **TTS engines are pluggable.** Services use `TTSService`; engines implement `TTSProvider`.

## Offline (PWA)

- Static export (`output: "export"`) deployed to GitHub Pages by `.github/workflows/deploy.yml`.
  Every page is static; pages that need an id read it from the query string (`/chinese/practice?list=<id>`).
- The site may live under a sub-path (`NEXT_PUBLIC_BASE_PATH`, e.g. `/smartdictation-v1`). Next `<Link>`
  adds it automatically; everything else uses `withBase()` from `lib/basePath.ts`.
- `public/sw.js` is generated before every dev/build by `scripts/build-sw.mjs` from `scripts/sw.template.js`
  (fresh version, page list from `scripts/pwa-routes.json`). A test checks that list covers every page.
- Pages: network-first with cache fallback; `/_next/static`: cache-first; stroke data: cache-first in a
  cache kept across versions, warmed when a practice opens. New versions wait for the user to tap "更新".

## Version 2 (not implemented in V1)

Cloud database (Firestore / Supabase), OCR, AI, Cloud TTS (Google / Azure / ElevenLabs), Smart Learning.
