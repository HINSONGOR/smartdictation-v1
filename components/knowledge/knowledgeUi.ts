import type { KnowledgeKind } from "@/types";

export const knowledgeRoutes = {
  library: (itemId?: string) => (itemId ? `/knowledge?item=${encodeURIComponent(itemId)}` : "/knowledge"),
  edit: (id: string) => `/knowledge/edit?id=${encodeURIComponent(id)}`,
  create: (kind?: KnowledgeKind) => (kind ? `/knowledge/edit?kind=${kind}` : "/knowledge/edit"),
};

export const KIND_ICON: Record<KnowledgeKind, string> = { note: "📝", example: "🧮", qa: "❓", vocab: "🔤" };

/** Kinds that can be self-tested in review mode. */
export const REVIEWABLE: KnowledgeKind[] = ["qa", "vocab"];
