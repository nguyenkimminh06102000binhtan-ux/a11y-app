import { redirect } from "next/navigation";
import { db, accounts, eq } from "@app/db";
import { getCurrentUser } from "@/lib/auth";
import { CopyButton } from "@/components/CopyButton";

// Customers paste this URL into their sites, so it must never change: new releases ship behind the same name.
const WIDGET_SRC = "https://cdn.accesspilot.org/l.js";

/** The account's install line (the same for all its sites) and a Copy button. Render inside <Suspense>. */
export async function InstallCode() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [account] = await db
    .select({ widgetKey: accounts.widgetKey })
    .from(accounts)
    .where(eq(accounts.id, user.id));

  // the auth callback creates this row; if that failed, don't crash the page
  if (!account) {
    return <p role="alert">We couldn&apos;t load your account. Please sign out and sign in again.</p>;
  }

  const snippet = `<script src="${WIDGET_SRC}" data-account="${account.widgetKey}" async></script>`;

  return (
    <>
      <pre>
        <code>{snippet}</code>
      </pre>
      <CopyButton text={snippet} label="Copy install code" />
    </>
  );
}
