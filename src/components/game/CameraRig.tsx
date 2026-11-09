'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Owns the camera. Every frame it eases the camera position and the orbit
 * target toward the requested pose, so switching views, following a player and
 * the cinematic auto-pan all glide instead of cutting.
 *
 * Previously only OrbitControls' *target* was bound to the selected view while
 * the camera position stayed wherever it started, which is why changing view
 * barely did anything.
 */
/** How long the camera lingers on whoever just sent a gift */
export const FOCUS_MS = 3800;

export default function CameraRig({
  pose,
  freeLook = false,
  focusPose,
  focusKey,
  smoothing = 2.4,
  onUserInteract,
  onFocusStart,
}: {
  pose: CameraPose;
  /**
   * User is steering by hand, so leave the camera alone. Owned by the parent
   * rather than mirrored here — keeping a second copy in a ref meant the two
   * could disagree, and re-engaging silently failed whenever the requested
   * pose happened to equal the current one.
   */
  freeLook?: boolean;
  /** Temporary pose that wins over `pose` for a few seconds */
  focusPose?: CameraPose | null;
  /** Changing this value re-arms the focus hold */
  focusKey?: string | null;
  /** Larger eases faster. ~0.6 reads as a slow cinematic drift, ~3 as snappy. */
  smoothing?: number;
  onUserInteract?: () => void;
  /**
   * A focus just took the camera. The parent uses this to drop free-look:
   * otherwise, when the hold expires, the frame loop bails out on `freeLook`
   * and strands the camera on the person it was focusing, forever.
   */
  onFocusStart?: () => void;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);

  const wantPos = useRef(new THREE.Vector3(...pose.position));
  const wantTarget = useRef(new THREE.Vector3(...pose.target));
  // While the user drags or scrolls we stay out of the way entirely
  const grabbed = useRef(false);

  // Focus is timed inside the frame loop, so arriving players never trigger a
  // React state update just to move the camera. The frame callback closes over
  // the current props on every render, so no mirror ref is needed.
  const focusStart = useRef(0);
  const seenFocusKey = useRef<string | null>(null);

  const [px, py, pz] = pose.position;
  const [tx, ty, tz] = pose.target;

  useEffect(() => {
    wantPos.current.set(px, py, pz);
    wantTarget.current.set(tx, ty, tz);
  }, [px, py, pz, tx, ty, tz]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;

    const now = performance.now();

    if (focusKey && focusKey !== seenFocusKey.current) {
      seenFocusKey.current = focusKey;
      focusStart.current = now;
      onFocusStart?.();
    }

    const holding = focusPose && now - focusStart.current < FOCUS_MS;
    // An arrival is an app-driven event the player should see, so it takes the
    // camera back even while the user is free-looking.
    if (grabbed.current || (freeLook && !holding)) return;

    const active = holding ? focusPose : pose;
    wantPos.current.set(...active.position);
    wantTarget.current.set(...active.target);

    // Exponential approach, framed in seconds so the feel is identical at
    // 30fps and 144fps. A plain lerp(alpha) would be frame-rate dependent.
    const k = 1 - Math.exp(-(holding ? 1.8 : smoothing) * Math.min(delta, 0.1));
    camera.position.lerp(wantPos.current, k);
    c.target.lerp(wantTarget.current, k);
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={2.5}
      // The 9:16 broadcast pose sits past 45 units out. OrbitControls clamps
      // the camera to this radius every update, so a lower ceiling here
      // silently undid the vertical pull-back.
      maxDistance={60}
      onStart={() => {
        grabbed.current = true;
        onUserInteract?.();
      }}
      onEnd={() => {
        grabbed.current = false;
      }}
    />
  );
}
