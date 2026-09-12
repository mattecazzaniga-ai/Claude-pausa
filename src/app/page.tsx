import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { HomeClient } from "./home-client";

// Stats are live and read from the database on every request — this also keeps
// `next build` from trying to statically prerender the page (which would require
// a working database connection at build time, before the deploy's DB is wired up).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [chapter, owned, users] = await Promise.all([
    prisma.chapter.findFirst({ where: { status: "ACTIVE" }, orderBy: { number: "desc" } }),
    prisma.square.count({ where: { status: { in: ["OWNED", "LISTED"] } } }),
    prisma.user.count(),
  ]);

  return (
    <main className="min-h-screen">
      <Nav />
      <HomeClient stats={{ owned, users, chapterNumber: chapter?.number ?? 1 }} />
    </main>
  );
}
