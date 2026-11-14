"use client";

import { useActionState } from "react";
import { scanPages, type ScanPagesState } from "@/app/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ButtonVariant } from "@/components/ui/Button";
import { scanRefusal } from "@/components/scanRefusal";

/** One button that scans the given pages (e.g. Overview's "Try again"), with the reason when it can't start. */
export function ScanPagesForm({
  siteId,
  pageIds,
  label,
  variant = "primary",
  resetsOn,
}: {
  siteId: string;
  pageIds: string[];
  label: string;
  variant?: ButtonVariant;
  resetsOn: string;
}) {
  const [state, formAction] = useActionState(scanPages, {} as ScanPagesState);
  return (
    <form action={formAction} className="flex-col items-start gap-2">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="back" value="overview" />
      {pageIds.map((id) => (
        <input key={id} type="hidden" name="pageId" value={id} />
      ))}
      <SubmitButton variant={variant} pendingLabel="Starting…">
        {label}
      </SubmitButton>
      {state.error && (
        <p key={state.at} role="alert">
          {scanRefusal(state, resetsOn)}
        </p>
      )}
    </form>
  );
}
