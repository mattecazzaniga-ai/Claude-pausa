import { prisma } from "@/lib/prisma";
import { generateSportTaxonomy } from "@/lib/ai-taxonomy";
import { isAiConfigured } from "@/lib/ai";

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Finds a sport by slug, or creates it (used for "Other" free-text sport entry). */
export async function getOrCreateSport(name: string) {
  const slug = slugify(name) || `sport-${Date.now()}`;
  const existing = await prisma.sport.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.sport.create({ data: { slug, name: name.trim() } });
}

/**
 * Ensures a sport has a skill taxonomy, generating one via AI on first real
 * use if it doesn't. Safe to call every time — it's a no-op once the
 * taxonomy exists (a single DB count query).
 */
export async function ensureSportTaxonomy(sportId: string): Promise<void> {
  const count = await prisma.skillCategory.count({ where: { sportId } });
  if (count > 0) return;
  if (!isAiConfigured) return; // nothing we can do without AI — caller just sees an empty taxonomy

  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) return;

  const taxonomy = await generateSportTaxonomy(sport.name);
  for (let i = 0; i < taxonomy.categories.length; i++) {
    const cat = taxonomy.categories[i];
    const category = await prisma.skillCategory.create({ data: { sportId, name: cat.name, order: i } });
    for (let j = 0; j < cat.skills.length; j++) {
      await prisma.skill.create({ data: { categoryId: category.id, name: cat.skills[j], order: j } });
    }
  }
}

export async function getSportSkills(sportId: string) {
  await ensureSportTaxonomy(sportId);
  const skills = await prisma.skill.findMany({
    where: { category: { sportId } },
    include: { category: true },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
  });
  return skills.map((s) => ({ id: s.id, name: s.name, category: s.category.name }));
}
