"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SuspendButton({ userId, isSuspended }: { userId: string; isSuspended: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/admin/users/${userId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !isSuspended }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50 ${
        isSuspended ? "text-accent" : "text-red-400"
      }`}
    >
      {busy ? "…" : isSuspended ? "Unsuspend" : "Suspend"}
    </button>
  );
}

export function AdvanceChapterButton({ currentNumber }: { currentNumber: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function advance() {
    if (!confirm(`End Chapter ${currentNumber} and start Chapter ${currentNumber + 1}?`)) return;
    setBusy(true);
    await fetch("/api/admin/chapters", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={advance}
      disabled={busy}
      className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      {busy ? "Advancing…" : `End Chapter ${currentNumber} →`}
    </button>
  );
}

export function SquareModeration() {
  const [id, setId] = useState("");
  const [square, setSquare] = useState<{
    id: number;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    externalUrl: string | null;
    owner: { username: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/squares/${id}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Not found");
      setSquare(null);
      return;
    }
    setSquare(data.square);
  }

  async function clearContent() {
    if (!square) return;
    setLoading(true);
    await fetch(`/api/admin/squares/${square.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: null, description: null, imageUrl: null, externalUrl: null, backgroundColor: null }),
    });
    setLoading(false);
    await load();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-medium">Moderate a square</h3>
      <div className="flex gap-2">
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Square id (0-99999)"
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button onClick={load} className="shrink-0 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2">
          Load
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {square && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-surface-2 p-3 text-sm">
          <p>
            <span className="text-muted">Owner:</span> {square.owner ? `@${square.owner.username}` : "—"}
          </p>
          <p>
            <span className="text-muted">Title:</span> {square.title || "—"}
          </p>
          <p>
            <span className="text-muted">Description:</span> {square.description || "—"}
          </p>
          <button
            onClick={clearContent}
            disabled={loading}
            className="mt-2 rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Remove content (keep ownership)
          </button>
        </div>
      )}
    </div>
  );
}
