export function FieldErrors({ errors }: { errors: ReadonlyArray<unknown> }) {
  const messages = errors
    .map((e) => (typeof e === "string" ? e : (e as { message?: string } | undefined)?.message))
    .filter((m): m is string => Boolean(m));
  if (messages.length === 0) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}
