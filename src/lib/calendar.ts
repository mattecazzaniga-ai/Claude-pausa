const MAX_RECURRING_OCCURRENCES = 60;

/**
 * Master prompt §28 (recurring training): expands a base start/end time plus
 * a set of weekdays into one {startAt, endAt} pair per matching day between
 * the base date and `until` (inclusive), all sharing the base occurrence's
 * time-of-day and duration. Capped so a coach can't accidentally create
 * hundreds of rows from a far-future end date.
 */
export function computeRecurrenceOccurrences(
  baseStart: Date,
  baseEnd: Date,
  daysOfWeek: number[],
  until: Date
): { startAt: Date; endAt: Date }[] {
  const durationMs = baseEnd.getTime() - baseStart.getTime();
  const daySet = new Set(daysOfWeek);

  const cursor = new Date(baseStart);
  cursor.setHours(0, 0, 0, 0);
  const limit = new Date(until);
  limit.setHours(23, 59, 59, 999);

  const occurrences: { startAt: Date; endAt: Date }[] = [];
  while (cursor <= limit && occurrences.length < MAX_RECURRING_OCCURRENCES) {
    if (daySet.has(cursor.getDay())) {
      const startAt = new Date(cursor);
      startAt.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds(), 0);
      if (startAt >= baseStart) {
        occurrences.push({ startAt, endAt: new Date(startAt.getTime() + durationMs) });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return occurrences;
}
