"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A main-menu link that marks the page you're on: aria-current for screen readers,
 * plus the shared "on" look (tint, state color) and bold text, so it isn't shown by color alone.
 * `match` lists the other paths that belong to this section (e.g. a site's page belongs to Sites).
 */
export function NavLink({ href, match = [], children }: { href: string; match?: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || match.some((prefix) => pathname.startsWith(prefix));

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`block rounded-lg px-3 py-2.5 no-underline ${
        current ? "bg-state-tint font-bold text-state" : "text-ink hover:underline"
      }`}
    >
      {children}
    </Link>
  );
}
