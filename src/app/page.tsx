import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { HomeClient } from "./home-client";

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
