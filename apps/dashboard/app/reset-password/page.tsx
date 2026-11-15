import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ResetForm } from "@/components/auth/ResetForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

/** Opened from the reset email's link, which signed you in for this. Needs that sign-in (the proxy sends others to /login). */
export default function ResetPasswordPage() {
  return (
    <AuthShell tagline="Find every barrier. Fix what matters first." panel={<SignInPanel />} panelLabel="About AccessPilot">
      <div className="flex flex-col gap-2 md:mt-6">
        <h1 className="m-0 text-[2rem] leading-tight md:text-[2.125rem]">Choose a new password</h1>
        <Suspense fallback={<p className="m-0 text-muted">&nbsp;</p>}>
          <ForWho />
        </Suspense>
      </div>
      <ResetForm />
    </AuthShell>
  );
}

async function ForWho() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Freset-password");
  return (
    <p className="m-0 text-muted">
      For <b className="wrap-anywhere text-ink">{user.email}</b>. Other devices signed in to this account will be signed out.
    </p>
  );
}
