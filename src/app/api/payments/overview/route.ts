import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Master prompt PART 1 §3: only numbers that actually help the coach run
 * their business — revenue collected, money expected, money still due, and
 * how many athletes currently hold a package.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coachId = session.user.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [revenueAgg, upcomingAgg, outstandingAgg, activePackages, recentPayments] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: "PAID", paidAt: { gte: monthStart }, purchase: { coachId } },
    }),
    // "Upcoming" — an online checkout the athlete has started but not yet completed.
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: "PENDING", method: "ONLINE", purchase: { coachId } },
    }),
    // "Outstanding" — money the coach still needs to collect manually, or that's gone overdue.
    prisma.payment.aggregate({
      _sum: { amountCents: true },
      where: { status: { in: ["PENDING", "OVERDUE"] }, method: { not: "ONLINE" }, purchase: { coachId } },
    }),
    prisma.purchase.count({ where: { coachId, status: "ACTIVE", offer: { type: { not: "SINGLE_SESSION" } } } }),
    prisma.payment.findMany({
      where: { purchase: { coachId } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { purchase: { include: { athlete: { select: { id: true, name: true } }, offer: { select: { name: true } } } } },
    }),
  ]);

  return NextResponse.json({
    revenueThisMonthCents: revenueAgg._sum.amountCents ?? 0,
    upcomingCents: upcomingAgg._sum.amountCents ?? 0,
    outstandingCents: outstandingAgg._sum.amountCents ?? 0,
    activePackages,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      athleteName: p.purchase.athlete.name,
      athleteId: p.purchase.athlete.id,
      offerName: p.purchase.offer.name,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      method: p.method,
      createdAt: p.createdAt,
    })),
  });
}
