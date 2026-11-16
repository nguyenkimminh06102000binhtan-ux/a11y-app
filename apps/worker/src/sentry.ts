import * as Sentry from "@sentry/node";
import { PRIVATE_DATA_COLLECTION, reportingEnabled, scrub } from "@app/observability";

/*
 * Error reporting for the worker: errors only, nothing personal (@app/observability), on only when SENTRY_DSN is
 * set and SENTRY_ENVIRONMENT is production or preview. Imported first in worker.ts, before anything it watches.
 */
const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT;

Sentry.init({
    dsn,
    enabled: reportingEnabled(dsn, environment),
    environment,
    tracesSampleRate: 0,
    dataCollection: PRIVATE_DATA_COLLECTION,
    beforeSend: (event) => scrub(event),
    beforeBreadcrumb: (breadcrumb) => scrub(breadcrumb),
});

export { Sentry };
