"use client";

import { Modal } from "@/components/modal";

/**
 * The app's own styled stand-in for the browser's native `confirm()` —
 * several delete/status actions used `window.confirm`, which looks like an
 * OS dialog dropped into an otherwise fully custom dark UI. One component,
 * reused everywhere a yes/no confirmation is needed.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive actions (delete, remove). */
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel}>
      <div className="p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
              danger ? "bg-negative text-white" : "bg-accent text-black"
            }`}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
