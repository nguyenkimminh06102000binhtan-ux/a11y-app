/** Password rules for sign-up (and reset). MIN is also set in Supabase (Authentication › Email) and supabase/config.toml. */
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 72; // the most a password hash uses
