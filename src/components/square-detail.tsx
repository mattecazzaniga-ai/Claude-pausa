"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { idToCoords } from "@/lib/grid";
import { formatEUR, formatDate } from "@/lib/format";
import type { SquareDetailData } from "@/lib/types";

const SWATCHES = ["#5b7cff", "#7dd3fc", "#d4a24c", "#f97362", "#34d399", "#f3f3f1", "#1a1b1f"];

export function SquareDetail({
  squareId,
  initialData,
  onClose,
  onChanged,
}: {
  squareId: number;
  initialData?: SquareDetailData;
  onClose?: () => void;
  onChanged?: () => void;
}) {
  const { data: session } = useSession();
  const [square, setSquare] = useState<SquareDetailData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [bgColor, setBgColor] = useState("#5b7cff");
  const [listPrice, setListPrice] = useState("");

  const { x, y } = idToCoords(squareId);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/squares/${squareId}`);
      const data = await res.json();
      setSquare(data);
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setImageUrl(data.imageUrl ?? "");
      setExternalUrl(data.externalUrl ?? "");
      setBgColor(data.backgroundColor ?? "#5b7cff");
      setListPrice(data.activeListing ? String(data.activeListing.price) : String(Math.max(data.price, 1)));
    } catch {
      setError("Failed to load square.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialData) {
      load();
    } else {
      setTitle(initialData.title ?? "");
      setDescription(initialData.description ?? "");
      setImageUrl(initialData.imageUrl ?? "");
      setExternalUrl(initialData.externalUrl ?? "");
      setBgColor(initialData.backgroundColor ?? "#5b7cff");
      setListPrice(initialData.activeListing ? String(initialData.activeListing.price) : String(Math.max(initialData.price, 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareId]);

  const isOwner = Boolean(session?.user && square?.owner && session.user.username === square.owner.username);

  async function buy() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/squares/${squareId}/purchase`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not start checkout.");
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  async function buyListing() {
    if (!square?.activeListing) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/listings/${square.activeListing.id}/buy`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not start checkout.");
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  async function saveCustomization() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/squares/${squareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, imageUrl, externalUrl, backgroundColor: bgColor }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save changes.");
      return;
    }
    setEditing(false);
    await load();
    onChanged?.();
  }

  async function listForResale() {
    const price = Number(listPrice);
    if (!price || price <= 0) {
      setError("Enter a valid resale price.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/squares/${squareId}/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not list this square.");
      return;
    }
    await load();
    onChanged?.();
  }

  async function cancelListing() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/squares/${squareId}/list`, { method: "DELETE" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not cancel listing.");
      return;
    }
    await load();
    onChanged?.();
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!square) {
    return <p className="p-6 text-sm text-muted">Could not load this square.</p>;
  }

  const statusLabel =
    square.status === "AVAILABLE" ? "Available" : square.status === "LISTED" ? "Listed for resale" : "Owned";

  return (
    <div className="animate-scale-in">
      <div
        className="flex h-28 items-end justify-between rounded-t-xl px-5 pb-3 sm:h-36"
        style={{ background: square.backgroundColor || "linear-gradient(135deg,#1a1b1f,#101114)" }}
      >
        <div>
          <p className="text-xs font-medium text-white/70">
            #{square.id} · ({x}, {y})
          </p>
          {square.title && <p className="mt-1 text-lg font-semibold text-white drop-shadow">{square.title}</p>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${
              square.status === "AVAILABLE"
                ? "bg-accent/15 text-accent"
                : square.status === "LISTED"
                  ? "bg-gold/15 text-gold"
                  : "bg-surface-2 text-muted"
            }`}
          >
            {statusLabel}
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">
            {square.activeListing ? formatEUR(square.activeListing.price) : formatEUR(square.price)}
          </span>
          {square.owner && (
            <Link href={`/profile/${square.owner.username}`} className="rounded-full bg-surface-2 px-2.5 py-1 text-muted hover:text-foreground">
              @{square.owner.username}
            </Link>
          )}
        </div>

        {square.description && !editing && <p className="text-sm text-muted">{square.description}</p>}

        {square.imageUrl && !editing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={square.imageUrl} alt={square.title ?? `Square ${square.id}`} className="max-h-56 w-full rounded-lg object-cover" />
        )}

        {square.externalUrl && !editing && (
          <a
            href={square.externalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-block text-sm text-accent underline underline-offset-4"
          >
            {square.externalUrl.replace(/^https?:\/\//, "")} ↗
          </a>
        )}

        {square.purchasedAt && (
          <p className="text-xs text-muted">Owned since {formatDate(square.purchasedAt)}</p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Purchase (primary) */}
        {square.status === "AVAILABLE" && (
          <div className="space-y-2 border-t border-border pt-4">
            {session?.user ? (
              <button
                onClick={buy}
                disabled={busy}
                className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Starting checkout…" : `Buy this square — ${formatEUR(square.price)}`}
              </button>
            ) : (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/square/${squareId}`)}`}
                className="block w-full rounded-md bg-accent py-2.5 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Log in to buy this square
              </Link>
            )}
          </div>
        )}

        {/* Purchase (secondary / resale) */}
        {square.status === "LISTED" && !isOwner && (
          <div className="space-y-2 border-t border-border pt-4">
            {session?.user ? (
              <button
                onClick={buyListing}
                disabled={busy}
                className="w-full rounded-md bg-gold py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Starting checkout…" : `Buy for ${formatEUR(square.activeListing?.price ?? square.price)}`}
              </button>
            ) : (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/square/${squareId}`)}`}
                className="block w-full rounded-md bg-gold py-2.5 text-center text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                Log in to buy this square
              </Link>
            )}
          </div>
        )}

        {/* Owner controls */}
        {isOwner && (
          <div className="space-y-4 border-t border-border pt-4">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="w-full rounded-md border border-border py-2 text-sm transition-colors hover:bg-surface-2"
              >
                Customize this square
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Title</label>
                  <input
                    value={title}
                    maxLength={60}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="Give your square a name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Description</label>
                  <textarea
                    value={description}
                    maxLength={280}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="A short description"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Image URL (optional)</label>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Link (optional)</label>
                  <input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="https://yoursite.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Background color</label>
                  <div className="flex flex-wrap gap-2">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setBgColor(c)}
                        className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-surface ${bgColor === c ? "ring-2 ring-accent" : ""}`}
                        style={{ background: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveCustomization}
                    disabled={busy}
                    className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4">
              {square.status === "LISTED" ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    Listed for {formatEUR(square.activeListing?.price ?? 0)}. A 5% platform fee applies on sale.
                  </p>
                  <button
                    onClick={cancelListing}
                    disabled={busy}
                    className="w-full rounded-md border border-border py-2 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    {busy ? "Cancelling…" : "Cancel listing"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    className="w-28 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <button
                    onClick={listForResale}
                    disabled={busy}
                    className="flex-1 rounded-md border border-border py-2 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    {busy ? "Listing…" : "List for resale"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
