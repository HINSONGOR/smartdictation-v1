/**
 * Fill-in blanks in prompts: "請解釋「{生字}」嘅意思" has the blank "生字".
 * Kids type the blank, then copy the finished prompt.
 */
const BLANK = /\{([^{}\n]{1,30})\}/g;

/** Blank names in order of first appearance. */
export function blanksOf(content: string): string[] {
  const names: string[] = [];
  for (const match of content.matchAll(BLANK)) {
    const name = match[1].trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Replace filled blanks; unfilled ones stay as {name} so they are easy to spot. */
export function fillBlanks(content: string, values: Record<string, string>): string {
  return content.replace(BLANK, (whole, raw: string) => {
    const value = values[raw.trim()]?.trim();
    return value ? value : whole;
  });
}
