/** Run code that touches the customer's page without letting one failure break the widget or other settings. */
export function safely(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.warn("[a11y-widget]", e);
  }
}
