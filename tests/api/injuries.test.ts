import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("/api/athletes/[id]/injuries", () => {
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

  it("creates an episode and reports ACTIVE_INJURY overall status", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST, GET } = await import("@/app/api/athletes/[id]/injuries/route");

    const createRes = await POST(
      jsonRequest("http://localhost/api/athletes/test/injuries", "POST", { type: "INFORTUNIO", bodyRegion: "Spalla", side: "RIGHT" }),
      { params: Promise.resolve({ id: athlete.id }) }
    );
    expect(createRes.status).toBe(200);

    const listRes = await GET(new Request("http://localhost/api/athletes/test/injuries"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await listRes.json();
    expect(data.injuries).toHaveLength(1);
    expect(data.overallStatus).toBe("ACTIVE_INJURY");
  });

  it("rejects an episode with no body region", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/injuries/route");

    const res = await POST(jsonRequest("http://localhost/api/athletes/test/injuries", "POST", { type: "FASTIDIO", bodyRegion: "" }), {
      params: Promise.resolve({ id: athlete.id }),
    });
    expect(res.status).toBe(400);
  });

  it("resolving an episode removes it from the active/overall status", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST, GET } = await import("@/app/api/athletes/[id]/injuries/route");
    const { PATCH } = await import("@/app/api/athletes/[id]/injuries/[injuryId]/route");

    const createRes = await POST(
      jsonRequest("http://localhost/api/athletes/test/injuries", "POST", { type: "FASTIDIO", bodyRegion: "Ginocchio" }),
      { params: Promise.resolve({ id: athlete.id }) }
    );
    const { injury } = await createRes.json();

    const patchRes = await PATCH(jsonRequest("http://localhost/api/athletes/test/injuries/x", "PATCH", { status: "RESOLVED" }), {
      params: Promise.resolve({ id: athlete.id, injuryId: injury.id }),
    });
    expect(patchRes.status).toBe(200);

    const listRes = await GET(new Request("http://localhost/api/athletes/test/injuries"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await listRes.json();
    expect(data.overallStatus).toBe("NONE");
  });

  it("adds a timeline event to an episode", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/injuries/route");
    const { POST: addEvent } = await import("@/app/api/athletes/[id]/injuries/[injuryId]/events/route");

    const createRes = await POST(
      jsonRequest("http://localhost/api/athletes/test/injuries", "POST", { type: "FASTIDIO", bodyRegion: "Caviglia" }),
      { params: Promise.resolve({ id: athlete.id }) }
    );
    const { injury } = await createRes.json();

    const eventRes = await addEvent(
      jsonRequest("http://localhost/api/athletes/test/injuries/x/events", "POST", { note: "Ridotto volume dei salti" }),
      { params: Promise.resolve({ id: athlete.id, injuryId: injury.id }) }
    );
    expect(eventRes.status).toBe(200);

    const stored = await prisma.athleteInjuryEvent.findMany({ where: { injuryId: injury.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].note).toBe("Ridotto volume dei salti");
  });

  it("deletes an episode along with its events", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/injuries/route");
    const { DELETE } = await import("@/app/api/athletes/[id]/injuries/[injuryId]/route");

    const createRes = await POST(
      jsonRequest("http://localhost/api/athletes/test/injuries", "POST", { type: "ALTRO", bodyRegion: "Polso" }),
      { params: Promise.resolve({ id: athlete.id }) }
    );
    const { injury } = await createRes.json();

    const deleteRes = await DELETE(new Request("http://localhost/api/athletes/test/injuries/x", { method: "DELETE" }), {
      params: Promise.resolve({ id: athlete.id, injuryId: injury.id }),
    });
    expect(deleteRes.status).toBe(200);

    const stored = await prisma.athleteInjury.findUnique({ where: { id: injury.id } });
    expect(stored).toBeNull();
  });

  it("returns 404 for an athlete belonging to another coach", async () => {
    const otherCoach = await createTestCoach();
    const athlete = await createTestAthlete(otherCoach.id, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/injuries/route");

    const res = await POST(jsonRequest("http://localhost/api/athletes/test/injuries", "POST", { type: "FASTIDIO", bodyRegion: "Piede" }), {
      params: Promise.resolve({ id: athlete.id }),
    });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });
});
