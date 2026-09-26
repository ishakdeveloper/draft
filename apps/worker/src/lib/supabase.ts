import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@draft/shared/database";

export type Db = SupabaseClient<Database>;

export function createServiceClient(url: string, serviceRoleKey: string): Db {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "draft-worker" } },
  });
}
