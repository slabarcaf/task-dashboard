"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastState = {
  visible: boolean;
  message: string;
  tone: "success" | "error";
  actionLabel?: string;
  onAction?: () => void;
};

const PLAIN_MS = 2200;
/** An undoable toast has to outlive the moment of "wait, no" — hence longer. */
const ACTION_MS = 7000;

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    tone: "success"
  });
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const dismiss = useCallback(() => {
    clearTimer();
    setToast((current) => ({ ...current, visible: false }));
  }, []);

  const pushToast = useCallback((message: string, tone: "success" | "error" = "success") => {
    clearTimer();
    setToast({ visible: true, message, tone });
    timer.current = window.setTimeout(
      () => setToast((current) => ({ ...current, visible: false })),
      PLAIN_MS
    );
  }, []);

  /** Shows `message` with an action button; running it dismisses the toast. */
  const pushUndoToast = useCallback(
    (message: string, actionLabel: string, onAction: () => void) => {
      clearTimer();
      setToast({
        visible: true,
        message,
        tone: "success",
        actionLabel,
        onAction: () => {
          clearTimer();
          setToast((current) => ({ ...current, visible: false }));
          onAction();
        }
      });
      timer.current = window.setTimeout(
        () => setToast((current) => ({ ...current, visible: false })),
        ACTION_MS
      );
    },
    []
  );

  useEffect(() => clearTimer, []);

  return { toast, pushToast, pushUndoToast, dismiss };
}
