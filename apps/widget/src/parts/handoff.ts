import type { Part } from "../core/parts";

/** Shared with core/parts.ts (kept as a literal here, so a part bundles nothing from the app's loader). */
const PART_HANDOFF = "__a11ywPart";

/** Called by a part file as it runs: hands itself to the app that asked for it. */
export function handOver(name: string, part: Part | object): void {
    const handoff = (window as unknown as Record<string, ((name: string, part: unknown) => void) | undefined>)[PART_HANDOFF];
    handoff?.(name, part);
}
