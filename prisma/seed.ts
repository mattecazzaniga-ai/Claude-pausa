import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { WALL_WIDTH, WALL_HEIGHT, TOTAL_SQUARES } from "../src/lib/grid";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding Internet Wall: ${TOTAL_SQUARES} squares (${WALL_WIDTH}x${WALL_HEIGHT})...`);

  const existingChapter = await prisma.chapter.findUnique({ where: { number: 1 } });
  const chapter =
    existingChapter ??
    (await prisma.chapter.create({
      data: {
        number: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    }));

  const squareCount = await prisma.square.count();
  if (squareCount === 0) {
    // Bulk-generate all squares directly in Postgres. Doing this with 100,000
    // individual Prisma `create` calls would take minutes; a single
    // generate_series INSERT takes well under a second.
    console.log("Inserting squares in bulk via generate_series...");
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Square" (id, "coordinateX", "coordinateY", price, status, "chapterId", "updatedAt")
      SELECT
        s.id,
        s.id % ${WALL_WIDTH} AS "coordinateX",
        (s.id / ${WALL_WIDTH})::int AS "coordinateY",
        CASE
          WHEN GREATEST(ABS(s.id % ${WALL_WIDTH} - ${(WALL_WIDTH - 1) / 2}), ABS((s.id / ${WALL_WIDTH})::int - ${(WALL_HEIGHT - 1) / 2})) / ${Math.max((WALL_WIDTH - 1) / 2, (WALL_HEIGHT - 1) / 2)}::float < 0.15 THEN 3
          WHEN GREATEST(ABS(s.id % ${WALL_WIDTH} - ${(WALL_WIDTH - 1) / 2}), ABS((s.id / ${WALL_WIDTH})::int - ${(WALL_HEIGHT - 1) / 2})) / ${Math.max((WALL_WIDTH - 1) / 2, (WALL_HEIGHT - 1) / 2)}::float < 0.4 THEN 2
          WHEN GREATEST(ABS(s.id % ${WALL_WIDTH} - ${(WALL_WIDTH - 1) / 2}), ABS((s.id / ${WALL_WIDTH})::int - ${(WALL_HEIGHT - 1) / 2})) / ${Math.max((WALL_WIDTH - 1) / 2, (WALL_HEIGHT - 1) / 2)}::float < 0.7 THEN 1.5
          ELSE 1
        END AS price,
        'AVAILABLE'::"SquareStatus" AS status,
        '${chapter.id}' AS "chapterId",
        NOW() AS "updatedAt"
      FROM generate_series(0, ${TOTAL_SQUARES - 1}) AS s(id);
    `);
    console.log("Squares inserted.");
  } else {
    console.log(`Squares already seeded (${squareCount}), skipping bulk insert.`);
  }

  // A demo admin + a demo user, so the app is explorable immediately after seed.
  const adminEmail = "admin@internetwall.app";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: "admin",
        email: adminEmail,
        passwordHash: await bcrypt.hash("admin1234", 10),
        isAdmin: true,
      },
    });
    console.log("Created admin user: admin@internetwall.app / admin1234");
  }

  const demoEmail = "demo@internetwall.app";
  const existingDemo = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existingDemo) {
    const demo = await prisma.user.create({
      data: {
        username: "demo",
        email: demoEmail,
        passwordHash: await bcrypt.hash("demo1234", 10),
      },
    });

    // Give the demo user a few owned squares near the center so the wall
    // doesn't look completely empty on first run.
    const demoSquareIds = [
      Math.floor(TOTAL_SQUARES / 2),
      Math.floor(TOTAL_SQUARES / 2) + 1,
      Math.floor(TOTAL_SQUARES / 2) + WALL_WIDTH,
    ];
    for (const id of demoSquareIds) {
      const square = await prisma.square.findUnique({ where: { id } });
      if (!square || square.status !== "AVAILABLE") continue;
      await prisma.square.update({
        where: { id },
        data: {
          status: "OWNED",
          ownerId: demo.id,
          title: "Hello, Internet",
          description: "One of the first squares on the wall.",
          backgroundColor: "#6366f1",
          purchasedAt: new Date(),
        },
      });
      await prisma.transaction.create({
        data: {
          squareId: id,
          buyerId: demo.id,
          amount: square.price,
          platformFee: 0,
          type: "PRIMARY",
          status: "COMPLETED",
          chapterId: chapter.id,
        },
      });
    }
    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { squaresSold: { increment: demoSquareIds.length }, totalTransactions: { increment: demoSquareIds.length } },
    });
    console.log("Created demo user: demo@internetwall.app / demo1234");
  }

  const totalUsers = await prisma.user.count();
  await prisma.chapter.update({ where: { id: chapter.id }, data: { totalUsers } });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
