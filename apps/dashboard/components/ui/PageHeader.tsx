import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { href: string; label: string };

type Props = {
  title: ReactNode;
  /** The pages above this one, top first. The current page (the title) is added at the end. */
  breadcrumb?: Crumb[];
  description?: ReactNode;
  /** Buttons for this page (e.g. Run scan). Beside the title on wide screens, below it on phones. */
  actions?: ReactNode;
};

/** The top of every page: breadcrumb, h1, a one-line description and the page's actions. */
export function PageHeader({ title, breadcrumb, description, actions }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 text-small text-muted">
            {breadcrumb.map((crumb) => (
              <li key={crumb.href} className="flex items-center gap-2">
                {/* 44px tall, so it's an easy target on touch screens */}
                <Link href={crumb.href} className="inline-flex min-h-11 items-center">
                  {crumb.label}
                </Link>
                <span aria-hidden="true">›</span>
              </li>
            ))}
            <li aria-current="page" className="min-w-0 wrap-anywhere text-ink">
              {title}
            </li>
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          {/* wrap-anywhere: a long domain wraps instead of pushing the page sideways on a phone */}
          <h1 className="mb-0 wrap-anywhere">{title}</h1>
          {description && <p className="mt-1 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
