"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the server component when listing_drafts changes. The server stays the one that
 * reads; this only says "read again". Realtime applies RLS, so only the viewer's brands arrive.
 */
export function RealtimeRefresh({ draftId }: { draftId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const channel = supabase.channel(draftId ? `draft-${draftId}` : "drafts");

    void (async () => {
      await supabase.realtime.setAuth();
      if (!active) return;
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "listing_drafts",
            ...(draftId ? { filter: `id=eq.${draftId}` } : {}),
          },
          (payload) => {
            if (!draftId && payload.eventType === "INSERT") toast("A new draft arrived");
            router.refresh();
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [draftId, router]);

  return null;
}
