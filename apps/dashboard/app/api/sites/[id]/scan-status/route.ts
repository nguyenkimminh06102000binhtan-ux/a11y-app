import { db, scans, sites, eq, and, desc } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The latest scan of one of the signed-in account's sites, for the progress card on Audit › Overview.
 * Small on purpose: the card asks every few seconds. Another account's site is a 404, as if it didn't exist.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]/scan-status">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });

  const [scan] = await db
    .select({ id: scans.id, status: scans.status, url: scans.url, issueCount: scans.issueCount, error: scans.error })
    .from(scans)
    .innerJoin(sites, eq(sites.id, scans.siteId))
    .where(and(eq(scans.siteId, id), eq(sites.accountId, user.id))) // ownership check
    .orderBy(desc(scans.createdAt))
    .limit(1);
  if (!scan) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });

  return Response.json(scan, { headers: NO_STORE });
}
