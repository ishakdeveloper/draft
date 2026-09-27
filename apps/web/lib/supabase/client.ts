import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@draft/shared/database";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey);
}
