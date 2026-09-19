"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shows one card at a time from `items`, all in the same section — swipe
 * left/right or use the arrow buttons/dots to swap. Every card stays
 * mounted (just shifted off-screen via `translateX`), not conditionally
 * rendered, so a live thing like the study timer's ticking clock keeps
 * running in the background while Screen Time is the one showing.
 */
export function TodayTopCards({ items }: { items: { id: string; node: React.ReactNode }[] }) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);

  if (items.length === 0) return null;
  if (items.length === 1) return <div>{items[0].node}</div>;

  const clamped = Math.min(index, items.length - 1);

  function go(next: number) {
    setIndex(((next % items.length) + items.length) % items.length);
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current == null) return;
    deltaX.current = e.touches[0].clientX - startX.current;
  }
  function onTouchEnd() {
    if (Math.abs(deltaX.current) > 40) {
      go(clamped + (deltaX.current < 0 ? 1 : -1));
    }
    startX.current = null;
    deltaX.current = 0;
  }

  return (
    <div>
      <div
        className="overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${clamped * 100}%)`, width: `${items.length * 100}%` }}
        >
          {items.map((item) => (
            <div key={item.id} className="shrink-0" style={{ width: `${100 / items.length}%` }}>
              {item.node}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 mb-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => go(clamped - 1)}
          aria-label="Previous card"
          className="px-1 text-ink-soft hover:text-ink"
        >
          &larr;
        </button>
        <div className="flex gap-1.5">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show card ${i + 1}`}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === clamped ? "bg-ink" : "bg-line"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(clamped + 1)}
          aria-label="Next card"
          className="px-1 text-ink-soft hover:text-ink"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}
