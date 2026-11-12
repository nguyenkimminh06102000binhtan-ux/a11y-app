import { useEffect, useRef, useState } from "preact/hooks";
import { FEATURES } from "../features";
import { applyToPage } from "../settings/apply";
import { loadSettings, saveSettings, startingSettings, type Settings } from "../settings/settings";
import { CheckBadge, CloseIcon, FeatureIcon, Mark, ResetIcon } from "./icons";

export function Widget() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>(loadSettings);
    const toggleRef = useRef<HTMLButtonElement>(null);

    const closeRef = useRef<HTMLButtonElement>(null);

    // Opening moves focus into the panel (to Close, its first control), so keyboard and screen reader users
    // start where the settings are; screen readers also announce the "Accessibility settings" region.
    // Closing puts focus back on the launcher (see close()).
    useEffect(() => {
        if (open) closeRef.current?.focus();
    }, [open]);


    function update(next: Settings) {
        setSettings(next);
        saveSettings(next);
        applyToPage(next);
    }

    function close() {
        setOpen(false);
        toggleRef.current?.focus(); // never leave keyboard focus on an element that just disappeared
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape" && open) {
            e.stopPropagation(); // the event would otherwise reach the page and could close the page's own dialogs
            close();
        }
    }

    return (
        <div class="widget" onKeyDown={onKeyDown}>
            {/* Button first in the HTML, so Tab goes button → panel; CSS shows the panel above it */}
            <button
                ref={toggleRef}
                type="button"
                class="toggle"
                aria-expanded={open}
                aria-controls="panel"
                aria-label="Accessibility"
                onClick={() => (open ? close() : setOpen(true))}
            >
                <Mark />
            </button>

            {/* A disclosure, not a modal: no focus trap, and it stays open while the visitor uses the page */}
            <section id="panel" class="panel" aria-labelledby="panel-title" hidden={!open}>
                <div class="panel-header">
                    <Mark class="brand-mark" />
                    <h2 id="panel-title" class="title">Accessibility settings</h2>
                    <button ref={closeRef} type="button" class="close" aria-label="Close" onClick={close}>

                        <CloseIcon />
                    </button>
                </div>
                <div class="panel-body">

                    <ul class="features">
                        {FEATURES.map((f) =>
                            f.kind === "levels" ? (
                                <li key={f.key} class="feature feature-levels" data-feature-id={f.id}>
                                    {/* Native radios in a fieldset: arrow keys move between levels, and the legend names the group */}
                                    <fieldset class="levels" aria-describedby={`${f.key}-hint`}>
                                        <legend class="levels-legend">
                                            <FeatureIcon id={f.id} />
                                            {f.label}
                                        </legend>
                                        <p id={`${f.key}-hint`} class="feature-hint">
                                            {f.hint}
                                        </p>
                                        <div class="level-options">
                                            {f.levels.map((level, i) => (
                                                <label key={level.label} class="level">
                                                    <input
                                                        type="radio"
                                                        name={f.key}
                                                        class="level-input"
                                                        checked={settings[f.key] === i}
                                                        onChange={() => update({ ...settings, [f.key]: i })}
                                                    />
                                                    {/* Short on screen ("150%"); the full name ("Larger (150%)") contains it, for speech input */}
                                                    <span class="level-face">
                                                        <span class="visually-hidden">{level.label}</span>
                                                        <span aria-hidden="true">{level.scale === 1 ? level.label : `${Math.round(level.scale * 100)}%`}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                </li>
                            ) : (
                                <li key={f.key} class="feature tile" data-feature-id={f.id}>
                                    {/* A real checkbox laid over the whole tile: the tile is its click target, and keyboard,
                                        screen readers and forced-colors mode all work as with any checkbox */}
                                    <input
                                        id={f.key}
                                        type="checkbox"
                                        class="tile-input"
                                        checked={settings[f.key]}
                                        aria-describedby={`${f.key}-hint`}
                                        onChange={(e) => update({ ...settings, [f.key]: e.currentTarget.checked })}
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
                            )
                        )}
                    </ul>
                </div>
                <div class="panel-footer">
                    <button type="button" class="reset" onClick={() => update(startingSettings())}>
                        <ResetIcon />
                        Reset all
                    </button>
                </div>

            </section>
        </div>
    );
}
