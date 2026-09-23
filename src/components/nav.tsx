"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { CommandBar } from "@/components/command-bar";

function navLinkClass(active: boolean): string {
  return active ? "text-foreground transition-colors" : "text-muted transition-colors hover:text-foreground";
}

export function Nav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src="/logo.png" alt="" className="h-6 w-6" />
          Mentathlos
        </Link>

        <nav className="hidden items-center gap-6 text-sm sm:flex">
          {session?.user && (
            <>
              <Link href="/dashboard" className={navLinkClass(isActive("/dashboard"))} aria-current={isActive("/dashboard") ? "page" : undefined}>
                {session.user.selfCoaching ? "Il mio allenamento" : "Home"}
              </Link>
              {!session.user.selfCoaching && (
                <Link href="/athletes" className={navLinkClass(isActive("/athletes"))} aria-current={isActive("/athletes") ? "page" : undefined}>
                  Atleti
                </Link>
              )}
              {!session.user.selfCoaching && (
                <Link href="/teams" className={navLinkClass(isActive("/teams"))} aria-current={isActive("/teams") ? "page" : undefined}>
                  Squadre
                </Link>
              )}
              <Link href="/calendar" className={navLinkClass(isActive("/calendar"))} aria-current={isActive("/calendar") ? "page" : undefined}>
                Calendario
              </Link>
              <Link href="/exercises" className={navLinkClass(isActive("/exercises"))} aria-current={isActive("/exercises") ? "page" : undefined}>
                Esercizi
              </Link>
              <Link href="/coach-brain" className={navLinkClass(isActive("/coach-brain"))} aria-current={isActive("/coach-brain") ? "page" : undefined}>
                Coach Brain
              </Link>
              {!session.user.selfCoaching && (
                <Link href="/payments" className={navLinkClass(isActive("/payments"))} aria-current={isActive("/payments") ? "page" : undefined}>
                  Pagamenti
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {status === "loading" ? null : session?.user ? (
            <>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("mentathlos:open-command-bar"))}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2"
                title="Vai a un atleta, una squadra o una sezione"
              >
                Cerca <span className="rounded border border-border px-1 text-[10px]">⌘K</span>
              </button>
              <span className="text-sm text-muted">{session.user.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                Esci
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors">
                Accedi
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                Inizia ad allenare
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border sm:hidden"
          aria-label="Menu"
        >
          <div className="space-y-1">
            <span className="block h-px w-4 bg-foreground" />
            <span className="block h-px w-4 bg-foreground" />
            <span className="block h-px w-4 bg-foreground" />
          </div>
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-t border-border bg-background px-4 py-3 sm:hidden">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className={`rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${isActive("/dashboard") ? "bg-surface-2 text-foreground" : ""}`}
                onClick={() => setOpen(false)}
              >
                {session.user.selfCoaching ? "Il mio allenamento" : "Home"}
              </Link>
              {!session.user.selfCoaching && (
                <Link
                  href="/athletes"
                  className={`rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${isActive("/athletes") ? "bg-surface-2 text-foreground" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  Atleti
                </Link>
              )}
              {!session.user.selfCoaching && (
                <Link
                  href="/teams"
                  className={`rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${isActive("/teams") ? "bg-surface-2 text-foreground" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  Squadre
                </Link>
              )}
              <Link
                href="/calendar"
                className={`rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${isActive("/calendar") ? "bg-surface-2 text-foreground" : ""}`}
                onClick={() => setOpen(false)}
              >
                Calendario
              </Link>
              <Link
                href="/exercises"
                className={`rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${isActive("/exercises") ? "bg-surface-2 text-foreground" : ""}`}
                onClick={() => setOpen(false)}
              >
                Esercizi
              </Link>
              <Link
                href="/coach-brain"
                className={`rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${isActive("/coach-brain") ? "bg-surface-2 text-foreground" : ""}`}
                onClick={() => setOpen(false)}
              >
                Coach Brain
              </Link>
              {!session.user.selfCoaching && (
                <Link
                  href="/payments"
                  className={`rounded-md px-2 py-2 text-sm hover:bg-surface-2 ${isActive("/payments") ? "bg-surface-2 text-foreground" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  Pagamenti
                </Link>
              )}
              <button onClick={() => signOut({ callbackUrl: "/" })} className="rounded-md px-2 py-2 text-left text-sm hover:bg-surface-2">
                Esci
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-2 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
                Accedi
              </Link>
              <Link href="/register" className="rounded-md px-2 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
                Inizia ad allenare
              </Link>
            </>
          )}
        </div>
      )}

      {session?.user && <CommandBar selfCoaching={!!session.user.selfCoaching} />}
    </header>
  );
}
