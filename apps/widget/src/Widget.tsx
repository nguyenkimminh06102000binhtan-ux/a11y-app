import { useRef, useState } from "preact/hooks";

export function Widget() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    toggleRef.current?.focus(); // never leave keyboard focus on an element that just disappeared
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation(); // the event would otherwise reach the page and could close the page's own dialogs
      close();
    }
  }

  return (
    <div class="widget" onKeyDown={onKeyDown}>
      {/* Button first in the HTML, so Tab goes button → panel; CSS shows the panel above it */}
      <button
        ref={toggleRef}
        type="button"
        class="toggle"
        aria-expanded={open}
        aria-controls="panel"
        onClick={() => setOpen(!open)}
      >
        Accessibility
      </button>

      {/* A disclosure, not a modal: no focus trap, and it stays open while the visitor uses the page */}
      <section id="panel" class="panel" aria-labelledby="panel-title" hidden={!open}>
        <div class="panel-header">
          <h2 id="panel-title" class="title">Accessibility settings</h2>
          <button type="button" class="close" onClick={close}>
            Close
          </button>
        </div>
        <p>Settings will go here.</p>
      </section>
    </div>
  );
}
