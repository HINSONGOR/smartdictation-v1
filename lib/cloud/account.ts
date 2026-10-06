import { CloudError } from "@/lib/data/cloud";

/**
 * Family accounts use an account name + password (no real email).
 * Supabase Auth needs an email, so the account name becomes an internal login address on the
 * app's own domain. No email is ever sent ("Confirm email" is turned off in Supabase).
 */
export const ACCOUNT_DOMAIN = "hinsongor.github.io";

const ACCOUNT_NAME = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

/** "Hinson-Family " → "hinson-family"; throws cloud.invalidUsername when not allowed. */
export function normalizeAccountName(raw: string): string {
  const name = raw.trim().toLowerCase();
  if (!ACCOUNT_NAME.test(name)) throw new CloudError("cloud.invalidUsername");
  return name;
}

export function accountEmail(accountName: string): string {
  return `${normalizeAccountName(accountName)}@${ACCOUNT_DOMAIN}`;
}

/** Show the account name (not the internal address). */
export function accountNameOf(email: string | null): string {
  if (!email) return "";
  return email.endsWith(`@${ACCOUNT_DOMAIN}`) ? email.slice(0, -(ACCOUNT_DOMAIN.length + 1)) : email;
}
