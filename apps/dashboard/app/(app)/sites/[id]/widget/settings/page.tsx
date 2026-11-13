import { Suspense } from "react";
import type { Metadata } from "next";
import { db, widgetSettings, eq } from "@app/db";
import { readSiteSettings } from "@app/widget-config";
import { getOwnedSite } from "@/lib/site";
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

  return <WidgetSettingsForm siteId={site.id} settings={readSiteSettings(widgetRow?.settings)} />;
}
