"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { trackClient } from "@/lib/track-client";

const POLL_INTERVAL_MS = 6000;

type Offer = {
  id: string;
  name: string;
  type: "SINGLE_SESSION" | "PACKAGE" | "SUBSCRIPTION";
  priceCents: number;
  currency: string;
  sessionCount: number | null;
};

type Payment = {
  id: string;
  method: "ONLINE" | "OFFLINE_CASH" | "OFFLINE_TRANSFER" | "OFFLINE_OTHER";
  status: "PENDING" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "REFUNDED" | "CANCELLED";
  amountCents: number;
  currency: string;
  createdAt: string;
};

type Purchase = {
  id: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  sessionsPurchased: number | null;
  sessionsUsed: number;
  expiresAt: string | null;
  priceCents: number;
  currency: string;
  createdAt: string;
  offer: Offer;
  payments: Payment[];
};

const PAYMENT_STATUS_LABEL: Record<Payment["status"], string> = {
  PENDING: "In attesa",
  PAID: "Pagato",
  PARTIALLY_PAID: "Pagato parzialmente",
  OVERDUE: "Scaduto",
  REFUNDED: "Rimborsato",
  CANCELLED: "Annullato",
};

const PAYMENT_STATUS_STYLE: Record<Payment["status"], string> = {
  PENDING: "bg-improving/15 text-improving",
  PAID: "bg-positive/15 text-positive",
  PARTIALLY_PAID: "bg-improving/15 text-improving",
  OVERDUE: "bg-negative/15 text-negative",
  REFUNDED: "bg-surface-2 text-muted",
  CANCELLED: "bg-surface-2 text-muted",
};

const METHOD_LABEL: Record<Payment["method"], string> = {
  ONLINE: "Online",
  OFFLINE_CASH: "Contanti",
  OFFLINE_TRANSFER: "Bonifico",
  OFFLINE_OTHER: "Altro",
};

/** Shared with the future team-level Payments area — basePath is the subject's own API root. */
export function PaymentsSection({ basePath, stripeConfigured }: { basePath: string; stripeConfigured: boolean }) {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [offerId, setOfferId] = useState("");
  const [method, setMethod] = useState<Payment["method"]>("OFFLINE_CASH");
  const [markPaidNow, setMarkPaidNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<{ paymentId: string; url: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState<string | null>(null);
  const previousPendingOnlineIds = useRef<Set<string>>(new Set());

  async function load() {
    const res = await fetch(`${basePath}/purchases`);
    const data = await res.json();
    const nextPurchases: Purchase[] = data.purchases ?? [];

    const stillPendingIds = new Set(
      nextPurchases.flatMap((p) => p.payments.filter((pay) => pay.method === "ONLINE" && pay.status === "PENDING").map((pay) => pay.id))
    );
    // A payment that was pending a moment ago and no longer is has either been paid
    // (webhook fired) or expired/cancelled — either way, surface it once, quietly.
    const resolved = Array.from(previousPendingOnlineIds.current).filter((id) => !stillPendingIds.has(id));
    if (resolved.length > 0) {
      const paidOne = nextPurchases
        .flatMap((p) => p.payments)
        .find((pay) => resolved.includes(pay.id) && pay.status === "PAID");
      if (paidOne) {
        setJustPaid(paidOne.id);
        setTimeout(() => setJustPaid((cur) => (cur === paidOne.id ? null : cur)), 6000);
      }
    }
    previousPendingOnlineIds.current = stillPendingIds;

    setPurchases(nextPurchases);
  }

  useEffect(() => {
    load();
    fetch("/api/offers")
      .then((r) => r.json())
      .then((data) => setOffers(data.offers ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  // While an athlete might be paying an online link right now, poll so the
  // coach sees it flip to "Pagato" on its own — never because they hit reload.
  const hasPendingOnline = (purchases ?? []).some((p) => p.payments.some((pay) => pay.method === "ONLINE" && pay.status === "PENDING"));
  useEffect(() => {
    if (!hasPendingOnline) return;
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [hasPendingOnline]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!offerId) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`${basePath}/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, method, markPaidNow: method === "ONLINE" ? undefined : markPaidNow }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Errore durante l'acquisto.");
      return;
    }

    trackClient("purchase_created", { method });

    setShowForm(false);
    setOfferId("");
    await load();

    if (data.checkoutUrl && data.purchase?.payments?.[0]?.id) {
      setNewLink({ paymentId: data.purchase.payments[0].id, url: data.checkoutUrl });
    }
  }

  async function copyLink(paymentId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard access can fail (permissions, non-secure context) — the link is still shown to copy by hand.
    }
    setCopiedId(paymentId);
    setTimeout(() => setCopiedId((cur) => (cur === paymentId ? null : cur)), 2000);
  }

  async function getAndCopyLink(paymentId: string) {
    setLinkBusyId(paymentId);
    setError(null);
    const res = await fetch(`/api/payments/${paymentId}/checkout-link`, { method: "POST" });
    const data = await res.json();
    setLinkBusyId(null);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione del link.");
      return;
    }
    setNewLink({ paymentId, url: data.checkoutUrl });
    await copyLink(paymentId, data.checkoutUrl);
  }

  async function markPaid(paymentId: string) {
    const res = await fetch(`/api/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    if (res.ok) {
      trackClient("payment_status_updated", { status: "PAID" });
      await load();
    }
  }

  const activePackages = (purchases ?? []).filter((p) => p.status === "ACTIVE" && p.offer.type !== "SINGLE_SESSION");
  const pendingOfflinePayments = (purchases ?? []).flatMap((p) =>
    p.payments.filter((pay) => pay.method !== "ONLINE" && pay.status === "PENDING").map((pay) => ({ purchase: p, payment: pay }))
  );
  const pendingOnlinePayments = (purchases ?? []).flatMap((p) =>
    p.payments.filter((pay) => pay.method === "ONLINE" && pay.status === "PENDING").map((pay) => ({ purchase: p, payment: pay }))
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Pagamenti</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2"
        >
          + Nuovo acquisto
        </button>
      </div>

      {justPaid && (
        <div className="mb-4 rounded-md border border-positive/30 bg-positive/10 px-3.5 py-2.5 text-sm text-positive">
          ✓ Pagamento ricevuto — l&apos;atleta ha appena pagato il link inviato.
        </div>
      )}

      {newLink && (
        <div className="mb-4 rounded-md border border-accent/30 bg-accent/10 p-3.5">
          <p className="mb-2 text-xs font-medium text-accent">Link di pagamento pronto — copialo e inviaglielo</p>
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={newLink.url}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none"
            />
            <button
              onClick={() => copyLink(newLink.paymentId, newLink.url)}
              className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
            >
              {copiedId === newLink.paymentId ? "Copiato ✓" : "Copia link"}
            </button>
            <button onClick={() => setNewLink(null)} className="shrink-0 text-xs text-muted hover:text-foreground">
              Chiudi
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-xl border border-border bg-surface p-4">
          {error && <p className="text-xs text-negative">{error}</p>}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Offerta</label>
            <select
              value={offerId}
              onChange={(e) => setOfferId(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Seleziona…</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {formatMoney(o.priceCents, o.currency)}
                </option>
              ))}
            </select>
            {offers.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                Non hai ancora creato offerte —{" "}
                <a href="/payments/offers" className="underline">
                  creane una
                </a>
                .
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Metodo di pagamento</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Payment["method"])}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {stripeConfigured && <option value="ONLINE">Online</option>}
              <option value="OFFLINE_CASH">Contanti</option>
              <option value="OFFLINE_TRANSFER">Bonifico</option>
              <option value="OFFLINE_OTHER">Altro</option>
            </select>
          </div>
          {method === "ONLINE" && (
            <p className="text-xs text-muted">
              Genera un link di pagamento sicuro da copiare e inviare all&apos;atleta (WhatsApp, email, SMS…). Quando
              paga, lo stato si aggiorna qui automaticamente.
            </p>
          )}
          {method !== "ONLINE" && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={markPaidNow} onChange={(e) => setMarkPaidNow(e.target.checked)} className="accent-accent" />
              Segna già come pagato
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !offerId}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "…" : method === "ONLINE" ? "Genera link di pagamento" : "Registra acquisto"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
              Annulla
            </button>
          </div>
        </form>
      )}

      {pendingOnlinePayments.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium text-muted">In attesa che l&apos;atleta paghi il link</p>
          {pendingOnlinePayments.map(({ purchase, payment }) => (
            <div key={payment.id} className="flex items-center justify-between rounded-md border border-dashed border-border p-2.5 text-sm">
              <span>
                {purchase.offer.name} · {formatMoney(payment.amountCents, payment.currency)}
              </span>
              <button
                onClick={() => getAndCopyLink(payment.id)}
                disabled={linkBusyId === payment.id}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
              >
                {linkBusyId === payment.id ? "…" : copiedId === payment.id ? "Copiato ✓" : "Copia link"}
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingOfflinePayments.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium text-muted">Pagamenti in attesa di conferma</p>
          {pendingOfflinePayments.map(({ purchase, payment }) => (
            <div key={payment.id} className="flex items-center justify-between rounded-md border border-dashed border-border p-2.5 text-sm">
              <span>
                {purchase.offer.name} · {formatMoney(payment.amountCents, payment.currency)} · {METHOD_LABEL[payment.method]}
              </span>
              <button onClick={() => markPaid(payment.id)} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2">
                Segna pagato
              </button>
            </div>
          ))}
        </div>
      )}

      {activePackages.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium text-muted">Pacchetti attivi</p>
          {activePackages.map((p) => {
            const remaining = p.sessionsPurchased != null ? p.sessionsPurchased - p.sessionsUsed : null;
            const expiringSoon = p.expiresAt && new Date(p.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="font-medium">{p.offer.name}</p>
                {remaining != null && (
                  <p className="text-sm text-muted">
                    {remaining} / {p.sessionsPurchased} sessioni rimanenti
                  </p>
                )}
                {p.expiresAt && (
                  <p className={`mt-0.5 text-xs ${expiringSoon ? "text-improving" : "text-muted"}`}>
                    {expiringSoon ? "⚠️ " : ""}Scade il {formatDate(p.expiresAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mb-2 text-xs font-medium text-muted">Storico acquisti</p>
      {purchases === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : purchases.length === 0 ? (
        <p className="text-sm text-muted">Nessun acquisto registrato.</p>
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => {
            const latestPayment = p.payments[0];
            const remaining = p.sessionsPurchased != null ? p.sessionsPurchased - p.sessionsUsed : null;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-3 text-sm">
                <div>
                  <p className="font-medium">{p.offer.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(p.createdAt)} · {formatMoney(p.priceCents, p.currency)}
                    {remaining != null ? ` · ${p.sessionsUsed} usate, ${remaining} rimanenti` : ""}
                  </p>
                </div>
                {latestPayment && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PAYMENT_STATUS_STYLE[latestPayment.status]}`}>
                    {PAYMENT_STATUS_LABEL[latestPayment.status]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
