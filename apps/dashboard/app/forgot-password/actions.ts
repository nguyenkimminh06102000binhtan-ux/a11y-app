"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { error?: "missing" | "busy"; email?: string; sent?: string; at?: number };

/**
 * Sends a link to choose a new password. The answer is the same whether or not the email has an account, so this
 * page can't be used to find out who signed up. The link opens /reset-password, signed in for that one purpose.
 */
export async function requestReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const at = Date.now();
  const email = String(formData.get("email") ?? "").trim().slice(0, 320);
  if (!email) return { error: "missing", email, at };
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Supabase's default email lands on /auth/callback; ours (supabase/templates/reset-password.html) on /auth/confirm
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error?.status === 429) return { error: "busy", email, at };
  if (error) console.error("[reset request]", error.code ?? error.message);
  return { sent: email, at };
}
