"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finishSignIn } from "@/lib/account";
import { normalizeDomain } from "@/lib/domain";
import { MAX_PASSWORD, MIN_PASSWORD } from "@/lib/password";


export type SignUpField = "name" | "email" | "site" | "password" | "terms";

export type SignUpState = {
  errors?: Partial<Record<SignUpField, string>>;
  error?: "busy" | "unknown"; // not about one field
  values?: { name: string; email: string; site: string }; // typed back after a refusal (never the password)
  sent?: string; // the confirmation email went to this address
  at?: number; // new on every answer: messages are announced and focused again on each try
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign up with email + password. Every field is checked here (the form only adds hints); errors come back per field.
 * Then a confirmation email: the account, and the first site from "Your website", are made when its link is opened
 * (/auth/confirm or /auth/callback). The answer is the same for a new email and one that already has an account.
 * intent=resend sends the confirmation email again.
 */
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const at = Date.now();
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().slice(0, 320);

  if (formData.get("intent") === "resend") {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin}/auth/callback` } });
    if (error?.status === 429) return { sent: email, error: "busy", at };
    return { sent: email, at };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const siteInput = String(formData.get("site") ?? "").trim().slice(0, 300);
  const password = String(formData.get("password") ?? "");
  const values = { name, email, site: siteInput };

  const errors: SignUpState["errors"] = {};
  if (!name) errors.name = "Enter your name.";
  if (!EMAIL.test(email)) errors.email = "Enter an email address like you@company.com.";
  const domain = siteInput ? normalizeDomain(siteInput) : null;
  if (siteInput && !domain) errors.site = "Enter a domain like shop.com, or leave it empty.";
  if (password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  else if (password.length > MAX_PASSWORD) errors.password = `Use at most ${MAX_PASSWORD} characters.`;
  if (formData.get("terms") !== "on") errors.terms = "To create an account, agree to the Terms of Service and the Privacy Policy.";
  if (Object.keys(errors).length > 0) return { errors, values, at };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback`, data: { full_name: name, ...(domain && { first_site: domain }) } },
  });
  if (error) {
    if (error.status === 429) return { error: "busy", values, at };
    if (error.code === "weak_password") return { errors: { password: "Choose a stronger password: a few words together work well." }, values, at };
    if (error.code === "user_already_exists") return { sent: email, at }; // same answer as for a new email
    console.error("[sign-up]", error.code ?? error.message);
    return { error: "unknown", values, at };
  }

  // Email confirmation turned off in Supabase: already signed in
  if (data.session && data.user) {
    const newSite = await finishSignIn(data.user);
    redirect(newSite ? `/embed-code?added=${newSite}` : "/");
  }
  return { sent: email, at };
}
