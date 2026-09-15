"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";

export function DeleteConfirmDialog({
  title,
  description,
  memoryLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  /** Label for the "also forget this from the AI" checkbox — omit to hide it (nothing to forget). */
  memoryLabel?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (forgetAiMemory: boolean) => void;
}) {
  const [forgetAiMemory, setForgetAiMemory] = useState(false);

  return (
    <Modal onClose={onCancel}>
      <div className="p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>

        {memoryLabel && (
          <label className="mt-4 flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3 text-sm">
            <input
              type="checkbox"
              checked={forgetAiMemory}
              onChange={(e) => setForgetAiMemory(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span>{memoryLabel}</span>
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => onConfirm(forgetAiMemory)}
            disabled={busy}
            className="rounded-md bg-negative px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Eliminazione…" : "Elimina definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
