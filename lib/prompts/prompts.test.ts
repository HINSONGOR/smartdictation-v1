import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { ServiceError } from "@/lib/errors";
import { PROMPT_LIMITS, type PromptInput } from "@/types";
import { blanksOf, fillBlanks } from "./promptText";
import { PromptService } from "./PromptService";
import { SAMPLE_PROMPTS } from "./samples";

const input = (patch: Partial<PromptInput> = {}): PromptInput => ({
  title: "解釋生字", content: "請解釋「{生字}」", purpose: "explain", ai: "any", shared: true, ...patch,
});

describe("prompt blanks", () => {
  it("finds blanks once, in order, and fills only the filled ones", () => {
    expect(blanksOf("{年級}學生，考{科目}，範圍{範圍}，再講{科目}")).toEqual(["年級", "科目", "範圍"]);
    expect(blanksOf("no blanks {}")).toEqual([]);
    expect(fillBlanks("考{科目}，範圍{範圍}", { 科目: " 中文 ", 範圍: "" })).toBe("考中文，範圍{範圍}");
  });

  it("every sample prompt has a title and at least one blank", () => {
    for (const sample of SAMPLE_PROMPTS) expect(blanksOf(sample.content).length).toBeGreaterThan(0);
  });
});

describe("PromptService", () => {
  let repos: Repositories;
  let prompts: PromptService;
  const codeOf = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof ServiceError ? e.code : String(e)));

  beforeEach(() => {
    repos = createLocalRepositories(new MemoryStore());
    prompts = new PromptService(repos.prompts);
  });

  it("shows family prompts to everyone and own prompts only to their student", async () => {
    await prompts.create("a", input({ title: "全家" }));
    const mine = await prompts.create("a", input({ title: "Amy 自己", shared: false }));
    expect((await prompts.list("a")).map((p) => p.title).sort()).toEqual(["Amy 自己", "全家"]);
    expect((await prompts.list("b")).map((p) => p.title)).toEqual(["全家"]);
    expect(await prompts.get("b", mine.id)).toBeNull();
    expect(await codeOf(prompts.remove("b", mine.id))).toBe("prompt.notFound");
  });

  it("keeps versions on edit, with a change note, and can restore one", async () => {
    const p = await prompts.create("a", input({ content: "v1 text" }));
    const v2 = await prompts.update("a", p.id, input({ content: "v2 text", changeNote: "加咗例句" }));
    expect(PromptService.versionOf(v2)).toBe(2);
    expect(v2.versions).toEqual([{ title: "解釋生字", content: "v1 text", savedAt: p.updatedAt, note: "加咗例句" }]);

    const same = await prompts.update("a", p.id, input({ content: "v2 text", ai: "gemini" })); // only settings changed
    expect(same.versions).toHaveLength(1);

    const restored = await prompts.restore("a", p.id, 0);
    expect(restored.content).toBe("v1 text");
    expect(restored.versions.map((v) => v.content)).toEqual(["v1 text", "v2 text"]);
  });

  it("caps the number of kept versions", async () => {
    const p = await prompts.create("a", input({ content: "0" }));
    for (let i = 1; i <= PROMPT_LIMITS.maxVersions + 3; i++) await prompts.update("a", p.id, input({ content: String(i) }));
    const latest = (await prompts.get("a", p.id))!;
    expect(latest.versions).toHaveLength(PROMPT_LIMITS.maxVersions);
    expect(latest.versions.at(-1)?.content).toBe(String(PROMPT_LIMITS.maxVersions + 2));
  });

  it("validates input and removes a student's own prompts with the student", async () => {
    expect(await codeOf(prompts.create("a", input({ title: " " })))).toBe("prompt.titleRequired");
    expect(await codeOf(prompts.create("a", input({ content: "" })))).toBe("prompt.contentRequired");
    await prompts.create("a", input({ shared: false }));
    await prompts.create("a", input());
    expect(await repos.prompts.countForStudent("a")).toBe(1);
    await repos.prompts.removeAllForStudent("a");
    expect(await prompts.list("a")).toHaveLength(1); // the family prompt stays
  });
});
