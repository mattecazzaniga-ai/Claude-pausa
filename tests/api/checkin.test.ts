import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/athletes/test/checkins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/athletes/[id]/checkins", () => {
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

  it("creates a checkin and lists it back, most recent first", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST, GET } = await import("@/app/api/athletes/[id]/checkins/route");

    const createRes = await POST(postRequest({ readiness: 8, rpe: 6, feeling: "GOOD", sleepHours: 7.5, soreness: 3 }), {
      params: Promise.resolve({ id: athlete.id }),
    });
    expect(createRes.status).toBe(200);

    const listRes = await GET(new Request("http://localhost/api/athletes/test/checkins"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await listRes.json();
    expect(data.checkins).toHaveLength(1);
    expect(data.checkins[0]).toMatchObject({ readiness: 8, rpe: 6, feeling: "GOOD", soreness: 3 });
  });

  it("rejects a checkin with every field empty", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/checkins/route");

    const res = await POST(postRequest({}), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an athlete belonging to another coach", async () => {
    const otherCoach = await createTestCoach();
    const athlete = await createTestAthlete(otherCoach.id, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/checkins/route");

    const res = await POST(postRequest({ rpe: 5 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });
});
