import { test, expect } from "@playwright/test";
import { localStack } from "./local-stack";
import { OWNER_EMAIL } from "./seed";

/*
 * The sign-in page's magic link, end to end: the form, the email (from the local test mailbox), the link, and
 * /auth/callback. If magic links are ever replaced by other sign-in options, replace this file; the other tests
 * sign in without the page (tests/setup.ts) and don't change.
 */
test.use({ storageState: { cookies: [], origins: [] } }); // signed out
test.describe.configure({ mode: "serial" }); // one mailbox

test("magic link: the email's link signs you in and opens Sites", async ({ page, request }) => {
  const mailbox = localStack().mailboxUrl;
  await request.delete(`${mailbox}/api/v1/messages`); // start from an empty mailbox

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("status")).toHaveText("Check your email for a sign-in link.");

  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const found = await (await request.get(`${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${OWNER_EMAIL}`)}`)).json();
        const id = found.messages?.[0]?.ID;
        if (!id) return false;
        const message = await (await request.get(`${mailbox}/api/v1/message/${id}`)).json();
        link = /href="([^"]*\/verify[^"]*)"/.exec(message.HTML ?? "")?.[1]?.replace(/&amp;/g, "&");
        return !!link;
      },
      { timeout: 20_000 }
    )
    .toBe(true);

  await page.goto(link!); // → /auth/callback?code=… → Sites
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Sites" })).toBeVisible();
});
