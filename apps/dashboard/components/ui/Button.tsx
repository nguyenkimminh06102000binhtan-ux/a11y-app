import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";

/*
 * One look for every action. Use one primary per view (its main action); everything else is secondary or quiet.
 * At least 44px tall (min-h-11). The edges use --color-frame (5.9:1), never --color-line: a control's edge needs 3:1.
 * Disabled stays readable (no faded text) and is marked by a dashed edge, like the base button styles.
 * These are utilities, so they win over the plain <button> styles in globals.css.
 */
const BASE =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[0.625rem] border-[1.5px] px-4 font-bold no-underline " +
  "disabled:cursor-not-allowed disabled:border-dashed disabled:border-frame disabled:bg-surface disabled:text-ink";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-ink bg-ink text-surface hover:underline hover:underline-offset-[0.2em]",
  secondary: "border-frame bg-surface text-ink hover:bg-subtle",
  // No visible edge until hover, but the transparent border keeps it the same size (and shows in forced-colors mode)
  quiet: "border-transparent bg-transparent text-ink hover:underline hover:underline-offset-[0.2em]",
};

export function buttonClass(variant: ButtonVariant = "secondary", className = "") {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

/** A real <button>. Defaults to type="button": pass type="submit" for a form's action. */
export function Button({ variant = "secondary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant };

/** A link that looks like a button (e.g. "Run first scan" that opens a page). Still an <a>, so it's announced as a link. */
export function ButtonLink({ variant = "secondary", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
