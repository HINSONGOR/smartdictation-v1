import type { PromptInput } from "@/types";

/**
 * Starter prompts shown when the library is empty. They model good study habits:
 * ask for explanations and hints, not ready-made answers.
 */
export const SAMPLE_PROMPTS: Omit<PromptInput, "shared">[] = [
  {
    title: "解釋生字",
    content: "我係小學生。請用簡單嘅說話解釋「{生字}」嘅意思，再用佢作兩句例句。",
    subjectId: "chinese",
    purpose: "explain",
    ai: "any",
  },
  {
    title: "English word helper",
    content:
      'I am a primary school student. Please explain the English word "{word}" in simple English, give two example sentences, and make one fill-in-the-blank question for me (put the answer at the end).',
    subjectId: "english",
    purpose: "study",
    ai: "any",
  },
  {
    title: "出溫習題",
    content: "我係{年級}學生，{日期}要考{科目}，範圍係：{範圍}。請出 5 條選擇題同 3 條短答題幫我溫習，答案全部放喺最後。",
    purpose: "quiz",
    ai: "any",
  },
  {
    title: "睇作文（唔好幫我重寫）",
    content: "請幫我睇下以下作文：指出錯別字同唔通順嘅句子，建議點樣寫得更好，但唔好幫我成篇重寫。\n\n{作文}",
    subjectId: "chinese",
    purpose: "writing",
    ai: "any",
  },
  {
    title: "數學一步一步提示",
    content: "請一步一步教我諗呢條數學題。唔好直接俾答案，先俾第一個提示，等我答咗再俾下一個提示。\n\n題目：{題目}",
    subjectId: "math",
    purpose: "explain",
    ai: "any",
  },
  {
    title: "中譯英＋文法",
    content: "請將以下句子翻譯成英文，再用簡單嘅說話解釋用咗咩文法：{句子}",
    subjectId: "english",
    purpose: "translate",
    ai: "any",
  },
];
