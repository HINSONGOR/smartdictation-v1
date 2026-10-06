/**
 * Supabase project for cloud sync. These two values are public by design (they ship in every
 * browser); access is protected by login + Row Level Security (supabase/schema.sql).
 * Never put a secret / service_role key here.
 */
export const CLOUD_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://fuxulzawnxzrlibntehn.supabase.co",
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_f96LaJw842ueyel5_nnxWg_6vU4KBF0",
};
