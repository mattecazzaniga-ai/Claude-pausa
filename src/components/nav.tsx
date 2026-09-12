"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Nav() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-2 w-2 rounded-[2px] bg-accent" />
          Internet Wall
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
          <Link href="/wall" className="hover:text-foreground transition-colors">
            The Wall
          </Link>
          {session?.user && (
            <Link href={`/profile/${session.user.username}`} className="hover:text-foreground transition-colors">
              My Squares
            </Link>
          )}
          {session?.user?.isAdmin && (
            <Link href="/admin" className="hover:text-foreground transition-colors">
              Admin
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {status === "loading" ? null : session?.user ? (
            <>
              <span className="text-sm text-muted">@{session.user.username}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Get your square
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border sm:hidden"
          aria-label="Toggle menu"
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
          <Link href="/wall" className="rounded-md px-2 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
            The Wall
          </Link>
          {session?.user ? (
            <>
              <Link
                href={`/profile/${session.user.username}`}
                className="rounded-md px-2 py-2 text-sm hover:bg-surface-2"
                onClick={() => setOpen(false)}
              >
                My Squares
              </Link>
              {session.user.isAdmin && (
                <Link href="/admin" className="rounded-md px-2 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
                  Admin
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md px-2 py-2 text-left text-sm hover:bg-surface-2"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-2 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
                Log in
              </Link>
              <Link href="/register" className="rounded-md px-2 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
                Get your square
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
