import { describe, expect, it } from "vitest";
import { forcedLocaleForPath } from "./routeLocale";

describe("forcedLocaleForPath", () => {
  it("forces English on every English dictation screen", () => {
    for (const path of ["/english", "/english/new", "/english/edit", "/english/practice", "/mistakes/review/en"]) {
      expect(forcedLocaleForPath(path)).toBe("en");
    }
  });

  it("leaves other screens on the app language", () => {
    for (const path of ["/dashboard", "/chinese", "/chinese/practice", "/mistakes", "/mistakes/review/zh", "/settings", "/englishx"]) {
      expect(forcedLocaleForPath(path)).toBeNull();
    }
  });
});
