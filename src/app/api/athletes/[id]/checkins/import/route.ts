import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCheckinCsv } from "@/lib/checkin-import";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS_PER_IMPORT = 400;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!rateLimit(`checkin-import:${session.user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const pastedText = form.get("text");
  const file = form.get("file");

  let text: string;
  if (file instanceof File) {
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json({ error: "Il file è troppo grande (massimo 2MB)." }, { status: 400 });
    }
    text = await file.text();
  } else if (typeof pastedText === "string" && pastedText.trim()) {
    text = pastedText;
  } else {
    return NextResponse.json({ error: "Carica un file CSV o incolla il contenuto." }, { status: 400 });
  }

  const { rows, errors } = parseCheckinCsv(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nessuna riga valida trovata nel file.", skipped: errors }, { status: 422 });
  }

  const toImport = rows.slice(0, MAX_ROWS_PER_IMPORT);
  if (rows.length > MAX_ROWS_PER_IMPORT) {
    errors.push(`Solo le prime ${MAX_ROWS_PER_IMPORT} righe sono state importate (${rows.length} trovate).`);
  }

  await prisma.athleteCheckin.createMany({
    data: toImport.map((r) => ({
      athleteId: athlete.id,
      coachId: session.user.id,
      date: r.date,
      readiness: r.readiness ?? undefined,
      rpe: r.rpe ?? undefined,
      feeling: r.feeling ?? undefined,
      sleepHours: r.sleepHours ?? undefined,
      soreness: r.soreness ?? undefined,
      restingHeartRate: r.restingHeartRate ?? undefined,
      hrv: r.hrv ?? undefined,
      steps: r.steps ?? undefined,
      notes: r.notes ?? undefined,
      source: "WEARABLE_IMPORT",
    })),
  });

  track("checkin_imported", session.user.id, { athleteId: athlete.id, imported: toImport.length, skipped: errors.length });

  return NextResponse.json({ imported: toImport.length, skipped: errors });
}
