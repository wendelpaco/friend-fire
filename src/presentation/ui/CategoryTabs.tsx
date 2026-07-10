import type { ShopCategory } from "@/domains/combat";

export type CategoryTabOption<T extends string = string> = {
  id: T;
  label: string;
};

const DEFAULT_SHOP_TABS: CategoryTabOption<ShopCategory | "all">[] = [
  { id: "all", label: "Todos" },
  { id: "pistol", label: "Pistolas" },
  { id: "smg", label: "SMG" },
  { id: "rifle", label: "Rifles" },
  { id: "sniper", label: "Sniper" },
  { id: "gear", label: "Gear" },
];

type CategoryTabsProps<T extends string = string> = {
  value: T;
  onChange: (id: T) => void;
  options?: CategoryTabOption<T>[];
  className?: string;
};

/** FF Tactical tab row — shop categories / filters. */
export function CategoryTabs<T extends string = string>({
  value,
  onChange,
  options,
  className = "",
}: CategoryTabsProps<T>) {
  const tabs = (options ??
    (DEFAULT_SHOP_TABS as CategoryTabOption<T>[])) as CategoryTabOption<T>[];

  return (
    <div
      className={`flex flex-wrap gap-1.5 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              active
                ? "border-amber-400/55 bg-amber-500/20 text-amber-100"
                : "border-[color:var(--ff-border)] bg-black/35 text-white/50 hover:border-white/20 hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export { DEFAULT_SHOP_TABS };
