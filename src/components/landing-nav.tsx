"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";

const ANCHOR_LINKS = [
  { href: "#funzioni", label: "Funzioni" },
  { href: "#come-funziona", label: "Come funziona" },
  { href: "#ai", label: "AI" },
  { href: "#prezzi", label: "Prezzi" },
];

/**
 * A dedicated navbar for the public landing page only — deliberately
 * separate from the shared <Nav/> used by the authenticated app, since a
 * marketing page (section anchors, "Prova gratis") has nothing in common
 * with the app's own in-product navigation. Never touches <Nav/>.
 */
export function LandingNav() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const isAuthed = status === "authenticated" && Boolean(session?.user);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src="/logo.png" alt="" className="h-7 w-7" />
          Mentathlos
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {ANCHOR_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthed ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Vai alla dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted transition-colors hover:text-foreground">
                Accedi
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                Prova gratis
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden"
          aria-label="Menu"
          aria-expanded={open}
        >
          <div className="space-y-1">
            <span className="block h-px w-4 bg-foreground" />
            <span className="block h-px w-4 bg-foreground" />
            <span className="block h-px w-4 bg-foreground" />
          </div>
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-t border-border bg-background px-4 py-3 md:hidden">
          {ANCHOR_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 text-sm hover:bg-surface-2"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            {isAuthed ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-black"
              >
                Vai alla dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm hover:bg-surface-2">
                  Accedi
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-black"
                >
                  Prova gratis
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
