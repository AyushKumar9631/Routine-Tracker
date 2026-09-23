"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Toggles the `dark` class on <html> (set on first paint by the inline
 * script in app/layout.tsx) and remembers the choice. Starts null so the
 * server-rendered markup and the first client render match exactly, then
 * reads the class the init script already applied.
 *
 * Right now only the LeetCode card (components/leetcode-card.tsx) has a
 * dark: variant, so toggling elsewhere on the site won't visibly change
 * much yet — that fills in as each card gets redesigned.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem("theme", next);
    } catch {
      // localStorage unavailable (private browsing, etc.) — the toggle still
      // works for this session, it just won't persist across visits.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line text-sm text-ink-soft transition-colors hover:border-moss hover:text-ink"
    >
      {theme === "dark" ? "\u2600\ufe0f" : theme === "light" ? "\ud83c\udf19" : ""}
    </button>
  );
}
