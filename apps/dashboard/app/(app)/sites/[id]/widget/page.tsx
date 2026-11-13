import { Suspense } from "react";
import { db, widgetSettings, eq } from "@app/db";
import { readSiteSettings } from "@app/widget-config";
import { getOwnedSite } from "@/lib/site";
import { InstallCode } from "@/components/InstallCode";
import { WidgetSettingsForm } from "./WidgetSettingsForm";

/** A site's Widget section: the install code and the widget's settings. Header and tabs: ../layout.tsx */
export default function WidgetPage({ params }: PageProps<"/sites/[id]/widget">) {
  return (
    <>
      <section aria-labelledby="install-heading">
        <h2 id="install-heading" className="mt-0">Install the widget</h2>
        <p>Paste this once on every page of the site, just before &lt;/body&gt;. It&apos;s the same code for all your sites.</p>
        <Suspense fallback={<p>Loading install code…</p>}>
          <InstallCode />
        </Suspense>
      </section>

      <section aria-labelledby="settings-heading">
        <h2 id="settings-heading">Settings</h2>
        <Suspense fallback={<p>Loading settings…</p>}>
          <Settings params={params} />
        </Suspense>
      </section>
    </>
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
