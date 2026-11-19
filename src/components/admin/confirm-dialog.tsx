"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

/*
 * A small modal confirmation. Rendered only while open; focus starts on
 * Cancel (the safe choice) and Escape or a backdrop click cancels.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-brand-950/40 backdrop-blur-sm"
        onClick={onCancel}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-(--shadow-lift)"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        role="alertdialog"
      >
        <h2 className="font-semibold text-base text-ink" id={titleId}>
          {title}
        </h2>
        <p className="mt-1.5 text-muted text-sm" id={descriptionId}>
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            disabled={pending}
            onClick={onCancel}
            ref={cancelRef}
            size="sm"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            size="sm"
            variant="danger"
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
