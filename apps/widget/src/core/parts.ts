import { CDN_BASE } from "./cdn-base";
import { safely } from "./safely";
import { onElementsAdded } from "./dom-watcher";
import { deepQueryAll, onNewShadowRoot, openShadowRootsIn, rescanShadowRoots } from "./shadow-roots";
import { ignoredBy } from "./ignore";

/*
 * Parts: heavier features built as separate files (scripts/build.mjs → parts/<name>.<hash>.js), downloaded only
 * when a visitor turns them on, so every visitor doesn't pay for features few use.
 * - Each file's name and integrity hash are baked into the app (__PARTS__), as the loader does for the app: the
 *   browser refuses a part whose bytes differ.
 * - A part hands itself over through one hidden, non-enumerable spot on window (PART_HANDOFF), not a public API.
 * - Parts are bundled separately, so they must only import stateless helpers (core/ignore, core/host,
 *   core/color-math…). The app's page watchers hold state, so a part gets them from the app instead, in
 *   PartContext when it starts: a copy of its own would watch nothing.
 * - If a part can't load (blocked by the page's Content-Security-Policy, offline), the setting does nothing,
 *   with one warning, and the page sees no errors.
 */

export type PartName = keyof typeof __PARTS__;

/** What the app lends a part: its page watchers, so the page still pays for one observer. */
export type PartContext = {
    onElementsAdded: typeof onElementsAdded;
    onNewShadowRoot: typeof onNewShadowRoot;
    deepQueryAll: typeof deepQueryAll;
    openShadowRootsIn: typeof openShadowRootsIn;
    rescanShadowRoots: typeof rescanShadowRoots;
    ignoredBy: typeof ignoredBy;
};

/** What a part file hands over. */
export type Part = {
    start(context: PartContext, option?: string): void; // option: e.g. which level ("guide" or "mask")
    stop(): void;
    refresh?(): void; // after any setting changes, while running
    update?(option?: string): void; // the option changed while running
};

const CONTEXT: PartContext = { onElementsAdded, onNewShadowRoot, deepQueryAll, openShadowRootsIn, rescanShadowRoots, ignoredBy };

/** Where a part file hands itself over: `window[PART_HANDOFF](name, part)`. Shared with parts/handoff.ts. */
export const PART_HANDOFF = "__a11ywPart";

type Handoff = (name: string, part: unknown) => void;
const waiting = new Map<string, (part: unknown) => void>();
const loads = new Map<PartName, Promise<unknown>>();

function listen(): void {
    const w = window as unknown as Record<string, Handoff | undefined>;
    if (w[PART_HANDOFF]) return;
    const handoff: Handoff = (name, part) => waiting.get(name)?.(part);
    Object.defineProperty(window, PART_HANDOFF, { value: handoff, configurable: true, enumerable: false });
}

/** Download a part once. Resolves to null if it can't load. Most parts are a Part; the panel is a PanelPart (ui/launcher.ts). */
export function loadPart<T = Part>(name: PartName): Promise<T | null> {
    let load = loads.get(name) as Promise<T | null> | undefined;
    if (load) return load;
    load = new Promise<T | null>((resolve) => {
        listen();
        waiting.set(name, resolve as (part: unknown) => void); // a part hands itself over while its script runs, before the load event
        const { file, integrity } = __PARTS__[name];
        const script = document.createElement("script");
        script.src = CDN_BASE + file;
        if (integrity) script.integrity = integrity; // dev builds have none: the file changes on every save
        script.crossOrigin = "anonymous";
        script.async = true;
        const done = (ok: boolean) => {
            script.remove();
            waiting.delete(name);
            if (!ok) console.warn(`[a11y-widget] Couldn't load the "${name}" part (blocked or offline).`);
            resolve(null); // no-op if the part already handed itself over
        };
        script.onload = () => done(true);
        script.onerror = () => done(false);
        (document.head ?? document.documentElement).appendChild(script);
    });
    loads.set(name, load);
    return load;
}

/**
 * A setting's start/stop that downloads its part the first time it's turned on. On/off while loading is handled;
 * refresh() reaches the part only while it runs.
 */
export function partBehavior(name: PartName): { start(option?: string): void; stop(): void; refresh(): void } {
    let on = false;
    let option: string | undefined;
    let running: Part | null = null;
    return {
        start(next?: string) {
            on = true;
            option = next;
            const part = running;
            if (part) {
                if (part.update) safely(() => part.update!(next));
                return;
            }
            void loadPart(name).then((loaded) => {
                if (!loaded || !on || running) return;
                running = loaded;
                safely(() => loaded.start(CONTEXT, option));
            });
        },
        stop() {
            on = false;
            if (!running) return;
            const part = running;
            running = null;
            safely(() => part.stop());
        },
        refresh() {
            const part = running;
            if (part?.refresh) safely(() => part.refresh!());
        },
    };
}

/** For an action: download its part (once) and start it, e.g. open the Page structure dialog. */
export function runPart(name: PartName): void {
    void loadPart(name).then((part) => {
        if (part) safely(() => part.start(CONTEXT));
    });
}
