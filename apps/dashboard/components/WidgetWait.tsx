"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/WidgetStatus";

const POLL_MS = 5000;
const GIVE_UP_MS = 15 * 60 * 1000;

type State = "waiting" | "seen" | "gave-up";

/**
 * After adding a site, on Embed code: waits for the widget to be seen on it ("open the site in another tab"),
 * asking every 5 seconds for up to 15 minutes, then offers "Check again". The status text lives in one
 * always-present live region, so screen readers hear the change to "working" once, politely.
 */
export function WidgetWait({ siteId, domain, seen }: { siteId: string; domain: string; seen: boolean }) {
  const [state, setState] = useState<State>(seen ? "seen" : "waiting");
  const [round, setRound] = useState(0); // "Check again" starts a new round

  useEffect(() => {
    if (state !== "waiting") return;
    const started = Date.now();
    let stopped = false;
    const timer = setInterval(async () => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        if (!stopped) setState("gave-up");
        return;
      }
      try {
        const response = await fetch(`/api/sites/${siteId}/widget-status`, { cache: "no-store" });
        if (!response.ok) return;
        const { seenAt } = (await response.json()) as { seenAt: string | null };
        if (seenAt && !stopped) setState("seen");
      } catch {
        // offline: try again next time
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [state, round, siteId]);

  return (
    <div className={`flex flex-col gap-2 rounded-xl border-[1.5px] p-4 ${state === "seen" ? "border-line" : "border-state"}`}>
      <p role="status" className="m-0 flex items-start gap-2">
        {state === "seen" && <CheckIcon />}
        <span>
          {state === "seen" && (
            <>
              The widget is working on <strong className="wrap-anywhere">{domain}</strong>.
            </>
          )}
          {state === "waiting" && (
            <>
              Waiting for the widget on <strong className="wrap-anywhere">{domain}</strong>… Paste the code on the site,
              then open {domain} in another tab. This updates by itself.
            </>
          )}
          {state === "gave-up" && (
            <>
              The widget hasn&apos;t been seen on <strong className="wrap-anywhere">{domain}</strong> yet. Check that the
              code is on every page and published, open the site, then check again.
            </>
          )}
        </span>
      </p>
      {state === "gave-up" && (
        <div>
          <Button
            onClick={() => {
              setRound((n) => n + 1);
              setState("waiting");
            }}
          >
            Check again
          </Button>
        </div>
      )}
    </div>
  );
}
