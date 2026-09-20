import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { getMethodologyPrinciples, getMethodologyHistory } from "@/lib/methodology";
import { refreshCoachBrainIfStale, getCoachLearnedPreferences } from "@/lib/intelligence/coach-brain";
import { CoachBrainClient } from "./coach-brain-client";

/**
 * Product restructure §13/§30: "La mia metodologia" and "Il mio Coach Brain"
 * used to be two separate pages telling the coach the same underlying story
 * ("how MENTATHLOS understands your coaching") under two different names —
 * exactly the kind of duplicate-concept-different-name split the audit was
 * meant to catch. Methodology is now a section of this one page instead of
 * its own route (see /methodology, which now just redirects here).
 */
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
        initialPrinciples={principles.map((p) => ({ id: p.id, text: p.text, category: p.category }))}
        initialHistory={history.map((h) => ({
          id: h.id,
          version: h.version,
          changeSummary: h.changeSummary,
          createdAt: h.createdAt.toISOString(),
          principleCount: Array.isArray(h.principles) ? h.principles.length : 0,
        }))}
        initialPreferences={preferences}
      />
    </main>
  );
}
