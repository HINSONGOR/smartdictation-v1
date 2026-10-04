import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { ServiceError } from "@/lib/errors";
import { DEFAULT_OWNER_PIN, MAX_STUDENTS, STUDENT_NAME_MAX_LENGTH } from "@/types";
import seedOwner from "@/lib/data/seed/owner.json";
import { StudentService } from "./StudentService";

function codeOf(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (err: unknown) => (err instanceof ServiceError ? err.code : String(err)),
  );
}

const NOW = "2026-10-01T00:00:00.000Z";

describe("StudentService", () => {
  let repos: Repositories;
  let service: StudentService;

  beforeEach(() => {
    repos = createLocalRepositories(new MemoryStore());
    service = new StudentService(repos.students, repos.owner, repos.settings, {
      lists: repos.content,
      mistakes: repos.mistakes,
      sessions: repos.practice,
    });
  });

  /** Give a student one list, one mistake and one practice session. */
  async function addLearningData(studentId: string) {
    await repos.content.save({ id: `l-${studentId}`, studentId, language: "zh", title: "T", items: [], createdAt: NOW, updatedAt: NOW });
    await repos.mistakes.save({
      id: `m-${studentId}`, studentId, language: "zh", listId: "l", itemId: "i", text: "蓋子", count: 1, lastMistakeAt: NOW,
    });
    await repos.practice.save({
      id: `s-${studentId}`, studentId, kind: "list", listId: "l", language: "zh", mode: "paper",
      total: 1, correct: 1, answers: [], startedAt: NOW, finishedAt: NOW,
    });
  }

  describe("create", () => {
    it("validates name, PIN, duplicates and the limit", async () => {
      expect(await codeOf(service.create({ name: " ", pin: "1234" }))).toBe("student.nameRequired");
      expect(await codeOf(service.create({ name: "x".repeat(STUDENT_NAME_MAX_LENGTH + 1), pin: "1234" }))).toBe(
        "student.nameTooLong",
      );
      expect(await codeOf(service.create({ name: "小明", pin: "12a4" }))).toBe("student.pinInvalid");

      await service.create({ name: "Tom", pin: "1111" });
      expect(await codeOf(service.create({ name: " tom ", pin: "2222" }))).toBe("student.nameTaken");

      for (let i = 1; i < MAX_STUDENTS; i++) await service.create({ name: `S${i}`, pin: "1234" });
      expect(await codeOf(service.create({ name: "One more", pin: "1234" }))).toBe("student.limitReached");
    });

    it("never exposes the PIN", async () => {
      const s = await service.create({ name: "小明", pin: "1111" });
      expect(s).not.toHaveProperty("pin");
      expect((await service.listAllForOwner())[0]).not.toHaveProperty("pin");
    });
  });

  describe("update", () => {
    it("renames and keeps the PIN when none is given", async () => {
      const s = await service.create({ name: "小明", pin: "1111" });
      await service.update(s.id, { name: "陳小明", pin: "" });
      expect((await service.listAllForOwner())[0].name).toBe("陳小明");
      expect(await codeOf(service.switchTo(s.id, "1111"))).toBeNull();
    });

    it("changes the PIN", async () => {
      const s = await service.create({ name: "小明", pin: "1111" });
      await service.update(s.id, { name: "小明", pin: "9876" });
      expect(await codeOf(service.switchTo(s.id, "1111"))).toBe("student.wrongPin");
      expect(await codeOf(service.switchTo(s.id, "9876"))).toBeNull();
    });

    it("rejects a name used by another student, but allows keeping its own name", async () => {
      const a = await service.create({ name: "Amy", pin: "1111" });
      await service.create({ name: "Ben", pin: "2222" });
      expect(await codeOf(service.update(a.id, { name: "BEN" }))).toBe("student.nameTaken");
      expect(await codeOf(service.update(a.id, { name: "amy" }))).toBeNull();
      expect(await codeOf(service.update(a.id, { name: "Amy", pin: "12" }))).toBe("student.pinInvalid");
      expect(await codeOf(service.update("missing", { name: "X" }))).toBe("student.notFound");
    });
  });

  describe("owner PIN", () => {
    it("starts as the default and can be changed with the current PIN", async () => {
      expect(seedOwner.pin).toBe(DEFAULT_OWNER_PIN);
      expect(await service.isOwnerPinDefault()).toBe(true);

      expect(await codeOf(service.changeOwnerPin("1111", "2468"))).toBe("owner.wrongPin");
      expect(await codeOf(service.changeOwnerPin(DEFAULT_OWNER_PIN, "24a8"))).toBe("owner.pinInvalid");
      await service.changeOwnerPin(DEFAULT_OWNER_PIN, "2468");

      expect(await service.isOwnerPinDefault()).toBe(false);
      expect(await codeOf(service.verifyOwnerPin(DEFAULT_OWNER_PIN))).toBe("owner.wrongPin");
      expect(await codeOf(service.verifyOwnerPin("2468"))).toBeNull();
    });
  });

  describe("remove", () => {
    it("deletes the student and all of their data, leaving other students untouched", async () => {
      const a = await service.create({ name: "Amy", pin: "1111" });
      const b = await service.create({ name: "Ben", pin: "2222" });
      await addLearningData(a.id);
      await addLearningData(b.id);

      expect(await service.dataSummary(a.id)).toEqual({ lists: 1, mistakes: 1, sessions: 1 });
      await service.remove(a.id);

      expect((await service.listAllForOwner()).map((s) => s.name)).toEqual(["Ben"]);
      expect(await service.dataSummary(a.id)).toEqual({ lists: 0, mistakes: 0, sessions: 0 });
      expect(await service.dataSummary(b.id)).toEqual({ lists: 1, mistakes: 1, sessions: 1 });
    });

    it("signs out the deleted student if they were current", async () => {
      const a = await service.create({ name: "Amy", pin: "1111" });
      await service.switchTo(a.id, "1111");
      await service.remove(a.id);
      expect(await service.getCurrent()).toBeNull();
      expect((await repos.settings.get()).currentStudentId).toBeNull();
    });

    it("frees a slot and the name", async () => {
      const ids = [];
      for (let i = 0; i < MAX_STUDENTS; i++) ids.push((await service.create({ name: `S${i}`, pin: "1234" })).id);
      await service.remove(ids[0]);
      expect(await codeOf(service.create({ name: "S0", pin: "1234" }))).toBeNull();
    });

    it("reports a missing student", async () => {
      expect(await codeOf(service.remove("missing"))).toBe("student.notFound");
    });
  });
});
