import { Suspense } from "react";
import { getOwnedSite } from "@/lib/site";
import { SubNav, SubNavPlaceholder } from "@/components/SubNav";
import { WidgetStatus } from "@/components/WidgetStatus";

/**
 * The Widget section: whether the widget is working on the site, then its subsections beside (desktop) or above
 * (phone) the current one.
 */
export default function WidgetLayout({
  children,
  params,
}: LayoutProps<"/sites/[id]/widget">) {
  return (
    <>
      <Suspense fallback={null}>
        <Status params={params} />
      </Suspense>
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
        <Suspense fallback={<SubNavPlaceholder />}>
          <WidgetNav params={params} />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}

async function Status({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id);
  return <WidgetStatus domain={site.domain} seenAt={site.widgetSeenAt} />;
}

async function WidgetNav({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id);
  const base = `/sites/${site.id}/widget`;
  return (
    <SubNav
      label="Widget sections"
      items={[
        { label: "Customize", href: base },
        { label: "Addons" },
        { label: "Stats" },
        { label: "Accessibility Statement" },
        { label: "Settings", href: `${base}/settings` },
      ]}
    />
  );
}
