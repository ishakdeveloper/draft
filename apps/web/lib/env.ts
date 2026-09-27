/**
 * The one place the web app reads its environment. Only NEXT_PUBLIC_* values exist here:
 * the app acts as the signed-in reviewer and never holds a service key.
 * Accessed as literal process.env.X so Next inlines them into the client bundle.
 */
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const env = {
  supabaseUrl: required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseKey: required(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ),
};
