import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/supabase/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/drafts";
  if (await getViewer()) redirect(safeNext);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Draft
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to review listings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            New and changed products land here before anything goes back to the store.
          </p>
        </div>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
