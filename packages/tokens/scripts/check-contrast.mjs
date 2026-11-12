// Fails if a token pairing we rely on drops below its WCAG contrast minimum.
// Reads the values straight from tokens.css, so there's nothing to keep in sync.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--bcn-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));

let failed = false;
const fail = (message) => {
  console.error(`✗ ${message}`);
  failed = true;
};

// The tint as browsers compute color-mix(in srgb, state N%, bg): a straight mix of the two colors
const percent = Number(css.match(/var\(--bcn-state\)\s+(\d+)%/)?.[1]);
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mixed =
  "#" +
  channels(tokens.state)
    .map((s, i) => Math.round((s * percent + channels(tokens.bg)[i] * (100 - percent)) / 100))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("");
if (!percent) fail("can't find the color-mix() percentage for --bcn-state-tint");
else if (mixed !== tokens["state-tint"]) fail(`--bcn-state-tint fallback is ${tokens["state-tint"]}, but color-mix() gives ${mixed}: update the fallback`);

// [foreground, background, minimum, where it's used]
const PAIRS = [
  ["text", "bg", 4.5, "body text"],
  ["frame", "bg", 4.5, "icons, borders and secondary text"],
  ["state-ink", "bg", 4.5, "state text, borders and icons on white"],
  ["on-state", "state", 4.5, "icons and check marks on the state color"],
  ["bg", "text", 4.5, "text on primary buttons"],
  ["text", "state-tint", 4.5, "the label on a tile that's on"],
  ["state-ink", "state-tint", 4.5, "the chosen Text size level, the current nav item"],
];


function luminance(hex) {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const [fg, bg, min, use] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    fail(`missing token --bcn-${tokens[fg] ? bg : fg}`);
    continue;
  }
  const ratio = contrast(tokens[fg], tokens[bg]);
  if (ratio < min) fail(`${fg} on ${bg}: ${ratio.toFixed(2)}:1 (needs ${min}:1, ${use})`);
  else console.log(`✓ ${fg} on ${bg}: ${ratio.toFixed(2)}:1 (needs ${min}:1, ${use})`);
}
process.exit(failed ? 1 : 0);
