import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { isStripeConfigured } from "@/lib/stripe";
import { Nav } from "@/components/nav";
import { AthleteClient } from "./athlete-client";
import type { AthleteData } from "./types";

export default async function AthletePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?callbackUrl=/athletes/${params.id}`);

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.id },
    include: {
      sport: { select: { name: true } },
      sessionNotes: {
        orderBy: { sessionDate: "desc" },
        include: { tags: { include: { skill: true } } },
      },
      goals: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
    },
  });

  if (!athlete || athlete.coachId !== session.user.id) notFound();

  const data: AthleteData = {
    id: athlete.id,
    name: athlete.name,
    level: athlete.level,
    objectives: athlete.objectives,
    sportName: athlete.sport.name,
    aiSummary: athlete.aiSummary,
    aiPriorities: (athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [],
    aiSummaryUpdatedAt: athlete.aiSummaryUpdatedAt?.toISOString() ?? null,
    notes: athlete.sessionNotes.map((n) => ({
      id: n.id,
      rawText: n.rawText,
      sessionDate: n.sessionDate.toISOString(),
      aiProcessed: n.aiProcessed,
      tags: n.tags.map((t) => ({ skillName: t.skill.name, sentiment: t.sentiment, excerpt: t.excerpt })),
    })),
    goals: athlete.goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      termLength: g.termLength,
      kind: g.kind,
      baselineValue: g.baselineValue,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      unit: g.unit,
      deadline: g.deadline?.toISOString() ?? null,
      status: g.status,
    })),
  };

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← I miei atleti
        </Link>
      </div>
      <AthleteClient initialData={data} aiConfigured={isAiConfigured} stripeConfigured={isStripeConfigured} />
    </main>
  );
}
