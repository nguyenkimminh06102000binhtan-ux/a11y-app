import { Suspense } from "react";
import { getOwnedSite } from "@/lib/site";
import { SubNav, SubNavPlaceholder } from "@/components/SubNav";

/** The Widget section: its subsections beside (desktop) or above (phone) the current one. */
export default function WidgetLayout({ children, params }: LayoutProps<"/sites/[id]/widget">) {
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
      <Suspense fallback={<SubNavPlaceholder />}>
        <WidgetNav params={params} />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function WidgetNav({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id);
  const base = `/sites/${site.id}/widget`;
  return (
    <SubNav
      label="Widget sections"
      items={[
        { label: "Install", href: base },
        // One form for now; chunks 14–15 split it into Appearance and On by default
        { label: "Settings", href: `${base}/settings` },
        { label: "Features" },
        { label: "Autofix" },
      ]}
    />
  );
}
