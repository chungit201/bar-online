// Bridge between a TikTok LIVE stream and a bar room.
//
// One connection per room: the host links their channel, and viewer activity
// (comments, likes, gifts, follows) is turned into in-room events so the bar
// reacts to the live audience.

import fs from 'node:fs';
import path from 'node:path';
import type { TikTokLiveConnection } from 'tiktok-live-connector';
import type { TikTokStatus } from '../src/types';

// Loaded lazily through dynamic import on purpose.
//
// tiktok-live-connector pulls in tiktok-live-proto/v3, whose package exports
// map only defines "browser" and "import" conditions — there is no "require".
// tsx runs this server as CommonJS, so a static import resolves through
// require() and dies with ERR_PACKAGE_PATH_NOT_EXPORTED. import() goes through
// the ESM resolver, where the subpath does exist.
type Connector = typeof import('tiktok-live-connector');
let connectorPromise: Promise<Connector> | null = null;

function loadConnector(): Promise<Connector> {
  if (!connectorPromise) connectorPromise = import('tiktok-live-connector');
  return connectorPromise;
}

export interface TikTokHandlers {
  onStatus: (status: TikTokStatus) => void;
  onChat: (data: { userId: string; nickname: string; avatarUrl: string; comment: string }) => void;
  onLike: (data: { userId: string; nickname: string; avatarUrl: string; count: number }) => void;
  onGift: (data: {
    userId: string;
    nickname: string;
    avatarUrl: string;
    giftName: string;
    count: number;
    diamonds: number;
  }) => void;
  onSocial: (data: { nickname: string; kind: 'follow' | 'share' }) => void;
  onMember: (data: { userId: string; nickname: string; avatarUrl: string }) => void;
}

// Back off progressively; TikTok throttles clients that hammer reconnects.
const RECONNECT_DELAYS_MS = [5000, 10000, 20000, 30000, 60000];
// A combo whose repeatCount hasn't grown within this window is a resend
const GIFT_DUPLICATE_WINDOW_MS = 5000;
const CONNECT_TIMEOUT_MS = 25000;
const MAX_TRACKED = 500;

/**
 * EulerStream signing key. tiktok-live-connector needs a signed handshake to
 * open the webcast WebSocket; without a key you share a heavily rate-limited
 * public pool, which surfaces as "Timed out whilst connecting to WebSocket"
 * rather than an explicit quota error.
 *
 * Read from the environment, falling back to .env since `tsx server/index.ts`
 * does not load it the way Next does.
 */
function readSignApiKey(): string | undefined {
  const fromEnv = process.env.SIGN_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  try {
    const envPath = path.join(process.cwd(), '.env');
    const line = fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('SIGN_API_KEY='));
    const value = line?.slice('SIGN_API_KEY='.length).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

/** Accepts "@name", a profile URL, or a bare username */
export function normalizeUsername(input: string): string {
  const raw = String(input ?? '').trim();
  const fromUrl = raw.match(/tiktok\.com\/@([\w.\-]+)/i);
  const name = fromUrl ? fromUrl[1] : raw.replace(/^@/, '');
  // TikTok usernames are case-insensitive; lowercase keeps room keys stable
  return name.trim().toLowerCase();
}

/**
 * TikTok sends several messages for one gift combo (repeatCount 1, 2, 3… then
 * a repeatEnd message) and sometimes resends them. Counting every message
 * would multiply a single gift into many, so only the increase counts.
 */
function createGiftCounter() {
  const combos = new Map<string, { count: number; at: number }>();
  const seenMsgIds = new Set<string>();

  return function countNew(giftId: string, repeatCount: number, msgId?: string): number {
    if (msgId) {
      if (seenMsgIds.has(msgId)) return 0;
      seenMsgIds.add(msgId);
      if (seenMsgIds.size > MAX_TRACKED) {
        seenMsgIds.delete(seenMsgIds.values().next().value as string);
      }
    }

    const count = Math.max(1, Math.floor(Number(repeatCount)) || 1);
    const prev = combos.get(giftId);
    const sameCombo =
      prev && (count > prev.count || Date.now() - prev.at < GIFT_DUPLICATE_WINDOW_MS);
    const prevCount = sameCombo ? prev!.count : 0;

    combos.set(giftId, { count: Math.max(count, prevCount), at: Date.now() });
    if (combos.size > MAX_TRACKED) combos.delete(combos.keys().next().value as string);

    return Math.max(0, count - prevCount);
  };
}

interface RoomLink {
  connection: TikTokLiveConnection | null;
  status: TikTokStatus;
  handlers: TikTokHandlers;
  attempt: number;
  reconnectTimer: NodeJS.Timeout | null;
  /** Bumped on every connect/disconnect so stale callbacks can be ignored */
  generation: number;
  closing: boolean;
}

function blankStatus(username = ''): TikTokStatus {
  return {
    connected: false,
    connecting: false,
    username,
    viewerCount: 0,
    likeCount: 0,
    lastError: null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nick(data: any): string {
  return data?.user?.nickname || data?.user?.uniqueId || data?.nickname || data?.uniqueId || 'Khách';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function userId(data: any): string {
  return String(data?.user?.uniqueId || data?.user?.displayId || nick(data));
}

/** Avatar lives under a few different keys depending on the message type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function avatar(data: any): string {
  const u = data?.user;
  return String(
    u?.avatarThumb?.urlList?.[0] ||
      u?.avatarMedium?.urlList?.[0] ||
      u?.avatarLarge?.urlList?.[0] ||
      u?.profilePictureUrl ||
      '',
  );
}

export function createTikTokBridge() {
  const links = new Map<string, RoomLink>();

  function publish(link: RoomLink, patch: Partial<TikTokStatus>) {
    link.status = { ...link.status, ...patch };
    link.handlers.onStatus(link.status);
  }

  function teardown(link: RoomLink) {
    if (link.reconnectTimer) {
      clearTimeout(link.reconnectTimer);
      link.reconnectTimer = null;
    }
    const conn = link.connection;
    link.connection = null;
    if (conn) {
      try {
        void conn.disconnect();
      } catch {
        /* already gone */
      }
    }
  }

  function scheduleReconnect(roomId: string, link: RoomLink) {
    if (link.closing) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(link.attempt, RECONNECT_DELAYS_MS.length - 1)];
    link.attempt += 1;
    link.reconnectTimer = setTimeout(() => {
      link.reconnectTimer = null;
      void open(roomId, link.status.username, link.handlers);
    }, delay);
  }

  function attach(
    roomId: string,
    link: RoomLink,
    conn: TikTokLiveConnection,
    { WebcastEvent, ControlEvent }: Connector,
  ) {
    const gen = link.generation;
    const current = () => links.get(roomId) === link && link.generation === gen;
    const countGift = createGiftCounter();

    conn.on(WebcastEvent.CHAT, (data) => {
      if (!current()) return;
      // v3 of the proto calls this `content`; older docs say `comment`
      const comment = String(data?.content ?? '').trim();
      if (comment) {
        link.handlers.onChat({
          userId: userId(data),
          nickname: nick(data),
          avatarUrl: avatar(data),
          comment,
        });
      }
    });

    conn.on(WebcastEvent.LIKE, (data) => {
      if (!current()) return;
      const count = Math.max(1, Number(data?.count) || 1);
      // `total` is the room's running like count. Summing `count` ourselves
      // only tallies likes seen since we connected, so it under-reports and
      // resets to zero on every reconnect.
      const roomTotal = Number(data?.total) || 0;
      publish(link, {
        likeCount: roomTotal > 0 ? roomTotal : link.status.likeCount + count,
      });
      link.handlers.onLike({
        userId: userId(data),
        nickname: nick(data),
        avatarUrl: avatar(data),
        count,
      });
    });

    conn.on(WebcastEvent.GIFT, (data) => {
      if (!current()) return;
      const giftId = String(data?.groupId || data?.giftId || data?.gift?.id || 'gift');
      const fresh = countGift(giftId, Number(data?.repeatCount) || 1, data?.common?.msgId);
      if (fresh <= 0) return;
      link.handlers.onGift({
        userId: userId(data),
        avatarUrl: avatar(data),
        nickname: nick(data),
        giftName: String(data?.gift?.name || 'Quà'),
        count: fresh,
        diamonds: Number(data?.gift?.diamondCount || 0) * fresh,
      });
    });

    conn.on(WebcastEvent.FOLLOW, (data) => {
      if (current()) link.handlers.onSocial({ nickname: nick(data), kind: 'follow' });
    });
    conn.on(WebcastEvent.SHARE, (data) => {
      if (current()) link.handlers.onSocial({ nickname: nick(data), kind: 'share' });
    });
    conn.on(WebcastEvent.MEMBER, (data) => {
      // action 1 = JOINED. Other values (e.g. SUBSCRIBED) are not arrivals,
      // and counting them would put people on the floor twice.
      if (Number(data?.action) !== 1) return;
      if (current()) {
        link.handlers.onMember({
          userId: userId(data),
          nickname: nick(data),
          avatarUrl: avatar(data),
        });
      }
    });

    conn.on(WebcastEvent.ROOM_USER, (data) => {
      if (!current()) return;
      // `total` is the concurrent viewer count. `totalUser` is the cumulative
      // number of people who ever entered the session, which reads as a wildly
      // inflated audience — thousands while a handful are actually watching.
      const viewers = Number(data?.total) || 0;
      // Drop zeroes rather than flashing an empty room on a malformed message
      if (viewers > 0) publish(link, { viewerCount: viewers });
    });

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (!current()) return;
      publish(link, { connected: false, connecting: false });
      scheduleReconnect(roomId, link);
    });

    // STREAM_END lives on WebcastEvent, not ControlEvent
    conn.on(WebcastEvent.STREAM_END, () => {
      if (!current()) return;
      publish(link, { connected: false, connecting: false, lastError: 'Phiên LIVE đã kết thúc' });
    });

    conn.on(ControlEvent.ERROR, (err: unknown) => {
      if (!current()) return;
      publish(link, { lastError: err instanceof Error ? err.message : String(err) });
    });
  }

  async function open(roomId: string, username: string, handlers: TikTokHandlers) {
    const channel = normalizeUsername(username);
    if (!channel) {
      handlers.onStatus({ ...blankStatus(), lastError: 'Tên kênh không hợp lệ' });
      return;
    }

    let link = links.get(roomId);
    if (!link) {
      link = {
        connection: null,
        status: blankStatus(channel),
        handlers,
        attempt: 0,
        reconnectTimer: null,
        generation: 0,
        closing: false,
      };
      links.set(roomId, link);
    }

    link.handlers = handlers;
    link.closing = false;
    link.generation += 1;
    teardown(link);
    publish(link, { username: channel, connecting: true, connected: false, lastError: null });

    let connector: Connector;
    try {
      connector = await loadConnector();
    } catch (err) {
      publish(link, {
        connecting: false,
        lastError: err instanceof Error ? err.message : 'Không nạp được thư viện TikTok',
      });
      return;
    }
    if (links.get(roomId) !== link) return;

    // processInitialData false: TikTok replays recent messages on connect, and
    // without this every reconnect would re-fire old comments and gifts.
    //
    // fetchRoomInfoOnConnect true costs one extra request but makes an offline
    // channel fail with a clear UserOfflineError. With it off, connecting to a
    // channel that isn't live just hangs until the WebSocket times out, which
    // is indistinguishable from a signing problem.
    const conn = new connector.TikTokLiveConnection(channel, {
      processInitialData: false,
      fetchRoomInfoOnConnect: true,
      enableExtendedGiftInfo: false,
      signApiKey: readSignApiKey(),
    });
    link.connection = conn;
    attach(roomId, link, conn, connector);

    try {
      // The library can sit on an unresolved WebSocket handshake, which left
      // the UI stuck on "connecting" with nothing to show the user.
      await Promise.race([
        conn.connect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Quá thời gian kết nối — kiểm tra kênh đã LIVE và SIGN_API_KEY')),
            CONNECT_TIMEOUT_MS,
          ),
        ),
      ]);
      if (links.get(roomId) !== link) return;
      link.attempt = 0;
      publish(link, { connected: true, connecting: false, lastError: null });
    } catch (err) {
      if (links.get(roomId) !== link) return;
      publish(link, {
        connected: false,
        connecting: false,
        lastError:
          err instanceof Error
            ? err.message
            : 'Không kết nối được — kiểm tra kênh đã bật LIVE chưa',
      });
      scheduleReconnect(roomId, link);
    }
  }

  return {
    connect(roomId: string, username: string, handlers: TikTokHandlers) {
      void open(roomId, username, handlers);
    },

    disconnect(roomId: string) {
      const link = links.get(roomId);
      if (!link) return;
      link.closing = true;
      link.generation += 1;
      teardown(link);
      publish(link, { connected: false, connecting: false });
      links.delete(roomId);
    },

    getStatus(roomId: string): TikTokStatus {
      return links.get(roomId)?.status ?? blankStatus();
    },
  };
}
