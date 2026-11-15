"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MAX_PASSWORD, MIN_PASSWORD } from "@/lib/password";

export type ResetState = { error?: string; at?: number };

/**
 * Saves a new password for the signed-in user (they got here from the reset link, which signed them in), then signs
 * out their other devices and opens Sites, which says "Password changed".
 */
export async function savePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const at = Date.now();
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.`, at };
  if (password.length > MAX_PASSWORD) return { error: `Use at most ${MAX_PASSWORD} characters.`, at };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=%2Freset-password");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you haven’t used for this account before.", at };
    if (error.code === "weak_password") return { error: "Choose a stronger password: a few words together work well.", at };
    if (error.status === 429) return { error: "Too many tries. Wait a minute, then try again.", at };
    console.error("[reset save]", error.code ?? error.message);
    return { error: "Something went wrong. Please try again in a moment.", at };
  }
  await supabase.auth.signOut({ scope: "others" }); // anyone else who had the old password is signed out
  redirect("/?password=changed");
}
