import { Suspense } from "react";
import type { Metadata } from "next";
import { InstallCode } from "@/components/InstallCode";

export const metadata: Metadata = { title: "Install · Widget" };

/** Widget › Install: the install code. Header and tabs: ../layout.tsx, subsections: ./layout.tsx */
export default function InstallPage() {
  return (
    <section aria-labelledby="install-heading">
      <h2 id="install-heading" className="mt-0">Install the widget</h2>
      <p>Paste this once on every page of the site, just before &lt;/body&gt;. It&apos;s the same code for all your sites.</p>
      <Suspense fallback={<p>Loading install code…</p>}>
        <InstallCode />
      </Suspense>
    </section>
  );
}
