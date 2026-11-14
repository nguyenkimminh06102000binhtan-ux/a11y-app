import { Suspense } from "react";
import type { Metadata } from "next";
import { db, widgetSettings, eq } from "@app/db";
import { readSiteSettings } from "@app/widget-config";
import { getOwnedSite } from "@/lib/site";
import { deleteSite } from "@/app/actions";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { WidgetSettingsForm } from "./WidgetSettingsForm";

export const metadata: Metadata = { title: "Settings · Widget" };

/** Widget › Settings: the widget's color and what's on by default, for this site. */
export default function SettingsPage({ params }: PageProps<"/sites/[id]/widget/settings">) {
  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="mt-0">Settings</h2>
      <Suspense fallback={<p>Loading settings…</p>}>
        <Settings params={params} />
      </Suspense>
    </section>
  );
}

async function Settings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site

  // No row yet = our defaults
  const [widgetRow] = await db
    .select({ settings: widgetSettings.settings })
    .from(widgetSettings)
    .where(eq(widgetSettings.siteId, site.id));

  return (
    <>
      <WidgetSettingsForm siteId={site.id} settings={readSiteSettings(widgetRow?.settings)} />
      {/* TEMPORARY home for Delete (it left the Sites list). Chunk 8 replaces it with a safe delete in site settings. */}
      <Card title="Delete this site" headingLevel={3} className="mt-8">
        <p className="mt-0">Removes {site.domain}, its pages, scans and widget settings. This can&apos;t be undone.</p>
        <form action={deleteSite}>
          <input type="hidden" name="id" value={site.id} />
          <SubmitButton variant="secondary" pendingLabel="Deleting…" className="wrap-anywhere">
            Delete {site.domain}
          </SubmitButton>
        </form>
      </Card>
    </>
  );
}
