import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { prisma } from "@/lib/prisma";
import { formatEUR, formatDate } from "@/lib/format";
import { idToCoords } from "@/lib/grid";

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    include: {
      squares: { orderBy: { id: "asc" } },
      listings: { where: { status: "ACTIVE" }, include: { square: true } },
    },
  });

  if (!user) notFound();

  const spent = await prisma.transaction.aggregate({
    where: { buyerId: user.id, status: "COMPLETED" },
    _sum: { amount: true },
  });

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/20 text-2xl font-semibold text-accent">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.username} className="h-full w-full rounded-full object-cover" />
            ) : (
              user.username[0]?.toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold">@{user.username}</h1>
            <p className="text-sm text-muted">Joined {formatDate(user.createdAt)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatCard value={user.squares.length} label="Squares owned" />
          <StatCard value={formatEUR(spent._sum.amount ?? 0)} label="Total spent" />
          <StatCard value={user.listings.length} label="Listed for resale" />
        </div>

        {user.listings.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Listed for resale</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {user.listings.map((listing) => (
                <SquareTile
                  key={listing.id}
                  id={listing.squareId}
                  color={listing.square.backgroundColor}
                  title={listing.square.title}
                  badge={formatEUR(listing.price)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Owned squares</h2>
          {user.squares.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              No squares yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {user.squares.map((square) => (
                <SquareTile key={square.id} id={square.id} color={square.backgroundColor} title={square.title} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function SquareTile({ id, color, title, badge }: { id: number; color: string | null; title: string | null; badge?: string }) {
  const { x, y } = idToCoords(id);
  return (
    <Link
      href={`/square/${id}`}
      className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-lg border border-border p-2 transition-transform hover:scale-[1.03]"
      style={{ background: color || "#2a2c33" }}
    >
      {badge && (
        <span className="absolute right-1.5 top-1.5 rounded bg-gold px-1.5 py-0.5 text-[10px] font-medium text-black">
          {badge}
        </span>
      )}
      <span className="truncate text-[11px] font-medium text-white drop-shadow">{title || `#${id}`}</span>
      <span className="text-[10px] text-white/70">
        ({x}, {y})
      </span>
    </Link>
  );
}
