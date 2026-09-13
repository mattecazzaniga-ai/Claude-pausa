import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Draft skill taxonomy for beach tennis, based on standard racquet-sport
 * coaching categories (technical / tactical / physical / mental). This is a
 * starting point, not gospel — the founder's own coaching expertise should
 * refine it before real coaches start using it.
 */
const BEACH_TENNIS_TAXONOMY = [
  {
    name: "Tecnica",
    skills: ["Dritto", "Rovescio", "Servizio", "Smash", "Volée", "Difesa/Bagher"],
  },
  {
    name: "Tattica",
    skills: [
      "Posizionamento in campo",
      "Lettura del gioco avversario",
      "Gestione del punto",
      "Transizione difesa-attacco",
      "Copertura della rete in coppia",
    ],
  },
  {
    name: "Fisico",
    skills: ["Footwork/Spostamenti", "Esplosività", "Resistenza nel set lungo"],
  },
  {
    name: "Mentale",
    skills: ["Gestione della pressione", "Concentrazione nei punti chiave", "Comunicazione con il compagno"],
  },
];

async function main() {
  console.log("Seeding CoachBrain...");

  let sport = await prisma.sport.findUnique({ where: { slug: "beach-tennis" } });
  if (!sport) {
    sport = await prisma.sport.create({ data: { slug: "beach-tennis", name: "Beach Tennis" } });

    for (let i = 0; i < BEACH_TENNIS_TAXONOMY.length; i++) {
      const cat = BEACH_TENNIS_TAXONOMY[i];
      const category = await prisma.skillCategory.create({
        data: { sportId: sport.id, name: cat.name, order: i },
      });
      for (let j = 0; j < cat.skills.length; j++) {
        await prisma.skill.create({
          data: { categoryId: category.id, name: cat.skills[j], order: j },
        });
      }
    }
    console.log(`Created sport "Beach Tennis" with ${BEACH_TENNIS_TAXONOMY.length} skill categories.`);
  } else {
    console.log("Beach Tennis sport already seeded, skipping taxonomy.");
  }

  const demoEmail = "demo@coachbrain.app";
  let coach = await prisma.coach.findUnique({ where: { email: demoEmail } });
  if (!coach) {
    coach = await prisma.coach.create({
      data: {
        name: "Coach Demo",
        email: demoEmail,
        passwordHash: await bcrypt.hash("demo1234", 10),
      },
    });

    const defense = await prisma.skill.findFirst({ where: { name: "Difesa/Bagher", category: { sportId: sport.id } } });
    const serve = await prisma.skill.findFirst({ where: { name: "Servizio", category: { sportId: sport.id } } });
    const positioning = await prisma.skill.findFirst({
      where: { name: "Posizionamento in campo", category: { sportId: sport.id } },
    });

    const athlete = await prisma.athlete.create({
      data: {
        coachId: coach.id,
        sportId: sport.id,
        name: "Luca Bianchi",
        level: "Intermedio",
        objectives: "Migliorare la solidità in difesa e la gestione dei punti chiave.",
        aiSummary:
          "Luca sta consolidando bene il servizio, con una percentuale di prime in netto miglioramento nelle ultime due sessioni. La priorità resta la difesa sulla palla profonda: lo stesso ritardo nel posizionamento è comparso in entrambe le ultime sessioni, in particolare nei momenti di pressione.",
        aiPriorities: [
          { skill: "Difesa/Bagher", reason: "Segnalato in 2 sessioni consecutive, peggiora sotto pressione" },
          { skill: "Posizionamento in campo", reason: "Collegato al problema sulla palla profonda" },
        ],
        aiSummaryUpdatedAt: new Date(),
      },
    });

    const note1 = await prisma.sessionNote.create({
      data: {
        athleteId: athlete.id,
        coachId: coach.id,
        rawText:
          "Oggi buona esecuzione in attacco, ma arriva spesso in ritardo sulle palle profonde e il posizionamento peggiora sotto pressione.",
        sessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        aiProcessed: true,
      },
    });
    const note2 = await prisma.sessionNote.create({
      data: {
        athleteId: athlete.id,
        coachId: coach.id,
        rawText:
          "Ripetuto lo stesso problema sulla palla profonda. Il servizio invece è migliorato molto, buona percentuale di prime.",
        sessionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        aiProcessed: true,
      },
    });

    if (defense && positioning && serve) {
      await prisma.noteTag.createMany({
        data: [
          {
            sessionNoteId: note1.id,
            skillId: defense.id,
            sentiment: "NEGATIVE",
            excerpt: "arriva spesso in ritardo sulle palle profonde",
          },
          {
            sessionNoteId: note1.id,
            skillId: positioning.id,
            sentiment: "NEGATIVE",
            excerpt: "il posizionamento peggiora sotto pressione",
          },
          {
            sessionNoteId: note2.id,
            skillId: defense.id,
            sentiment: "NEGATIVE",
            excerpt: "Ripetuto lo stesso problema sulla palla profonda",
          },
          {
            sessionNoteId: note2.id,
            skillId: serve.id,
            sentiment: "IMPROVING",
            excerpt: "il servizio invece è migliorato molto, buona percentuale di prime",
          },
        ],
      });
    }

    console.log("Created demo coach with 1 athlete and sample session notes + tags.");
    console.log("Demo login: demo@coachbrain.app / demo1234");
  } else {
    console.log("Demo coach already exists, skipping.");
  }

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
