import { useEffect, useRef, useState } from "preact/hooks";
import { PROFILES, bySection } from "@app/widget-config";
import { FEATURES } from "../features";
import { applyToPage } from "../settings/apply";
import { loadSettings, saveSettings, startingSettings, type Settings } from "../settings/settings";
import { describe, isOn, turnOff, turnOn } from "../settings/profiles";
import { ActionRow, LevelRow, ProfileTile, ToggleTile } from "./FeatureControls";
import { AccessibilityIcon, CloseIcon, Mark, MoveIcon, ResetIcon } from "./icons";
import { PHONE, moveTo, resetSide, visibleSide } from "./position";


export function Widget() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>(loadSettings);
    const toggleRef = useRef<HTMLButtonElement>(null);

    const closeRef = useRef<HTMLButtonElement>(null);

    // The side the button is on, for "Move to the left/right". It can change with the screen width (phones may
    // have their own placement), so it follows the same media query as the CSS.
    const [side, setSide] = useState(visibleSide);
    const [status, setStatus] = useState("");
    useEffect(() => {
        const media = matchMedia(PHONE);
        const follow = () => setSide(visibleSide());
        media.addEventListener("change", follow);
        return () => media.removeEventListener("change", follow);
    }, []);

    function move() {
        const to = side === "right" ? "left" : "right";
        moveTo(to); // the button and the panel move; focus stays on this button
        setSide(visibleSide());
        setStatus(`Moved to the ${to}.`);
    }

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
                <AccessibilityIcon />
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
                    {/* Profiles: shortcuts to the settings below, on while all of their settings are in effect */}
                    <div class="section" data-section="profiles">
                        <h3 id="section-profiles" class="section-title">
                            Profiles
                        </h3>
                        <ul class="features" aria-labelledby="section-profiles">
                            {PROFILES.map((p) => (
                                <ProfileTile
                                    key={p.id}
                                    profile={p}
                                    on={isOn(p, settings)}
                                    onChange={(on) => {
                                        update(on ? turnOn(p, settings) : turnOff(p, settings, startingSettings()));
                                        setStatus(on ? `${p.label} on: ${describe(p)}.` : `${p.label} off.`);
                                    }}
                                />
                            ))}
                        </ul>
                    </div>

                    {/* One heading per section (the panel title is the h2), so screen reader users can jump between them; each list is named by its heading */}
                    {bySection(FEATURES).map(({ section, items }) => (
                        <div key={section.id} class="section" data-section={section.id}>
                            <h3 id={`section-${section.id}`} class="section-title">
                                {section.label}
                            </h3>
                            <ul class="features" aria-labelledby={`section-${section.id}`}>
                                {items.map((f) =>
                                    f.kind === "action" ? (
                                        <ActionRow key={f.id} feature={f} />
                                    ) : f.kind === "levels" ? (
                                        <LevelRow key={f.key} feature={f} level={settings[f.key]} onChange={(level) => update({ ...settings, [f.key]: level })} />
                                    ) : (
                                        <ToggleTile key={f.key} feature={f} on={settings[f.key]} onChange={(on) => update({ ...settings, [f.key]: on })} />
                                    )
                                )}
                            </ul>
                        </div>
                    ))}
                </div>
                <div class="panel-footer">
                    <button
                        type="button"
                        class="reset"
                        onClick={() => {
                            update(startingSettings());
                            resetSide(); // and the button goes back to the site's own side
                            setSide(visibleSide());
                            setStatus("");
                        }}
                    >
                        <ResetIcon />
                        Reset all
                    </button>
                    {/* Says where it goes. Moving keeps the panel open, with focus here */}
                    <button type="button" class="reset" onClick={move}>
                        <MoveIcon to={side === "right" ? "left" : "right"} />
                        Move to the {side === "right" ? "left" : "right"}
                    </button>
                    {/* Always rendered, so the message is announced when it appears */}
                    <p role="status" class="visually-hidden">
                        {status}
                    </p>
                </div>

            </section>
        </div>
    );
}
