import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Mark } from "@/components/Mark";
import { NavLink } from "@/components/NavLink";
import { AppMenu, AppMenuView } from "@/components/AppMenu";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * The signed-in app: the AccessPilot menu (a sidebar from 768px, a top bar with a Menu button on phones) beside the
 * page. The whole menu is the banner landmark, so nothing sits outside a landmark.
 * Static, so it's prerendered; only the site list and the account part wait for the request.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const brand = (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 text-lg font-bold text-ink no-underline">
      <Mark className="size-8 shrink-0" />
      AccessPilot
    </Link>
  );
  const menu = <Menu />;

  return (
    <div className="flex-1 md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      {/* First thing a keyboard user reaches: skip past the menu */}
      <a
        href="#main"
        className="sr-only rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-30"
      >
        Skip to content
      </a>

      <header className="border-b border-line bg-subtle md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:border-r md:border-b-0">
        <div className="flex flex-col gap-5 p-4 md:min-h-full">
          <Suspense fallback={<AppMenuView brand={brand} open={false}>{menu}</AppMenuView>}>
            <AppMenu brand={brand}>{menu}</AppMenu>
          </Suspense>
        </div>
      </header>

      {children}
    </div>
  );
}

/** Everything in the menu: main sections, account (most of it "Soon" until those features ship). */
function Menu() {
  return (
    <>
      <nav aria-label="Main" className="flex flex-col gap-5">
        <ul className="flex flex-col gap-1">
          <li>
            <NavLink href="/" match={["/sites/"]}>
              Sites
            </NavLink>
          </li>
        </ul>

        <div className="flex flex-col gap-1">
          <p id="menu-account" className="px-3 text-caption font-bold text-muted">
            Account
          </p>
          <ul aria-labelledby="menu-account" className="flex flex-col gap-1">
            <Soon label="Billing" />
            <Soon label="Team" />
            <Soon label="Account settings" />
          </ul>
        </div>

        <ul className="flex flex-col gap-1">
          <Soon label="Help and guides" />
        </ul>
      </nav>

      <Suspense fallback={null}>
        <Account />
      </Suspense>
    </>
  );
}

/** A planned section: shown and announced ("Billing, Soon"), but not a link and not focusable. */
function Soon({ label }: { label: string }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-2 px-3 text-muted">
      {label}
      <Badge tone="soon" />
    </li>
  );
}

async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-line px-3 pt-4">
      <p className="text-small break-all text-muted">
        Signed in as <span className="text-ink">{user.email}</span>
      </p>
      <form action={signOut}>
        <SubmitButton variant="secondary" pendingLabel="Signing out…">
          Sign out
        </SubmitButton>
      </form>
    </div>
  );
}
