/**
 * URL prefix the app is served under. "" locally; "/smartdictation-v1" on GitHub Pages
 * (a project site lives at https://<user>.github.io/<repo>/). Set at build time via NEXT_PUBLIC_BASE_PATH.
 *
 * Next.js <Link> / router add the prefix automatically. Use withBase() for everything else:
 * fetch() URLs, <img>/next/image src, the service worker, manifest and icon URLs.
 */
export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
