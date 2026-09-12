import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coordsToId, isValidId, WALL_WIDTH, WALL_HEIGHT } from "@/lib/grid";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ error: "Empty query" }, { status: 400 });

  // "x,y" or "x y" coordinates
  const coordMatch = q.match(/^(\d+)\s*[, ]\s*(\d+)$/);
  if (coordMatch) {
    const x = Number(coordMatch[1]);
    const y = Number(coordMatch[2]);
    if (x >= 0 && x < WALL_WIDTH && y >= 0 && y < WALL_HEIGHT) {
      return NextResponse.json({ type: "square", id: coordsToId(x, y) });
    }
    return NextResponse.json({ error: "Coordinates out of range" }, { status: 404 });
  }

  // Bare square number, optionally prefixed with #
  const idMatch = q.match(/^#?(\d+)$/);
  if (idMatch) {
    const id = Number(idMatch[1]);
    if (isValidId(id)) return NextResponse.json({ type: "square", id });
    return NextResponse.json({ error: "Square number out of range" }, { status: 404 });
  }

  // Username
  const username = q.replace(/^@/, "");
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      username: true,
      squares: { select: { id: true }, orderBy: { id: "asc" }, take: 1 },
    },
  });

  if (!user) return NextResponse.json({ error: "No square, coordinates, or user found." }, { status: 404 });
  if (user.squares.length === 0) {
    return NextResponse.json({ type: "user", username: user.username, id: null });
  }
  return NextResponse.json({ type: "user", username: user.username, id: user.squares[0].id });
}
