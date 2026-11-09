'use client';

import { useRef, useState } from 'react';
import YouTube, { type YouTubeEvent } from 'react-youtube';
import type { MusicTrack } from '@/types';

interface MusicPlayerProps {
  queue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isMuted: boolean;
  onAddTrack: (youtubeId: string, title: string) => void;
  onSkip: () => void;
  onPlayPause: () => void;
  isHost: boolean;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function MusicPlayer({
  queue,
  currentIndex,
  isPlaying,
  isMuted,
  onAddTrack,
  onSkip,
  onPlayPause,
  isHost,
}: MusicPlayerProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const playerRef = useRef<{ mute: () => void; unMute: () => void } | null>(null);

  const currentTrack = queue[currentIndex] ?? null;
  const upcoming = queue.slice(currentIndex + 1);

  const handleAdd = () => {
    setError('');
    const id = extractYouTubeId(url.trim());
    if (!id) {
      setError('Link YouTube không hợp lệ');
      return;
    }
    if (!title.trim()) {
      setError('Vui lòng nhập tên bài hát');
      return;
    }
    onAddTrack(id, title.trim());
    setUrl('');
    setTitle('');
  };

  const onReady = (e: YouTubeEvent) => {
    playerRef.current = e.target;
    if (isMuted) e.target.mute();
    else e.target.unMute();
  };

  const onEnd = () => {
    onSkip();
  };

  // Sync mute state when it changes
  if (playerRef.current) {
    if (isMuted) playerRef.current.mute();
    else playerRef.current.unMute();
  }

  return (
    <div className="flex w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-gray-950/90 shadow-2xl shadow-cyan-900/20 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-cyan-300">
          🎵 Nhạc
        </h2>
        {currentTrack && (
          <button
            onClick={onPlayPause}
            className="rounded-lg bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            {isPlaying ? '⏸ Tạm dừng' : '▶ Phát'}
          </button>
        )}
      </div>

      {/* YouTube embed */}
      <div className="aspect-video w-full bg-black">
        {currentTrack ? (
          <YouTube
            videoId={currentTrack.youtubeId}
            opts={{
              width: '100%',
              height: '100%',
              playerVars: {
                autoplay: isPlaying ? 1 : 0,
                controls: 0,
                modestbranding: 1,
                rel: 0,
              },
            }}
            className="h-full w-full"
            iframeClassName="h-full w-full"
            onReady={onReady}
            onEnd={onEnd}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/30">
            Chưa có bài nào trong hàng chờ
          </div>
        )}
      </div>

      {/* Now playing */}
      {currentTrack && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {currentTrack.title}
            </p>
            <p className="text-xs text-pink-400">
              Thêm bởi {currentTrack.addedByName}
            </p>
          </div>
          {isHost && (
            <button
              onClick={onSkip}
              className="ml-3 shrink-0 rounded-lg bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Bỏ qua ⏭
            </button>
          )}
        </div>
      )}

      {/* Queue */}
      {upcoming.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-b border-white/10 px-4 py-2">
          <h3 className="mb-1 text-xs font-semibold text-white/40">
            Hàng chờ ({upcoming.length})
          </h3>
          <ul className="space-y-1">
            {upcoming.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center gap-2 text-xs text-white/60"
              >
                <span className="text-white/30">{i + 1}.</span>
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-pink-400/60">{t.addedByName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add track */}
      <div className="px-4 py-3">
        <p className="mb-2 text-[10px] text-white/30">
          Mỗi người được thêm tối đa 2 bài
        </p>
        <div className="space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Dán link YouTube..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Tên bài hát"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-cyan-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleAdd}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Thêm vào hàng chờ
          </button>
        </div>
      </div>
    </div>
  );
}
