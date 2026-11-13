import { useId, type ReactNode } from "react";

type Props = {
  /** Optional heading at the top of the card. With a title, the card is a <section> named by it. */
  title?: ReactNode;
  /** Pick the level that fits the page outline: h2 for a card directly under the page title, h3 inside a section. */
  headingLevel?: 2 | 3;
  /** The element to render: "li" when the card is an item in a list. */
  as?: "div" | "section" | "li" | "article";
  className?: string;
  children?: ReactNode;
};

/** A white box with a light edge (--color-line: decoration only, so it isn't a control's edge). Tighter on phones. */
export function Card({ title, headingLevel = 2, as, className = "", children }: Props) {
  const id = useId();
  const Tag = as ?? (title ? "section" : "div");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Tag
      aria-labelledby={title && Tag === "section" ? id : undefined}
      className={`rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}
    >
      {title && (
        <Heading id={id} className="mt-0 mb-3">
          {title}
        </Heading>
      )}
      {children}
    </Tag>
  );
}
