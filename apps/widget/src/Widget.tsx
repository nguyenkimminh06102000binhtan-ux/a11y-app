import { useRef, useState } from "preact/hooks";
import { FEATURES } from "./features";
import { applyToPage } from "./page-styles";
import { DEFAULTS, loadSettings, saveSettings, type Settings } from "./settings";

export function Widget() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>(loadSettings);
    const toggleRef = useRef<HTMLButtonElement>(null);

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
                onClick={() => setOpen(!open)}
            >
                Accessibility
            </button>

            {/* A disclosure, not a modal: no focus trap, and it stays open while the visitor uses the page */}
            <section id="panel" class="panel" aria-labelledby="panel-title" hidden={!open}>
                <div class="panel-header">
                    <h2 id="panel-title" class="title">Accessibility settings</h2>
                    <button type="button" class="close" onClick={close}>
                        Close
                    </button>
                </div>

                <ul class="features">
                    {FEATURES.map((f) =>
                        f.kind === "levels" ? (
                            <li key={f.key} class="feature">
                                {/* Native radios in a fieldset: arrow keys move between levels, and the legend names the group */}
                                <fieldset class="levels" aria-describedby={`${f.key}-hint`}>
                                    <legend class="feature-label">{f.label}</legend>
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
                                                {level.label}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            </li>
                        ) : (
                            <li key={f.key} class="feature">
                                <input
                                    id={f.key}
                                    type="checkbox"
                                    class="feature-input"
                                    checked={settings[f.key]}
                                    aria-describedby={`${f.key}-hint`}
                                    onChange={(e) => update({ ...settings, [f.key]: e.currentTarget.checked })}
                                />
                                <label for={f.key} class="feature-label">
                                    {f.label}
                                </label>
                                <p id={`${f.key}-hint`} class="feature-hint">
                                    {f.hint}
                                </p>
                            </li>
                        )
                    )}

                </ul>

                <button type="button" class="reset" onClick={() => update({ ...DEFAULTS })}>
                    Reset all
                </button>
            </section>
        </div>
    );
}
