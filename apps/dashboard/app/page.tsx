import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db, sites, accounts, eq } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "@/components/CopyButton";
import { addSite, deleteSite } from "./actions";

const WIDGET_SRC = "https://cdn.example.com/l.js"; // replaced with the real CDN URL in step 9

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like a valid domain. Try something like shop.com.",
  duplicate: "You've already added that domain.",
};

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// No async, no await: this whole shell is prerendered.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main>
      <header>
        <h1>a11y-app</h1>
        <Suspense fallback={null}>
          <UserInfo />
        </Suspense>
      </header>

      <section aria-labelledby="install-heading">
        <h2 id="install-heading">Install the widget</h2>
        <p>Paste this once on every site you add below. It's the same code for all of them.</p>
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

async function UserInfo() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <>
      <p>Signed in as {user.email}</p>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </>
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
    return <p role="alert">We couldn't load your account. Please sign out and sign in again.</p>;
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
        <ul>
          {rows.map((site) => (
            <li key={site.id}>
              <h3><Link href={`/sites/${site.id}`}>{site.domain}</Link></h3>
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