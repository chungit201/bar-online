'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableData {
  id: string;
  position: [number, number, number];
  seats: number;
}

interface BarSceneProps {
  tables: TableData[];
  onTableClick: (tableId: string) => void;
  highlightedTable?: string;
  onFloorClick?: (point: { x: number; y: number; z: number }) => void;
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
      {/* "SÀN NHẢY" label */}
      <Text position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.6} color={NEON_PINK}>
        SÀN NHẢY
        <meshStandardMaterial color={NEON_PINK} emissive={NEON_PINK} emissiveIntensity={3} toneMapped={false} />
      </Text>
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

function Walls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 2.5, -14]}>
        <boxGeometry args={[50, 5, 0.3]} />
        <meshStandardMaterial color={DARK_WALL} roughness={0.9} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-24, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[28, 5, 0.3]} />
        <meshStandardMaterial color={DARK_WALL} roughness={0.9} />
      </mesh>
      {/* Right wall */}
      <mesh position={[24, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[28, 5, 0.3]} />
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

function DJStage() {
  return (
    <group position={[8, 0, -12]}>
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

      {/* "SÂN KHẤU" sign */}
      <Text position={[0, 3.5, -1.3]} fontSize={0.5} color={NEON_CYAN}>
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

function LEDScreen() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      const t = clock.getElapsedTime();
      const r = Math.sin(t * 0.3) * 0.3 + 0.4;
      const g = Math.sin(t * 0.5 + 1) * 0.3 + 0.2;
      const b = Math.sin(t * 0.7 + 2) * 0.3 + 0.5;
      mat.emissive.setRGB(r, g, b);
    }
  });
  return (
    <group position={[8, 3.2, -13.7]}>
      {/* Screen frame */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[10.5, 5.5, 0.15]} />
        <meshStandardMaterial color={'#111'} />
      </mesh>
      {/* Screen */}
      <mesh ref={ref} position={[0, 0, 0.15]}>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color={'#111'} emissive={NEON_PURPLE} emissiveIntensity={1.5} />
      </mesh>
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
      <ambientLight intensity={0.8} color={'#aaaacc'} />
      <hemisphereLight args={['#6666aa', '#222', 0.6]} />
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
      <pointLight color={NEON_CYAN} intensity={10} distance={15} position={[8, 4, -11]} />

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
  // Around stage
  { pos: [14, 0, -8], label: 'SV1' },
  { pos: [14, 0, -4], label: 'SV2' },
];

// ---------------------------------------------------------------------------
// Main scene content
// ---------------------------------------------------------------------------

function SceneContent({
  tables,
  onTableClick,
  highlightedTable,
  onFloorClick,
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

  return (
    <>
      <Lighting />
      <Floor />
      <Walls />
      <BarCounter />
      <DanceFloorTiles />
      <DiscoBall />
      <DJStage />
      <LEDScreen />

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
      <NeonSign text="DANCE" position={[0, 4, -5]} color={NEON_PINK} fontSize={0.7} />
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

export default function BarScene({ tables, onTableClick, highlightedTable, onFloorClick, children }: BarSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [10, 12, 14], fov: 55, near: 0.1, far: 120 }}
      gl={{ antialias: true, toneMapping: THREE.LinearToneMapping, toneMappingExposure: 1.0 }}
      style={{ width: '100%', height: '100%' }}
      fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: '#111' }}>WebGL không khả dụng</div>}
      onCreated={(state) => {
        state.gl.setClearColor('#0a0a14');
      }}
    >
      <SceneContent tables={tables} onTableClick={onTableClick} highlightedTable={highlightedTable} onFloorClick={onFloorClick}>
        {children}
      </SceneContent>
    </Canvas>
  );
}
