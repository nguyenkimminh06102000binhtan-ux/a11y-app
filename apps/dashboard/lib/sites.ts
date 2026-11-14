import { cache } from "react";
import { redirect } from "next/navigation";
import { db, sites, eq } from "@app/db";
import { getCurrentUser } from "./auth";

/** The signed-in account's sites, by domain (for the site switcher). cache() = once per request. */
export const getAccountSites = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return db.select({ id: sites.id, domain: sites.domain }).from(sites).where(eq(sites.accountId, user.id)).orderBy(sites.domain);
});
