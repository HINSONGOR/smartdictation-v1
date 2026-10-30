import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { DictationService, parseItems } from "@/lib/dictation/DictationService";
import { ServiceError } from "@/lib/errors";
import type { KnowledgeInput } from "@/types";
import { subjectsOf } from "@/lib/planner/plannerRules";
import { parseQaResult } from "@/lib/scan/qaScan";
import { KnowledgeService, vocabItemsText, vocabLanguage } from "./KnowledgeService";
import { KNOWLEDGE_PACKS } from "./packs";
import { FILL_IN_WORDS } from "./packsChinese";
import { DISPLACEMENT_PACK } from "./packsDisplacement";

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

describe("scanned Q&A worksheet", () => {
  const subjects = subjectsOf(null);
  const names = (s: (typeof subjects)[number]) => ({ chinese: ["中文"], english: ["英文"], math: ["數學"], gs: ["常識"] })[s.id as "gs"] ?? [];

  it("reads questions and answers, strips numbering, maps 人文科 to General Studies", () => {
    const answer =
      '```json\n{"subject":"人文科","topic":"第四課 中國近年的發展","items":[' +
      '{"question":"1. 中國近年的科技發展有甚麼成果？","answer":"中國近年致力發展創新科技，這不但改善人民的生活，促進經濟發展，而且對推動人類社會進步作出貢獻。"},' +
      '{"question":"2. 中國和國際間保持緊密的合作關係，對中國有甚麼影響？","answer":"除了有助提升國際地位，也對中國整體長遠發展有着深遠的影響。"},' +
      '{"question":"","answer":"x"}]}\n```';
    const result = parseQaResult(answer, subjects, names)!;
    expect(result.subjectId).toBe("gs");
    expect(result.topic).toBe("第四課 中國近年的發展");
    expect(result.items.map((i) => i.question)).toEqual(["中國近年的科技發展有甚麼成果？", "中國和國際間保持緊密的合作關係，對中國有甚麼影響？"]);
    expect(result.items[0].answer).toContain("致力發展創新科技");
    expect(parseQaResult("not json", subjects, names)).toBeNull();
  });

  it("adds all checked pairs as Q&A cards at once", async () => {
    const repos = createLocalRepositories(new MemoryStore());
    const knowledge = new KnowledgeService(repos.knowledge);
    expect(await codeOf(knowledge.createMany("a", [{ kind: "qa", title: "Q1", body: "", answer: "A1" }, { kind: "qa", title: "Q2", body: "", answer: "" }]))).toBe(
      "knowledge.answerRequired",
    );
    expect(await knowledge.list("a")).toEqual([]); // nothing saved
    const added = await knowledge.createMany("a", [{ kind: "qa", title: "Q1", body: "", answer: "A1", topic: "第四課", subjectId: "gs" }]);
    expect(added[0]).toMatchObject({ kind: "qa", title: "Q1", answer: "A1", topic: "第四課", subjectId: "gs" });
  });
});

describe("knowledge packs", () => {
  it("are all valid, and adding twice doesn't duplicate", async () => {
    const repos = createLocalRepositories(new MemoryStore());
    const knowledge = new KnowledgeService(repos.knowledge);
    for (const pack of KNOWLEDGE_PACKS) {
      expect(await knowledge.addPack("a", pack.items)).toBe(pack.items.length);
      expect(await knowledge.addPack("a", pack.items)).toBe(0);
    }
    const items = await knowledge.list("a");
    const math = items.filter((i) => i.subjectId === "math");
    expect(math.filter((i) => i.kind === "note")).toHaveLength(11); // 9 shapes + tips + displacement
    expect(math.filter((i) => i.kind === "example")).toHaveLength(13); // 9 shapes + 4 displacement
    const english = items.filter((i) => i.subjectId === "english");
    expect(english.filter((i) => i.kind === "note")).toHaveLength(12); // 11 tenses + traps
    expect(english.filter((i) => i.kind === "qa")).toHaveLength(18);
    const chinese = items.filter((i) => i.subjectId === "chinese");
    expect(chinese.filter((i) => i.kind === "vocab").map((i) => i.title)).toHaveLength(7);
    expect(chinese.filter((i) => i.kind === "qa")).toHaveLength(7);
    expect(math.length + english.length + chinese.length).toBe(items.length);
  });

  it("fill-in words make a dictation list whose hints never give the word away", () => {
    const words = FILL_IN_WORDS.filter((i) => i.kind === "vocab");
    expect(words.map((w) => w.title)).toEqual(["飛濺", "橫生", "烽火", "依舊", "時勢", "驚惶", "渾身解數"]);
    expect(vocabLanguage(words)).toBe("zh");
    const lines = vocabItemsText(words).split("\n");
    expect(lines).toHaveLength(7);
    for (const line of lines) {
      const [word, hint] = line.split(" | ");
      expect(hint).toBeTruthy();
      expect(hint).not.toContain(word);
    }
  });

  it("worked examples add up (π = 3.14)", () => {
    const answers = KNOWLEDGE_PACKS[0].items.filter((i) => i.kind === "example").map((i) => i.answer).join("\n");
    expect(3.14 * 5 * 5).toBeCloseTo(78.5);
    expect(answers).toContain("78.5 cm²");
    expect(2 * 3.14 * 2 * 5).toBeCloseTo(62.8);
    expect(62.8 + 12.56 * 2).toBeCloseTo(87.92);
    expect(answers).toContain("87.92 cm²");
    expect((5 * 4 + 5 * 3 + 4 * 3) * 2).toBe(94);
  });

  it("displacement examples add up", () => {
    const answers = DISPLACEMENT_PACK.filter((i) => i.kind === "example").map((i) => i.answer).join("\n");
    expect(8 + (240 * 2) / (20 * 20)).toBeCloseTo(9.2);
    expect(answers).toContain("9.2 cm");
    expect(8 + 240 / 400).toBeCloseTo(8.6);
    expect(10 + 600 / (20 * 15)).toBe(12);
    expect((20 * 20 * 6) / (400 - 10 * 10)).toBe(8);
    expect(6 + 1500 / 400).toBeCloseTo(9.75);
    expect(18 + 1000 / 400).toBeCloseTo(20.5);
    expect(20 * 20 * 18 + 1000 - 20 * 20 * 20).toBe(200);
    expect(answers).toContain("200 cm³");
  });
});
