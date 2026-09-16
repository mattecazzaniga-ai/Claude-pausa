/**
 * Wearable data import (Readiness/Wearable phase). Deliberately a simple,
 * deterministic CSV parser rather than an AI-read import or a live OAuth
 * connection: there is no real Garmin/Apple Health/Whoop/Strava API access
 * in this environment to build and test a genuine device integration
 * against (and every one of those has its own proprietary export format we
 * have no real sample of) — building one anyway would be exactly the kind
 * of "declared complete without real testing" the master prompt forbids.
 * Instead, a coach/athlete exports their wearable app's daily data into this
 * one documented column format (most spreadsheet apps make that a five
 * minute job) and imports it here — the resulting rows are ordinary
 * AthleteCheckin rows (source: WEARABLE_IMPORT), so they flow through the
 * exact same readiness trend and Adaptive Training Engine as a self-reported
 * check-in, with no separate table or code path.
 */

export const CHECKIN_CSV_TEMPLATE_HEADER = "date,readiness,rpe,feeling,sleepHours,soreness,restingHeartRate,hrv,steps,notes";

export type ParsedCheckinRow = {
  date: Date;
  readiness: number | null;
  rpe: number | null;
  feeling: "GREAT" | "GOOD" | "OK" | "TIRED" | "UNWELL" | null;
  sleepHours: number | null;
  soreness: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
  steps: number | null;
  notes: string | null;
};

export type CheckinCsvParseResult = {
  rows: ParsedCheckinRow[];
  errors: string[];
};

const COLUMN_ALIASES: Record<string, keyof ParsedCheckinRow | "date"> = {
  date: "date",
  data: "date",
  readiness: "readiness",
  prontezza: "readiness",
  rpe: "rpe",
  sforzo: "rpe",
  sforzopercepito: "rpe",
  feeling: "feeling",
  sensazione: "feeling",
  sleephours: "sleepHours",
  sonno: "sleepHours",
  soreness: "soreness",
  indolenzimento: "soreness",
  restingheartrate: "restingHeartRate",
  frequenzacardiacariposo: "restingHeartRate",
  hrv: "hrv",
  steps: "steps",
  passi: "steps",
  notes: "notes",
  note: "notes",
};

const VALID_FEELINGS = new Set(["GREAT", "GOOD", "OK", "TIRED", "UNWELL"]);

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]/g, "");
}

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

/** Splits on commas outside simple double-quoted fields — enough for a numeric wearable export, not a full RFC-4180 parser. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((c) => c.trim().replace(/^"|"$/g, ""));
}

export function parseCheckinCsv(text: string): CheckinCsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { rows: [], errors: ["Il file è vuoto."] };

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const columnMap = headerCells.map((h) => COLUMN_ALIASES[h] ?? null);

  if (!columnMap.includes("date")) {
    return { rows: [], errors: [`Colonna "date" mancante nell'intestazione. Intestazione attesa: ${CHECKIN_CSV_TEMPLATE_HEADER}`] };
  }

  const rows: ParsedCheckinRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cells = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    columnMap.forEach((col, idx) => {
      if (col) record[col] = cells[idx] ?? "";
    });

    const dateRaw = record.date?.trim();
    const date = dateRaw ? new Date(dateRaw) : null;
    if (!date || Number.isNaN(date.getTime())) {
      errors.push(`Riga ${lineNumber}: data mancante o non valida ("${dateRaw ?? ""}").`);
      continue;
    }

    let rowError = false;
    const numericField = (key: keyof ParsedCheckinRow, min: number, max: number): number | null => {
      const raw = record[key];
      if (!raw?.trim()) return null;
      const n = parseNumber(raw);
      if (n === null) return null;
      if (Number.isNaN(n) || n < min || n > max) {
        errors.push(`Riga ${lineNumber}: valore non valido per "${key}" ("${raw}", atteso ${min}-${max}).`);
        rowError = true;
        return null;
      }
      return n;
    };

    const readiness = numericField("readiness", 1, 10);
    const rpe = numericField("rpe", 0, 10);
    const soreness = numericField("soreness", 1, 10);
    const sleepHours = numericField("sleepHours", 0, 24);
    const restingHeartRate = numericField("restingHeartRate", 20, 250);
    const hrv = numericField("hrv", 0, 300);
    const steps = numericField("steps", 0, 100_000);

    const feelingRaw = record.feeling?.trim().toUpperCase();
    let feeling: ParsedCheckinRow["feeling"] = null;
    if (feelingRaw) {
      if (!VALID_FEELINGS.has(feelingRaw)) {
        errors.push(`Riga ${lineNumber}: valore non valido per "feeling" ("${feelingRaw}").`);
        rowError = true;
      } else {
        feeling = feelingRaw as ParsedCheckinRow["feeling"];
      }
    }

    if (rowError) continue;

    const hasAnyData = [readiness, rpe, soreness, sleepHours, restingHeartRate, hrv, steps, feeling].some((v) => v != null);
    if (!hasAnyData) {
      errors.push(`Riga ${lineNumber}: nessun dato oltre alla data, riga ignorata.`);
      continue;
    }

    rows.push({
      date,
      readiness,
      rpe,
      feeling,
      sleepHours,
      soreness,
      restingHeartRate,
      hrv,
      steps,
      notes: record.notes?.trim() || null,
    });
  }

  return { rows, errors };
}
