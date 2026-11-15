/**
 * The sign-in page's dark panel: what AccessPilot does, then a picture of the product (example numbers, hidden
 * from screen readers: the sentence above says it in words).
 */
export function SignInPanel() {
  return (
    <>
      <div className="flex max-w-xl flex-col gap-4">
        <h2 className="m-0 text-[2.6rem] leading-tight text-surface">Find every barrier. Fix what matters first.</h2>
        <p className="m-0 text-lg text-night-muted">
          Scan your pages against WCAG 2.2, give visitors a widget they can use today, and share reports your team can
          act on.
        </p>
      </div>

      <div aria-hidden="true" className="flex max-w-md flex-col gap-3.5">
        <div className="flex flex-col gap-3.5 rounded-2xl bg-surface px-6 py-5 text-ink shadow-[0_18px_40px_rgba(10,8,30,0.35)]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-small text-muted">
            <span>shop.example · open issues</span>
            <span>Scanned 2 hours ago</span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[2.5rem] leading-none font-bold">48</span>
            <span className="text-muted">on 12 pages</span>
          </div>
          <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full">
            <span className="flex-[7] bg-ink" />
            <span className="flex-[15] bg-state" />
            <span className="flex-[20] bg-night-accent" />
            <span className="flex-[6] bg-line" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-small text-muted">
            <span><b className="text-ink">7</b> critical</span>
            <span><b className="text-ink">15</b> serious</span>
            <span><b className="text-ink">20</b> moderate</span>
            <span><b className="text-ink">6</b> minor</span>
          </div>
        </div>

        <div className="ml-10 flex items-center gap-3.5">
          <div className="inline-flex items-center gap-2.5 rounded-full bg-surface py-2.5 pr-4 pl-3 text-ink shadow-[0_12px_30px_rgba(10,8,30,0.3)]">
            <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-state-tint">
              <svg viewBox="0 0 20 20" fill="none" className="size-4 stroke-state" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 10.5 L8.5 13.5 L14.5 7" />
              </svg>
            </span>
            <span><b>Widget working</b> · seen 2 min ago</span>
          </div>
          <span className="inline-flex size-14 items-center justify-center rounded-full border-[3px] border-surface bg-state shadow-[0_12px_30px_rgba(10,8,30,0.35)]">
            <svg viewBox="0 0 24 24" fill="none" className="size-7 stroke-surface" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="4.5" r="2" />
              <path d="M5 9l7 1.5L19 9M12 10.5V15M12 15l-3.5 6M12 15l3.5 6" />
            </svg>
          </span>
        </div>

        <div className="ml-3 inline-flex items-center gap-2.5 self-start rounded-xl border-[1.5px] border-night-edge bg-night-raised px-4 py-2.5">
          <b className="whitespace-nowrap">WCAG 1.4.3</b>
          <span className="text-night-muted">Contrast (Minimum) · 6 fixed since last scan</span>
        </div>
      </div>
    </>
  );
}
