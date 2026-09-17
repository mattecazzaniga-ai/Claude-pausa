import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveMethodologySchema } from "@/lib/validation";
import { getMethodologyPrinciples, getMethodologyHistory, saveMethodologyVersion } from "@/lib/methodology";
import { track } from "@/lib/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [principles, history] = await Promise.all([getMethodologyPrinciples(session.user.id), getMethodologyHistory(session.user.id)]);

  return NextResponse.json({ principles, history });
}

/** Replaces the coach's full live principle set and snapshots a new version — used both by manual edits and by the AI-import confirm step. */
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = saveMethodologySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const version = await saveMethodologyVersion(session.user.id, parsed.data.principles, parsed.data.changeSummary);
  const principles = await getMethodologyPrinciples(session.user.id);

  track("methodology_saved", session.user.id, { version, principleCount: parsed.data.principles.length });

  return NextResponse.json({ version, principles });
}
