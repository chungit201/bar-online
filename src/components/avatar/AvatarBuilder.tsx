'use client';

import { useState } from 'react';
import type { AvatarConfig, Gender } from '@/types';
import AvatarPreview from './AvatarPreview';

const HAIRSTYLES = [
  { value: 'short', label: 'Ngắn' },
  { value: 'medium', label: 'Vừa' },
  { value: 'long', label: 'Dài' },
  { value: 'curly', label: 'Xoăn' },
  { value: 'mohawk', label: 'Mohawk' },
  { value: 'bald', label: 'Trọc' },
];

const HAIR_COLORS = ['#1a1a1a', '#4a3728', '#8b6914', '#c4562e', '#e6c84c', '#d4d4d4', '#e84393', '#6c5ce7'];

const TOP_STYLES = [
  { value: 'tshirt', label: 'Áo thun' },
  { value: 'shirt', label: 'Sơ mi' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'tank', label: 'Tanktop' },
  { value: 'jacket', label: 'Jacket' },
];

const BOTTOM_STYLES = [
  { value: 'jeans', label: 'Jeans' },
  { value: 'shorts', label: 'Quần short' },
  { value: 'skirt', label: 'Váy' },
  { value: 'pants', label: 'Quần tây' },
  { value: 'joggers', label: 'Joggers' },
];

const SHOES = [
  { value: 'sneakers', label: 'Giày thể thao' },
  { value: 'boots', label: 'Boots' },
  { value: 'heels', label: 'Giày cao gót' },
  { value: 'sandals', label: 'Sandals' },
  { value: 'loafers', label: 'Loafers' },
];

const ACCESSORIES = [
  { value: null, label: 'Không' },
  { value: 'sunglasses', label: 'Kính mát' },
  { value: 'hat', label: 'Mũ' },
  { value: 'earrings', label: 'Bông tai' },
  { value: 'necklace', label: 'Vòng cổ' },
  { value: 'watch', label: 'Đồng hồ' },
];

const OUTFIT_COLORS = [
  '#ffffff', '#1a1a1a', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#1e3a5f', '#5c1a1a', '#2d1b4e', '#1a3a2a',
];

const DEFAULT_AVATAR: AvatarConfig = {
  gender: 'male',
  hairstyle: 'short',
  hairColor: '#1a1a1a',
  topStyle: 'tshirt',
  topColor: '#3b82f6',
  bottomStyle: 'jeans',
  bottomColor: '#1a1a2e',
  shoes: 'sneakers',
  accessory: null,
};

interface AvatarBuilderProps {
  nickname: string;
  onComplete: (nickname: string, avatar: AvatarConfig) => void;
}

export default function AvatarBuilder({ nickname: initialNickname, onComplete }: AvatarBuilderProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [tab, setTab] = useState<'gender' | 'hair' | 'top' | 'bottom' | 'shoes' | 'accessory'>('gender');

  const update = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => {
    setAvatar((prev) => ({ ...prev, [key]: value }));
  };

  const TABS = [
    { key: 'gender' as const, label: 'Giới tính', icon: '👤' },
    { key: 'hair' as const, label: 'Tóc', icon: '💇' },
    { key: 'top' as const, label: 'Áo', icon: '👕' },
    { key: 'bottom' as const, label: 'Quần', icon: '👖' },
    { key: 'shoes' as const, label: 'Giày', icon: '👟' },
    { key: 'accessory' as const, label: 'Phụ kiện', icon: '✨' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="flex w-full max-w-4xl gap-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-neon">
        {/* Preview */}
        <div className="flex w-72 flex-col items-center gap-4">
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
            <AvatarPreview avatar={avatar} />
          </div>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-center text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Customization */}
        <div className="flex flex-1 flex-col">
          <h2 className="neon-text mb-4 text-xl font-bold text-purple-400">Tạo nhân vật</h2>

          {/* Tab navigation */}
          <div className="mb-4 flex gap-1 rounded-xl bg-gray-800 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition ${
                  tab === t.key
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="block text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'gender' && (
              <div className="grid grid-cols-3 gap-3">
                {([['male', 'Nam', '🧑'], ['female', 'Nữ', '👩'], ['non-binary', 'Khác', '🧑‍🎤']] as const).map(([val, label, icon]) => (
                  <button
                    key={val}
                    onClick={() => update('gender', val as Gender)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                      avatar.gender === val
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-3xl">{icon}</span>
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {tab === 'hair' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-400">Kiểu tóc</p>
                  <div className="grid grid-cols-3 gap-2">
                    {HAIRSTYLES.map((h) => (
                      <button
                        key={h.value}
                        onClick={() => update('hairstyle', h.value)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          avatar.hairstyle === h.value
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-400">Màu tóc</p>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => update('hairColor', c)}
                        className={`h-8 w-8 rounded-full border-2 transition ${
                          avatar.hairColor === c ? 'border-purple-400 scale-110' : 'border-gray-600 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'top' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-400">Kiểu áo</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TOP_STYLES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => update('topStyle', s.value)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          avatar.topStyle === s.value
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-400">Màu áo</p>
                  <div className="flex flex-wrap gap-2">
                    {OUTFIT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => update('topColor', c)}
                        className={`h-8 w-8 rounded-full border-2 transition ${
                          avatar.topColor === c ? 'border-purple-400 scale-110' : 'border-gray-600 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'bottom' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-400">Kiểu quần</p>
                  <div className="grid grid-cols-3 gap-2">
                    {BOTTOM_STYLES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => update('bottomStyle', s.value)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          avatar.bottomStyle === s.value
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-400">Màu quần</p>
                  <div className="flex flex-wrap gap-2">
                    {OUTFIT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => update('bottomColor', c)}
                        className={`h-8 w-8 rounded-full border-2 transition ${
                          avatar.bottomColor === c ? 'border-purple-400 scale-110' : 'border-gray-600 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'shoes' && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">Giày</p>
                <div className="grid grid-cols-3 gap-2">
                  {SHOES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => update('shoes', s.value)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        avatar.shoes === s.value
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'accessory' && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">Phụ kiện</p>
                <div className="grid grid-cols-3 gap-2">
                  {ACCESSORIES.map((a) => (
                    <button
                      key={a.value ?? 'none'}
                      onClick={() => update('accessory', a.value)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        avatar.accessory === a.value
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm button */}
          <button
            onClick={() => {
              if (nickname.trim()) onComplete(nickname.trim(), avatar);
            }}
            disabled={!nickname.trim()}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Vào quán!
          </button>
        </div>
      </div>
    </div>
  );
}
