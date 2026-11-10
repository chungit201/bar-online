import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type {
  Room,
  Player,
  ChatMessage,
  MusicTrack,
  MusicQueue,
  Table,
  Drink,
  DrinkOrder,
  RoomSummary,
  TikTokGifter,
  TikTokGiftIcons,
  TikTokViewer,
  Vec3,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../src/types';
import { createTikTokBridge } from './tiktok';

const port = parseInt(process.env.SOCKET_PORT || '3001', 10);

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const rooms = new Map<string, Room>();
const tiktok = createTikTokBridge();
/** roomId -> TikTok userId -> cumulative gift value, for the stage top 3 */
const giftLedger = new Map<string, Map<string, TikTokGifter>>();
/** roomId -> real TikTok artwork for the gifts that have a rule */
const giftIcons = new Map<string, TikTokGiftIcons>();
/** roomId -> TikTok userId -> likes sent this session */
const likeLedger = new Map<string, Map<string, { total: number; pending: number; focusedAt: number }>>();
const LIKE_FOCUS_MIN = 5;
const LIKE_FOCUS_COOLDOWN_MS = 15000;

/** Gift names vary by locale, so match loosely on the recognisable word */
function classifyGift(name: string): 'rose' | 'rosa' | 'tiktok' | null {
  const n = name.toLowerCase();
  // Rosa is a separate gift from Rose, so check it as its own word
  if (/\brosa\b/.test(n)) return 'rosa';
  if (n.includes('rose') || n.includes('hoa hồng')) return 'rose';
  if (n.includes('tiktok')) return 'tiktok';
  return null;
}

// Viewers are shown as characters on the floor. Capped so a busy LIVE can't
// drop thousands of sprites into the scene, and expired so people who stopped
// interacting eventually make room for those who are still active.
const MAX_VIEWERS = 40;
// TikTok never broadcasts a "viewer left" event — MemberMessageAction only has
// JOINED and SUBSCRIBED — so presence can only be inferred from how recently
// someone interacted. Two minutes keeps the room close to who is actually
// watching, at the cost of dropping people who sit silently.
const VIEWER_IDLE_MS = 2 * 60 * 1000;
const VIEWER_SWEEP_MS = 15 * 1000;

interface TrackedViewer extends TikTokViewer {
  lastSeen: number;
}
const viewerRegistry = new Map<string, Map<string, TrackedViewer>>();

/**
 * Record viewer activity. Returns true when the visible set changed, so the
 * caller only broadcasts on a real change rather than on every like.
 */
function touchViewer(
  roomId: string,
  userId: string,
  nickname: string,
  avatarUrl: string,
): boolean {
  let room = viewerRegistry.get(roomId);
  if (!room) {
    room = new Map();
    viewerRegistry.set(roomId, room);
  }

  const now = Date.now();
  let changed = false;

  for (const [id, v] of room) {
    if (now - v.lastSeen > VIEWER_IDLE_MS) {
      room.delete(id);
      changed = true;
    }
  }

  const existing = room.get(userId);
  if (existing) {
    existing.lastSeen = now;
    if (avatarUrl && !existing.avatarUrl) {
      existing.avatarUrl = avatarUrl;
      changed = true;
    }
    return changed;
  }

  if (room.size >= MAX_VIEWERS) {
    // Evict the least recently active so new arrivals can still show up
    let oldestId = '';
    let oldestAt = Infinity;
    for (const [id, v] of room) {
      if (v.lastSeen < oldestAt) {
        oldestAt = v.lastSeen;
        oldestId = id;
      }
    }
    if (oldestId) room.delete(oldestId);
  }

  // Spiral slots keep the crowd on the dance floor instead of scattered
  const used = new Set([...room.values()].map((v) => `${v.position.x},${v.position.z}`));
  let slot = 0;
  let pos = spawnPosition(slot);
  while (used.has(`${pos.x},${pos.z}`) && slot < MAX_VIEWERS * 2) {
    slot += 1;
    pos = spawnPosition(slot);
  }

  room.set(userId, { userId, nickname, avatarUrl, position: pos, joinedAt: now, lastSeen: now });
  return true;
}

/** Drop viewers who went quiet. Returns true when anything was removed. */
function sweepViewers(roomId: string): boolean {
  const room = viewerRegistry.get(roomId);
  if (!room) return false;
  const now = Date.now();
  let changed = false;
  for (const [id, v] of room) {
    if (now - v.lastSeen > VIEWER_IDLE_MS) {
      room.delete(id);
      changed = true;
    }
  }
  return changed;
}

function visibleViewers(roomId: string): TikTokViewer[] {
  const room = viewerRegistry.get(roomId);
  if (!room) return [];
  return [...room.values()].map(({ userId, nickname, avatarUrl, position, joinedAt }) => ({
    userId,
    nickname,
    avatarUrl,
    position,
    joinedAt,
  }));
}

function topGifters(roomId: string): TikTokGifter[] {
  const ledger = giftLedger.get(roomId);
  if (!ledger) return [];
  return [...ledger.values()].sort((a, b) => b.diamonds - a.diamonds).slice(0, 3);
}
const socketToRoom = new Map<string, string>();
const socketToPlayer = new Map<string, string>();

const defaultDrinkMenu: Drink[] = [
  { id: 'beer', name: 'Bia', price: 30000, icon: '🍺' },
  { id: 'cocktail', name: 'Cocktail', price: 60000, icon: '🍹' },
  { id: 'wine', name: 'Rượu vang', price: 80000, icon: '🍷' },
  { id: 'whiskey', name: 'Whiskey', price: 120000, icon: '🥃' },
  { id: 'water', name: 'Nước suối', price: 10000, icon: '💧' },
  { id: 'juice', name: 'Nước ép', price: 25000, icon: '🧃' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  for (const room of rooms.values()) {
    if (room.id === code) return generateRoomCode();
  }
  return code;
}

function createDefaultTables(): Table[] {
  return [
    {
      id: 'table-1',
      position: { x: -4, y: 0, z: -3 },
      seats: [
        { index: 0, playerId: null },
        { index: 1, playerId: null },
        { index: 2, playerId: null },
        { index: 3, playerId: null },
      ],
      players: [],
    },
    {
      id: 'table-2',
      position: { x: 4, y: 0, z: -3 },
      seats: [
        { index: 0, playerId: null },
        { index: 1, playerId: null },
        { index: 2, playerId: null },
        { index: 3, playerId: null },
      ],
      players: [],
    },
  ];
}

function defaultMusicQueue(): MusicQueue {
  return { tracks: [], currentIndex: -1, isPlaying: false, positionSeconds: 0 };
}

// The dance floor is a 6x6 grid centred on the origin, so it spans ±3.
// Placing arrivals on a sunflower spiral keeps the first dozen people on and
// around it, then rings outward only once the room genuinely fills up —
// random scatter made even three players look like they were avoiding each
// other, and could drop two of them on the same spot.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SPAWN_SPACING = 0.85;

function spawnPosition(index: number): Vec3 {
  const radius = SPAWN_SPACING * Math.sqrt(index);
  const angle = index * GOLDEN_ANGLE;
  return {
    x: Number((radius * Math.cos(angle)).toFixed(3)),
    y: 0,
    z: Number((radius * Math.sin(angle)).toFixed(3)),
  };
}

function getPublicRooms(): RoomSummary[] {
  const list: RoomSummary[] = [];
  for (const room of rooms.values()) {
    if (room.isPublic) {
      const host = Object.values(room.players)[0];
      list.push({
        id: room.id,
        name: room.name,
        hostName: host?.nickname ?? 'Unknown',
        playerCount: Object.keys(room.players).length,
        maxCapacity: room.maxCapacity,
        isPublic: true,
      });
    }
  }
  return list;
}

function findSocketByPlayerId(pid: string): string | undefined {
  for (const [sid, id] of socketToPlayer.entries()) {
    if (id === pid) return sid;
  }
  return undefined;
}

function removePlayerFromRoom(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socketId: string,
  roomId: string,
) {
  const room = rooms.get(roomId);
  if (!room) return;

  const playerId = socketToPlayer.get(socketId);
  if (!playerId || !room.players[playerId]) return;

  for (const table of room.tables) {
    for (const seat of table.seats) {
      if (seat.playerId === playerId) {
        seat.playerId = null;
        table.players = table.players.filter((p) => p !== playerId);
        io.to(roomId).emit('table:playerLeft', { playerId, tableId: table.id });
      }
    }
  }

  delete room.players[playerId];
  socketToRoom.delete(socketId);
  socketToPlayer.delete(socketId);

  const remaining = Object.keys(room.players);
  if (remaining.length === 0) {
    // Drop the TikTok link too, or its reconnect timer keeps a dead room alive
    tiktok.disconnect(roomId);
    giftLedger.delete(roomId);
    giftIcons.delete(roomId);
    likeLedger.delete(roomId);
    viewerRegistry.delete(roomId);
    rooms.delete(roomId);
    return;
  }

  let newHostId: string | undefined;
  if (room.hostId === playerId) {
    newHostId = remaining[0];
    room.hostId = newHostId;
  }

  io.to(roomId).emit('room:playerLeft', { playerId, newHostId });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const server = createServer();
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: '*' },
});

// Expiry has to run on a timer, not only when an event arrives: if every
// viewer goes quiet there are no events left to trigger the cleanup, and the
// crowd would stay on the floor forever.
setInterval(() => {
  for (const roomId of viewerRegistry.keys()) {
    if (sweepViewers(roomId)) {
      io.to(roomId).emit('tiktok:viewers', visibleViewers(roomId));
    }
  }
}, VIEWER_SWEEP_MS);

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  const playerId = uuidv4();
  socketToPlayer.set(socket.id, playerId);


  socket.emit('connect:welcome', { playerId, rooms: getPublicRooms() });

  // --- Room management ---------------------------------------------------

  socket.on('room:create', (data) => {
    const roomId = generateRoomCode();

    const player: Player = {
      id: playerId,
      nickname: 'Host',
      gender: 'male',
      avatar: {
        gender: 'male',
        hairstyle: 'short',
        hairColor: '#333333',
        topStyle: 'tshirt',
        topColor: '#ffffff',
        bottomStyle: 'jeans',
        bottomColor: '#1a1a2e',
        shoes: 'sneakers',
        accessory: null,
      },
      position: spawnPosition(0),
      rotation: 0,
      animation: 'idle',
      tableId: null,
      connectedAt: Date.now(),
    };

    const room: Room = {
      id: roomId,
      name: data.name,
      hostId: playerId,
      players: { [playerId]: player },
      maxCapacity: data.maxCapacity ?? 12,
      isPublic: data.isPublic ?? true,
      password: data.password,
      tables: createDefaultTables(),
      musicQueue: defaultMusicQueue(),
      currentSong: null,
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);

    socket.emit('room:created', room);
  });

  socket.on('room:join', (data) => {
    const room = rooms.get(data.roomId);

    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }

    if (Object.keys(room.players).length >= room.maxCapacity) {
      socket.emit('room:error', { message: 'Room is full' });
      return;
    }

    if (room.password && data.password !== room.password) {
      socket.emit('room:error', { message: 'Wrong password' });
      return;
    }

    const player: Player = {
      id: playerId,
      nickname: 'Guest',
      gender: 'male',
      avatar: {
        gender: 'male',
        hairstyle: 'short',
        hairColor: '#333333',
        topStyle: 'tshirt',
        topColor: '#ffffff',
        bottomStyle: 'jeans',
        bottomColor: '#1a1a2e',
        shoes: 'sneakers',
        accessory: null,
      },
      // Next free slot on the spiral, so arrivals fan out from the centre
      position: spawnPosition(Object.keys(room.players).length),
      rotation: 0,
      animation: 'idle',
      tableId: null,
      connectedAt: Date.now(),
    };

    room.players[playerId] = player;
    socket.join(room.id);
    socketToRoom.set(socket.id, room.id);

    socket.emit('room:joined', room);
    // Catch the newcomer up, otherwise their stage shows the default cast
    socket.emit('tiktok:status', tiktok.getStatus(room.id));
    socket.emit('tiktok:leaderboard', topGifters(room.id));
    socket.emit('tiktok:viewers', visibleViewers(room.id));
    socket.emit('tiktok:giftIcons', giftIcons.get(room.id) ?? {});
    socket.to(room.id).emit('room:playerJoined', player);
  });

  socket.on('room:leave', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    socket.leave(roomId);
    removePlayerFromRoom(io, socket.id, roomId);
    socket.emit('room:left', { playerId });
  });

  socket.on('room:list', () => {
    socket.emit('room:list', getPublicRooms());
  });

  // --- Player movement ---------------------------------------------------

  socket.on('player:move', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (player) {
      player.position = data.position;
      player.rotation = data.rotation;
    }

    socket.to(roomId).emit('player:moved', {
      playerId,
      position: data.position,
      rotation: data.rotation,
    });
  });

  socket.on('player:animate', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (player) player.animation = data.animation;

    socket.to(roomId).emit('player:animationChanged', {
      playerId,
      animation: data.animation,
    });
  });

  socket.on('player:updateAvatar', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (player) player.avatar = data.avatar;

    // io.to, not socket.to: the sender must receive this too. The client only
    // ever learns a player's avatar from the server, so excluding the sender
    // leaves them stuck on the default avatar they were given on join.
    io.to(roomId).emit('player:avatarUpdated', {
      playerId,
      avatar: data.avatar,
    });
  });

  socket.on('player:setNickname', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (player) player.nickname = data.nickname;

    io.to(roomId).emit('room:updated', { players: room.players });
  });

  // --- Chat --------------------------------------------------------------

  socket.on('chat:send', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (!player) return;

    const message: ChatMessage = {
      id: uuidv4(),
      senderId: playerId,
      senderName: player.nickname,
      text: data.text,
      timestamp: Date.now(),
      scope: data.scope || 'all',
      tableId: data.tableId,
    };

    if (data.scope === 'table' && data.tableId) {
      const table = room.tables.find((t) => t.id === data.tableId);
      if (table) {
        for (const seat of table.seats) {
          if (seat.playerId) {
            const sid = findSocketByPlayerId(seat.playerId);
            if (sid) io.to(sid).emit('chat:message', message);
          }
        }
        return;
      }
    }

    io.to(roomId).emit('chat:message', message);
  });

  socket.on('chat:react', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (!player) return;

    io.to(roomId).emit('chat:reaction', {
      playerId,
      playerName: player.nickname,
      reaction: data.reaction,
    });
  });

  // --- Tables ------------------------------------------------------------

  socket.on('table:sit', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const table = room.tables.find((t) => t.id === data.tableId);
    if (!table) {
      socket.emit('room:error', { message: 'Table not found' });
      return;
    }

    const seat = table.seats.find((s) => s.index === data.seatIndex);
    if (!seat) {
      socket.emit('room:error', { message: 'Seat not found' });
      return;
    }

    if (seat.playerId !== null) {
      socket.emit('room:error', { message: 'Seat is occupied' });
      return;
    }

    for (const t of room.tables) {
      for (const s of t.seats) {
        if (s.playerId === playerId) {
          s.playerId = null;
          t.players = t.players.filter((p) => p !== playerId);
          if (t.id !== data.tableId) {
            io.to(roomId).emit('table:playerLeft', { playerId, tableId: t.id });
          }
        }
      }
    }

    seat.playerId = playerId;
    if (!table.players.includes(playerId)) table.players.push(playerId);

    const player = room.players[playerId];
    if (player) player.tableId = data.tableId;

    io.to(roomId).emit('table:playerSat', {
      playerId,
      tableId: table.id,
      seatIndex: data.seatIndex,
    });
  });

  socket.on('table:leave', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    for (const table of room.tables) {
      for (const seat of table.seats) {
        if (seat.playerId === playerId) {
          seat.playerId = null;
          table.players = table.players.filter((p) => p !== playerId);
          io.to(roomId).emit('table:playerLeft', { playerId, tableId: table.id });
        }
      }
    }

    const player = room.players[playerId];
    if (player) player.tableId = null;
  });

  // --- Drinks ------------------------------------------------------------

  socket.on('drink:getMenu', () => {
    socket.emit('drink:menu', defaultDrinkMenu);
  });

  socket.on('drink:order', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (!player) return;

    const order: DrinkOrder = {
      id: uuidv4(),
      drinkId: data.drinkId,
      orderedBy: playerId,
      orderedFor: data.forPlayerId ?? playerId,
      tableId: player.tableId,
      timestamp: Date.now(),
    };

    io.to(roomId).emit('drink:ordered', order);
  });

  // --- Music -------------------------------------------------------------

  socket.on('music:addTrack', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[playerId];
    if (!player) return;

    const track: MusicTrack = {
      id: uuidv4(),
      youtubeId: data.youtubeId,
      title: data.title,
      addedBy: playerId,
      addedByName: player.nickname,
    };

    room.musicQueue.tracks.push(track);
    if (room.musicQueue.currentIndex === -1) {
      room.musicQueue.currentIndex = 0;
      room.musicQueue.isPlaying = true;
      room.currentSong = track;
      io.to(roomId).emit('music:nowPlaying', track);
    }

    io.to(roomId).emit('music:queueUpdated', room.musicQueue);
  });

  socket.on('music:removeTrack', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.musicQueue.tracks = room.musicQueue.tracks.filter((t) => t.id !== data.trackId);
    io.to(roomId).emit('music:queueUpdated', room.musicQueue);
  });

  socket.on('music:skip', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.musicQueue.currentIndex < room.musicQueue.tracks.length - 1) {
      room.musicQueue.currentIndex++;
      room.musicQueue.positionSeconds = 0;
      room.currentSong = room.musicQueue.tracks[room.musicQueue.currentIndex];
      io.to(roomId).emit('music:nowPlaying', room.currentSong);
    } else {
      room.musicQueue.isPlaying = false;
      room.currentSong = null;
      io.to(roomId).emit('music:nowPlaying', null);
    }

    io.to(roomId).emit('music:queueUpdated', room.musicQueue);
  });

  socket.on('music:playPause', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.musicQueue.isPlaying = !room.musicQueue.isPlaying;
    io.to(roomId).emit('music:queueUpdated', room.musicQueue);
  });

  socket.on('music:reorder', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const idx = room.musicQueue.tracks.findIndex((t) => t.id === data.trackId);
    if (idx === -1) return;

    const [track] = room.musicQueue.tracks.splice(idx, 1);
    room.musicQueue.tracks.splice(data.newIndex, 0, track);
    io.to(roomId).emit('music:queueUpdated', room.musicQueue);
  });

  // --- Disconnect --------------------------------------------------------

  // --- TikTok LIVE -------------------------------------------------------

  socket.on('tiktok:connect', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    // Only the host links a channel — otherwise any guest could repoint the
    // room at their own stream.
    if (room.hostId !== playerId) {
      socket.emit('room:error', { message: 'Chỉ chủ phòng mới kết nối được TikTok' });
      return;
    }

    const say = (text: string) => {
      const message: ChatMessage = {
        id: uuidv4(),
        senderId: 'tiktok',
        senderName: 'TikTok',
        text,
        timestamp: Date.now(),
        scope: 'all',
      };
      io.to(roomId).emit('chat:message', message);
    };

    tiktok.connect(roomId, data.username, {
      onStatus: (status) => io.to(roomId).emit('tiktok:status', status),

      onGiftCatalog: (gifts) => {
        const icons: TikTokGiftIcons = { ...giftIcons.get(roomId) };
        for (const { name, icon } of gifts) {
          const kind = classifyGift(name);
          if (kind && icon && !icons[kind]) icons[kind] = icon;
        }
        giftIcons.set(roomId, icons);
        io.to(roomId).emit('tiktok:giftIcons', icons);
      },

      onChat: ({ userId, nickname, avatarUrl, comment }) => {
        if (touchViewer(roomId, userId, nickname, avatarUrl)) {
          io.to(roomId).emit('tiktok:viewers', visibleViewers(roomId));
        }
        const message: ChatMessage = {
          id: uuidv4(),
          // Prefixed id keeps viewers distinct from real players without
          // needing a Player record for every commenter
          senderId: `tiktok:${nickname}`,
          senderName: `🎵 ${nickname}`,
          text: comment,
          timestamp: Date.now(),
          scope: 'all',
        };
        io.to(roomId).emit('chat:message', message);
      },

      onLike: ({ userId, nickname, avatarUrl, count }) => {
        if (touchViewer(roomId, userId, nickname, avatarUrl)) {
          io.to(roomId).emit('tiktok:viewers', visibleViewers(roomId));
        }
        io.to(roomId).emit('chat:reaction', {
          playerId: `tiktok:${nickname}`,
          playerName: nickname,
          reaction: 'heart',
        });

        let likes = likeLedger.get(roomId);
        if (!likes) {
          likes = new Map();
          likeLedger.set(roomId, likes);
        }
        const entry = likes.get(userId) ?? { total: 0, pending: 0, focusedAt: 0 };
        entry.total += count;
        entry.pending += count;
        likes.set(userId, entry);

        const now = Date.now();
        io.to(roomId).emit('tiktok:action', { kind: 'jump', userId, nickname, at: now, likes: entry.total });

        // Counted across messages: TikTok splits ordinary tapping into many
        // small like messages, so a per-message threshold almost never fires.
        // The cooldown stops one busy tapper from holding the camera.
        if (entry.pending >= LIKE_FOCUS_MIN && now - entry.focusedAt > LIKE_FOCUS_COOLDOWN_MS) {
          entry.pending = 0;
          entry.focusedAt = now;
          io.to(roomId).emit('tiktok:action', { kind: 'focus', userId, nickname, at: now, likes: entry.total });
        }
      },

      onGift: ({ userId, nickname, avatarUrl, giftName, giftIcon, count, diamonds }) => {
        if (touchViewer(roomId, userId, nickname, avatarUrl)) {
          io.to(roomId).emit('tiktok:viewers', visibleViewers(roomId));
        }
        say(`🎁 ${nickname} tặng ${giftName} x${count}${diamonds ? ` (${diamonds} 🪙)` : ''}`);
        io.to(roomId).emit('chat:reaction', {
          playerId: `tiktok:${nickname}`,
          playerName: nickname,
          // Big gifts get fire, small ones a toast
          reaction: diamonds >= 100 ? 'fire' : 'cheers',
        });

        // Running total decides who stands on stage
        let ledger = giftLedger.get(roomId);
        if (!ledger) {
          ledger = new Map();
          giftLedger.set(roomId, ledger);
        }
        const prev = ledger.get(userId);
        ledger.set(userId, {
          userId,
          nickname,
          // Keep the last non-empty avatar; some messages omit it
          avatarUrl: avatarUrl || prev?.avatarUrl || '',
          diamonds: (prev?.diamonds ?? 0) + Math.max(diamonds, count),
          lastGift: giftName,
          lastGiftIcon: giftIcon,
        });
        io.to(roomId).emit('tiktok:leaderboard', topGifters(roomId));

        // Every gift points the camera at whoever sent it. `kind` only says
        // whether this gift ALSO swaps their character — the client focuses on
        // any action regardless of kind.
        const giftKind = classifyGift(giftName);
        if (giftKind === 'rosa') say(`🍸 ${nickname} ra quầy bar order rượu`);
        io.to(roomId).emit('tiktok:action', {
          kind: giftKind === 'tiktok' ? 'skin' : giftKind === 'rosa' ? 'bar' : 'focus',
          userId,
          nickname,
          at: Date.now(),
          fromGift: true,
        });
      },

      onSocial: ({ nickname, kind }) => {
        say(kind === 'follow' ? `💜 ${nickname} đã follow` : `🔁 ${nickname} đã chia sẻ LIVE`);
      },

      onMember: ({ userId, nickname, avatarUrl }) => {
        say(`👋 ${nickname} vừa vào LIVE`);
        if (touchViewer(roomId, userId, nickname, avatarUrl)) {
          io.to(roomId).emit('tiktok:viewers', visibleViewers(roomId));
        }
      },
    });
  });

  socket.on('tiktok:disconnect', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== playerId) return;

    tiktok.disconnect(roomId);
    io.to(roomId).emit('tiktok:status', tiktok.getStatus(roomId));
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    const roomId = socketToRoom.get(socket.id);
    if (roomId) removePlayerFromRoom(io, socket.id, roomId);
    socketToPlayer.delete(socket.id);
  });
});

server.listen(port, () => {
  console.log(`> Socket.IO server listening on http://localhost:${port}`);
});
