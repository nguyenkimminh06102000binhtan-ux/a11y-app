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
