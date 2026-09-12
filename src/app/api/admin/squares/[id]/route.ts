import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { isValidId } from "@/lib/grid";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number(params.id);
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid square id" }, { status: 400 });

  const square = await prisma.square.findUnique({
    where: { id },
    include: { owner: { select: { username: true } } },
  });
  if (!square) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ square });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number(params.id);
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid square id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Admin moderation: can clear or edit any field directly, including
  // removing content entirely (title/description/imageUrl -> null).
  const square = await prisma.square.update({
    where: { id },
    data: {
      title: body.title ?? null,
      description: body.description ?? null,
      imageUrl: body.imageUrl || null,
      externalUrl: body.externalUrl || null,
      backgroundColor: body.backgroundColor || null,
    },
  });

  return NextResponse.json({ square });
}
