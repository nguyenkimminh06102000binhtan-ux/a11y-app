import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getOwnedSite } from "@/lib/site";
import { getRunsPage } from "@/lib/scans";
import { RunList } from "@/components/RunList";
import { Pagination } from "@/components/Pagination";
import { Skeleton, SkeletonText, SkeletonList } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Scans · Audit" };

const fmt = (n: number) => n.toLocaleString("en-US");

/** Audit › Scans: every scan run on this site, newest first, 25 per page (?page=). */
export default function ScansPage({ params, searchParams }: PageProps<"/sites/[id]/audit/scans">) {
  return (
    <section aria-labelledby="scans-heading">
      <h2 id="scans-heading" className="mt-0">
        Scans
      </h2>
      <Suspense
        fallback={
          <Skeleton label="Loading scans…">
            <SkeletonText lines={1} />
            <SkeletonList rows={5} />
          </Skeleton>
        }
      >
        <Scans params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Scans({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const site = await getOwnedSite(id); // 404 if it isn't this account's site
  const requested = Number.parseInt(typeof pageParam === "string" ? pageParam : "", 10);
  const { runs, total, page, pages, perPage } = await getRunsPage(site.id, Number.isFinite(requested) ? requested : 1);
  const base = `/sites/${site.id}/audit/scans`;

  if (total === 0) {
    return (
      <p>
        No scans yet. <Link href={`/sites/${site.id}/audit/pages`}>Choose pages to scan</Link>.
      </p>
    );
  }

  const first = (page - 1) * perPage + 1;
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-muted">
        Each scan checks the pages you chose together. New and fixed compare each page with its previous scan.
      </p>
      <RunList runs={runs} base={base} />
      <Pagination
        page={page}
        pages={pages}
        summary={`Showing ${fmt(first)}–${fmt(first + runs.length - 1)} of ${fmt(total)} scans`}
        href={(n) => (n > 1 ? `${base}?page=${n}` : base)}
      />
    </div>
  );
}
