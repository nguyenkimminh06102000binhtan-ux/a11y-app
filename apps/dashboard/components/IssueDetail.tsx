import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { ImpactPill } from "@/components/ImpactPill";
import { FocusHeading } from "@/components/FocusHeading";
import { pageLabel } from "@/lib/page-label";
import type { RuleGroup } from "@/lib/issues";

type Props = {
  group: RuleGroup;
  place: number; // 1-based, already within range
  domain: string;
  placeHref: (place: number) => string;
  focus: boolean; // the owner just picked this issue or place: move focus to the heading
};

/**
 * One problem in detail: where it is (one place at a time, with Previous / Next), the code, and how to fix it.
 * An <article> named by its heading; the heading takes focus when it's opened from the list.
 */
export function IssueDetail({ group, place, domain, placeHref, focus }: Props) {
  const issue = group.places[place - 1];
  const total = group.places.length;
  const headingId = "issue-detail-heading";

  return (
    <article aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4 rounded-xl border border-line p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <span>
          <ImpactPill impact={group.impact} />
        </span>
        {/* Keyed by rule and place: picking another one focuses the heading again */}
        <FocusHeading key={`${group.ruleId}-${place}`} id={headingId} focus={focus} className="text-xl wrap-anywhere">
          {group.title}
        </FocusHeading>
        <p className="text-small text-muted">
          Rule {group.ruleId} · {total} {total === 1 ? "place" : "places"} on {group.pages} {group.pages === 1 ? "page" : "pages"}
        </p>
      </div>

      <section aria-labelledby="where-heading" className="flex flex-col gap-2">
        <h4 id="where-heading" className="font-bold">
          Where to fix: place {place} of {total}
        </h4>
        <p className="flex flex-wrap items-center gap-x-1 wrap-anywhere">
          Page:{" "}
          <a href={issue.pageUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">
            {pageLabel(issue.pageUrl, domain)}
            <span className="sr-only"> (opens in a new tab)</span>
            <span aria-hidden="true"> ↗</span>
          </a>
        </p>
        <p className="text-small text-muted">Element (CSS selector)</p>
        <code className="block rounded-[0.625rem] border border-line bg-subtle px-3 py-2 wrap-anywhere">{issue.selector}</code>
        <p className="text-small text-muted">Its HTML</p>
        <pre className="mb-0 px-3 py-2 whitespace-pre-wrap wrap-anywhere">
          <code>{issue.html}</code>
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={issue.selector} label="Copy selector" />
          <CopyButton text={`inspect(document.querySelector(${JSON.stringify(issue.selector)}))`} label="Copy DevTools command" />
        </div>
        {total > 1 && (
          <nav aria-label="Places" className="flex flex-wrap items-center gap-x-4">
            {place > 1 ? (
              <Link href={placeHref(place - 1)} scroll={false} className="inline-flex min-h-11 items-center">
                ← Previous place
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center text-muted">← Previous place</span>
            )}
            {place < total ? (
              <Link href={placeHref(place + 1)} scroll={false} className="inline-flex min-h-11 items-center">
                Next place →
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center text-muted">Next place →</span>
            )}
          </nav>
        )}
      </section>

      <section aria-labelledby="fix-heading" className="flex flex-col gap-2 border-t border-line pt-4">
        <h4 id="fix-heading" className="font-bold">
          How to fix
        </h4>
        <p className="whitespace-pre-line wrap-anywhere">{issue.summary ?? group.title}</p>
        {group.helpUrl && (
          <p>
            <a href={group.helpUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center">
              Learn more about this rule
              <span className="sr-only"> (opens in a new tab)</span>
              <span aria-hidden="true"> ↗</span>
            </a>
          </p>
        )}
      </section>
    </article>
  );
}
