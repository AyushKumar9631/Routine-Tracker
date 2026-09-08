import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/components/set-password-form";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const hasPassword = Boolean(user.user_metadata?.has_password);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl italic text-ink mb-1">
          {hasPassword ? "Update your password" : "Set a password"}
        </h1>
        <p className="text-sm text-ink-soft mb-8">
          {hasPassword
            ? "Change the password you sign in with."
            : "You signed in with a one-time link. Set a password so you don't need a new email every time."}
        </p>

        <SetPasswordForm redirectTo={next || "/"} skippable={!hasPassword} />
      </div>
    </main>
  );
}
