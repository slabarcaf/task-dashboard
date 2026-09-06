import { cn } from "@/lib/cn";

type ToastProps = {
  message: string;
  tone?: "success" | "error";
  visible: boolean;
  /** Optional "Deshacer". When present the toast stays up longer — see useToast. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * One line of feedback, bottom-left so it never covers a card's hover actions.
 *
 * The action slot is what lets destructive things happen immediately instead of
 * asking first: delete now, offer the way back. Confirming punishes the
 * thousand times the user meant it to protect the once they did not.
 */
export function Toast({ message, tone = "success", visible, actionLabel, onAction }: ToastProps) {
  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden">
      <div
        className={cn(
          "flex items-center gap-3 rounded-card px-4 py-3 text-sm font-medium shadow-float",
          tone === "success" ? "bg-night-1 text-white" : "bg-late text-white"
        )}
        role="status"
        aria-live="polite"
      >
        <span>{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-field border border-white/25 px-2 py-0.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/15"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
