import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Accessibility statement" };

/** DRAFT: the dashboard's own accessibility statement. Keep the testing facts accurate. Public. */
export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility statement">
      <p>Last updated: [DATE]. We want everyone to be able to use AccessPilot, including people who use screen readers, keyboards, magnification or other assistive technology.</p>
      <h2>Our goal</h2>
      <p>The AccessPilot dashboard and widget aim to meet WCAG 2.2 at level AA.</p>
      <h2>How we check</h2>
      <ul>
        <li>Every page of the dashboard is tested automatically with axe at phone, tablet and desktop widths on every change, along with checks that pages don’t scroll sideways and that buttons and fields are large enough to tap.</li>
        <li>We test with the keyboard and [SCREEN READERS AND BROWSERS].</li>
        <li>Automated tests find part of the issues, so we also review by hand. [Manual review details.]</li>
      </ul>
      <h2>Known issues</h2>
      <p>[Known issues and when we expect to fix them.]</p>
      <h2>Fonts in the widget</h2>
      <p>
        The widget’s Font setting offers Atkinson Hyperlegible Next (Braille Institute of America), Lexend (The Lexend Project) and
        Andika (SIL International). All three are free fonts under the SIL Open Font License 1.1. We serve them unchanged, from our
        own servers, and only when a visitor picks one.
      </p>
      <h2>Tell us about a barrier</h2>
      <p>If something gets in your way, tell us at [CONTACT EMAIL]. We aim to reply within [N] working days.</p>
    </LegalPage>
  );
}
