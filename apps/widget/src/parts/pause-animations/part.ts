import { ignoredBy } from "../../core/ignore";
import type { PartContext } from "../../core/parts";

/** Public id of this setting, used in data-a11yw-ignore="…". Never rename once customers use it. */
export const FEATURE_ID = "pause-animations";

/** Is this element in an area the site owner opted out of Pause animations? */
export const isIgnored = ignoredBy(FEATURE_ID);

/** One kind of motion handled by "Pause animations". recheck() runs about once a second while it's on. */
export type MotionPart = { start(): void; stop(): void; recheck?(): void };

/*
 * The app's page watchers, lent to this part when it starts (see core/parts.ts): this file is bundled separately,
 * so importing them would give it copies that watch nothing. The modules call these as if they were the originals.
 */
let page: PartContext | null = null;

export function usePage(context: PartContext): void {
  page = context;
}

export const onElementsAdded: PartContext["onElementsAdded"] = (fn) => page!.onElementsAdded(fn);
export const onNewShadowRoot: PartContext["onNewShadowRoot"] = (fn) => page!.onNewShadowRoot(fn);
export const deepQueryAll = ((selector: string, start?: Document | ShadowRoot | Element) => page!.deepQueryAll(selector, start)) as PartContext["deepQueryAll"];
export const openShadowRootsIn: PartContext["openShadowRootsIn"] = (start) => page!.openShadowRootsIn(start);
export const rescanShadowRoots: PartContext["rescanShadowRoots"] = () => page!.rescanShadowRoots();
