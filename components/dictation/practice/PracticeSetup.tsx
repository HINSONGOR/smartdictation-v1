"use client";

import { useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { DEFAULT_PRACTICE_OPTIONS, type DictationParagraph, type PracticeOptions } from "@/types";

interface Props {
  title: string;
  wordCount: number;
  /** Passage paragraphs (empty for word lists and mistake review). */
  paragraphs: DictationParagraph[];
  /** Number of practice steps the given options would produce. */
  countItems: (options: PracticeOptions) => number;
  onStart: (options: PracticeOptions) => void;
}

export function PracticeSetup({ title, wordCount, paragraphs, countItems, onStart }: Props) {
  const { t } = useApp();
  const [options, setOptions] = useState<PracticeOptions>(DEFAULT_PRACTICE_OPTIONS);
  const set = <K extends keyof PracticeOptions>(key: K, value: PracticeOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const hasPassage = paragraphs.length > 0;
  const total = countItems(options);
  const showWordOrder = wordCount > 1 && (!hasPassage || options.includeWords);

  return (
    <Card className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <ThemeMascot size={64} className="size-14 shrink-0" />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted">{t("practice.itemTotal", { count: total })}</p>
        </div>
      </div>

      <Segmented
        label={t("practice.mode")}
        value={options.mode}
        onChange={(v) => set("mode", v)}
        options={[
          { value: "paper", label: t("practice.mode.paper"), description: t("practice.mode.paper.desc") },
          { value: "typing", label: t("practice.mode.typing"), description: t("practice.mode.typing.desc") },
        ]}
      />

      {hasPassage && (
        <div className="space-y-3 rounded-control border border-border p-3">
          <Segmented
            label={t("practice.passage")}
            value={options.passageScope}
            onChange={(v) => set("passageScope", v)}
            options={[
              { value: "one", label: t("practice.passage.one") },
              { value: "random", label: t("practice.passage.random") },
              { value: "all", label: t("practice.passage.all") },
            ]}
          />

          {options.passageScope === "one" && (
            <fieldset>
              <legend className="mb-2 text-sm text-muted">{t("practice.pickParagraph")}</legend>
              <div className="flex flex-wrap gap-2">
                {paragraphs.map((p, index) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={options.paragraphIndex === index}
                    title={p.text}
                    onClick={() => set("paragraphIndex", index)}
                    className={`min-h-11 min-w-11 rounded-control border px-3 text-sm font-medium ${
                      options.paragraphIndex === index
                        ? "border-primary bg-primary text-on-primary"
                        : "border-border bg-surface text-foreground"
                    }`}
                  >
                    {t("dictation.paragraphN", { n: index + 1 })}
                  </button>
                ))}
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted">{paragraphs[options.paragraphIndex]?.text}</p>
            </fieldset>
          )}

          {options.passageScope === "random" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{t("practice.randomCount")}</span>
              <Button
                variant="secondary"
                aria-label="−"
                disabled={options.randomCount <= 1}
                onClick={() => set("randomCount", Math.max(1, options.randomCount - 1))}
              >
                −
              </Button>
              <span className="w-8 text-center text-lg font-semibold text-foreground" aria-live="polite">
                {Math.min(options.randomCount, paragraphs.length)}
              </span>
              <Button
                variant="secondary"
                aria-label="+"
                disabled={options.randomCount >= paragraphs.length}
                onClick={() => set("randomCount", Math.min(paragraphs.length, options.randomCount + 1))}
              >
                +
              </Button>
              <span className="text-sm text-muted">/ {paragraphs.length}</span>
            </div>
          )}

          {wordCount > 0 && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={options.includeWords}
                onChange={(e) => set("includeWords", e.target.checked)}
                className="size-5 accent-[var(--sd-primary)]"
              />
              {t("practice.includeWords", { count: wordCount })}
            </label>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {showWordOrder && (
          <Segmented
            label={t("practice.order")}
            value={options.order}
            onChange={(v) => set("order", v)}
            options={[
              { value: "sequential", label: t("practice.order.sequential") },
              { value: "random", label: t("practice.order.random") },
            ]}
          />
        )}
        <Segmented
          label={t("practice.speed")}
          value={options.speed}
          onChange={(v) => set("speed", v)}
          options={[
            { value: "slow", label: t("practice.speed.slow") },
            { value: "normal", label: t("practice.speed.normal") },
          ]}
        />
      </div>

      {total === 0 && <p className="text-sm text-danger">{t("practice.noItems")}</p>}

      {/* Starting from a tap also unlocks speech on iPhone / iPad. */}
      <Button className="w-full text-base" disabled={total === 0} onClick={() => onStart(options)}>
        {t("practice.begin")}
      </Button>
    </Card>
  );
}
