import { partBehavior } from "../core/parts";
import type { ToggleImpl } from "./types";

/** Read aloud (id "read-aloud"; words in the catalog): the player and voice are in parts/read-aloud.ts, downloaded when turned on. */
const part = partBehavior("read-aloud");

export const readAloud: ToggleImpl = {
    behavior: part,
    refresh: () => part.refresh(), // shows the player once the widget is on the page
};
