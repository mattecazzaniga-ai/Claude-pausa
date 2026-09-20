import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";

function apiError(status: number) {
  return new ApiError({ message: "boom", status });
}

describe("withAiRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the result immediately on success", async () => {
    const call = vi.fn().mockResolvedValue("ok");
    await expect(withAiRetry(call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries a transient server error (5xx) and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    const call = vi.fn().mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce("ok");

    const promise = withAiRetry(call);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("retries a 429 (rate limit) and a network error, giving up only after the max attempts", async () => {
    vi.useFakeTimers();
    const call = vi
      .fn()
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(apiError(500));

    const promise = withAiRetry(call);
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-transient client error (bad request / invalid key)", async () => {
    const call = vi.fn().mockRejectedValue(apiError(400));
    await expect(withAiRetry(call)).rejects.toBeInstanceOf(ApiError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not retry an auth error (401/403)", async () => {
    const call = vi.fn().mockRejectedValue(apiError(403));
    await expect(withAiRetry(call)).rejects.toBeInstanceOf(ApiError);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
