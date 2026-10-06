import { describe, expect, it } from "vitest";
import { ACCOUNT_DOMAIN, accountEmail, accountNameOf, normalizeAccountName } from "./account";

describe("family account name", () => {
  it("lower-cases and trims", () => {
    expect(normalizeAccountName("  Hinson-Family ")).toBe("hinson-family");
    expect(accountEmail("Chan_123")).toBe(`chan_123@${ACCOUNT_DOMAIN}`);
  });

  it.each(["ab", "a".repeat(31), "-abc", "abc_", "has space", "中文名", "a@b", "a.b.c", ""])("rejects %j", (name) => {
    expect(() => normalizeAccountName(name)).toThrow(expect.objectContaining({ code: "cloud.invalidUsername" }));
  });

  it("accepts 3 and 30 characters", () => {
    expect(normalizeAccountName("abc")).toBe("abc");
    expect(normalizeAccountName("a".repeat(30))).toBe("a".repeat(30));
  });

  it("shows the account name, not the internal address", () => {
    expect(accountNameOf(`hinson-family@${ACCOUNT_DOMAIN}`)).toBe("hinson-family");
    expect(accountNameOf(null)).toBe("");
  });
});
