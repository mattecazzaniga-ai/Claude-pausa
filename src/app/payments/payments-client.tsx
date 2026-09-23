"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";

type RecentPayment = {
  id: string;
  athleteName: string;
  athleteId: string;
  offerName: string;
  amountCents: number;
  currency: string;
  status: "PENDING" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "REFUNDED" | "CANCELLED";
  method: "ONLINE" | "OFFLINE_CASH" | "OFFLINE_TRANSFER" | "OFFLINE_OTHER";
  createdAt: string;
};

type MonthlyRevenue = { month: string; cents: number };

type Overview = {
  revenueThisMonthCents: number;
  upcomingCents: number;
  outstandingCents: number;
  activePackages: number;
  monthlyRevenue: MonthlyRevenue[];
  recentPayments: RecentPayment[];
};

const STATUS_LABEL: Record<RecentPayment["status"], string> = {
  PENDING: "In attesa",
  PAID: "Pagato",
  PARTIALLY_PAID: "Parziale",
  OVERDUE: "Scaduto",
  REFUNDED: "Rimborsato",
  CANCELLED: "Annullato",
};

const STATUS_STYLE: Record<RecentPayment["status"], string> = {
  PENDING: "bg-improving/15 text-improving",
  PAID: "bg-positive/15 text-positive",
  PARTIALLY_PAID: "bg-improving/15 text-improving",
  OVERDUE: "bg-negative/15 text-negative",
  REFUNDED: "bg-surface-2 text-muted",
  CANCELLED: "bg-surface-2 text-muted",
};

const METHOD_LABEL: Record<RecentPayment["method"], string> = {
  ONLINE: "Online",
  OFFLINE_CASH: "Contanti",
  OFFLINE_TRANSFER: "Bonifico",
  OFFLINE_OTHER: "Altro",
};

export function PaymentsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/payments/overview")
      .then((r) => r.json())
      .then(setOverview);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 py-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Pagamenti</h1>
        <Link href="/payments/offers" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
          Cosa vendi →
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted">Tieni organizzato il tuo business di coaching.</p>

      {overview === null ? (
        <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <div className="h-3 w-2/3 rounded bg-surface-2" />
              <div className="mt-2 h-5 w-1/2 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Entrate questo mese" value={formatMoney(overview.revenueThisMonthCents)} />
            <StatCard label="In arrivo" value={formatMoney(overview.upcomingCents)} hint="Pagamenti online in corso" />
            <StatCard label="Da incassare" value={formatMoney(overview.outstandingCents)} hint="Ancora da confermare" accent={overview.outstandingCents > 0} />
            <StatCard label="Pacchetti attivi" value={String(overview.activePackages)} />
          </div>

          <RevenueChart data={overview.monthlyRevenue} />

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Pagamenti recenti</h2>
          {overview.recentPayments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              Nessun pagamento ancora. Crea un&apos;offerta e registra il primo acquisto dalla scheda di un atleta.
            </p>
          ) : (
            <div className="space-y-2">
              {overview.recentPayments.map((p) => (
                <Link
                  key={p.id}
                  href={`/athletes/${p.athleteId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-3 text-sm transition-colors hover:bg-surface-2"
                >
                  <div>
                    <p className="font-medium">{p.athleteName}</p>
                    <p className="text-xs text-muted">
                      {p.offerName} · {formatDate(p.createdAt)} · {METHOD_LABEL[p.method]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatMoney(p.amountCents, p.currency)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Real revenue by month, computed from actual PAID payments — never a mockup series. */
function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const hasAny = data.some((d) => d.cents > 0);
  if (!hasAny) return null;

  const max = Math.max(...data.map((d) => d.cents), 1);
  const chartHeightPx = 96;

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Entrate per mese</p>
      <div className="flex items-end gap-3" style={{ height: chartHeightPx }}>
        {data.map((d) => (
          <div
            key={d.month}
            className="w-full rounded-t-sm bg-accent/70 transition-colors hover:bg-accent"
            style={{ height: Math.max(4, (d.cents / max) * chartHeightPx) }}
            title={formatMoney(d.cents)}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-3">
        {data.map((d) => (
          <span key={d.month} className="w-full text-center text-[11px] text-muted">
            {d.month}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? "text-improving" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
