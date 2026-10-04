/**
 * crypto.randomUUID only exists in secure contexts (https / localhost).
 * Fall back so testing over a LAN IP (e.g. iPad → http://192.168.x.x) still works.
 */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
