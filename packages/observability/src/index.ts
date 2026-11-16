/*
 * Error reporting (Sentry), shared by the dashboard and the worker: when it's on, what it may collect, and a
 * scrubber every event and breadcrumb goes through before it leaves our servers or the owner's browser.
 * No Sentry import here: the apps pass these to their own SDK, so this stays a few small, testable functions.
 */

/**
 * Sentry v11 collects user info, cookies, headers, request bodies, query parameters and local variable values by
 * default. We send none of that: errors, stack traces and where they happened are enough.
 */
export const PRIVATE_DATA_COLLECTION = {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { allow: ["user-agent", "content-type", "accept-language"] }, response: false },
    httpBodies: [] as never[],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
};

/** Reporting is on only in deployed production and preview, and only when a DSN is set: never in dev or tests. */
export function reportingEnabled(dsn: string | undefined, environment: string | undefined): boolean {
    return !!dsn && (environment === "production" || environment === "preview");
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const SUPABASE_SECRET = /\bsb_secret_[A-Za-z0-9_-]+/g;
/** Auth values in addresses: Supabase links (token_hash, code), OAuth (access_token, refresh_token, state…). */
const URL_SECRETS = /([?&#](?:token_hash|token|code|access_token|refresh_token|provider_token|id_token|state|password|apikey|api_key)=)[^&#\s"']*/gi;
const DROP_KEYS = new Set(["cookies", "cookie", "authorization", "set-cookie", "user", "data", "query_string", "password", "token"]);
const MAX_DEPTH = 10;

/** One string with emails, tokens, keys and auth values in addresses replaced. */
export function scrubText(text: string): string {
    return text
        .replace(URL_SECRETS, "$1[filtered]")
        .replace(JWT, "[token]")
        .replace(BEARER, "$1 [token]")
        .replace(SUPABASE_SECRET, "[secret]")
        .replace(EMAIL, "[email]");
}

function walk(value: unknown, depth: number): unknown {
    if (typeof value === "string") return scrubText(value);
    if (!value || typeof value !== "object" || depth > MAX_DEPTH) return value;
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        if (DROP_KEYS.has(key.toLowerCase())) continue; // never sent, whatever the SDK put there
        out[key] = walk(item, depth + 1);
    }
    return out;
}

/** A Sentry event or breadcrumb, scrubbed (a copy: the original isn't changed). For beforeSend and beforeBreadcrumb. */
export function scrub<T>(event: T): T {
    return walk(event, 0) as T;
}
