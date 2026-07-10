import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** Prevents closing on backdrop click / Esc. */
  persistent?: boolean;
  /** Extra classes on the overlay. */
  overlayClassName?: string;
  /** Extra classes on the card. */
  className?: string;
  ariaLabelledby?: string;
  ariaLabel?: string;
};

/**
 * FF Tactical modal — standardised backdrop + card.
 *
 * Replaces scattered inline fixed-position divs (pause menu, server browser,
 * quick-match overlay, etc.). Those callers should migrate in follow-up PRs.
 */
export function Modal({
  open,
  onClose,
  children,
  persistent = false,
  overlayClassName = "",
  className = "",
  ariaLabelledby,
  ariaLabel,
}: ModalProps) {
  if (!open) return null;

  const handleBackdrop = () => {
    if (!persistent && onClose) onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!persistent && e.key === "Escape" && onClose) {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className={`motion-safe:animate-ff-fade-in pointer-events-auto fixed inset-0 flex items-center justify-center bg-[var(--ff-bg-overlay)] p-4 backdrop-blur-sm ${overlayClassName}`}
      style={{ zIndex: "var(--ff-z-modal)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
      aria-label={ariaLabel}
      onClick={handleBackdrop}
      onKeyDown={handleKey}
    >
      {/* Card — stop propagation so clicks inside don't close */}
      <div
        className={`motion-safe:animate-ff-scale-in w-full rounded-[var(--ff-radius-2xl)] border border-[var(--ff-border)] bg-[var(--ff-panel)] shadow-[var(--ff-shadow-xl)] ${className}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
