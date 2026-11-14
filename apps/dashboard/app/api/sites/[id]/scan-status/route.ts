import { db, sites, eq, and } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { getLatestRun } from "@/lib/runs";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The latest scan run of one of the signed-in account's sites (pages done / failed / being checked), for the
 * progress card. Small on purpose: the card asks every few seconds. Another account's site is a 404.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]/scan-status">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.accountId, user.id))); // ownership check
  if (!site) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });

  const run = await getLatestRun(site.id);
  if (!run) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  return Response.json(run, { headers: NO_STORE });
}
