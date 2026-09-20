import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { AthletesClient } from "./athletes-client";

/**
 * Product restructure §3/§5: the roster used to live on Home (/dashboard),
 * mixing "here's everyone I coach" with "what should I do today" — two
 * different questions. Home is now the command center; this is where the
 * roster itself lives, same relationship /teams already has to Home.
 */
export default async function AthletesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/athletes");

  const coach = await prisma.coach.findUnique({
    where: { id: session.user.id },
    select: { primarySportId: true, selfCoaching: true },
  });
  if (!coach?.primarySportId) redirect("/onboarding/sport");
  // A self-coaching account has exactly one athlete (itself) — no roster to manage.
  if (coach.selfCoaching) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      <Nav />
      <AthletesClient />
    </main>
  );
}
