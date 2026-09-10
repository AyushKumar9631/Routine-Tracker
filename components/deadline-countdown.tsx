"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "Past deadline";
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

/**
 * Live-ticking "Xh Ym left" label for a deadline. Renders nothing until
 * mounted (msLeft starts null) so the server-rendered markup and the
 * first client render match exactly — the real value fills in a moment
 * later via the effect, avoiding a hydration mismatch on a clock-driven
 * value.
 */
export function DeadlineCountdown({ deadline }: { deadline: string | null }) {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setMsLeft(null);
      return;
    }
    const target = new Date(deadline).getTime();
    const tick = () => setMsLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline || msLeft === null) return null;

  return (
    <span
      className={cn(
        "shrink-0 font-mono text-xs tabular-nums",
        msLeft <= 0 ? "text-rust" : msLeft < 60 * 60_000 ? "text-amber" : "text-ink-soft"
      )}
    >
      {formatTimeLeft(msLeft)}
    </span>
  );
}
