import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

/** DRAFT: replace with the lawyer's text. Public (see proxy.ts). */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>Last updated: [DATE]. These terms are between you and [COMPANY LEGAL NAME] (“AccessPilot”, “we”).</p>
      <h2>1. The service</h2>
      <p>AccessPilot scans the web pages you choose for accessibility issues, shows them in a dashboard, and provides a widget you can add to your sites. [Scope to be written.]</p>
      <h2>2. Your account</h2>
      <p>[Who can sign up, keeping your sign-in details safe, accounts for organizations.]</p>
      <h2>3. Plans and payment</h2>
      <p>[Free and paid plans, billing, renewals, cancelling, refunds.]</p>
      <h2>4. Sites you add</h2>
      <p>Add only sites you own or are allowed to scan. Each domain and each subdomain is a separate site. [Responsibilities to be written.]</p>
      <h2>5. What AccessPilot does and doesn’t promise</h2>
      <p>Automated checks find part of the accessibility issues a site can have, not all of them. Using AccessPilot, its reports or its widget doesn’t make a site compliant with WCAG or any law, and isn’t legal advice. [Final wording to be written.]</p>
      <h2>6. Acceptable use</h2>
      <p>[What isn’t allowed.]</p>
      <h2>7. Ending the service</h2>
      <p>[How you or we can end it, and what happens to your data.]</p>
      <h2>8. Liability</h2>
      <p>[Limits of liability, warranties.]</p>
      <h2>9. Changes to these terms</h2>
      <p>[How we tell you about changes.]</p>
      <h2>10. Contact</h2>
      <p>[CONTACT EMAIL AND ADDRESS]</p>
    </LegalPage>
  );
}
