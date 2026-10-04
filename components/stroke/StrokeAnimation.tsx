"use client";

import { useEffect, useRef, useState } from "react";
// Static import (not dynamic): it ships with the practice page bundle, which the service worker
// precaches — so stroke animations also work offline.
import HanziWriter from "hanzi-writer";
import { strokeDataSource } from "@/lib/stroke/localStrokeData";
import { isHanzi } from "@/lib/stroke/types";

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Shows the text with a stroke-order animation for every Chinese character, played one after another.
 * Tap a character to replay it. Characters without stroke data (or non-Chinese text) are shown as plain text.
 */
export function StrokeAnimation({ text, hint }: { text: string; hint?: string }) {
  const chars = [...text];
  const hanziCount = chars.filter(isHanzi).length;
  const size = hanziCount > 8 ? 52 : hanziCount > 4 ? 64 : 84;

  const boxes = useRef<(HTMLDivElement | null)[]>([]);
  const writers = useRef<(HanziWriter | null)[]>([]);
  const [missing, setMissing] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const created: HanziWriter[] = [];

    (async () => {
      const colors = {
        strokeColor: cssVar("--sd-foreground"),
        radicalColor: cssVar("--sd-primary"),
        outlineColor: cssVar("--sd-border"),
      };

      writers.current = chars.map((char, index) => {
        const el = boxes.current[index];
        if (!el || !isHanzi(char)) return null;
        el.innerHTML = "";
        const writer = HanziWriter.create(el, char, {
          width: size,
          height: size,
          padding: 4,
          showCharacter: false,
          showOutline: true,
          strokeAnimationSpeed: 1.2,
          delayBetweenStrokes: 120,
          ...colors,
          charDataLoader: (c, onLoad, onError) => {
            strokeDataSource.load(c).then((data) => (data ? onLoad(data as Parameters<typeof onLoad>[0]) : onError()));
          },
          onLoadCharDataError: () => {
            if (!cancelled) setMissing((prev) => new Set(prev).add(index));
          },
        });
        created.push(writer);
        return writer;
      });

      // Play every character in order.
      for (const writer of writers.current) {
        if (cancelled) return;
        if (writer) await writer.animateCharacter().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
      for (const writer of created) writer.pauseAnimation();
      writers.current = [];
    };
    // Re-create only when the text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-1">
        {chars.map((char, index) =>
          isHanzi(char) && !missing.has(index) ? (
            <button
              key={index}
              type="button"
              aria-label={char}
              onClick={() => writers.current[index]?.animateCharacter()}
              className="rounded-md border border-border bg-surface"
              style={{
                width: size + 2,
                height: size + 2,
                // 田字格 guide lines
                backgroundImage:
                  "linear-gradient(var(--sd-border), var(--sd-border)), linear-gradient(90deg, var(--sd-border), var(--sd-border))",
                backgroundSize: "100% 1px, 1px 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <div ref={(el) => void (boxes.current[index] = el)} />
            </button>
          ) : (
            <span
              key={index}
              className="flex items-center justify-center text-foreground"
              style={{ minWidth: char.trim() ? size * 0.5 : size * 0.25, height: size + 2, fontSize: size * 0.6 }}
            >
              {char}
            </span>
          ),
        )}
      </div>
      {hint && hanziCount > 0 && <p className="mt-1 text-center text-xs text-muted">{hint}</p>}
    </div>
  );
}
