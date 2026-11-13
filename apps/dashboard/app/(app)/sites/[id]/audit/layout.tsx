import { Suspense } from "react";
import { getOwnedSite } from "@/lib/site";
import { getLatestAudit } from "@/lib/audit";
import { SubNav, SubNavPlaceholder } from "@/components/SubNav";

/** The Audit section: its subsections beside (desktop) or above (phone) the current one. */
export default function AuditLayout({ children, params }: LayoutProps<"/sites/[id]/audit">) {
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
      <Suspense fallback={<SubNavPlaceholder />}>
        <AuditNav params={params} />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function AuditNav({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id);
  const { lastFinished, rows } = await getLatestAudit(site.id);
  const base = `/sites/${site.id}/audit`;
  return (
    <SubNav
      label="Audit sections"
      items={[
        { label: "Overview", href: base },
        { label: "Issues", href: `${base}/issues`, count: lastFinished?.status === "done" ? rows.length : undefined },
        { label: "Pages" },
        { label: "Scans" },
        { label: "Reports" },
      ]}
    />
  );
}
