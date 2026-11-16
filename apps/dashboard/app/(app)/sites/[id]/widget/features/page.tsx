import { Suspense } from "react";
import type { Metadata } from "next";
import { db, widgetSettings, eq } from "@app/db";
import { readSiteSettings } from "@app/widget-config";
import { getOwnedSite } from "@/lib/site";
import { FeaturesForm } from "./FeaturesForm";
import { Skeleton, SkeletonForm } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Features · Widget" };

/** Widget › Features: what the panel shows, what's on by default, and whether visitors may hide the button. */
export default function FeaturesPage({ params }: PageProps<"/sites/[id]/widget/features">) {
  return (
    <section aria-labelledby="features-heading">
      <h2 id="features-heading" className="mt-0">Features</h2>
      <Suspense
        fallback={
          <Skeleton label="Loading features…">
            <SkeletonForm fields={8} />
          </Skeleton>
        }
      >
        <Features params={params} />
      </Suspense>
    </section>
  );
}

async function Features({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const [row] = await db.select({ settings: widgetSettings.settings }).from(widgetSettings).where(eq(widgetSettings.siteId, site.id));
  return <FeaturesForm siteId={site.id} settings={readSiteSettings(row?.settings)} />;
}
