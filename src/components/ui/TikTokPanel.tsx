'use client';

import { useState } from 'react';
import type { TikTokStatus } from '@/types';
import GiftRules from './GiftRules';

/**
 * Host-only control for linking the room to a TikTok LIVE stream. Viewer
 * comments, likes and gifts from that stream are replayed into the bar.
 */
export default function TikTokPanel({
  status,
  onConnect,
  onDisconnect,
  onClose,
}: {
  status: TikTokStatus | null;
  onConnect: (username: string) => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(status?.username ?? '');

  const connected = status?.connected ?? false;
  const connecting = status?.connecting ?? false;

  return (
    <div className="w-80 rounded-2xl border border-white/10 bg-gray-950/90 p-4 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pink-300">TikTok LIVE</h2>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60 transition hover:bg-white/10"
        >
          Đóng
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? 'bg-green-400' : connecting ? 'bg-amber-400' : 'bg-white/25'
          }`}
        />
        <span className="text-white/70">
          {connected ? 'Đang nhận sự kiện' : connecting ? 'Đang kết nối…' : 'Chưa kết nối'}
        </span>
      </div>

      {connected && (
        <div className="mb-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-white/5 py-2">
            <p className="text-sm font-semibold text-white">
              {status?.viewerCount.toLocaleString() ?? 0}
            </p>
            <p className="text-[10px] text-white/40">người xem</p>
          </div>
          <div className="rounded-xl bg-white/5 py-2">
            <p className="text-sm font-semibold text-white">
              {status?.likeCount.toLocaleString() ?? 0}
            </p>
            <p className="text-[10px] text-white/40">tim</p>
          </div>
        </div>
      )}

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && username.trim() && onConnect(username.trim())}
        placeholder="@tenkenh hoặc link LIVE"
        disabled={connected || connecting}
        className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-pink-500 disabled:opacity-50"
      />

      {connected || connecting ? (
        <button
          onClick={onDisconnect}
          className="w-full rounded-xl bg-red-500/80 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
        >
          Ngắt kết nối
        </button>
      ) : (
        <button
          onClick={() => username.trim() && onConnect(username.trim())}
          disabled={!username.trim()}
          className="w-full rounded-xl bg-pink-500 py-2 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Kết nối
        </button>
      )}

      {status?.lastError && (
        <p className="mt-2 text-xs text-red-400">{status.lastError}</p>
      )}

      <div className="mt-3 border-t border-white/10 pt-3">
        <p className="mb-2 text-[11px] font-semibold text-pink-200/80">
          Quà tặng và hiệu ứng
        </p>
        <GiftRules compact />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        Kênh phải đang phát LIVE. Bình luận hiện trong khung chat, tim và quà
        thành hiệu ứng trong quán.
      </p>
    </div>
  );
}
