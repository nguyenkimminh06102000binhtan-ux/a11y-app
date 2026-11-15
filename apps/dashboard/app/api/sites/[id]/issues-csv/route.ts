import { db, sites, eq, and } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { csvFilename, getReport, toCsv } from "@/lib/report";

/**
 * GET /api/sites/:id/issues-csv: the site's open issues as a CSV download (Audit › Reports).
 * Signed-in owner only; another account's site is a 404. Never cached: it's the issues as of now.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/sites/[id]/issues-csv">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.", { status: 401, headers: { "Cache-Control": "no-store" } });

  const { id } = await params;
  const site = isUuid(id)
    ? (
        await db
          .select({ id: sites.id, domain: sites.domain })
          .from(sites)
          .where(and(eq(sites.id, id), eq(sites.accountId, user.id))) // ownership check
      )[0]
    : undefined;
  if (!site) return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });

  const report = await getReport(site);
  return new Response(toCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(site.domain, new Date())}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
