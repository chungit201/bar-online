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
  ServerToClientEvents,
  ClientToServerEvents,
} from '../src/types';

const port = parseInt(process.env.SOCKET_PORT || '3001', 10);

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const rooms = new Map<string, Room>();
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
      position: { x: 0, y: 0, z: 0 },
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
      position: { x: Math.random() * 4 - 2, y: 0, z: Math.random() * 4 - 2 },
      rotation: 0,
      animation: 'idle',
      tableId: null,
      connectedAt: Date.now(),
    };

    room.players[playerId] = player;
    socket.join(room.id);
    socketToRoom.set(socket.id, room.id);

    socket.emit('room:joined', room);
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

    socket.to(roomId).emit('player:avatarUpdated', {
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
