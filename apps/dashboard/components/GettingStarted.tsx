import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CheckIcon } from "@/components/WidgetStatus";
import type { Onboarding } from "@/lib/widget-seen";

type Step = { title: string; done: boolean; todo: React.ReactNode };

/**
 * On Sites until every step is done, then gone for good: add a site, install the widget, scan pages, customize.
 * Each step says "Done" or "To do" in words (not by color), and every step left has a way to do it.
 */
export function GettingStarted({ onboarding }: { onboarding: Onboarding }) {
  const site = onboarding.firstSiteId;
  const steps: Step[] = [
    { title: "Add your site", done: !!site, todo: <>Use Add site at the top of this page.</> },
    {
      title: "Install the widget",
      done: onboarding.installed,
      todo: (
        <>
          <Link href="/embed-code">Get the embed code</Link>, paste it on your site, then open the site.
        </>
      ),
    },
    {
      title: "Scan your pages",
      done: onboarding.scanned,
      todo: site ? <Link href={`/sites/${site}/audit/pages`}>Choose pages to scan</Link> : <>Add a site first.</>,
    },
    {
      title: "Make the widget yours",
      done: onboarding.customized,
      todo: site ? <Link href={`/sites/${site}/widget`}>Choose its color and position</Link> : <>Add a site first.</>,
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <Card title="Getting started" className="mb-6">
      <p className="mt-0 mb-3 text-muted">
        {done} of {steps.length} done
      </p>
      {/* role="list": Safari drops list semantics when the bullets are styled away */}
      <ol role="list" className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-small font-bold ${
                step.done ? "border-state bg-state-tint" : "border-frame"
              }`}
            >
              {step.done ? <CheckIcon /> : i + 1}
            </span>
            <div className="flex min-w-0 flex-col">
              <p className="m-0 font-bold">
                {step.title}{" "}
                <span className="font-normal whitespace-nowrap text-muted">· {step.done ? "Done" : "To do"}</span>
              </p>
              {!step.done && <p className="m-0 text-small">{step.todo}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
