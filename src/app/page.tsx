'use client';

import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CameraRig, { FOCUS_MS, type CameraPose } from '@/components/game/CameraRig';
import { useGame } from '@/hooks/useGame';
import { usePlayerControls } from '@/hooks/usePlayerControls';
import BarScene, { STAGE_SLOTS } from '@/components/game/BarScene';
import ChatPanel from '@/components/ui/ChatPanel';
import MusicPlayer, { extractYouTubeId } from '@/components/ui/MusicPlayer';
import ControlDesk from '@/components/ui/ControlDesk';
import TikTokPanel from '@/components/ui/TikTokPanel';
import GiftRules from '@/components/ui/GiftRules';
import ActionBar from '@/components/ui/ActionBar';
import DrinkMenu from '@/components/ui/DrinkMenu';
import CharacterShowcase, {
  SHOW_CHARACTER_SHOWCASE,
} from '@/components/avatar/CharacterShowcase';
import StressTest, {
  STRESS_TEST,
  STRESS_COUNT,
  type PerfSample,
} from '@/components/avatar/StressTest';
import FloatingReactions from '@/components/ui/FloatingReactions';
import PlayerAvatar3D from '@/components/avatar/PlayerAvatar3D';
import TikTokCrowd, {
  BAR_ORDER_MS,
  BAR_WALK_MS,
  crowdLive,
} from '@/components/avatar/TikTokCrowd';
import type { CameraView } from '@/types';

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

/**
 * A 9:16 frame crops horizontally, and three's `fov` is the *vertical* angle —
 * so the same pose shows a much narrower slice of the room than on desktop.
 * Pull back from the target to recover the framing, and lift the aim point so
 * the action sits above the bottom strip TikTok covers with its own UI.
 */
const OBS_PULLBACK = 2.0;

function forVertical(p: CameraPose): CameraPose {
  const [px, py, pz] = p.position;
  const [tx, ty, tz] = p.target;
  return {
    position: [
      tx + (px - tx) * OBS_PULLBACK,
      ty + (py - ty) * OBS_PULLBACK,
      tz + (pz - tz) * OBS_PULLBACK,
    ],
    target: [tx, ty + 0.9, tz],
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * The host runs two tabs: this one stays as the control desk, and creating a
 * room opens a second tab at `?room=<id>&obs=1` holding the bare scene for OBS
 * to capture.
 *
 * Suspense is required because useSearchParams opts the tree into dynamic
 * rendering; without it the statically prerendered page fails to build.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <GameView />
    </Suspense>
  );
}

function GameView() {
  const params = useSearchParams();
  const roomParam = params.get('room');
  const obsParam = params.get('obs') === '1';
  const aspectParam = params.get('aspect');
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
    setAnimation,
    createRoom,
    joinRoom,
    leaveRoom,
    roomError,
    lastJoined,
    tiktok,
    tiktokTop,
    tiktokAction,
    tiktokSkins,
    tiktokViewers,
    tiktokJumps,
    tiktokBarVisits,
    tiktokGiftIcons,
    tiktokLikes,
    tiktokGifters,
    connectTikTok,
    disconnectTikTok,
    clearTikTokAction,
  } = game;

  // UI panels
  const [activePanel, setActivePanel] = useState<'music' | 'menu' | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  // On by default: the room exists to be broadcast, and a fixed camera with
  // nobody at the keyboard to change it makes for a dull stream.
  const [cinematic, setCinematic] = useState(true);
  const [cineIndex, setCineIndex] = useState(0);
  /** User has taken the camera by hand, so no preset describes the view */
  const [freeLook, setFreeLook] = useState(false);
  const [showTikTok, setShowTikTok] = useState(false);
  /**
   * Broadcast view: bare 3D scene framed for a 1080x1920 TikTok LIVE capture.
   * Every HUD panel is hidden because TikTok draws its own comment feed, gift
   * tray and buttons over the bottom of the frame.
   */
  // Default on. The capture tab arrives with ?obs=1 anyway; this makes the
  // lobby default to the same thing so the host doesn't have to find a
  // checkbox to get the frame TikTok actually wants.
  const [obsMode, setObsMode] = useState(obsParam || !roomParam);
  /** Frame the broadcast is composed for. 'fill' just uses the window. */
  const [aspect, setAspect] = useState<'9:16' | '16:9' | 'fill'>(
    aspectParam === '16:9' || aspectParam === 'fill' ? aspectParam : '9:16',
  );
  /** This tab created the room, so it stays on the control desk */
  const [isController, setIsController] = useState(false);
  const [perf, setPerf] = useState<PerfSample | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>('diagonal');
  const [isMuted, setIsMuted] = useState(false);
  const [highlightedTable, setHighlightedTable] = useState<string | undefined>();

  // Room creation form
  const [roomName, setRoomName] = useState('');
  const [roomIsPublic, setRoomIsPublic] = useState(true);
  const [roomPassword, setRoomPassword] = useState('');
  /**
   * Songs picked in the lobby, before a room exists to hold them. The music
   * queue lives on the server, so these are kept here and pushed across once
   * the room is confirmed.
   */
  const [pendingTracks, setPendingTracks] = useState<
    { youtubeId: string; title: string }[]
  >([]);
  const [trackUrl, setTrackUrl] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [trackError, setTrackError] = useState('');
  /** Channel to auto-link once the host's room exists */
  const [tiktokUser, setTiktokUser] = useState('');
  /** Host pressed Connect in the lobby; the link is made when a room exists */
  const [tiktokArmed, setTiktokArmed] = useState(false);

  // Player controls
  const { handleFloorClick } = usePlayerControls({
    currentPosition: myPlayer?.position ?? null,
    onMove: movePlayer,
  });

  // Views the cinematic mode drifts between — eye-level shots only.
  // 'top-down' and 'full-club' both sit 25-30 units overhead and read as a
  // floor plan rather than a camera move. 'follow-me' is excluded because it
  // tracks the player instead of being a fixed vantage point.
  // 'dance-floor' leads because it is the centred shot the camera comes home
  // to after a gift: front-on to the stage with the crowd filling the frame.
  const CINEMATIC_VIEWS: CameraView[] = ['dance-floor', 'diagonal', 'screen', 'bar'];

  const pose = useMemo<CameraPose>(() => {
    // Auto-pan outranks the selected view. Checking 'follow-me' first meant
    // that whenever "Tôi" happened to be the active chip the camera stayed
    // locked on the player and the auto-pan never got a look in.
    if (cinematic) {
      return CAMERA_PRESETS[CINEMATIC_VIEWS[cineIndex % CINEMATIC_VIEWS.length]];
    }
    // Following zooms right in and tracks the player, so the pose is derived
    // from their live position rather than a fixed preset.
    if (cameraView === 'follow-me' && myPlayer) {
      const { x, z } = myPlayer.position;
      return { position: [x + 2.4, 2.7, z + 4.4], target: [x, 1.1, z] };
    }
    return CAMERA_PRESETS[cameraView];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraView, cinematic, cineIndex, myPlayer?.position.x, myPlayer?.position.z]);

  // Only the tall frame needs the pull-back; 16:9 already matches the presets
  const framedPose = useMemo(
    () => (obsMode && aspect === '9:16' ? forVertical(pose) : pose),
    [obsMode, aspect, pose],
  );

  // Any gift points the camera at whoever sent it. Checking only the top 3
  // meant most gifters were never found, so nothing moved.
  const giftFocusPose = useMemo<CameraPose | null>(() => {
    if (!tiktokAction) return null;

    const rank = tiktokTop.findIndex((g) => g.userId === tiktokAction.userId);
    if (rank >= 0 && tiktokAction.kind !== 'bar') {
      const [sx, sy, sz] = STAGE_SLOTS[rank].pos;
      // Slots are local to the stage group, which sits at z = -12
      const z = sz - 12;
      return { position: [sx + 1.8, sy + 1.6, z + 4.2], target: [sx, sy + 0.9, z] };
    }

    // Not on stage — find them in the crowd on the floor
    const viewer = tiktokViewers.find((v) => v.userId === tiktokAction.userId);
    if (!viewer) return null;
    const { x, z } = viewer.position;
    return { position: [x + 2.2, 2.6, z + 4.0], target: [x, 1.1, z] };
  }, [tiktokAction, tiktokTop, tiktokViewers]);

  // Only a gift takes the camera. Arrivals announce themselves by dropping in
  // from the ceiling, which reads fine in a wide shot — cutting to each one
  // meant a busy LIVE never settled on anything long enough to watch.
  const focusPose = giftFocusPose;
  // A rose walks the gifter to the bar, so the camera tracks them live and
  // holds until they have arrived and ordered.
  const barFocus = tiktokAction?.kind === 'bar' && !!giftFocusPose;
  const focusMs = barFocus ? BAR_WALK_MS + BAR_ORDER_MS : FOCUS_MS;
  const focusFollow = useMemo(() => {
    if (!barFocus || !tiktokAction) return null;
    const id = tiktokAction.userId;
    return (): CameraPose | null => {
      const p = crowdLive.get(id);
      if (!p) return null;
      return { position: [p.x + 2.2, 2.6, p.z + 4.0], target: [p.x, 1.1, p.z] };
    };
  }, [barFocus, tiktokAction]);
  const focusKey = useMemo(
    () =>
      tiktokAction && giftFocusPose
        ? `gift:${tiktokAction.userId}:${tiktokAction.at}`
        : null,
    [tiktokAction, giftFocusPose],
  );
  const playerList = useMemo(() => Object.values(players), [players]);
  const isDancing = myPlayer?.animation === 'dancing';
  /** A track is actually sounding — not just queued and paused */
  const musicPlaying = isPlaying && !!musicQueue[currentSongIndex];

  // The capture tab lands on ?room=<id> and joins by itself
  const joinedFromUrl = useRef(false);
  useEffect(() => {
    if (!roomParam || !connected || room || joinedFromUrl.current) return;
    joinedFromUrl.current = true;
    joinRoom(roomParam);
  }, [roomParam, connected, room, joinRoom]);

  // Creating a room hands the scene to a second tab and keeps this one as the
  // control desk. It waits for TikTok to be live: the channel can only be
  // linked once a room exists, so the order is create -> connect -> open. An
  // empty room on screen before the viewers can reach it is not worth showing.
  const openedSceneFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isController || !room || openedSceneFor.current === room.id) return;
    if (!tiktok?.connected) return;
    openedSceneFor.current = room.id;
    const url = `/?room=${room.id}&obs=1&aspect=${encodeURIComponent(aspect)}`;
    window.open(url, '_blank', 'noopener');
  }, [isController, room, aspect, tiktok?.connected]);

  // Hand the lobby playlist over to the room. The ref pins it to one run per
  // room, so a song added later from the control desk can't replay the list.
  const flushedTracksFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isController || !room || flushedTracksFor.current === room.id) return;
    flushedTracksFor.current = room.id;
    for (const t of pendingTracks) queueMusic(t.youtubeId, t.title);
  }, [isController, room, pendingTracks, queueMusic]);

  // Link the channel saved in the lobby once the host's room exists. Guarded
  // by a ref so a re-render can't fire a second connect for the same room.
  const tiktokLinkedForRoom = useRef<string | null>(null);
  useEffect(() => {
    if (!room || !localPlayerId || room.hostId !== localPlayerId) return;
    if (!tiktokArmed || !tiktokUser.trim()) return;
    if (tiktokLinkedForRoom.current === room.id) return;
    tiktokLinkedForRoom.current = room.id;
    connectTikTok(tiktokUser.trim());
  }, [room, localPlayerId, tiktokArmed, tiktokUser, connectTikTok]);

  // A gift holds the camera for FOCUS_MS, then it comes home to the centred
  // shot and the auto-pan picks up again. Clearing tiktokAction is what
  // actually releases it — otherwise focusPose stays derivable from the last
  // gift and the view sits on that person indefinitely.
  const cineLength = CINEMATIC_VIEWS.length;
  useEffect(() => {
    if (!focusKey) return;
    const id = setTimeout(() => {
      clearTikTokAction();
      setCinematic(true);
      setFreeLook(false);
      // Round up to the next start of the cycle, which is the centred shot
      setCineIndex((i) => Math.ceil(i / cineLength) * cineLength);
    }, focusMs + 800);
    return () => clearTimeout(id);
  }, [focusKey, focusMs, cineLength, clearTikTokAction]);

  // Cinematic auto-pan. The state update lives in the interval callback, not
  // in the effect body, so it doesn't cascade renders on mount.
  useEffect(() => {
    if (!cinematic) return;
    const id = setInterval(() => setCineIndex((i) => i + 1), 9000);
    return () => clearInterval(id);
  }, [cinematic]);

  // ---- Handlers -----------------------------------------------------------

  const handleCreateRoom = useCallback(() => {
    if (!roomName.trim()) return;
    setIsController(true);
    createRoom({
      name: roomName.trim(),
      maxCapacity: 10,
      isPublic: roomIsPublic,
      password: roomIsPublic ? undefined : roomPassword || undefined,
    });
    setRoomName('');
    setRoomPassword('');
  }, [roomName, roomIsPublic, roomPassword, createRoom]);

  const handleAddPendingTrack = useCallback(() => {
    const id = extractYouTubeId(trackUrl.trim());
    if (!id) {
      setTrackError('Link YouTube không hợp lệ');
      return;
    }
    if (!trackTitle.trim()) {
      setTrackError('Nhập tên bài hát');
      return;
    }
    setTrackError('');
    setPendingTracks((prev) => [...prev, { youtubeId: id, title: trackTitle.trim() }]);
    setTrackUrl('');
    setTrackTitle('');
  }, [trackUrl, trackTitle]);

  const handleCopyInvite = useCallback(() => {
    if (!room) return;
    navigator.clipboard.writeText(room.id);
  }, [room]);

  const togglePanel = useCallback((panel: 'music' | 'menu') => {
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

  // A room without a channel behind it has no audience, so the button waits
  // for one. The link itself can only be made after the room exists.
  const canCreate =
    connected && !!roomName.trim() && tiktokArmed && !!tiktokUser.trim();

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
  // STEP 1: Lobby — the character modal opens on top of it when joining
  // =========================================================================

  if (!room) {
    return (
      <>
      <div className="min-h-screen bg-[#0b0b0f] px-5 py-10 text-zinc-100">
        <div className="mx-auto w-full max-w-4xl">

          {/* Masthead */}
          <header className="mb-8 flex items-end justify-between border-b border-white/[0.07] pb-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-500/70">
                Phòng nhạc trực tuyến
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
                Bar Online
              </h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-xs text-zinc-400">
                {connected ? 'Đã kết nối' : 'Đang kết nối'}
              </span>
            </div>
          </header>

          {roomError && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-sm text-red-300">
              {roomError}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-5">

            {/* ---- Playlist, staged until the room exists ---- */}
            <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 md:col-span-5">
              <h2 className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Nhạc mở đầu
                {pendingTracks.length > 0 && (
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tracking-normal text-zinc-400">
                    {pendingTracks.length} bài
                  </span>
                )}
              </h2>
              <p className="mb-4 text-xs leading-relaxed text-zinc-600">
                Chọn trước, nhạc sẽ tự vào hàng chờ và chiếu trên màn hình sân
                khấu ngay khi phòng mở.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Dán link YouTube..."
                      value={trackUrl}
                      onChange={(e) => setTrackUrl(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/60"
                    />
                    <input
                      type="text"
                      placeholder="Tên bài hát"
                      value={trackTitle}
                      onChange={(e) => setTrackTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPendingTrack()}
                      className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/60"
                    />
                  </div>
                  {trackError && (
                    <p className="mt-2 text-xs text-red-400">{trackError}</p>
                  )}
                  <button
                    onClick={handleAddPendingTrack}
                    className="mt-2.5 w-full rounded-lg border border-white/[0.08] py-2.5 text-sm text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
                  >
                    Thêm vào danh sách
                  </button>
                </div>

                <div className="md:border-l md:border-white/[0.06] md:pl-5">
                  {pendingTracks.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/[0.07] px-4 py-8 text-center">
                      <p className="text-sm text-zinc-500">
                        Chưa chọn bài nào
                        <span className="mt-1 block text-xs text-zinc-600">
                          Có thể thêm sau khi tạo phòng
                        </span>
                      </p>
                    </div>
                  ) : (
                    <ol className="custom-scrollbar -mr-1 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {pendingTracks.map((t, i) => (
                        <li
                          key={`${t.youtubeId}-${i}`}
                          className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                        >
                          <span className="w-4 shrink-0 font-mono text-xs text-zinc-600">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-white">
                            {t.title}
                          </span>
                          <button
                            onClick={() =>
                              setPendingTracks((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                            aria-label={`Bỏ ${t.title}`}
                            className="shrink-0 px-1 text-xs text-zinc-600 transition hover:text-red-400"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </section>

            {/* ---- TikTok LIVE ---- */}
            <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 md:col-span-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  TikTok LIVE
                </h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      tiktok?.connected
                        ? 'bg-emerald-400'
                        : tiktok?.connecting || tiktokArmed
                          ? 'bg-amber-400'
                          : 'bg-zinc-700'
                    }`}
                  />
                  <span className="text-xs text-zinc-500">
                    {tiktok?.connected
                      ? `Đang nhận từ @${tiktok.username}`
                      : tiktok?.connecting
                        ? 'Đang kết nối'
                        : tiktokArmed
                          ? 'Sẽ kết nối khi tạo phòng'
                          : 'Chưa kết nối'}
                  </span>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="@tenkenh hoặc link LIVE"
                      value={tiktokUser}
                      onChange={(e) => {
                        setTiktokUser(e.target.value);
                        // Editing the channel invalidates a previous arm
                        setTiktokArmed(false);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/60"
                    />
                    {tiktokArmed ? (
                      <button
                        onClick={() => {
                          setTiktokArmed(false);
                          tiktokLinkedForRoom.current = null;
                          disconnectTikTok();
                        }}
                        className="shrink-0 rounded-lg border border-white/[0.08] px-4 text-sm text-zinc-400 transition hover:border-red-500/40 hover:text-red-300"
                      >
                        Ngắt
                      </button>
                    ) : (
                      <button
                        onClick={() => setTiktokArmed(true)}
                        disabled={!tiktokUser.trim()}
                        className="shrink-0 rounded-lg border border-amber-500/40 px-4 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:text-zinc-600"
                      >
                        Kết nối
                      </button>
                    )}
                  </div>

                  <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">
                    Bình luận, tim và quà từ LIVE sẽ hiện trong quán. Kênh phải
                    đang phát sóng.
                  </p>

                  <label className="mt-4 flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={obsMode}
                      onChange={(e) => {
                        setObsMode(e.target.checked);
                        // A broadcast with a static camera is dull, and there
                        // is nobody on this screen to change the angle
                        if (e.target.checked) setCinematic(true);
                      }}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-amber-500"
                    />
                    <span className="text-sm text-zinc-400">
                      Chế độ phát sóng
                      <span className="mt-0.5 block text-xs leading-relaxed text-zinc-600">
                        Ẩn toàn bộ bảng điều khiển, chỉ còn khung hình cho OBS.
                        Camera tự chuyển góc.
                      </span>
                    </span>
                  </label>

                  {obsMode && (
                    <div className="mt-3 border-l-2 border-amber-500/30 pl-3">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Tỷ lệ khung hình
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ['9:16', 'Dọc 9:16', 'TikTok · 1080×1920'],
                            ['16:9', 'Ngang 16:9', 'YouTube · 1920×1080'],
                            ['fill', 'Vừa cửa sổ', 'Không ghim tỷ lệ'],
                          ] as const
                        ).map(([value, label, hint]) => (
                          <button
                            key={value}
                            onClick={() => setAspect(value)}
                            title={hint}
                            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                              aspect === value
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                                : 'border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                        {aspect === 'fill'
                          ? 'Khung hình bám theo kích thước cửa sổ trình duyệt.'
                          : `Khung được ghim đúng tỷ lệ và căn giữa, phần thừa để đen — thấy sao thì OBS bắt vậy. Đặt Browser Source ${
                              aspect === '9:16' ? '1080×1920' : '1920×1080'
                            }.`}
                      </p>
                    </div>
                  )}

                  {tiktok?.lastError && (
                    <p className="mt-2 text-xs text-red-400">{tiktok.lastError}</p>
                  )}
                </div>

                <div className="md:border-l md:border-white/[0.06] md:pl-5">
                  <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Quà tặng
                  </p>
                  <GiftRules />
                </div>
              </div>
            </section>

            {/* ---- Create room — last, because it needs everything above ---- */}
            <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-5 md:col-span-5">
              <h2 className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Mở phòng
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <input
                    type="text"
                    placeholder="Tên phòng"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && canCreate && handleCreateRoom()}
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/60"
                  />

                  <label className="mt-3 flex w-fit cursor-pointer items-center gap-2.5 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={roomIsPublic}
                      onChange={(e) => setRoomIsPublic(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-amber-500"
                    />
                    Hiện trong danh sách công khai
                  </label>

                  {!roomIsPublic && (
                    <input
                      type="text"
                      placeholder="Mật khẩu (tuỳ chọn)"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      className="mt-3 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-500/60"
                    />
                  )}
                </div>

                <div className="md:border-l md:border-white/[0.06] md:pl-5">
                  {/* The channel is linked after the room exists, so the
                      checklist tracks what is ready rather than what is done */}
                  <ol className="space-y-2">
                    {(
                      [
                        [connected, 'Máy chủ sẵn sàng'],
                        [!!roomName.trim(), 'Đã đặt tên phòng'],
                        [tiktokArmed && !!tiktokUser.trim(), 'Đã chọn kênh TikTok LIVE'],
                      ] as const
                    ).map(([ok, label]) => (
                      <li key={label} className="flex items-center gap-2.5 text-sm">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                            ok
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/[0.06] text-zinc-600'
                          }`}
                        >
                          {ok ? '✓' : '·'}
                        </span>
                        <span className={ok ? 'text-zinc-300' : 'text-zinc-600'}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <button
                    onClick={() => handleCreateRoom()}
                    disabled={!canCreate}
                    className="mt-4 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-zinc-600"
                  >
                    Tạo phòng &amp; lên sóng
                  </button>
                  <p className="mt-2.5 text-xs leading-relaxed text-zinc-600">
                    Phòng mở trước, nối kênh TikTok, rồi khung hình mới bật ở
                    tab mới. Tab này ở lại làm bàn điều khiển.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      </>
    );
  }

  // =========================================================================
  // STEP 2: Control desk — the tab that opened the room
  // =========================================================================

  // The scene went to a second tab, so this one shows the session instead of
  // a canvas. Everything here talks to the same room over its own socket.
  if (isController) {
    return (
      <ControlDesk
        roomId={room.id}
        roomName={room.name}
        sceneUrl={`/?room=${room.id}&obs=1&aspect=${encodeURIComponent(aspect)}`}
        tiktok={tiktok}
        topGifters={tiktokTop}
        viewerCount={tiktokViewers.length}
        musicQueue={musicQueue}
        currentIndex={currentSongIndex}
        isPlaying={isPlaying}
        onAddTrack={queueMusic}
        onSkip={skipMusic}
        onPlayPause={playPauseMusic}
        onLeave={() => {
          setIsController(false);
          leaveRoom();
        }}
      />
    );
  }

  // =========================================================================
  // STEP 3: In-game view
  // =========================================================================

  const isHost = room.hostId === localPlayerId;
  const currentTableId = myPlayer?.tableId ?? undefined;

  return (
    <div
      className={`relative h-screen w-full overflow-hidden ${
        obsMode ? 'bg-black' : 'bg-gray-950'
      }`}
    >
      {/* In broadcast mode the canvas is pinned to the target aspect and
          letterboxed, so what you see here is exactly what OBS captures. */}
      <div
        className={
          obsMode && aspect !== 'fill'
            ? `mx-auto h-full ${aspect === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`
            : 'h-full w-full'
        }
      >
      <BarScene
        tables={barTables}
        onTableClick={handleTableClick}
        highlightedTable={highlightedTable}
        onFloorClick={handleFloorClick}
        tiktokTop={tiktokTop}
        tiktokSkins={tiktokSkins}
        stageVideo={musicQueue[currentSongIndex] ?? null}
        isPlaying={isPlaying}
        isMuted={isMuted}
        onVideoEnd={skipMusic}
      >
        {STRESS_TEST ? (
          <StressTest onSample={setPerf} />
        ) : (
          SHOW_CHARACTER_SHOWCASE && <CharacterShowcase />
        )}

        {/* Player avatars */}
        <TikTokCrowd
          viewers={tiktokViewers}
          skins={tiktokSkins}
          jumps={tiktokJumps}
          barVisits={tiktokBarVisits}
          likes={tiktokLikes}
          gifters={tiktokGifters}
        />

        {/* The host is the streamer, not a guest — they run the room from
            outside it and get no character on the floor. The capture tab is
            a second socket in the same room, so it hides its own avatar too
            or the broadcast shows a phantom guest nobody is driving. */}
        {playerList
          .filter((p) => p.id !== room.hostId && !(obsMode && p.id === localPlayerId))
          .map((p) => (
            <PlayerAvatar3D
              key={p.id}
              player={p}
              isLocal={p.id === localPlayerId}
              musicPlaying={musicPlaying}
              dropInAt={lastJoined?.id === p.id ? lastJoined.at : undefined}
            />
          ))}
        <CameraRig
          pose={framedPose}
          freeLook={freeLook}
          focusPose={focusPose}
          focusKey={focusKey}
          focusMs={focusMs}
          focusFollow={focusFollow}
          // Cinematic glides; a deliberate view change should feel responsive
          smoothing={cinematic ? 0.7 : 2.4}
          // A gift overrides a hand-held camera, so free-look has to go with
          // it — left on, the rig bails out the moment the hold ends and the
          // camera never leaves the person who sent the gift.
          onFocusStart={() => setFreeLook(false)}
          onUserInteract={() => {
            setCinematic(false);
            setFreeLook(true);
          }}
        />
      </BarScene>
      </div>

      {/* Top HUD */}
      {!obsMode && (
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
          {isHost && (
            <button
              onClick={() => setShowTikTok((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-sm backdrop-blur transition ${
                tiktok?.connected
                  ? 'border-pink-500 bg-pink-500/20 text-pink-200'
                  : 'border-gray-800 bg-gray-900/80 text-white hover:bg-gray-800'
              }`}
            >
              🎵 TikTok
            </button>
          )}
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
      )}

      {!obsMode && isHost && showTikTok && (
        <div className="absolute right-4 top-16 z-40">
          <TikTokPanel
            status={tiktok}
            onConnect={connectTikTok}
            onDisconnect={disconnectTikTok}
            onClose={() => setShowTikTok(false)}
            giftIcons={tiktokGiftIcons}
          />
        </div>
      )}

      {/* Chat — always on screen, bottom-left, collapsible */}
      {!obsMode && (
      <div className="absolute bottom-3 left-3 z-40 hidden w-80 lg:block">
        {chatCollapsed ? (
          <button
            onClick={() => setChatCollapsed(false)}
            className="rounded-xl border border-white/10 bg-gray-950/85 px-4 py-2 text-sm text-white/80 backdrop-blur-xl transition hover:bg-white/10"
          >
            💬 Trò chuyện
          </button>
        ) : (
          <div className="relative h-[26rem]">
            <button
              onClick={() => setChatCollapsed(true)}
              className="absolute right-3 top-2.5 z-10 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Thu gọn
            </button>
            <ChatPanel
              messages={messages}
              onSend={(text, scope) => sendMessage(text, scope, currentTableId)}
              onReaction={addReaction}
              players={playerList}
              currentTableId={currentTableId}
            />
          </div>
        )}
      </div>
      )}

      {!obsMode && activePanel === 'music' && (
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

      {!obsMode && activePanel === 'menu' && (
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

      {/* Load-test readout */}
      {!obsMode && STRESS_TEST && (
        <div className="absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-xl border border-amber-400/30 bg-gray-950/90 px-4 py-2 font-mono text-xs text-amber-200 backdrop-blur">
          <span className="font-semibold">STRESS {STRESS_COUNT}</span>
          {perf ? (
            <>
              <span className="ml-3">{perf.fps.toFixed(1)} fps</span>
              <span className="ml-3">{perf.calls} draw calls</span>
              <span className="ml-3">{perf.triangles.toLocaleString()} tris</span>
              <span className="ml-3">{perf.textures} tex</span>
              <span className="ml-3">{perf.programs} shaders</span>
            </>
          ) : (
            <span className="ml-3 text-white/40">đang đo…</span>
          )}
        </div>
      )}

      {/* Floating reactions */}
      <FloatingReactions reactions={reactions} />

      {/* Action bar */}
      {!obsMode && (
      <ActionBar
        onReact={addReaction}
        isDancing={isDancing}
        onToggleDance={() => setAnimation(isDancing ? 'idle' : 'dancing')}
        onOpenMusic={() => togglePanel('music')}
        onTip={() => addReaction('cheers')}
        onOpenMenu={() => {
          getDrinkMenu();
          togglePanel('menu');
        }}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        currentCamera={cameraView}
        onChangeCamera={(v) => {
          // Picking a view by hand always wins over the auto-pan, and hands
          // control back to the rig
          setCinematic(false);
          setFreeLook(false);
          setCameraView(v);
        }}
        cinematic={cinematic}
        freeLook={freeLook}
        onToggleCinematic={() => {
          setFreeLook(false);
          // Step to the next shot on enable, otherwise the first view may
          // equal the current one and nothing moves until the 9s tick
          setCineIndex((i) => i + 1);
          setCinematic((c) => !c);
        }}
      />
      )}
    </div>
  );
}
