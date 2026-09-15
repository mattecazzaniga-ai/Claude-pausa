import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Il link non è valido o è scaduto. Richiedine uno nuovo." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.$transaction([
    prisma.coach.update({ where: { id: resetToken.coachId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    // A successful reset invalidates any other outstanding reset links for
    // this coach — an old, forwarded, or intercepted link shouldn't still work.
    prisma.passwordResetToken.deleteMany({ where: { coachId: resetToken.coachId, id: { not: resetToken.id } } }),
  ]);

  track("password_reset_completed", resetToken.coachId);

  return NextResponse.json({ ok: true });
}
