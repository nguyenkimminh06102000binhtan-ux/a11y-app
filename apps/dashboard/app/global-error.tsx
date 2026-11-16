"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * The last resort: an error in the root layout itself. It replaces the whole page, so it brings its own <html> and
 * <body> and plain styles (the app's CSS may be what failed). The error is reported (lib/sentry-options.ts).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#1c1a33", background: "#fff" }}>
                <main style={{ maxWidth: "36rem", padding: "2rem 1rem", margin: "0 auto" }}>
                    <h1 style={{ fontSize: "1.5rem" }}>Something went wrong</h1>
                    <p style={{ lineHeight: 1.5 }}>The page couldn&apos;t load. We&apos;ve been told about it. Please try again in a moment.</p>
                    <button
                        type="button"
                        onClick={() => retry()}
                        style={{ font: "inherit", minHeight: "44px", padding: "0 1.25rem", border: "2px solid #1c1a33", borderRadius: "0.5rem", background: "#fff", color: "#1c1a33", cursor: "pointer" }}
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
