import { cache } from "react";
import { createClient } from "./supabase/server";

// cache() = runs once per request, no matter how many components call it
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email! } : null;
});