import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
};

/** FF Tactical surface — dark glass panel with amber-border hierarchy. */
export function Panel({ children, className = "", elevated = false }: PanelProps) {
  return (
    <div
      className={`border-2 border-[rgba(255,179,0,0.16)] backdrop-blur-md ${
        elevated
          ? "bg-[#12151A]/95"
          : "bg-[#12151A]/80"
      } ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  title?: string;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-2 border-[#B87900] bg-[#FFB300] text-[#0B0D10] font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.5)] hover:brightness-110 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:hover:brightness-100 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]",
  ghost:
    "border-2 border-[rgba(255,179,0,0.16)] bg-white/[0.04] text-[#B9B29F] font-semibold shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] hover:border-[rgba(255,179,0,0.35)] hover:bg-white/[0.08] hover:text-[#F4EFE3] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40 disabled:hover:bg-white/[0.04] disabled:hover:text-[#B9B29F] disabled:active:translate-x-0 disabled:active:translate-y-0",
  danger:
    "border-2 border-[#FF3B30]/40 bg-[#FF3B30]/10 text-red-200 font-semibold shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] hover:bg-[#FF3B30]/20 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40",
};

/** FF Tactical button — primary / ghost / danger with hard shadow press. */
export function Button({
  children,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
  onClick,
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`px-5 py-3 text-center text-sm tracking-wide transition-all duration-120 disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
