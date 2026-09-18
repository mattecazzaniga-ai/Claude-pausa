import { prisma } from "@/lib/prisma";
import { generateSportTaxonomy } from "@/lib/ai-taxonomy";
import { generateSportProfile, type GeneratedSportProfile } from "@/lib/ai-sport-profile";
import { generateSportMetrics } from "@/lib/ai-sport-metrics";
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
    const category = await prisma.skillCategory.create({ data: { sportId, name: cat.name, type: cat.type, order: i } });
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
  positions: string;
  movementPatterns: string;
  gameSituations: string;
  trainingMethods: string;
  commonProblems: string;
  progressions: string;
  safetyNotes: string;
  /** e.g. ["Nuoto", "Ciclismo", "Corsa"] for Triathlon — empty for every single-discipline sport. */
  disciplines: string[];
};

/** Shared field list so ensure/regenerate/get can't drift from each other by missing a field in one of the three spots. */
function profileToDbData(profile: GeneratedSportProfile) {
  return {
    formats: profile.formats,
    environment: profile.environment,
    equipment: profile.equipment,
    scoringSystem: profile.scoringSystem,
    keyRules: profile.keyRules,
    terminology: profile.terminology,
    positions: profile.positions,
    movementPatterns: profile.movementPatterns,
    gameSituations: profile.gameSituations,
    trainingMethods: profile.trainingMethods,
    commonProblems: profile.commonProblems,
    progressions: profile.progressions,
    safetyNotes: profile.safetyNotes,
    disciplines: profile.disciplines,
  };
}

/**
 * Ensures a sport has a Sport Profile (environment/equipment/scoring/rules/
 * terminology/...), generating one via AI on first real use if it doesn't.
 * Same lazy/cached pattern as ensureSportTaxonomy — a no-op once generated.
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
    data: { ...profileToDbData(profile), profileGeneratedAt: new Date() },
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
    data: { ...profileToDbData(profile), profileGeneratedAt: new Date() },
  });

  // Metrics are a data-quality companion to the profile, not required for
  // it to be usable — a failure here must never break the regenerate action.
  try {
    await ensureSportMetrics(sportId, { force: true });
  } catch (err) {
    console.error("Sport metrics regeneration failed", sportId, err);
  }

  return profileToDbData(profile);
}

function sportRowToProfileContext(
  sport: {
    formats: string[];
    environment: string | null;
    equipment: string | null;
    scoringSystem: string | null;
    keyRules: string | null;
    terminology: string | null;
    positions: string | null;
    movementPatterns: string | null;
    gameSituations: string | null;
    trainingMethods: string | null;
    commonProblems: string | null;
    progressions: string | null;
    safetyNotes: string | null;
    disciplines: string[];
  } | null
): SportProfileContext {
  return {
    formats: sport?.formats ?? [],
    environment: sport?.environment ?? "",
    equipment: sport?.equipment ?? "",
    scoringSystem: sport?.scoringSystem ?? "",
    keyRules: sport?.keyRules ?? "",
    terminology: sport?.terminology ?? "",
    positions: sport?.positions ?? "",
    movementPatterns: sport?.movementPatterns ?? "",
    gameSituations: sport?.gameSituations ?? "",
    trainingMethods: sport?.trainingMethods ?? "",
    commonProblems: sport?.commonProblems ?? "",
    safetyNotes: sport?.safetyNotes ?? "",
    progressions: sport?.progressions ?? "",
    disciplines: sport?.disciplines ?? [],
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
  return sportRowToProfileContext(sport);
}

/**
 * Reads the Sport Profile ONLY if it's already been generated — never
 * triggers generation. For a latency-sensitive request path where a deep
 * profile is a nice-to-have but not worth an extra synchronous AI call
 * stacked in front of the caller's own generation (e.g. importing a coach's
 * own evaluation sheet, which mainly needs the sport's name, not its full
 * profile). Falls back to a name-only context exactly like a sport with no
 * profile content at all.
 */
export async function getCachedSportProfile(sportId: string): Promise<SportProfileContext> {
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  return sportRowToProfileContext(sport);
}

export type SportMetricData = {
  id: string;
  name: string;
  unit: string | null;
  description: string | null;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | null;
  coachId: string | null;
};

/**
 * Ensures a sport has its shared (coachId: null) performance metrics (master
 * prompt §22), generating them via AI on first real use — same lazy/cached
 * pattern as the taxonomy and profile. `force` re-generates and replaces
 * this shared set only (used when the coach regenerates the whole Sport
 * Profile after spotting bad output) — it must never touch another coach's
 * own custom metrics on this same sport (see getSportMetrics).
 */
export async function ensureSportMetrics(sportId: string, opts?: { force?: boolean }): Promise<void> {
  const existingCount = await prisma.sportMetric.count({ where: { sportId, coachId: null } });
  if (existingCount > 0 && !opts?.force) return;
  if (!isAiConfigured) return;

  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) return;

  const sportContext = formatSportProfileForPrompt(sport.name, await getSportProfile(sportId));

  let generated;
  try {
    generated = await generateSportMetrics(sport.name, sportContext);
  } catch (err) {
    console.error("Sport metrics generation failed", sportId, err);
    return;
  }
  if (generated.metrics.length === 0) return;

  await prisma.$transaction([
    prisma.sportMetric.deleteMany({ where: { sportId, coachId: null } }),
    prisma.sportMetric.createMany({
      data: generated.metrics.map((m, i) => ({ sportId, name: m.name, unit: m.unit || null, description: m.description || null, direction: m.direction, order: i })),
    }),
  ]);
}

/**
 * The sport's shared AI-generated metrics plus this coach's own custom ones
 * (e.g. a specific race distance the shared set didn't cover, like "Tempo
 * sui 40km") — same shared-plus-per-coach pattern as getEvaluationCriteria.
 */
export async function getSportMetrics(sportId: string, coachId: string): Promise<SportMetricData[]> {
  await ensureSportMetrics(sportId);
  return prisma.sportMetric.findMany({ where: { sportId, OR: [{ coachId: null }, { coachId }] }, orderBy: { order: "asc" } });
}

/** Renders a Sport Profile as prompt text — shared by every AI call site so the framing stays consistent. */
export function formatSportProfileForPrompt(sportName: string, profile: SportProfileContext): string {
  const hasContent = profile.environment || profile.equipment || profile.scoringSystem || profile.keyRules || profile.terminology;
  if (!hasContent) return `Sport: ${sportName}`;

  const lines = [
    `Sport: ${sportName}${profile.formats.length ? ` (formato: ${profile.formats.join("/")})` : ""}`,
    `Campo/ambiente: ${profile.environment || "N/D"}`,
    `Attrezzatura: ${profile.equipment || "N/D"}`,
    `Punteggio: ${profile.scoringSystem || "N/D"}`,
    `Regole chiave rilevanti per l'allenamento: ${profile.keyRules || "N/D"}`,
    `Terminologia tecnica da usare: ${profile.terminology || "N/D"}`,
  ];
  if (profile.positions) lines.push(`Ruoli/posizioni: ${profile.positions}`);
  if (profile.movementPatterns) lines.push(`Pattern di movimento specifici: ${profile.movementPatterns}`);
  if (profile.gameSituations) lines.push(`Situazioni di gioco/allenamento: ${profile.gameSituations}`);
  if (profile.trainingMethods) lines.push(`Metodologie di allenamento: ${profile.trainingMethods}`);
  if (profile.commonProblems) lines.push(`Problemi tecnici/tattici comuni: ${profile.commonProblems}`);
  if (profile.progressions) lines.push(`Progressioni didattiche: ${profile.progressions}`);
  if (profile.safetyNotes) lines.push(`Sicurezza/infortuni tipici: ${profile.safetyNotes}`);
  if (profile.disciplines.length) lines.push(`Discipline separate di questo sport: ${profile.disciplines.join(", ")}`);

  return lines.join("\n");
}
