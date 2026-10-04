import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_NAMES } from "@/lib/theme";

/**
 * WCAG 2.x contrast check for every text-on-background pair the UI actually uses, in every theme.
 * Normal-size text needs 4.5:1 (all of these are used for body / small text somewhere).
 */
const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
  // Drop anything before the last ";" (e.g. the leading `@import "tailwindcss";`).
  selectors: selectors.split(";").pop()!.split(",").map((s) => s.trim()),
  decls: [...body.matchAll(/(--sd-[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()] as const),
}));

/** Token values for one theme: :root first, then every rule that targets the theme, in source order. */
function tokens(theme: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rules) {
    if (rule.selectors.includes(":root") || rule.selectors.includes(`[data-theme="${theme}"]`)) {
      for (const [name, value] of rule.decls) out[name] = value;
    }
  }
  const resolve = (v: string): string => v.replace(/var\((--sd-[\w-]+)\)/g, (_, ref: string) => resolve(out[ref]));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, resolve(v)]));
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** [text token, background token] pairs used in the UI. */
const PAIRS: [string, string][] = [
  ["--sd-foreground", "--sd-background"],
  ["--sd-foreground", "--sd-surface"],
  ["--sd-foreground", "--sd-surface-muted"],
  ["--sd-foreground", "--sd-primary-soft"],
  ["--sd-muted", "--sd-surface"],
  ["--sd-muted", "--sd-background"],
  ["--sd-muted", "--sd-surface-muted"],
  ["--sd-primary", "--sd-surface"], // links, ghost buttons
  ["--sd-primary", "--sd-primary-soft"], // badges, active nav
  ["--sd-on-primary", "--sd-primary"], // primary buttons
  ["--sd-on-primary", "--sd-danger"], // danger button, ✗ selected
  ["--sd-on-primary", "--sd-success"], // ✓ selected
  ["--sd-danger", "--sd-surface"], // error text
  ["--sd-success", "--sd-surface"], // success text
  ["--sd-on-reveal", "--sd-reveal"], // 📖 顯示答案
];

describe.each(THEME_NAMES)("theme %s text contrast", (theme) => {
  const t = tokens(theme);
  it.each(PAIRS)("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(t[fg], `${fg} missing`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(t[bg], `${bg} missing`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
