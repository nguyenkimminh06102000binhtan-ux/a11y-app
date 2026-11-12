/*
 * The widget's icons: inline SVG, so there are no extra requests. Drawn with `currentColor`, so each icon takes
 * the text color of the element around it; the stroke styles are in widget.css (.icon).
 * All are decorative (aria-hidden): the button or label around them carries the name.
 */

/** Our mark: a light sending out a beam. Parts have classes so the header can color them separately. */
export function Mark({ class: className = "" }: { class?: string }) {
    return (
        <svg class={`icon mark ${className}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <circle class="mark-ring" cx="16" cy="16" r="12" />
            <path class="mark-beam" d="M16 16 L28 10.5 M16 16 L28 21.5" />
            <circle class="mark-core" cx="16" cy="16" r="3.5" />
        </svg>
    );
}

/** The launcher's icon: the accessibility figure as a solid silhouette, the symbol visitors look for. Bold at small sizes. */
export function AccessibilityIcon() {
    return (
        <svg class="icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <circle class="solid" cx="16" cy="7.4" r="2.9" />
            <path
                class="solid"
                d="M7 11.4 H25 A1.5 1.5 0 0 1 25 14.4 H19.2 V19.4 L21.9 26.4 A1.6 1.6 0 0 1 18.9 27.6 L16 20.9 L13.1 27.6 A1.6 1.6 0 0 1 10.1 26.4 L12.8 19.4 V14.4 H7 A1.5 1.5 0 0 1 7 11.4 Z"
            />
        </svg>
    );
}



export function CloseIcon() {
    return (
        <svg class="icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M5 5 L15 15 M15 5 L5 15" />
        </svg>
    );
}

export function ResetIcon() {
    return (
        <svg class="icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M4 10 a6 6 0 1 0 2 -4.5" />
            <path d="M3.5 3 V6.5 H7" />
        </svg>
    );
}


/** A setting's icon, by its public id. Settings without one get none. */
export function FeatureIcon({ id }: { id: string }) {
    const paths = FEATURE_PATHS[id];
    if (!paths) return null;
    return (
        <svg class="icon feature-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
            {paths}
        </svg>
    );
}

/** Shown on a tile that's on: the non-color sign that goes with the tint (never color alone). */
export function CheckBadge() {
    return (
        <svg class="check-badge" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="10" />
            <path d="M5.5 10.5 L8.5 13.5 L14.5 7" />
        </svg>
    );
}

const FEATURE_PATHS: Record<string, preact.JSX.Element> = {
    "text-size": (
        <>
            <path d="M3 23 L10 5 L17 23 M5.6 16.5 H14.4" />
            <path d="M23 22 V8 M19.5 11.5 L23 8 L26.5 11.5" />
        </>
    ),
    "text-spacing": (
        <>
            <path d="M3 14 H25 M7 10 L3 14 L7 18 M21 10 L25 14 L21 18" />
            <path d="M11 6 V22 M17 6 V22" />
        </>
    ),
    "highlight-links": (
        <>
            <path d="M11 17 L17 11" />
            <path d="M12.5 8.5 L15 6 a4.2 4.2 0 0 1 6 6 L18.5 14.5" />
            <path d="M15.5 19.5 L13 22 a4.2 4.2 0 0 1 -6 -6 L9.5 13.5" />
        </>
    ),
    "focus-outline": (
        <>
            <rect x="3" y="5" width="22" height="18" rx="4" stroke-dasharray="3.5 3" />
            <rect x="8.5" y="10.5" width="11" height="7" rx="2" />
        </>
    ),
    "pause-animations": (
        <>
            <circle cx="14" cy="14" r="11" />
            <path d="M11 9.5 V18.5 M17 9.5 V18.5" />
        </>
    ),
};
