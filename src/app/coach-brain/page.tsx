import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { getMethodologyPrinciples, getMethodologyHistory } from "@/lib/methodology";
import { refreshCoachBrainIfStale, getCoachLearnedPreferences } from "@/lib/intelligence/coach-brain";
import { CoachBrainClient } from "./coach-brain-client";

export default async function CoachBrainPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/coach-brain");

  await refreshCoachBrainIfStale(session.user.id);

  const [principles, history, preferences] = await Promise.all([
    getMethodologyPrinciples(session.user.id),
    getMethodologyHistory(session.user.id),
    getCoachLearnedPreferences(session.user.id),
  ]);

  return (
    <main className="min-h-screen">
      <Nav />
      <CoachBrainClient
        methodologyPrincipleCount={principles.length}
        methodologyVersion={history[0]?.version ?? 0}
        initialPreferences={preferences}
      />
    </main>
  );
}
