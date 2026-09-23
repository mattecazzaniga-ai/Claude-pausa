import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeaturesFor } from "@/lib/features";
import { OnboardingFeaturesClient } from "./onboarding-features-client";

export default async function OnboardingFeaturesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/onboarding/features");

  const coach = await prisma.coach.findUnique({
    where: { id: session.user.id },
    select: { primarySportId: true, selfCoaching: true, featuresOnboardedAt: true },
  });
  if (!coach?.primarySportId) redirect("/onboarding/sport");
  if (coach.featuresOnboardedAt) redirect("/dashboard");

  return (
    <main className="auth-backdrop flex min-h-screen items-center justify-center px-4 py-10">
      <OnboardingFeaturesClient features={getFeaturesFor(coach.selfCoaching)} />
    </main>
  );
}
