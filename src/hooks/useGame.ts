import { useCallback, useEffect, useReducer, useRef } from 'react';
import { getSocket, disconnect, type TypedSocket } from '@/lib/socket';
import type {
  Room,
  Player,
  ChatMessage,
  MusicTrack,
  MusicQueue,
  RoomSummary,
  Drink,
  DrinkOrder,
  Reaction,
  ChatScope,
  AnimationState,
  Vec3,
  AvatarConfig,
} from '@/types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface GameState {
  connected: boolean;
  localPlayerId: string | null;
  room: Room | null;
  players: Record<string, Player>;
  messages: ChatMessage[];
  musicQueue: MusicTrack[];
  currentSongIndex: number;
  isPlaying: boolean;
  availableRooms: RoomSummary[];
  drinkMenu: Drink[];
  reactions: { playerId: string; playerName: string; reaction: string }[];
  roomError: string | null;
  recentOrders: DrinkOrder[];
}

const initialState: GameState = {
  connected: false,
  localPlayerId: null,
  room: null,
  players: {},
  messages: [],
  musicQueue: [],
  currentSongIndex: -1,
  isPlaying: false,
  availableRooms: [],
  drinkMenu: [],
  reactions: [],
  roomError: null,
  recentOrders: [],
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'SET_LOCAL_PLAYER'; playerId: string; rooms: RoomSummary[] }
  | { type: 'ROOM_CREATED'; room: Room }
  | { type: 'ROOM_JOINED'; room: Room }
  | { type: 'ROOM_LEFT' }
  | { type: 'ROOM_PLAYER_JOINED'; player: Player }
  | { type: 'ROOM_PLAYER_LEFT'; playerId: string; newHostId?: string }
  | { type: 'ROOM_UPDATED'; partial: Partial<Room> }
  | { type: 'ROOM_LIST'; rooms: RoomSummary[] }
  | { type: 'ROOM_ERROR'; message: string }
  | { type: 'PLAYER_MOVED'; playerId: string; position: Vec3; rotation: number }
  | { type: 'PLAYER_ANIMATION'; playerId: string; animation: AnimationState }
  | { type: 'PLAYER_AVATAR'; playerId: string; avatar: AvatarConfig }
  | { type: 'CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'MUSIC_QUEUE_UPDATED'; queue: MusicQueue }
  | { type: 'MUSIC_NOW_PLAYING'; track: MusicTrack | null }
  | { type: 'DRINK_MENU'; drinks: Drink[] }
  | { type: 'DRINK_ORDERED'; order: DrinkOrder }
  | { type: 'TABLE_PLAYER_SAT'; playerId: string; tableId: string; seatIndex: number }
  | { type: 'TABLE_PLAYER_LEFT'; playerId: string; tableId: string }
  | { type: 'REACTION'; playerId: string; playerName: string; reaction: string };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };

    case 'SET_LOCAL_PLAYER':
      return { ...state, localPlayerId: action.playerId, availableRooms: action.rooms };

    case 'ROOM_CREATED':
    case 'ROOM_JOINED':
      return {
        ...state,
        room: action.room,
        players: action.room.players,
        musicQueue: action.room.musicQueue.tracks,
        currentSongIndex: action.room.musicQueue.currentIndex,
        isPlaying: action.room.musicQueue.isPlaying,
        messages: [],
      };

    case 'ROOM_LEFT':
      return { ...state, room: null, players: {}, messages: [], musicQueue: [], currentSongIndex: -1, isPlaying: false };

    case 'ROOM_PLAYER_JOINED': {
      const players = { ...state.players, [action.player.id]: action.player };
      return { ...state, players };
    }

    case 'ROOM_PLAYER_LEFT': {
      const { [action.playerId]: _, ...rest } = state.players;
      const room = state.room
        ? { ...state.room, hostId: action.newHostId ?? state.room.hostId }
        : null;
      return { ...state, players: rest, room };
    }

    case 'ROOM_UPDATED': {
      if (!state.room) return state;
      const updatedRoom = { ...state.room, ...action.partial };
      return {
        ...state,
        room: updatedRoom,
        players: action.partial.players ?? state.players,
      };
    }

    case 'ROOM_LIST':
      return { ...state, availableRooms: action.rooms };

    case 'ROOM_ERROR':
      return { ...state, roomError: action.message };

    case 'PLAYER_MOVED': {
      const p = state.players[action.playerId];
      if (!p) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: { ...p, position: action.position, rotation: action.rotation },
        },
      };
    }

    case 'PLAYER_ANIMATION': {
      const p = state.players[action.playerId];
      if (!p) return state;
      return {
        ...state,
        players: { ...state.players, [action.playerId]: { ...p, animation: action.animation } },
      };
    }

    case 'PLAYER_AVATAR': {
      const p = state.players[action.playerId];
      if (!p) return state;
      return {
        ...state,
        players: { ...state.players, [action.playerId]: { ...p, avatar: action.avatar } },
      };
    }

    case 'CHAT_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'MUSIC_QUEUE_UPDATED':
      return {
        ...state,
        musicQueue: action.queue.tracks,
        currentSongIndex: action.queue.currentIndex,
        isPlaying: action.queue.isPlaying,
      };

    case 'MUSIC_NOW_PLAYING':
      return state; // handled via queue update primarily

    case 'DRINK_MENU':
      return { ...state, drinkMenu: action.drinks };

    case 'DRINK_ORDERED':
      return { ...state, recentOrders: [...state.recentOrders.slice(-19), action.order] };

    case 'TABLE_PLAYER_SAT': {
      if (!state.room) return state;
      const tables = state.room.tables.map((t) => {
        if (t.id !== action.tableId) return t;
        return {
          ...t,
          seats: t.seats.map((s) =>
            s.index === action.seatIndex ? { ...s, playerId: action.playerId } : s,
          ),
          players: t.players.includes(action.playerId)
            ? t.players
            : [...t.players, action.playerId],
        };
      });
      const p = state.players[action.playerId];
      const players = p
        ? { ...state.players, [action.playerId]: { ...p, tableId: action.tableId } }
        : state.players;
      return { ...state, room: { ...state.room, tables }, players };
    }

    case 'TABLE_PLAYER_LEFT': {
      if (!state.room) return state;
      const tables = state.room.tables.map((t) => {
        if (t.id !== action.tableId) return t;
        return {
          ...t,
          seats: t.seats.map((s) =>
            s.playerId === action.playerId ? { ...s, playerId: null } : s,
          ),
          players: t.players.filter((pid) => pid !== action.playerId),
        };
      });
      const p = state.players[action.playerId];
      const players = p
        ? { ...state.players, [action.playerId]: { ...p, tableId: null } }
        : state.players;
      return { ...state, room: { ...state.room, tables }, players };
    }

    case 'REACTION':
      return { ...state, reactions: [...state.reactions, { playerId: action.playerId, playerName: action.playerName, reaction: action.reaction }] };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGame() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<TypedSocket | null>(null);

  // ---- connect on mount ---------------------------------------------------

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    // connection status
    const onConnect = () => dispatch({ type: 'SET_CONNECTED', connected: true });
    const onDisconnect = () => dispatch({ type: 'SET_CONNECTED', connected: false });
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) onConnect();

    // welcome
    s.on('connect:welcome', (data) => {
      dispatch({ type: 'SET_LOCAL_PLAYER', playerId: data.playerId, rooms: data.rooms });
    });

    // room
    s.on('room:created', (room) => dispatch({ type: 'ROOM_CREATED', room }));
    s.on('room:joined', (room) => dispatch({ type: 'ROOM_JOINED', room }));
    s.on('room:left', () => dispatch({ type: 'ROOM_LEFT' }));
    s.on('room:playerJoined', (p) => dispatch({ type: 'ROOM_PLAYER_JOINED', player: p }));
    s.on('room:playerLeft', (d) =>
      dispatch({ type: 'ROOM_PLAYER_LEFT', playerId: d.playerId, newHostId: d.newHostId }),
    );
    s.on('room:updated', (partial) => dispatch({ type: 'ROOM_UPDATED', partial }));
    s.on('room:list', (rooms) => dispatch({ type: 'ROOM_LIST', rooms }));
    s.on('room:error', (data) => dispatch({ type: 'ROOM_ERROR', message: data.message }));

    // player
    s.on('player:moved', (d) =>
      dispatch({ type: 'PLAYER_MOVED', playerId: d.playerId, position: d.position, rotation: d.rotation }),
    );
    s.on('player:animationChanged', (d) =>
      dispatch({ type: 'PLAYER_ANIMATION', playerId: d.playerId, animation: d.animation }),
    );
    s.on('player:avatarUpdated', (d) =>
      dispatch({ type: 'PLAYER_AVATAR', playerId: d.playerId, avatar: d.avatar }),
    );

    // chat
    s.on('chat:message', (msg) => dispatch({ type: 'CHAT_MESSAGE', message: msg }));
    s.on('chat:reaction', (data) => dispatch({ type: 'REACTION', playerId: data.playerId, playerName: data.playerName, reaction: data.reaction }));

    // music
    s.on('music:queueUpdated', (q) => dispatch({ type: 'MUSIC_QUEUE_UPDATED', queue: q }));
    s.on('music:nowPlaying', (track) => dispatch({ type: 'MUSIC_NOW_PLAYING', track }));

    // tables
    s.on('table:playerSat', (d) =>
      dispatch({ type: 'TABLE_PLAYER_SAT', playerId: d.playerId, tableId: d.tableId, seatIndex: d.seatIndex }),
    );
    s.on('table:playerLeft', (d) =>
      dispatch({ type: 'TABLE_PLAYER_LEFT', playerId: d.playerId, tableId: d.tableId }),
    );

    // drinks
    s.on('drink:menu', (drinks) => dispatch({ type: 'DRINK_MENU', drinks }));
    s.on('drink:ordered', (order) => dispatch({ type: 'DRINK_ORDERED', order }));

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.removeAllListeners();
      disconnect();
    };
  }, []);

  // ---- emitters -----------------------------------------------------------

  const emit = useCallback(() => socketRef.current!, []);

  const sendMessage = useCallback((text: string, scope: ChatScope = 'all', tableId?: string) => {
    emit().emit('chat:send', { text, scope, tableId });
  }, [emit]);

  const addReaction = useCallback((reaction: Reaction) => {
    emit().emit('chat:react', { reaction });
  }, [emit]);

  const queueMusic = useCallback((youtubeId: string, title: string) => {
    emit().emit('music:addTrack', { youtubeId, title });
  }, [emit]);

  const skipMusic = useCallback(() => {
    emit().emit('music:skip');
  }, [emit]);

  const playPauseMusic = useCallback(() => {
    emit().emit('music:playPause');
  }, [emit]);

  const orderDrink = useCallback((drinkId: string, forPlayerId?: string) => {
    emit().emit('drink:order', { drinkId, forPlayerId });
  }, [emit]);

  const getDrinkMenu = useCallback(() => {
    emit().emit('drink:getMenu');
  }, [emit]);

  const sitAtTable = useCallback((tableId: string, seatIndex: number) => {
    emit().emit('table:sit', { tableId, seatIndex });
  }, [emit]);

  const leaveTable = useCallback(() => {
    emit().emit('table:leave');
  }, [emit]);

  const movePlayer = useCallback((position: Vec3, rotation: number) => {
    emit().emit('player:move', { position, rotation });
  }, [emit]);

  const createRoom = useCallback(
    (data: { name: string; maxCapacity: number; isPublic: boolean; password?: string }) => {
      emit().emit('room:create', data);
    },
    [emit],
  );

  const joinRoom = useCallback((roomId: string, password?: string) => {
    emit().emit('room:join', { roomId, password });
  }, [emit]);

  const leaveRoom = useCallback(() => {
    emit().emit('room:leave');
  }, [emit]);

  const setProfile = useCallback((nickname: string, avatar: AvatarConfig) => {
    emit().emit('player:setNickname', { nickname });
    emit().emit('player:updateAvatar', { avatar });
  }, [emit]);

  // ---- derived ------------------------------------------------------------

  const myPlayer = state.localPlayerId ? state.players[state.localPlayerId] ?? null : null;

  return {
    ...state,
    myPlayer,
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
    setProfile,
  };
}
