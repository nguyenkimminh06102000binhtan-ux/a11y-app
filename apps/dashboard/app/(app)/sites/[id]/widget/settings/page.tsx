import { Suspense } from "react";
import type { Metadata } from "next";
import { db, pages, scans, eq, count } from "@app/db";
import { getOwnedSite } from "@/lib/site";
import { getSitePlan } from "@/lib/plan";
import { Card } from "@/components/ui/Card";
import { DeleteSite } from "@/components/DeleteSite";
import { Skeleton, SkeletonCards } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Settings · Widget" };

/** Widget › Settings: for now, deleting the site (only on Free: paid sites cancel their subscription first). */
export default function SettingsPage({ params }: PageProps<"/sites/[id]/widget/settings">) {
  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="mt-0">Settings</h2>
      <Suspense
        fallback={
          <Skeleton label="Loading settings…">
            <SkeletonCards count={1} />
          </Skeleton>
        }
      >
        <Settings params={params} />
      </Suspense>
    </section>
  );
}

async function Settings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const plan = getSitePlan(site);

  const [[{ pageCount }], [{ scanCount }]] = await Promise.all([
    db.select({ pageCount: count() }).from(pages).where(eq(pages.siteId, site.id)),
    db.select({ scanCount: count() }).from(scans).where(eq(scans.siteId, site.id)),
  ]);
  const n = (k: number, one: string, many: string) => `${k.toLocaleString("en-US")} ${k === 1 ? one : many}`;

  return (
    <Card title="Delete this site" headingLevel={3}>
      {plan.free ? (
        <>
          <p className="mt-0">
            Deletes <strong className="wrap-anywhere">{site.domain}</strong>, its {n(pageCount, "page", "pages")},{" "}
            {n(scanCount, "scan", "scans")} and widget settings. The widget stops showing on it. This can&apos;t be undone.
          </p>
          <DeleteSite siteId={site.id} domain={site.domain} />
        </>
      ) : (
        <p className="m-0">
          <strong className="wrap-anywhere">{site.domain}</strong> is on the {plan.name} plan. To delete it, first cancel
          its subscription in Billing. You can delete it once it&apos;s back on Free.
        </p>
      )}
    </Card>
  );
}
