'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import YouTube, { type YouTubeEvent } from 'react-youtube';
import CharacterBillboard from '@/components/avatar/CharacterBillboard';
import DanceSprite from '@/components/avatar/DanceSprite';
import NameTag from '@/components/avatar/NameTag';
import TitleBadge, { STAGE_TITLES } from '@/components/avatar/TitleBadge';
import { getClip } from '@/components/avatar/dances';
import type { TikTokGifter } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableData {
  id: string;
  position: [number, number, number];
  seats: number;
}

interface StageVideo {
  youtubeId: string;
  title: string;
}

interface BarSceneProps {
  tables: TableData[];
  onTableClick: (tableId: string) => void;
  highlightedTable?: string;
  onFloorClick?: (point: { x: number; y: number; z: number }) => void;
  /** Track currently showing on the stage LED screen (null = idle gradient) */
  stageVideo?: StageVideo | null;
  isPlaying?: boolean;
  isMuted?: boolean;
  onVideoEnd?: () => void;
  /** Top TikTok gift senders — they take over the three stage spots */
  tiktokTop?: TikTokGifter[];
  /** userId -> clip id, from the skin-swap gift */
  tiktokSkins?: Record<string, string>;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const NEON_PURPLE = '#a855f7';
const NEON_BLUE = '#3b82f6';
const NEON_PINK = '#ec4899';
const NEON_CYAN = '#06b6d4';
const NEON_RED = '#ef4444';
const NEON_GREEN = '#22c55e';
const NEON_ORANGE = '#f97316';
const NEON_YELLOW = '#eab308';
const DARK_WALL = '#1e1e3a';
const FLOOR_DARK = '#141420';
const FLOOR_WOOD = '#4a3520';
const BOOTH_COLOR = '#1a1028';
const TABLE_TOP = '#1a1a2a';

// ---------------------------------------------------------------------------
// Checkered dance floor tiles
// ---------------------------------------------------------------------------

function DanceFloorTiles() {
  const tileColors = [
    NEON_PURPLE, NEON_BLUE, NEON_PINK, NEON_CYAN,
    '#6366f1', '#8b5cf6', '#d946ef', '#0ea5e9',
  ];
  const gridSize = 6;
  const tileSize = 0.9;
  const gap = 0.1;
  const tiles: React.ReactNode[] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const x = (col - gridSize / 2 + 0.5) * (tileSize + gap);
      const z = (row - gridSize / 2 + 0.5) * (tileSize + gap);
      const colorIdx = (row + col) % tileColors.length;
      tiles.push(
        <mesh key={`tile-${row}-${col}`} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[tileSize, tileSize]} />
          <meshStandardMaterial
            color={tileColors[colorIdx]}
            emissive={tileColors[colorIdx]}
            emissiveIntensity={0.4}
            roughness={0.5}
          />
        </mesh>,
      );
    }
  }

  return (
    <group position={[0, 0, 0]}>
      {tiles}
      {/* Edge neon strips */}
      {[
        { pos: [0, 0.05, 3.2] as [number, number, number], rot: [0, 0, 0] as [number, number, number], w: 6.5 },
        { pos: [0, 0.05, -3.2] as [number, number, number], rot: [0, 0, 0] as [number, number, number], w: 6.5 },
        { pos: [3.2, 0.05, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], w: 6.5 },
        { pos: [-3.2, 0.05, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], w: 6.5 },
      ].map((s, i) => (
        <mesh key={`edge-${i}`} position={s.pos} rotation={s.rot}>
          <boxGeometry args={[s.w, 0.06, 0.06]} />
          <meshStandardMaterial color={NEON_PINK} emissive={NEON_PINK} emissiveIntensity={4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Booth table (circular sofa + round table like superclub)
// ---------------------------------------------------------------------------

function BoothTable({
  table,
  highlighted,
  onClick,
  label,
}: {
  table: TableData;
  highlighted: boolean;
  onClick: () => void;
  label: string;
}) {
  const [x, y, z] = table.position;
  const boothRadius = 1.4;
  const tableRadius = 0.55;

  return (
    <group position={[x, y, z]}>
      {/* Circular sofa / booth - semicircle */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[boothRadius, boothRadius, 0.5, 32, 1, false, 0, Math.PI * 1.5]} />
        <meshStandardMaterial color={BOOTH_COLOR} roughness={0.8} />
      </mesh>
      {/* Sofa top cushion */}
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[boothRadius, boothRadius, 0.05, 32, 1, false, 0, Math.PI * 1.5]} />
        <meshStandardMaterial color={'#2a1a40'} roughness={0.6} />
      </mesh>
      {/* Sofa backrest */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[boothRadius + 0.15, boothRadius + 0.15, 0.3, 32, 1, true, 0, Math.PI * 1.5]} />
        <meshStandardMaterial color={BOOTH_COLOR} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Neon ring under booth */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[boothRadius - 0.05, boothRadius + 0.05, 32]} />
        <meshStandardMaterial
          color={highlighted ? NEON_PURPLE : NEON_CYAN}
          emissive={highlighted ? NEON_PURPLE : NEON_CYAN}
          emissiveIntensity={highlighted ? 4 : 1.5}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>

      {/* Table leg */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} />
        <meshStandardMaterial color={'#333'} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Table top */}
      <mesh
        position={[0, 0.62, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        castShadow
      >
        <cylinderGeometry args={[tableRadius, tableRadius, 0.06, 24]} />
        <meshStandardMaterial
          color={highlighted ? '#332244' : TABLE_TOP}
          emissive={highlighted ? NEON_PURPLE : '#000'}
          emissiveIntensity={highlighted ? 2 : 0}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>

      {/* Items on table (glasses/bottles) */}
      {[0, 1.2, 2.4, 3.6].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.3, 0.7, Math.sin(a) * 0.3]}>
          <cylinderGeometry args={[0.03, 0.025, 0.08, 6]} />
          <meshStandardMaterial color={[NEON_CYAN, NEON_PINK, NEON_PURPLE, NEON_ORANGE][i]} transparent opacity={0.5} emissive={[NEON_CYAN, NEON_PINK, NEON_PURPLE, NEON_ORANGE][i]} emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* Table label */}
      <Text
        position={[0, 0.08, boothRadius + 0.3]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.25}
        color={'#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {label}
        <meshStandardMaterial color={'#aaa'} emissive={'#aaa'} emissiveIntensity={0.5} />
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

function Floor() {
  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 30]} />
        <meshStandardMaterial color={FLOOR_DARK} roughness={0.8} />
      </mesh>
      {/* Bar area floor - wood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-16, 0.01, 0]} receiveShadow>
        <planeGeometry args={[14, 20]} />
        <meshStandardMaterial color={FLOOR_WOOD} roughness={0.7} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

// Club wall height — tall enough to fit the 16:9 stage LED wall
const WALL_H = 8;

function Walls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, WALL_H / 2, -14]}>
        <boxGeometry args={[50, WALL_H, 0.3]} />
        <meshStandardMaterial color={DARK_WALL} roughness={0.9} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-24, WALL_H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[28, WALL_H, 0.3]} />
        <meshStandardMaterial color={DARK_WALL} roughness={0.9} />
      </mesh>
      {/* Right wall */}
      <mesh position={[24, WALL_H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[28, WALL_H, 0.3]} />
        <meshStandardMaterial color={DARK_WALL} roughness={0.9} />
      </mesh>

      {/* Neon strips along walls */}
      <mesh position={[0, 0.15, -13.8]}>
        <boxGeometry args={[48, 0.08, 0.08]} />
        <meshStandardMaterial color={NEON_PURPLE} emissive={NEON_PURPLE} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[-23.8, 0.15, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[27, 0.08, 0.08]} />
        <meshStandardMaterial color={NEON_BLUE} emissive={NEON_BLUE} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[23.8, 0.15, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[27, 0.08, 0.08]} />
        <meshStandardMaterial color={NEON_RED} emissive={NEON_RED} emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bar counter
// ---------------------------------------------------------------------------

function BarCounter() {
  return (
    <group position={[-17, 0, -6]}>
      {/* Long counter */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[10, 1.2, 1.2]} />
        <meshStandardMaterial color={'#2a1a0a'} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[10.2, 0.1, 1.4]} />
        <meshStandardMaterial color={'#1a0f05'} roughness={0.3} metalness={0.3} />
      </mesh>
      {/* Neon strip under counter */}
      <mesh position={[0, 0.02, 0.65]}>
        <boxGeometry args={[10, 0.06, 0.06]} />
        <meshStandardMaterial color={NEON_ORANGE} emissive={NEON_ORANGE} emissiveIntensity={3} toneMapped={false} />
      </mesh>

      {/* Back shelves with bottles */}
      <mesh position={[0, 1.8, -1.2]}>
        <boxGeometry args={[10, 0.08, 0.6]} />
        <meshStandardMaterial color={'#222'} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.6, -1.2]}>
        <boxGeometry args={[10, 0.08, 0.6]} />
        <meshStandardMaterial color={'#222'} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Bottles on shelves */}
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((x, i) => (
        <group key={`shelf-bottle-${i}`}>
          <mesh position={[x, 2.1, -1.2]}>
            <cylinderGeometry args={[0.05, 0.06, 0.4, 6]} />
            <meshStandardMaterial
              color={[NEON_PURPLE, NEON_BLUE, NEON_PINK, NEON_GREEN, NEON_CYAN, NEON_ORANGE, NEON_RED, NEON_YELLOW, NEON_PURPLE][i]}
              transparent opacity={0.7}
              emissive={[NEON_PURPLE, NEON_BLUE, NEON_PINK, NEON_GREEN, NEON_CYAN, NEON_ORANGE, NEON_RED, NEON_YELLOW, NEON_PURPLE][i]}
              emissiveIntensity={0.4}
            />
          </mesh>
          {i < 7 && (
            <mesh position={[x + 0.5, 2.9, -1.2]}>
              <cylinderGeometry args={[0.04, 0.05, 0.35, 6]} />
              <meshStandardMaterial
                color={[NEON_CYAN, NEON_PINK, NEON_GREEN, NEON_ORANGE, NEON_BLUE, NEON_RED, NEON_PURPLE][i]}
                transparent opacity={0.6}
                emissive={[NEON_CYAN, NEON_PINK, NEON_GREEN, NEON_ORANGE, NEON_BLUE, NEON_RED, NEON_PURPLE][i]}
                emissiveIntensity={0.3}
              />
            </mesh>
          )}
        </group>
      ))}

      {/* Bar stools */}
      {[-4, -2.5, -1, 0.5, 2, 3.5].map((x, i) => (
        <group key={`stool-${i}`} position={[x, 0, 1.5]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
            <meshStandardMaterial color={'#444'} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.18, 0.16, 0.08, 12]} />
            <meshStandardMaterial color={'#222'} />
          </mesh>
        </group>
      ))}

      {/* "QUẦY BAR" sign */}
      <Text position={[0, 3.5, -1.5]} fontSize={0.5} color={NEON_ORANGE}>
        QUẦY BAR
        <meshStandardMaterial color={NEON_ORANGE} emissive={NEON_ORANGE} emissiveIntensity={5} toneMapped={false} />
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// DJ Stage
// ---------------------------------------------------------------------------

// Desk top sits at y = 0.9 + 0.25; the console rests on that surface.
const DESK_TOP = 1.15;
const PAD_COLORS = [NEON_PINK, NEON_CYAN, NEON_PURPLE, NEON_GREEN, NEON_ORANGE, NEON_BLUE];

/** Jog wheel: a platter with a lit rim that spins while a track plays */
function JogWheel({ x, musicOn, dir }: { x: number; musicOn: boolean; dir: number }) {
  const spin = useRef<THREE.Group>(null);
  const rim = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (spin.current && musicOn) spin.current.rotation.y += delta * 1.6 * dir;
    if (rim.current) rim.current.emissiveIntensity = musicOn ? 2.5 + beatPulse(t) * 7 : 1.2;
  });

  return (
    <group position={[x, 0.03, 0.02]}>
      {/* Housing */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 28]} />
        <meshStandardMaterial color={'#15151f'} metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Lit rim */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.022, 10, 36]} />
        <meshStandardMaterial
          ref={rim}
          color={NEON_CYAN}
          emissive={NEON_CYAN}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      {/* Platter with a marker so the rotation is readable */}
      <group ref={spin} position={[0, 0.035, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.02, 24]} />
          <meshStandardMaterial color={'#23232e'} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.12, 0.015, 0]}>
          <boxGeometry args={[0.16, 0.012, 0.03]} />
          <meshStandardMaterial
            color={'#ffffff'}
            emissive={'#ffffff'}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function DJConsole({ musicOn }: { musicOn: boolean }) {
  const pads = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  // 2 rows x 4 columns on each side of the mixer
  const padCells = useMemo(() => {
    const out: { pos: [number, number, number]; seed: number }[] = [];
    for (const side of [-1, 1]) {
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          out.push({
            pos: [side * (0.62 + c * 0.13), 0.035, 0.3 + r * 0.15],
            seed: out.length,
          });
        }
      }
    }
    return out;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < pads.current.length; i++) {
      const m = pads.current[i];
      if (!m) continue;
      if (!musicOn) {
        m.emissiveIntensity = 0.5;
        continue;
      }
      // Each pad lights on its own offset so the grid ripples rather than
      // flashing as one block
      m.emissiveIntensity = 0.5 + beatPulse(t, i * 0.035, 2) * 6;
    }
  });

  return (
    <group position={[0, DESK_TOP, 0]}>
      {/* Console body */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[3.0, 0.04, 1.05]} />
        <meshStandardMaterial color={'#101018'} metalness={0.4} roughness={0.6} />
      </mesh>

      <JogWheel x={-1.05} musicOn={musicOn} dir={1} />
      <JogWheel x={1.05} musicOn={musicOn} dir={-1} />

      {/* Mixer block */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.72, 0.05, 0.8]} />
        <meshStandardMaterial color={'#181822'} metalness={0.5} roughness={0.45} />
      </mesh>

      {/* Channel faders */}
      {[-0.22, -0.07, 0.08, 0.23].map((x, i) => (
        <group key={i} position={[x, 0.07, 0.12]}>
          <mesh>
            <boxGeometry args={[0.025, 0.008, 0.34]} />
            <meshStandardMaterial color={'#0a0a10'} />
          </mesh>
          {/* Cap parked at a different height per channel */}
          <mesh position={[0, 0.015, -0.1 + i * 0.05]}>
            <boxGeometry args={[0.06, 0.025, 0.045]} />
            <meshStandardMaterial color={'#d8d8e4'} metalness={0.3} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* EQ knobs */}
      {[-0.22, -0.07, 0.08, 0.23].map((x) =>
        [-0.28, -0.18].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.075, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.03, 10]} />
            <meshStandardMaterial color={'#2e2e3c'} metalness={0.6} roughness={0.4} />
          </mesh>
        )),
      )}

      {/* Performance pads */}
      {padCells.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <boxGeometry args={[0.1, 0.025, 0.1]} />
          <meshStandardMaterial
            ref={(m) => {
              pads.current[i] = m as THREE.MeshStandardMaterial | null;
            }}
            color={'#1a1a24'}
            emissive={PAD_COLORS[p.seed % PAD_COLORS.length]}
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function DJStage({ musicOn }: { musicOn: boolean }) {
  return (
    <group position={[0, 0, -12]}>
      {/* Elevated stage */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[8, 0.6, 3]} />
        <meshStandardMaterial color={'#111'} roughness={0.6} />
      </mesh>
      {/* Stage front neon */}
      <mesh position={[0, 0.62, 1.5]}>
        <boxGeometry args={[8, 0.08, 0.08]} />
        <meshStandardMaterial color={NEON_CYAN} emissive={NEON_CYAN} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Stage side neons */}
      <mesh position={[-4, 0.62, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[3, 0.08, 0.08]} />
        <meshStandardMaterial color={NEON_PURPLE} emissive={NEON_PURPLE} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <mesh position={[4, 0.62, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[3, 0.08, 0.08]} />
        <meshStandardMaterial color={NEON_PURPLE} emissive={NEON_PURPLE} emissiveIntensity={4} toneMapped={false} />
      </mesh>

      {/* DJ desk */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[3.5, 0.5, 1.5]} />
        <meshStandardMaterial color={'#1a1a2e'} roughness={0.4} />
      </mesh>
      {/* DJ desk neon front */}
      <mesh position={[0, 0.7, 0.76]}>
        <boxGeometry args={[3.5, 0.06, 0.06]} />
        <meshStandardMaterial color={NEON_PINK} emissive={NEON_PINK} emissiveIntensity={3} toneMapped={false} />
      </mesh>

      <DJConsole musicOn={musicOn} />

      {/* "SÂN KHẤU" sign — above the LED wall so it never covers the video */}
      <Text position={[0, 7.2, -1.3]} fontSize={0.5} color={NEON_CYAN}>
        SÂN KHẤU
        <meshStandardMaterial color={NEON_CYAN} emissive={NEON_CYAN} emissiveIntensity={5} toneMapped={false} />
      </Text>

      {/* Decorative speakers */}
      {[-3.2, 3.2].map((x, i) => (
        <group key={`speaker-${i}`} position={[x, 0.6, -0.5]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.8, 1, 0.8]} />
            <meshStandardMaterial color={'#111'} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.5, 0.41]}>
            <circleGeometry args={[0.25, 16]} />
            <meshStandardMaterial color={'#222'} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// LED Screen
// ---------------------------------------------------------------------------

// Screen plane in world units, and the CSS size the iframe is laid out at.
const SCREEN_W = 10;
const SCREEN_H = SCREEN_W * (9 / 16); // 5.625 — matches 16:9 video, no letterboxing
const SCREEN_PX_W = 1280;
const SCREEN_PX_H = 720;
// drei's <Html transform> scales its content by 1 / ((distanceFactor || 10) / 400),
// i.e. 1 CSS px = 1/40 world unit at scale 1. Undo that to fill the plane exactly.
const HTML_PX_PER_UNIT = 40;
const SCREEN_PX_SCALE = (SCREEN_W / SCREEN_PX_W) * HTML_PX_PER_UNIT;

function LEDScreen({ stageVideo, isPlaying, isMuted, onVideoEnd }: {
  stageVideo?: StageVideo | null;
  isPlaying?: boolean;
  isMuted?: boolean;
  onVideoEnd?: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const playerRef = useRef<YouTubeEvent['target'] | null>(null);
  const gl = useThree((s) => s.gl);

  // drei's blending occlusion sets pointerEvents:'none' on the canvas, which
  // would kill floor/table clicks. The iframe sits *behind* the canvas and is
  // non-interactive by design, so taking pointer events back is safe.
  useEffect(() => {
    if (!stageVideo) return;
    // Deliberate DOM write: we are undoing a style drei set on the canvas.
    // eslint-disable-next-line react-hooks/immutability
    gl.domElement.style.pointerEvents = 'auto';
  }, [gl, stageVideo]);

  useFrame(({ clock }) => {
    // Idle animation only — while a video plays the panel below covers the plane
    if (ref.current && !stageVideo) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      const t = clock.getElapsedTime();
      const r = Math.sin(t * 0.3) * 0.3 + 0.4;
      const g = Math.sin(t * 0.5 + 1) * 0.3 + 0.2;
      const b = Math.sin(t * 0.7 + 2) * 0.3 + 0.5;
      mat.emissive.setRGB(r, g, b);
    }
  });

  // Keep the live player in sync with room state
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (isMuted) p.mute();
    else p.unMute();
  }, [isMuted, stageVideo]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) p.playVideo();
    else p.pauseVideo();
  }, [isPlaying, stageVideo]);

  return (
    <group position={[0, 3.6, -13.7]}>
      {/* Screen frame */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[SCREEN_W + 0.5, SCREEN_H + 0.5, 0.15]} />
        <meshStandardMaterial color={'#111'} />
      </mesh>
      {/* Screen */}
      <mesh ref={ref} position={[0, 0, 0.15]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshStandardMaterial
          color={'#111'}
          emissive={stageVideo ? '#000' : NEON_PURPLE}
          emissiveIntensity={stageVideo ? 0 : 1.5}
        />
      </mesh>

      {/* Live YouTube video projected onto the screen */}
      {stageVideo && (
        <Html
          transform
          position={[0, 0, 0.17]}
          scale={SCREEN_PX_SCALE}
          // "blending" renders a depth-writing, fully transparent plane that
          // punches a hole through the canvas, so lasers / beams / players in
          // front of the screen draw over the video instead of under it.
          occlude="blending"
          // Keeps the canvas (which blending lifts above the iframe) below the
          // 2D HUD panels at z-40 — the default range would bury them.
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{ width: SCREEN_PX_W, height: SCREEN_PX_H, background: '#000', overflow: 'hidden' }}>
            <YouTube
              key={stageVideo.youtubeId}
              videoId={stageVideo.youtubeId}
              opts={{
                width: String(SCREEN_PX_W),
                height: String(SCREEN_PX_H),
                playerVars: {
                  autoplay: 1,
                  controls: 0,
                  modestbranding: 1,
                  rel: 0,
                  playsinline: 1,
                },
              }}
              onReady={(e: YouTubeEvent) => {
                playerRef.current = e.target;
                if (isMuted) e.target.mute();
                else e.target.unMute();
                if (isPlaying) e.target.playVideo();
                else e.target.pauseVideo();
              }}
              onEnd={() => onVideoEnd?.()}
            />
          </div>
        </Html>
      )}

      {/* Spill light so the room reacts to the screen */}
      <pointLight
        color={stageVideo ? '#ffffff' : NEON_PURPLE}
        intensity={stageVideo ? 14 : 6}
        distance={18}
        position={[0, 0, 2]}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Disco ball
// ---------------------------------------------------------------------------

function DiscoBall() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });
  return (
    <group position={[0, 4.8, 0]}>
      {/* Wire */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.8, 4]} />
        <meshStandardMaterial color={'#666'} metalness={0.9} />
      </mesh>
      {/* Ball */}
      <mesh ref={ref}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color={'#ddd'} metalness={1} roughness={0.05} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Decorative pillars with neon
// ---------------------------------------------------------------------------

function NeonPillar({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 4, 8]} />
        <meshStandardMaterial color={'#222'} roughness={0.7} />
      </mesh>
      {/* Neon ring top */}
      <mesh position={[0, 3.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.03, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* Neon ring mid */}
      <mesh position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.03, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {/* Neon ring bottom */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.03, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Decorative plants
// ---------------------------------------------------------------------------

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 8]} />
        <meshStandardMaterial color={'#3a2a1a'} roughness={0.8} />
      </mesh>
      {/* Foliage */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshStandardMaterial color={'#1a4a2a'} emissive={'#0a2a1a'} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.15, 0.9, 0.1]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color={'#2a5a3a'} emissive={'#0a2a1a'} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Neon sign
// ---------------------------------------------------------------------------

function NeonSign({ text, position, color, fontSize, rotation }: {
  text: string;
  position: [number, number, number];
  color: string;
  fontSize?: number;
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <Text
        fontSize={fontSize ?? 0.6}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor={color}
        fontWeight="bold"
      >
        {text}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} toneMapped={false} />
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Beat clock
//
// The track plays inside a cross-origin YouTube iframe, so its audio can't be
// reached by the Web Audio API — there is no real spectrum to read. Everything
// "reacting to the music" is therefore driven off a fixed club tempo, which
// reads convincingly because the room is already pulsing at a steady rate.
// ---------------------------------------------------------------------------

const BPM = 128;

/**
 * Sharp attack, cubic decay — 1.0 on the beat, trailing to 0 before the next.
 * `rate` multiplies the tempo: 2 gives eighth notes, 0.25 gives one per bar.
 */
function beatPulse(t: number, offset = 0, rate = 1) {
  const beat = ((t + offset) * BPM * rate) / 60;
  return Math.pow(1 - (beat - Math.floor(beat)), 3);
}

/** Index of the current bar, for effects that change colour every 4 beats */
function barIndex(t: number) {
  return Math.floor((t * BPM) / 60 / 4);
}

// ---------------------------------------------------------------------------
// PA speaker stacks
// ---------------------------------------------------------------------------

/**
 * One driver in a cabinet. Each gets its own lit surround and its own cone
 * travel, so a stack reads as several speakers working rather than one box
 * wobbling as a unit.
 */
function Woofer({
  y,
  radius,
  color,
  musicOn,
  offset,
}: {
  y: number;
  radius: number;
  color: string;
  musicOn: boolean;
  offset: number;
}) {
  const cone = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  const lamp = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Idle breathing keeps the driver alive when the queue is empty — a
    // completely frozen cone reads as a broken prop, not a speaker at rest.
    const idle = (Math.sin(t * 1.3 + offset * 9) * 0.5 + 0.5) * 0.12;
    const p = musicOn ? Math.max(beatPulse(t, offset), idle) : idle;

    // Cone excursion, scaled to the driver — a big woofer throws further
    if (cone.current) cone.current.position.z = p * radius * 0.75;
    if (ring.current) ring.current.emissiveIntensity = 0.5 + p * 22;
    if (lamp.current) lamp.current.intensity = musicOn ? p * 34 : p * 6;
  });

  return (
    <group position={[0, y, 0.57]}>
      {/* Basket */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.05, 24]} />
        <meshStandardMaterial color={'#121220'} roughness={0.75} />
      </mesh>

      {/* Lit surround */}
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.92, radius * 0.07, 8, 32]} />
        <meshStandardMaterial
          ref={ring}
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          toneMapped={false}
        />
      </mesh>

      {/* Cone + dust cap, travelling together */}
      <group ref={cone}>
        <mesh position={[0, 0, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[radius * 0.84, radius * 0.45, 24, 1, true]} />
          <meshStandardMaterial
            color={'#1b1b26'}
            side={THREE.DoubleSide}
            roughness={0.65}
          />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <sphereGeometry args={[radius * 0.28, 14, 10]} />
          <meshStandardMaterial color={'#2c2c3a'} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>

      <pointLight ref={lamp} color={color} distance={4.5} intensity={0} position={[0, 0, 0.6]} />
    </group>
  );
}

const VU_SEGMENTS = 10;
// Classic bottom-to-top meter ramp: safe green through to clipping red
const VU_GRADIENT = [NEON_GREEN, NEON_GREEN, NEON_YELLOW, NEON_ORANGE, NEON_RED];

function SpeakerStack({
  position,
  musicOn,
  color,
}: {
  position: [number, number, number];
  musicOn: boolean;
  color: string;
}) {
  const cabinet = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const vu = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const pool = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = musicOn ? beatPulse(t) : 0;
    // Half-time swell underneath the beat, so the box breathes as well as kicks
    const sub = musicOn ? beatPulse(t, 0, 0.5) : 0;

    // Whole cabinet kicks up and squashes, like a box being driven hard
    if (cabinet.current) {
      cabinet.current.position.y = p * 0.09 + sub * 0.03;
      cabinet.current.scale.set(1 + p * 0.035, 1 - p * 0.05, 1 + p * 0.035);
    }

    // Cones physically punch outward on the beat
    if (glow.current) glow.current.emissiveIntensity = 0.4 + p * 22;
    if (lamp.current) lamp.current.intensity = musicOn ? 1 + p * 90 : 0.6;
    if (pool.current) pool.current.opacity = musicOn ? 0.08 + p * 0.4 : 0.05;

    // VU column fills from the bottom; each segment is a hard on/off so it
    // reads as a meter rather than a gradient
    const level = Math.max(p, sub * 0.6);
    const lit = Math.round(level * VU_SEGMENTS);
    for (let i = 0; i < vu.current.length; i++) {
      const m = vu.current[i];
      if (m) m.emissiveIntensity = i < lit ? 6 : 0.15;
    }
  });

  return (
    <group position={position}>
      {/* Pool of light the cabinet sits in */}
      <mesh position={[0, 0.03, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 24]} />
        <meshBasicMaterial
          ref={pool}
          color={color}
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={cabinet}>
      {/* Cabinet */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[1.5, 2.7, 1.1]} />
        <meshStandardMaterial color={'#0e0e14'} roughness={0.85} />
      </mesh>

      {/* VU meter running up the side of the box */}
      {Array.from({ length: VU_SEGMENTS }, (_, i) => (
        <mesh key={i} position={[0.77, 0.35 + i * 0.22, 0]}>
          <boxGeometry args={[0.04, 0.14, 0.5]} />
          <meshStandardMaterial
            ref={(m) => {
              vu.current[i] = m as THREE.MeshStandardMaterial | null;
            }}
            color={'#0d0d14'}
            emissive={VU_GRADIENT[Math.floor((i / VU_SEGMENTS) * VU_GRADIENT.length)]}
            emissiveIntensity={0.15}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Grille trim that lights up with the beat */}
      <mesh position={[0, 1.35, 0.56]}>
        <boxGeometry args={[1.3, 2.5, 0.04]} />
        <meshStandardMaterial
          ref={glow}
          color={'#15151d'}
          emissive={color}
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* Drivers: a big low woofer and a smaller mid above it. The mid is
          offset by an eighth so the two cones never punch in lockstep. */}
      <Woofer y={0.72} radius={0.46} color={color} musicOn={musicOn} offset={0} />
      <Woofer y={1.78} radius={0.34} color={color} musicOn={musicOn} offset={0.115} />

      {/* Horn tweeter */}
      <mesh position={[0, 2.5, 0.57]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.25, 4, 1, true]} />
        <meshStandardMaterial color={'#23232d'} side={THREE.DoubleSide} metalness={0.5} />
      </mesh>
      </group>

      <pointLight ref={lamp} color={color} distance={14} intensity={0.6} position={[0, 1.6, 1.2]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Strobes
// ---------------------------------------------------------------------------

function Strobe({
  position,
  color,
  offset,
  musicOn,
}: {
  position: [number, number, number];
  color: string;
  offset: number;
  musicOn: boolean;
}) {
  const lamp = useRef<THREE.PointLight>(null);
  const lens = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Hard on/off rather than a smooth ramp — that snap is what reads as a
    // strobe. Fired on eighth notes so the room keeps punching between beats.
    const p = musicOn ? (beatPulse(t, offset, 2) > 0.5 ? 1 : 0) : 0;
    if (lamp.current) lamp.current.intensity = p * 260;
    if (lens.current) lens.current.emissiveIntensity = 0.2 + p * 30;
  });

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.45, 0.3, 0.25]} />
        <meshStandardMaterial color={'#101018'} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 16]} />
        <meshStandardMaterial
          ref={lens}
          color={'#ffffff'}
          emissive={color}
          emissiveIntensity={0.2}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={lamp} color={color} distance={30} intensity={0} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bar staff
// ---------------------------------------------------------------------------

function StaffMember({
  position,
  characterId,
  name,
  bobPhase,
  height,
}: {
  position: [number, number, number];
  characterId: string;
  name: string;
  bobPhase: number;
  height: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    // Slow idle sway so they don't read as cardboard cut-outs
    const t = clock.getElapsedTime() + bobPhase;
    if (ref.current) {
      ref.current.position.y = Math.sin(t * 1.6) * 0.03;
      ref.current.rotation.z = Math.sin(t * 0.8) * 0.03;
    }
  });

  return (
    <group position={position}>
      <group ref={ref}>
        <CharacterBillboard characterId={characterId} height={height} />
      </group>
      <NameTag
        text={name}
        position={[0, height + 0.3, 0]}
        fontSize={0.13}
        color="#f7e7b0"
        fancy
      />
    </group>
  );
}

// The counter top sits at y = 1.3. Standing on the floor, a 1.7-tall character
// would only clear it by 0.3 — basically just a scalp. Real bars put a raised
// duckboard behind the counter, which is both accurate and fixes the framing:
// feet at 0.45 puts them visible from the chest up.
const STAFF_STEP_H = 0.45;
const STAFF_HEIGHT = 1.7;

function BarStaff() {
  // Local coords are relative to the counter group: the counter runs x -5..5
  // and the back shelves sit at z -1.2, so staff stand between them.
  return (
    <group position={[-17, 0, -6]}>
      {/* Raised duckboard the staff stand on */}
      <mesh position={[0, STAFF_STEP_H / 2, -0.75]} receiveShadow>
        <boxGeometry args={[10, STAFF_STEP_H, 0.9]} />
        <meshStandardMaterial color={'#241608'} roughness={0.8} />
      </mesh>

      <StaffMember
        position={[-2.6, STAFF_STEP_H, -0.75]}
        characterId="meo-f"
        name="Lan (Pha chế)"
        bobPhase={0}
        height={STAFF_HEIGHT}
      />
      <StaffMember
        position={[2.6, STAFF_STEP_H, -0.75]}
        characterId="cun-m"
        name="Tuấn (Pha chế)"
        bobPhase={2.4}
        height={STAFF_HEIGHT}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ceiling
//
// Deliberately plain: a flat dark slab. The room already carries lasers,
// strobes, beams and LED walls — anything patterned up here just competes
// with them and makes the space feel busy.
// ---------------------------------------------------------------------------

const ROOM_W = 48;
const ROOM_D = 28;

function Ceiling() {
  return (
    // Rotating +90° about X turns the plane's normal to face down, so the
    // default FrontSide makes it visible from inside the room only. It must
    // NOT be DoubleSide: the overhead camera presets sit above y = WALL_H and
    // a two-sided ceiling blacks the whole view out.
    <mesh position={[0, WALL_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[ROOM_W, ROOM_D]} />
      <meshStandardMaterial color={'#0a0a12'} roughness={1} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Ceiling cove trim
// ---------------------------------------------------------------------------

/** Neon strips tucked where the ceiling meets the walls */
function CeilingCove({ musicOn }: { musicOn: boolean }) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = musicOn ? beatPulse(t, 0, 0.5) : 0;
    for (let i = 0; i < mats.current.length; i++) {
      const m = mats.current[i];
      if (m) m.emissiveIntensity = 1.6 + p * 3;
    }
  });

  const y = WALL_H - 0.25;
  const strips: { pos: [number, number, number]; args: [number, number, number]; color: string }[] = [
    { pos: [0, y, -13.8], args: [ROOM_W, 0.12, 0.12], color: NEON_PINK },
    { pos: [0, y, 13.8], args: [ROOM_W, 0.12, 0.12], color: NEON_CYAN },
    { pos: [-23.8, y, 0], args: [0.12, 0.12, ROOM_D], color: NEON_PURPLE },
    { pos: [23.8, y, 0], args: [0.12, 0.12, ROOM_D], color: NEON_BLUE },
  ];

  return (
    <>
      {strips.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <boxGeometry args={s.args} />
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m as THREE.MeshStandardMaterial | null;
            }}
            color={s.color}
            emissive={s.color}
            emissiveIntensity={2.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Room-wide colour wash
// ---------------------------------------------------------------------------

const WASH_COLORS = [NEON_PINK, NEON_CYAN, NEON_PURPLE, NEON_GREEN, NEON_ORANGE, NEON_BLUE];

/**
 * Four big lights that slam on every beat and swap colour each bar. Individual
 * fixtures only light their own corner — this is what makes the whole room
 * visibly pump rather than just the ceiling rig.
 */
function BeatWash({ musicOn }: { musicOn: boolean }) {
  const lamps = useRef<(THREE.PointLight | null)[]>([]);
  const spots: [number, number, number][] = [
    [-11, 5.5, -6],
    [11, 5.5, -6],
    [-11, 5.5, 6],
    [11, 5.5, 6],
  ];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const bar = barIndex(t);
    for (let i = 0; i < lamps.current.length; i++) {
      const lamp = lamps.current[i];
      if (!lamp) continue;
      if (!musicOn) {
        lamp.intensity = 4;
        continue;
      }
      // Offset by an eighth per fixture so the wash sweeps across the room
      const p = beatPulse(t, i * 0.12);
      lamp.intensity = 6 + p * 90;
      lamp.color.set(WASH_COLORS[(bar + i) % WASH_COLORS.length]);
    }
  });

  return (
    <>
      {spots.map((p, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lamps.current[i] = el;
          }}
          position={p}
          distance={26}
          intensity={4}
          color={WASH_COLORS[i % WASH_COLORS.length]}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Stage performers
// ---------------------------------------------------------------------------

// Stage deck top. The DJ desk occupies x ±1.75 / z ±0.75 and the stage
// speakers sit at x ±3.2, so performers go in the gaps between them.
const STAGE_TOP = 0.6;
const PERFORMER_H = 1.6;
// Top face of the stage speaker cabinets: they sit on the deck (0.6) and are
// 1.0 tall. Keep in sync with the speaker meshes in DJStage().
const SPEAKER_TOP = STAGE_TOP + 1.0;
const SPEAKER_X = 3.2;
const SPEAKER_Z = -0.5;

function StagePerformer({
  position,
  clipId,
  name,
  phase,
  avatarUrl,
  title,
}: {
  position: [number, number, number];
  clipId: string;
  name: string;
  phase: number;
  avatarUrl?: string;
  /** Title banner slug; each slot carries its rank's title */
  title?: string;
}) {
  return (
    <group position={position}>
      {/* No extra sway here — the clip already carries the motion */}
      <DanceSprite clip={getClip(clipId)} height={PERFORMER_H} phase={phase} />
      {title && <TitleBadge slug={title} position={[0, PERFORMER_H + 0.55, 0]} width={1.6} />}
      <NameTag
        text={name}
        position={[0, PERFORMER_H + 0.3, 0]}
        fontSize={0.12}
        avatarUrl={avatarUrl}
      />
    </group>
  );
}

// Slot 0 is the centre DJ spot — top gifter stands there. Slots 1 and 2 are
// the speaker cabinets either side, so nothing occludes them.
export const STAGE_SLOTS: { pos: [number, number, number]; name: string; clip: string; phase: number }[] = [
  { pos: [0, STAGE_TOP, -1.1], name: 'Khoa (DJ)', clip: 'mushroom_dance_01', phase: 0 },
  { pos: [-SPEAKER_X, SPEAKER_TOP, SPEAKER_Z], name: 'Hà (Vũ công)', clip: 'g', phase: 1.7 },
  { pos: [SPEAKER_X, SPEAKER_TOP, SPEAKER_Z], name: 'Vy (Vũ công)', clip: 'j', phase: 3.4 },
];

function StagePerformers({
  top = [],
  skins = {},
}: {
  /** Top gift senders, ranked — they replace the house cast */
  top?: TikTokGifter[];
  /** userId -> clip id, set when someone sends the skin-swap gift */
  skins?: Record<string, string>;
}) {
  return (
    <group position={[0, 0, -12]}>
      {STAGE_SLOTS.map((slot, i) => {
        const guest = top[i];
        return (
          <StagePerformer
            key={i}
            position={slot.pos}
            clipId={(guest && skins[guest.userId]) || slot.clip}
            name={guest ? guest.nickname : slot.name}
            avatarUrl={guest?.avatarUrl}
            title={STAGE_TITLES[i]}
            phase={slot.phase}
          />
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// LED equalizer columns
// ---------------------------------------------------------------------------

// Bottom-to-top gradient for a column of LED segments
const EQ_GRADIENT = [
  NEON_GREEN,
  '#4ade80',
  NEON_CYAN,
  '#22d3ee',
  NEON_BLUE,
  '#818cf8',
  NEON_PURPLE,
  '#d946ef',
  NEON_PINK,
  NEON_RED,
];

const SEG_H = 0.26;
const SEG_GAP = 1.18;

function LedColumn({
  position,
  segments = 14,
  phase = 0,
  width = 0.42,
  musicOn = false,
}: {
  position: [number, number, number];
  segments?: number;
  phase?: number;
  width?: number;
  musicOn?: boolean;
}) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Two detuned sines fake a bass beat riding under a faster flicker
    const idle =
      (Math.sin(t * 2.3 + phase) * 0.5 + 0.5) * 0.65 +
      (Math.sin(t * 5.7 + phase * 1.7) * 0.5 + 0.5) * 0.35;
    // With a track on, the beat drives the meter and the idle wave just adds
    // texture — so the columns slam to the top in time with everything else.
    const level = musicOn
      ? Math.min(1, beatPulse(t, phase * 0.02) * 0.75 + idle * 0.45)
      : idle * 0.75;
    const lit = Math.round(level * segments);
    for (let i = 0; i < mats.current.length; i++) {
      const m = mats.current[i];
      if (m) m.emissiveIntensity = i < lit ? 4.5 : 0.1;
    }
  });

  return (
    <group position={position}>
      {Array.from({ length: segments }, (_, i) => {
        const color = EQ_GRADIENT[Math.floor((i / segments) * EQ_GRADIENT.length)];
        return (
          <mesh key={i} position={[0, i * SEG_H * SEG_GAP, 0]}>
            <boxGeometry args={[width, SEG_H, 0.1]} />
            <meshStandardMaterial
              ref={(m) => {
                mats.current[i] = m as THREE.MeshStandardMaterial | null;
              }}
              color={color}
              emissive={color}
              emissiveIntensity={0.1}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function LedWall({
  position,
  rotation = [0, 0, 0],
  columns = 5,
  segments = 14,
  musicOn = false,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  columns?: number;
  segments?: number;
  musicOn?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Dark backing board so unlit segments read as "off" rather than floating */}
      <mesh position={[0, (segments * SEG_H * SEG_GAP) / 2 - SEG_H / 2, -0.08]}>
        <boxGeometry args={[columns * 0.58 + 0.2, segments * SEG_H * SEG_GAP + 0.2, 0.08]} />
        <meshStandardMaterial color={'#0b0b12'} roughness={0.9} />
      </mesh>
      {Array.from({ length: columns }, (_, i) => (
        <LedColumn
          key={i}
          position={[(i - (columns - 1) / 2) * 0.58, 0, 0]}
          phase={i * 1.35}
          segments={segments}
          musicOn={musicOn}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Volumetric spotlight beams + the pool of light they cast
// ---------------------------------------------------------------------------

function SpotBeam({
  position,
  color,
  length = 7,
  spread = 0.9,
  speed = 0.5,
  phase = 0,
  musicOn = false,
}: {
  position: [number, number, number];
  color: string;
  length?: number;
  spread?: number;
  speed?: number;
  phase?: number;
  musicOn?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const coneMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const swingZ = Math.sin(t * speed + phase) * 0.38;
    const swingX = Math.cos(t * speed * 0.73 + phase) * 0.28;
    if (ref.current) {
      ref.current.rotation.z = swingZ;
      ref.current.rotation.x = swingX;
    }

    // The beam itself thickens on the beat — a haze-filled room would do this
    const p = musicOn ? beatPulse(t, phase * 0.05) : 0;
    if (coneMat.current) coneMat.current.opacity = 0.08 + p * 0.3;
    if (glowMat.current) glowMat.current.opacity = 0.2 + p * 0.55;
    // Move the floor pool to roughly where the beam now points
    if (glow.current) {
      glow.current.position.x = position[0] + Math.tan(swingZ) * -length;
      glow.current.position.z = position[2] + Math.tan(swingX) * length;
    }
  });

  return (
    <>
      <group position={position} ref={ref}>
        <mesh position={[0, -length / 2, 0]}>
          <coneGeometry args={[spread, length, 20, 1, true]} />
          <meshBasicMaterial
            ref={coneMat}
            color={color}
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* Lamp housing at the ceiling */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.22, 0.3, 0.3, 12]} />
          <meshStandardMaterial color={'#15151f'} roughness={0.7} />
        </mesh>
      </group>

      <mesh ref={glow} position={[position[0], 0.025, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[spread * 1.5, 28]} />
        <meshBasicMaterial
          ref={glowMat}
          color={color}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Laser fans
// ---------------------------------------------------------------------------

/**
 * A rig of hairline laser rays sweeping out of a ceiling emitter.
 *
 * Drawn with drei's <Line> (Line2 under the hood) rather than thin cylinders:
 * lineWidth is measured in screen pixels, so the rays keep a constant hairline
 * thickness at any distance instead of shimmering away into sub-pixel noise.
 */
function LaserFan({
  position,
  color,
  rays = 12,
  length = 34,
  spread = 1.25,
  tilt = 0.35,
  speed = 0.26,
  phase = 0,
  musicOn = false,
}: {
  position: [number, number, number];
  color: string;
  rays?: number;
  length?: number;
  spread?: number;
  tilt?: number;
  speed?: number;
  phase?: number;
  musicOn?: boolean;
}) {
  const swing = useRef<THREE.Group>(null);
  const mats = useRef<(THREE.Material & { opacity: number })[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    const p = musicOn ? beatPulse(t, phase * 0.05) : 0;
    const opacity = musicOn ? 0.25 + p * 0.7 : 0.4;
    for (const m of mats.current) if (m) m.opacity = opacity;

    if (swing.current) {
      // Gentle sweep only — the rays should read as an even rake of light
      // across the room, not a searchlight whipping around
      swing.current.rotation.y = Math.sin(t * speed + phase) * 0.3;
      swing.current.rotation.z = Math.sin(t * speed * 0.63 + phase * 1.3) * 0.1;
    }
  });

  const beams = useMemo(
    () =>
      Array.from({ length: rays }, (_, i) => {
        const a = (i / (rays - 1) - 0.5) * spread;
        return [
          [0, 0, 0] as [number, number, number],
          [Math.sin(a) * length, -Math.cos(a) * length, 0] as [number, number, number],
        ];
      }),
    [rays, spread, length],
  );

  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      {/* Emitter housing */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.5]} />
        <meshStandardMaterial color={'#121219'} roughness={0.8} />
      </mesh>

      <group ref={swing}>
        {beams.map((points, i) => (
          <Line
            key={i}
            ref={(el) => {
              if (el) mats.current[i] = el.material as THREE.Material & { opacity: number };
            }}
            points={points}
            color={color}
            lineWidth={1.1}
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Confetti drops
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [
  NEON_PINK,
  NEON_CYAN,
  NEON_YELLOW,
  NEON_GREEN,
  NEON_PURPLE,
  NEON_ORANGE,
];

interface ConfettiPiece {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  spinX: number;
  spinZ: number;
  alive: boolean;
}

/**
 * Paper confetti that drops from the ceiling every half-minute or so.
 * All pieces live in one InstancedMesh, so the whole effect is a single
 * draw call no matter how many flakes are in the air.
 */
function Confetti({ count = 160 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // Refs rather than useMemo: these are mutated every frame, which is exactly
  // what refs are the escape hatch for. Mutating a render-time value instead
  // breaks the rules the React Compiler relies on.
  const dummy = useRef(new THREE.Object3D());
  const pieces = useRef<ConfettiPiece[]>([]);
  // Seeded on the first frame — Math.random() during render is impure
  const nextBurst = useRef(0);

  // Per-instance colour, assigned once
  useEffect(() => {
    if (!mesh.current) return;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      mesh.current.setColorAt(i, c);
    }
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [count]);

  useFrame(({ clock }, delta) => {
    if (!mesh.current) return;
    // Lazy init here rather than in an effect: the pool is only ever touched
    // from this frame loop, so it never crosses a render boundary.
    if (pieces.current.length !== count) {
      pieces.current = Array.from({ length: count }, () => ({
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        spinX: 0, spinZ: 0,
        alive: false,
      }));
    }
    const list = pieces.current;
    // Clamp dt so returning to a backgrounded tab doesn't teleport every piece
    const d = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const obj = dummy.current;

    if (nextBurst.current === 0) {
      nextBurst.current = t + 12 + Math.random() * 10;
    } else if (t > nextBurst.current) {
      nextBurst.current = t + 28 + Math.random() * 22;
      for (const p of list) {
        p.x = (Math.random() - 0.5) * 26;
        p.y = WALL_H - 0.3 + Math.random() * 1.5;
        p.z = (Math.random() - 0.5) * 20;
        p.vx = (Math.random() - 0.5) * 0.7;
        p.vy = -(0.5 + Math.random() * 0.6);
        p.vz = (Math.random() - 0.5) * 0.7;
        p.rx = Math.random() * Math.PI;
        p.ry = Math.random() * Math.PI;
        p.rz = Math.random() * Math.PI;
        p.spinX = (Math.random() - 0.5) * 6;
        p.spinZ = (Math.random() - 0.5) * 6;
        p.alive = true;
      }
    }

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.alive) {
        p.vy -= 0.45 * d;
        if (p.vy < -2.2) p.vy = -2.2; // air drag gives paper a terminal velocity
        // Flutter: each flake drifts on its own phase as it tumbles
        p.x += (p.vx + Math.sin(t * 2 + i) * 0.35) * d;
        p.z += (p.vz + Math.cos(t * 1.7 + i) * 0.35) * d;
        p.y += p.vy * d;
        p.rx += p.spinX * d;
        p.rz += p.spinZ * d;
        if (p.y <= 0) p.alive = false;

        obj.position.set(p.x, p.y, p.z);
        obj.rotation.set(p.rx, p.ry, p.rz);
        obj.scale.setScalar(1);
      } else {
        // Park dead pieces out of sight at zero scale
        obj.position.set(0, -10, 0);
        obj.rotation.set(0, 0, 0);
        obj.scale.setScalar(0);
      }
      obj.updateMatrix();
      mesh.current.setMatrixAt(i, obj.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.1, 0.16]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Animated lights
// ---------------------------------------------------------------------------

function AnimatedLights() {
  const light1 = useRef<THREE.PointLight>(null);
  const light2 = useRef<THREE.PointLight>(null);
  const light3 = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (light1.current) {
      light1.current.position.x = Math.sin(t * 0.7) * 5;
      light1.current.position.z = Math.cos(t * 0.7) * 5;
    }
    if (light2.current) {
      light2.current.position.x = Math.cos(t * 0.5) * 7;
      light2.current.position.z = Math.sin(t * 0.5 + 2) * 5;
    }
    if (light3.current) {
      light3.current.position.x = Math.sin(t * 0.9 + 4) * 6;
      light3.current.position.z = Math.cos(t * 0.6 + 1) * 7;
    }
  });

  return (
    <>
      <pointLight ref={light1} color={NEON_PURPLE} intensity={15} distance={20} position={[0, 4, 0]} />
      <pointLight ref={light2} color={NEON_PINK} intensity={12} distance={18} position={[3, 4, 2]} />
      <pointLight ref={light3} color={NEON_BLUE} intensity={12} distance={18} position={[-3, 4, -2]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

function Lighting() {
  return (
    <>
      <ambientLight intensity={1.15} color={'#b9b9e0'} />
      <hemisphereLight args={['#8a8ad0', '#2a2a3a', 0.9]} />
      <directionalLight color={'#ffffff'} intensity={0.4} position={[5, 10, 5]} />

      {/* Colored area lights */}
      <pointLight color={NEON_PURPLE} intensity={15} distance={30} position={[-8, 4, -8]} />
      <pointLight color={NEON_BLUE} intensity={12} distance={25} position={[15, 3, -6]} />
      <pointLight color={NEON_PINK} intensity={12} distance={25} position={[8, 3, 8]} />
      <pointLight color={NEON_RED} intensity={10} distance={20} position={[-15, 3, 6]} />
      <pointLight color={NEON_CYAN} intensity={10} distance={20} position={[0, 3, -10]} />

      {/* Spotlight on dance floor */}
      <spotLight color={'#ffffff'} intensity={25} distance={18} angle={0.6} penumbra={0.8} position={[0, 5.5, 0]} castShadow />

      {/* Bar area warm light */}
      <pointLight color={'#ff9944'} intensity={12} distance={18} position={[-17, 3, -5]} />

      {/* Stage lights */}
      <pointLight color={NEON_CYAN} intensity={10} distance={15} position={[0, 4, -11]} />

      <AnimatedLights />
    </>
  );
}

// ---------------------------------------------------------------------------
// Default tables layout (used when server only sends 2 tables)
// ---------------------------------------------------------------------------

const DEFAULT_BOOTH_POSITIONS: { pos: [number, number, number]; label: string }[] = [
  // Left side VIP booths
  { pos: [-8, 0, -8], label: 'VV1' },
  { pos: [-8, 0, -4], label: 'VV2' },
  { pos: [-8, 0, 0], label: 'VV3' },
  { pos: [-8, 0, 4], label: 'VV4' },
  { pos: [-8, 0, 8], label: 'VV5' },
  // Right side VIP booths
  { pos: [18, 0, -8], label: 'VV6' },
  { pos: [18, 0, -4], label: 'VV7' },
  { pos: [18, 0, 0], label: 'VV8' },
  { pos: [18, 0, 4], label: 'VV9' },
  { pos: [18, 0, 8], label: 'VV10' },
  // Front row
  { pos: [-3, 0, 7], label: 'V1' },
  { pos: [3, 0, 7], label: 'V2' },
  { pos: [-3, 0, 11], label: 'V3' },
  { pos: [3, 0, 11], label: 'V4' },
  // Around stage (centered stage spans x -4..4 at z -12)
  { pos: [-7, 0, -11], label: 'SV1' },
  { pos: [7, 0, -11], label: 'SV2' },
];

// ---------------------------------------------------------------------------
// Main scene content
// ---------------------------------------------------------------------------

function SceneContent({
  tables,
  onTableClick,
  highlightedTable,
  onFloorClick,
  stageVideo,
  isPlaying,
  isMuted,
  onVideoEnd,
  tiktokTop,
  tiktokSkins,
  children,
}: BarSceneProps) {
  const allTables = useMemo(() => {
    if (tables.length > 2) return tables;
    return DEFAULT_BOOTH_POSITIONS.map((b, i) => ({
      id: tables[i]?.id ?? `booth-${i}`,
      position: b.pos,
      seats: 4,
    }));
  }, [tables]);

  // "Music is on" means a track is loaded *and* running — a paused queue
  // shouldn't leave the whole room pulsing.
  const musicOn = !!stageVideo && !!isPlaying;

  return (
    <>
      <Lighting />
      <Floor />
      <Walls />
      <BarCounter />
      <BarStaff />
      <StagePerformers top={tiktokTop} skins={tiktokSkins} />
      <DanceFloorTiles />
      <DiscoBall />
      <DJStage musicOn={musicOn} />
      <LEDScreen
        stageVideo={stageVideo}
        isPlaying={isPlaying}
        isMuted={isMuted}
        onVideoEnd={onVideoEnd}
      />

      {/* Clickable floor for movement */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.point && onFloorClick) {
            onFloorClick({ x: e.point.x, y: 0, z: e.point.z });
          }
        }}
      >
        <planeGeometry args={[50, 30]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Booth tables */}
      {allTables.map((t, i) => (
        <BoothTable
          key={t.id}
          table={t}
          highlighted={highlightedTable === t.id}
          onClick={() => onTableClick(t.id)}
          label={DEFAULT_BOOTH_POSITIONS[i]?.label ?? t.id}
        />
      ))}

      {/* LED equalizer walls — flanking the stage screen and down both side walls */}
      <LedWall position={[-7.5, 0.6, -13.7]} columns={4} musicOn={musicOn} />
      <LedWall position={[7.5, 0.6, -13.7]} columns={4} musicOn={musicOn} />
      <LedWall
        position={[-23.7, 0.6, -4]}
        rotation={[0, Math.PI / 2, 0]}
        columns={5}
        musicOn={musicOn}
      />
      <LedWall
        position={[23.7, 0.6, -4]}
        rotation={[0, -Math.PI / 2, 0]}
        columns={5}
        musicOn={musicOn}
      />

      {/* PA stacks — two flanking the stage, two at the ends of the bar */}
      <SpeakerStack position={[-10.5, 0, -12.3]} color={NEON_PINK} musicOn={musicOn} />
      <SpeakerStack position={[10.5, 0, -12.3]} color={NEON_CYAN} musicOn={musicOn} />
      <SpeakerStack position={[-22.6, 0, -4.6]} color={NEON_ORANGE} musicOn={musicOn} />
      <SpeakerStack position={[-11.6, 0, -4.6]} color={NEON_PURPLE} musicOn={musicOn} />

      {/* Strobes, offset so they chase rather than all firing at once */}
      <Strobe position={[-6, 7.5, -6]} color={'#ffffff'} offset={0} musicOn={musicOn} />
      <Strobe position={[6, 7.5, -6]} color={'#ffffff'} offset={0.12} musicOn={musicOn} />
      <Strobe position={[-6, 7.5, 2]} color={NEON_CYAN} offset={0.24} musicOn={musicOn} />
      <Strobe position={[6, 7.5, 2]} color={NEON_PINK} offset={0.36} musicOn={musicOn} />

      {/* Moving spotlight beams from the ceiling */}
      <SpotBeam position={[-4, 7.6, -2]} color={NEON_PINK} phase={0} musicOn={musicOn} />
      <SpotBeam position={[4, 7.6, -2]} color={NEON_CYAN} phase={1.6} musicOn={musicOn} />
      <SpotBeam
        position={[0, 7.6, 3]}
        color={'#ffffff'}
        phase={3.1}
        speed={0.38}
        musicOn={musicOn}
      />
      <SpotBeam
        position={[-9, 7.6, -8]}
        color={NEON_PURPLE}
        phase={4.2}
        speed={0.44}
        musicOn={musicOn}
      />
      <SpotBeam
        position={[9, 7.6, -8]}
        color={NEON_BLUE}
        phase={5.5}
        speed={0.56}
        musicOn={musicOn}
      />

      <BeatWash musicOn={musicOn} />
      <Ceiling />
      <CeilingCove musicOn={musicOn} />

      <Confetti />

      {/* Laser rigs raking across the room.
          tilt ≈ ±π/2 lays the fan flat so the rays cross the floor plane
          horizontally; a small offset from π/2 angles them gently downward. */}
      <LaserFan
        position={[-18, 6.6, 11]}
        color={NEON_PINK}
        tilt={Math.PI / 2 - 0.22}
        phase={0}
        musicOn={musicOn}
      />
      <LaserFan
        position={[18, 6.6, 11]}
        color={NEON_CYAN}
        tilt={Math.PI / 2 - 0.22}
        phase={2.1}
        speed={0.31}
        musicOn={musicOn}
      />
      <LaserFan
        position={[0, 7.2, -12.5]}
        color={NEON_GREEN}
        tilt={-(Math.PI / 2 - 0.3)}
        phase={4.0}
        speed={0.22}
        musicOn={musicOn}
      />
      <LaserFan
        position={[0, 7.4, 2]}
        color={NEON_PURPLE}
        tilt={0.45}
        length={16}
        phase={5.3}
        speed={0.28}
        musicOn={musicOn}
      />

      {/* Neon pillars */}
      <NeonPillar position={[-5, 0, -5]} color={NEON_PURPLE} />
      <NeonPillar position={[5, 0, -5]} color={NEON_PINK} />
      <NeonPillar position={[-5, 0, 5]} color={NEON_BLUE} />
      <NeonPillar position={[5, 0, 5]} color={NEON_CYAN} />
      <NeonPillar position={[-12, 0, -10]} color={NEON_ORANGE} />
      <NeonPillar position={[22, 0, -10]} color={NEON_RED} />

      {/* Plants */}
      <Plant position={[-23, 0, -12]} />
      <Plant position={[23, 0, -12]} />
      <Plant position={[-23, 0, 12]} />
      <Plant position={[23, 0, 12]} />
      <Plant position={[-12, 0, 10]} />
      <Plant position={[12, 0, 10]} />

      {/* Neon signs */}
      <NeonSign text="BAR" position={[-17, 3.8, -13.8]} color={NEON_RED} fontSize={0.8} />
      <NeonSign text="OPEN" position={[-17, 3, -13.8]} color={NEON_GREEN} fontSize={0.5} />
      <NeonSign text="DANCE" position={[-13, 5.5, -13.8]} color={NEON_PINK} fontSize={0.7} />
      <NeonSign text="VIP" position={[20, 3.8, -13.8]} color={NEON_PURPLE} fontSize={0.8} />
      <NeonSign text="DRINK or DANCE" position={[-17, 4.5, -7]} color={NEON_YELLOW} fontSize={0.3} rotation={[0, Math.PI / 2, 0]} />
      <NeonSign text="HANOI" position={[20, 3, 5]} color={NEON_RED} fontSize={0.7} rotation={[0, -Math.PI / 2, 0]} />
      <NeonSign text="PRESIDENT" position={[0, 0.1, 8.5]} color={NEON_CYAN} fontSize={0.4} rotation={[-Math.PI / 2, 0, 0]} />

      {children}

      <fog attach="fog" args={['#0a0a14', 25, 55]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export { SceneContent };

export default function BarScene({
  tables,
  onTableClick,
  highlightedTable,
  onFloorClick,
  stageVideo,
  isPlaying,
  isMuted,
  onVideoEnd,
  tiktokTop,
  tiktokSkins,
  children,
}: BarSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [10, 12, 14], fov: 55, near: 0.1, far: 120 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.LinearToneMapping, toneMappingExposure: 1.0 }}
      // The background lives on the wrapper div, not the canvas: a CSS
      // background on the canvas itself would paint over the iframe behind it.
      style={{ width: '100%', height: '100%', background: '#0a0a14' }}
      fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: '#111' }}>WebGL không khả dụng</div>}
      onCreated={(state) => {
        // Clear alpha 0 so the occlusion hole stays see-through
        state.gl.setClearColor('#0a0a14', 0);
      }}
    >
      <SceneContent
        tables={tables}
        onTableClick={onTableClick}
        highlightedTable={highlightedTable}
        onFloorClick={onFloorClick}
        stageVideo={stageVideo}
        isPlaying={isPlaying}
        isMuted={isMuted}
        onVideoEnd={onVideoEnd}
        tiktokTop={tiktokTop}
        tiktokSkins={tiktokSkins}
      >
        {children}
      </SceneContent>
    </Canvas>
  );
}
