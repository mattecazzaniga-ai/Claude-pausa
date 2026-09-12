import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "You cannot suspend yourself." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const suspended = Boolean(body?.suspended);

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { isSuspended: suspended },
    select: { id: true, username: true, isSuspended: true },
  });

  return NextResponse.json({ user });
}
