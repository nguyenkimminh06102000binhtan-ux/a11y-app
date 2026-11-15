import type { LevelCount, LevelImpl } from "./types";

/*
 * Text spacing (id "text-spacing"; words in the catalog, @app/widget-config). Wide is WCAG 1.4.12's values (it was
 * the whole setting when it was on/off, so a saved `true` or an owner's default means Wide); Wider and Widest add
 * more room between letters, words and paragraphs. Line height stays 1.5: the Line height setting goes higher.
 */
const SPACING = [
    null, // Default: the page's own
    { letters: 0.12, words: 0.16, paragraphs: 2 },
    { letters: 0.16, words: 0.24, paragraphs: 2 },
    { letters: 0.2, words: 0.32, paragraphs: 2.5 },
] as const;
SPACING satisfies { length: LevelCount<"text-spacing"> };

export const textSpacing: LevelImpl = {
    inherited: true, // line-height, letter-spacing and word-spacing pass down to children
    css: (level, scope) => {
        const s = SPACING[level];
        if (!s) return "";
        return `
      *${scope} {
        line-height: 1.5 !important;
        letter-spacing: ${s.letters}em !important;
        word-spacing: ${s.words}em !important;
      }
      p${scope} {
        margin-bottom: ${s.paragraphs}em !important;
      }
    `;
    },
};
