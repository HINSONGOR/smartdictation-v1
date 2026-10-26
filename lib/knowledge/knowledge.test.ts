import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { DictationService, parseItems } from "@/lib/dictation/DictationService";
import { ServiceError } from "@/lib/errors";
import type { KnowledgeInput } from "@/types";
import { KnowledgeService, vocabItemsText, vocabLanguage } from "./KnowledgeService";

const codeOf = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof ServiceError ? e.code : String(e)));

describe("KnowledgeService", () => {
  let repos: Repositories;
  let knowledge: KnowledgeService;
  const note = (patch: Partial<KnowledgeInput> = {}): KnowledgeInput => ({ kind: "note", title: "比喻", body: "把甲比作乙", ...patch });

  beforeEach(() => {
    repos = createLocalRepositories(new MemoryStore());
    knowledge = new KnowledgeService(repos.knowledge);
  });

  it("keeps each student's items separate, pinned first", async () => {
    await knowledge.create("a", note({ title: "舊" }));
    const pinned = await knowledge.create("a", note({ title: "重要" }));
    await knowledge.create("a", note({ title: "新" }));
    await knowledge.setPinned("a", pinned.id, true);
    expect((await knowledge.list("a")).map((i) => i.title)[0]).toBe("重要");
    expect(await knowledge.list("b")).toEqual([]);
    expect(await knowledge.get("b", pinned.id)).toBeNull();
  });

  it("checks what each kind needs and drops fields that don't belong", async () => {
    expect(await codeOf(knowledge.create("a", note({ title: " " })))).toBe("knowledge.titleRequired");
    expect(await codeOf(knowledge.create("a", note({ body: "" })))).toBe("knowledge.bodyRequired");
    expect(await codeOf(knowledge.create("a", { kind: "qa", title: "1+1?", body: "" }))).toBe("knowledge.answerRequired");
    expect(await codeOf(knowledge.create("a", { kind: "example", title: "分數", body: "1/2+1/4", answer: "" }))).toBe(
      "knowledge.answerRequired",
    );
    const vocab = await knowledge.create("a", { kind: "vocab", title: "apple", body: "蘋果", answer: "x", examples: [" I eat an apple. ", ""] });
    expect(vocab).toMatchObject({ examples: ["I eat an apple."] });
    expect(vocab.answer).toBeUndefined();
  });

  it("edits, records self-test results and deletes", async () => {
    const qa = await knowledge.create("a", { kind: "qa", title: "香港回歸年份？", body: "", answer: "1997", topic: "常識第2課" });
    const edited = await knowledge.update("a", qa.id, { kind: "qa", title: "香港回歸係邊年？", body: "", answer: "1997年" });
    expect(edited.topic).toBeUndefined(); // cleared
    await knowledge.recordReview("a", qa.id, true);
    const after = await knowledge.recordReview("a", qa.id, false);
    expect([after.known, after.unknown]).toEqual([1, 1]);
    await knowledge.remove("a", qa.id);
    expect(await knowledge.list("a")).toEqual([]);
  });

  it("turns vocabulary into a dictation word list (via the existing dictation service)", async () => {
    const words = [
      await knowledge.create("a", { kind: "vocab", title: "apple", body: "蘋果\n一種水果", subjectId: "english" }),
      await knowledge.create("a", { kind: "vocab", title: "banana", body: "" }),
    ];
    expect(vocabLanguage(words)).toBe("en");
    expect(vocabLanguage([{ ...words[1], subjectId: undefined, title: "春天" }])).toBe("zh");
    const itemsText = vocabItemsText(words);
    expect(parseItems(itemsText)).toEqual([{ text: "apple", hint: "蘋果" }, { text: "banana" }]);
    const list = await new DictationService(repos.content).create("a", "en", { type: "words", title: "Unit 2 生字", itemsText, paragraphs: [] });
    expect(list.items.map((i) => i.text)).toEqual(["apple", "banana"]);
  });
});
