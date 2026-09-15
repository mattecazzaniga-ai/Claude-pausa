import { describe, it, expect, vi, afterEach } from "vitest";
import { rateLimit, clientIp } from "@/lib/rate-limit";

describe("rateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
  });

  it("blocks once the limit is exceeded", () => {
    const key = `test-${Math.random()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });

  it("resets once the window has elapsed", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;

    rateLimit(key, 1, 1000);
    expect(rateLimit(key, 1, 1000)).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(rateLimit(key, 1, 1000)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;

    rateLimit(keyA, 1, 60_000);
    expect(rateLimit(keyA, 1, 60_000)).toBe(false);
    expect(rateLimit(keyB, 1, 60_000)).toBe(true);
  });
});

describe("clientIp", () => {
  it("reads the first address from x-forwarded-for", () => {
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to unknown without the header", () => {
    const req = new Request("http://localhost");
    expect(clientIp(req)).toBe("unknown");
  });

  it("also reads a plain header map, the shape NextAuth's authorize() receives", () => {
    expect(clientIp({ "x-forwarded-for": "9.9.9.9" })).toBe("9.9.9.9");
    expect(clientIp(undefined)).toBe("unknown");
    expect(clientIp(null)).toBe("unknown");
  });
});
