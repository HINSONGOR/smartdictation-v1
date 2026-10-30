import type { MessageKey, Translate } from "@/lib/i18n";
import { PROMPT_AIS, type PromptAi, type PromptPurpose } from "@/types";

export const promptRoutes = {
  library: () => "/prompts",
  edit: (id: string) => `/prompts/edit?id=${encodeURIComponent(id)}`,
  create: () => "/prompts/edit",
};

/** Where "open in …" goes (the prompt is copied first, then pasted there). */
export const AI_LINKS: Record<Exclude<PromptAi, "any">, string> = {
  gemini: "https://gemini.google.com/app",
  chatgpt: "https://chatgpt.com/",
};

/** A saved prompt's AI, or "any" for one no longer offered. */
export const knownAi = (ai: string): PromptAi => ((PROMPT_AIS as readonly string[]).includes(ai) ? (ai as PromptAi) : "any");

export const purposeLabel = (t: Translate, purpose: PromptPurpose) => t(`prompts.purpose.${purpose}` as MessageKey);
export const aiLabel = (t: Translate, ai: PromptAi) => t(`prompts.ai.${knownAi(ai)}` as MessageKey);

/** Copy text; falls back to a hidden textarea where the Clipboard API isn't allowed. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
