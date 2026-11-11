import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db, sites, eq } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addSite, deleteSite } from "./actions";

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
              <h3>{site.domain}</h3>
              <p>Embed code:</p>
              <pre>
                <code>{`<script src="https://cdn.example.com/l.js" data-site="${site.siteKey}" async></script>`}</code>
              </pre>
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
