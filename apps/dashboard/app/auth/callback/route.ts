import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishSignIn } from "@/lib/account";
import { safeNext } from "@/lib/safe-next";

/**
 * Where sign-in links land (magic link today, Google later): swaps the one-time code for a session, makes the
 * account on the first sign-in, then goes to ?next= (only a page of ours) or Sites.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const newSite = await finishSignIn(data.user);
      return NextResponse.redirect(`${origin}${newSite ? `/embed-code?added=${newSite}` : safeNext(searchParams.get("next"))}`);
    }
  }
  // Google said no or was cancelled (?error=access_denied…): say so on sign in
  if (searchParams.get("error")) return NextResponse.redirect(`${origin}/login?error=google`);
  const forReset = searchParams.get("next") === "/reset-password"; // a reset link: get a new one there
  return NextResponse.redirect(`${origin}${forReset ? "/forgot-password" : "/login"}?error=link`);
}
