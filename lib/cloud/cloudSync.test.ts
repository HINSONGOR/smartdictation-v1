import { beforeEach, describe, expect, it } from "vitest";
import {
  CloudError,
  type CloudStore,
  type CloudUser,
  type OutgoingRecord,
  type RemoteRecord,
  type Repositories,
  type SignUpResult,
} from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import type { DictationList, StudentProfile } from "@/types";
import { CloudSyncService } from "./CloudSyncService";
import { fingerprint, planSync, recordKey, toLocalRecords } from "./syncEngine";

const T = "2026-10-06T00:00:00.000Z";
const student = (id: string, name: string): StudentProfile => ({ id, name, pin: "1234", createdAt: T, active: true });
const list = (id: string, studentId: string, title: string): DictationList => ({
  id, studentId, type: "words", language: "zh", title, items: [{ id: "i", text: "蓋子" }], createdAt: T, updatedAt: T,
});

/** In-memory stand-in for Supabase: one shared table, per-family rows, server clock. */
class FakeCloud {
  rows = new Map<string, RemoteRecord & { familyId: string }>();
  private clock = 0;
  offline = false;
  accounts = new Map<string, { id: string; password: string }>();

  store(): CloudStore & { signedIn: CloudUser | null } {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const cloud = this;
    const device = {
      signedIn: null as CloudUser | null,
      async getUser() {
        return device.signedIn;
      },
      onAuthChange: () => () => undefined,
      async signIn(email: string, password: string) {
        const account = cloud.accounts.get(email);
        if (!account || account.password !== password) throw new CloudError("cloud.invalidCredentials");
        device.signedIn = { id: account.id, email };
        return device.signedIn;
      },
      async signUp(email: string, password: string): Promise<SignUpResult> {
        if (cloud.accounts.has(email)) throw new CloudError("cloud.emailTaken");
        cloud.accounts.set(email, { id: `user-${cloud.accounts.size + 1}`, password });
        return { user: await device.signIn(email, password), needsConfirmation: false };
      },
      async signOut() {
        device.signedIn = null;
      },
      async pullSince(userId: string, cursor: string | null) {
        if (cloud.offline) throw new CloudError("cloud.network");
        return [...cloud.rows.values()]
          .filter((r) => r.familyId === userId && (!cursor || r.updatedAt > cursor))
          .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      },
      async push(userId: string, records: OutgoingRecord[]) {
        if (cloud.offline) throw new CloudError("cloud.network");
        return records.map((r) => {
          const row = { ...r, familyId: userId, updatedAt: `t${String(++cloud.clock).padStart(6, "0")}` };
          cloud.rows.set(`${userId}/${r.collection}/${r.id}`, row);
          return row;
        });
      },
    };
    return device;
  }
}

function device(cloud: FakeCloud) {
  const repos = createLocalRepositories(new MemoryStore());
  const store = cloud.store();
  const sync = new CloudSyncService(store, repos.backup, repos.owner, repos.syncState, repos.changes);
  return { repos, sync, store };
}

const names = async (repos: Repositories) => (await repos.students.listAll()).map((s) => s.name).sort();

describe("planSync", () => {
  it("detects new, edited and deleted local records against the base", () => {
    const owner = { id: "owner", name: "Owner", pin: "0000", createdAt: T };
    const local = toLocalRecords({ students: [student("a", "Amy"), student("b", "Ben")], lists: [], mistakes: [], sessions: [] }, owner);
    const base = {
      [recordKey("students", "a")]: fingerprint(student("a", "Amy")), // unchanged
      [recordKey("students", "b")]: fingerprint(student("b", "Benny")), // edited
      [recordKey("students", "c")]: "old", // deleted locally
      [recordKey("owner", "owner")]: fingerprint(owner),
    };
    const plan = planSync(local, base, [], T);
    expect(plan.toPush.map((r) => `${r.id}:${r.deleted}`).sort()).toEqual(["b:false", "c:true"]);
  });

  it("applies remote changes unless this device changed the same record", () => {
    const owner = { id: "owner", name: "Owner", pin: "0000", createdAt: T };
    const local = toLocalRecords({ students: [student("a", "Amy (mine)")], lists: [], mistakes: [], sessions: [] }, owner);
    const base = { [recordKey("students", "a")]: fingerprint(student("a", "Amy")), [recordKey("owner", "owner")]: fingerprint(owner) };
    const remote: RemoteRecord[] = [
      { collection: "students", id: "a", data: student("a", "Amy (theirs)"), deleted: false, modifiedAt: T, updatedAt: "t1" },
      { collection: "students", id: "z", data: student("z", "Zoe"), deleted: false, modifiedAt: T, updatedAt: "t2" },
    ];
    const plan = planSync(local, base, remote, T);
    expect((plan.merged.get(recordKey("students", "a"))?.data as StudentProfile).name).toBe("Amy (mine)");
    expect(plan.merged.has(recordKey("students", "z"))).toBe(true);
    expect(plan.appliedFromRemote).toBe(1);
    expect(plan.toPush.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("CloudSyncService (two devices)", () => {
  let cloud: FakeCloud;

  beforeEach(() => {
    cloud = new FakeCloud();
  });

  it("uploads this device's data on first login and downloads it on another device", async () => {
    const ipad = device(cloud);
    await ipad.repos.students.save(student("a", "小明"));
    await ipad.repos.content.save(list("l1", "a", "第三課"));
    await ipad.repos.owner.save({ ...(await ipad.repos.owner.get()), pin: "2468" });
    await ipad.sync.start();
    await ipad.sync.signUp("Mum-Family", "secret123");
    expect(ipad.sync.getStatus()).toMatchObject({ state: "signedIn", error: null });

    const phone = device(cloud);
    await phone.sync.start();
    const result = await phone.sync.signIn("Mum-Family", "secret123");
    expect(result?.downloaded).toBeGreaterThan(0);
    expect(await names(phone.repos)).toEqual(["小明"]);
    expect((await phone.repos.content.listByStudent("a")).map((l) => l.title)).toEqual(["第三課"]);
    expect((await phone.repos.owner.get()).pin).toBe("2468");
  });

  it("merges both devices' data, then keeps edits and deletions in sync", async () => {
    const ipad = device(cloud);
    await ipad.repos.students.save(student("a", "小明"));
    await ipad.sync.start();
    await ipad.sync.signUp("Mum-Family", "pw123456");

    const phone = device(cloud);
    await phone.repos.students.save(student("b", "小美"));
    await phone.sync.start();
    await phone.sync.signIn("Mum-Family", "pw123456");
    await ipad.sync.syncNow();
    expect(await names(ipad.repos)).toEqual(["小明", "小美"]);
    expect(await names(phone.repos)).toEqual(["小明", "小美"]);

    // Edit on the phone, delete on the iPad.
    await phone.repos.content.save(list("l1", "b", "春天"));
    await phone.sync.syncNow();
    await ipad.sync.syncNow();
    expect((await ipad.repos.content.listByStudent("b")).map((l) => l.title)).toEqual(["春天"]);

    await ipad.repos.content.removeForStudent("b", "l1");
    await ipad.sync.syncNow();
    await phone.sync.syncNow();
    expect(await phone.repos.content.listByStudent("b")).toEqual([]);

    // Nothing left to do.
    expect(await phone.sync.syncNow()).toEqual({ downloaded: 0, uploaded: 0 });
  });

  it("keeps working offline and catches up later", async () => {
    const ipad = device(cloud);
    await ipad.sync.start();
    await ipad.sync.signUp("dad_family", "pw123456");

    cloud.offline = true;
    await ipad.repos.students.save(student("a", "小明"));
    expect(await ipad.sync.syncNow()).toBeNull();
    expect(ipad.sync.getStatus()).toMatchObject({ state: "signedIn", error: "cloud.network" });
    expect(await names(ipad.repos)).toEqual(["小明"]); // local data unaffected

    cloud.offline = false;
    expect(await ipad.sync.syncNow()).toMatchObject({ uploaded: 1 });
    expect(ipad.sync.getStatus()).toMatchObject({ error: null });
  });

  it("keeps families apart", async () => {
    const a = device(cloud);
    await a.repos.students.save(student("a", "Family A kid"));
    await a.sync.start();
    await a.sync.signUp("family-a", "pw123456");

    const b = device(cloud);
    await b.sync.start();
    await b.sync.signUp("family-b", "pw123456");
    expect(await names(b.repos)).toEqual([]);
  });

  it("reports wrong passwords and signs out cleanly (local data stays)", async () => {
    const ipad = device(cloud);
    await ipad.repos.students.save(student("a", "小明"));
    await ipad.sync.start();
    await ipad.sync.signUp("Mum-Family", "pw123456");
    await ipad.sync.signOut();
    expect(ipad.sync.getStatus()).toEqual({ state: "signedOut" });
    expect(await names(ipad.repos)).toEqual(["小明"]);
    await expect(ipad.sync.signIn("Mum-Family", "wrong")).rejects.toMatchObject({ code: "cloud.invalidCredentials" });
  });

  it("syncs automatically shortly after a local change", async () => {
    const ipad = device(cloud);
    await ipad.sync.start();
    await ipad.sync.signUp("Mum-Family", "pw123456");
    ipad.sync.requestSync(0);
    await ipad.repos.students.save(student("a", "小明")); // triggers the change feed → debounced sync
    await new Promise((r) => setTimeout(r, 3300));
    expect([...cloud.rows.values()].some((r) => r.collection === "students" && r.id === "a")).toBe(true);
  }, 10_000);
});
