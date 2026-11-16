import { PRIVATE_DATA_COLLECTION, reportingEnabled, scrub } from "@app/observability";

/*
 * Sentry for the dashboard: errors only (no tracing, no session replay), nothing personal (see
 * @app/observability), on only in deployed production and preview with a DSN set. Used by instrumentation.ts
 * (server, edge) and instrumentation-client.ts (browser).
 */
export function sentryOptions(environment: string | undefined) {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    return {
        dsn,
        enabled: reportingEnabled(dsn, environment),
        environment,
        tracesSampleRate: 0,
        dataCollection: PRIVATE_DATA_COLLECTION,
        beforeSend: <T>(event: T) => scrub(event),
        beforeBreadcrumb: <T>(breadcrumb: T) => scrub(breadcrumb),
    };
}
