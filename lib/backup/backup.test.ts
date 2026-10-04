import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { ServiceError } from "@/lib/errors";
import { MAX_STUDENTS, type LearningDataSnapshot, type StudentProfile } from "@/types";
import { backupFileName, parseBackup } from "./backupFormat";
import { BackupService } from "./BackupService";
import { mergeSnapshots } from "./mergeSnapshots";

const NOW = "2026-10-04T00:00:00.000Z";
const student = (id: string, name: string): StudentProfile => ({ id, name, pin: "1234", createdAt: NOW, active: true });
const list = (id: string, studentId: string) => ({
  id, studentId, type: "words" as const, language: "zh" as const, title: `T-${id}`, items: [{ id: "i", text: "蓋子" }], createdAt: NOW, updatedAt: NOW,
});
const mistake = (id: string, studentId: string) => ({
  id, studentId, language: "zh" as const, listId: "l", itemId: "i", text: "蓋子", count: 1, lastMistakeAt: NOW,
});
const session = (id: string, studentId: string) => ({
  id, studentId, kind: "list" as const, listId: "l", language: "zh" as const, mode: "paper" as const,
  total: 1, correct: 1, answers: [], startedAt: NOW, finishedAt: NOW,
});

function snapshot(patch: Partial<LearningDataSnapshot> = {}): LearningDataSnapshot {
  return { students: [], lists: [], mistakes: [], sessions: [], ...patch };
}

function codeOf(fn: () => unknown) {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof ServiceError ? err.code : String(err);
  }
}

const fileText = (data: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ app: "SmartDictation", formatVersion: 1, exportedAt: NOW, data, ...extra });

describe("parseBackup", () => {
  it("rejects non-JSON, other apps, newer formats and malformed records", () => {
    expect(codeOf(() => parseBackup("not json"))).toBe("backup.invalidFile");
    expect(codeOf(() => parseBackup(JSON.stringify({ app: "Other", data: {} })))).toBe("backup.wrongApp");
    expect(codeOf(() => parseBackup(fileText(snapshot(), { formatVersion: 99 })))).toBe("backup.newerVersion");
    expect(codeOf(() => parseBackup(fileText({ ...snapshot(), students: [{ id: "a", name: "A", pin: "12" }] })))).toBe(
      "backup.invalidFile",
    );
    expect(codeOf(() => parseBackup(fileText({ students: [] })))).toBe("backup.invalidFile"); // missing collections
  });

  it("rejects more than the student limit", () => {
    const students = Array.from({ length: MAX_STUDENTS + 1 }, (_, i) => student(`s${i}`, `S${i}`));
    expect(codeOf(() => parseBackup(fileText(snapshot({ students }))))).toBe("backup.tooManyStudents");
  });

  it("drops records of students missing from the backup and counts them", () => {
    const parsed = parseBackup(
      fileText(snapshot({ students: [student("a", "Amy")], lists: [list("l1", "a"), list("l2", "ghost")], sessions: [session("x", "ghost")] })),
    );
    expect(parsed.counts).toEqual({ students: 1, lists: 1, mistakes: 0, sessions: 0 });
    expect(parsed.orphansDropped).toBe(2);
  });
});

describe("mergeSnapshots", () => {
  it("keeps existing data, adds new ids, skips known ids", () => {
    const current = snapshot({ students: [student("a", "Amy")], lists: [list("l1", "a")] });
    const incoming = snapshot({
      students: [student("a", "Amy (old copy)"), student("b", "Ben")],
      lists: [{ ...list("l1", "a"), title: "changed elsewhere" }, list("l2", "b")],
      mistakes: [mistake("m1", "b")],
    });
    const { snapshot: merged, added, renamed } = mergeSnapshots(current, incoming);
    expect(merged.students.map((s) => s.name)).toEqual(["Amy", "Ben"]);
    expect(merged.lists.find((l) => l.id === "l1")?.title).toBe("T-l1"); // this device's version wins
    expect(added).toEqual({ students: 1, lists: 1, mistakes: 1, sessions: 0 });
    expect(renamed).toEqual([]);
  });

  it("renames a new student whose name is taken", () => {
    const current = snapshot({ students: [student("a", "小明"), student("b", "小明（2）")] });
    const { snapshot: merged, renamed } = mergeSnapshots(current, snapshot({ students: [student("c", "小明")] }));
    expect(merged.students.map((s) => s.name)).toEqual(["小明", "小明（2）", "小明（3）"]);
    expect(renamed).toEqual([["小明", "小明（3）"]]);
  });

  it("refuses to go over the student limit", () => {
    const current = snapshot({ students: Array.from({ length: MAX_STUDENTS }, (_, i) => student(`s${i}`, `S${i}`)) });
    expect(codeOf(() => mergeSnapshots(current, snapshot({ students: [student("new", "New")] })))).toBe("backup.tooManyStudents");
  });
});

describe("BackupService", () => {
  let repos: Repositories;
  let service: BackupService;

  beforeEach(() => {
    repos = createLocalRepositories(new MemoryStore());
    service = new BackupService(repos.backup, repos.settings);
  });

  async function seed(r: Repositories) {
    await r.students.save(student("a", "Amy"));
    await r.content.save(list("l1", "a"));
    await r.mistakes.save(mistake("m1", "a"));
    await r.practice.save(session("s1", "a"));
  }

  it("exports everything except the owner PIN, and remembers when", async () => {
    await seed(repos);
    await repos.owner.save({ ...(await repos.owner.get()), pin: "9999" });
    const backup = await service.createBackup(new Date(2026, 9, 4, 15, 30));
    expect(backup.fileName).toBe(backupFileName(new Date(2026, 9, 4, 15, 30)));
    expect(backup.fileName).toBe("smartdictation-backup-20261004-1530.json");
    expect(backup.counts).toEqual({ students: 1, lists: 1, mistakes: 1, sessions: 1 });
    expect(backup.json).not.toContain("9999");
    expect(await service.lastBackupAt()).toBe(new Date(2026, 9, 4, 15, 30).toISOString());
  });

  it("round-trips: export on one device, replace on another", async () => {
    await seed(repos);
    const { json } = await service.createBackup();

    const other = createLocalRepositories(new MemoryStore());
    await other.students.save(student("z", "Zoe"));
    await other.owner.save({ ...(await other.owner.get()), pin: "4321" });
    await other.settings.save({ ...(await other.settings.get()), currentStudentId: "z" });
    const otherService = new BackupService(other.backup, other.settings);

    const result = await otherService.importBackup(otherService.readBackup(json), "replace");
    expect(result.counts).toEqual({ students: 1, lists: 1, mistakes: 1, sessions: 1 });
    expect((await other.students.listAll()).map((s) => s.name)).toEqual(["Amy"]);
    expect(await other.content.listByStudent("a")).toHaveLength(1);
    expect((await other.owner.get()).pin).toBe("4321"); // owner PIN untouched
    expect((await other.settings.get()).currentStudentId).toBeNull(); // Zoe no longer exists
  });

  it("merges into existing data and keeps the current student", async () => {
    await seed(repos);
    const { json } = await service.createBackup();

    const other = createLocalRepositories(new MemoryStore());
    await other.students.save(student("z", "Zoe"));
    await other.settings.save({ ...(await other.settings.get()), currentStudentId: "z" });
    const otherService = new BackupService(other.backup, other.settings);

    const result = await otherService.importBackup(otherService.readBackup(json), "merge");
    expect(result.counts).toEqual({ students: 1, lists: 1, mistakes: 1, sessions: 1 });
    expect((await other.students.listAll()).map((s) => s.name)).toEqual(["Zoe", "Amy"]);
    expect((await other.settings.get()).currentStudentId).toBe("z");

    // Importing the same file again adds nothing.
    const again = await otherService.importBackup(otherService.readBackup(json), "merge");
    expect(again.counts).toEqual({ students: 0, lists: 0, mistakes: 0, sessions: 0 });
  });
});
