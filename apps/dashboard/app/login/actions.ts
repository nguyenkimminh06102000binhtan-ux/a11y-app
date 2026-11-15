"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureAccount } from "@/lib/account";
import { safeNext } from "@/lib/safe-next";

export type SignInError = "missing" | "link-missing" | "invalid" | "unconfirmed" | "busy" | "unknown";

/** `at` is new on every answer, so the same message is announced (and focused) again on each try. */
export type SignInState = { error?: SignInError; email?: string; sent?: string; at?: number };

/**
 * The sign-in form's one action; the button that was pressed says which way:
 *   intent=password  email + password → Sites, or ?next= (only a page of ours)
 *   intent=link      a one-time sign-in link by email → "Check your email"
 * Messages never say whether an email has an account.
 */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().slice(0, 320);
  const next = safeNext(formData.get("next"));
  const at = Date.now();
  const supabase = await createClient();

  if (formData.get("intent") === "link") {
    if (!email) return { error: "link-missing", email, at };
    const origin = (await headers()).get("origin");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}` },
    });
    if (error?.status === 429) return { error: "busy", email, at };
    // Any other refusal looks the same as success: the page never tells whether the email has an account
    if (error) console.error("[sign-in link]", error.code ?? error.message);
    return { sent: email, at };
  }

  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "missing", email, at };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const code = error?.code;
    const kind: SignInError =
      code === "invalid_credentials"
        ? "invalid"
        : code === "email_not_confirmed"
          ? "unconfirmed"
          : error?.status === 429
            ? "busy"
            : error?.status === 400
              ? "invalid"
              : "unknown";
    if (kind === "unknown") console.error("[sign-in]", code ?? error?.message);
    return { error: kind, email, at };
  }
  await ensureAccount({ id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name });
  redirect(next);
}
