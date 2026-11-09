'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import DanceSprite from './DanceSprite';
import InstancedDancers, { type Dancer } from './InstancedDancers';
import { DANCE_CLIPS, getClip } from './dances';

// ---------------------------------------------------------------------------
// Load test: scatter N animated dancers across the floor and report what it
// costs. Flip STRESS_TEST off for normal play.
//
// INSTANCED toggles between the two renderers so the cost can be compared
// directly: one mesh per dancer, versus one mesh per clip.
// ---------------------------------------------------------------------------

export const STRESS_TEST = false;
export const STRESS_COUNT = 50;
export const INSTANCED = true;

export interface PerfSample {
  fps: number;
  calls: number;
  triangles: number;
  textures: number;
  programs: number;
}

/** Deterministic PRNG so every run places the crowd identically */
function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function PerfProbe({ onSample }: { onSample: (s: PerfSample) => void }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, time: 0 });

  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.time += delta;
    if (a.time < 0.5) return;

    onSample({
      fps: a.frames / a.time,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
    });
    a.frames = 0;
    a.time = 0;
  });

  return null;
}

export default function StressTest({
  count = STRESS_COUNT,
  onSample,
}: {
  count?: number;
  onSample?: (s: PerfSample) => void;
}) {
  const crowd = useMemo<Dancer[]>(() => {
    const rand = makeRandom(1337);
    return Array.from({ length: count }, () => ({
      // Spread over the whole floor, leaving the walls a little clearance
      x: (rand() - 0.5) * 44,
      z: (rand() - 0.5) * 26,
      clipId: DANCE_CLIPS[Math.floor(rand() * DANCE_CLIPS.length)].id,
      phase: rand() * 10,
    }));
  }, [count]);

  return (
    <group>
      {onSample && <PerfProbe onSample={onSample} />}

      {INSTANCED ? (
        <InstancedDancers dancers={crowd} height={1.7} />
      ) : (
        crowd.map((d, i) => (
          <group key={i} position={[d.x, 0, d.z]}>
            <DanceSprite clip={getClip(d.clipId)} height={1.7} phase={d.phase} />
          </group>
        ))
      )}
    </group>
  );
}
