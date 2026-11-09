'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DanceSprite from './DanceSprite';
import NameTag from './NameTag';
import { clipForPlayer, getClip, type DanceClip } from './dances';
import type { TikTokViewer } from '@/types';

const HEIGHT = 1.7;
const DROP_HEIGHT = 9;
const DROP_MS = 900;
const JUMP_HEIGHT = 1.1;
const JUMP_MS = 650;

function CrowdMember({
  viewer,
  clip,
  phase,
  jumpAt,
}: {
  viewer: TikTokViewer;
  clip: DanceClip;
  phase: number;
  /** Server timestamp of this viewer's latest like, or 0 */
  jumpAt: number;
}) {
  const group = useRef<THREE.Group>(null);
  // First-seen is recorded on the client rather than trusting the server's
  // joinedAt, so the fall is timed against this machine's clock and can't be
  // skipped (or replayed) by clock skew between the two.
  const firstSeen = useRef<number | null>(null);
  // Likes are the same story: the server clock can't be compared against
  // performance.now(), so a new jumpAt is simply stamped on arrival here.
  const seenJumpAt = useRef(0);
  const jumpStart = useRef(-Infinity);

  useFrame(() => {
    if (!group.current) return;
    const now = performance.now();
    if (firstSeen.current === null) firstSeen.current = now;

    if (jumpAt > seenJumpAt.current) {
      seenJumpAt.current = jumpAt;
      jumpStart.current = now;
    }

    const elapsed = now - firstSeen.current;
    if (elapsed < DROP_MS) {
      // Squared falloff: accelerates toward the floor instead of drifting down
      group.current.position.y = DROP_HEIGHT * Math.pow(1 - elapsed / DROP_MS, 2.2);
      return;
    }

    const since = now - jumpStart.current;
    if (since < JUMP_MS) {
      // sin() over half a period: leaves and lands at exactly 0, peaking
      // mid-flight, so repeat likes can restart it without a visible snap
      group.current.position.y = JUMP_HEIGHT * Math.sin((since / JUMP_MS) * Math.PI);
      return;
    }
    group.current.position.y = 0;
  });

  return (
    <group position={[viewer.position.x, 0, viewer.position.z]}>
      <group ref={group}>
        <DanceSprite clip={clip} height={HEIGHT} phase={phase} />
        <NameTag
          text={viewer.nickname}
          position={[0, HEIGHT + 0.22, 0]}
          fontSize={0.12}
          avatarUrl={viewer.avatarUrl || undefined}
        />
      </group>
    </group>
  );
}

/**
 * TikTok viewers rendered as characters on the floor.
 *
 * They are not Players — there is no socket behind them — so they live in
 * their own list and get a clip derived from their TikTok id, which keeps the
 * same person looking the same across every client and reconnect.
 */
export default function TikTokCrowd({
  viewers,
  skins = {},
  jumps = {},
}: {
  viewers: TikTokViewer[];
  /** userId -> clip id, set by the skin-swap gift */
  skins?: Record<string, string>;
  /** userId -> timestamp of their latest like, which makes them hop */
  jumps?: Record<string, number>;
}) {
  return (
    <group>
      {viewers.map((v, i) => (
        <CrowdMember
          key={v.userId}
          viewer={v}
          clip={skins[v.userId] ? getClip(skins[v.userId]) : clipForPlayer(v.userId)}
          // Offset phase so neighbours don't dance in lockstep
          phase={i * 0.37}
          jumpAt={jumps[v.userId] ?? 0}
        />
      ))}
    </group>
  );
}
