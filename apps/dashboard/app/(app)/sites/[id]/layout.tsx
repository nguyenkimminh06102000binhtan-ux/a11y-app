import { Suspense } from "react";
import { getOwnedSite } from "@/lib/site";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionNav } from "@/components/SectionNav";

/**
 * Every page of a site: the header (breadcrumb, domain) and the main sections, Audit first (what owners come back
 * to) and Widget. The header needs the site from the database, so it streams in; its placeholder has the same
 * height, so the page doesn't jump.
 */
export default function SiteLayout({ children, params }: LayoutProps<"/sites/[id]">) {
  return (
    <main id="main">
      <Suspense fallback={<HeaderPlaceholder />}>
        <SiteHeader params={params} />
      </Suspense>
      <div className="pt-6">{children}</div>
    </main>
  );
}

async function SiteHeader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const base = `/sites/${site.id}`;
  return (
    <>
      {/* No Run scan here: scans start from Audit › Pages, where owners pick the pages ("Scan 3 pages") */}
      <PageHeader breadcrumb={[{ href: "/", label: "Sites" }]} title={site.domain} />
      <SectionNav
        label="Site sections"
        items={[
          { href: `${base}/audit`, label: "Audit" },
          { href: `${base}/widget`, label: "Widget" },
        ]}
      />
    </>
  );
}

function HeaderPlaceholder() {
  return (
    <div>
      <p role="status" className="sr-only">Loading site…</p>
      <div aria-hidden="true">
        <div className="h-11" />
        <div className="mt-2 mb-6 h-10 w-64 max-w-full rounded-lg bg-subtle" />
        <div className="h-11 border-b border-line" />
      </div>
    </div>
  );
}
