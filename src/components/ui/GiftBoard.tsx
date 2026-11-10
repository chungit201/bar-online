'use client';

import type { TikTokGiftCounts, TikTokGiftIcons } from '@/types';
import { GIFT_RULES } from './giftRuleTable';

/**
 * The gift menu drawn over the broadcast: one tile per gift, each showing the
 * artwork, how many have been sent this session, and what the gift does.
 *
 * The "what it does" label is the hard part — ten of them side by side would
 * either wrap into a wall of text or get cut off. Each tile is therefore a
 * fixed narrow box and the label slides through it, so a long effect name
 * still reads in full without costing any more width. Labels short enough to
 * fit stay still, because text that scrolls when it doesn't need to is just
 * noise.
 */
const TILE_CHARS = 9;

export default function GiftBoard({
  icons = {},
  counts = {},
}: {
  icons?: TikTokGiftIcons;
  counts?: TikTokGiftCounts;
}) {
  return (
    <div className="pointer-events-none rounded-lg border border-white/10 bg-black/55 px-2 py-1.5 backdrop-blur-sm">
      <div className="grid grid-cols-5 gap-x-1.5 gap-y-1">
        {GIFT_RULES.map((r) => {
          const src = r.kind && icons[r.kind];
          const n = (r.kind && counts[r.kind]) || 0;
          const scrolls = r.short.length > TILE_CHARS;

          return (
            <div key={r.gift} className="flex w-12 flex-col items-center">
              <div className="relative">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={r.gift} className="h-7 w-7 object-contain" />
                ) : (
                  <span className="block h-7 w-7 text-center text-xl leading-7">{r.fallback}</span>
                )}
                {n > 0 && (
                  <span className="absolute -right-1.5 -top-1 rounded-full bg-amber-500 px-1 text-[8px] font-bold leading-[13px] text-black">
                    {n > 999 ? '999+' : n}
                  </span>
                )}
              </div>

              {/* Fixed-width window; the label inside is what moves */}
              <div className="mt-0.5 w-12 overflow-hidden">
                <span
                  className={`block whitespace-nowrap text-[7px] font-semibold tracking-wide text-cyan-200/90 ${
                    scrolls ? 'animate-slide-label' : 'text-center'
                  }`}
                >
                  {r.short}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
