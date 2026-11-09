'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Player, Reaction } from '@/types';

const REACTIONS: { type: Reaction; emoji: string; label: string }[] = [
  { type: 'clap', emoji: '👏', label: 'Vỗ tay' },
  { type: 'cheers', emoji: '🥂', label: 'Chúc mừng' },
  { type: 'dance', emoji: '💃', label: 'Nhảy' },
  { type: 'heart', emoji: '❤️', label: 'Tim' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
  { type: 'fire', emoji: '🔥', label: 'Lửa' },
];

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string, scope: 'all' | 'table') => void;
  onReaction: (type: Reaction) => void;
  players: Player[];
  currentTableId?: string;
}

export default function ChatPanel({
  messages,
  onSend,
  onReaction,
  players,
  currentTableId,
}: ChatPanelProps) {
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'all' | 'table'>('all');
  const [showPlayers, setShowPlayers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, scope);
    setText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full w-full max-w-md flex-col rounded-2xl border border-white/10 bg-gray-950/90 shadow-2xl shadow-purple-900/20 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-purple-300">
          Chat
        </h2>
        <button
          onClick={() => setShowPlayers((p) => !p)}
          className="rounded-lg bg-white/5 px-3 py-1 text-xs text-cyan-300 transition hover:bg-white/10"
        >
          Trong quán ({players.length})
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Messages */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {messages.map((msg) => (
              <div key={msg.id} className="group">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-pink-400">
                    {msg.senderName}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.scope === 'table' && (
                    <span className="rounded bg-purple-500/20 px-1.5 text-[10px] text-purple-300">
                      bàn
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-white/80">
                  {msg.text}
                </p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reactions */}
          <div className="flex gap-1 border-t border-white/5 px-4 py-2">
            {REACTIONS.map((r) => (
              <button
                key={r.type}
                onClick={() => onReaction(r.type)}
                className="rounded-lg px-2 py-1 text-lg transition hover:scale-110 hover:bg-white/10"
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>

          {/* Scope toggle + input */}
          <div className="border-t border-white/10 px-4 py-3">
            <div className="mb-2 flex gap-1">
              <button
                onClick={() => setScope('all')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  scope === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                Cả quán
              </button>
              <button
                onClick={() => setScope('table')}
                disabled={!currentTableId}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  scope === 'table'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                } disabled:cursor-not-allowed disabled:opacity-30`}
              >
                Cùng bàn
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Nhắn gì đó..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500"
              />
              <button
                onClick={handleSend}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>

        {/* Player list sidebar */}
        {showPlayers && (
          <div className="w-40 border-l border-white/10 p-3">
            <h3 className="mb-2 text-xs font-semibold text-cyan-400">
              Trong quán ({players.length})
            </h3>
            <ul className="space-y-1 overflow-y-auto">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 text-xs text-white/70"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  {p.nickname}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
