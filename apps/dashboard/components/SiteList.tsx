import Link from "next/link";
import type { SiteSummary } from "@/lib/sites";

type Step = { text: string; href: string };

/** The one thing to do next on a site, first match wins. Links go straight to where it's done. */
export function nextStep(site: SiteSummary): Step {
  const base = `/sites/${site.id}/audit`;
  const issues = (n: number) => `${n} ${n === 1 ? "issue" : "issues"}`;
  if (site.scanning) return { text: "See progress", href: base };
  if (site.pagesChecked === 0) {
    return site.lastScan?.status === "failed"
      ? { text: "See what went wrong", href: base }
      : { text: "Choose pages to scan", href: `${base}/pages` };
  }
  if (site.critical > 0) {
    const n = site.critical;
    return { text: `Fix ${n} critical ${n === 1 ? "issue" : "issues"}`, href: `${base}/issues?impact=critical` };
  }
  if (site.open > 0) return { text: `Review ${issues(site.open)}`, href: `${base}/issues` };
  return { text: "No issues found · scan more pages", href: `${base}/pages` };
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function lastScanText(site: SiteSummary): string {
  if (site.scanning) return "Scanning now…";
  if (!site.lastScan) return "Never";
  const day = formatDay(site.lastScan.at);
  return site.lastScan.status === "failed" ? `Failed · ${day}` : day;
}

/** "48 · 7 critical", or a dash (read as "not checked yet") before any page has been checked. */
function OpenIssues({ site }: { site: SiteSummary }) {
  if (site.pagesChecked === 0) {
    return (
      <>
        <span aria-hidden="true">–</span>
        <span className="sr-only">not checked yet</span>
      </>
    );
  }
  return (
    <>
      <span className="font-bold">{site.open}</span>
      <span className="text-muted"> · {site.critical} critical</span>
    </>
  );
}

/** The Next step link; its name ends with the domain ("Fix 7 critical issues on shop.com"), which stays hidden. */
function StepLink({ site }: { site: SiteSummary }) {
  const step = nextStep(site);
  return (
    <Link href={step.href} className="inline-flex min-h-11 items-center font-bold">
      <span>
        {step.text}
        <span className="sr-only"> on {site.domain}</span>
      </span>
    </Link>
  );
}

/**
 * One page of the account's sites: a table from 1024px, one card per site below that (same facts, as labelled
 * lines). The order is the caller's (A–Z).
 */
export function SiteList({ sites }: { sites: SiteSummary[] }) {

  return (
    <>
      {/* "relative" keeps the visually hidden caption inside the scroll box */}
      <div className="relative hidden overflow-x-auto rounded-xl border border-line bg-surface lg:block">
        <table className="w-full text-left">
          <caption className="sr-only">Your sites</caption>
          <thead className="bg-subtle text-small text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-normal">Site</th>
              <th scope="col" className="px-4 py-3 font-normal">Open issues</th>
              <th scope="col" className="px-4 py-3 font-normal">Last scan</th>
              <th scope="col" className="px-4 py-3 font-normal">Next step</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.id} className="border-t border-line align-middle">
                <th scope="row" className="px-4 py-1 font-bold">
                  <Link href={`/sites/${site.id}/audit`} className="inline-flex min-h-11 items-center wrap-anywhere">
                    {site.domain}
                  </Link>
                </th>
                <td className="px-4 py-3 whitespace-nowrap">
                  <OpenIssues site={site} />
                </td>
                <td className="px-4 py-3 text-small whitespace-nowrap">{lastScanText(site)}</td>
                <td className="px-4 py-1">
                  <StepLink site={site} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 lg:hidden" aria-label="Your sites">
        {sites.map((site) => (
          <li key={site.id} className="rounded-xl border border-line bg-surface p-4">
            <h3 className="m-0 text-base">
              <Link href={`/sites/${site.id}/audit`} className="inline-flex min-h-11 items-center wrap-anywhere">
                {site.domain}
              </Link>
            </h3>
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-small">
              <dt className="text-muted">Open issues</dt>
              <dd>
                <OpenIssues site={site} />
              </dd>
              <dt className="text-muted">Last scan</dt>
              <dd>{lastScanText(site)}</dd>
            </dl>
            <div className="mt-1">
              <StepLink site={site} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
