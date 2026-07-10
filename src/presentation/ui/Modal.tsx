import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  persistent?: boolean;
  overlayClassName?: string;
  className?: string;
  ariaLabelledby?: string;
  ariaLabel?: string;
};

/** FF Tactical modal — thick border, hard shadow, glass backdrop. */
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

  const handleBackdrop = () => { if (!persistent && onClose) onClose(); };
  const handleKey = (e: React.KeyboardEvent) => {
    if (!persistent && e.key === "Escape" && onClose) { e.stopPropagation(); onClose(); }
  };

  return (
    <div
      className={`motion-safe:animate-ff-fade-in pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm ${overlayClassName}`}
      role="dialog" aria-modal="true" aria-labelledby={ariaLabelledby} aria-label={ariaLabel}
      onClick={handleBackdrop} onKeyDown={handleKey}
    >
      <div
        className={`motion-safe:animate-ff-scale-in w-full border-2 border-[rgba(255,179,0,0.20)] bg-[#12151A] shadow-[0_16px_40px_rgba(0,0,0,0.7)] ${className}`}
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
