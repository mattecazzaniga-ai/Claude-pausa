import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Tests never touch the dev database — they run against a sibling
 * "<dbname>_test" database, derived from the same DATABASE_URL the app
 * already uses (or TEST_DATABASE_URL to override). Loads .env first so this
 * works with zero extra setup on a machine that already runs the app; CI can
 * just set TEST_DATABASE_URL/DATABASE_URL directly instead of writing a file.
 */
export function loadTestEnv(): string {
  try {
    process.loadEnvFile(path.join(projectRoot, ".env"));
  } catch {
    // No .env file — fine, e.g. CI supplies real env vars directly.
  }

  const testUrl = process.env.TEST_DATABASE_URL ?? deriveTestDatabaseUrl(process.env.DATABASE_URL);
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  return testUrl;
}

function deriveTestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error("DATABASE_URL (or TEST_DATABASE_URL) must be set to run tests — see .env.");
  }
  const parsed = new URL(url);
  parsed.pathname = `${parsed.pathname}_test`;
  return parsed.toString();
}
