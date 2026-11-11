import { redirect } from "next/navigation";
import { db, sites, eq } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function Home() {
  return (
    <main>
      <h1>a11y-app</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db.select().from(sites).where(eq(sites.accountId, user.id));

  return (
    <>
      <p>Signed in as {user.email}</p>
      <p>Sites: {rows.length}</p>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}