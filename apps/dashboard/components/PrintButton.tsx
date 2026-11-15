"use client";

import { Button } from "@/components/ui/Button";

/** Opens the browser's print window (where "Save as PDF" is). Not printed itself. */
export function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
