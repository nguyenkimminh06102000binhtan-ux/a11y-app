import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db, sites, accounts, eq } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { CopyButton } from "@/components/CopyButton";
import { addSite, deleteSite } from "@/app/actions";

// Customers paste this URL into their sites, so it must never change: new releases ship behind the same name.
const WIDGET_SRC = "https://cdn.accesspilot.org/l.js";

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like a valid domain. Try something like shop.com.",
  duplicate: "You've already added that domain.",
};

// No async, no await: this whole shell is prerendered.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main id="main">
      <h1>Sites</h1>


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

async function InstallCode() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [account] = await db
    .select({ widgetKey: accounts.widgetKey })
    .from(accounts)
    .where(eq(accounts.id, user.id));

  // the auth callback creates this row; if that failed, don't crash the page
  if (!account) {
    return <p role="alert">We couldn&apos;t load your account. Please sign out and sign in again.</p>;
  }

  const snippet = `<script src="${WIDGET_SRC}" data-account="${account.widgetKey}" async></script>`;

  return (
    <>
      <pre>
        <code>{snippet}</code>
      </pre>
      <CopyButton text={snippet} label="Copy install code" />
    </>
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
            <li key={site.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-frame p-4">
              <h3 className="min-w-0 break-all">
                <Link href={`/sites/${site.id}`}>{site.domain}</Link>
              </h3>

              <form action={deleteSite}>
                <input type="hidden" name="id" value={site.id} />
                <button type="submit" aria-label={`Delete ${site.domain}`}>
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}