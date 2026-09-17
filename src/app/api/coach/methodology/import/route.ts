import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { parseMethodologyDocument } from "@/lib/ai-methodology-import";
import { extractTextFromFile, MAX_IMPORT_FILE_BYTES } from "@/lib/evaluation-import";
import { importMethodologySchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

/**
 * Master prompt §8-9: extract a draft list of principles from the coach's
 * own text or file. Nothing is saved here — the coach reviews/edits it in
 * the UI and only PUT /api/coach/methodology makes it active (§11).
 * Text-only import (PDF/DOCX/CSV/TXT or pasted text) — no photo support,
 * unlike the evaluation-sheet import, since a coach's own written
 * methodology is very unlikely to arrive as a photo.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) {
    return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
  }

  if (!rateLimit(`methodology-import:${session.user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const pastedText = form.get("text");
  const file = form.get("file");

  let text: string | undefined;
  try {
    if (file instanceof File) {
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        return NextResponse.json({ error: "Il file è troppo grande (massimo 8MB)." }, { status: 400 });
      }
      if (file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Le foto non sono supportate per la metodologia: carica un PDF, DOCX, CSV, TXT o incolla il testo." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await extractTextFromFile(buffer, file.name);
    } else if (typeof pastedText === "string" && pastedText.trim()) {
      text = pastedText.trim();
    } else {
      return NextResponse.json({ error: "Carica un file o scrivi la tua metodologia." }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Impossibile leggere il file." }, { status: 400 });
  }

  const parsedInput = importMethodologySchema.safeParse({ text });
  if (!parsedInput.success) {
    return NextResponse.json({ error: parsedInput.error.issues[0]?.message ?? "Testo non valido." }, { status: 400 });
  }

  try {
    const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, include: { primarySport: { select: { name: true } } } });
    const parsed = await parseMethodologyDocument({ text: parsedInput.data.text, sportName: coach?.primarySport?.name });

    if (parsed.principles.length === 0) {
      return NextResponse.json({ error: "Non sono riuscito a riconoscere principi in questo testo." }, { status: 422 });
    }

    track("methodology_imported", session.user.id, { principleCount: parsed.principles.length });

    return NextResponse.json({ principles: parsed.principles });
  } catch (err) {
    captureError("Methodology document import failed", err);
    return NextResponse.json({ error: "La lettura AI del documento non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
