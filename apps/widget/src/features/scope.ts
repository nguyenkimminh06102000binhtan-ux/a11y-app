/**
 * Appended to every page rule. Matches every element except our own placeholder id, so it adds
 * id-level specificity (beats page rules like `.article p { line-height: 1.2 !important }`), and it
 * skips areas the site owner opted out with data-a11yw-ignore. A :not() list counts as its most
 * specific item, so the id-level strength stays.
 */
export const SCOPE = ":not(#a11yw-x, [data-a11yw-ignore], [data-a11yw-ignore] *)";
