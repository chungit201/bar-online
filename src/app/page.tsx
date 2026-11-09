'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useGame } from '@/hooks/useGame';
import { usePlayerControls } from '@/hooks/usePlayerControls';
import BarScene from '@/components/game/BarScene';
import ChatPanel from '@/components/ui/ChatPanel';
import MusicPlayer from '@/components/ui/MusicPlayer';
import ActionBar from '@/components/ui/ActionBar';
import DrinkMenu from '@/components/ui/DrinkMenu';
import AvatarBuilder from '@/components/avatar/AvatarBuilder';
import FloatingReactions from '@/components/ui/FloatingReactions';
import PlayerAvatar3D from '@/components/avatar/PlayerAvatar3D';
import type { AvatarConfig, CameraView } from '@/types';

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------

const CAMERA_PRESETS: Record<CameraView, { position: [number, number, number]; target: [number, number, number] }> = {
  diagonal: { position: [14, 12, 16], target: [0, 0, 0] },
  'full-club': { position: [0, 25, 0.1], target: [0, 0, 0] },
  'dance-floor': { position: [0, 8, 8], target: [0, 0, 0] },
  bar: { position: [-14, 5, -2], target: [-17, 1, -6] },
  screen: { position: [0, 5, -4], target: [0, 3, -13] },
  'top-down': { position: [0, 30, 0.1], target: [0, 0, 0] },
  'follow-me': { position: [0, 8, 8], target: [0, 0, 0] },
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function GamePage() {
  const game = useGame();
  const {
    room,
    players,
    messages,
    musicQueue,
    currentSongIndex,
    isPlaying,
    myPlayer,
    connected,
    localPlayerId,
    availableRooms,
    drinkMenu,
    reactions,
    sendMessage,
    addReaction,
    queueMusic,
    skipMusic,
    playPauseMusic,
    orderDrink,
    getDrinkMenu,
    sitAtTable,
    leaveTable,
    movePlayer,
    createRoom,
    joinRoom,
    leaveRoom,
    setProfile: sendProfile,
    roomError,
  } = game;

  // UI panels
  const [activePanel, setActivePanel] = useState<'chat' | 'music' | 'menu' | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>('diagonal');
  const [isMuted, setIsMuted] = useState(false);
  const [highlightedTable, setHighlightedTable] = useState<string | undefined>();

  // Flow state
  const [ageVerified, setAgeVerified] = useState(false);
  const [profile, setProfile] = useState<{ nickname: string; avatar: AvatarConfig } | null>(null);

  // Room creation form
  const [roomName, setRoomName] = useState('');
  const [roomIsPublic, setRoomIsPublic] = useState(true);
  const [roomPassword, setRoomPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Player controls
  const { handleFloorClick } = usePlayerControls({
    currentPosition: myPlayer?.position ?? null,
    onMove: movePlayer,
  });

  const cam = CAMERA_PRESETS[cameraView];
  const playerList = useMemo(() => Object.values(players), [players]);

  // Send profile to server when entering a room
  const profileSentForRoom = useRef<string | null>(null);
  useEffect(() => {
    if (room && profile && profileSentForRoom.current !== room.id) {
      profileSentForRoom.current = room.id;
      sendProfile(profile.nickname, profile.avatar);
    }
  }, [room, profile, sendProfile]);

  // ---- Handlers -----------------------------------------------------------

  const handleCreateRoom = useCallback(() => {
    if (!roomName.trim()) return;
    createRoom({
      name: roomName.trim(),
      maxCapacity: 10,
      isPublic: roomIsPublic,
      password: roomIsPublic ? undefined : roomPassword || undefined,
    });
    setRoomName('');
    setRoomPassword('');
  }, [roomName, roomIsPublic, roomPassword, createRoom]);

  const handleCopyInvite = useCallback(() => {
    if (!room) return;
    navigator.clipboard.writeText(room.id);
  }, [room]);

  const togglePanel = useCallback((panel: 'chat' | 'music' | 'menu') => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleTableClick = useCallback((tableId: string) => {
    setHighlightedTable(tableId);
    const table = room?.tables.find((t) => t.id === tableId);
    if (table) {
      const emptySeat = table.seats.find((s) => s.playerId === null);
      if (emptySeat) {
        sitAtTable(tableId, emptySeat.index);
      }
    }
  }, [room, sitAtTable]);

  // Convert tables to BarScene format
  const barTables = useMemo(() => {
    if (!room) return [];
    return room.tables.map((t) => ({
      id: t.id,
      position: [t.position.x, t.position.y, t.position.z] as [number, number, number],
      seats: t.seats.length,
    }));
  }, [room]);

  // =========================================================================
  // STEP 0: Age verification
  // =========================================================================

  if (!ageVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-neon">
          <h1 className="neon-text mb-4 text-3xl font-bold text-purple-400">Bar Online</h1>
          <p className="mb-2 text-lg text-white">Xác nhận độ tuổi</p>
          <p className="mb-6 text-sm text-gray-400">
            Bạn phải đủ 18 tuổi để sử dụng ứng dụng này
          </p>
          <button
            onClick={() => setAgeVerified(true)}
            className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition-colors hover:bg-purple-500"
          >
            Tôi đủ 18 tuổi
          </button>
          <p className="mt-4 text-xs text-gray-600">
            Bằng cách nhấn tiếp tục, bạn xác nhận rằng bạn đủ 18 tuổi
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 1: Profile creation
  // =========================================================================

  if (!profile) {
    return (
      <AvatarBuilder
        nickname=""
        onComplete={(nickname, avatar) => setProfile({ nickname, avatar })}
      />
    );
  }

  // =========================================================================
  // STEP 2: Lobby
  // =========================================================================

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-neon">
          <h1 className="neon-text mb-6 text-2xl font-bold text-purple-400">
            Chào {profile.nickname}!
          </h1>

          {/* Connection status */}
          <div className="mb-6 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-400">
              {connected ? 'Đã kết nối' : 'Đang kết nối...'}
            </span>
          </div>

          {/* Error message */}
          {roomError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-300">
              {roomError}
            </div>
          )}

          {/* Join by code */}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-white">Vào phòng bằng mã</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập mã phòng (6 ký tự)..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 font-mono text-lg tracking-widest text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={() => { if (joinCode.trim().length === 6) joinRoom(joinCode.trim()); }}
                disabled={!connected || joinCode.trim().length !== 6}
                className="rounded-lg bg-cyan-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
              >
                Vào
              </button>
            </div>
          </div>

          <div className="mb-6 border-t border-gray-800" />

          {/* Create room */}
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-white">Tạo phòng mới</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tên phòng..."
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={roomIsPublic}
                    onChange={(e) => setRoomIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-purple-500"
                  />
                  Phòng công khai
                </label>
              </div>
              {!roomIsPublic && (
                <input
                  type="text"
                  placeholder="Mật khẩu phòng (tuỳ chọn)..."
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
              )}
              <button
                onClick={handleCreateRoom}
                disabled={!connected || !roomName.trim()}
                className="w-full rounded-lg bg-purple-600 py-2 font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
              >
                Tạo phòng
              </button>
            </div>
          </div>

          {/* Available rooms */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-white">Phòng đang mở</h2>
            {availableRooms.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có phòng nào</p>
            ) : (
              <div className="custom-scrollbar max-h-60 space-y-2 overflow-y-auto">
                {availableRooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => joinRoom(r.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left transition-colors hover:bg-gray-750"
                  >
                    <div>
                      <span className="font-medium text-white">{r.name}</span>
                      <span className="ml-2 text-sm text-gray-500">bởi {r.hostName}</span>
                    </div>
                    <span className="text-sm text-gray-400">
                      {r.playerCount}/{r.maxCapacity}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 3: In-game view
  // =========================================================================

  const isHost = room.hostId === localPlayerId;
  const currentTableId = myPlayer?.tableId ?? undefined;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-950">
      {/* 3D Scene */}
      <BarScene
        tables={barTables}
        onTableClick={handleTableClick}
        highlightedTable={highlightedTable}
        onFloorClick={handleFloorClick}
        stageVideo={musicQueue[currentSongIndex] ?? null}
        isPlaying={isPlaying}
        isMuted={isMuted}
        onVideoEnd={skipMusic}
      >
        {/* Player avatars */}
        {playerList.map((p) => (
          <PlayerAvatar3D key={p.id} player={p} isLocal={p.id === localPlayerId} />
        ))}
        <OrbitControls
          target={cam.target}
          enablePan={false}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={30}
        />
      </BarScene>

      {/* Top HUD */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-4">
        {/* Room info */}
        <div className="pointer-events-auto rounded-lg border border-gray-800 bg-gray-900/80 px-4 py-2 backdrop-blur">
          <h2 className="text-sm font-semibold text-white">{room.name}</h2>
          <p className="text-xs text-gray-400">
            {playerList.length} người chơi · Mã: <span className="font-mono text-purple-400">{room.id}</span>
          </p>
        </div>

        {/* Top-right buttons */}
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={handleCopyInvite}
            className="rounded-lg border border-gray-800 bg-gray-900/80 px-3 py-2 text-sm text-white backdrop-blur transition-colors hover:bg-gray-800"
          >
            Mời bạn
          </button>
          <button
            onClick={leaveRoom}
            className="rounded-lg border border-red-800 bg-red-900/80 px-3 py-2 text-sm text-white backdrop-blur transition-colors hover:bg-red-800"
          >
            Rời phòng
          </button>
        </div>
      </div>

      {/* Panels */}
      {activePanel === 'chat' && (
        <div className="absolute bottom-16 left-4 z-40 h-[28rem] w-96">
          <ChatPanel
            messages={messages}
            onSend={(text, scope) => sendMessage(text, scope, currentTableId)}
            onReaction={addReaction}
            players={playerList}
            currentTableId={currentTableId}
          />
        </div>
      )}

      {activePanel === 'music' && (
        <div className="absolute bottom-16 right-4 z-40 w-[28rem]">
          <MusicPlayer
            queue={musicQueue}
            currentIndex={currentSongIndex}
            isPlaying={isPlaying}
            isMuted={isMuted}
            onAddTrack={queueMusic}
            onSkip={skipMusic}
            onPlayPause={playPauseMusic}
            isHost={isHost}
          />
        </div>
      )}

      {activePanel === 'menu' && (
        <div className="absolute bottom-16 left-1/2 z-40 -translate-x-1/2">
          <DrinkMenu
            tables={room.tables}
            drinks={drinkMenu}
            players={playerList}
            localPlayerId={localPlayerId}
            onSitAtTable={(tableId) => {
              const table = room.tables.find((t) => t.id === tableId);
              if (table) {
                const emptySeat = table.seats.find((s) => s.playerId === null);
                if (emptySeat) sitAtTable(tableId, emptySeat.index);
              }
            }}
            onOrderDrink={orderDrink}
            currentTableId={currentTableId}
            onLeaveTable={leaveTable}
          />
        </div>
      )}

      {/* Floating reactions */}
      <FloatingReactions reactions={reactions} />

      {/* Action bar */}
      <ActionBar
        onOpenMusic={() => togglePanel('music')}
        onOpenChat={() => togglePanel('chat')}
        onOpenMenu={() => togglePanel('menu')}
        onOpenTablePicker={() => togglePanel('menu')}
        onToggleMute={() => setIsMuted(!isMuted)}
        onTip={() => addReaction('cheers')}
        onCallWaiter={() => getDrinkMenu()}
        onRequestDJ={() => togglePanel('music')}
        isMuted={isMuted}
        onChangeCamera={setCameraView}
        currentCamera={cameraView}
      />
    </div>
  );
}
