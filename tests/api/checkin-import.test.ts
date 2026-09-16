import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function importRequest(body: FormData) {
  return new Request("http://localhost/api/athletes/test/checkins/import", { method: "POST", body });
}

describe("/api/athletes/[id]/checkins/import", () => {
  let coachId: string;
  let sportId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: "Test Coach", email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("imports valid rows as WEARABLE_IMPORT checkins", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/checkins/import/route");

    const csv = ["date,readiness,restingHeartRate", "2026-09-01,8,50", "2026-09-02,6,55"].join("\n");
    const form = new FormData();
    form.append("text", csv);

    const res = await POST(importRequest(form), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(2);
    expect(data.skipped).toHaveLength(0);

    const checkins = await prisma.athleteCheckin.findMany({ where: { athleteId: athlete.id } });
    expect(checkins).toHaveLength(2);
    expect(checkins.every((c) => c.source === "WEARABLE_IMPORT")).toBe(true);
  });

  it("reports skipped rows and still imports the valid ones", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/checkins/import/route");

    const csv = ["date,readiness", "2026-09-01,8", "bad-date,5"].join("\n");
    const form = new FormData();
    form.append("text", csv);

    const res = await POST(importRequest(form), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.skipped.length).toBeGreaterThan(0);
  });

  it("returns 422 when no row is valid", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/checkins/import/route");

    const form = new FormData();
    form.append("text", "date,readiness\nbad-date,8");

    const res = await POST(importRequest(form), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(422);
  });

  it("returns 404 for an athlete belonging to another coach", async () => {
    const otherCoach = await createTestCoach();
    const athlete = await createTestAthlete(otherCoach.id, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/checkins/import/route");

    const form = new FormData();
    form.append("text", "date,readiness\n2026-09-01,8");

    const res = await POST(importRequest(form), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });
});
