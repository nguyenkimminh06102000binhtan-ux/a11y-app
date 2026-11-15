import { expect, type APIRequestContext } from "@playwright/test";
import { localStack } from "./local-stack";

/**
 * The link in the newest email to `to` that arrived after `since` (the local stack's test mailbox). Waits for it.
 * Only messages after `since` count, so older runs' emails (and parallel tests) never get picked by mistake.
 */
export async function emailLink(request: APIRequestContext, to: string, since: number): Promise<string> {
  const mailbox = localStack().mailboxUrl;
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const found = await (await request.get(`${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
        const message = (found.messages ?? []).find((m: { Created: string }) => new Date(m.Created).getTime() >= since - 1000);
        if (!message) return false;
        const full = await (await request.get(`${mailbox}/api/v1/message/${message.ID}`)).json();
        link = /href="([^"]*(?:\/auth\/confirm|\/verify)[^"]*)"/.exec(full.HTML ?? "")?.[1]?.replace(/&amp;/g, "&");
        return !!link;
      },
      { timeout: 20_000, message: `an email to ${to}` }
    )
    .toBe(true);
  return link!;
}

/** Whether any email to `to` arrived after `since` (waits a moment first) */
export async function anyEmail(request: APIRequestContext, to: string, since: number): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 1500));
  const found = await (await request.get(`${localStack().mailboxUrl}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
  return (found.messages ?? []).some((m: { Created: string }) => new Date(m.Created).getTime() >= since - 1000);
}
