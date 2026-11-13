"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

/**
 * A row of section links (a site's Audit / Widget). Links, not ARIA tabs: each one opens a real page with its own
 * URL, so Back, bookmarks and "open in new tab" all work.
 * The current one has aria-current ("page" on the section itself, "true" on one of its subpages), plus bold text
 * and a 3px bar, so it isn't shown by color alone. Each link is at least 44px tall.
 */
export function SectionNav({ label, items }: { label: string; items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="border-b border-line">
      <ul className="-mb-px flex gap-1">
        {items.map((item) => {
          const exact = pathname === item.href;
          const inside = exact || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={exact ? "page" : inside ? "true" : undefined}
                className={`inline-flex min-h-11 items-center border-b-[3px] px-4 no-underline ${
                  inside ? "border-state font-bold text-state" : "border-transparent text-ink hover:border-frame"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
