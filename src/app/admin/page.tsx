import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatEUR, formatDate } from "@/lib/format";
import { Nav } from "@/components/nav";
import { SuspendButton, AdvanceChapterButton, SquareModeration } from "./admin-client";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) redirect("/");

  const [totalUsers, squaresSold, available, revenueAgg, secondaryAgg, feesAgg, chapter, recentTx, recentUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.square.count({ where: { status: { in: ["OWNED", "LISTED"] } } }),
      prisma.square.count({ where: { status: "AVAILABLE" } }),
      prisma.transaction.aggregate({ where: { status: "COMPLETED", type: "PRIMARY" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { status: "COMPLETED", type: "SECONDARY" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { status: "COMPLETED" }, _sum: { platformFee: true } }),
      prisma.chapter.findFirst({ where: { status: "ACTIVE" }, orderBy: { number: "desc" } }),
      prisma.transaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { buyer: { select: { username: true } }, square: { select: { id: true } } },
      }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin</h1>
          {chapter && <AdvanceChapterButton currentNumber={chapter.number} />}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Total users" value={totalUsers.toLocaleString()} />
          <Metric label="Squares sold" value={squaresSold.toLocaleString()} />
          <Metric label="Available" value={available.toLocaleString()} />
          <Metric label="Active chapter" value={chapter ? `#${chapter.number}` : "—"} />
          <Metric label="Primary revenue" value={formatEUR(revenueAgg._sum.amount ?? 0)} />
          <Metric label="Secondary volume" value={formatEUR(secondaryAgg._sum.amount ?? 0)} />
          <Metric label="Platform fees" value={formatEUR(feesAgg._sum.platformFee ?? 0)} />
          <Metric
            label="Chapter ends"
            value={chapter ? formatDate(chapter.endDate) : "—"}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Recent transactions</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Square</th>
                    <th className="px-3 py-2 text-left">Buyer</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link href={`/square/${t.square.id}`} className="text-accent hover:underline">
                          #{t.square.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2">@{t.buyer.username}</td>
                      <td className="px-3 py-2 text-muted">{t.type}</td>
                      <td className="px-3 py-2 text-right">{formatEUR(t.amount)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            t.status === "COMPLETED"
                              ? "text-accent"
                              : t.status === "PENDING"
                                ? "text-gold"
                                : "text-red-400"
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recentTx.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted">
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">Recent users</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Joined</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link href={`/profile/${u.username}`} className="hover:underline">
                          @{u.username}
                        </Link>
                        {u.isSuspended && <span className="ml-2 text-xs text-red-400">suspended</span>}
                      </td>
                      <td className="px-3 py-2 text-muted">{formatDate(u.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        {!u.isAdmin && <SuspendButton userId={u.id} isSuspended={u.isSuspended} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <SquareModeration />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
