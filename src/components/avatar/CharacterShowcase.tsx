'use client';

import { Text } from '@react-three/drei';
import DanceSprite from './DanceSprite';
import { DANCE_CLIPS } from './dances';

// ---------------------------------------------------------------------------
// Debug-only gallery: every animated player clip laid out on the floor so they
// can be eyeballed in one pass. Flip to false to hide.
//
// Heads-up: this mounts all clips at once, which pulls every frame in
// public/characters (~13MB). The game itself only loads the clips in use.
// ---------------------------------------------------------------------------

export const SHOW_CHARACTER_SHOWCASE = false;

const COLS = 9;
const COL_GAP = 2.0;
const ROW_GAP = 2.8;
const GRID_Z = -6;

function Caption({ z, text }: { z: number; text: string }) {
  return (
    <Text
      position={[0, 0.06, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.45}
      color="#facc15"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.012}
      outlineColor="#000000"
    >
      {text}
    </Text>
  );
}

function Label({ text, y }: { text: string; y: number }) {
  return (
    <Text
      position={[0, y, 0]}
      fontSize={0.11}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.008}
      outlineColor="#000000"
      maxWidth={1.9}
      textAlign="center"
    >
      {text}
    </Text>
  );
}

export default function CharacterShowcase() {
  return (
    <group>
      <Caption z={GRID_Z - 1.9} text={`CLIP NHẢY (${DANCE_CLIPS.length})`} />
      {DANCE_CLIPS.map((clip, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = (col - (COLS - 1) / 2) * COL_GAP;
        const z = GRID_Z + row * ROW_GAP;
        return (
          <group key={clip.id} position={[x, 0, z]}>
            <DanceSprite clip={clip} height={1.7} phase={i * 0.37} />
            <Label y={1.85} text={`${clip.id}\n${clip.frames}f @${clip.fps}`} />
          </group>
        );
      })}
    </group>
  );
}
