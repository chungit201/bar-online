'use client';

import type { TikTokAction } from '@/types';

/**
 * Full-width shout for the two gifts big enough to deserve one.
 *
 * Deliberately not shown for every gift: the camera already cuts to whoever
 * sent one, and a banner on each would cover the floor non-stop on a busy
 * LIVE. Chat still carries the line for everything else.
 */
const BANNER_FOR: Partial<
  Record<NonNullable<TikTokAction['effect']>, { tint: string; label: string }>
> = {
  moneyRain: { tint: 'from-amber-400 to-yellow-200', label: '💸 MONEY GUN' },
  galaxy: { tint: 'from-fuchsia-400 to-cyan-300', label: '🌌 GALAXY MODE' },
};

export default function GiftBanner({
  effect,
  compact = false,
}: {
  effect: TikTokAction | null;
  /** Tall broadcast frame — far less width, so scale the type down */
  compact?: boolean;
}) {
  const look = effect?.effect ? BANNER_FOR[effect.effect] : undefined;
  if (!effect || !look) return null;

  // No timer and no state: the banner fades itself out via CSS, and the `key`
  // restarts that animation on each new gift. `effect` lingers in game state
  // until the next one arrives, so a state-based lifetime would need an
  // effect that sets state — the thing that causes cascading renders.
  const key = `${effect.effect}:${effect.userId}:${effect.at}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18%] z-40 flex justify-center">
      <div key={key} className="animate-gift-banner text-center">
        <p
          className={`bg-gradient-to-r ${look.tint} bg-clip-text font-extrabold uppercase tracking-wider text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ${
            compact ? 'text-2xl' : 'text-5xl'
          }`}
        >
          {look.label}
        </p>
        <p
          className={`mt-1 font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
            compact ? 'text-sm' : 'text-2xl'
          }`}
        >
          {effect.nickname}
        </p>
      </div>
    </div>
  );
}
