"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { googleEnabled } from "@/lib/google";

/**
 * "Continue with Google": off to Google (through Supabase), then back to /auth/callback, which makes the account on
 * the first time (with the Google name) and opens ?next= or Sites. New people agree to the terms by continuing:
 * the button's note says so.
 */
export async function continueWithGoogle(formData: FormData): Promise<void> {
  if (!googleEnabled()) redirect("/login");
  const next = safeNext(formData.get("next"));
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`,
      queryParams: { prompt: "select_account" }, // choose the account each time, so a shared computer is safe
    },
  });
  if (error || !data.url) {
    console.error("[google]", error?.code ?? error?.message ?? "no url");
    redirect("/login?error=google");
  }
  redirect(data.url);
}
