import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, deleteTestCoach } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));
vi.mock("@/lib/ai-methodology-import", () => ({
  parseMethodologyDocument: vi.fn().mockResolvedValue({
    principles: [{ text: "Non aumento volume e intensità insieme", category: "VOLUME" }],
  }),
}));

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/coach/methodology", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("/api/coach/methodology", () => {
  let coachId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: coach.name, email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
  });

  it("GET returns an empty methodology for a new coach", async () => {
    const { GET } = await import("@/app/api/coach/methodology/route");
    const res = await GET();
    const data = await res.json();
    expect(data.principles).toHaveLength(0);
    expect(data.history).toHaveLength(0);
  });

  it("PUT saves principles and bumps the version", async () => {
    const { PUT } = await import("@/app/api/coach/methodology/route");
    const res = await PUT(jsonRequest("PUT", { principles: [{ text: "Preferisco la qualità al volume", category: "FILOSOFIA" }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.version).toBe(1);
    expect(data.principles).toHaveLength(1);
    expect(data.principles[0].id).toBeTruthy();
  });

  it("PUT rejects a principle shorter than 2 characters", async () => {
    const { PUT } = await import("@/app/api/coach/methodology/route");
    const res = await PUT(jsonRequest("PUT", { principles: [{ text: "x", category: "ALTRO" }] }));
    expect(res.status).toBe(400);
  });
});

describe("/api/coach/methodology/import", () => {
  let coachId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: coach.name, email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
  });

  it("returns a draft without persisting anything (confirmation required)", async () => {
    const { POST } = await import("@/app/api/coach/methodology/import/route");
    const form = new FormData();
    form.append("text", "Preferisco la qualità al volume. Non aumento volume e intensità insieme.");

    const res = await POST(new Request("http://localhost/api/coach/methodology/import", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.principles).toHaveLength(1);

    const { GET } = await import("@/app/api/coach/methodology/route");
    const liveRes = await GET();
    const live = await liveRes.json();
    expect(live.principles).toHaveLength(0); // nothing saved until PUT confirms it
  });

  it("rejects a photo upload (text-only import)", async () => {
    const { POST } = await import("@/app/api/coach/methodology/import/route");
    const form = new FormData();
    form.append("file", new File(["fake"], "metodologia.jpg", { type: "image/jpeg" }));

    const res = await POST(new Request("http://localhost/api/coach/methodology/import", { method: "POST", body: form }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty submission", async () => {
    const { POST } = await import("@/app/api/coach/methodology/import/route");
    const form = new FormData();

    const res = await POST(new Request("http://localhost/api/coach/methodology/import", { method: "POST", body: form }));
    expect(res.status).toBe(400);
  });
});
