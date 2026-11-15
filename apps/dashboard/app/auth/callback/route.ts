import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureAccount } from "@/lib/account";
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
      await ensureAccount({ id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name });
      return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
