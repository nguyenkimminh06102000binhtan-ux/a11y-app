import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "@/components/Mark";

/** The rings and beam behind the dark panel: decoration, so hidden from screen readers */
function Rings({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 720 720" fill="none" aria-hidden="true" focusable="false" className={`pointer-events-none absolute ${className}`}>
      <circle cx="360" cy="360" r="300" className="stroke-state" strokeWidth="2" />
      <circle cx="360" cy="360" r="210" className="stroke-state" strokeWidth="2" />
      <circle cx="360" cy="360" r="120" className="stroke-state" strokeWidth="2" />
      <path d="M360 360 L720 200 M360 360 L720 520" className="stroke-night-accent" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Terms, Privacy, Accessibility statement: at the bottom of every sign-in and legal page */
export function LegalLinks() {
  return (
    <nav aria-label="Legal" className="mt-auto flex flex-wrap gap-x-5 text-small">
      {[
        ["/terms", "Terms"],
        ["/privacy", "Privacy"],
        ["/accessibility", "Accessibility statement"],
      ].map(([href, label]) => (
        <Link key={href} href={href} className="inline-flex min-h-11 items-center text-muted">
          {label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Sign-in and sign-up pages: the form on the left and a dark panel on the right from 768px; on phones the panel
 * becomes a short band at the top (logo and one line) so the form starts right away.
 * Reading order: band (phones), the form, then the panel's content.
 */
export function AuthShell({ tagline, panel, panelLabel, children }: { tagline: string; panel: ReactNode; panelLabel: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <header className="relative overflow-hidden bg-ink px-4 pt-5 pb-6 text-surface md:hidden">
        <Rings className="-top-28 -right-32 size-80 opacity-50" />
        <Link href="/" className="relative inline-flex min-h-11 items-center gap-2.5 text-lg font-bold text-surface no-underline">
          <Mark tone="light" className="size-8 shrink-0" />
          AccessPilot
        </Link>
        <p className="relative mt-2 mb-0 max-w-xs text-night-muted">{tagline}</p>
      </header>

      <main id="main" className="m-0 flex max-w-none flex-1 flex-col px-4 pt-7 pb-4 sm:px-8 md:basis-1/2 md:pt-12 md:pb-8">
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col gap-6">
          <Link href="/" className="hidden min-h-11 items-center gap-2.5 self-start text-xl font-bold text-ink no-underline md:inline-flex">
            <Mark className="size-8 shrink-0" />
            AccessPilot
          </Link>
          {children}
          <LegalLinks />
        </div>
      </main>

      <aside
        aria-label={panelLabel}
        className="relative hidden flex-col justify-center gap-10 overflow-hidden bg-ink px-10 py-16 text-surface md:flex md:basis-1/2 lg:px-16"
      >
        <Rings className="-right-56 -bottom-60 size-[45rem] opacity-55" />
        <div className="relative flex flex-col gap-10">{panel}</div>
      </aside>
    </div>
  );
}
