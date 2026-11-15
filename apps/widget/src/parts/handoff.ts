import type { Behavior } from "../features/types";

/** Shared with core/parts.ts (kept as a literal here, so a part bundles nothing from the app's loader). */
const PART_HANDOFF = "__a11ywPart";

/** Called by a part file as it runs: hands its Behavior to the app that asked for it. */
export function handOver(name: string, part: Behavior): void {
    const handoff = (window as unknown as Record<string, ((name: string, part: Behavior) => void) | undefined>)[PART_HANDOFF];
    handoff?.(name, part);
}
