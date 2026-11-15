import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { getSiteCount, getSitesPage } from "@/lib/sites";
import { SiteList } from "@/components/SiteList";
import { SitesHeader } from "@/components/SitesHeader";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/Button";
import { ArrivalToast } from "@/components/ui/Toaster";
import { normalizeDomain } from "@/lib/domain";
import { Skeleton, Bone, SkeletonList, SkeletonSearch } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Sites" };

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Sites: Add site at the top (one click however many sites there are), then a search and the account's sites,
 * 25 per page, A–Z. ?q= searches domains, ?page= picks the page. Static shell; the list streams in.
 */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main id="main">
      <SitesHeader
        description={
          <Suspense fallback={<>&nbsp;</>}>
            <SiteCount />
          </Suspense>
        }
      />

      <Suspense fallback={null}>
        <Deleted searchParams={searchParams} />
      </Suspense>

      <section aria-labelledby="sites-heading">
        <h2 id="sites-heading" className="sr-only">
          Your sites
        </h2>
        <p className="mt-0 mb-4 text-small text-muted">
          One embed code works for every site: <Link href="/embed-code">get the embed code</Link>.
        </p>
        <Suspense
          fallback={
            <Skeleton label="Loading sites…">
              <SkeletonSearch />
              <Bone className="h-4 w-40" />
              <SkeletonList rows={5} />
            </Skeleton>
          }
        >
          <Sites searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

/** After deleting a site: a toast "brand.com was deleted.", focus on the Sites heading (only a well-formed domain is echoed back) */
async function Deleted({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { deleted } = await searchParams;
  const domain = typeof deleted === "string" ? normalizeDomain(deleted) : null;
  if (!domain) return null;
  return <ArrivalToast key={domain} message={`${domain} was deleted.`} focus="#main h1" clear={["deleted"]} />;
}

async function SiteCount() {
  const total = await getSiteCount();
  return <>{`${fmt(total)} ${total === 1 ? "site" : "sites"}`}</>;
}

function readParams(params: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const q = one(params.q).trim().slice(0, 100);
  const page = Number.parseInt(one(params.page), 10);
  return { q, page: Number.isFinite(page) && page > 0 ? page : 1 };
}

/** "/?q=shop&page=2", leaving out what's empty or the default */
function sitesHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

async function Sites({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q, page: requested } = readParams(await searchParams);
  const { sites, total, page, pages, perPage } = await getSitesPage(requested, q);

  if (total === 0 && !q) {
    return <p>No sites yet. Use Add site above to add your first one.</p>;
  }

  const first = (page - 1) * perPage + 1;
  const last = first + sites.length - 1;

  return (
    <div className="flex flex-col gap-4">
      {/* GET form: the search is in the URL, and a new search starts at page 1 */}
      <Form action="/" role="search" aria-label="Sites" className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1 sm:max-w-sm">
          <label htmlFor="site-q" className="font-bold">
            Find a site
          </label>
          <input id="site-q" name="q" type="search" defaultValue={q} placeholder="Part of a domain, e.g. shop" />
        </div>
        <Button type="submit">Search</Button>
        {q && (
          <Link href="/" className="inline-flex min-h-11 items-center px-2">
            Clear search
          </Link>
        )}
      </Form>

      {total === 0 ? (
        <p role="status">
          No sites match “{q}”. <Link href="/">Clear search</Link>
        </p>
      ) : (
        <>
          {/* Says what the list now shows after a search (polite, so it doesn't interrupt) */}
          <p role="status" className="m-0 text-small text-muted">
            {q
              ? `${fmt(total)} ${total === 1 ? "site matches" : "sites match"} “${q}”`
              : `${fmt(total)} ${total === 1 ? "site" : "sites"}, A–Z`}
          </p>
          <SiteList sites={sites} />
          <Pagination
            page={page}
            pages={pages}
            summary={`Showing ${fmt(first)}–${fmt(last)} of ${fmt(total)} sites`}
            href={(n) => sitesHref(q, n)}
          />
        </>
      )}
    </div>
  );
}
