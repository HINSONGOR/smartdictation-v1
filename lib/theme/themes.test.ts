import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_NAMES, THEME_PRESETS, mascotSrc } from "@/lib/theme";

const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

const COLOR_TOKENS = [
  "--sd-background",
  "--sd-surface",
  "--sd-surface-muted",
  "--sd-border",
  "--sd-foreground",
  "--sd-muted",
  "--sd-primary",
  "--sd-primary-hover",
  "--sd-on-primary",
  "--sd-primary-soft",
  "--sd-danger",
  "--sd-success",
];

/** Declarations of every rule whose selector list includes [data-theme="<name>"], concatenated. */
function themeBlock(name: string): string | null {
  const target = `[data-theme="${name}"]`;
  const bodies = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((s) => s.trim() === target))
    .map(([, , body]) => body);
  return bodies.length ? bodies.join("\n") : null;
}

describe.each(THEME_NAMES)("theme %s", (name) => {
  it("defines every colour token in globals.css", () => {
    const block = themeBlock(name);
    expect(block, `missing [data-theme="${name}"] block`).not.toBeNull();
    for (const token of COLOR_TOKENS) expect(block).toContain(`${token}:`);
  });

  it("cartoon themes have a pattern and an existing mascot asset", () => {
    const preset = THEME_PRESETS[name];
    if (preset.kind !== "cartoon") return;
    expect(themeBlock(name)).toContain("--sd-pattern:");
    expect(preset.mascot).toBeDefined();
    expect(existsSync(join(ROOT, "public", mascotSrc(preset.mascot!)))).toBe(true);
    expect(themeBlock(name)).toContain("--sd-radius-card:"); // part of the shared cartoon shape block
  });
});
