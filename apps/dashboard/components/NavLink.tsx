"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { href: string; match?: string[]; children: React.ReactNode };

/**
 * A main-menu link that marks the page you're on: aria-current for screen readers,
 * plus the shared "on" look (tint, state color) and bold text, so it isn't shown by color alone.
 * `match` lists the other paths that belong to this section (e.g. a site's page belongs to Sites).
 *
 * The current URL isn't known while prerendering a page with a dynamic param (/sites/[id]), so reading it
 * must happen inside <Suspense>: the prerendered menu shows the plain link, and the browser marks it right away.
 */
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<NavLinkView {...props} current={false} />}>
      <CurrentNavLink {...props} />
    </Suspense>
  );
}

function CurrentNavLink({ href, match = [], children }: Props) {
  const pathname = usePathname();
  const current = pathname === href || match.some((prefix) => pathname.startsWith(prefix));
  return <NavLinkView href={href} current={current}>{children}</NavLinkView>;
}

function NavLinkView({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
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
