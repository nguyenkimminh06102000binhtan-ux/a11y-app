"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db, sites, pages, widgetSettings, eq, and, scans, inArray, sql } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeDomain, normalizePageUrl } from "@/lib/domain";
import { getPagesScannedThisMonth } from "@/lib/pages";
import { getMonthlyPageLimit, pagesUsedThisMonth } from "@/lib/quota";
import { isUuid } from "@/lib/ids";
import { widgetConfigTag } from "@/lib/widget-config";
import * as v from "valibot";
import { DefaultSettingsSchema, SETTINGS_VERSION, StateColorSchema, type SiteSettings } from "@app/widget-config";




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

  // Every site starts with its homepage on Audit › Pages
  await db.insert(pages).values({ siteId: inserted[0].id, url: `https://${domain}/` }).onConflictDoNothing();

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

export type ScanPagesState = {
  error?: "none-selected" | "gone" | "busy" | "over-limit";
  needed?: number; // over-limit: new pages the selection needs
  left?: number; // over-limit: pages left this month
  at?: number; // makes each result a new message, so it's announced again
};

/**
 * Start a scan run: the chosen pages of one site, checked one after another by the worker (one queued scan per page,
 * sharing a batch id). Enforces the monthly limit: pages already used this month rescan free; new pages need slots
 * left. Checked inside a transaction that locks the site's row, so two clicks at once can't both get past it.
 */
export async function scanPages(_previous: ScanPagesState, formData: FormData): Promise<ScanPagesState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = String(formData.get("siteId") ?? "");
  if (!isUuid(siteId)) redirect("/");
  const [site] = await db
    .select({ id: sites.id, monthlyPageLimit: sites.monthlyPageLimit })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.accountId, user.id))); // ownership check
  if (!site) redirect("/");

  const pageIds = [...new Set(formData.getAll("pageId").map(String).filter(isUuid))];
  if (pageIds.length === 0) return { error: "none-selected", at: Date.now() };
  const chosen = await db
    .select({ url: pages.url })
    .from(pages)
    .where(and(eq(pages.siteId, site.id), inArray(pages.id, pageIds))); // only this site's pages
  if (chosen.length !== pageIds.length) return { error: "gone", at: Date.now() }; // removed meanwhile

  const result = await db.transaction(async (tx): Promise<ScanPagesState | { started: string }> => {
    await tx.execute(sql`SELECT id FROM sites WHERE id = ${site.id} FOR UPDATE`); // one start at a time per site

    const running = await tx
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.siteId, site.id), inArray(scans.status, ["queued", "running"])))
      .limit(1);
    if (running.length) return { error: "busy" };

    const used = await pagesUsedThisMonth(tx, site.id);
    const left = Math.max(0, getMonthlyPageLimit(site) - used.size);
    const needed = chosen.filter((p) => !used.has(p.url)).length;
    if (needed > left) return { error: "over-limit", needed, left };

    const batchId = crypto.randomUUID();
    await tx.insert(scans).values(chosen.map((p) => ({ siteId: site.id, url: p.url, batchId, status: "queued" as const })));
    return { started: batchId };
  });
  if (!("started" in result)) return { ...result, at: Date.now() };

  revalidatePath(`/sites/${site.id}/audit`, "layout");
  // ?started= lets the progress card take focus for this run (and only this one)
  const back = formData.get("back") === "overview" ? `/sites/${site.id}/audit` : `/sites/${site.id}/audit/pages`;
  redirect(`${back}?started=${result.started}`);
}

export type WidgetSettingsState = {
  status: "idle" | "saved" | "invalid";
  errors?: { stateColor?: string }; // one message per field, shown next to it
  settings?: SiteSettings; // what was submitted, so the form keeps it (also when invalid)
};

/** Save one site's widget settings. Each field is checked by its schema from @app/widget-config. */
export async function saveWidgetSettings(_previous: WidgetSettingsState, formData: FormData): Promise<WidgetSettingsState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = String(formData.get("siteId") ?? "");
  if (!isUuid(siteId)) redirect("/");
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.accountId, user.id))); // ownership check
  if (!site) redirect("/");

  const errors: NonNullable<WidgetSettingsState["errors"]> = {};

  // Appearance: no color = our default
  const submittedColor = formData.get("colorChoice") === "custom" ? String(formData.get("stateColor") ?? "") : undefined;
  let stateColor: string | undefined;
  if (submittedColor !== undefined) {
    const color = v.safeParse(StateColorSchema, submittedColor);
    if (color.success) stateColor = color.output;
    else errors.stateColor = color.issues[0].message;
  }

  // On by default: unknown values are dropped, never an error
  const defaults = v.parse(DefaultSettingsSchema, formData.getAll("defaults").map(String));

  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, settings: { v: SETTINGS_VERSION, appearance: { stateColor: submittedColor }, defaults } };
  }

  const settings: SiteSettings = { v: SETTINGS_VERSION, appearance: stateColor ? { stateColor } : {}, defaults };
  await db
    .insert(widgetSettings)
    .values({ siteId: site.id, settings })
    .onConflictDoUpdate({ target: widgetSettings.siteId, set: { settings, updatedAt: new Date() } });

  updateTag(widgetConfigTag(user.id)); // the config endpoint answers with the new settings right away
  revalidatePath(`/sites/${site.id}/widget/settings`);
  return { status: "saved", settings };
}


const MAX_PAGES_PER_PASTE = 500;

export type AddPagesState = {
  status: "idle" | "done" | "error";
  error?: "empty" | "too-many";
  added?: number;
  duplicates?: number; // already on the list, or pasted twice
  subdomain?: string[]; // separate sites with their own plan
  otherDomain?: string[];
  invalid?: string[];
  at?: number; // makes each result a new message, so it's announced and focused again
};

/**
 * Audit › Pages › Add pages: pasted addresses (one per line, or separated by spaces or commas) go on the site's
 * list. Only the site's own domain is accepted; subdomains are separate sites. No limit on the list itself:
 * the plan limits how many different pages are scanned per month.
 */
export async function addPages(_previous: AddPagesState, formData: FormData): Promise<AddPagesState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const siteId = String(formData.get("siteId") ?? "");
  if (!isUuid(siteId)) redirect("/");
  const [site] = await db
    .select({ id: sites.id, domain: sites.domain })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.accountId, user.id))); // ownership check
  if (!site) redirect("/");

  const entries = String(formData.get("urls") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (entries.length === 0) return { status: "error", error: "empty", at: Date.now() };
  if (entries.length > MAX_PAGES_PER_PASTE) return { status: "error", error: "too-many", at: Date.now() };

  const valid = new Set<string>();
  const subdomain: string[] = [];
  const otherDomain: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  for (const entry of entries) {
    const result = normalizePageUrl(entry, site.domain);
    if ("url" in result) {
      if (valid.has(result.url)) duplicates++;
      else valid.add(result.url);
    } else if (result.error === "subdomain") subdomain.push(entry);
    else if (result.error === "domain") otherDomain.push(entry);
    else invalid.push(entry);
  }

  const inserted = valid.size
    ? await db
        .insert(pages)
        .values([...valid].map((url) => ({ siteId: site.id, url })))
        .onConflictDoNothing()
        .returning({ id: pages.id })
    : [];
  duplicates += valid.size - inserted.length;

  revalidatePath(`/sites/${site.id}/audit/pages`);
  return { status: "done", added: inserted.length, duplicates, subdomain, otherDomain, invalid, at: Date.now() };
}

/**
 * Audit › Pages › Remove: only pages not scanned this month. A page scanned this month uses the month's quota and
 * stays on the list until it resets (removing it would never give the slot back anyway).
 */
export async function removePage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pageId = String(formData.get("pageId") ?? "");
  if (!isUuid(pageId)) redirect("/");
  const [page] = await db
    .select({ id: pages.id, url: pages.url, siteId: pages.siteId })
    .from(pages)
    .innerJoin(sites, eq(sites.id, pages.siteId))
    .where(and(eq(pages.id, pageId), eq(sites.accountId, user.id))); // ownership check
  if (!page) redirect("/");

  const back = `/sites/${page.siteId}/audit/pages`;
  if ((await getPagesScannedThisMonth(page.siteId)).has(page.url)) redirect(`${back}?error=locked`);

  await db.delete(pages).where(eq(pages.id, page.id));
  revalidatePath(back);
  redirect(`${back}?removed=${encodeURIComponent(page.url)}&n=${Date.now()}`);
}
