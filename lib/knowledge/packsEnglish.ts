import type { KnowledgeInput } from "@/types";

/** English tenses pack (checked against the family's notes; one example sentence added per tense). */
const TOPIC = "Tenses 時態";
const CARDS = "時態記憶咭";

interface Tense {
  name: string;
  structure: string;
  keywords: string;
  usage: string;
  example: string;
}

const TENSES: Tense[] = [
  {
    name: "Simple Present Tense（一般現在式）",
    structure: "V / V-s, V-es",
    keywords:
      "always, usually, often, sometimes, seldom, rarely, hardly ever, never, regularly, frequently, normally, generally, every day/week/month/year, once/twice/three times a week, on Mondays, on weekdays, at weekends, nowadays, in the morning (habit)",
    usage: "習慣、事實、真理；時間表或固定行程（e.g. The train leaves at 8 a.m.）",
    example: "She walks to school every day.",
  },
  {
    name: "Simple Past Tense（一般過去式）",
    structure: "V-ed / 過去式",
    keywords:
      "yesterday, the day before yesterday, last night/week/month/year, … ago（e.g. two days ago）, in 1997, just now, once（= 曾經，指過去某時）, the other day, this morning (when past), in the past, then, at that time, when I was young, earlier today",
    usage: "過去發生的完成動作",
    example: "I visited my grandma yesterday.",
  },
  {
    name: "Simple Future Tense（一般將來式）",
    structure: "will + V / am / is / are going to + V",
    keywords:
      "tomorrow, the day after tomorrow, next week/month/year, soon, in two days, later, tonight, in the future, from now on, coming（e.g. the coming Sunday）, some day, in a moment",
    usage: "將來的計劃或預測；be going to = 已決定的計劃 / 有跡象的預測",
    example: "It will rain tomorrow. / We are going to visit the museum next Sunday.",
  },
  {
    name: "Present Perfect Tense（現在完成式）",
    structure: "have / has + p.p.",
    keywords:
      "already, yet (negative/question), just, ever, never, since + point in time, for + duration, so far, recently, lately, up to now, until now, till now, in the past few years, before (句尾), once/twice/many times, how long",
    usage: "經驗、過去動作對現在有影響、由過去持續到現在",
    example: "I have already finished my homework.",
  },
  {
    name: "Present Continuous Tense（現在進行式）",
    structure: "am / is / are + V-ing",
    keywords: "now, right now, at the moment, at present, look!, listen!, these days, currently, still, at this time, this week (temporary)",
    usage: "正在發生的動作；短暫情況；已安排好的將來計劃（e.g. I am meeting Tom tomorrow.）",
    example: "Look! The baby is sleeping.",
  },
  {
    name: "Past Continuous Tense（過去進行式）",
    structure: "was / were + V-ing",
    keywords:
      "at that time, at that moment, while, as, when（後面用 Simple Past 打斷，主句用 Past Continuous）, at 8 o'clock yesterday, all day yesterday, this time last year, from 7 to 9 last night, all morning",
    usage: "過去某一時間點正在進行的動作；被另一個動作打斷的背景動作",
    example: "I was cooking when he called.",
  },
  {
    name: "Past Perfect Tense（過去完成式）",
    structure: "had + p.p.",
    keywords:
      "before, after, by the time + past simple clause, already (in past context), by（e.g. by 1990, by the end of last year）, until, as soon as, when, never … before",
    usage: "過去某動作之前已完成的動作（過去的過去）",
    example: "The bus had left before we arrived.",
  },
  {
    name: "Present Perfect Continuous Tense（現在完成進行式）",
    structure: "have / has been + V-ing",
    keywords: "for + duration, since + point in time, all day, all morning, the whole week, how long, lately, recently, up to now",
    usage: "由過去開始一直做到現在，強調過程",
    example: "I have been waiting for two hours.",
  },
  {
    name: "Past Perfect Continuous Tense（過去完成進行式）",
    structure: "had been + V-ing",
    keywords: "for + duration (in past context), since (in past context), before, by the time + past simple clause, when, how long",
    usage: "過去某時間點之前一直持續的動作",
    example: "She had been studying for three hours when I arrived.",
  },
  {
    name: "Future Continuous Tense（將來進行式）",
    structure: "will be + V-ing",
    keywords: "at this time tomorrow, this time next week, at 8 p.m. tonight, all day tomorrow, when + present simple clause, in an hour's time",
    usage: "將來某一時間點正在進行的動作",
    example: "At this time tomorrow, I will be flying to Tokyo.",
  },
  {
    name: "Future Perfect Tense（將來完成式）",
    structure: "will have + p.p.",
    keywords:
      "by + future time（e.g. by next Monday, by 2030, by the end of this year）, by the time + present simple clause, before, in + period（e.g. in two years' time）",
    usage: "將來某時間之前已完成的動作",
    example: "I will have finished the project by next Monday.",
  },
];

const TRAPS: { title: string; point: string; example: string }[] = [
  { title: "just vs just now", point: "just → Present Perfect；just now → Simple Past", example: "I have just eaten. / I ate just now." },
  { title: "for vs since", point: "for + 一段時間；since + 時間點", example: "for 3 years / since 2020" },
  { title: "already vs yet", point: "already 多數用於肯定句；yet 用於否定句及問句，放句尾", example: "I have already finished. / Have you finished yet?" },
  {
    title: "when vs while",
    point: "while + 進行式（背景動作）；when 多數接 Simple Past（打斷的動作）",
    example: "I was cooking when he called. / While I was cooking, he called.",
  },
  {
    title: "Stative verbs",
    point: "know, like, love, believe, want, own, need, understand 通常唔用進行式",
    example: "I know him.（✗ I am knowing him.）",
  },
  {
    title: "時間 / 條件子句",
    point: "if, when, before, after, as soon as, until 後面用 Simple Present 表示將來，唔用 will",
    example: "I will call you when I arrive.",
  },
  {
    title: "ago vs before",
    point: "ago → Simple Past（由現在計）；before 單獨放句尾 → Present Perfect 或 Past Perfect",
    example: "I met her two years ago. / I have seen this film before.",
  },
];

const shortName = (name: string) => name.replace(/（.*）/, "");

export const ENGLISH_TENSE_NOTES: KnowledgeInput[] = [
  ...TENSES.map(
    (t): KnowledgeInput => ({
      kind: "note",
      subjectId: "english",
      topic: TOPIC,
      title: t.name,
      body: `句式 Structure：${t.structure}\n\n關聯詞 Signal words：${t.keywords}\n\n用法 Usage：${t.usage}\n\n例句 Example：${t.example}`,
    }),
  ),
  {
    kind: "note",
    subjectId: "english",
    topic: TOPIC,
    title: "Tenses 常見陷阱",
    body: TRAPS.map((t) => `• ${t.title}：${t.point}\n  e.g. ${t.example}`).join("\n\n"),
  },
];

export const ENGLISH_TENSE_CARDS: KnowledgeInput[] = [
  ...TENSES.map(
    (t): KnowledgeInput => ({
      kind: "qa",
      subjectId: "english",
      topic: CARDS,
      title: `${shortName(t.name)} 嘅句式？`,
      body: "",
      answer: `${t.structure}\ne.g. ${t.example}`,
    }),
  ),
  ...TRAPS.map(
    (t): KnowledgeInput => ({
      kind: "qa",
      subjectId: "english",
      topic: CARDS,
      title: `${t.title}：有咩分別？`,
      body: "",
      answer: `${t.point}\ne.g. ${t.example}`,
    }),
  ),
];
