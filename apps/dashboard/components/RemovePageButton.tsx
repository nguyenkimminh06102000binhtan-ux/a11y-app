"use client";

import { useEffect, useRef, useState } from "react";
import { removePage } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * Remove a page from the list, in two steps: "Remove" asks "Remove /cart?", and only "Yes, remove" does it.
 * Focus moves to the question and back to "Remove" on Cancel. Afterwards the Pages page says what was removed.
 */
export function RemovePageButton({ pageId, label }: { pageId: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const removeRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!confirming && cancelled.current) {
      removeRef.current?.focus();
      cancelled.current = false;
    }
  }, [confirming]);

  if (!confirming) {
    return (
      <Button ref={removeRef} variant="quiet" aria-label={`Remove ${label}`} onClick={() => setConfirming(true)}>
        Remove
      </Button>
    );
  }

  return (
    <form action={removePage} className="items-center gap-x-2 gap-y-1">
      <input type="hidden" name="pageId" value={pageId} />
      <span className="basis-full text-small font-bold wrap-anywhere">Remove {label} from the list?</span>
      <SubmitButton variant="secondary" pendingLabel="Removing…" aria-label={`Yes, remove ${label}`} autoFocus>
        Yes, remove
      </SubmitButton>
      <Button
        variant="quiet"
        onClick={() => {
          cancelled.current = true;
          setConfirming(false);
        }}
      >
        Cancel
      </Button>
    </form>
  );
}
