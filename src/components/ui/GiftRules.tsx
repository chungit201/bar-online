'use client';

import type { TikTokGiftIcons } from '@/types';
import { EXTRA_RULES, GIFT_RULES } from './giftRuleTable';

/**
 * What each gift does in the bar. Shown in the lobby settings and in the
 * in-room TikTok panel, so viewers and hosts see the same rules.
 *
 * The table itself lives in ./giftRuleTable so the broadcast overlay can show the
 * same gifts without duplicating the list.
 */
const RULES = [...GIFT_RULES, ...EXTRA_RULES];

export default function GiftRules({
  compact = false,
  icons = {},
}: {
  compact?: boolean;
  /** Real artwork from the connected channel; emoji stand in until it arrives */
  icons?: TikTokGiftIcons;
}) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {RULES.map((r) => {
        const src = r.kind && icons[r.kind];
        return (
          <div key={r.gift} className="flex items-start gap-2 text-[11px] leading-snug">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={r.gift} className="h-4 w-4 shrink-0 object-contain" />
            ) : (
              <span className="shrink-0 text-sm leading-none">{r.fallback}</span>
            )}
            <span className="shrink-0 font-medium text-white/80">{r.gift}</span>
            {/* 🪙 to match the leaderboard in ControlDesk and the chat line the
                server posts — one currency symbol across the whole app */}
            {r.cost !== undefined && (
              <span className="shrink-0 font-mono text-[10px] text-amber-300/70">{r.cost} 🪙</span>
            )}
            <span className="text-white/40">·</span>
            <span className="text-white/50">{r.effect}</span>
          </div>
        );
      })}
    </div>
  );
}
