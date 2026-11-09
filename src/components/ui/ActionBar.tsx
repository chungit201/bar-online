'use client';

import type { CameraView } from '@/types';

const CAMERAS: { value: CameraView; label: string }[] = [
  { value: 'diagonal', label: 'Góc chéo' },
  { value: 'full-club', label: 'Toàn quán' },
  { value: 'dance-floor', label: 'Sàn nhảy' },
  { value: 'bar', label: 'Quầy bar' },
  { value: 'screen', label: 'Màn hình' },
  { value: 'top-down', label: 'Từ trên' },
  { value: 'follow-me', label: 'Tôi' },
];

interface ActionBarProps {
  onOpenMusic: () => void;
  onOpenChat: () => void;
  onOpenMenu: () => void;
  onOpenTablePicker: () => void;
  onToggleMute: () => void;
  onTip: () => void;
  onCallWaiter: () => void;
  onRequestDJ: () => void;
  isMuted: boolean;
  onChangeCamera: (view: CameraView) => void;
  currentCamera: CameraView;
}

export default function ActionBar({
  onOpenMusic,
  onOpenChat,
  onOpenMenu,
  onOpenTablePicker,
  onToggleMute,
  onTip,
  onCallWaiter,
  onRequestDJ,
  isMuted,
  onChangeCamera,
  currentCamera,
}: ActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-2 py-2 sm:px-4">
        {/* Main actions */}
        <div className="flex gap-0.5 sm:gap-1">
          <ActionButton emoji="🎵" label="Nhạc" onClick={onOpenMusic} />
          <ActionButton emoji="💬" label="Chat" onClick={onOpenChat} />
          <ActionButton emoji="🍸" label="Menu" onClick={onOpenMenu} />
          <ActionButton emoji="🪑" label="Bàn" onClick={onOpenTablePicker} />
        </div>

        {/* Quick actions */}
        <div className="hidden gap-0.5 sm:flex">
          <ActionButton emoji="💰" label="Tip" onClick={onTip} />
          <ActionButton emoji="🙋" label="Waiter" onClick={onCallWaiter} />
          <ActionButton emoji="🎧" label="DJ" onClick={onRequestDJ} />
        </div>

        {/* Camera selector */}
        <select
          value={currentCamera}
          onChange={(e) => onChangeCamera(e.target.value as CameraView)}
          className="hidden rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500 sm:block"
        >
          {CAMERAS.map((c) => (
            <option key={c.value} value={c.value} className="bg-gray-900">
              {c.label}
            </option>
          ))}
        </select>

        {/* Mute toggle */}
        <button
          onClick={onToggleMute}
          className={`rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 ${
            isMuted
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-white/5 text-green-400 hover:bg-white/10'
          }`}
        >
          {isMuted ? '🔇' : '🔊'}
          <span className="ml-1 hidden sm:inline">{isMuted ? 'Tắt tiếng' : 'Bật tiếng'}</span>
        </button>
      </div>
    </div>
  );
}

function ActionButton({
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
      className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition hover:bg-white/10 sm:px-3"
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-[10px] text-white/60">{label}</span>
    </button>
  );
}
