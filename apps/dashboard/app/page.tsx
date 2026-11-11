import { Suspense } from "react";
import { connection } from "next/server";
import { db, sites } from "@app/db";

// With cacheComponents on, uncached data already runs per request.
// The static shell (h1) is prerendered; the DB part streams in at request time.
export default function Home() {
  return (
    <main>
      <h1>a11y-app</h1>
      <Suspense fallback={<p>Loading sites…</p>}>
        <SiteCount />
      </Suspense>
    </main>
  );
}

async function SiteCount() {
  await connection(); // explicitly opt this component into request-time rendering
  const rows = await db.select().from(sites); // SELECT * FROM sites
  return <p>Sites: {rows.length}</p>;
}
