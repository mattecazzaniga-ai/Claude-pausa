import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

describe("POST /api/coach/sport — self-coaching provisioning", () => {
  let sportId: string;

  beforeEach(async () => {
    const sport = await createTestSport();
    sportId = sport.id;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestSport(sportId);
  });

  it("auto-creates a self Athlete when the coach registered as self-coaching", async () => {
    const coach = await createTestCoach();
    await prisma.coach.update({ where: { id: coach.id }, data: { selfCoaching: true } });

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coach.id, name: coach.name, email: coach.email } } as never);

    const { POST } = await import("@/app/api/coach/sport/route");
    const req = new Request("http://localhost/api/coach/sport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportId }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const selfAthlete = await prisma.athlete.findFirst({ where: { coachId: coach.id, isSelf: true } });
    expect(selfAthlete).not.toBeNull();
    expect(selfAthlete?.name).toBe(coach.name);

    await deleteTestCoach(coach.id);
  });

  it("does not create any Athlete for a regular (non self-coaching) coach", async () => {
    const coach = await createTestCoach();

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coach.id, name: coach.name, email: coach.email } } as never);

    const { POST } = await import("@/app/api/coach/sport/route");
    const req = new Request("http://localhost/api/coach/sport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportId }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const athletes = await prisma.athlete.findMany({ where: { coachId: coach.id } });
    expect(athletes).toHaveLength(0);

    await deleteTestCoach(coach.id);
  });

  it("does not create a second self Athlete if one already exists", async () => {
    const coach = await createTestCoach();
    await prisma.coach.update({ where: { id: coach.id }, data: { selfCoaching: true, primarySportId: sportId } });
    await prisma.athlete.create({ data: { coachId: coach.id, sportId, name: coach.name, isSelf: true } });

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coach.id, name: coach.name, email: coach.email } } as never);

    const { POST } = await import("@/app/api/coach/sport/route");
    const req = new Request("http://localhost/api/coach/sport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportId }),
    });
    await POST(req);

    const selfAthletes = await prisma.athlete.findMany({ where: { coachId: coach.id, isSelf: true } });
    expect(selfAthletes).toHaveLength(1);

    await deleteTestCoach(coach.id);
  });
});
