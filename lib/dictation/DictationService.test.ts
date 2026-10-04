import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { ServiceError } from "@/lib/errors";
import { DICTATION_LIMITS, type DictationListInput } from "@/types";
import { DictationService, formatItems, parseItems } from "./DictationService";

const A = "student-a";
const B = "student-b";

function codeOf(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (err: unknown) => (err instanceof ServiceError ? err.code : String(err)),
  );
}

const words = (title: string, itemsText: string): DictationListInput => ({ type: "words", title, itemsText, paragraphs: [] });
const mixed = (title: string, itemsText: string, paragraphs: string[]): DictationListInput => ({
  type: "mixed",
  title,
  itemsText,
  paragraphs,
});

describe("parseItems", () => {
  it("splits lines, trims, skips blanks and duplicates", () => {
    expect(parseItems("  蓋子 \n\n蛋糕\n蓋子\r\n美麗  ")).toEqual([{ text: "蓋子" }, { text: "蛋糕" }, { text: "美麗" }]);
  });

  it("reads hints after ASCII or full-width bar", () => {
    expect(parseItems("apple | 蘋果\n蓋子｜第三課\nbanana |")).toEqual([
      { text: "apple", hint: "蘋果" },
      { text: "蓋子", hint: "第三課" },
      { text: "banana" },
    ]);
  });

  it("collapses inner whitespace in English phrases", () => {
    expect(parseItems("ice   cream")).toEqual([{ text: "ice cream" }]);
  });

  it("round-trips with formatItems", () => {
    const text = "apple | 蘋果\nbanana";
    const items = parseItems(text).map((i, n) => ({ id: String(n), ...i }));
    expect(formatItems(items)).toBe(text);
  });
});

describe("DictationService", () => {
  let service: DictationService;

  beforeEach(() => {
    service = new DictationService(createLocalRepositories(new MemoryStore()).content);
  });

  it("creates a list scoped to the student and language", async () => {
    const list = await service.create(A, "zh", words(" 第三課 ", "蓋子\n蛋糕"));
    expect(list.studentId).toBe(A);
    expect(list.type).toBe("words");
    expect(list.title).toBe("第三課");
    expect(list.items.map((i) => i.text)).toEqual(["蓋子", "蛋糕"]);
    expect(list.paragraphs).toBeUndefined();
    expect(await service.listForStudent(A, "zh")).toHaveLength(1);
    expect(await service.listForStudent(A, "en")).toHaveLength(0);
  });

  it("creates a mixed list with words and paragraphs (empty paragraphs dropped)", async () => {
    const list = await service.create(A, "zh", mixed("第五課", "春天", [" 春天來了。 ", "", "花開了。"]));
    expect(list.type).toBe("mixed");
    expect(list.items.map((i) => i.text)).toEqual(["春天"]);
    expect(list.paragraphs?.map((p) => p.text)).toEqual(["春天來了。", "花開了。"]);
  });

  it("allows a mixed list without words", async () => {
    const list = await service.create(A, "en", mixed("Unit 2", "", ["Tom has a ball."]));
    expect(list.items).toEqual([]);
  });

  it("isolates students: B cannot see, edit or delete A's list", async () => {
    const list = await service.create(A, "zh", words("A list", "蓋子"));

    expect(await service.listForStudent(B, "zh")).toEqual([]);
    expect(await service.getForStudent(B, list.id)).toBeNull();
    expect(await codeOf(service.update(B, list.id, words("hack", "x")))).toBe("dictation.notFound");
    expect(await codeOf(service.remove(B, list.id))).toBe("dictation.notFound");

    const stillThere = await service.getForStudent(A, list.id);
    expect(stillThere?.title).toBe("A list");
  });

  it("keeps item ids for unchanged words on update", async () => {
    const list = await service.create(A, "en", words("Unit 1", "apple\nbanana"));
    const appleId = list.items[0].id;

    const updated = await service.update(A, list.id, words("Unit 1", "apple | 蘋果\norange"));
    expect(updated.items[0]).toEqual({ id: appleId, text: "apple", hint: "蘋果" });
    expect(updated.items[1].text).toBe("orange");
    expect(updated.items[1].id).not.toBe(list.items[1].id);
    expect(updated.createdAt).toBe(list.createdAt);
  });

  it("locks the type on edit: a mixed list stays mixed and keeps its paragraphs", async () => {
    const list = await service.create(A, "zh", mixed("第五課", "春天", ["春天來了。", "花開了。"]));
    const firstParagraphId = list.paragraphs![0].id;

    // UI sends type "words" by mistake — must be ignored.
    const updated = await service.update(A, list.id, { ...mixed("第五課", "春天\n花園", ["春天來了。", "小鳥唱歌。"]), type: "words" });
    expect(updated.type).toBe("mixed");
    expect(updated.paragraphs?.map((p) => p.text)).toEqual(["春天來了。", "小鳥唱歌。"]);
    expect(updated.paragraphs![0].id).toBe(firstParagraphId);
  });

  it("locks the type on edit: a words list ignores paragraphs and keeps any it had", async () => {
    const list = await service.create(A, "zh", words("詞語", "蓋子"));
    const updated = await service.update(A, list.id, mixed("詞語", "蓋子\n蛋糕", ["不應儲存。"]));
    expect(updated.type).toBe("words");
    expect(updated.paragraphs).toBeUndefined();
    expect(updated.items.map((i) => i.text)).toEqual(["蓋子", "蛋糕"]);
  });

  it("treats lists saved before STEP 5 (no type) as words lists", async () => {
    const repos = createLocalRepositories(new MemoryStore());
    await repos.content.save({
      id: "old",
      studentId: A,
      language: "zh",
      title: "舊範圍",
      items: [{ id: "i1", text: "蓋子" }],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    const updated = await new DictationService(repos.content).update(A, "old", words("舊範圍", "蓋子\n蛋糕"));
    expect(updated.type).toBe("words");
    expect(updated.items[0].id).toBe("i1");
  });

  it("deletes a list", async () => {
    const list = await service.create(A, "zh", words("T", "蓋子"));
    await service.remove(A, list.id);
    expect(await service.listForStudent(A, "zh")).toEqual([]);
  });

  it("validates title, items and paragraphs", async () => {
    expect(await codeOf(service.create(A, "zh", words("  ", "蓋子")))).toBe("dictation.titleRequired");
    expect(await codeOf(service.create(A, "zh", words("x".repeat(DICTATION_LIMITS.titleMaxLength + 1), "a")))).toBe(
      "dictation.titleTooLong",
    );
    expect(await codeOf(service.create(A, "zh", words("T", "\n \n")))).toBe("dictation.itemsRequired");

    const tooMany = Array.from({ length: DICTATION_LIMITS.maxItems + 1 }, (_, i) => `w${i}`).join("\n");
    expect(await codeOf(service.create(A, "en", words("T", tooMany)))).toBe("dictation.tooManyItems");
    expect(await codeOf(service.create(A, "en", words("T", "a".repeat(DICTATION_LIMITS.itemMaxLength + 1))))).toBe(
      "dictation.itemTooLong",
    );

    expect(await codeOf(service.create(A, "zh", mixed("T", "蓋子", ["  "])))).toBe("dictation.paragraphsRequired");
    expect(
      await codeOf(service.create(A, "zh", mixed("T", "", ["字".repeat(DICTATION_LIMITS.paragraphMaxLength + 1)]))),
    ).toBe("dictation.paragraphTooLong");
    const manyParagraphs = Array.from({ length: DICTATION_LIMITS.maxParagraphs + 1 }, (_, i) => `第${i}段。`);
    expect(await codeOf(service.create(A, "zh", mixed("T", "", manyParagraphs)))).toBe("dictation.tooManyParagraphs");

    expect(await service.listForStudent(A, "zh")).toEqual([]);
  });
});
