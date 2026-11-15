import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

/** DRAFT: replace with the lawyer's text. The facts listed are how the product works today; keep them accurate. Public. */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Last updated: [DATE]. This policy explains what [COMPANY LEGAL NAME] (“AccessPilot”) collects and why.</p>
      <h2>What we collect from you</h2>
      <ul>
        <li>Your account: your name (if you give it) and email address.</li>
        <li>Your sites: the domains you add, the pages you choose to scan, and the scan results, which include short pieces of those pages’ HTML to show where each issue is.</li>
        <li>Your widget settings: colors, position and settings that are on by default.</li>
      </ul>
      <h2>What the widget collects from your visitors</h2>
      <ul>
        <li>The settings a visitor chooses (like text size) are saved in their own browser, not sent to us.</li>
        <li>To show the right colors and position, the widget asks our server for your site’s settings, sending your account key and the page’s domain.</li>
        <li>We note when the widget was last seen on each of your sites (one time per site), so the dashboard can tell you it’s working. We don’t store anything about visitors.</li>
      </ul>
      <h2>Services we use</h2>
      <ul>
        <li>Supabase: database and sign-in.</li>
        <li>Vercel: hosts the dashboard.</li>
        <li>Cloudflare: delivers the widget.</li>
        <li>Google: only if you choose to sign in with Google.</li>
      </ul>
      <h2>How long we keep it</h2>
      <p>[Retention periods.]</p>
      <h2>Your rights</h2>
      <p>[Access, correction, deletion, export; how to ask.]</p>
      <h2>Cookies</h2>
      <p>The dashboard uses a cookie to keep you signed in. [Any others, to be listed.]</p>
      <h2>Contact</h2>
      <p>[CONTACT EMAIL AND ADDRESS]</p>
    </LegalPage>
  );
}
