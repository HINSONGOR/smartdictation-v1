// SmartDictation — photo → text (OCR) with Gemini.
// Deploy in Supabase → Edge Functions (live name: "bright-task", see lib/cloud/config.ts ocrFunction), and add the secret GEMINI_API_KEY
// (optional: GEMINI_MODELS, comma-separated, tried in order). Only logged-in family accounts can call it.

/** Tried in order: when one is busy (429 / 503) or fails, the next one takes over. */
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
/** The app's public key (same as lib/cloud/config.ts) — used to ask Supabase Auth who is calling. */
const PUBLISHABLE_KEY = "sb_publishable_f96LaJw842ueyel5_nnxWg_6vU4KBF0";
/** ~6 MB of base64; the app shrinks photos to well below this. */
const MAX_IMAGE_CHARS = 8_000_000;
/** Give up on one model after this long and let the next one try. */
const MODEL_TIMEOUT_MS = 25_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Language = "zh" | "en";
type Target = "words" | "passage" | "events" | "qa";
const TARGETS: Target[] = ["words", "passage", "events", "qa"];

/** Question-and-answer revision worksheet → JSON list of question / answer pairs. */
function qaPrompt(): string {
  return [
    "You read photos of Hong Kong school revision worksheets that list questions with their model answers.",
    "Transcribe exactly as printed (Traditional Chinese stays Traditional; keep full-width punctuation). Do not correct, summarise or answer anything yourself.",
    "Return JSON only, in this shape:",
    '{"subject":string or null,"topic":string or null,"items":[{"question":string,"answer":string}]}',
    "Rules:",
    "- subject: the subject named on the sheet (e.g. 常識, 人文科, 中文, English, 數學), else null.",
    "- topic: the lesson / unit heading, e.g. \"第四課 中國近年的發展\", else null.",
    "- One item per numbered question. Leave out the number (\"1.\"), and join lines of one answer that were only wrapped by the page width.",
    "- If a question has no printed answer, use an empty string for answer.",
    "- Leave out the school name, term, name / class / date fields and instructions.",
    '- If no questions are found, return {"subject":null,"topic":null,"items":[]}.',
  ].join("\n");
}

/** School notice / exam timetable / dictation scope → JSON list of dated items. */
function eventsPrompt(today: string): string {
  return [
    "You read photos of Hong Kong primary / secondary school documents for a family study planner:",
    "school notices, exam or test timetables, dictation schedules and homework lists (Chinese and/or English).",
    `Today is ${today}. When a date has no year, use the nearest such date on or after today (school year runs September to August).`,
    "Return JSON only, in this shape:",
    '{"items":[{"title":string,"date":"YYYY-MM-DD","time":"HH:mm" or null,"kind":"exam"|"dictation"|"homework"|"notice"|"other","subject":"chinese"|"english"|"math"|"gs"|other subject name or null,"scope":[string] or null,"notes":string or null}]}',
    "Rules:",
    "- One item per dated thing to do: each exam paper / test / dictation (默書) / deadline (e.g. reply slip 回條, fee, things to bring) / event.",
    "- kind: exam = exams, tests, quizzes (考試, 測驗, 小測); dictation = 默書 / spelling; homework = 功課, projects; notice = reply slips, fees, bring items, events.",
    "- subject: chinese (中文), english (英文), math (數學), gs (常識), otherwise the subject name as printed, or null.",
    "- title: short, in the document's language, e.g. \"中文測驗\", \"English Dictation 3\", \"交回條：旅行日\".",
    "- scope: the exam / dictation coverage as a list of short parts, e.g. [\"第3課\",\"第4課\",\"詞語表\"], else null.",
    "- notes: other useful details (time, place, things to bring, amount), else null.",
    "- Leave out greetings, school name, signatures and general text with no date.",
    '- If nothing dated is found, return {"items":[]}.',
  ].join("\n");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function prompt(language: Language, target: Target): string {
  const lang =
    language === "zh"
      ? "The text is Chinese (Traditional Chinese as printed — do not convert to Simplified). Keep full-width Chinese punctuation exactly as printed. The book may print Hanyu Pinyin above or beside the characters (e.g. chūn tiān): leave all pinyin out completely and output only the Chinese characters and punctuation."
      : "The text is English. Keep capital letters and punctuation exactly as printed.";
  const shape =
    target === "words"
      ? "This is a vocabulary / word list. Output one word or phrase per line, in the printed order. Leave out numbering, bullets, page numbers, headings and instructions."
      : "This is a passage. Output the passage text only, keeping its paragraphs: one paragraph per line, with an empty line between paragraphs. Join lines that were only wrapped by the page width. Leave out titles, page numbers, exercise instructions, vocabulary boxes and picture captions.";
  return [
    "You are an OCR tool for a children's dictation app.",
    "Transcribe the printed text in this photo exactly — do not correct, translate, summarise or add anything.",
    lang,
    shape,
    "If there is no readable text, output nothing.",
  ].join("\n");
}

async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || PUBLISHABLE_KEY },
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await signedIn(req))) return json({ error: "auth" }, 401);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "notSetUp" }, 500);

  let body: { image?: string; mimeType?: string; language?: Language; target?: Target; today?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "badRequest" }, 400);
  }
  const { image, mimeType = "image/jpeg", language, target, today } = body;
  if (!image || image.length > MAX_IMAGE_CHARS || !["zh", "en"].includes(language ?? "") || !TARGETS.includes(target as Target)) {
    return json({ error: "badRequest" }, 400);
  }
  if (target === "events" && !/^\d{4}-\d{2}-\d{2}$/.test(today ?? "")) return json({ error: "badRequest" }, 400);

  const models = (Deno.env.get("GEMINI_MODELS") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const instructions = target === "events" ? eventsPrompt(today!) : target === "qa" ? qaPrompt() : prompt(language!, target!);
  const contents = [{ parts: [{ text: instructions }, { inline_data: { mime_type: mimeType, data: image } }] }];
  const base = target === "events" || target === "qa" ? { temperature: 0, responseMimeType: "application/json" } : { temperature: 0 };
  // Reading text needs little "thinking"; low thinking answers much faster.
  const fast = JSON.stringify({ contents, generationConfig: { ...base, thinkingConfig: { thinkingLevel: "low" } } });
  const plain = JSON.stringify({ contents, generationConfig: base });

  const call = (model: string, body: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    }).catch(() => null); // network error or too slow

  let busy = false;
  for (const model of models.length ? models : DEFAULT_MODELS) {
    const started = Date.now();
    console.log("gemini try", model);
    let res = await call(model, fast);
    // This model doesn't accept the thinking setting → ask once more without it.
    if (res?.status === 400) res = await call(model, plain);
    if (!res?.ok) {
      // Busy / too slow / unavailable / model not offered to this key → try the next model.
      busy ||= !res || res.status === 429 || res.status === 503;
      console.error("gemini fail", model, res?.status ?? "timeout/network", Date.now() - started, "ms", res ? await res.text() : "");
      continue;
    }
    console.log("gemini ok", model, Date.now() - started, "ms");
    const data = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return json({ text, model });
  }
  return json({ error: busy ? "ocrBusy" : "ocrFailed" }, 502);
});
