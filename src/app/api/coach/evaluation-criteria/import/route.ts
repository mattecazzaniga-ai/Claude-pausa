import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { parseEvaluationDocument } from "@/lib/ai-evaluation-import";
import { extractTextFromFile, SUPPORTED_IMAGE_MIME_TYPES, MAX_IMPORT_FILE_BYTES } from "@/lib/evaluation-import";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

/**
 * Master prompt §3-4: upload/paste a coach's own evaluation sheet, AI reads
 * its actual structure. Nothing is saved here — the result is a draft for
 * the coach to review, edit and accept in the UI before it becomes real
 * EvaluationCriterion rows (see /api/coach/evaluation-criteria/bulk).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) {
    return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
  }

  if (!rateLimit(`evaluation-import:${session.user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySport: true } });
  if (!coach?.primarySport) return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const pastedText = form.get("text");
  const file = form.get("file");

  let text: string | undefined;
  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;

  try {
    if (file instanceof File) {
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        return NextResponse.json({ error: "Il file è troppo grande (massimo 8MB)." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) {
        imageBase64 = buffer.toString("base64");
        imageMimeType = file.type;
      } else {
        text = await extractTextFromFile(buffer, file.name);
      }
    } else if (typeof pastedText === "string" && pastedText.trim()) {
      text = pastedText.trim();
    } else {
      return NextResponse.json({ error: "Carica un file o incolla il testo della tua scheda di valutazione." }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Impossibile leggere il file." }, { status: 400 });
  }

  if (!text && !imageBase64) {
    return NextResponse.json({ error: "Il documento sembra vuoto." }, { status: 400 });
  }

  try {
    const sportProfile = await getSportProfile(coach.primarySport.id);
    const sportContext = formatSportProfileForPrompt(coach.primarySport.name, sportProfile);

    const parsed = await parseEvaluationDocument({ sportName: coach.primarySport.name, sportContext, text, imageBase64, imageMimeType });

    if (parsed.categories.length === 0) {
      return NextResponse.json({ error: "Non sono riuscito a riconoscere una struttura di valutazione in questo documento." }, { status: 422 });
    }

    track("evaluation_criteria_imported", session.user.id, { categoryCount: parsed.categories.length });

    return NextResponse.json({ categories: parsed.categories });
  } catch (err) {
    console.error("Evaluation document import failed", err);
    return NextResponse.json({ error: "La lettura AI del documento non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
