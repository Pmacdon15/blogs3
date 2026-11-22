"use client";

import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

/** Keeps Tab and Shift+Tab cycling through the dialog's enabled buttons. */
export function trapTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"),
  );
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  const active = document.activeElement;
  if (!first || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
}

/*
 * A small modal confirmation. Rendered only while open; focus starts on
 * Cancel (the safe choice), stays inside while open and goes back to
 * whatever opened it on close. Escape or a backdrop click cancels.
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
    if (!open) return;
    // Never null while the page has a <body>; SVG elements can focus() too.
    const opener = document.activeElement as HTMLElement;
    cancelRef.current?.focus();
    return () => opener.focus();
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
          else trapTab(event);
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
