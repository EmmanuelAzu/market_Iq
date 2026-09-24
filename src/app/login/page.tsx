import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/watchlist", error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>We&apos;ll email you a magic link.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <p className="text-sm text-destructive">That link expired. Try again.</p>}
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
