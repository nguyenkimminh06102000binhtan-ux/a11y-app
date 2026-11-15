"use client";

import { MAX_OFFSET, SPOT_LABELS, isMiddle, type Spot } from "@app/widget-config";
import type { WidgetSettingsField } from "@/app/actions";

/** What the form holds while editing: distances as typed (so a wrong value stays visible next to its error). */
export type PlacementDraft = { spot: Spot; side: string; edge: string };

/** In reading order, so the radio group's arrow keys go left to right, then down, like the grid looks. */
const GRID: Spot[] = ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"];

type Props = {
  prefix: "desktop" | "phone";
  /** "On computers and tablets" / "On phones" */
  legend: string;
  value: PlacementDraft;
  onChange: (next: PlacementDraft) => void;
  errors: Partial<Record<WidgetSettingsField, string>>;
};

/**
 * One placement: a radio group drawn as a small screen (the chosen spot is highlighted where the button will be),
 * then the distances, labelled for the chosen spot ("Distance from the right"). Middle spots are centered
 * vertically, so they only ask for the side distance.
 */
export function PositionFields({ prefix, legend, value, onChange, errors }: Props) {
  const [y, x] = value.spot.split("-") as ["top" | "middle" | "bottom", "left" | "right"];
  const field = (name: "Spot" | "Side" | "Edge") => `${prefix}${name}` as WidgetSettingsField;
  const error = (name: "Spot" | "Side" | "Edge") => errors[field(name)];

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 font-bold">{legend}</legend>

      <fieldset aria-describedby={error("Spot") ? `${field("Spot")}-error` : undefined}>
        <legend className="mb-1 text-small">Where the button sits</legend>
        {/* A small screen: two columns, three rows */}
        <div className="grid max-w-sm grid-cols-2 gap-1 rounded-xl border-[1.5px] border-frame bg-subtle p-1.5">
          {GRID.map((spot) => {
            const checked = value.spot === spot;
            const right = spot.endsWith("right");
            return (
              <label
                key={spot}
                className={`m-0 flex min-h-11 items-center gap-2 rounded-lg px-2 font-normal ${right ? "flex-row-reverse text-right" : ""} ${
                  checked ? "bg-surface font-bold" : ""
                }`}
              >
                {/* defaultChecked, not checked: React resets the form after saving, back to these defaults */}
                <input
                  type="radio"
                  name={field("Spot")}
                  value={spot}
                  defaultChecked={checked}
                  onChange={() => onChange({ ...value, spot })}
                />
                <span className="min-w-0 flex-1">{SPOT_LABELS[spot]}</span>
              </label>
            );
          })}
        </div>
        {error("Spot") && <FieldError id={`${field("Spot")}-error`}>{error("Spot")}</FieldError>}
      </fieldset>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Distance
          id={field("Side")}
          label={`Distance from the ${x}`}
          value={value.side}
          onChange={(side) => onChange({ ...value, side })}
          error={error("Side")}
        />
        {isMiddle(value.spot) ? (
          <p className="m-0 max-w-56 self-end text-small text-muted">Centered on the screen&apos;s height.</p>
        ) : (
          <Distance
            id={field("Edge")}
            label={`Distance from the ${y}`}
            value={value.edge}
            onChange={(edge) => onChange({ ...value, edge })}
            error={error("Edge")}
          />
        )}
      </div>
    </fieldset>
  );
}

function Distance({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const hint = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="m-0">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_OFFSET}
          step={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error ${hint}` : hint}
          className="w-24"
        />
        <span id={hint} className="text-small text-muted">
          pixels, 0 to {MAX_OFFSET}
        </span>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="m-0 mt-1 font-bold">
      <span aria-hidden="true">⚠ </span>
      {children}
    </p>
  );
}
