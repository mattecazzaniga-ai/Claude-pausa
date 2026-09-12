import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { SquareDetail } from "@/components/square-detail";
import { prisma } from "@/lib/prisma";
import { isValidId, priceForId, idToCoords } from "@/lib/grid";
import type { SquareDetailData } from "@/lib/types";

export default async function SquarePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { purchased?: string };
}) {
  const id = Number(params.id);
  if (!isValidId(id)) notFound();

  const square = await prisma.square.findUnique({
    where: { id },
    include: {
      owner: { select: { username: true, avatarUrl: true } },
      listings: { where: { status: "ACTIVE" }, select: { id: true, price: true, createdAt: true } },
    },
  });

  const { x, y } = idToCoords(id);

  const data: SquareDetailData = square
    ? {
        id: square.id,
        coordinateX: square.coordinateX,
        coordinateY: square.coordinateY,
        price: square.price,
        status: square.status,
        title: square.title,
        description: square.description,
        imageUrl: square.imageUrl,
        externalUrl: square.externalUrl,
        backgroundColor: square.backgroundColor,
        purchasedAt: square.purchasedAt?.toISOString() ?? null,
        owner: square.owner,
        activeListing: square.listings[0]
          ? { id: square.listings[0].id, price: square.listings[0].price, createdAt: square.listings[0].createdAt.toISOString() }
          : null,
      }
    : {
        id,
        coordinateX: x,
        coordinateY: y,
        price: priceForId(id),
        status: "AVAILABLE",
        title: null,
        description: null,
        imageUrl: null,
        externalUrl: null,
        backgroundColor: null,
        purchasedAt: null,
        owner: null,
        activeListing: null,
      };

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <Link href="/wall" className="text-sm text-muted hover:text-foreground">
          ← Back to the wall
        </Link>

        {searchParams.purchased && (
          <div className="mt-4 rounded-md border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            🎉 Congratulations — this square is now yours. Customize it below.
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          <SquareDetail squareId={id} initialData={data} />
        </div>
      </div>
    </main>
  );
}
