import { describe, expect, it } from "vitest";
import { planRevision } from "@/lib/planner/revisionPlan";
import { subjectsOf } from "@/lib/planner/plannerRules";
import { notesFor, parseScanResult } from "./scanItems";

const subjects = subjectsOf({ id: "planner", categories: [], subjects: [{ id: "s-phy", name: "物理", color: "teal" }], updatedAt: "" });
const NAMES: Record<string, string[]> = { chinese: ["中文", "Chinese"], english: ["英文", "English"], math: ["數學", "Maths"], gs: ["常識"] };
const names = (s: (typeof subjects)[number]) => (s.builtIn ? NAMES[s.id] : [s.name ?? ""]);

describe("parseScanResult", () => {
  it("maps kinds, subjects, scope and times; sorts by date", () => {
    const answer = '```json\n{"items":[' +
      '{"title":"英文默書","date":"2026-11-05","time":null,"kind":"dictation","subject":"English","scope":["Unit 3"],"notes":null},' +
      '{"title":"中文測驗","date":"2026-11-03","time":"08:30","kind":"exam","subject":"chinese","scope":["第3課","第4課"],"notes":"帶字典"},' +
      '{"title":"物理小測","date":"2026-11-04","kind":"exam","subject":"物理"},' +
      '{"title":"音樂表演","date":"2026-11-06","kind":"concert","subject":"音樂"}]}\n```';
    const items = parseScanResult(answer, "2026-10-26", subjects, names)!;
    expect(items.map((i) => [i.title, i.date, i.categoryId, i.subjectId ?? null])).toEqual([
      ["中文測驗", "2026-11-03", "exam", "chinese"],
      ["物理小測", "2026-11-04", "exam", "s-phy"],
      ["英文默書", "2026-11-05", "dictation", "english"],
      ["音樂表演", "2026-11-06", "other", null],
    ]);
    expect(items[0]).toMatchObject({ time: "08:30", scope: ["第3課", "第4課"], notes: "帶字典", include: true, dateMissing: false });
    expect(items[3].notes).toBe("音樂"); // unknown subject kept as a note
  });

  it("flags missing or invalid dates and skips items without a title", () => {
    const items = parseScanResult('{"items":[{"title":"交回條","date":"11月7日"},{"title":"","date":"2026-11-01"}]}', "2026-10-26", subjects, names)!;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ date: "2026-10-26", dateMissing: true, categoryId: "other" });
  });

  it("returns null for unreadable answers and [] for nothing found", () => {
    expect(parseScanResult("Sorry, I can't read this.", "2026-10-26", subjects, names)).toBeNull();
    expect(parseScanResult('{"items":[]}', "2026-10-26", subjects, names)).toEqual([]);
  });

  it("builds task notes from scope and notes", () => {
    expect(notesFor({ scope: ["第3課", "第4課"], notes: "帶字典" }, (p) => `範圍：${p}`)).toBe("範圍：第3課、第4課\n帶字典");
    expect(notesFor({ scope: [] }, (p) => p)).toBeUndefined();
  });
});

describe("planRevision", () => {
  it("shares the scope over the days before the exam", () => {
    expect(planRevision("2026-11-06", ["第3課", "第4課", "詞語表"], "2026-10-26", 5)).toEqual([
      { date: "2026-11-01", topics: ["第3課"] },
      { date: "2026-11-02", topics: ["第4課"] },
      { date: "2026-11-03", topics: ["詞語表"] },
      { date: "2026-11-04", topics: [] }, // revise everything
      { date: "2026-11-05", topics: [] },
    ]);
  });

  it("doubles up when there are more parts than days, and never plans in the past", () => {
    const plan = planRevision("2026-10-29", ["A", "B", "C", "D", "E"], "2026-10-27", 7);
    expect(plan).toEqual([
      { date: "2026-10-27", topics: ["A", "B", "C"] },
      { date: "2026-10-28", topics: ["D", "E"] },
    ]);
    expect(planRevision("2026-10-27", ["A"], "2026-10-27", 5)).toEqual([]); // exam is today
  });
});
