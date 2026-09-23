import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingSportClient } from "./onboarding-client";

export default async function OnboardingSportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/onboarding/sport");

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (coach?.primarySportId) redirect("/dashboard");

  const sports = await prisma.sport.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <main className="auth-backdrop flex min-h-screen items-center justify-center px-4 py-10">
      <OnboardingSportClient sports={sports} />
    </main>
  );
}
