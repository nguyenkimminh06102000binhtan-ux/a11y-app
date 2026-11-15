import type { LevelFeature, ToggleFeature } from "../features";
import { CheckBadge, FeatureIcon } from "./icons";

/** A level setting across the panel's width: native radios in a fieldset, so arrow keys move between levels and the legend names the group. */
export function LevelRow({ feature: f, level, onChange }: { feature: LevelFeature; level: number; onChange: (level: number) => void }) {
    return (
        <li class="feature feature-levels" data-feature-id={f.id}>
            <fieldset class="levels" aria-describedby={`${f.key}-hint`}>
                <legend class="levels-legend">
                    <FeatureIcon id={f.id} />
                    {f.label}
                </legend>
                <p id={`${f.key}-hint`} class="feature-hint">
                    {f.hint}
                </p>
                <div class="level-options" style={{ "--levels": String(f.levels.length) }}>
                    {f.levels.map((l, i) => (
                        <label key={l.label} class="level">
                            <input type="radio" name={f.key} class="level-input" checked={level === i} onChange={() => onChange(i)} />
                            {/* Short on screen ("150%"); the full name ("Larger (150%)") contains it, for speech input */}
                            <span class="level-face">
                                <span class="visually-hidden">{l.label}</span>
                                <span aria-hidden="true">{l.short}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
        </li>
    );
}

/**
 * An on/off tile. A real checkbox laid over the whole tile: the tile is its click target, and keyboard, screen
 * readers and forced-colors mode all work as with any checkbox.
 */
export function ToggleTile({ feature: f, on, onChange }: { feature: ToggleFeature; on: boolean; onChange: (on: boolean) => void }) {
    return (
        <li class="feature tile" data-feature-id={f.id}>
            <input
                id={f.key}
                type="checkbox"
                class="tile-input"
                checked={on}
                aria-describedby={`${f.key}-hint`}
                onChange={(e) => onChange(e.currentTarget.checked)}
            />
            <div class="tile-face">
                <CheckBadge />
                <FeatureIcon id={f.id} />
                <label for={f.key} class="tile-label">
                    {f.label}
                </label>
                <p id={`${f.key}-hint`} class="feature-hint">
                    {f.hint}
                </p>
            </div>
        </li>
    );
}
