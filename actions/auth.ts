"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithMagicLink(email: string, origin: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) throw new Error(error.message);
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

// Sets (or changes) the password on the current session's account and
// flags it in user_metadata so we stop nudging them to set one. Requires
// an existing session — only ever called from an already-authenticated
// context (post magic-link callback, or the set-password screen).
export async function setPassword(password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
    data: { has_password: true },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
