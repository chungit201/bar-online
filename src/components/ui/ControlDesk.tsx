'use client';

import MusicPlayer from './MusicPlayer';
import type { MusicTrack, TikTokGifter, TikTokStatus } from '@/types';

/**
 * What the tab that created the room shows. The 3D scene lives in a second
 * tab for OBS to capture, so this one is purely a desk: session readouts and
 * the music queue.
 */
export default function ControlDesk({
  roomId,
  roomName,
  sceneUrl,
  tiktok,
  topGifters,
  viewerCount,
  musicQueue,
  currentIndex,
  isPlaying,
  onAddTrack,
  onSkip,
  onPlayPause,
  onLeave,
}: {
  roomId: string;
  roomName: string;
  sceneUrl: string;
  tiktok: TikTokStatus | null;
  topGifters: TikTokGifter[];
  viewerCount: number;
  musicQueue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  onAddTrack: (youtubeId: string, title: string) => void;
  onSkip: () => void;
  onPlayPause: () => void;
  onLeave: () => void;
}) {
  const stat = (label: string, value: string | number) => (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-lg leading-none text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0b0f] px-5 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl">

        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.07] pb-5">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Tạo phòng thành công
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
              {roomName}
            </h1>
            <p className="mt-1 font-mono text-xs text-zinc-500">Mã phòng {roomId}</p>
          </div>
          <div className="flex gap-2">
            <a
              href={sceneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10"
            >
              {tiktok?.connected ? 'Mở lại khung hình' : 'Mở khung hình'}
            </a>
            <button
              onClick={onLeave}
              className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 transition hover:border-red-500/40 hover:text-red-300"
            >
              Kết thúc
            </button>
          </div>
        </header>

        {/* The scene tab is held back until the channel is live, so the notice
            has to say which of the two states we are in */}
        {tiktok?.connected ? (
          <p className="mb-6 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-zinc-400">
            Khung hình đã mở ở tab mới. Trong OBS thêm{' '}
            <strong className="text-zinc-200">Browser Source</strong> trỏ tới địa
            chỉ đó. Giữ tab này để điều khiển nhạc và theo dõi phiên.
          </p>
        ) : (
          <p className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-xs leading-relaxed text-amber-200/80">
            {tiktok?.connecting
              ? 'Đang nối kênh TikTok LIVE. Khung hình sẽ tự mở ở tab mới ngay khi nối được.'
              : 'Chưa nối được kênh TikTok LIVE nên khung hình chưa mở. Kênh phải đang phát sóng.'}
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-5">

          {/* ---- Live session ---- */}
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 md:col-span-2">
            <h2 className="mb-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Phiên LIVE
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    tiktok?.connected
                      ? 'bg-emerald-400'
                      : tiktok?.connecting
                        ? 'bg-amber-400'
                        : 'bg-zinc-700'
                  }`}
                />
                <span className="tracking-normal text-zinc-500">
                  {tiktok?.connected ? `@${tiktok.username}` : 'Chưa nối'}
                </span>
              </span>
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {stat('người xem', (tiktok?.viewerCount ?? 0).toLocaleString())}
              {stat('tim', (tiktok?.likeCount ?? 0).toLocaleString())}
              {stat('trong quán', viewerCount)}
            </div>

            {tiktok?.lastError && (
              <p className="mt-3 text-xs text-red-400">{tiktok.lastError}</p>
            )}

            <h3 className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Top tặng quà
            </h3>
            {topGifters.length === 0 ? (
              <p className="text-xs text-zinc-600">Chưa có ai tặng quà</p>
            ) : (
              <ol className="space-y-1.5">
                {topGifters.map((g, i) => (
                  <li
                    key={g.userId}
                    className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] px-2.5 py-2"
                  >
                    <span className="w-4 shrink-0 font-mono text-xs text-amber-500">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {g.nickname}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
                      {g.lastGiftIcon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.lastGiftIcon} alt="" className="h-4 w-4 object-contain" />
                      )}
                      {g.lastGift && <span className="text-zinc-400">{g.lastGift}</span>}
                      <span className="font-mono">{g.diamonds.toLocaleString()} 🪙</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* ---- Music ---- */}
          <section className="md:col-span-3">
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Nhạc trong quán
            </h2>
            <MusicPlayer
              queue={musicQueue}
              currentIndex={currentIndex}
              isPlaying={isPlaying}
              isMuted={false}
              onAddTrack={onAddTrack}
              onSkip={onSkip}
              onPlayPause={onPlayPause}
              isHost
            />
          </section>
        </div>
      </div>
    </div>
  );
}
