import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { getMethodologyPrinciples, getMethodologyHistory } from "@/lib/methodology";
import { MethodologyClient } from "./methodology-client";

export default async function MethodologyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/methodology");

  const [principles, history] = await Promise.all([
    getMethodologyPrinciples(session.user.id),
    getMethodologyHistory(session.user.id),
  ]);

  return (
    <main className="min-h-screen">
      <Nav />
      <MethodologyClient
        initialPrinciples={principles.map((p) => ({ id: p.id, text: p.text, category: p.category }))}
        initialHistory={history.map((h) => ({
          id: h.id,
          version: h.version,
          changeSummary: h.changeSummary,
          createdAt: h.createdAt.toISOString(),
          principleCount: Array.isArray(h.principles) ? h.principles.length : 0,
        }))}
      />
    </main>
  );
}
