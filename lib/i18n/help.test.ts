import { describe, expect, it } from "vitest";
import { HELP } from "./help";

describe("help content", () => {
  it("has the same sections in every language", () => {
    const ids = (locale: keyof typeof HELP) => HELP[locale].map((s) => s.id);
    expect(ids("en")).toEqual(ids("zh-HK"));
    for (const sections of Object.values(HELP)) {
      for (const s of sections) expect(s.steps.length).toBeGreaterThan(0);
    }
  });
});
