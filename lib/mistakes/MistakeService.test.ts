import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import type { MistakeRecord } from "@/types";
import { MistakeService } from "./MistakeService";

const record = (id: string, studentId: string): MistakeRecord => ({
  id, studentId, language: "en", listId: "l", itemId: id, text: id, count: 1, lastMistakeAt: "2026-10-06T00:00:00.000Z",
});

describe("MistakeService.remove", () => {
  it("deletes one record of the student and nothing else", async () => {
    const repos = createLocalRepositories(new MemoryStore());
    await repos.mistakes.save(record("a1", "a"));
    await repos.mistakes.save(record("a2", "a"));
    await repos.mistakes.save(record("b1", "b"));
    const service = new MistakeService(repos.mistakes);

    await service.remove("a", "a1");
    expect((await service.overview("a")).active.map((r) => r.id)).toEqual(["a2"]);

    // Another student's record can't be deleted through a different studentId.
    await service.remove("a", "b1");
    expect((await service.overview("b")).active.map((r) => r.id)).toEqual(["b1"]);
  });
});
