import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { CloudError, type CloudErrorCode, type CloudStore, type CloudUser, type OutgoingRecord, type RemoteRecord, type SignUpResult } from "../cloud";

const TABLE = "sync_records";
const PAGE = 1000;

interface Row {
  collection: RemoteRecord["collection"];
  id: string;
  data: unknown | null;
  deleted: boolean;
  modified_at: string;
  updated_at: string;
}

const toUser = (user: User | null | undefined): CloudUser | null => (user ? { id: user.id, email: user.email ?? null } : null);

const fromRow = (r: Row): RemoteRecord => ({
  collection: r.collection,
  id: r.id,
  data: r.data,
  deleted: r.deleted,
  modifiedAt: r.modified_at,
  updatedAt: r.updated_at,
});

/** Map Supabase auth / PostgREST errors to codes the UI explains. */
function toCloudError(error: unknown): CloudError {
  const e = error as { code?: string; status?: number; message?: string; name?: string };
  const code = e?.code ?? "";
  const message = e?.message ?? "";
  const map: Record<string, CloudErrorCode> = {
    invalid_credentials: "cloud.invalidCredentials",
    email_not_confirmed: "cloud.emailNotConfirmed",
    user_already_exists: "cloud.emailTaken",
    email_exists: "cloud.emailTaken",
    weak_password: "cloud.weakPassword",
    email_address_invalid: "cloud.invalidEmail",
    validation_failed: "cloud.invalidEmail",
    PGRST205: "cloud.notSetUp", // table not found
    "42P01": "cloud.notSetUp",
    "42501": "cloud.notSetUp", // permission denied (grants missing)
  };
  if (map[code]) return new CloudError(map[code], message);
  if (e?.name === "AuthRetryableFetchError" || e?.status === 0 || /fetch|network/i.test(message)) {
    return new CloudError("cloud.network", message);
  }
  return new CloudError("cloud.unknown", message);
}

/** Supabase implementation: email + password auth, one `sync_records` table protected by RLS. */
export class SupabaseCloudStore implements CloudStore {
  private readonly client: SupabaseClient;

  constructor(url: string, publishableKey: string) {
    this.client = createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "sd:v1:cloud-auth" },
    });
  }

  async getUser(): Promise<CloudUser | null> {
    // getSession reads the stored session (works offline); the token refreshes automatically when online.
    const { data } = await this.client.auth.getSession();
    return toUser(data.session?.user);
  }

  onAuthChange(listener: (user: CloudUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => listener(toUser(session?.user)));
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<CloudUser> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw toCloudError(error);
    return toUser(data.user)!;
  }

  async signUp(email: string, password: string, redirectTo: string): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) throw toCloudError(error);
    // With email confirmation on, an existing address comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) throw new CloudError("cloud.emailTaken");
    return { user: data.session ? toUser(data.user) : null, needsConfirmation: !data.session };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw toCloudError(error);
  }

  async pullSince(userId: string, cursor: string | null): Promise<RemoteRecord[]> {
    const rows: RemoteRecord[] = [];
    let after = cursor;
    for (;;) {
      let query = this.client
        .from(TABLE)
        .select("collection,id,data,deleted,modified_at,updated_at")
        .eq("family_id", userId)
        .order("updated_at", { ascending: true })
        .limit(PAGE);
      if (after) query = query.gt("updated_at", after);
      const { data, error } = await query;
      if (error) throw toCloudError(error);
      const page = (data as Row[]).map(fromRow);
      rows.push(...page);
      if (page.length < PAGE) return rows;
      after = page[page.length - 1].updatedAt;
    }
  }

  async push(userId: string, records: OutgoingRecord[]): Promise<RemoteRecord[]> {
    const stored: RemoteRecord[] = [];
    for (let i = 0; i < records.length; i += PAGE) {
      const chunk = records.slice(i, i + PAGE).map((r) => ({
        family_id: userId,
        collection: r.collection,
        id: r.id,
        data: r.data,
        deleted: r.deleted,
        modified_at: r.modifiedAt,
      }));
      const { data, error } = await this.client
        .from(TABLE)
        .upsert(chunk, { onConflict: "family_id,collection,id" })
        .select("collection,id,data,deleted,modified_at,updated_at");
      if (error) throw toCloudError(error);
      stored.push(...(data as Row[]).map(fromRow));
    }
    return stored;
  }
}
