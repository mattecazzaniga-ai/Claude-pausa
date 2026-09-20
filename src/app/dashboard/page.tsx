import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const coach = await prisma.coach.findUnique({
    where: { id: session.user.id },
    select: { primarySportId: true, selfCoaching: true, name: true },
  });
  if (!coach?.primarySportId) redirect("/onboarding/sport");

  if (coach.selfCoaching) {
    let selfAthlete = await prisma.athlete.findFirst({ where: { coachId: session.user.id, isSelf: true } });
    // Defensive fallback: should already exist from sport onboarding, but
    // never leave a self-coaching account with nowhere to land.
    if (!selfAthlete) {
      selfAthlete = await prisma.athlete.create({
        data: { coachId: session.user.id, sportId: coach.primarySportId, name: coach.name, isSelf: true },
      });
    }
    redirect(`/athletes/${selfAthlete.id}`);
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <DashboardClient />
    </main>
  );
}
