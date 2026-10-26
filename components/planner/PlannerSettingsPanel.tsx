"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { errorMessage, type MessageKey } from "@/lib/i18n";
import type { PlannerOptions } from "@/lib/planner/PlannerService";
import { PLANNER_COLORS, TASK_LIMITS, type PlannerColor } from "@/types";
import { COLOR_HEX, categoryName, subjectName } from "./plannerUi";

const ICON_CHOICES = ["⭐", "🎹", "🏃", "🎨", "⚽", "🏊", "💊", "🎻", "🧪", "📌"];

/** Owner Settings → task categories and subjects: built-ins fixed, the family adds its own. */
export function PlannerSettingsPanel() {
  const { t, services, dataVersion } = useApp();
  const [options, setOptions] = useState<PlannerOptions | null>(null);

  const reload = useCallback(() => services.planner.options().then(setOptions), [services]);
  useEffect(() => {
    services.planner.options().then(setOptions);
  }, [services, dataVersion]);

  if (!options) return null;

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("plannerSettings.title")}</h3>
        <p className="text-xs text-muted">{t("plannerSettings.intro")}</p>
      </div>

      <Group
        title={t("plannerSettings.categories")}
        items={options.categories.map((c) => ({ id: c.id, builtIn: c.builtIn, label: `${c.icon} ${categoryName(t, c)}`, color: c.color }))}
        onRemove={async (id) => {
          await services.planner.removeCategory(id);
          await reload();
        }}
        removeHint={t("plannerSettings.removeCategoryHint")}
        withIcon
        onAdd={async (name, color, icon) => {
          await services.planner.addCategory(name, icon, color);
          await reload();
        }}
      />

      <Group
        title={t("plannerSettings.subjects")}
        items={options.subjects.map((s) => ({ id: s.id, builtIn: s.builtIn, label: subjectName(t, s), color: s.color }))}
        onRemove={async (id) => {
          await services.planner.removeSubject(id);
          await reload();
        }}
        removeHint={t("plannerSettings.removeSubjectHint")}
        onAdd={async (name, color) => {
          await services.planner.addSubject(name, color);
          await reload();
        }}
      />
    </section>
  );
}

function Group({
  title,
  items,
  withIcon = false,
  removeHint,
  onAdd,
  onRemove,
}: {
  title: string;
  items: { id: string; builtIn: boolean; label: string; color: PlannerColor }[];
  withIcon?: boolean;
  removeHint: string;
  onAdd: (name: string, color: PlannerColor, icon: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t } = useApp();
  const [name, setName] = useState("");
  const [color, setColor] = useState<PlannerColor>("teal");
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      await onAdd(name, color, icon);
      setName("");
      setError(null);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface pr-1 pl-3 text-sm text-foreground">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[item.color] }} />
            {item.label}
            {!item.builtIn &&
              (confirming === item.id ? (
                <button
                  type="button"
                  onClick={() => onRemove(item.id).then(() => setConfirming(null))}
                  className="ml-1 rounded-full bg-danger px-2 text-xs text-on-primary"
                >
                  {t("plannerSettings.confirmRemove")}
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={t("plannerSettings.remove", { name: item.label })}
                  onClick={() => setConfirming(item.id)}
                  className="flex size-7 items-center justify-center rounded-full text-muted hover:text-danger"
                >
                  ✕
                </button>
              ))}
            {item.builtIn && <span className="pr-2" />}
          </li>
        ))}
      </ul>
      {confirming && <p className="text-xs text-muted">{removeHint}</p>}

      <form onSubmit={add} className="space-y-2 rounded-control bg-surface-muted p-3">
        <div className="flex gap-2">
          {withIcon && (
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              aria-label={t("plannerSettings.icon")}
              className="min-h-11 rounded-control border border-border bg-surface px-2 text-lg"
            >
              {ICON_CHOICES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          )}
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(withIcon ? "plannerSettings.newCategory" : "plannerSettings.newSubject")}
            aria-label={t(withIcon ? "plannerSettings.newCategory" : "plannerSettings.newSubject")}
            maxLength={TASK_LIMITS.categoryNameMaxLength}
          />
          <Button type="submit" disabled={!name.trim()}>
            {t("plannerSettings.add")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("plannerSettings.color")}>
          {PLANNER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={t(`color.${c}` as MessageKey)}
              onClick={() => setColor(c)}
              className={`size-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: COLOR_HEX[c] }}
            />
          ))}
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </div>
  );
}
