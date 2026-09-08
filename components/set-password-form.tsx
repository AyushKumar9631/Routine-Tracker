"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setPassword } from "@/actions/auth";

export function SetPasswordForm({
  redirectTo,
  skippable,
}: {
  redirectTo: string;
  skippable: boolean;
}) {
  const router = useRouter();
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setErrorMessage("Use at least 8 characters.");
      setStatus("error");
      return;
    }
    if (password !== confirm) {
      setErrorMessage("Passwords don't match.");
      setStatus("error");
      return;
    }

    setStatus("pending");
    setErrorMessage("");
    try {
      await setPassword(password);
      router.refresh();
      router.push(redirectTo);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="field-label">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPasswordValue(e.target.value)}
          placeholder="At least 8 characters"
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="field-label">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
          className="field-input"
        />
      </div>

      {status === "error" && <p className="text-sm text-rust">{errorMessage}</p>}

      <button
        type="submit"
        disabled={status === "pending"}
        className="w-full rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "pending" ? "Saving\u2026" : "Set password"}
      </button>

      {skippable && (
        <Link
          href={redirectTo}
          className="block text-center text-xs text-ink-soft hover:text-ink transition-colors"
        >
          Skip for now
        </Link>
      )}
    </form>
  );
}
