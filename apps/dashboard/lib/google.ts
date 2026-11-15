/**
 * Google sign-in is on once it's set up (README › Sign-in setup) and AUTH_GOOGLE_ENABLED=true is set where the
 * dashboard is built. Until then the Google button says "coming soon" instead of failing.
 */
export function googleEnabled(): boolean {
  return process.env.AUTH_GOOGLE_ENABLED === "true";
}
