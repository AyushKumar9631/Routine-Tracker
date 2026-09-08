import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Existing magic-link-only accounts (and brand-new signups) won't
      // have a password yet — route them to set one instead of dropping
      // them straight into the app.
      const hasPassword = Boolean(user?.user_metadata?.has_password);
      if (!hasPassword) {
        const setPasswordUrl = new URL("/account/set-password", origin);
        setPasswordUrl.searchParams.set("next", next);
        return NextResponse.redirect(setPasswordUrl);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
