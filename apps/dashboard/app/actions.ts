"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db, sites, eq, and, scans, inArray } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeDomain } from "@/lib/domain";
import { isUuid } from "@/lib/ids";
import { widgetConfigTag } from "@/lib/widget-config";



export async function addSite(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) redirect("/?error=invalid");

  const inserted = await db
    .insert(sites)
    .values({
      accountId: user.id,
      domain,
    })
    .onConflictDoNothing()
    .returning({ id: sites.id });

  if (inserted.length === 0) redirect("/?error=duplicate");
    updateTag(widgetConfigTag(user.id)); // the widget shows on the new domain right away

  revalidatePath("/");
  redirect("/");
}

export async function deleteSite(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  await db
    .delete(sites)
    .where(and(eq(sites.id, id), eq(sites.accountId, user.id)));
  
    updateTag(widgetConfigTag(user.id)); // and stops showing on the removed one

  revalidatePath("/");
}

export async function requestScan(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = String(formData.get("siteId") ?? "");
  if (!isUuid(siteId)) redirect("/");

  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.accountId, user.id)));
  if (!site) redirect("/");

  const back = `/sites/${site.id}`;

  let url: URL;
  try {
    url = new URL(String(formData.get("url") ?? "").trim());
  } catch {
    redirect(`${back}?error=url`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") redirect(`${back}?error=url`);

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== site.domain && !host.endsWith(`.${site.domain}`)) redirect(`${back}?error=domain`);

  const pending = await db
    .select({ id: scans.id })
    .from(scans)
    .where(and(eq(scans.siteId, site.id), inArray(scans.status, ["queued", "running"])))
    .limit(1);
  if (pending.length) redirect(`${back}?error=busy`);

  await db.insert(scans).values({ siteId: site.id, url: url.toString(), status: "queued" });

  revalidatePath(back);
  redirect(back);
}