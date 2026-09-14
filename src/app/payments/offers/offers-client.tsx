"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { trackClient } from "@/lib/track-client";

type OfferType = "SINGLE_SESSION" | "PACKAGE" | "SUBSCRIPTION";
type Eligibility = "INDIVIDUAL" | "PAIR" | "TEAM";

type Offer = {
  id: string;
  name: string;
  description: string | null;
  type: OfferType;
  priceCents: number;
  currency: string;
  sessionCount: number | null;
  expirationDays: number | null;
  sessionDurationMinutes: number | null;
  eligibility: Eligibility;
  billingFrequency: string | null;
  active: boolean;
};

const TYPE_LABEL: Record<OfferType, string> = {
  SINGLE_SESSION: "Sessione singola",
  PACKAGE: "Pacchetto",
  SUBSCRIPTION: "Abbonamento",
};

const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  INDIVIDUAL: "Individuale",
  PAIR: "Coppia",
  TEAM: "Squadra",
};

type FormState = {
  name: string;
  description: string;
  type: OfferType;
  price: string;
  currency: string;
  sessionCount: string;
  expirationDays: string;
  sessionDurationMinutes: string;
  eligibility: Eligibility;
  billingFrequency: "WEEKLY" | "MONTHLY";
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  type: "SINGLE_SESSION",
  price: "",
  currency: "EUR",
  sessionCount: "1",
  expirationDays: "",
  sessionDurationMinutes: "60",
  eligibility: "INDIVIDUAL",
  billingFrequency: "MONTHLY",
};

export function OffersClient({ stripeConfigured }: { stripeConfigured: boolean }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/offers?includeInactive=true");
    const data = await res.json();
    setOffers(data.offers ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function startEdit(offer: Offer) {
    setForm({
      name: offer.name,
      description: offer.description ?? "",
      type: offer.type,
      price: (offer.priceCents / 100).toString(),
      currency: offer.currency,
      sessionCount: offer.sessionCount?.toString() ?? "",
      expirationDays: offer.expirationDays?.toString() ?? "",
      sessionDurationMinutes: offer.sessionDurationMinutes?.toString() ?? "",
      eligibility: offer.eligibility,
      billingFrequency: (offer.billingFrequency as "WEEKLY" | "MONTHLY") ?? "MONTHLY",
    });
    setEditingId(offer.id);
    setShowForm(true);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const priceCents = Math.round(parseFloat(form.price.replace(",", ".")) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setSaving(false);
      setError("Inserisci un prezzo valido.");
      return;
    }

    const body = editingId
      ? {
          name: form.name,
          description: form.description || null,
          priceCents,
          sessionCount: form.type !== "SUBSCRIPTION" && form.sessionCount ? Number(form.sessionCount) : null,
          expirationDays: form.type === "PACKAGE" && form.expirationDays ? Number(form.expirationDays) : null,
          sessionDurationMinutes: form.sessionDurationMinutes ? Number(form.sessionDurationMinutes) : null,
          eligibility: form.eligibility,
        }
      : {
          name: form.name,
          description: form.description || null,
          type: form.type,
          priceCents,
          currency: form.currency,
          sessionCount: form.type !== "SUBSCRIPTION" && form.sessionCount ? Number(form.sessionCount) : null,
          expirationDays: form.type === "PACKAGE" && form.expirationDays ? Number(form.expirationDays) : null,
          sessionDurationMinutes: form.sessionDurationMinutes ? Number(form.sessionDurationMinutes) : null,
          eligibility: form.eligibility,
          billingFrequency: form.type === "SUBSCRIPTION" ? form.billingFrequency : null,
        };

    const res = await fetch(editingId ? `/api/offers/${editingId}` : "/api/offers", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Errore durante il salvataggio.");
      return;
    }

    setShowForm(false);
    await load();
    trackClient(editingId ? "offer_updated" : "offer_created", { type: form.type });
  }

  async function toggleActive(offer: Offer) {
    const res = await fetch(`/api/offers/${offer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !offer.active }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div>
          <Link href="/payments" className="text-xs text-muted hover:underline">
            ← Pagamenti
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Cosa vendi</h1>
        </div>
        <button
          onClick={startCreate}
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          + Nuova offerta
        </button>
      </div>
      <p className="mb-6 text-sm text-muted">Sessioni singole, pacchetti o abbonamenti — tu decidi prezzo e condizioni.</p>

      {!stripeConfigured && (
        <div className="mb-6 rounded-lg border border-improving/30 bg-improving/10 px-4 py-3 text-sm text-improving">
          I pagamenti online non sono ancora configurati su questo ambiente. Le offerte funzionano comunque: puoi registrare
          pagamenti in contanti/bonifico manualmente.
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            {editingId ? "Modifica offerta" : "Nuova offerta"}
          </h2>
          {error && <p className="text-xs text-negative">{error}</p>}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Es. Sessione privata 60 min"
              required
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Descrizione (opzionale)</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {!editingId && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_LABEL) as OfferType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t, sessionCount: t === "SINGLE_SESSION" ? "1" : f.sessionCount }))}
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      form.type === t ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-surface-2"
                    }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Prezzo</label>
              <div className="flex items-center gap-1.5">
                <input
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  required
                  inputMode="decimal"
                  className="w-28 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {!editingId && (
                  <input
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    maxLength={3}
                    className="w-16 rounded-md border border-border bg-surface-2 px-2 py-2 text-center text-sm uppercase outline-none focus:border-accent"
                  />
                )}
                {editingId && <span className="text-sm text-muted">{form.currency}</span>}
              </div>
            </div>

            {form.type !== "SUBSCRIPTION" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">N. sessioni</label>
                <input
                  type="number"
                  min={1}
                  value={form.sessionCount}
                  onChange={(e) => setForm((f) => ({ ...f, sessionCount: e.target.value }))}
                  disabled={form.type === "SINGLE_SESSION"}
                  className="w-24 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Durata sessione (min)</label>
              <input
                type="number"
                min={10}
                max={240}
                value={form.sessionDurationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, sessionDurationMinutes: e.target.value }))}
                className="w-24 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            {form.type === "PACKAGE" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Scadenza (giorni, opzionale)</label>
                <input
                  type="number"
                  min={1}
                  value={form.expirationDays}
                  onChange={(e) => setForm((f) => ({ ...f, expirationDays: e.target.value }))}
                  placeholder="Nessuna"
                  className="w-28 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            )}

            {form.type === "SUBSCRIPTION" && !editingId && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Fatturazione</label>
                <select
                  value={form.billingFrequency}
                  onChange={(e) => setForm((f) => ({ ...f, billingFrequency: e.target.value as "WEEKLY" | "MONTHLY" }))}
                  className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="MONTHLY">Mensile</option>
                  <option value="WEEKLY">Settimanale</option>
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Tipo atleta</label>
              <select
                value={form.eligibility}
                onChange={(e) => setForm((f) => ({ ...f, eligibility: e.target.value as Eligibility }))}
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {(Object.keys(ELIGIBILITY_LABEL) as Eligibility[]).map((e) => (
                  <option key={e} value={e}>
                    {ELIGIBILITY_LABEL[e]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "Salva offerta"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
              Annulla
            </button>
          </div>
        </form>
      )}

      {offers === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-muted">Non hai ancora creato nessuna offerta.</p>
      ) : (
        <div className="space-y-2">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                offer.active ? "border-border bg-surface" : "border-border bg-surface/50 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
                    {TYPE_LABEL[offer.type]}
                  </span>
                  {!offer.active && <span className="text-[11px] uppercase tracking-wide text-muted">Disattivata</span>}
                </div>
                <p className="mt-1 font-medium">{offer.name}</p>
                <p className="text-sm text-muted">
                  {formatMoney(offer.priceCents, offer.currency)}
                  {offer.type === "SUBSCRIPTION" && `/${offer.billingFrequency === "WEEKLY" ? "settimana" : "mese"}`}
                  {offer.sessionCount ? ` · ${offer.sessionCount} sessioni` : ""}
                  {offer.expirationDays ? ` · scade dopo ${offer.expirationDays}gg` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(offer)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2">
                  Modifica
                </button>
                <button onClick={() => toggleActive(offer)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2">
                  {offer.active ? "Disattiva" : "Riattiva"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
