"use client";

import { useId, useMemo, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string };

type Props = {
  label: string;
  /** The form field the chosen value is sent as (a hidden input; the text box itself isn't sent). Optional with onChoose. */
  name?: string;
  /** Called when an option is picked (Enter or a click): a deliberate choice, e.g. "Go to site" opens it */
  onChoose?: (value: string) => void;
  options: ComboboxOption[];
  defaultValue?: string;
  placeholder?: string;
};

/**
 * A searchable select: type to filter, then pick with the arrow keys and Enter, or the mouse.
 * Follows the WAI-ARIA "editable combobox with list autocomplete" pattern:
 *   input role="combobox" (aria-expanded, aria-controls, aria-activedescendant) + a role="listbox" popup.
 *   ↓ / ↑ move through the list (↓ opens it, Alt+↓ opens without moving), Enter picks, Esc closes (or clears),
 *   Tab leaves and keeps the last choice. Text that matches nothing goes back to the chosen option when you leave.
 * The chevron is a mouse/touch shortcut only (not in the Tab order, as the pattern says): the keyboard has ↓.
 * A polite status says how many options match, so screen reader users know what typing did.
 * The option with an empty value (e.g. "All pages") shows as an empty box with the placeholder, so typing starts a
 * search right away; focusing the box selects its text, so typing replaces a chosen option instead of adding to it.
 */
export function Combobox({ label, name, onChoose, options, defaultValue = "", placeholder }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // The empty value ("All pages") is an empty box: its words are the placeholder
  const labelOf = (value: string) => (value ? (options.find((o) => o.value === value)?.label ?? "") : "");
  const [value, setValue] = useState(defaultValue); // what the form sends
  const [text, setText] = useState(labelOf(defaultValue)); // what's in the box
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // index in `shown`, -1 = none
  const [typed, setTyped] = useState(false); // filter only after typing: opening shows everything

  const shown = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return typed && needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, text, typed]);

  const optionId = (i: number) => `${id}-opt-${i}`;

  function show(index: number) {
    setOpen(true);
    setActive(index);
    // keep the active option visible in a long list
    requestAnimationFrame(() => document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" }));
  }

  function choose(option: ComboboxOption) {
    setValue(option.value);
    setText(labelOf(option.value));
    setTyped(false);
    setOpen(false);
    setActive(-1);
    onChoose?.(option.value);
  }

  function close(revert: boolean) {
    setOpen(false);
    setActive(-1);
    setTyped(false);
    if (revert) setText(labelOf(value)); // typed text that wasn't picked doesn't count
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (event.altKey) setOpen(true);
        else if (shown.length) show(open ? Math.min(active + 1, shown.length - 1) : Math.max(0, shown.findIndex((o) => o.value === value)));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (shown.length) show(open && active > 0 ? active - 1 : open ? 0 : shown.length - 1);
        break;
      case "Enter":
        if (open && active >= 0 && shown[active]) {
          event.preventDefault(); // picking isn't submitting; Enter again submits the form
          choose(shown[active]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close(true);
        } else if (text) {
          event.preventDefault();
          setText("");
          setTyped(true);
        }
        break;
    }
  }

  const status = open ? (shown.length === 0 ? "No matches" : `${shown.length} ${shown.length === 1 ? "option" : "options"}`) : "";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="mb-0">
        {label}
      </label>
      <div className="relative">
        {name && <input type="hidden" name={name} value={value} />}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setTyped(true);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={() => close(true)}
          className="pr-11"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show ${label.toLowerCase()} options`}
          aria-expanded={open}
          aria-controls={listId}
          // mousedown, not click: keep focus in the text box
          onMouseDown={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
            if (open) close(true);
            else show(Math.max(0, options.findIndex((o) => o.value === value)));
          }}
          className="absolute inset-y-0 right-0 flex w-11 min-h-0 items-center justify-center border-0 bg-transparent p-0 text-muted"
        >
          <svg viewBox="0 0 16 16" className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!open || shown.length === 0}
          className="absolute z-20 mt-1 max-h-64 w-full min-w-48 overflow-y-auto rounded-[0.625rem] border-[1.5px] border-frame bg-surface py-1 shadow-lg"
        >
          {shown.map((option, i) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value || "(all)"}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                // mousedown, not click: picking before the text box loses focus
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseMove={() => active !== i && setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 wrap-anywhere ${
                  i === active ? "bg-state-tint outline-2 -outline-offset-2 outline-state" : ""
                } ${selected ? "font-bold" : ""}`}
              >
                {/* Selected: a check mark as well as bold, never color alone */}
                <span aria-hidden="true" className="w-4 shrink-0 text-state">
                  {selected ? "✓" : ""}
                </span>
                {option.label}
              </li>
            );
          })}
        </ul>
        {open && shown.length === 0 && (
          <p className="absolute z-20 mt-1 w-full rounded-[0.625rem] border-[1.5px] border-frame bg-surface px-3 py-2 text-muted shadow-lg">
            No matches
          </p>
        )}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}
