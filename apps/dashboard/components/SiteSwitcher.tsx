"use client";

import { usePathname, useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/Combobox";

/**
 * "Go to site": type to find one of your sites, pick it (Enter or a click) to open it. Picking is a deliberate
 * action, never a side effect of typing (WCAG 3.2.2). Inside a site, that site is pre-selected.
 * Reads the URL, so render it inside <Suspense>.
 */
export function SiteSwitcher({ sites }: { sites: { id: string; domain: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = /^\/sites\/([^/]+)/.exec(pathname)?.[1] ?? "";

  if (sites.length === 0) return null;
  return (
    <Combobox
      key={current} // a new site page starts with that site shown
      label="Go to site"
      options={sites.map((s) => ({ value: s.id, label: s.domain }))}
      defaultValue={sites.some((s) => s.id === current) ? current : ""}
      placeholder="Type a site's name"
      onChoose={(id) => {
        if (id && id !== current) router.push(`/sites/${id}`);
      }}
    />
  );
}
