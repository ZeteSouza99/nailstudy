"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    const frame = window.requestAnimationFrame(() => {
      // On touch screens, keep the keyboard closed until a field is tapped.
      if (window.matchMedia("(pointer: coarse)").matches) {
        dialog.focus({ preventScroll: true });
        return;
      }
      const initialFocus = dialog.querySelector<HTMLElement>(
        "[data-modal-initial-focus], input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      (initialFocus ?? dialog).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      autoFocus
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;

        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) onCloseRef.current();
      }}
      className="fixed inset-0 z-70 m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-white dark:bg-ink-900 p-0 pb-[env(safe-area-inset-bottom)] text-left text-ink-950 dark:text-ink-50 shadow-2xl backdrop:bg-ink-950/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900 px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0 break-words">
          <h2 id={titleId} className="text-lg font-bold text-ink-950 dark:text-ink-50">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onCloseRef.current()}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:size-9"
          aria-label="Fechar janela"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
