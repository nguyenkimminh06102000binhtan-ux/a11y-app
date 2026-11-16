import { useEffect, useRef, useState } from "preact/hooks";
import { PROFILES, bySection } from "@app/widget-config";
import { FEATURES } from "../features";
import { applyToPage } from "../settings/apply";
import { loadSettings, saveSettings, startingSettings, type Settings } from "../settings/settings";
import { describe, isOn, turnOff, turnOn } from "../settings/profiles";
import { ActionRow, LevelRow, ProfileTile, ToggleTile } from "./FeatureControls";
import { AccessibilityIcon, CloseIcon, HideIcon, Mark, MoveIcon, ResetIcon } from "./icons";
import { PHONE, moveTo, resetSide, visibleSide } from "./position";
import { hide, isHidden, unhide, type HideFor } from "./hide";
import { HOST_TAG } from "../core/host";
import { SHORTCUT_ARIA, SHORTCUT_LABEL, isShortcut } from "./shortcut";

const NOTICE_MS = 8000;

/** The page element that had focus (not ours), to go back to after the panel closes by shortcut or is hidden. */
function pageFocus(): HTMLElement | null {
    const el = document.activeElement;
    return el instanceof HTMLElement && el !== document.body && el.localName !== HOST_TAG ? el : null;
}

export function Widget({ statementUrl }: { statementUrl?: string }) {
    const [open, setOpen] = useState(false);
    const [hidden, setHidden] = useState(isHidden);
    const [confirmHide, setConfirmHide] = useState(false);
    const [notice, setNotice] = useState(false);
    const returnTo = useRef<HTMLElement | null>(null);
    const hideRef = useRef<HTMLButtonElement>(null);
    const firstChoiceRef = useRef<HTMLButtonElement>(null);
    const noticeRef = useRef<HTMLParagraphElement>(null);
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

    function openPanel() {
        returnTo.current = pageFocus();
        setOpen(true);
    }

    function close() {
        setOpen(false);
        setConfirmHide(false);
        toggleRef.current?.focus(); // never leave keyboard focus on an element that just disappeared
    }

    // Alt+A (Option+A on Mac), from anywhere: open, or close back to where the visitor was; brings a hidden button back
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isShortcut(e)) return;
            e.preventDefault();
            if (hidden) {
                unhide();
                setHidden(false);
                setNotice(false);
                openPanel();
            } else if (open) {
                setOpen(false);
                setConfirmHide(false);
                const back = returnTo.current;
                (back?.isConnected ? back : toggleRef.current)?.focus();
            } else openPanel();
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, [open, hidden]);

    // Hide: a short choice in the footer, focus on its first button; Cancel goes back to Hide
    useEffect(() => {
        if (confirmHide) firstChoiceRef.current?.focus();
    }, [confirmHide]);

    function hideFor(howLong: HideFor) {
        hide(howLong);
        setConfirmHide(false);
        setOpen(false);
        setHidden(true);
        setNotice(true);
    }

    // After hiding: focus back to the page where the visitor was (else on the notice), and the notice goes after a while
    useEffect(() => {
        if (!notice) return;
        const back = returnTo.current;
        if (back?.isConnected) back.focus();
        else noticeRef.current?.focus();
        const timer = setTimeout(() => setNotice(false), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice]);

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
                aria-keyshortcuts={SHORTCUT_ARIA}
                hidden={hidden}
                onClick={() => (open ? close() : openPanel())}
            >
                <AccessibilityIcon />
            </button>

            {/* Always rendered, so the message is announced when it appears; shown where the button was */}
            <p ref={noticeRef} role="status" class={notice ? "hidden-notice" : "visually-hidden"} tabIndex={notice ? -1 : undefined}>
                {notice && `Accessibility button hidden. Press ${SHORTCUT_LABEL} to show it again.`}
            </p>

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
                    {confirmHide ? (
                        <div class="hide-choice" role="group" aria-labelledby="hide-title" aria-describedby="hide-hint">
                            <p id="hide-title" class="hide-title">
                                Hide the accessibility button?
                            </p>
                            <p id="hide-hint" class="feature-hint">
                                Your settings stay on. Press {SHORTCUT_LABEL} to show it again.
                            </p>
                            <div class="hide-actions">
                                <button ref={firstChoiceRef} type="button" class="reset" onClick={() => hideFor("visit")}>
                                    For this visit
                                </button>
                                <button type="button" class="reset" onClick={() => hideFor("30-days")}>
                                    For 30 days
                                </button>
                                <button
                                    type="button"
                                    class="reset"
                                    onClick={() => {
                                        setConfirmHide(false);
                                        requestAnimationFrame(() => hideRef.current?.focus());
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
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
                            <button ref={hideRef} type="button" class="reset" onClick={() => setConfirmHide(true)}>
                                <HideIcon />
                                Hide
                            </button>
                        </>
                    )}
                    <p class="footer-links">
                        {statementUrl && (
                            <a class="footer-link" href={statementUrl}>
                                Accessibility statement
                            </a>
                        )}
                        <span class="footer-shortcut">Shortcut: {SHORTCUT_LABEL}</span>
                    </p>
                    {/* Always rendered, so the message is announced when it appears */}
                    <p role="status" class="visually-hidden">
                        {status}
                    </p>
                </div>

            </section>
        </div>
    );
}
