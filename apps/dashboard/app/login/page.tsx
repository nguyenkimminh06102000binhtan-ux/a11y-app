import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Sign in: Google (coming soon), email + password, or a sign-in link by email. ?next= is where to go afterwards
 * (only a page of ours); ?error=link means a sign-in link didn't work. A signed-in visitor never sees this page:
 * the proxy sends them to Sites.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell
      tagline="Find every barrier. Fix what matters first."
      panel={<SignInPanel />}
      panelLabel="About AccessPilot"
    >
      <div className="flex flex-col gap-2 md:mt-6">
        <h1 className="m-0 text-[2rem] leading-tight md:text-[2.125rem]">
          Sign in to AccessPilot
        </h1>
        <p className="m-0 text-muted">
          New here? Create an account: sign-up opens soon. For now, a sign-in
          link creates one.
        </p>
      </div>

      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Form({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next, error } = await searchParams;
  return <LoginForm next={safeNext(next)} linkError={error === "link"} />;
}
