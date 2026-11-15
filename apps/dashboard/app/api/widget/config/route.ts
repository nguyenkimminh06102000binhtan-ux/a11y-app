import { after, type NextRequest } from "next/server";
import { getWidgetConfig, isWidgetKey, normalizeHost } from "@/lib/widget-config";
import { markWidgetSeen, originMatches } from "@/lib/widget-seen";

/*
 * GET /api/widget/config?account=acct_…&host=shop.com
 * Read by the widget on customers' pages. Public and read-only: any website may read it (CORS *),
 * no cookies, nothing personal in it. The proxy lets it through without the login redirect.
 */
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const widgetKey = params.get("account") ?? "";
    const host = normalizeHost(params.get("host") ?? "");

    if (!isWidgetKey(widgetKey) || !host) {
        return Response.json(
            { error: "Expected ?account=acct_…&host=example.com" },
            { status: 400, headers: { ...CORS, "Cache-Control": "no-store" } }
        );
    }

    try {
        const config = await getWidgetConfig(widgetKey, host);
        // Asked by a browser on the site itself: the widget is installed there. Noted after answering, so the
        // widget never waits for it (and a failed write never affects the answer).
        if (config.enabled && originMatches(request.headers.get("origin"), host)) {
            after(() => markWidgetSeen(widgetKey, host).catch((error) => console.error("[widget-seen]", error)));
        }
        return Response.json(config, {
            headers: {
                ...CORS,
                // Changes in the dashboard should show within seconds (our own cache is cleared on save):
                // browsers ask again on every page view; CDNs answer from their copy for 5 seconds, then ask us.
                // No stale-while-revalidate: browsers apply it too, which shows the old answer one more time.
                "Cache-Control": "public, max-age=0, s-maxage=5",
            },
        });

    } catch (error) {
        console.error("[widget-config]", error);
        // Never cached: the widget falls back to its defaults and asks again next time
        return Response.json({ error: "Unavailable" }, { status: 503, headers: { ...CORS, "Cache-Control": "no-store" } });
    }
}
