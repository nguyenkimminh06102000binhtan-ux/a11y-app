import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "@/components/Mark";
import { LegalLinks } from "@/components/auth/AuthShell";

/**
 * Terms, Privacy and the Accessibility statement: public pages (no sign-in), one readable column.
 * DRAFTS until a lawyer's text replaces them: the notice at the top says so. Where facts about the product are
 * known they're written in; everything else is a [bracketed placeholder].
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-subtle px-4 py-3">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 text-lg font-bold text-ink no-underline">
          <Mark className="size-8 shrink-0" />
          AccessPilot
        </Link>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-8 pb-4">
        <div className="rounded-xl border-[1.5px] border-state bg-state-tint px-4 py-3">
          <p className="m-0 font-bold">Draft, not yet in effect</p>
          <p className="m-0">This page is a placeholder until our final text is ready. Bracketed parts are still to be written.</p>
        </div>
        <h1 className="m-0">{title}</h1>
        <div className="flex flex-col gap-2 [&_h2]:mt-6 [&_h2]:mb-1 [&_h2]:text-xl [&_li]:mb-1 [&_ul]:pl-6 [&_ul]:list-disc">{children}</div>
        <LegalLinks />
      </main>
    </div>
  );
}
