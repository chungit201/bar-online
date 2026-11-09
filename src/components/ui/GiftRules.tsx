'use client';

/**
 * What each gift does in the bar. Shown in the lobby settings and in the
 * in-room TikTok panel, so viewers and hosts see the same rules.
 *
 * Keep in sync with classifyGift() and the onGift handler in server/index.ts.
 */
const RULES: { icon: string; gift: string; effect: string }[] = [
  { icon: '🌹', gift: 'Hoa hồng', effect: 'Camera lia vào người tặng trên sân khấu' },
  { icon: '🎵', gift: 'TikTok', effect: 'Đổi nhân vật cho người tặng' },
  { icon: '🎁', gift: 'Mọi quà', effect: 'Tích điểm · Top 3 lên sân khấu, Top 1 đứng giữa' },
];

export default function GiftRules({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {RULES.map((r) => (
        <div key={r.gift} className="flex items-start gap-2 text-[11px] leading-snug">
          <span className="shrink-0 text-sm leading-none">{r.icon}</span>
          <span className="shrink-0 font-medium text-white/80">{r.gift}</span>
          <span className="text-white/40">·</span>
          <span className="text-white/50">{r.effect}</span>
        </div>
      ))}
    </div>
  );
}
