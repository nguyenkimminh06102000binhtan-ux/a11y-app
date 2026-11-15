"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";

/** A subsection. Without href it's planned ("Soon"): shown and announced, but not a link and not focusable. */
export type SubNavItem = {
  label: string;
  href?: string;
  count?: number;
  /** Also current on the pages under it (Scans for /scans/<run>): marked aria-current="true" there, not "page" */
  nested?: boolean;
};

/**
 * The subsections of a site's section (Audit: Overview, Issues…). A column beside the content from 768px,
 * wrapping chips above it on phones.
 * The current one has aria-current="page" and the shared "on" look (tint, state color, bold), so it isn't shown by
 * color alone. Every link is at least 44px tall.
 */
export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2 md:flex-col md:gap-1">
        {items.map((item) => {
          if (!item.href) {
            return (
              <li key={item.label} className="flex min-h-11 items-center gap-2 px-3 text-muted">
                {item.label}
                <Badge tone="soon" />
              </li>
            );
          }
          const exact = pathname === item.href;
          const current = exact || (item.nested === true && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={exact ? "page" : current ? "true" : undefined}
                className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 no-underline md:border-transparent ${
                  current ? "border-state bg-state-tint font-bold text-state" : "border-line text-ink hover:bg-subtle"
                }`}
              >
                {item.label}
                {/* the space keeps the name "Issues 48" (not "Issues48") for screen readers; flex layout ignores it */}
                {item.count !== undefined && " "}
                {item.count !== undefined &&<span className="text-caption font-normal text-muted">{item.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Same footprint as the nav, while the section's links load (they need the site's id). */
export function SubNavPlaceholder() {
  return <div aria-hidden="true" className="min-h-11 md:min-h-56" />;
}
