"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WallCanvas, type WallCanvasHandle } from "@/components/wall-canvas";
import { Modal } from "@/components/modal";
import { SquareDetail } from "@/components/square-detail";
import { isValidId } from "@/lib/grid";
import { trackClient } from "@/lib/track-client";

export function WallClient({ stats }: { stats: { owned: number; total: number; chapterNumber: number } }) {
  const wallRef = useRef<WallCanvasHandle>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    trackClient("wall_open");
  }, []);

  // Deep-linked square, e.g. /wall?square=41234
  useEffect(() => {
    const sq = searchParams.get("square");
    if (sq && isValidId(Number(sq))) {
      const id = Number(sq);
      setTimeout(() => {
        wallRef.current?.navigateToSquare(id);
        setSelected(id);
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error ?? "Not found.");
        return;
      }
      if (data.id === null) {
        setSearchError(`@${data.username} doesn't own any squares yet.`);
        return;
      }
      wallRef.current?.navigateToSquare(data.id);
      setSearchError(null);
    } catch {
      setSearchError("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function closeModal() {
    setSelected(null);
    if (searchParams.get("square")) router.replace("/wall");
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <WallCanvas ref={wallRef} onSelectSquare={setSelected} version={version} />

      {/* Top bar overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <Link
          href="/"
          className="pointer-events-auto flex h-9 items-center gap-2 rounded-full border border-border bg-surface/90 px-3 text-sm font-medium backdrop-blur"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-[1px] bg-accent" />
          <span className="hidden sm:inline">Internet Wall</span>
        </Link>

        <form onSubmit={onSearch} className="pointer-events-auto flex-1 max-w-sm">
          <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface/90 px-3 backdrop-blur">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username, #square, or x,y"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
            {searching && <div className="h-3 w-3 shrink-0 animate-spin rounded-full border border-border border-t-accent" />}
          </div>
          {searchError && (
            <p className="mt-1 rounded-md bg-surface/90 px-2 py-1 text-xs text-red-400 backdrop-blur">{searchError}</p>
          )}
        </form>

        <div className="pointer-events-auto hidden items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs text-muted backdrop-blur sm:flex">
          <span>
            <span className="text-foreground">{stats.owned.toLocaleString()}</span> / {stats.total.toLocaleString()} owned
          </span>
          <span className="opacity-40">·</span>
          <span>Chapter {String(stats.chapterNumber).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden gap-3 rounded-full border border-border bg-surface/90 px-3 py-2 text-[11px] text-muted backdrop-blur sm:flex">
        <LegendItem color="#4256a0" label="Prime (€3)" />
        <LegendItem color="#333e6b" label="€2" />
        <LegendItem color="#2b3149" label="€1.5" />
        <LegendItem color="#262a35" label="€1" />
        <LegendItem color="#2a2c33" label="Owned" />
        <LegendItem color="#d4a24c" label="For resale" />
      </div>

      {selected !== null && (
        <Modal onClose={closeModal}>
          <SquareDetail squareId={selected} onClose={closeModal} onChanged={() => setVersion((v) => v + 1)} />
        </Modal>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
