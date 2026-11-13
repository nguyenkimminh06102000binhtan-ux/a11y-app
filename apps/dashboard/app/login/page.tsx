import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  redirect(error ? "/login?error=1" : "/login?sent=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  // no await here: pass the promise down unresolved
  return (
    <main>
      <h1>Sign in</h1>
      <Suspense fallback={null}>
        <StatusMessage searchParams={searchParams} />
      </Suspense>
      <form action={sendMagicLink}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <button type="submit">Send sign-in link</button>
      </form>
    </main>
  );
}

async function StatusMessage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams; // now inside Suspense
  if (sent) return <p role="status">Check your email for a sign-in link.</p>;
  if (error) return <p role="alert">Something went wrong. Please try again.</p>;
  return null;
}