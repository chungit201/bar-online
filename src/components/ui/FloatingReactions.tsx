'use client';

import { useEffect, useState } from 'react';

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  playerName: string;
}

const REACTION_EMOJIS: Record<string, string> = {
  clap: '👏',
  cheers: '🥂',
  dance: '💃',
  heart: '❤️',
  laugh: '😂',
  fire: '🔥',
};

let nextId = 0;

interface FloatingReactionsProps {
  reactions: { playerId: string; playerName: string; reaction: string }[];
  /** Tall broadcast frame: far less width to play with, so scale everything down */
  compact?: boolean;
}

export default function FloatingReactions({ reactions, compact = false }: FloatingReactionsProps) {
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    if (reactions.length === 0) return;
    const latest = reactions[reactions.length - 1];
    const emoji = REACTION_EMOJIS[latest.reaction] ?? '✨';
    const id = nextId++;
    const x = 20 + Math.random() * 60;

    setEmojis((prev) => [...prev, { id, emoji, x, playerName: latest.playerName }]);

    const timer = setTimeout(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2500);

    return () => clearTimeout(timer);
  }, [reactions.length]);

  return (
    // `absolute`, not `fixed`: fixed positions against the viewport, so in
    // broadcast mode the hearts floated over the letterbox bars instead of
    // staying inside the captured frame. This now fills whichever parent is
    // the frame, and `overflow-hidden` clips anything that drifts out.
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {emojis.map((e) => (
        <div
          key={e.id}
          className="absolute animate-float-up"
          style={{ left: `${e.x}%`, bottom: '10%' }}
        >
          <div className="flex flex-col items-center">
            <span className={`${compact ? 'text-xl' : 'text-4xl'} drop-shadow-lg`}>{e.emoji}</span>
            <span
              className={`mt-1 rounded-full bg-black/50 text-white/80 backdrop-blur-sm ${
                compact ? 'px-1.5 py-px text-[7px]' : 'px-2 py-0.5 text-[10px]'
              }`}
            >
              {e.playerName}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
