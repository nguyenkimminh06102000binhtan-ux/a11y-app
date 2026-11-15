/** A field's error, under it and read with it (aria-describedby). The words say it; the sign only repeats it. */
export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="m-0 font-bold">
      <span aria-hidden="true">⚠ </span>
      {children}
    </p>
  );
}
