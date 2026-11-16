"use client";

import { useActionState, useEffect, useState } from "react";
import { CATALOG, PROFILES, bySection, profileHiddenBecause, type SiteSettings } from "@app/widget-config";
import { saveWidgetFeatures, type WidgetFeaturesState } from "@/app/actions";
import { toast } from "@/components/ui/Toaster";

const IDLE: WidgetFeaturesState = { status: "idle" };

/**
 * One row per feature: stacked when the form is narrow; three aligned columns (name, Show in panel, On by default)
 * once the form itself is wide enough (a container query: the menus beside it take part of the screen).
 */
const ROW = "grid grid-cols-1 items-center gap-x-6 gap-y-1 border-b border-line py-2 @2xl:grid-cols-[minmax(10rem,1fr)_10rem_17rem]";

/**
 * Widget › Features. Grouped like the widget's panel, with its words. For each feature: "Show in panel", and for
 * settings "On by default" (a checkbox, or a level). A hidden feature can't be on by default: its control is
 * disabled while it's hidden. A profile shows only when all of its settings are shown; the page says why not.
 * Every control's name (aria-label) starts with its visible words, then the feature ("Show in panel: Text size"),
 * so speech input users can say what they see.
 */
export function FeaturesForm({ siteId, settings }: { siteId: string; settings: SiteSettings }) {
    const [state, formAction, pending] = useActionState(saveWidgetFeatures, IDLE);
    const shown = state.settings ?? settings; // React resets the form after submitting: to these values
    const [hiddenFeatures, setHiddenFeatures] = useState(() => new Set(shown.hidden.features));

    useEffect(() => {
        if (state.status === "saved") toast("Saved. Visitors see the changes on their next page view.");
    }, [state]);

    const toggleShown = (id: string, show: boolean) =>
        setHiddenFeatures((before) => {
            const next = new Set(before);
            if (show) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <form action={formAction} className="@container w-full flex-col items-start gap-6">
            <input type="hidden" name="siteId" value={siteId} />
            <p className="m-0 max-w-2xl">
                Choose what visitors see in the widget&apos;s panel, and what&apos;s on before they change anything. Visitors can still
                change what&apos;s on.
            </p>

            {bySection(CATALOG).map(({ section, items }) => (
                <fieldset key={section.id} className="w-full max-w-3xl">
                    <legend className="mb-1 text-lg font-bold">{section.label}</legend>
                    <ul role="list" className="m-0 flex list-none flex-col p-0">
                        {items.map((entry) => {
                            const isHidden = hiddenFeatures.has(entry.id);
                            return (
                                <li key={entry.id} className={ROW}>
                                    <span className="font-bold">{entry.label}</span>
                                    <label className="flex min-h-11 items-center gap-2 font-normal">
                                        <input
                                            type="checkbox"
                                            name="show"
                                            value={entry.id}
                                            defaultChecked={!shown.hidden.features.includes(entry.id)}
                                            onChange={(event) => toggleShown(entry.id, event.target.checked)}
                                            aria-label={`Show in panel: ${entry.label}`}
                                        />
                                        Show in panel
                                    </label>
                                    <DefaultControl entry={entry} settings={shown} disabled={isHidden} />
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>
            ))}

            <fieldset className="w-full max-w-3xl">
                <legend className="mb-1 text-lg font-bold">Profiles</legend>
                <p className="mb-2 text-sm">One-tap groups of settings. A profile shows only when all of its settings are shown.</p>
                <ul role="list" className="m-0 flex list-none flex-col p-0">
                    {PROFILES.map((profile) => {
                        const because = profileHiddenBecause(profile, { features: [...hiddenFeatures], profiles: [] });
                        return (
                            <li key={profile.id} className={ROW}>
                                <span className="font-bold">{profile.label}</span>
                                <label className="flex min-h-11 items-center gap-2 font-normal">
                                    <input
                                        type="checkbox"
                                        name="showProfile"
                                        value={profile.id}
                                        defaultChecked={!shown.hidden.profiles.includes(profile.id)}
                                        aria-describedby={because ? `why-${profile.id}` : undefined}
                                        aria-label={`Show in panel: ${profile.label}`}
                                    />
                                    Show in panel
                                </label>
                                {because && (
                                    <p id={`why-${profile.id}`} className="col-span-full m-0 text-sm">
                                        Not shown: {because}.
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </fieldset>

            <fieldset className="w-full max-w-3xl">
                <legend className="mb-1 text-lg font-bold">Visitors</legend>
                <label className="flex min-h-11 items-center gap-2 font-normal">
                    <input type="checkbox" name="allowHide" defaultChecked={shown.visitors.allowHide} aria-describedby="allow-hide-hint" />
                    Let visitors hide the accessibility button
                </label>
                <p id="allow-hide-hint" className="m-0 text-sm">
                    For this visit or 30 days. They can always bring it back with Alt+A (Option+A on Mac).
                </p>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
                <button type="submit">{pending ? "Saving…" : "Save features"}</button>
            </div>
        </form>
    );
}

type Entry = (typeof CATALOG)[number];

/** On by default: a checkbox for on/off settings, a choice of level for level settings, nothing for actions. */
function DefaultControl({ entry, settings, disabled }: { entry: Entry; settings: SiteSettings; disabled: boolean }) {
    if (entry.kind === "action") return null;
    if (entry.key === "readAloud") return <span className="text-sm">Visitors turn it on</span>;
    const value = (settings.defaults as Record<string, true | number | undefined>)[entry.key];
    const name = `default-${entry.key}`;
    if (entry.kind === "toggle") {
        return (
            <label className={`flex min-h-11 items-center gap-2 font-normal ${disabled ? "opacity-50" : ""}`}>
                <input type="checkbox" name={name} defaultChecked={value === true} disabled={disabled} aria-label={`On by default: ${entry.label}`} />
                On by default
            </label>
        );
    }
    const id = `default-${entry.id}`;
    return (
        <span className="flex items-center gap-2">
            <label htmlFor={id} className="mb-0 font-normal">
                On by default
            </label>
            <select
                id={id}
                name={name}
                defaultValue={String(typeof value === "number" ? value : 0)}
                disabled={disabled}
                aria-label={`On by default: ${entry.label}`}
                className="min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {entry.levels.map((level, i) => (
                    <option key={level.label} value={i}>
                        {i === 0 ? "Off" : level.label}
                    </option>
                ))}
            </select>
        </span>
    );
}
