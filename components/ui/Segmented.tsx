"use client";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Radio group rendered as large tappable segments. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">{label}</legend>
      <div className="grid grid-flow-col auto-cols-fr gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-11 rounded-control border px-3 py-2 text-left text-sm transition-colors ${
                selected ? "border-primary bg-primary-soft text-foreground ring-2 ring-primary" : "border-border bg-surface text-foreground"
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              {option.description && <span className="mt-0.5 block text-xs text-muted">{option.description}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
