"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WallCanvas, type WallCanvasHandle } from "@/components/wall-canvas";
import { trackClient } from "@/lib/track-client";
import { TOTAL_SQUARES } from "@/lib/grid";

export function HomeClient({
  stats,
}: {
  stats: { owned: number; users: number; chapterNumber: number };
}) {
  const router = useRouter();
  const wallRef = useRef<WallCanvasHandle>(null);

  useEffect(() => {
    trackClient("landing_page_view");
  }, []);

  return (
    <>
      <section className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-10 pt-16 text-center sm:pt-24">
        <span className="mb-5 rounded-full border border-border bg-surface px-3 py-1 text-xs uppercase tracking-widest text-muted">
          Chapter {String(stats.chapterNumber).padStart(2, "0")} · Live now
        </span>
        <h1 className="text-balance text-5xl font-semibold uppercase tracking-tight sm:text-7xl lg:text-8xl">
          Internet Wall
        </h1>
        <p className="mt-5 max-w-md text-balance text-lg text-muted sm:text-xl">
          Own a tiny piece of the internet.
        </p>
        <p className="mt-1 max-w-lg text-balance text-sm text-muted">
          100,000 squares. One giant wall. Yours could be part of it.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/wall"
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Explore the Wall
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Get your square
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl grid-cols-2 gap-3 px-4 pb-14 sm:grid-cols-4 sm:gap-4">
        <Stat value={TOTAL_SQUARES.toLocaleString()} label="Total squares" />
        <Stat value={stats.owned.toLocaleString()} label="Owned" />
        <Stat value="€1" label="Starting price" />
        <Stat value={`Ch. ${String(stats.chapterNumber).padStart(2, "0")}`} label="90 days" />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted">A live look at the wall — drag, scroll to zoom, click a square.</p>
          <Link href="/wall" className="text-sm text-accent hover:underline">
            Open full wall →
          </Link>
        </div>
        <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-border sm:h-[520px]">
          <WallCanvas
            ref={wallRef}
            version={0}
            onSelectSquare={(id) => router.push(`/wall?square=${id}`)}
          />
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted">
        Internet Wall — a small digital experiment. Not a marketplace, not a game. Just a wall.
      </footer>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-5 text-center">
      <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
