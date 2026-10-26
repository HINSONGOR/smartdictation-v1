import type { KnowledgeInput } from "@/types";
import { DISPLACEMENT_PACK } from "./packsDisplacement";
import { ENGLISH_TENSE_CARDS, ENGLISH_TENSE_NOTES } from "./packsEnglish";

/**
 * Ready-made knowledge packs a family can add with one tap (not added automatically:
 * other families may not need them). Items already in the library (same title) are skipped.
 * Worked examples use π = 3.14.
 */
export interface KnowledgePack {
  id: string;
  titleKey:
    | "knowledge.pack.shapes"
    | "knowledge.pack.shapeCards"
    | "knowledge.pack.displacement"
    | "knowledge.pack.tenses"
    | "knowledge.pack.tenseCards";
  items: KnowledgeInput[];
}

const T2 = "圖形公式（2D）";
const T3 = "圖形公式（3D）";
const note = (topic: string, title: string, body: string): KnowledgeInput => ({ kind: "note", subjectId: "math", topic, title, body });
const example = (topic: string, title: string, body: string, answer: string): KnowledgeInput => ({
  kind: "example",
  subjectId: "math",
  topic,
  title,
  body,
  answer,
});
const card = (title: string, answer: string): KnowledgeInput => ({ kind: "qa", subjectId: "math", topic: "公式記憶咭", title, body: "", answer });

const SHAPES: KnowledgeInput[] = [
  // ---- 2D ----
  note(T2, "正方形公式", "• 面積 = 邊長 × 邊長\n• 周界 = 邊長 × 4"),
  example(T2, "正方形例題", "一個正方形邊長 6 cm，求面積同周界。", "面積 = 6 × 6 = 36 cm²\n周界 = 6 × 4 = 24 cm"),

  note(T2, "長方形公式", "• 面積 = 長 × 闊\n• 周界 = (長 + 闊) × 2\n變形：\n• 長 = 面積 ÷ 闊\n• 闊 = 面積 ÷ 長"),
  example(T2, "長方形例題", "一個長方形面積 48 cm²，闊 6 cm，求長同周界。", "長 = 面積 ÷ 闊 = 48 ÷ 6 = 8 cm\n周界 = (8 + 6) × 2 = 28 cm"),

  note(T2, "三角形公式", "• 面積 = 底 × 高 ÷ 2\n變形：\n• 底 = 面積 × 2 ÷ 高\n• 高 = 面積 × 2 ÷ 底"),
  example(
    T2,
    "三角形例題",
    "(1) 一個三角形底 10 cm、高 6 cm，求面積。\n(2) 另一個三角形面積 30 cm²，底 12 cm，求高。",
    "(1) 面積 = 10 × 6 ÷ 2 = 30 cm²\n(2) 高 = 面積 × 2 ÷ 底 = 30 × 2 ÷ 12 = 5 cm",
  ),

  note(T2, "平行四邊形公式", "• 面積 = 底 × 高\n變形：\n• 底 = 面積 ÷ 高\n• 高 = 面積 ÷ 底"),
  example(T2, "平行四邊形例題", "一個平行四邊形面積 45 cm²，高 5 cm，求底。", "底 = 面積 ÷ 高 = 45 ÷ 5 = 9 cm"),

  note(T2, "梯形公式", "• 面積 = (上底 + 下底) × 高 ÷ 2\n變形：\n• (上底 + 下底) = 面積 × 2 ÷ 高\n• 高 = 面積 × 2 ÷ (上底 + 下底)"),
  example(
    T2,
    "梯形例題",
    "(1) 一個梯形上底 4 cm、下底 10 cm、高 6 cm，求面積。\n(2) 另一個梯形面積 42 cm²，上底加下底 14 cm，求高。",
    "(1) 面積 = (4 + 10) × 6 ÷ 2 = 42 cm²\n(2) 高 = 面積 × 2 ÷ (上底 + 下底) = 42 × 2 ÷ 14 = 6 cm",
  ),

  note(T2, "圓形公式", "• 面積 = π × 半徑 × 半徑\n• 周長（圓周）= 直徑 × π = 2 × π × 半徑\n變形：\n• 半徑 = 直徑 ÷ 2\n（π 一般取 3.14）"),
  example(
    T2,
    "圓形例題",
    "一個圓形直徑 10 cm，求面積同周長。（π 取 3.14）",
    "半徑 = 10 ÷ 2 = 5 cm\n面積 = 3.14 × 5 × 5 = 78.5 cm²\n周長 = 10 × 3.14 = 31.4 cm",
  ),

  // ---- 3D ----
  note(
    T3,
    "長方體公式",
    "• 體積 = 長 × 闊 × 高\n• 體積 = 底面積 × 高\n• 表面積 = (長×闊 + 長×高 + 闊×高) × 2\n變形：\n• 底面積 = 體積 ÷ 高\n• 高 = 體積 ÷ 底面積\n• 長 = 體積 ÷ (闊 × 高)\n• 闊 = 體積 ÷ (長 × 高)",
  ),
  example(
    T3,
    "長方體例題",
    "(1) 一個長方體長 5 cm、闊 4 cm、高 3 cm，求體積同表面積。\n(2) 另一個長方體體積 120 cm³，闊 4 cm、高 5 cm，求長。",
    "(1) 體積 = 5 × 4 × 3 = 60 cm³\n表面積 = (5×4 + 5×3 + 4×3) × 2 = (20 + 15 + 12) × 2 = 94 cm²\n(2) 長 = 體積 ÷ (闊 × 高) = 120 ÷ (4 × 5) = 6 cm",
  ),

  note(T3, "正方體公式", "• 體積 = 邊長 × 邊長 × 邊長\n• 表面積 = 邊長 × 邊長 × 6\n變形：\n• 邊長 × 邊長 = 體積 ÷ 邊長（已知體積，逐步試／開立方）"),
  example(
    T3,
    "正方體例題",
    "(1) 一個正方體邊長 3 cm，求體積同表面積。\n(2) 另一個正方體體積 64 cm³，求邊長。",
    "(1) 體積 = 3 × 3 × 3 = 27 cm³\n表面積 = 3 × 3 × 6 = 54 cm²\n(2) 逐步試：4 × 4 × 4 = 64，所以邊長 = 4 cm",
  ),

  note(
    T3,
    "圓柱體公式",
    "• 體積 = 底面積 × 高 = π × 半徑 × 半徑 × 高\n• 側面積 = 底圓周長 × 高 = 2 × π × 半徑 × 高\n• 表面積 = 側面積 + 底面積 × 2\n變形：\n• 底面積 = 體積 ÷ 高\n• 高 = 體積 ÷ 底面積",
  ),
  example(
    T3,
    "圓柱體例題",
    "一個圓柱體底半徑 2 cm、高 5 cm，求體積、側面積同表面積。（π 取 3.14）",
    "底面積 = 3.14 × 2 × 2 = 12.56 cm²\n體積 = 12.56 × 5 = 62.8 cm³\n側面積 = 2 × 3.14 × 2 × 5 = 62.8 cm²\n表面積 = 62.8 + 12.56 × 2 = 87.92 cm²",
  ),

  note(
    T3,
    "常用小貼士",
    "• 「體積 = 底面積 × 高」呢條公式，長方體、正方體、圓柱體都通用。\n• 見到「變形公式」，記住規律：\n  ◦ 求高 → 體積 ÷ 底面積\n  ◦ 求底面積 → 體積 ÷ 高\n  ◦ 求其中一邊 → 體積 ÷（另外兩邊相乘）\n• π 一般取 3.14（如題目無特別要求）。",
  ),
];

const SHAPE_CARDS: KnowledgeInput[] = [
  card("正方形面積公式？", "面積 = 邊長 × 邊長"),
  card("正方形周界公式？", "周界 = 邊長 × 4"),
  card("長方形面積公式？", "面積 = 長 × 闊"),
  card("長方形周界公式？", "周界 = (長 + 闊) × 2"),
  card("三角形面積公式？", "面積 = 底 × 高 ÷ 2"),
  card("三角形：已知面積同底，點樣求高？", "高 = 面積 × 2 ÷ 底"),
  card("平行四邊形面積公式？", "面積 = 底 × 高"),
  card("梯形面積公式？", "面積 = (上底 + 下底) × 高 ÷ 2"),
  card("圓形面積公式？", "面積 = π × 半徑 × 半徑"),
  card("圓形周長公式？", "周長 = 直徑 × π = 2 × π × 半徑"),
  card("長方體體積公式？", "體積 = 長 × 闊 × 高（或 底面積 × 高）"),
  card("長方體表面積公式？", "表面積 = (長×闊 + 長×高 + 闊×高) × 2"),
  card("正方體體積公式？", "體積 = 邊長 × 邊長 × 邊長"),
  card("正方體表面積公式？", "表面積 = 邊長 × 邊長 × 6"),
  card("圓柱體體積公式？", "體積 = 底面積 × 高 = π × 半徑 × 半徑 × 高"),
  card("圓柱體側面積公式？", "側面積 = 底圓周長 × 高 = 2 × π × 半徑 × 高"),
  card("圓柱體表面積公式？", "表面積 = 側面積 + 底面積 × 2"),
  card("已知體積同底面積，點樣求高？", "高 = 體積 ÷ 底面積"),
  card("π 一般取幾多？", "3.14（如題目無特別要求）"),
];

export const KNOWLEDGE_PACKS: KnowledgePack[] = [
  { id: "shapes", titleKey: "knowledge.pack.shapes", items: SHAPES },
  { id: "shapeCards", titleKey: "knowledge.pack.shapeCards", items: SHAPE_CARDS },
  { id: "displacement", titleKey: "knowledge.pack.displacement", items: DISPLACEMENT_PACK },
  { id: "tenses", titleKey: "knowledge.pack.tenses", items: ENGLISH_TENSE_NOTES },
  { id: "tenseCards", titleKey: "knowledge.pack.tenseCards", items: ENGLISH_TENSE_CARDS },
];
