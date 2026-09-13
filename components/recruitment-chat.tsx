"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatRole, RecruitmentChatMessage } from "@/lib/types";

type ChatMessageView = {
  id: string;
  role: ChatRole;
  content: string;
};

/**
 * Per-drive chat assistant on the detail page (plan 1.6.B / task G2). History
 * is loaded server-side by the page (RecruitmentDetailPage already queries
 * recruitment_chat_messages the same way it queries rounds/insights) and
 * handed in as `initialMessages` — no separate GET route exists on G1's
 * endpoint, and every other section on this page already follows the
 * "server component fetches, client component renders" split.
 *
 * Sends go straight to G1's route (`{ activityId, message }` in,
 * `{ reply }` / `{ reply, warning }` / `{ error }` out). The user's message
 * is appended optimistically; if the request fails, it's rolled back rather
 * than left showing as sent — G1 only persists a turn after a successful
 * Groq call, so a failed request never actually saved that message, and
 * leaving it on screen would make it look sent when a reload would drop it.
 */
export function RecruitmentChat({
  activityId,
  initialMessages,
}: {
  activityId: string;
  initialMessages: RecruitmentChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessageView[]>(() =>
    initialMessages.map(({ id, role, content }) => ({ id, role, content }))
  );
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isSending]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    const optimisticId = `pending-${Date.now()}`;
    setError(null);
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text }]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/ai/recruitment-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: "assistant", content: data.reply }]);
      if (data.warning) setError(data.warning);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(text);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div>
      <ul ref={listRef} className="max-h-80 space-y-3 overflow-y-auto rounded border border-line bg-card p-3">
        {messages.length === 0 && (
          <li className="text-sm text-ink-soft">Ask anything about this drive to get started.</li>
        )}
        {messages.map((m) => (
          <li key={m.id}>
            <p className="text-xs text-ink-soft">{m.role === "user" ? "You" : "Assistant"}</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{m.content}</p>
          </li>
        ))}
        {isSending && <li className="text-xs text-ink-soft">Assistant is typing&hellip;</li>}
      </ul>

      <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
        <input
          type="text"
          className="field-input"
          placeholder="Ask about this drive&hellip;"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded bg-moss px-3 py-2 text-xs text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSending ? "Sending\u2026" : "Send"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-rust">{error}</p>}
    </div>
  );
}
