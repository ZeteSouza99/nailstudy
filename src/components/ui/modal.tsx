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
      className="fixed inset-0 z-70 m-0 mt-auto max-h-[92vh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 p-0 text-left text-slate-950 dark:text-slate-50 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-5 py-5 sm:px-6">
        <div>
          <h2 id={titleId} className="text-lg font-bold text-slate-950 dark:text-slate-50">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onCloseRef.current()}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          aria-label="Fechar janela"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
