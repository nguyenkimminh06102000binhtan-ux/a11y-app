import { PROFILES, bySection } from "@app/widget-config";
import { FEATURES, type Feature } from "../features";
import { HOST_TAG } from "../core/host";
import { loadPart } from "../core/parts";
import { applyToPage } from "../settings/apply";
import { describe, isOn, turnOff, turnOn } from "../settings/profiles";
import { loadSettings, saveSettings, startingSettings, type Settings } from "../settings/settings";
import { hide, isHidden, unhide, type HideFor } from "./hide";
import { PHONE, moveTo, resetSide, visibleSide, type Side } from "./position";
import { SHORTCUT_ARIA, SHORTCUT_LABEL, isShortcut } from "./shortcut";

/*
 * The launcher: the button visitors see on every page, with the Alt+A shortcut and Hide. Plain DOM, so the main
 * script carries no UI library. The panel (Preact and all its UI) is a part, parts/panel/: downloaded and mounted
 * (closed) once the page is idle, so the first click is normally instant; with Save data on, on the first click.
 * The settings live here, not in the panel: the panel gets them, and everything else it needs, in PanelContext.
 */

const NOTICE_MS = 8000;

/** What the launcher lends the panel. */
export type PanelContext = {
    root: HTMLElement; // render into this (inside .widget, after the button)
    features: Feature[];
    profiles: { list: typeof PROFILES; isOn: typeof isOn; turnOn: typeof turnOn; turnOff: typeof turnOff; describe: typeof describe };
    bySection: typeof bySection;
    current(): Settings;
    update(next: Settings): void; // save and apply
    starting(): Settings; // our defaults plus the owner's: Reset all goes back here
    close(): void; // close the panel, focus back on the launcher
    hide(howLong: HideFor): void;
    position: { phone: string; side(): Side; moveTo(to: Side): void; reset(): void };
    shortcutLabel: string;
    statementUrl?: string;
};

/** What the panel part hands over. */
export type PanelPart = { mount(context: PanelContext): PanelHandle };
export type PanelHandle = { setOpen(open: boolean): void }; // opening focuses its Close button

const ACCESSIBILITY_ICON = `<svg class="icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle class="solid" cx="16" cy="7.4" r="2.9"/><path class="solid" d="M7 11.4 H25 A1.5 1.5 0 0 1 25 14.4 H19.2 V19.4 L21.9 26.4 A1.6 1.6 0 0 1 18.9 27.6 L16 20.9 L13.1 27.6 A1.6 1.6 0 0 1 10.1 26.4 L12.8 19.4 V14.4 H7 A1.5 1.5 0 0 1 7 11.4 Z"/></svg>`;

/** The page element that had focus (not ours), to go back to after the panel closes by shortcut or is hidden. */
function pageFocus(): HTMLElement | null {
    const el = document.activeElement;
    return el instanceof HTMLElement && el !== document.body && el.localName !== HOST_TAG ? el : null;
}

export function mountLauncher(container: HTMLElement, { statementUrl }: { statementUrl?: string }): void {
    const widget = document.createElement("div");
    widget.className = "widget";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "panel");
    toggle.setAttribute("aria-label", "Accessibility");
    toggle.setAttribute("aria-keyshortcuts", SHORTCUT_ARIA);
    toggle.innerHTML = ACCESSIBILITY_ICON;
    // Always in the page, so its message is announced when it appears; shown where the button was
    const notice = document.createElement("p");
    notice.setAttribute("role", "status");
    notice.className = "visually-hidden";
    const root = document.createElement("div");
    root.style.display = "contents"; // the panel's place: no box of its own
    widget.append(toggle, notice, root); // button first, so Tab goes button → panel
    container.append(widget);

    let open = false;
    let hidden = isHidden();
    let current = loadSettings();
    let returnTo: HTMLElement | null = null;
    let panel: Promise<PanelHandle | null> | null = null;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    toggle.hidden = hidden;

    const context: PanelContext = {
        root,
        features: FEATURES,
        profiles: { list: PROFILES, isOn, turnOn, turnOff, describe },
        bySection,
        current: () => current,
        update(next) {
            current = next;
            saveSettings(next);
            applyToPage(next);
        },
        starting: startingSettings,
        close: () => setOpen(false, toggle),
        hide: hideFor,
        position: { phone: PHONE, side: visibleSide, moveTo, reset: resetSide },
        shortcutLabel: SHORTCUT_LABEL,
        statementUrl,
    };

    /** Download and mount the panel (closed), once. Null if it can't load. */
    function ensurePanel(): Promise<PanelHandle | null> {
        panel ??= loadPart<PanelPart>("panel").then((part) => (part ? part.mount(context) : null));
        return panel;
    }

    function showNotice(text: string, focus: boolean): void {
        clearTimeout(noticeTimer);
        notice.textContent = text;
        notice.className = "hidden-notice";
        notice.tabIndex = -1;
        if (focus) notice.focus();
        noticeTimer = setTimeout(() => {
            notice.textContent = "";
            notice.className = "visually-hidden";
            notice.removeAttribute("tabindex");
        }, NOTICE_MS);
    }

    function setOpen(next: boolean, focusAfterClose: HTMLElement | null = toggle): void {
        if (!next) {
            open = false;
            toggle.setAttribute("aria-expanded", "false");
            void panel?.then((p) => p?.setOpen(false));
            (focusAfterClose?.isConnected ? focusAfterClose : toggle).focus(); // never leave focus on what just disappeared
            return;
        }
        returnTo = pageFocus();
        toggle.setAttribute("aria-busy", "true"); // until the panel is there (normally at once: it was fetched while idle)
        void ensurePanel().then((p) => {
            toggle.removeAttribute("aria-busy");
            if (!p) return showNotice("Couldn't open the settings. Check your connection and try again.", false);
            open = true;
            toggle.setAttribute("aria-expanded", "true");
            p.setOpen(true);
        });
    }

    function hideFor(howLong: HideFor): void {
        hide(howLong);
        hidden = true;
        open = false;
        toggle.setAttribute("aria-expanded", "false");
        void panel?.then((p) => p?.setOpen(false));
        toggle.hidden = true;
        // Focus back to the page where the visitor was, else on the notice
        const back = returnTo?.isConnected ? returnTo : null;
        showNotice(`Accessibility button hidden. Press ${SHORTCUT_LABEL} to show it again.`, !back);
        back?.focus();
    }

    toggle.addEventListener("click", () => (open ? setOpen(false) : setOpen(true)));

    widget.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && open) {
            e.stopPropagation(); // the event would otherwise reach the page and could close the page's own dialogs
            setOpen(false);
        }
    });

    // Alt+A (Option+A on Mac), from anywhere: open, or close back to where the visitor was; brings a hidden button back
    document.addEventListener(
        "keydown",
        (e) => {
            if (!isShortcut(e)) return;
            e.preventDefault();
            if (hidden) {
                unhide();
                hidden = false;
                toggle.hidden = false;
                clearTimeout(noticeTimer);
                notice.textContent = "";
                notice.className = "visually-hidden";
                setOpen(true);
            } else if (open) setOpen(false, returnTo);
            else setOpen(true);
        },
        true
    );

    // Fetch and mount the panel while the browser is idle, unless the visitor asked to save data
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!saveData) {
        const idle = (window as Window & { requestIdleCallback?: (fn: () => void, options?: { timeout: number }) => void }).requestIdleCallback;
        if (idle) idle(() => void ensurePanel(), { timeout: 2000 });
        else setTimeout(() => void ensurePanel(), 2000);
    }
}
