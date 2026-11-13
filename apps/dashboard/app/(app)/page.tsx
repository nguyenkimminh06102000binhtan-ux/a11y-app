import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db, sites, eq } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { InstallCode } from "@/components/InstallCode";
import { addSite, deleteSite } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like a valid domain. Try something like shop.com.",
  duplicate: "You've already added that domain.",
};

export const metadata: Metadata = { title: "Sites" };

// No async, no await: this whole shell is prerendered.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main id="main">
      <PageHeader title="Sites" />


      <section aria-labelledby="install-heading">
        <h2 id="install-heading">Install the widget</h2>
        <p>Paste this once on every site you add below. It&apos;s the same code for all of them.</p>
        <Suspense fallback={<p>Loading install code…</p>}>
          <InstallCode />
        </Suspense>
      </section>

      <section aria-labelledby="add-site-heading">
        <h2 id="add-site-heading">Add a site</h2>
        <Suspense fallback={null}>
          <AddSiteError searchParams={searchParams} />
        </Suspense>
        <form action={addSite}>
          <label htmlFor="domain">Domain</label>
          <input id="domain" name="domain" placeholder="shop.com" required />
          <button type="submit">Add site</button>
        </form>
      </section>

      <section aria-labelledby="sites-heading">
        <Suspense
          fallback={
            <>
              <h2 id="sites-heading">Your sites</h2>
              <p>Loading sites…</p>
            </>
          }
        >
          <SiteList />
        </Suspense>
      </section>
    </main>
  );
}

async function AddSiteError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error || !ERRORS[error]) return null;
  return <p role="alert">{ERRORS[error]}</p>;
}

async function SiteList() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(sites)
    .where(eq(sites.accountId, user.id))
    .orderBy(sites.createdAt);

  return (
    <>
      <h2 id="sites-heading">Your sites ({rows.length})</h2>
      {rows.length === 0 ? (
        <p>No sites yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((site) => (
            <Card as="li" key={site.id} className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 break-all">
                <Link href={`/sites/${site.id}`}>{site.domain}</Link>
              </h3>

              <form action={deleteSite}>
                <input type="hidden" name="id" value={site.id} />
                <Button type="submit" variant="secondary" aria-label={`Delete ${site.domain}`}>
                  Delete
                </Button>
              </form>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}