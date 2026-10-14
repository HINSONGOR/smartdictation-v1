import { nowIso } from "@/lib/utils/id";
import type { DictationLanguage, PracticeAnswer, PracticeItem, PracticeMode, PracticeOrder } from "@/types";
import { isAnswerCorrect } from "./answerCheck";

/**
 * Practice session state machine (pure, UI-independent).
 *
 * typing: question → (submit) → feedback → (next) → question … → done
 * paper:  question → (reveal) → revealed → (selfMark ✓/✗, can change) → (next) → question … → done
 *
 * Both modes group consecutive sentences of the same paragraph: the student listens sentence by sentence
 * ("next" / "previous" inside the group). After the last sentence the whole paragraph is checked at once
 * (typing: submitGroup with every sentence's typed answer; paper: revealed and self-marked per sentence).
 */
export type PracticePhase = "question" | "feedback" | "revealed" | "done";

export interface PracticeState {
  language: DictationLanguage;
  mode: PracticeMode;
  items: PracticeItem[];
  index: number;
  phase: PracticePhase;
  /** One answer per finished (or, in paper mode, self-marked) item. */
  answers: PracticeAnswer[];
  startedAt: string;
}

export type PracticeAction =
  | { type: "submit"; answer: string }
  /** Typing mode, last sentence of a paragraph: the typed answer of every sentence (by item id). */
  | { type: "submitGroup"; answers: Record<string, string> }
  | { type: "reveal" }
  /** itemId defaults to the current item; must be inside the revealed group. */
  | { type: "selfMark"; correct: boolean; itemId?: string }
  /** Mark every item of the revealed group at once (e.g. "全部 ✓ 啱"). */
  | { type: "selfMarkAll"; correct: boolean }
  | { type: "next" }
  | { type: "previous" };

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Random order only shuffles words — passage sentences always keep their order, after the words. */
export function startPractice(
  items: PracticeItem[],
  options: { language: DictationLanguage; mode: PracticeMode; order: PracticeOrder },
  random: () => number = Math.random,
): PracticeState {
  if (items.length === 0) throw new Error("Cannot practise an empty list");
  const words = items.filter((i) => i.kind === "word");
  const sentences = items.filter((i) => i.kind === "sentence");
  return {
    language: options.language,
    mode: options.mode,
    items: [...(options.order === "random" ? shuffle(words, random) : words), ...sentences],
    index: 0,
    phase: "question",
    answers: [],
    startedAt: nowIso(),
  };
}

export function currentItem(state: PracticeState): PracticeItem {
  return state.items[state.index];
}

export function answerFor(state: PracticeState, itemId: string): PracticeAnswer | undefined {
  return state.answers.find((a) => a.itemId === itemId);
}

export function currentAnswer(state: PracticeState): PracticeAnswer | undefined {
  return answerFor(state, currentItem(state).id);
}

/**
 * Index range [start, end] of the group the current item belongs to.
 * Consecutive sentences of one paragraph form a group; everything else is its own group.
 */
export function groupRange(state: PracticeState): [number, number] {
  const item = currentItem(state);
  if (item.kind !== "sentence" || item.paragraphNumber === undefined) {
    return [state.index, state.index];
  }
  const sameParagraph = (i: number) =>
    state.items[i]?.kind === "sentence" && state.items[i].paragraphNumber === item.paragraphNumber;
  let start = state.index;
  let end = state.index;
  while (sameParagraph(start - 1)) start--;
  while (sameParagraph(end + 1)) end++;
  return [start, end];
}

/** Items of the current group (one item, or all sentences of the current paragraph). */
export function groupItems(state: PracticeState): PracticeItem[] {
  const [start, end] = groupRange(state);
  return state.items.slice(start, end + 1);
}

/** True when the current item is the last one of its group (the answer can be revealed). */
export function isGroupEnd(state: PracticeState): boolean {
  return state.index === groupRange(state)[1];
}

/** The first item after the current group, if any (decides "下一句" vs "下一題" vs "完成"). */
export function itemAfterGroup(state: PracticeState): PracticeItem | undefined {
  return state.items[groupRange(state)[1] + 1];
}

function advancePastGroup(state: PracticeState): PracticeState {
  const next = groupRange(state)[1] + 1;
  return next >= state.items.length ? { ...state, phase: "done" } : { ...state, index: next, phase: "question" };
}

function typedAnswer(item: PracticeItem, answer: string, state: PracticeState): PracticeAnswer {
  return {
    itemId: item.id,
    text: item.text,
    kind: item.kind,
    answer,
    correct: isAnswerCorrect(answer, item.text, state.language),
  };
}

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  const item = currentItem(state);
  const [start, end] = groupRange(state);
  switch (action.type) {
    case "submit": {
      // A single item (a paragraph is submitted as a whole with submitGroup).
      if (state.mode !== "typing" || state.phase !== "question" || start !== end) return state;
      return { ...state, phase: "feedback", answers: [...state.answers, typedAnswer(item, action.answer, state)] };
    }

    case "submitGroup": {
      if (state.mode !== "typing" || state.phase !== "question" || state.index !== end) return state;
      const typed = state.items.slice(start, end + 1).map((i) => typedAnswer(i, action.answers[i.id] ?? "", state));
      return { ...state, phase: "feedback", answers: [...state.answers, ...typed] };
    }

    case "reveal":
      // A paragraph is revealed only after its last sentence.
      return state.mode === "paper" && state.phase === "question" && state.index === end
        ? { ...state, phase: "revealed" }
        : state;

    case "selfMark": {
      if (state.phase !== "revealed") return state;
      const target = action.itemId ? state.items.slice(start, end + 1).find((i) => i.id === action.itemId) : item;
      if (!target) return state;
      const answer: PracticeAnswer = { itemId: target.id, text: target.text, kind: target.kind, correct: action.correct };
      return { ...state, answers: [...state.answers.filter((a) => a.itemId !== target.id), answer] };
    }

    case "selfMarkAll": {
      if (state.phase !== "revealed") return state;
      const group = state.items.slice(start, end + 1);
      const ids = new Set(group.map((i) => i.id));
      const marks: PracticeAnswer[] = group.map((i) => ({ itemId: i.id, text: i.text, kind: i.kind, correct: action.correct }));
      return { ...state, answers: [...state.answers.filter((a) => !ids.has(a.itemId)), ...marks] };
    }

    case "next":
      if (state.phase === "feedback") return advancePastGroup(state);
      // Inside a paragraph: listen to the next sentence without checking.
      if (state.phase === "question" && state.index < end) {
        return { ...state, index: state.index + 1 };
      }
      if (state.phase === "revealed" && state.items.slice(start, end + 1).every((i) => answerFor(state, i.id))) {
        return advancePastGroup(state);
      }
      return state;

    case "previous":
      return state.phase === "question" && state.index > start
        ? { ...state, index: state.index - 1 }
        : state;
  }
}

export interface PracticeSummary {
  total: number;
  correct: number;
  wrong: PracticeAnswer[];
}

export function summarize(state: PracticeState): PracticeSummary {
  const wrong = state.answers.filter((a) => !a.correct);
  return { total: state.items.length, correct: state.answers.length - wrong.length, wrong };
}
