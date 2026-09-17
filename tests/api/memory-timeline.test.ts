import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";
import { recordAthleteMemoryObservation, recordTeamMemoryObservation } from "@/lib/memory";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function postRequest() {
  return new Request("http://localhost/x", { method: "POST" });
}

describe("Memory Timeline API — athlete", () => {
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

  it("GET lists memories for an owned athlete, confirm/reject/reactivate change state", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const memory = await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, summary: "Da confermare.", source: "MANUAL" });

    const { GET } = await import("@/app/api/athletes/[id]/memories/route");
    const listRes = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: athlete.id }) });
    const listData = await listRes.json();
    expect(listData.memories).toHaveLength(1);
    expect(listData.memories[0].reviewState).toBe("ACTIVE");

    const { POST: confirm } = await import("@/app/api/athletes/[id]/memories/[memoryId]/confirm/route");
    const confirmRes = await confirm(postRequest(), { params: Promise.resolve({ id: athlete.id, memoryId: memory.id }) });
    expect(confirmRes.status).toBe(200);

    const { POST: reject } = await import("@/app/api/athletes/[id]/memories/[memoryId]/reject/route");
    await reject(postRequest(), { params: Promise.resolve({ id: athlete.id, memoryId: memory.id }) });

    const { POST: reactivate } = await import("@/app/api/athletes/[id]/memories/[memoryId]/reactivate/route");
    const reactivateRes = await reactivate(postRequest(), { params: Promise.resolve({ id: athlete.id, memoryId: memory.id }) });
    expect(reactivateRes.status).toBe(200);

    const finalListRes = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: athlete.id }) });
    const finalData = await finalListRes.json();
    expect(finalData.memories[0].reviewState).toBe("ACTIVE");
    expect(finalData.memories[0].confidence).toBe("CONFIRMED"); // the earlier confirm sticks
  });

  it("rejects an athlete belonging to another coach with 404 (never a cross-coach leak)", async () => {
    const otherCoach = await createTestCoach();
    const otherAthlete = await createTestAthlete(otherCoach.id, sportId);

    const { GET } = await import("@/app/api/athletes/[id]/memories/route");
    const res = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: otherAthlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });
});

describe("Memory Timeline API — team", () => {
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

  it("GET lists memories for an owned team, confirm/reject/reactivate change state", async () => {
    const team = await createTestTeam(coachId, sportId, []);
    const memory = await recordTeamMemoryObservation({ teamId: team.id, coachId, summary: "Da confermare.", source: "MANUAL" });

    const { GET } = await import("@/app/api/teams/[id]/memories/route");
    const listRes = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: team.id }) });
    const listData = await listRes.json();
    expect(listData.memories).toHaveLength(1);

    const { POST: reject } = await import("@/app/api/teams/[id]/memories/[memoryId]/reject/route");
    const rejectRes = await reject(postRequest(), { params: Promise.resolve({ id: team.id, memoryId: memory.id }) });
    expect(rejectRes.status).toBe(200);

    const { POST: reactivate } = await import("@/app/api/teams/[id]/memories/[memoryId]/reactivate/route");
    await reactivate(postRequest(), { params: Promise.resolve({ id: team.id, memoryId: memory.id }) });

    const { POST: confirm } = await import("@/app/api/teams/[id]/memories/[memoryId]/confirm/route");
    const confirmRes = await confirm(postRequest(), { params: Promise.resolve({ id: team.id, memoryId: memory.id }) });
    expect(confirmRes.status).toBe(200);

    const finalListRes = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: team.id }) });
    const finalData = await finalListRes.json();
    expect(finalData.memories[0].confidence).toBe("CONFIRMED");
  });

  it("rejects a team belonging to another coach with 404 (never a cross-coach leak)", async () => {
    const otherCoach = await createTestCoach();
    const otherTeam = await createTestTeam(otherCoach.id, sportId, []);

    const { GET } = await import("@/app/api/teams/[id]/memories/route");
    const res = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: otherTeam.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });
});
