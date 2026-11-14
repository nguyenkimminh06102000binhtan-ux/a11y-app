import Link from "next/link";
import Form from "next/form";
import { IMPACTS, issuesHref, type Impact, type IssueParams } from "@/lib/issues";
import { Combobox } from "@/components/ui/Combobox";

type Props = {
  base: string; // /sites/:id/audit/issues
  params: IssueParams;
  counts: Record<Impact, number>; // after the page and search filters, before impact
  pages: { id: string; label: string }[];
};

/**
 * Impact as links (each keeps the page and search filters), then a GET form for page (a searchable combobox:
 * sites can have many pages) and search. The form changes nothing until "Apply": changing the page on pick alone
 * would move people without asking
 * (WCAG 3.2.2). Everything lives in the URL, so filters can be bookmarked and Back works.
 */
export function IssueFilters({ base, params, counts, pages }: Props) {
  const total = IMPACTS.reduce((n, i) => n + counts[i], 0);
  const keep = { page: params.page, q: params.q }; // a new impact starts a new selection
  const filtered = !!(params.impact || params.page || params.q);

  const pill = (label: string, count: number, impact: Impact | undefined) => {
    const current = params.impact === impact;
    return (
      <li key={label}>
        <Link
          href={issuesHref(base, { ...keep, impact })}
          scroll={false}
          aria-current={current ? "true" : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4 no-underline ${
            current ? "border-ink bg-ink font-bold text-surface" : "border-frame text-ink hover:bg-subtle"
          }`}
        >
          {/* Real capitals and a space, so the name reads "Serious 36 issues" (not "serious36") */}
          {label[0].toUpperCase() + label.slice(1)}{" "}
          <span className={current ? "" : "text-muted"}>
            {count}
            <span className="sr-only"> {count === 1 ? "issue" : "issues"}</span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Filter by impact">
        <ul className="flex flex-wrap gap-2">
          {pill("All", total, undefined)}
          {IMPACTS.map((impact) => pill(impact, counts[impact], impact))}
        </ul>
      </nav>

      <Form action={base} className="items-end gap-3">
        {params.impact && <input type="hidden" name="impact" value={params.impact} />}
        <div className="min-w-0 basis-64">
          <Combobox
            label="Page"
            name="page"
            defaultValue={params.page ?? ""}
            placeholder="All pages · type to find one"
            options={[{ value: "", label: "All pages" }, ...pages.map((p) => ({ value: p.id, label: p.label }))]}
          />
        </div>
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
          <label htmlFor="issue-q" className="mb-0">
            Search issues
          </label>
          <input id="issue-q" name="q" type="search" defaultValue={params.q ?? ""} placeholder="e.g. alt, button, .header" />
        </div>
        <button type="submit">Apply</button>
        {filtered && (
          <Link href={base} scroll={false} className="inline-flex min-h-11 items-center">
            Clear filters
          </Link>
        )}
      </Form>
    </div>
  );
}
