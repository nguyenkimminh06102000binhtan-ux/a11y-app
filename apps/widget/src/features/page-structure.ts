import { runPart } from "../core/parts";
import type { ActionImpl } from "./types";

/** Page structure (id "page-structure"; words in the catalog): opens the dialog in parts/page-structure.ts, downloaded on first use. */
export const pageStructure: ActionImpl = {
    run: () => runPart("page-structure"),
};
