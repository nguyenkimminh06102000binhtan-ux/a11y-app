import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Reset your password" };

/** Forgot password. ?error=link: a reset link that didn't work (expired or used). Public. */
export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <AuthShell tagline="Find every barrier. Fix what matters first." panel={<SignInPanel />} panelLabel="About AccessPilot">
      <Link href="/login" className="-mb-2 inline-flex min-h-11 items-center self-start md:mt-4">
        <span aria-hidden="true">‹&nbsp;</span>Back to sign in
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[2rem] leading-tight md:text-[2.125rem]">Reset your password</h1>
        <p className="m-0 text-muted">Enter your email. If it has an account, we&apos;ll send a link to choose a new password.</p>
      </div>
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { error } = await searchParams;
  return <ForgotForm linkError={error === "link"} />;
}
