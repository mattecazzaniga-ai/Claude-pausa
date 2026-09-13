import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/calendar");

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) redirect("/onboarding/sport");

  return (
    <main className="min-h-screen">
      <Nav />
      <CalendarClient />
    </main>
  );
}
