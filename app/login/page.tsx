"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithMagicLink, signInWithPassword } from "@/actions/auth";

type Mode = "password" | "magiclink";
type Status = "idle" | "pending" | "sent" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setErrorMessage("");
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("pending");
    setErrorMessage("");
    try {
      await signInWithPassword(email, password);
      router.refresh();
      router.push("/");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  async function handleMagicLinkSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("pending");
    setErrorMessage("");
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

        {mode === "magiclink" && status === "sent" ? (
          <div className="rounded border border-moss/40 bg-moss-soft px-4 py-3 text-sm text-ink">
            Check <span className="font-mono">{email}</span> for a sign-in link.
          </div>
        ) : mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
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

            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                className="field-input"
              />
            </div>

            {status === "error" && <p className="text-sm text-rust">{errorMessage}</p>}

            <button
              type="submit"
              disabled={status === "pending"}
              className="w-full rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "pending" ? "Signing in\u2026" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => switchMode("magiclink")}
              className="w-full text-center text-xs text-ink-soft hover:text-ink transition-colors"
            >
              Forgot your password, or first time here? Email me a link instead
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
            <div>
              <label htmlFor="magiclink-email" className="field-label">
                Email
              </label>
              <input
                id="magiclink-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field-input"
              />
            </div>

            {status === "error" && <p className="text-sm text-rust">{errorMessage}</p>}

            <button
              type="submit"
              disabled={status === "pending"}
              className="w-full rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "pending" ? "Sending link\u2026" : "Send sign-in link"}
            </button>

            <button
              type="button"
              onClick={() => switchMode("password")}
              className="w-full text-center text-xs text-ink-soft hover:text-ink transition-colors"
            >
              Already set a password? Sign in with it instead
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
