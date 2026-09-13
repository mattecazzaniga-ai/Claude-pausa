import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.coach.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Esiste già un account con questa email." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const coach = await prisma.coach.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true },
  });

  track("signup", coach.id, { name: coach.name });

  return NextResponse.json({ coach });
}
