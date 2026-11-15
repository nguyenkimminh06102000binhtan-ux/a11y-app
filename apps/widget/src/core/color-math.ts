/*
 * Color math for Smart contrast: parse, blend, measure (WCAG 2 contrast) and find the closest passing color.
 * Stateless apart from a parse cache, so parts can import it.
 */

/** sRGB channels 0–255 and alpha 0–1. */
export type Rgba = [number, number, number, number];

const RGB = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/;
const cache = new Map<string, Rgba | null>();
let canvas: CanvasRenderingContext2D | null | undefined;

/** A computed color ("rgb(…)", or any other syntax, e.g. oklch()) → sRGB. null if it can't be read. */
export function parseColor(css: string): Rgba | null {
    const hit = cache.get(css);
    if (hit !== undefined) return hit;
    let rgba: Rgba | null = null;
    const m = RGB.exec(css);
    if (m) {
        const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
        rgba = [+m[1], +m[2], +m[3], a];
    } else if (css === "transparent") {
        rgba = [0, 0, 0, 0];
    } else {
        // Other color syntaxes: let the browser convert by painting one pixel
        canvas ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
        if (canvas) {
            canvas.clearRect(0, 0, 1, 1);
            canvas.fillStyle = css;
            canvas.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
            rgba = [r, g, b, a / 255];
        }
    }
    if (cache.size > 500) cache.clear();
    cache.set(css, rgba);
    return rgba;
}

/** `top` painted over an opaque `bottom`. */
export function blend(top: Rgba, bottom: Rgba): Rgba {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
    const [R, G, B] = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2 contrast ratio, 1–21. */
export function contrast(a: Rgba, b: Rgba): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * The color closest to `fg` (same hue and saturation, only lightness moved) with at least `target` contrast on
 * `bg`: darker on light backgrounds, lighter on dark ones, whichever can reach it. Black or white if neither can.
 */
export function passingColor(fg: Rgba, bg: Rgba, target: number): Rgba {
    const [h, s, l] = toHsl(fg);
    const black: Rgba = [0, 0, 0, 1];
    const white: Rgba = [255, 255, 255, 1];
    const darker = contrast(black, bg) >= target;
    const lighter = contrast(white, bg) >= target;
    if (!darker && !lighter) return contrast(black, bg) >= contrast(white, bg) ? black : white;
    // Prefer the direction that needs the smaller change: toward the end opposite the background
    const goDark = darker && (!lighter || luminance(bg) > 0.18);
    let [lo, hi] = goDark ? [0, l] : [l, 1]; // the passing end of the range is 0 (dark) or 1 (light)
    for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const passes = contrast(fromHsl(h, s, mid), bg) >= target;
        if (goDark) {
            if (passes) lo = mid;
            else hi = mid;
        } else if (passes) hi = mid;
        else lo = mid;
    }
    return fromHsl(h, s, goDark ? lo : hi);
}

export function toHex([r, g, b]: Rgba): string {
    return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function toHsl([r, g, b]: Rgba): [number, number, number] {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgba {
    if (s === 0) return [l * 255, l * 255, l * 255, 1];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255, 1];
}
