type PriceTagProps = {
  amount: number;
  /** When false, renders in muted/red unaffordable style. */
  afford?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE: Record<NonNullable<PriceTagProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-4xl",
};

/** FF Tactical money display — mono tabular $N. */
export function PriceTag({
  amount,
  afford = true,
  className = "",
  size = "md",
}: PriceTagProps) {
  return (
    <span
      className={`font-mono font-black tabular-nums tracking-tight ${SIZE[size]} ${
        afford ? "text-emerald-400" : "text-red-400"
      } ${className}`}
    >
      ${amount.toLocaleString("pt-BR")}
    </span>
  );
}
