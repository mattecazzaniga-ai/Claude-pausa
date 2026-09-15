import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Troppi tentativi. Riprova tra qualche minuto." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  if (!isEmailConfigured) {
    return NextResponse.json({ error: "L'invio email non è configurato su questo ambiente." }, { status: 503 });
  }

  const coach = await prisma.coach.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true } });

  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to discover which emails have an account.
  if (coach) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: { coachId: coach.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });

    try {
      await sendPasswordResetEmail(coach.email, rawToken);
      track("password_reset_requested", coach.id);
    } catch (err) {
      captureError("Password reset email failed to send", err, { coachId: coach.id });
    }
  }

  return NextResponse.json({ ok: true });
}
