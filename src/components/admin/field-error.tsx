/** One field's first error message, announced when it appears. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-red-600 text-xs" id={id} role="alert">
      {message}
    </p>
  );
}

export type FieldErrors = Record<string, string[] | undefined>;

/** The first error for `key` in a fieldErrors map. */
export function errorFor(errors: FieldErrors, key: string) {
  return errors[key]?.[0];
}

/** The first error for `key` or any of its children (e.g. "tags.3"). */
export function errorWithin(errors: FieldErrors, key: string) {
  const match = Object.keys(errors).find(
    (name) => name === key || name.startsWith(`${key}.`),
  );
  return match ? errorFor(errors, match) : undefined;
}
