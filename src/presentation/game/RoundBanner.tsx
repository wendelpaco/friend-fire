"use client";

interface RoundBannerProps {
  text: string;
}

/**
 * Full-width round-end toast (§2.2). Parent controls visibility (2.5s).
 */
export function RoundBanner({ text }: RoundBannerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[28%] z-30 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="motion-safe:animate-ff-slide-up w-full max-w-3xl border-y border-amber-400/50 bg-black/80 py-4 text-center shadow-[0_0_40px_rgba(0,0,0,0.65)] backdrop-blur-md">
        <div className="text-2xl font-black tracking-[0.35em] text-amber-50 sm:text-3xl">
          {text}
        </div>
      </div>
    </div>
  );
}
