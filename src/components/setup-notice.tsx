/** Shown instead of the app until Supabase is connected, rather than a server crash. */
export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-4 py-16">
      <p className="text-sm font-medium text-primary">Almost there</p>
      <h1 className="text-3xl font-bold">The database isn&apos;t connected yet</h1>
      <p className="text-muted-foreground">
        This deployment is missing <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Link a Supabase project to this Vercel project
        (Supabase dashboard → Integrations → Vercel), then redeploy. See <code>DEPLOY.md</code> in the repo.
      </p>
    </main>
  );
}
