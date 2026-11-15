import { db, sites, eq, and } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/sites/:id/widget-status → { seenAt: ISO time | null }: when the widget was last seen on one of the
 * signed-in account's sites. Asked every few seconds by the Embed code page while it waits for a new site.
 * Another account's site is a 404.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]/widget-status">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  const [site] = await db
    .select({ seenAt: sites.widgetSeenAt })
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.accountId, user.id))); // ownership check
  if (!site) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });

  return Response.json({ seenAt: site.seenAt?.toISOString() ?? null }, { headers: NO_STORE });
}
