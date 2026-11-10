'use client';

import type { TikTokGiftIcons } from '@/types';

/**
 * What each gift does in the bar. Shown in the lobby settings and in the
 * in-room TikTok panel, so viewers and hosts see the same rules.
 *
 * Keep in sync with classifyGift() and the onGift handler in server/index.ts.
 */
const RULES: {
  kind?: keyof TikTokGiftIcons;
  fallback: string;
  gift: string;
  effect: string;
}[] = [
  { kind: 'rose', fallback: '🌹', gift: 'Hoa hồng', effect: 'Camera lia vào người tặng trên sân khấu' },
  { kind: 'rosa', fallback: '💐', gift: 'Rosa', effect: 'Người tặng ra quầy bar order rượu, camera đi theo' },
  { kind: 'tiktok', fallback: '🎵', gift: 'TikTok', effect: 'Đổi nhân vật cho người tặng' },
  { fallback: '❤️', gift: 'Tim x5+', effect: 'Camera lia vào người thả tim · Hiện số tim cạnh tên' },
  { fallback: '🎁', gift: 'Mọi quà', effect: 'Camera lia vào người tặng · Tích điểm, Top 3 lên sân khấu, Top 1 đứng giữa' },
];

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
            <span className="text-white/40">·</span>
            <span className="text-white/50">{r.effect}</span>
          </div>
        );
      })}
    </div>
  );
}
