import { useState } from "preact/hooks";

export function Widget() {
  const [open, setOpen] = useState(false);

  return (
    <div class="widget">
      {/* Button first in the HTML, so Tab goes button → panel; CSS shows the panel above it */}
      <button
        type="button"
        class="toggle"
        aria-expanded={open}
        aria-controls="panel"
        onClick={() => setOpen(!open)}
      >
        Accessibility
      </button>

      <section id="panel" class="panel" aria-labelledby="panel-title" hidden={!open}>
        <h2 id="panel-title" class="title">Accessibility settings</h2>
        <p>Settings will go here.</p>
      </section>
    </div>
  );
}
