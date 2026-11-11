"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, sites, eq, and } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeDomain } from "@/lib/domain";

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
      siteKey: `site_${randomBytes(12).toString("base64url")}`,
    })
    .onConflictDoNothing()
    .returning({ id: sites.id });

  if (inserted.length === 0) redirect("/?error=duplicate");

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

  revalidatePath("/");
}