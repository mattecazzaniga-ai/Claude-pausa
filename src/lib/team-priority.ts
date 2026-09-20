export type TopPriority = { skill: string; reason: string };

/**
 * Heuristic "what does this group need most" without an extra AI call: the
 * skill name that recurs most often across members' cached priorities. Ties
 * broken by first occurrence. Returns null if no member has any priority yet.
 */
export function computeTeamTopPriority(memberPriorities: unknown[]): TopPriority | null {
  const counts = new Map<string, number>();
  const firstReason = new Map<string, string>();
  let total = 0;

  for (const raw of memberPriorities) {
    const priorities = (raw as { skill: string; reason: string }[] | null) ?? [];
    if (priorities.length === 0) continue;
    total += 1;
    const top = priorities[0];
    const key = top.skill.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!firstReason.has(key)) firstReason.set(key, top.skill);
  }

  if (counts.size === 0) return null;

  let bestKey = "";
  let bestCount = 0;
  for (const [key, count] of Array.from(counts)) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }

  return {
    skill: firstReason.get(bestKey) ?? bestKey,
    reason: `Priorità più diffusa nel gruppo (${bestCount} atlet${bestCount === 1 ? "a" : "i"} su ${total} con priorità registrate)`,
  };
}
