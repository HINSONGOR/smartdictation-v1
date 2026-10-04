import { notFound } from "next/navigation";
import { MistakeReviewPage } from "@/components/mistakes/MistakeReviewPage";
import type { DictationLanguage } from "@/types";

const LANGUAGES: DictationLanguage[] = ["zh", "en"];

// Only /mistakes/review/zh and /mistakes/review/en exist — both prerendered statically.
export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUAGES.map((language) => ({ language }));
}

export default async function ReviewPage({ params }: PageProps<"/mistakes/review/[language]">) {
  const { language } = await params;
  if (!LANGUAGES.includes(language as DictationLanguage)) notFound();
  return <MistakeReviewPage language={language as DictationLanguage} />;
}
