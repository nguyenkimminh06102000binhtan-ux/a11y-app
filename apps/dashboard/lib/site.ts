import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { db, sites, eq, and } from "@app/db";
import { getCurrentUser } from "./auth";
import { isUuid } from "./ids";

/**
 * The site with this id, if it belongs to the signed-in user: otherwise the login page or a 404.
 * cache() = one query per request, however many layouts and pages ask for it.
 */
export const getOwnedSite = cache(async (id: string) => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isUuid(id)) notFound(); // a malformed id would otherwise crash the database query

  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.accountId, user.id))); // ownership check
  if (!site) notFound();
  return site;
});
