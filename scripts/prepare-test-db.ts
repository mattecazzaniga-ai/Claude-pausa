import { execSync } from "node:child_process";
import { loadTestEnv } from "../tests/env";

const testUrl = loadTestEnv();
const dbName = new URL(testUrl).pathname.slice(1);

// Postgres has no "CREATE DATABASE IF NOT EXISTS" — connect to the admin
// "postgres" database and ignore the "already exists" error. Prisma's own
// ?schema= query param isn't a real libpq connection parameter, so strip it
// before handing the URL to psql.
const adminUrl = new URL(testUrl);
adminUrl.pathname = "/postgres";
adminUrl.search = "";

try {
  execSync(`psql "${adminUrl.toString()}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \\"${dbName}\\";"`, { stdio: "pipe" });
  console.log(`Created test database "${dbName}".`);
} catch (err) {
  const stderr = err && typeof err === "object" && "stderr" in err ? String((err as { stderr: Buffer }).stderr) : "";
  if (!stderr.includes("already exists")) {
    console.error(stderr || err);
    process.exit(1);
  }
}

execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
console.log(`Test database "${dbName}" is up to date.`);
