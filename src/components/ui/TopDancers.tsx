'use client';

import type { TikTokGifter } from '@/types';

/**
 * The three on stage, named by rank, drawn over the broadcast.
 *
 * Ranks come from the same gift ledger that decides who physically stands on
 * the stage slots, so this board and the scene can never disagree about who
 * the Chủ tịch is.
 */
const RANKS = [
  { label: 'CHỦ TỊCH', tint: 'text-amber-300' },
  { label: 'PHÓ CHỦ TỊCH', tint: 'text-sky-300' },
  { label: 'THƯ KÝ', tint: 'text-fuchsia-300' },
];

export default function TopDancers({ top = [] }: { top?: TikTokGifter[] }) {
  return (
    <div className="pointer-events-none rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
      <p className="mb-1 text-center text-[8px] font-bold uppercase tracking-[0.2em] text-white/50">
        Vũ công nổi bật
      </p>
      <div className="space-y-0.5">
        {RANKS.map((rank, i) => {
          const g = top[i];
          return (
            <div key={rank.label} className="flex items-center gap-1.5 text-[9px] leading-tight">
              <span className={`shrink-0 font-bold ${rank.tint}`}>{rank.label}:</span>
              {/* Truncate rather than wrap — TikTok nicknames run long, and a
                  second line would push the board over the stage */}
              <span className="min-w-0 flex-1 truncate text-white/85">
                {g ? g.nickname : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
