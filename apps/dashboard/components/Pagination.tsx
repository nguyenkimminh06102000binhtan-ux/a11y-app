import Link from "next/link";

type Props = {
  page: number; // 1-based
  pages: number;
  summary: string; // "Showing 26–50 of 1,000 sites"
  href: (page: number) => string;
};

/**
 * Under a long list: what's shown, then Previous / "Page 2 of 40" / Next as links (so Back and shared links work).
 * On the first or last page that link is left out rather than shown disabled. Nothing to page through: just the summary.
 */
export function Pagination({ page, pages, summary, href }: Props) {
  if (pages <= 1) return <p className="m-0 text-small text-muted">{summary}</p>;
  const link = "inline-flex min-h-11 items-center rounded-lg px-3 font-bold";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
      <p className="m-0 text-small text-muted">{summary}</p>
      <ul className="flex flex-wrap items-center gap-1">
        {page > 1 && (
          <li>
            <Link href={href(page - 1)} rel="prev" className={link}>
              <span aria-hidden="true">‹&nbsp;</span>Previous
            </Link>
          </li>
        )}
        <li className="px-2 text-small">
          Page {page} of {pages}
        </li>
        {page < pages && (
          <li>
            <Link href={href(page + 1)} rel="next" className={link}>
              Next<span aria-hidden="true">&nbsp;›</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
