import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db, sites, eq, and } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { InstallCode } from "@/components/InstallCode";
import { FocusedAlert } from "@/components/FocusedAlert";
import { WidgetWait } from "@/components/WidgetWait";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonCards } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Embed code" };

/**
 * Embed code: the account's one install line (the same for every site) and how to add it.
 * ?added=<site id> (after Add site) says which site was just added.
 */
export default function EmbedCodePage({ searchParams }: PageProps<"/embed-code">) {
  return (
    <main id="main">
      <PageHeader title="Embed code" description="One line turns on the widget. It's the same for every site in your account." />

      <Suspense fallback={null}>
        <Added searchParams={searchParams} />
      </Suspense>

      <Card title="Your embed code">
        <Suspense
          fallback={
            <Skeleton label="Loading embed code…">
              <SkeletonCards count={1} />
            </Skeleton>
          }
        >
          <InstallCode />
        </Suspense>
      </Card>

      <section aria-labelledby="how-heading" className="mt-6">
        <h2 id="how-heading">How to add it</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>Copy the code above.</li>
          <li>
            Paste it once on every page of your site, just before <code>&lt;/body&gt;</code>. Most site builders have a
            place for code on every page, often called “footer code” or “custom code”.
          </li>
          <li>Publish. The widget then appears on the sites you&apos;ve added.</li>
        </ol>
        <p className="mt-4">
          A subdomain such as blog.shop.com is a separate site: add it on Sites, with its own plan, and the same code
          works there too.
        </p>
      </section>
    </main>
  );
}

/** "brand.com is added": only for one of this account's sites, so the link can't show someone else's domain. */
async function Added({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { added } = await searchParams;
  if (typeof added !== "string" || !isUuid(added)) return null;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [site] = await db
    .select({ domain: sites.domain, seenAt: sites.widgetSeenAt })
    .from(sites)
    .where(and(eq(sites.id, added), eq(sites.accountId, user.id)));
  if (!site) return null;
  return (
    <div className="mb-6 flex flex-col gap-3">
      <FocusedAlert key={added} tone="success">
        <strong className="wrap-anywhere">{site.domain}</strong> is added. Paste this code on it to turn on the widget.
      </FocusedAlert>
      {/* Then: "Waiting for the widget on brand.com…" until it's seen there */}
      <WidgetWait key={`wait-${added}`} siteId={added} domain={site.domain} seen={!!site.seenAt} />
    </div>
  );
}
