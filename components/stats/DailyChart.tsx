"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { accuracy, type DayActivity } from "@/lib/stats/statsCalc";
import { formatDayKey, formatPercent } from "./format";

const HEIGHT = 180;
const TOP = 12;
const BOTTOM = 24; // x labels
const LEFT = 28; // y ticks
const RIGHT = 8;
const MAX_BAR = 24;
/** Minimum horizontal room per x label, in px. */
const LABEL_SPACING = 52;

/** Rounded data-end (4px) at the top, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Clean axis maximum: 4, 5, 10, 20, 25, 50, 100 … */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (value <= step * pow) return step * pow;
  return 10 * pow;
}

/**
 * Single-series column chart: items practised per day. One colour (the theme's chart token),
 * so no legend — the title names the series. Each column has a hover / focus tooltip,
 * and the same numbers are available as a table.
 */
export function DailyChart({ days }: { days: DayActivity[] }) {
  const { t, settings } = useApp();
  const [active, setActive] = useState<number | null>(null);
  // Draw in real pixels (not a scaled viewBox) so text stays 11px on a phone.
  const box = useRef<HTMLDivElement>(null);
  const [WIDTH, setWidth] = useState(640);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = niceMax(Math.max(...days.map((d) => d.items), 0));
  const plotH = HEIGHT - TOP - BOTTOM;
  const band = (WIDTH - LEFT - RIGHT) / days.length;
  // Label every Nth day counting back from today, so labels never collide.
  const labelEvery = Math.max(1, Math.ceil(LABEL_SPACING / band));
  const barW = Math.min(MAX_BAR, band * 0.6);
  const y = (v: number) => TOP + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  const describe = (d: DayActivity) =>
    `${formatDayKey(d.date, settings.locale)}：${
      d.items ? t("progress.tooltip", { items: d.items, correct: d.correct }) : t("progress.tooltipNone")
    }`;

  const activeDay = active === null ? null : days[active];

  return (
    <div>
      <div ref={box} className="relative">
        <svg width={WIDTH} height={HEIGHT} className="block max-w-full" role="img" aria-label={t("progress.chartTitle")}>
          {/* Recessive hairline grid + y ticks */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(v)} y2={y(v)} stroke="var(--sd-border)" strokeWidth={1} />
              <text x={LEFT - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--sd-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {v}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const cx = LEFT + band * i + band / 2;
            const h = (d.items / max) * plotH;
            const label = formatDayKey(d.date, settings.locale);
            const showLabel = (days.length - 1 - i) % labelEvery === 0;
            return (
              <g key={d.date}>
                {d.items > 0 && (
                  <path
                    d={columnPath(cx - barW / 2, y(d.items), barW, h)}
                    fill="var(--sd-chart)"
                    opacity={active === null || active === i ? 1 : 0.55}
                  />
                )}
                {showLabel && (
                  // Labels near the right edge are right-aligned so they never get clipped.
                  <text
                    x={cx + LABEL_SPACING / 2 > WIDTH ? WIDTH - 1 : cx}
                    y={HEIGHT - 6}
                    textAnchor={cx + LABEL_SPACING / 2 > WIDTH ? "end" : "middle"}
                    fontSize={11}
                    fill="var(--sd-muted)"
                  >
                    {label}
                  </text>
                )}
                {/* Hit target: the whole band (bigger than the mark), keyboard focusable */}
                <rect
                  x={LEFT + band * i}
                  y={TOP}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={describe(d)}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none focus-visible:stroke-[var(--sd-primary)]"
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </svg>

        {activeDay && active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-control border border-border bg-surface px-3 py-2 text-xs shadow-card"
            style={{ left: `${((LEFT + band * active + band / 2) / WIDTH) * 100}%` }}
          >
            <p className="text-sm font-semibold text-foreground">
              {activeDay.items ? t("progress.tooltip", { items: activeDay.items, correct: activeDay.correct }) : t("progress.tooltipNone")}
            </p>
            <p className="text-muted">
              {formatDayKey(activeDay.date, settings.locale)}
              {activeDay.items > 0 && ` · ${formatPercent(accuracy(activeDay.correct, activeDay.items), settings.locale)}`}
            </p>
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-primary">{t("progress.tableToggle")}</summary>
        <table className="mt-2 w-full text-left" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 font-medium">{t("progress.colDate")}</th>
              <th className="py-1 text-right font-medium">{t("progress.colItems")}</th>
              <th className="py-1 text-right font-medium">{t("progress.colCorrect")}</th>
              <th className="py-1 text-right font-medium">{t("progress.colRate")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {[...days].reverse().map((d) => (
              <tr key={d.date}>
                <td className="py-1">{formatDayKey(d.date, settings.locale)}</td>
                <td className="py-1 text-right">{d.items}</td>
                <td className="py-1 text-right">{d.correct}</td>
                <td className="py-1 text-right">{formatPercent(accuracy(d.correct, d.items), settings.locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
