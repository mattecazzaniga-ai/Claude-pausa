import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { TOTAL_SQUARES } from "@/lib/grid";
import { WallClient } from "./wall-client";

export default async function WallPage() {
  const [chapter, owned] = await Promise.all([
    prisma.chapter.findFirst({ where: { status: "ACTIVE" }, orderBy: { number: "desc" } }),
    prisma.square.count({ where: { status: { in: ["OWNED", "LISTED"] } } }),
  ]);

  return (
    <Suspense fallback={null}>
      <WallClient
        stats={{
          owned,
          total: TOTAL_SQUARES,
          chapterNumber: chapter?.number ?? 1,
        }}
      />
    </Suspense>
  );
}
