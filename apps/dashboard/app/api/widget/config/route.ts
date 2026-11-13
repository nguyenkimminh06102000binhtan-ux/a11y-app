import { type NextRequest } from "next/server";
import { getWidgetConfig, isWidgetKey, normalizeHost } from "@/lib/widget-config";

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
        return Response.json(config, {
            headers: {
                ...CORS,
                "Cache-Control": config.enabled
                    ? // Browsers keep it 5 minutes; CDNs 1 minute, then may serve the old copy for up to a day while refreshing it.
                    "public, max-age=300, s-maxage=60, stale-while-revalidate=86400"
                    : // "Not one of the account's sites" usually means the owner is about to add it: keep it only briefly,
                    // so a reload right after adding the site shows the widget.
                    "public, max-age=30, s-maxage=10",
            },
        });

    } catch (error) {
        console.error("[widget-config]", error);
        // Never cached: the widget falls back to its defaults and asks again next time
        return Response.json({ error: "Unavailable" }, { status: 503, headers: { ...CORS, "Cache-Control": "no-store" } });
    }
}
