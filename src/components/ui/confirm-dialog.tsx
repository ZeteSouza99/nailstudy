"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/action-result";

import { Alert } from "./alert";
import { Button } from "./button";
import { Modal } from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<ActionResult<unknown>>;
  onClose: () => void;
  onConfirmed: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  onConfirmed,
}: ConfirmDialogProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        onConfirmed();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4 p-5 sm:p-6">
        {error ? <Alert>{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} data-modal-initial-focus>
            Voltar
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={isPending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
