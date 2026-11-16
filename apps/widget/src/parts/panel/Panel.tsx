import { useEffect, useRef, useState } from "preact/hooks";
import type { HideFor } from "../../ui/hide";
import type { PanelContext } from "../../ui/launcher";
import type { Settings } from "../../settings/settings";
import { ActionRow, LevelRow, ProfileTile, ToggleTile } from "./FeatureControls";
import { CloseIcon, HideIcon, Mark, MoveIcon, ResetIcon } from "./icons";

/*
 * The settings panel. A disclosure, not a modal: no focus trap, and it stays open while the visitor uses the page.
 * The launcher (ui/launcher.ts, main script) owns the button, the shortcut, hiding and the settings themselves;
 * everything comes in through `ctx`.
 */
export function Panel({ ctx, open }: { ctx: PanelContext; open: boolean }) {
    const [settings, setSettings] = useState<Settings>(ctx.current);
    const [confirmHide, setConfirmHide] = useState(false);
    const [status, setStatus] = useState("");
    const closeRef = useRef<HTMLButtonElement>(null);
    const hideRef = useRef<HTMLButtonElement>(null);
    const firstChoiceRef = useRef<HTMLButtonElement>(null);

    // The side the button is on, for "Move to the left/right". It can change with the screen width (phones may
    // have their own placement), so it follows the same media query as the CSS.
    const [side, setSide] = useState(ctx.position.side);
    useEffect(() => {
        const media = matchMedia(ctx.position.phone);
        const follow = () => setSide(ctx.position.side());
        media.addEventListener("change", follow);
        return () => media.removeEventListener("change", follow);
    }, []);

    // Opening moves focus into the panel (to Close, its first control), so keyboard and screen reader users start
    // where the settings are; screen readers also announce the "Accessibility settings" region. It also picks up
    // settings changed while it was closed. Closing (the launcher) puts focus back on the button.
    useEffect(() => {
        if (!open) {
            setConfirmHide(false);
            return;
        }
        setSettings(ctx.current());
        closeRef.current?.focus();
    }, [open]);

    // Hide: a short choice in the footer, focus on its first button; Cancel goes back to Hide
    useEffect(() => {
        if (confirmHide) firstChoiceRef.current?.focus();
    }, [confirmHide]);

    function update(next: Settings) {
        setSettings(next);
        ctx.update(next);
    }

    function move() {
        const to = side === "right" ? "left" : "right";
        ctx.position.moveTo(to); // the button and the panel move; focus stays on this button
        setSide(ctx.position.side());
        setStatus(`Moved to the ${to}.`);
    }

    function hide(howLong: HideFor) {
        setConfirmHide(false);
        ctx.hide(howLong);
    }

    const { profiles } = ctx;
    return (
        <section id="panel" class="panel" aria-labelledby="panel-title" hidden={!open}>
            <div class="panel-header">
                <Mark class="brand-mark" />
                <h2 id="panel-title" class="title">Accessibility settings</h2>
                <button ref={closeRef} type="button" class="close" aria-label="Close" onClick={ctx.close}>
                    <CloseIcon />
                </button>
            </div>
            <div class="panel-body">
                {/* Profiles: shortcuts to the settings below, on while all of their settings are in effect */}
                {profiles.list.length > 0 && (
                <div class="section" data-section="profiles">
                    <h3 id="section-profiles" class="section-title">
                        Profiles
                    </h3>
                    <ul class="features" aria-labelledby="section-profiles">
                        {profiles.list.map((p) => (
                            <ProfileTile
                                key={p.id}
                                profile={p}
                                on={profiles.isOn(p, settings)}
                                onChange={(on) => {
                                    update(on ? profiles.turnOn(p, settings) : profiles.turnOff(p, settings, ctx.starting()));
                                    setStatus(on ? `${p.label} on: ${profiles.describe(p)}.` : `${p.label} off.`);
                                }}
                            />
                        ))}
                    </ul>
                </div>
                )}

                {/* One heading per section (the panel title is the h2), so screen reader users can jump between them; each list is named by its heading */}
                {ctx.bySection(ctx.features).map(({ section, items }) => (
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
                            Your settings stay on. Press {ctx.shortcutLabel} to show it again.
                        </p>
                        <div class="hide-actions">
                            <button ref={firstChoiceRef} type="button" class="reset" onClick={() => hide("visit")}>
                                For this visit
                            </button>
                            <button type="button" class="reset" onClick={() => hide("30-days")}>
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
                                update(ctx.starting());
                                ctx.position.reset(); // and the button goes back to the site's own side
                                setSide(ctx.position.side());
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
                        {ctx.allowHide && (
                            <button ref={hideRef} type="button" class="reset" onClick={() => setConfirmHide(true)}>
                                <HideIcon />
                                Hide
                            </button>
                        )}
                    </>
                )}
                <p class="footer-links">
                    {ctx.statementUrl && (
                        <a class="footer-link" href={ctx.statementUrl}>
                            Accessibility statement
                        </a>
                    )}
                    <span class="footer-shortcut">Shortcut: {ctx.shortcutLabel}</span>
                </p>
                {/* Always rendered, so the message is announced when it appears */}
                <p role="status" class="visually-hidden">
                    {status}
                </p>
            </div>
        </section>
    );
}
