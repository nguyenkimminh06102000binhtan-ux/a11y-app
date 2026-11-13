"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DEFAULTABLE, DEFAULTABLE_LABELS, onStateColor, type SiteSettings } from "@app/widget-config";
import { saveWidgetSettings, type WidgetSettingsState } from "@/app/actions";


const DEFAULT_STATE_COLOR = "#5b47c8"; // packages/tokens --bcn-state
const IDLE: WidgetSettingsState = { status: "idle" };

/**
 * The widget's settings for one site, in sections (more will come: position, language…).
 * - Errors appear next to their field (aria-invalid + aria-describedby), and focus moves to the first one.
 * - After saving, a status message is announced; the form keeps what was submitted, valid or not.
 * - Works without JavaScript too: it's a plain form posting to a server action.
 */
export function WidgetSettingsForm({ siteId, settings }: { siteId: string; settings: SiteSettings }) {
    const [state, formAction, pending] = useActionState(saveWidgetSettings, IDLE);
    const shown = state.settings ?? settings; // React resets the form after submitting: to these values
    const colorError = state.errors?.stateColor;
    const colorRef = useRef<HTMLInputElement>(null);
    const [previewColor, setPreviewColor] = useState(shown.appearance.stateColor ?? DEFAULT_STATE_COLOR);


    useEffect(() => {
        if (state.errors?.stateColor) colorRef.current?.focus();
    }, [state]);

    return (
        <form action={formAction} className="flex-col items-start gap-6">
            <input type="hidden" name="siteId" value={siteId} />

            <fieldset aria-describedby="color-hint">
                <legend className="mb-1 text-lg font-bold">Appearance</legend>
                <p id="color-hint" className="mb-3 text-sm">
                    The brand color is used for the widget button and for settings that are on. Any color works: icons on it
                    are black or white, whichever reads best, and it&apos;s used for text and borders only where it&apos;s dark
                    enough to read.

                </p>
                <label className="flex items-center gap-2 font-normal">
                    <input type="radio" name="colorChoice" value="default" defaultChecked={!shown.appearance.stateColor} />
                    Our default color (violet)
                </label>
                <label className="flex items-center gap-2 font-normal">
                    <input type="radio" name="colorChoice" value="custom" defaultChecked={!!shown.appearance.stateColor} />
                    A custom brand color
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label htmlFor="stateColor" className="mb-0">
                        Custom brand color
                    </label>
                    <input
                        ref={colorRef}
                        id="stateColor"
                        name="stateColor"
                        type="color"
                        defaultValue={shown.appearance.stateColor ?? DEFAULT_STATE_COLOR}
                        onInput={(event) => setPreviewColor(event.currentTarget.value)}

                        aria-invalid={colorError ? true : undefined}
                        aria-describedby={colorError ? "stateColor-error" : undefined}
                        className="w-20 p-1"
                    />
                    {/* What the widget button will look like: the same black-or-white rule as the widget */}
                    <span className="flex items-center gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="inline-flex size-11 items-center justify-center rounded-full border-[3px] border-surface shadow-md"
                            style={{ background: previewColor, color: onStateColor(previewColor) }}
                        >
                            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5.5 10.5 L8.5 13.5 L14.5 7" />
                            </svg>
                        </span>
                        Preview of the widget button
                    </span>

                </div>
                {colorError && (
                    <p id="stateColor-error" className="mt-2 font-bold text-state">
                        {colorError}
                    </p>
                )}
            </fieldset>

            <fieldset aria-describedby="defaults-hint">
                <legend className="mb-1 text-lg font-bold">On by default</legend>
                <p id="defaults-hint" className="mb-3 text-sm">
                    For visitors who haven&apos;t changed anything yet. They can still turn these off.
                </p>
                {DEFAULTABLE.map((key) => (
                    <label key={key} className="flex items-center gap-2 font-normal">
                        <input type="checkbox" name="defaults" value={key} defaultChecked={shown.defaults.includes(key)} />
                        {DEFAULTABLE_LABELS[key]}
                    </label>
                ))}
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
                <button type="submit">{pending ? "Saving…" : "Save widget settings"}</button>
                {/* Always rendered, so screen readers announce it when the text appears */}
                <p role="status">
                    {state.status === "saved" && "Saved. Visitors get the new settings within about 5 minutes."}
                    {state.status === "invalid" && "Not saved: please fix the field marked above."}
                </p>
            </div>
        </form>
    );
}
