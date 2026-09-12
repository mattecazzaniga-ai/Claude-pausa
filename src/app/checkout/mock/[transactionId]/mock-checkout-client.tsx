"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MockCheckoutClient({ transactionId, squareId }: { transactionId: string; squareId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"success" | "fail" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(outcome: "success" | "fail") {
    setLoading(outcome);
    setError(null);
    const res = await fetch("/api/payments/mock-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, outcome }),
    });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    if (outcome === "success" && data.status === "COMPLETED") {
      router.push(`/square/${squareId}?purchased=1`);
    } else {
      router.push(`/square/${squareId}`);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => confirm("success")}
        disabled={loading !== null}
        className="w-full rounded-md bg-accent py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading === "success" ? "Confirming…" : "Simulate successful payment"}
      </button>
      <button
        onClick={() => confirm("fail")}
        disabled={loading !== null}
        className="w-full rounded-md border border-border py-2 text-sm text-muted transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        {loading === "fail" ? "Confirming…" : "Simulate failed payment"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
