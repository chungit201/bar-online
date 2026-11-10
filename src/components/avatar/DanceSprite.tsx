'use client';

import { useEffect, useRef, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { frameUrl, type DanceClip } from './dances';

/**
 * Loaded frames per clip, shared by every player using that clip — ten players
 * on the same dance cost one set of textures, not ten.
 */
const clipCache = new Map<string, THREE.Texture[]>();
const inFlight = new Set<string>();

function useClipFrames(clip: DanceClip) {
  // Read the cache during render; only tick a counter from the async callback
  const [, bumpVersion] = useState(0);
  const frames = clipCache.get(clip.id) ?? null;

  useEffect(() => {
    if (clipCache.has(clip.id) || inFlight.has(clip.id)) return;
    inFlight.add(clip.id);

    let cancelled = false;
    const loader = new THREE.TextureLoader();

    Promise.all(
      Array.from(
        { length: clip.frames },
        (_, i) =>
          new Promise<THREE.Texture>((resolve, reject) => {
            loader.load(
              frameUrl(clip.id, i),
              (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.magFilter = THREE.LinearFilter;
                tex.minFilter = THREE.LinearMipmapLinearFilter;
                tex.generateMipmaps = true;
                tex.anisotropy = 4;
                resolve(tex);
              },
              undefined,
              reject,
            );
          }),
      ),
    )
      .then((list) => {
        clipCache.set(clip.id, list);
        inFlight.delete(clip.id);
        if (!cancelled) bumpVersion((v) => v + 1);
      })
      .catch(() => {
        inFlight.delete(clip.id);
      });

    return () => {
      cancelled = true;
    };
  }, [clip]);

  return frames;
}

interface DanceSpriteProps {
  clip: DanceClip;
  /** World height of the sprite, feet at y = 0 */
  height?: number;
  /** Seconds of offset so two players on one clip aren't frame-locked */
  phase?: number;
  /** Shown while the frames are still downloading, so nobody blinks out */
  fallback?: React.ReactNode;
}

export default function DanceSprite({
  clip,
  height = 1.7,
  phase = 0,
  fallback = null,
}: DanceSpriteProps) {
  const frames = useClipFrames(clip);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef(-1);

  useFrame(({ clock }) => {
    if (!frames || !matRef.current) return;
    const i = Math.floor((clock.getElapsedTime() + phase) * clip.fps) % frames.length;
    if (i === shown.current) return; // only touch the material on a real frame change
    shown.current = i;
    matRef.current.map = frames[i];
    matRef.current.needsUpdate = true;
  });

  if (!frames) return <>{fallback}</>;

  // `height` is the height of the *character*, not of the PNG. The canvas has
  // to be scaled up by however much of it the character fails to fill, or
  // clips with generous padding render visibly shorter than tightly cropped
  // ones — which is what made the crowd look so uneven.
  const trim = clip.trim;
  const fill = trim ? trim.bottom - trim.top : 1;
  // `scale` pulls cropped portraits back down — see the field's note in dances.ts
  const planeH = (height * (clip.scale ?? 1)) / fill;
  const planeW = planeH * (clip.width / clip.height);

  // Plant the feet on y = 0 and centre the body on x = 0, using the measured
  // box rather than the canvas, so padding can't shift a dancer off their spot
  // or leave them hovering.
  const bottom = trim ? trim.bottom : 1;
  const centreX = trim ? (trim.left + trim.right) / 2 : 0.5;
  const offsetY = planeH * (bottom - 0.5);
  const offsetX = planeW * (0.5 - centreX);

  return (
    // The horizontal shift goes on the mesh, inside the billboard, so it
    // travels along the sprite's own right axis as it turns to face the
    // camera. On the Billboard itself it would stay locked to world X and
    // slide the character sideways as the camera orbits.
    <Billboard position={[0, offsetY, 0]}>
      <mesh position={[offsetX, 0, 0]}>
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial
          ref={matRef}
          map={frames[0]}
          transparent
          alphaTest={0.25}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}
