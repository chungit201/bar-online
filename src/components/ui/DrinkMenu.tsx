'use client';

import { useState } from 'react';
import type { Table, Drink, Player } from '@/types';

type Tab = 'menu' | 'tables' | 'offers';

interface DrinkMenuProps {
  tables: Table[];
  drinks: Drink[];
  players: Player[];
  localPlayerId: string | null;
  onSitAtTable: (tableId: string) => void;
  onOrderDrink: (drinkId: string, forPlayerId?: string) => void;
  currentTableId?: string;
  onLeaveTable: () => void;
}

export default function DrinkMenu({
  tables,
  drinks,
  players,
  localPlayerId,
  onSitAtTable,
  onOrderDrink,
  currentTableId,
  onLeaveTable,
}: DrinkMenuProps) {
  const [tab, setTab] = useState<Tab>('menu');
  const [orderFor, setOrderFor] = useState<string | null>(null);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'menu', label: 'Menu', icon: '🍸' },
    { key: 'tables', label: 'Chọn bàn', icon: '🪑' },
    { key: 'offers', label: 'Ưu đãi', icon: '🎉' },
  ];

  const otherPlayers = players.filter((p) => p.id !== localPlayerId);

  return (
    <div className="flex w-full max-w-md flex-col rounded-2xl border border-white/10 bg-gray-950/90 shadow-2xl shadow-pink-900/20 backdrop-blur-xl">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-xs font-semibold tracking-wide transition ${
              tab === t.key
                ? 'border-b-2 border-pink-500 text-pink-400'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        {/* Menu tab */}
        {tab === 'menu' && (
          <div className="space-y-3">
            {/* Order for picker */}
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span className="text-xs text-white/40">Gọi cho:</span>
              <button
                onClick={() => setOrderFor(null)}
                className={`rounded-lg px-2 py-1 text-xs transition ${
                  !orderFor ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                Bản thân
              </button>
              {otherPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setOrderFor(p.id)}
                  className={`rounded-lg px-2 py-1 text-xs transition ${
                    orderFor === p.id ? 'bg-pink-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {p.nickname}
                </button>
              ))}
            </div>

            <ul className="space-y-2">
              {drinks.map((drink) => (
                <li
                  key={drink.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 transition hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{drink.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{drink.name}</p>
                      {drink.price > 0 && (
                        <p className="text-xs text-white/40">{drink.price.toLocaleString()}đ</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onOrderDrink(drink.id, orderFor ?? undefined)}
                    className="rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  >
                    Gọi
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tables tab */}
        {tab === 'tables' && (
          <div>
            {currentTableId && (
              <button
                onClick={onLeaveTable}
                className="mb-4 w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
              >
                Rời bàn hiện tại
              </button>
            )}
            <div className="grid grid-cols-3 gap-3">
              {tables.map((table) => {
                const occupied = table.players.length;
                const capacity = table.seats.length;
                const isFull = occupied >= capacity;
                const isCurrent = table.id === currentTableId;
                return (
                  <button
                    key={table.id}
                    onClick={() => !isFull && !isCurrent && onSitAtTable(table.id)}
                    disabled={isFull || isCurrent}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition ${
                      isCurrent
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                        : isFull
                          ? 'cursor-not-allowed border-white/5 bg-white/5 text-white/20'
                          : 'border-white/10 bg-white/5 text-white/70 hover:border-pink-500/50 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-lg">{isCurrent ? '🟢' : isFull ? '🔴' : '🪑'}</span>
                    <span className="text-xs font-medium">Bàn {table.id.slice(-2)}</span>
                    <span className="text-[10px]">{occupied}/{capacity}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Offers tab */}
        {tab === 'offers' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">🍺</span>
                <h3 className="text-sm font-bold text-purple-300">Combo Bia</h3>
              </div>
              <p className="mb-2 text-xs text-white/60">3 bia + 1 đĩa mồi. Tiết kiệm 30%!</p>
              <p className="text-lg font-bold text-purple-400">150.000đ</p>
            </div>
            <div className="rounded-xl border border-pink-500/30 bg-pink-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">🍹</span>
                <h3 className="text-sm font-bold text-pink-300">Happy Hour</h3>
              </div>
              <p className="mb-2 text-xs text-white/60">Mua 1 tặng 1 cocktail. 18h - 20h mỗi ngày!</p>
              <p className="text-lg font-bold text-pink-400">60.000đ/ly</p>
            </div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">🎂</span>
                <h3 className="text-sm font-bold text-cyan-300">Sinh nhật</h3>
              </div>
              <p className="mb-2 text-xs text-white/60">Đặt tiệc sinh nhật với combo đặc biệt. Liên hệ quán!</p>
              <div className="flex gap-2">
                <span className="rounded-lg bg-cyan-600/20 px-2 py-1 text-[10px] text-cyan-300">📞 0909.xxx.xxx</span>
                <span className="rounded-lg bg-cyan-600/20 px-2 py-1 text-[10px] text-cyan-300">💬 Messenger</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
