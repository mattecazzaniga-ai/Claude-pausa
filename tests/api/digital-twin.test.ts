import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

describe("GET /api/athletes/[id]/digital-twin", () => {
  let coachId: string;
  let sportId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: coach.name, email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("rejects an unauthenticated request", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/athletes/[id]/digital-twin/route");

    const res = await GET(new Request("http://localhost/api/athletes/x/digital-twin"), { params: Promise.resolve({ id: "whatever" }) });
    expect(res.status).toBe(401);
  });

  it("rejects an athlete belonging to another coach", async () => {
    const otherCoach = await createTestCoach();
    const athlete = await createTestAthlete(otherCoach.id, sportId);
    const { GET } = await import("@/app/api/athletes/[id]/digital-twin/route");

    const res = await GET(new Request("http://localhost/api/athletes/x/digital-twin"), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });

  it("returns the aggregated snapshot for the coach's own athlete", async () => {
    const athlete = await createTestAthlete(coachId, sportId, { name: "Atleta API" });
    const { GET } = await import("@/app/api/athletes/[id]/digital-twin/route");

    const res = await GET(new Request("http://localhost/api/athletes/x/digital-twin"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.twin.name).toBe("Atleta API");
    expect(data.twin.overallInjuryStatus).toBe("NONE");
  });
});
