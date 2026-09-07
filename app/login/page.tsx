"use client";

import { useState, type FormEvent } from "react";
import { signInWithMagicLink } from "@/actions/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await signInWithMagicLink(email, window.location.origin);
      setStatus("sent");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl italic text-ink mb-1">Routine</h1>
        <p className="text-sm text-ink-soft mb-8">
          A log of what you actually did — sign in to keep it going.
        </p>

        {status === "sent" ? (
          <div className="rounded border border-moss/40 bg-moss-soft px-4 py-3 text-sm text-ink">
            Check <span className="font-mono">{email}</span> for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field-input"
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-rust">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "Sending link\u2026" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
