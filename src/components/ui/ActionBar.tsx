'use client';

import type { CameraView, Reaction } from '@/types';

const CAMERAS: { value: CameraView; label: string }[] = [
  { value: 'diagonal', label: 'Góc chéo' },
  { value: 'full-club', label: 'Toàn quán' },
  { value: 'dance-floor', label: 'Sàn nhảy' },
  { value: 'bar', label: 'Quầy bar' },
  { value: 'screen', label: 'Màn hình' },
  { value: 'top-down', label: 'Từ trên' },
  { value: 'follow-me', label: 'Tôi' },
];

const EMOTES: { type: Reaction; emoji: string; label: string }[] = [
  { type: 'clap', emoji: '👏', label: 'Vỗ tay' },
  { type: 'cheers', emoji: '🥂', label: 'Dô' },
  { type: 'heart', emoji: '❤️', label: 'Thả tim' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
];

interface ActionBarProps {
  onReact: (reaction: Reaction) => void;
  isDancing: boolean;
  onToggleDance: () => void;
  onOpenMusic: () => void;
  onTip: () => void;
  onOpenMenu: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  currentCamera: CameraView;
  onChangeCamera: (view: CameraView) => void;
  cinematic: boolean;
  /** User is steering the camera by hand, so no preset is in effect */
  freeLook: boolean;
  onToggleCinematic: () => void;
}

export default function ActionBar({
  onReact,
  isDancing,
  onToggleDance,
  onOpenMusic,
  onTip,
  onOpenMenu,
  isMuted,
  onToggleMute,
  currentCamera,
  onChangeCamera,
  cinematic,
  freeLook,
  onToggleCinematic,
}: ActionBarProps) {
  return (
    // Wrapper ignores pointer events so the 3D scene stays clickable between controls
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3">
      <div className="flex items-end justify-between gap-3">
        {/* Reserves the chat panel's footprint so the centre group stays centred */}
        <div className="hidden w-80 shrink-0 lg:block" />

        {/* ---- Centre: emotes above, camera views below ---- */}
        <div className="pointer-events-auto flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-gray-950/85 p-1.5 shadow-2xl backdrop-blur-xl">
            <EmoteButton
              emoji="💃"
              label="Đang nhảy"
              active={isDancing}
              showDot={isDancing}
              onClick={onToggleDance}
            />
            {EMOTES.map((e) => (
              <EmoteButton
                key={e.type}
                emoji={e.emoji}
                label={e.label}
                onClick={() => onReact(e.type)}
              />
            ))}
          </div>

          <div className="flex max-w-full flex-wrap justify-center gap-1.5">
            <button
              onClick={onToggleCinematic}
              title="Tự động chuyển góc quay"
              className={`rounded-full border px-3 py-1 text-xs transition ${
                cinematic
                  ? 'border-lime-300 bg-lime-300/15 text-lime-200'
                  : 'border-white/10 bg-gray-950/80 text-white/60 backdrop-blur hover:bg-white/10 hover:text-white'
              }`}
            >
              🎬 Tự động
            </button>
            {CAMERAS.map((c) => (
              <button
                key={c.value}
                onClick={() => onChangeCamera(c.value)}
                // Neither auto-pan nor hand-steering leaves a fixed view in
                // effect, so highlighting one would claim something untrue
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  !cinematic && !freeLook && currentCamera === c.value
                    ? 'border-lime-300 bg-lime-300/15 text-lime-200'
                    : 'border-white/10 bg-gray-950/80 text-white/60 backdrop-blur hover:bg-white/10 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Right: primary actions ---- */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
            className={`rounded-xl border border-white/10 px-3 py-2 text-sm backdrop-blur transition hover:bg-white/10 ${
              isMuted ? 'bg-red-500/20 text-red-300' : 'bg-gray-950/80 text-white/70'
            }`}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <SecondaryButton emoji="🎵" label="Chọn bài" onClick={onOpenMusic} />
          <SecondaryButton emoji="💰" label="Tip" onClick={onTip} />

          <button
            onClick={onOpenMenu}
            className="rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg transition hover:bg-lime-200"
          >
            🍹 Đặt bàn &amp; gọi đồ
          </button>
        </div>
      </div>
    </div>
  );
}

function EmoteButton({
  emoji,
  label,
  onClick,
  active = false,
  showDot = false,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  showDot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-16 flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 transition ${
        active
          ? 'border-lime-300 bg-lime-300/15'
          : 'border-transparent hover:bg-white/10'
      }`}
    >
      {showDot && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-400" />
      )}
      <span className="text-lg leading-none">{emoji}</span>
      <span className={`text-[10px] ${active ? 'text-lime-200' : 'text-white/60'}`}>
        {label}
      </span>
    </button>
  );
}

function SecondaryButton({
  emoji,
  label,
  onClick,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-gray-950/80 px-3 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10 hover:text-white"
    >
      {emoji} {label}
    </button>
  );
}
