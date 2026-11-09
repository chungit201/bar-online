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
}

export default function FloatingReactions({ reactions }: FloatingReactionsProps) {
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
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {emojis.map((e) => (
        <div
          key={e.id}
          className="absolute animate-float-up"
          style={{ left: `${e.x}%`, bottom: '10%' }}
        >
          <div className="flex flex-col items-center">
            <span className="text-4xl drop-shadow-lg">{e.emoji}</span>
            <span className="mt-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
              {e.playerName}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
