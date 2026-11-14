import { Suspense } from "react";
import type { Metadata } from "next";
import { db, widgetSettings, eq } from "@app/db";
import { readSiteSettings } from "@app/widget-config";
import { getOwnedSite } from "@/lib/site";
import { WidgetSettingsForm } from "./WidgetSettingsForm";

export const metadata: Metadata = { title: "Customize · Widget" };

/** Widget › Customize: the widget's color and what's on by default, for this site. (Position comes later.) */
export default function CustomizePage({ params }: PageProps<"/sites/[id]/widget">) {
  return (
    <section aria-labelledby="customize-heading">
      <h2 id="customize-heading" className="mt-0">Customize</h2>
      <Suspense fallback={<p>Loading settings…</p>}>
        <Customize params={params} />
      </Suspense>
    </section>
  );
}

async function Customize({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site

  // No row yet = our defaults
  const [widgetRow] = await db
    .select({ settings: widgetSettings.settings })
    .from(widgetSettings)
    .where(eq(widgetSettings.siteId, site.id));

  return <WidgetSettingsForm siteId={site.id} settings={readSiteSettings(widgetRow?.settings)} />;
}
