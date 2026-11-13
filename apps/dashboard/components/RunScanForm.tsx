import { requestScan } from "@/app/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ButtonVariant } from "@/components/ui/Button";

type Props = { siteId: string; url: string; label?: string; variant?: ButtonVariant };

/** One button that starts a scan of `url` (the site's homepage unless told otherwise) and opens Audit › Overview. */
export function RunScanForm({ siteId, url, label = "Run scan", variant = "primary" }: Props) {
  return (
    <form action={requestScan}>
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="url" value={url} />
      <SubmitButton variant={variant} pendingLabel="Starting…">
        {label}
      </SubmitButton>
    </form>
  );
}
