import { h, render } from "preact";
import type { PanelContext, PanelPart } from "../../ui/launcher";
import { handOver } from "../handoff";
import { Panel } from "./Panel";
import css from "./panel.css";

/*
 * The panel part: Preact and the whole settings panel, downloaded once the page is idle (ui/launcher.ts), so
 * visitors who never open it don't download it on every page. Mounted closed; the launcher opens and closes it.
 */
const panelPart: PanelPart = {
    mount(ctx: PanelContext) {
        const shadow = ctx.root.getRootNode() as ShadowRoot;
        const style = document.createElement("style");
        style.textContent = css;
        shadow.append(style);
        const show = (open: boolean) => render(h(Panel, { ctx, open }), ctx.root);
        show(false);
        return { setOpen: show };
    },
};

handOver("panel", panelPart);
