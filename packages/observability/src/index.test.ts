import { test } from "node:test";
import assert from "node:assert/strict";
import { PRIVATE_DATA_COLLECTION, reportingEnabled, scrub, scrubText } from "./index.ts";

test("emails, tokens, keys and auth values in addresses are removed from text", () => {
    assert.equal(scrubText("No account for maria.lopez+shop@example.co.uk"), "No account for [email]");
    assert.equal(
        scrubText("GET /auth/confirm?token_hash=abc123&type=recovery&next=/sites"),
        "GET /auth/confirm?token_hash=[filtered]&type=recovery&next=/sites"
    );
    assert.equal(scrubText("/auth/callback?code=4f1e-9a&state=xyz"), "/auth/callback?code=[filtered]&state=[filtered]");
    assert.equal(scrubText("#access_token=eyJabc&refresh_token=r1"), "#access_token=[filtered]&refresh_token=[filtered]");
    assert.equal(scrubText("jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"), "jwt [token]");
    assert.equal(scrubText("Authorization: Bearer abc.def-123"), "Authorization: Bearer [token]");
    assert.equal(scrubText("key sb_secret_AbC123-xyz"), "key [secret]");
});

test("useful details stay: messages, stack frames, ids, paths without secrets", () => {
    const text = "TypeError: Cannot read properties of undefined (reading 'domain') at /sites/9b1c…/audit";
    assert.equal(scrubText(text), text);
    assert.equal(scrubText("/api/widget/config?account=acct_123&host=shop.com"), "/api/widget/config?account=acct_123&host=shop.com");
});

test("a whole event: cookies, user, headers' secrets and request bodies are dropped; nested strings scrubbed", () => {
    const event = {
        message: "Sign-in failed for owner@shop.com",
        user: { email: "owner@shop.com", ip_address: "1.2.3.4" },
        request: {
            url: "https://manage.accesspilot.org/auth/confirm?token_hash=secret",
            cookies: { "sb-access-token": "x" },
            headers: { Authorization: "Bearer x", "User-Agent": "Mozilla" },
            data: { password: "hunter2" },
        },
        exception: { values: [{ type: "Error", value: "owner@shop.com not found", stacktrace: { frames: [{ filename: "app/login/actions.ts", lineno: 12 }] } }] },
        breadcrumbs: [{ message: "fetch /auth/callback?code=abc", data: { url: "/x?code=abc" } }],
    };
    const clean = scrub(event) as typeof event & { user?: unknown };
    assert.equal(clean.message, "Sign-in failed for [email]");
    assert.equal(clean.user, undefined);
    assert.equal(clean.request.url, "https://manage.accesspilot.org/auth/confirm?token_hash=[filtered]");
    assert.equal((clean.request as Record<string, unknown>).cookies, undefined);
    assert.equal((clean.request as Record<string, unknown>).data, undefined);
    assert.deepEqual(clean.request.headers, { "User-Agent": "Mozilla" });
    assert.equal(clean.exception.values[0].value, "[email] not found");
    assert.deepEqual(clean.exception.values[0].stacktrace, { frames: [{ filename: "app/login/actions.ts", lineno: 12 }] });
    assert.equal(clean.breadcrumbs[0].message, "fetch /auth/callback?code=[filtered]");
    assert.equal(event.message, "Sign-in failed for owner@shop.com"); // the original is untouched
});

test("only deployed production and preview report, and only with a DSN", () => {
    assert.equal(reportingEnabled("https://key@o1.ingest.de.sentry.io/1", "production"), true);
    assert.equal(reportingEnabled("https://key@o1.ingest.de.sentry.io/1", "preview"), true);
    assert.equal(reportingEnabled("https://key@o1.ingest.de.sentry.io/1", "development"), false);
    assert.equal(reportingEnabled(undefined, "production"), false);
    assert.equal(reportingEnabled("", "production"), false);
});

test("nothing personal is collected by the SDK in the first place", () => {
    assert.equal(PRIVATE_DATA_COLLECTION.userInfo, false);
    assert.equal(PRIVATE_DATA_COLLECTION.cookies, false);
    assert.equal(PRIVATE_DATA_COLLECTION.urlQueryParams, false);
    assert.equal(PRIVATE_DATA_COLLECTION.stackFrameVariables, false);
    assert.deepEqual(PRIVATE_DATA_COLLECTION.httpBodies, []);
});
