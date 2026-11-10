// ---------------------------------------------------------------------------
// Bar Online — Multiplayer Virtual Bar/Club Game
// Type Definitions
// ---------------------------------------------------------------------------

// ---- Enums & Literal Unions ------------------------------------------------

export const Reaction = {
  Clap: 'clap',
  Cheers: 'cheers',
  Dance: 'dance',
  Heart: 'heart',
  Laugh: 'laugh',
  Fire: 'fire',
} as const;
export type Reaction = (typeof Reaction)[keyof typeof Reaction];

export const CameraView = {
  Diagonal: 'diagonal',
  FullClub: 'full-club',
  DanceFloor: 'dance-floor',
  Bar: 'bar',
  Screen: 'screen',
  TopDown: 'top-down',
  FollowMe: 'follow-me',
  /** Eye level from the back of the room: booths near, crowd and stage behind */
  RoomWide: 'room-wide',
  /** Same height, swung left so the VIP booths lead the eye to the stage */
  BoothSide: 'booth-side',
  /** Low and close to the floor, looking up past the dancers at the LED wall */
  LowAngle: 'low-angle',
} as const;
export type CameraView = (typeof CameraView)[keyof typeof CameraView];

export const Gender = {
  Male: 'male',
  Female: 'female',
  NonBinary: 'non-binary',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const AnimationState = {
  Idle: 'idle',
  Walking: 'walking',
  Dancing: 'dancing',
  Sitting: 'sitting',
  Waving: 'waving',
  Drinking: 'drinking',
  Cheering: 'cheering',
} as const;
export type AnimationState = (typeof AnimationState)[keyof typeof AnimationState];

export type ChatScope = 'all' | 'table';

// ---- Geometry helpers ------------------------------------------------------

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ---- Avatar ----------------------------------------------------------------

export interface AvatarConfig {
  /** Id from the character catalog (src/components/avatar/characters.ts) */
  characterId?: string;
  gender: Gender;
  hairstyle: string;
  hairColor: string;
  topStyle: string;
  topColor: string;
  bottomStyle: string;
  bottomColor: string;
  shoes: string;
  accessory: string | null;
}

// ---- Player ----------------------------------------------------------------

export interface Player {
  id: string;
  nickname: string;
  gender: Gender;
  avatar: AvatarConfig;
  position: Vec3;
  rotation: number; // y-axis rotation in radians
  animation: AnimationState;
  tableId: string | null;
  connectedAt: number; // unix ms
}

// ---- Table & Seat ----------------------------------------------------------

export interface Seat {
  index: number;
  playerId: string | null;
}

export interface Table {
  id: string;
  position: Vec3;
  seats: Seat[];
  players: string[]; // player ids currently at this table
}

// ---- Drinks ----------------------------------------------------------------

export interface Drink {
  id: string;
  name: string;
  price: number;
  icon: string; // emoji or asset key
}

export interface DrinkOrder {
  id: string;
  drinkId: string;
  orderedBy: string; // player id
  orderedFor: string; // player id (can be self or another player)
  tableId: string | null;
  timestamp: number;
}

// ---- Chat ------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  scope: ChatScope;
  tableId?: string; // set when scope is 'table'
  reaction?: Reaction;
}

// ---- Music -----------------------------------------------------------------

export interface MusicTrack {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  addedBy: string; // player id
  addedByName: string;
}

export interface MusicQueue {
  tracks: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  positionSeconds: number; // playback position of current track
}

// ---- Room ------------------------------------------------------------------

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players: Record<string, Player>;
  maxCapacity: number; // 8-12
  isPublic: boolean;
  password?: string; // only for private rooms, never sent to non-host clients
  tables: Table[];
  musicQueue: MusicQueue;
  currentSong: MusicTrack | null;
  createdAt: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxCapacity: number;
  isPublic: boolean;
}

// ---- Game State (client-side) ----------------------------------------------

export interface GameState {
  localPlayerId: string | null;
  room: Room | null;
  cameraView: CameraView;
  chatMessages: ChatMessage[];
  availableRooms: RoomSummary[];
  drinkMenu: Drink[];
  isConnected: boolean;
}

// ---- TikTok LIVE -----------------------------------------------------------

/** A TikTok viewer who has sent gifts, ranked by diamonds spent */
export interface TikTokGifter {
  /** TikTok uniqueId — stable key for the leaderboard */
  userId: string;
  nickname: string;
  avatarUrl: string;
  diamonds: number;
  /** Name of the most recent gift this viewer sent */
  lastGift: string;
  /** TikTok artwork URL for that gift, empty when TikTok didn't send one */
  lastGiftIcon: string;
}

/** Real TikTok artwork for the gifts that have a rule, keyed by gift kind */
/** The gifts that have a rule in the bar. Ids match GIFT_RULES in server/index.ts */
export type TikTokGiftKind =
  | 'rose'
  | 'rosa'
  | 'tiktok'
  | 'gg'
  | 'heart'
  | 'perfume'
  | 'doughnut'
  | 'confetti'
  | 'money'
  | 'galaxy';

export type TikTokGiftIcons = Partial<Record<TikTokGiftKind, string>>;

/** How many of each ruled gift the room has received this session */
export type TikTokGiftCounts = Partial<Record<TikTokGiftKind, number>>;

/** A TikTok viewer currently shown as a character on the floor */
export interface TikTokViewer {
  userId: string;
  nickname: string;
  avatarUrl: string;
  position: Vec3;
  /** Server time they first appeared — drives the drop-in and camera focus */
  joinedAt: number;
}

/**
 * What a gift does to the scene, on top of whatever the camera does.
 *
 * Kept separate from `kind` on purpose: `kind` is the *camera's* intent and
 * only has a handful of meaningful values, while effects are purely visual and
 * will keep growing as gifts are added. Folding them together would mean every
 * new sparkle needed a camera rule to go with it.
 *
 *  - `skin`      swap the sender's character
 *  - `crowdJump` everyone on the floor hops at once
 *  - `hearts`    hearts stream up around the sender
 *  - `floorWash` dance floor runs a pastel colour wash
 *  - `giant`     the sender swells to double size
 *  - `confetti`  paper burst over the whole room
 *  - `moneyRain` gold coins fall, sender's name across the screen
 *  - `galaxy`    house lights out, lasers and strobes to the ceiling
 */
export type TikTokEffect =
  | 'skin'
  | 'crowdJump'
  | 'hearts'
  | 'floorWash'
  | 'giant'
  | 'confetti'
  | 'moneyRain'
  | 'galaxy';

/**
 * One-off reaction triggered by a viewer.
 *
 * 'focus' and 'skin' come from gifts and move the camera; 'jump' comes from a
 * like and only bounces that character, so a stream of hearts can't yank the
 * camera around.
 */
export interface TikTokAction {
  kind: 'focus' | 'skin' | 'jump' | 'bar';
  userId: string;
  nickname: string;
  at: number;
  /** Running like total for this viewer, sent with like-driven actions */
  likes?: number;
  /** Set when a gift caused this action, which earns the viewer a title */
  fromGift?: boolean;
  /**
   * Whether this action may take the camera. False means "do your thing but
   * leave the shot alone" — the skin still swaps, the walk to the bar still
   * happens, the effect still fires, but the cinematic pan keeps running.
   * Defaults to true when absent.
   */
  camera?: boolean;
  /** Scene effect this gift fires, if any */
  effect?: TikTokEffect;
  /** Gift that caused it, for the on-screen banner */
  giftName?: string;
}

export interface TikTokStatus {
  connected: boolean;
  connecting: boolean;
  /** Channel without the leading @ */
  username: string;
  viewerCount: number;
  likeCount: number;
  lastError: string | null;
}

// ---- Socket.io Events ------------------------------------------------------

export interface ServerToClientEvents {
  // Connection
  'connect:welcome': (data: { playerId: string; rooms: RoomSummary[] }) => void;

  // Room
  'room:created': (room: Room) => void;
  'room:joined': (room: Room) => void;
  'room:left': (data: { playerId: string }) => void;
  'room:playerJoined': (player: Player) => void;
  'room:playerLeft': (data: { playerId: string; newHostId?: string }) => void;
  'room:updated': (room: Partial<Room>) => void;
  'room:list': (rooms: RoomSummary[]) => void;
  'room:error': (data: { message: string }) => void;

  // Player
  'player:moved': (data: { playerId: string; position: Vec3; rotation: number }) => void;
  'player:animationChanged': (data: { playerId: string; animation: AnimationState }) => void;
  'player:avatarUpdated': (data: { playerId: string; avatar: AvatarConfig }) => void;

  // Chat
  'chat:message': (message: ChatMessage) => void;
  'chat:reaction': (data: { playerId: string; playerName: string; reaction: Reaction }) => void;

  // Table
  'table:playerSat': (data: { playerId: string; tableId: string; seatIndex: number }) => void;
  'table:playerLeft': (data: { playerId: string; tableId: string }) => void;

  // Drinks
  'drink:ordered': (order: DrinkOrder) => void;
  'drink:menu': (drinks: Drink[]) => void;

  // Music
  'music:queueUpdated': (queue: MusicQueue) => void;
  'music:nowPlaying': (track: MusicTrack | null) => void;
  'music:positionSync': (data: { positionSeconds: number }) => void;

  // TikTok LIVE
  'tiktok:status': (status: TikTokStatus) => void;
  'tiktok:leaderboard': (top: TikTokGifter[]) => void;
  'tiktok:viewers': (viewers: TikTokViewer[]) => void;
  'tiktok:giftIcons': (icons: TikTokGiftIcons) => void;
  'tiktok:giftCounts': (counts: TikTokGiftCounts) => void;
  'tiktok:action': (action: TikTokAction) => void;
}

export interface ClientToServerEvents {
  // TikTok LIVE (host only)
  'tiktok:connect': (data: { username: string }) => void;
  'tiktok:disconnect': () => void;

  // Room
  'room:create': (data: { name: string; maxCapacity: number; isPublic: boolean; password?: string }) => void;
  'room:join': (data: { roomId: string; password?: string }) => void;
  'room:leave': () => void;
  'room:list': () => void;

  // Player
  'player:move': (data: { position: Vec3; rotation: number }) => void;
  'player:animate': (data: { animation: AnimationState }) => void;
  'player:updateAvatar': (data: { avatar: AvatarConfig }) => void;
  'player:setNickname': (data: { nickname: string }) => void;

  // Chat
  'chat:send': (data: { text: string; scope: ChatScope; tableId?: string }) => void;
  'chat:react': (data: { reaction: Reaction }) => void;

  // Table
  'table:sit': (data: { tableId: string; seatIndex: number }) => void;
  'table:leave': () => void;

  // Drinks
  'drink:order': (data: { drinkId: string; forPlayerId?: string }) => void;
  'drink:getMenu': () => void;

  // Music
  'music:addTrack': (data: { youtubeId: string; title: string }) => void;
  'music:removeTrack': (data: { trackId: string }) => void;
  'music:skip': () => void;
  'music:playPause': () => void;
  'music:reorder': (data: { trackId: string; newIndex: number }) => void;
}
