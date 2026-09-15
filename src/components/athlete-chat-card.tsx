"use client";

import { useState } from "react";
import { trackClient } from "@/lib/track-client";

type Message = { role: "coach" | "assistant"; text: string };

/**
 * "Ask your Coaching AI" — grounded in this athlete's own real context
 * (same builder the Next Best Action engine uses), not a generic chatbot.
 * Conversation lives only in this component's state — nothing is
 * persisted server-side yet (see route.ts comment).
 */
export function AthleteChatCard({ basePath }: { basePath: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking) return;

    const nextMessages: Message[] = [...messages, { role: "coach", text: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setAsking(true);
    setError(null);

    const res = await fetch(`${basePath}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: trimmed, history: messages }),
    });
    const data = await res.json();
    setAsking(false);

    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione della risposta.");
      return;
    }

    setMessages([...nextMessages, { role: "assistant", text: data.answer }]);
    trackClient("athlete_chat_question_asked", {});
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-accent">
          AI Assistant
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Chiedi alla tua AI di coaching</h2>
      </div>

      {messages.length === 0 && (
        <p className="mb-3 text-sm text-muted">
          Fai una domanda su questo atleta — es. &ldquo;Cosa dovrei allenare nella prossima sessione?&rdquo;. Risponde usando solo lo
          storico reale registrato qui, mai inventando.
        </p>
      )}

      {messages.length > 0 && (
        <div className="mb-3 max-h-96 space-y-3 overflow-y-auto">
          {messages.map((m, i) =>
            m.role === "coach" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-surface-2 px-3.5 py-2.5 text-sm">
                {m.text}
              </div>
            ) : (
              <div key={i} className="max-w-[92%] whitespace-pre-line rounded-lg rounded-tl-sm border border-border bg-background px-3.5 py-3 text-sm text-foreground/90">
                {m.text}
              </div>
            )
          )}
          {asking && <div className="max-w-[92%] rounded-lg rounded-tl-sm border border-border bg-background px-3.5 py-3 text-sm text-muted">Sto pensando…</div>}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      <form onSubmit={ask} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Es. Cosa dovrei allenare nella prossima sessione?"
          maxLength={500}
          disabled={asking}
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Chiedi
        </button>
      </form>
    </div>
  );
}
