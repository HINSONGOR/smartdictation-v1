// SmartDictation — photo → text (OCR) with Gemini.
// Deploy in Supabase → Edge Functions (name: "ocr"), and add the secret GEMINI_API_KEY
// (optional: GEMINI_MODELS, comma-separated, tried in order). Only logged-in family accounts can call it.

/** Tried in order: when one is busy (429 / 503) or fails, the next one takes over. */
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
/** The app's public key (same as lib/cloud/config.ts) — used to ask Supabase Auth who is calling. */
const PUBLISHABLE_KEY = "sb_publishable_f96LaJw842ueyel5_nnxWg_6vU4KBF0";
/** ~6 MB of base64; the app shrinks photos to well below this. */
const MAX_IMAGE_CHARS = 8_000_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Language = "zh" | "en";
type Target = "words" | "passage";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function prompt(language: Language, target: Target): string {
  const lang =
    language === "zh"
      ? "The text is Chinese (Traditional Chinese as printed — do not convert to Simplified). Keep full-width Chinese punctuation exactly as printed."
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

  let body: { image?: string; mimeType?: string; language?: Language; target?: Target };
  try {
    body = await req.json();
  } catch {
    return json({ error: "badRequest" }, 400);
  }
  const { image, mimeType = "image/jpeg", language, target } = body;
  if (!image || image.length > MAX_IMAGE_CHARS || !["zh", "en"].includes(language ?? "") || !["words", "passage"].includes(target ?? "")) {
    return json({ error: "badRequest" }, 400);
  }

  const models = (Deno.env.get("GEMINI_MODELS") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const request = JSON.stringify({
    contents: [{ parts: [{ text: prompt(language!, target!) }, { inline_data: { mime_type: mimeType, data: image } }] }],
    generationConfig: { temperature: 0 },
  });

  let busy = false;
  for (const model of models.length ? models : DEFAULT_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: request,
    }).catch(() => null);
    if (!res?.ok) {
      // Busy / unavailable / model not offered to this key → try the next model.
      busy ||= res?.status === 429 || res?.status === 503;
      console.error("gemini", model, res?.status, res ? await res.text() : "network");
      continue;
    }
    const data = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return json({ text, model });
  }
  return json({ error: busy ? "ocrBusy" : "ocrFailed" }, 502);
});
