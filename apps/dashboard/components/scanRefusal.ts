import type { ScanPagesState } from "@/app/actions";

/** Why a scan didn't start, in words (shared by Pages and Overview). */
export function scanRefusal(state: ScanPagesState, resetsOn: string): string {
  const pages = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
  switch (state.error) {
    case "none-selected":
      return "Select at least one page to scan.";
    case "gone":
      return "Some of those pages were removed from the list. Check the list and try again.";
    case "busy":
      return "A scan is already running for this site. You can start another when it finishes.";
    case "over-limit":
      return `This needs ${pages(state.needed ?? 0)} you haven't scanned this month, but ${state.left ? `only ${pages(state.left)} ${state.left === 1 ? "is" : "are"}` : "none are"} left until ${resetsOn}. Pages you already scanned this month rescan free.`;
    default:
      return "";
  }
}
