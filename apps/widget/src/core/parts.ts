import { CDN_BASE } from "./cdn-base";
import { safely } from "./safely";
import type { Behavior } from "../features/types";

/*
 * Parts: heavier features built as separate files (scripts/build.mjs → parts/<name>.<hash>.js), downloaded only
 * when a visitor turns them on, so every visitor doesn't pay for features few use.
 * - Each file's name and integrity hash are baked into the app (__PARTS__), as the loader does for the app: the
 *   browser refuses a part whose bytes differ.
 * - A part hands itself over through one hidden, non-enumerable spot on window (PART_HANDOFF), not a public API.
 * - Parts are bundled separately, so they must only use stateless helpers (core/ignore, core/host…), never
 *   modules holding state (the DOM watcher, the shadow-root list): they'd get their own copy.
 * - If a part can't load (blocked by the page's Content-Security-Policy, offline), the setting does nothing,
 *   with one warning, and the page sees no errors.
 */

export type PartName = keyof typeof __PARTS__;

/** Where a part file hands itself over: `window[PART_HANDOFF](name, behavior)`. Shared with parts/handoff.ts. */
export const PART_HANDOFF = "__a11ywPart";

type Handoff = (name: string, part: Behavior) => void;
const waiting = new Map<string, (part: Behavior) => void>();
const loads = new Map<PartName, Promise<Behavior | null>>();

function listen(): void {
    const w = window as unknown as Record<string, Handoff | undefined>;
    if (w[PART_HANDOFF]) return;
    const handoff: Handoff = (name, part) => waiting.get(name)?.(part);
    Object.defineProperty(window, PART_HANDOFF, { value: handoff, configurable: true, enumerable: false });
}

/** Download a part once. Resolves to null if it can't load. */
export function loadPart(name: PartName): Promise<Behavior | null> {
    let load = loads.get(name);
    if (load) return load;
    load = new Promise<Behavior | null>((resolve) => {
        listen();
        waiting.set(name, resolve); // a part hands itself over while its script runs, before the load event
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

/** A setting's Behavior that downloads its part the first time it's turned on. On/off while loading is handled. */
export function partBehavior(name: PartName): Behavior {
    let on = false;
    let running: Behavior | null = null;
    return {
        start() {
            on = true;
            void loadPart(name).then((part) => {
                if (!part || !on || running) return;
                running = part;
                safely(() => part.start());
            });
        },
        stop() {
            on = false;
            if (!running) return;
            const part = running;
            running = null;
            safely(() => part.stop());
        },
    };
}
