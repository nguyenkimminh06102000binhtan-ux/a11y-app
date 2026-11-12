import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Mark } from "@/components/Mark";
import { NavLink } from "@/components/NavLink";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * The signed-in app: a main menu (a column on wide screens, a block on top on phones) next to the page.
 * Static, so it's prerendered; only the account part waits for the request.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      {/* First thing a keyboard user reaches: skip past the menu */}
      <a
        href="#main"
        className="sr-only rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10"
      >
        Skip to content
      </a>

      <div className="flex flex-col gap-6 border-b-2 border-frame p-4 md:border-r-2 md:border-b-0">
        <p className="flex items-center gap-2.5 px-3 text-lg font-bold">
          <Mark className="size-8 shrink-0" />
          a11y-app
        </p>

        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            <li>
              <NavLink href="/" match={["/sites/"]}>
                Sites
              </NavLink>
            </li>
          </ul>
        </nav>

        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </div>

      {children}
    </div>
  );
}

async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="mt-auto flex flex-col gap-2 px-3">
      <p className="text-sm break-all">Signed in as {user.email}</p>
      <form action={signOut}>
        <button type="submit" className="border-frame bg-surface text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
