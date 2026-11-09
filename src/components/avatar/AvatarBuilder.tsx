'use client';

import { useState } from 'react';
import type { AvatarConfig } from '@/types';
import { DANCE_CLIPS } from './dances';

type PickGender = 'male' | 'female';

interface AvatarBuilderProps {
  nickname: string;
  onComplete: (nickname: string, avatar: AvatarConfig) => void;
  /** Optional — the "Huỷ" button only appears when a handler is supplied */
  onCancel?: () => void;
}

/**
 * Entry form for the bar.
 *
 * There is no character picker: viewers arriving from a TikTok LIVE are
 * assigned a random one, so everybody enters the same way. The clip is drawn
 * on submit rather than during render, which keeps this component pure.
 */
export default function AvatarBuilder({
  nickname: initialNickname,
  onComplete,
  onCancel,
}: AvatarBuilderProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [gender, setGender] = useState<PickGender>('male');
  const [adult, setAdult] = useState(false);

  const canEnter = nickname.trim().length > 0 && adult;

  const submit = () => {
    if (!canEnter) return;
    const clip = DANCE_CLIPS[Math.floor(Math.random() * DANCE_CLIPS.length)];
    onComplete(nickname.trim(), {
      characterId: clip.id,
      gender,
      // Legacy fields kept so the server contract and the 3D block avatar
      // (still available behind a flag) keep working.
      hairstyle: 'short',
      hairColor: '#1a1a1a',
      topStyle: 'tshirt',
      topColor: '#3b82f6',
      bottomStyle: 'jeans',
      bottomColor: '#1a1a2e',
      shoes: 'sneakers',
      accessory: null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="my-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#15131c] p-5 shadow-2xl">
        <h1 className="mb-1 text-sm font-semibold text-white">Vào quán</h1>
        <p className="mb-4 text-xs text-white/40">
          Nhân vật của bạn sẽ được chọn ngẫu nhiên khi vào phòng.
        </p>

        <label className="mb-1 block text-xs text-white/50" htmlFor="nickname">
          Biệt danh
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Nhập biệt danh..."
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-500"
        />

        <div className="mx-auto mb-4 flex w-fit gap-1 rounded-full bg-white/5 p-1">
          {([['male', '♂ Nam'], ['female', '♀ Nữ']] as const).map(([g, label]) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`rounded-full px-5 py-1.5 text-xs font-medium transition ${
                gender === g
                  ? g === 'female'
                    ? 'bg-pink-500 text-white'
                    : 'bg-sky-500 text-white'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            className="h-4 w-4 accent-lime-400"
          />
          Tôi đủ 18 tuổi
        </label>

        <button
          onClick={submit}
          disabled={!canEnter}
          className="mb-2 w-full rounded-xl bg-lime-300 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Vào quán
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full rounded-xl bg-white/5 py-2.5 text-sm text-white/70 transition hover:bg-white/10"
          >
            Huỷ
          </button>
        )}

        <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-white/35">
          <p>Giữ lịch sự. Host có thể tắt tiếng hoặc chặn người vi phạm.</p>
        </div>
      </div>
    </div>
  );
}
