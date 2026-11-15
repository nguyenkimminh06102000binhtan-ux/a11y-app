import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { finishSignIn } from "@/lib/account";
import { safeNext } from "@/lib/safe-next";

const TYPES: EmailOtpType[] = ["email", "signup", "magiclink", "recovery", "invite", "email_change"];

/**
 * Where our email links land (supabase/templates: confirm sign-up, sign-in link):
 * /auth/confirm?token_hash=…&type=email&redirect_to=<the address the link was sent with>.
 * Unlike /auth/callback it works when the email is opened on another device. Verifies the one-time token, makes
 * the account (and the first site typed at sign-up), then goes on: Embed code for a new site, else `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const origin = request.nextUrl.origin;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user) {
      const newSite = await finishSignIn(data.user);
      if (newSite) return NextResponse.redirect(`${origin}/embed-code?added=${newSite}`);
      return NextResponse.redirect(`${origin}${safeNext(nextFrom(params.get("redirect_to")))}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}

/** redirect_to is ".../auth/callback?next=%2Fsites%2F…": the page to open is its `next` */
function nextFrom(redirectTo: string | null): string {
  if (!redirectTo) return "/";
  try {
    return new URL(redirectTo).searchParams.get("next") ?? "/";
  } catch {
    return "/";
  }
}
