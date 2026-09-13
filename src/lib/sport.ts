import { prisma } from "@/lib/prisma";
import { generateSportTaxonomy } from "@/lib/ai-taxonomy";
import { generateSportProfile } from "@/lib/ai-sport-profile";
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

  let taxonomy;
  try {
    taxonomy = await generateSportTaxonomy(sport.name);
  } catch (err) {
    // Degrade like the !isAiConfigured case above: caller just sees an
    // empty taxonomy rather than a crashed request. A later call retries
    // (nothing was persisted), since this only checked the count above.
    console.error("Sport taxonomy generation failed", sportId, err);
    return;
  }
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

export type SportProfileContext = {
  formats: string[];
  environment: string;
  equipment: string;
  scoringSystem: string;
  keyRules: string;
  terminology: string;
};

/**
 * Ensures a sport has a Sport Profile (environment/equipment/scoring/rules/
 * terminology), generating one via AI on first real use if it doesn't. Same
 * lazy/cached pattern as ensureSportTaxonomy — a no-op once generated.
 */
export async function ensureSportProfile(sportId: string): Promise<void> {
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport || sport.profileGeneratedAt) return;
  if (!isAiConfigured) return; // nothing we can do without AI — callers just get a name-only context

  let profile;
  try {
    profile = await generateSportProfile(sport.name);
  } catch (err) {
    // Degrade like the !isAiConfigured case above: callers just get a
    // name-only context rather than a crashed request. Not persisted, so a
    // later call retries.
    console.error("Sport profile generation failed", sportId, err);
    return;
  }
  await prisma.sport.update({
    where: { id: sportId },
    data: {
      formats: profile.formats,
      environment: profile.environment,
      equipment: profile.equipment,
      scoringSystem: profile.scoringSystem,
      keyRules: profile.keyRules,
      terminology: profile.terminology,
      profileGeneratedAt: new Date(),
    },
  });
}

/**
 * Force-regenerates the Sport Profile, ignoring the "already generated"
 * cache. Since the profile is shared by every coach using this sport, this
 * is a data-quality fix (e.g. an AI generation that leaked terminology from
 * a similar sport) rather than a per-coach preference — it overwrites the
 * one shared Sport row. Never touches the skill taxonomy: Skill rows can be
 * referenced by existing NoteTag/ExerciseSkill records, so they aren't safe
 * to regenerate the same way.
 */
export async function regenerateSportProfile(sportId: string): Promise<SportProfileContext> {
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) throw new Error("Sport not found");
  if (!isAiConfigured) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const profile = await generateSportProfile(sport.name);
  await prisma.sport.update({
    where: { id: sportId },
    data: {
      formats: profile.formats,
      environment: profile.environment,
      equipment: profile.equipment,
      scoringSystem: profile.scoringSystem,
      keyRules: profile.keyRules,
      terminology: profile.terminology,
      profileGeneratedAt: new Date(),
    },
  });

  return {
    formats: profile.formats,
    environment: profile.environment,
    equipment: profile.equipment,
    scoringSystem: profile.scoringSystem,
    keyRules: profile.keyRules,
    terminology: profile.terminology,
  };
}

/**
 * Fetches (generating on-demand if needed) the Sport Profile in the shape
 * every AI prompt consumes. Call this instead of reading Sport fields
 * directly so callers never have to know about the lazy-generation dance.
 */
export async function getSportProfile(sportId: string): Promise<SportProfileContext> {
  await ensureSportProfile(sportId);
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  return {
    formats: sport?.formats ?? [],
    environment: sport?.environment ?? "",
    equipment: sport?.equipment ?? "",
    scoringSystem: sport?.scoringSystem ?? "",
    keyRules: sport?.keyRules ?? "",
    terminology: sport?.terminology ?? "",
  };
}

/** Renders a Sport Profile as prompt text — shared by every AI call site so the framing stays consistent. */
export function formatSportProfileForPrompt(sportName: string, profile: SportProfileContext): string {
  const hasContent = profile.environment || profile.equipment || profile.scoringSystem || profile.keyRules || profile.terminology;
  if (!hasContent) return `Sport: ${sportName}`;

  return (
    `Sport: ${sportName}${profile.formats.length ? ` (formato: ${profile.formats.join("/")})` : ""}\n` +
    `Campo/ambiente: ${profile.environment || "N/D"}\n` +
    `Attrezzatura: ${profile.equipment || "N/D"}\n` +
    `Punteggio: ${profile.scoringSystem || "N/D"}\n` +
    `Regole chiave rilevanti per l'allenamento: ${profile.keyRules || "N/D"}\n` +
    `Terminologia tecnica da usare: ${profile.terminology || "N/D"}`
  );
}
