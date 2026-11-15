/** The sign-up page's dark panel: the three steps after signing up (the same as Getting started). */
export function SignUpPanel() {
  const steps = [
    { title: "Add your site", text: "Type the domain. Each subdomain is its own site." },
    { title: "Paste one line", text: "The dashboard tells you when the widget is working.", code: true },
    { title: "Scan and fix", text: "Pick pages to scan. Each issue shows the WCAG criterion, the element and how to fix it." },
  ];
  return (
    <>
      <div className="flex max-w-xl flex-col gap-4">
        <h2 className="m-0 text-[2.6rem] leading-tight text-surface">Up and running in three steps.</h2>
        <p className="m-0 text-lg text-night-muted">No code changes beyond one line. You can stop at any step and come back.</p>
      </div>
      <ol role="list" className="m-0 flex max-w-lg list-none flex-col gap-3.5 p-0">
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-start gap-4 rounded-2xl border-[1.5px] border-night-edge bg-night-raised px-5 py-4">
            <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface font-bold text-ink">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <b className="text-lg">{step.title}</b>
              {step.code && (
                <code aria-hidden="true" className="block truncate rounded-lg bg-ink px-2.5 py-2 font-mono text-[0.8125rem] text-surface">
                  &lt;script src=&quot;https://cdn.accesspilot.org/l.js&quot; …&gt;
                </code>
              )}
              <span className="text-night-muted">{step.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
