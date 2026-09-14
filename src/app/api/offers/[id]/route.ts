import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateOfferSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

/**
 * Offers are never hard-deleted (see PATCH `active: false` instead): a
 * Purchase snapshots its price/session count at purchase time, but still
 * references the Offer row for name/type — deleting it would break history.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offer = await prisma.offer.findUnique({ where: { id: params.id } });
  if (!offer || offer.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.offer.update({ where: { id: offer.id }, data: parsed.data });

  track("offer_updated", session.user.id, { offerId: offer.id });

  return NextResponse.json({ offer: updated });
}
