import Link from "next/link";
import { RelativeTime } from "@/components/RelativeTime";
import { widgetHealth } from "@/lib/widget-health";

/**
 * Above the Widget section: is the widget working on this site? From when it was last seen (a visit to the site
 * with the embed code on it). The words carry the state; the icon and edge only repeat it.
 */
export function WidgetStatus({ domain, seenAt }: { domain: string; seenAt: Date | null }) {
  const health = widgetHealth(seenAt);
  const name = <strong className="wrap-anywhere">{domain}</strong>;
  return (
    <div
      className={`mb-6 flex flex-col gap-1 rounded-xl border-[1.5px] p-4 ${health === "working" ? "border-line" : "border-state"}`}
    >
      {health === "working" && (
        <p className="m-0 flex items-start gap-2">
          <CheckIcon />
          <span>
            The widget is working on {name} · seen <RelativeTime iso={seenAt!.toISOString()} />
          </span>
        </p>
      )}
      {health === "stale" && (
        <p className="m-0">
          The widget was last seen on {name} <RelativeTime iso={seenAt!.toISOString()} />. Is the embed code still on the
          site? <Link href="/embed-code">Get the embed code</Link>
        </p>
      )}
      {health === "never" && (
        <p className="m-0">
          The widget hasn&apos;t been seen on {name} yet. Add the embed code to the site, then open it.{" "}
          <Link href="/embed-code">Get the embed code</Link>
        </p>
      )}
      <p className="m-0 text-small text-muted">This updates when someone visits the site.</p>
    </div>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0 text-state" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 10.5 L8.5 13.5 L14.5 7" />
    </svg>
  );
}
