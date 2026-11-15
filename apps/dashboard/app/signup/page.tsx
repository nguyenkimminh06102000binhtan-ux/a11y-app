import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpPanel } from "@/components/auth/SignUpPanel";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Create your account" };

/** Sign up. A signed-in visitor never sees it: the proxy sends them to Sites. */
export default function SignUpPage() {
  return (
    <AuthShell tagline="Add your site, paste one line, then scan and fix." panel={<SignUpPanel />} panelLabel="What happens next">
      <div className="flex flex-col gap-2 md:mt-4">
        <h1 className="m-0 text-[2rem] leading-tight md:text-[2.125rem]">Create your account</h1>
        <p className="m-0 text-muted">
          Already have one? <Link href="/login" className="font-bold">Sign in</Link>
        </p>
      </div>
      <SignUpForm />
    </AuthShell>
  );
}
