import { Ammo as AmmoIcon } from "@/presentation/icons";

type AmmoDisplayProps = {
  mag: number;
  reserve: number;
  lowAmmo?: boolean;
  className?: string;
};

/**
 * FF Tactical ammo counter — bullet icon + current mag / reserve.
 */
export function AmmoDisplay({
  mag,
  reserve,
  lowAmmo = false,
  className = "",
}: AmmoDisplayProps) {
  return (
    <div
      className={`rounded-lg border bg-black/65 px-3 py-2 backdrop-blur-md ${
        lowAmmo ? "border-red-500/50" : "border-white/10"
      } ${className}`}
    >
      <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">
        <AmmoIcon size={10} />
        munição
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-3xl font-black tabular-nums ${
            lowAmmo ? "text-red-400" : "text-white"
          }`}
        >
          {mag}
        </span>
        <span className="text-white/35">/</span>
        <span className="text-lg tabular-nums text-white/65">{reserve}</span>
      </div>
    </div>
  );
}
