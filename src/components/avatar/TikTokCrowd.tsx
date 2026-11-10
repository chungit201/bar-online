'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import DanceSprite from './DanceSprite';
import NameTag from './NameTag';
import TitleBadge, { titleForUser } from './TitleBadge';
import { clipForPlayer, getClip, type DanceClip } from './dances';
import type { TikTokViewer } from '@/types';

const HEIGHT = 1.7;
const DROP_HEIGHT = 9;
const DROP_MS = 900;
const JUMP_HEIGHT = 1.1;
const JUMP_MS = 650;

export const BAR_WALK_MS = 3500;
export const BAR_ORDER_MS = 3500;
const BAR_VISIT_MS = BAR_WALK_MS * 2 + BAR_ORDER_MS;
// Just in front of the stools of the counter at world (-17, -6)
const BAR_SPOTS_X = [-21, -19.5, -18, -16.5, -15, -13.5];
const BAR_SPOT_Z = -3.9;

/** Live floor position of each crowd member, read by the camera to follow a walk */
export const crowdLive = new Map<string, { x: number; z: number }>();

function barSpot(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return { x: BAR_SPOTS_X[Math.abs(h) % BAR_SPOTS_X.length], z: BAR_SPOT_Z };
}

const ease = (t: number) => t * t * (3 - 2 * t);

function CrowdMember({
  viewer,
  clip,
  phase,
  jumpAt,
  barAt,
  likes,
  gifted,
}: {
  likes: number;
  /** Has sent a gift, which earns a title banner */
  gifted: boolean;
  viewer: TikTokViewer;
  clip: DanceClip;
  phase: number;
  /** Server timestamp of this viewer's latest like, or 0 */
  jumpAt: number;
  /** Server timestamp of this viewer's latest rose, or 0 */
  barAt: number;
}) {
  const root = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const seenBarAt = useRef(0);
  const barStart = useRef(-Infinity);

  useEffect(() => () => void crowdLive.delete(viewer.userId), [viewer.userId]);
  // First-seen is recorded on the client rather than trusting the server's
  // joinedAt, so the fall is timed against this machine's clock and can't be
  // skipped (or replayed) by clock skew between the two.
  const firstSeen = useRef<number | null>(null);
  // Likes are the same story: the server clock can't be compared against
  // performance.now(), so a new jumpAt is simply stamped on arrival here.
  const seenJumpAt = useRef(0);
  const jumpStart = useRef(-Infinity);

  useFrame(() => {
    if (!group.current || !root.current) return;
    const now = performance.now();
    if (firstSeen.current === null) firstSeen.current = now;

    if (barAt > seenBarAt.current) {
      seenBarAt.current = barAt;
      barStart.current = now;
    }
    const home = viewer.position;
    const spot = barSpot(viewer.userId);
    const b = now - barStart.current;
    let t = 0;
    if (b < BAR_WALK_MS) t = ease(b / BAR_WALK_MS);
    else if (b < BAR_WALK_MS + BAR_ORDER_MS) t = 1;
    else if (b < BAR_VISIT_MS) t = 1 - ease((b - BAR_WALK_MS - BAR_ORDER_MS) / BAR_WALK_MS);
    const x = home.x + (spot.x - home.x) * t;
    const z = home.z + (spot.z - home.z) * t;
    root.current.position.set(x, 0, z);
    crowdLive.set(viewer.userId, { x, z });

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
    <group ref={root} position={[viewer.position.x, 0, viewer.position.z]}>
      <group ref={group}>
        <DanceSprite clip={clip} height={HEIGHT} phase={phase} />
        <NameTag
          text={viewer.nickname}
          position={[0, HEIGHT + 0.22, 0]}
          fontSize={0.12}
          avatarUrl={viewer.avatarUrl || undefined}
          likes={likes}
        />
        {gifted && <TitleBadge slug={titleForUser(viewer.userId)} position={[0, HEIGHT + 0.42, 0]} />}
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
  barVisits = {},
  likes = {},
  gifters = {},
}: {
  /** userIds that have sent a gift */
  gifters?: Record<string, true>;
  /** userId -> likes they have sent, shown beside their name */
  likes?: Record<string, number>;
  /** userId -> timestamp of their latest rose, which walks them to the bar */
  barVisits?: Record<string, number>;
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
          barAt={barVisits[v.userId] ?? 0}
          likes={likes[v.userId] ?? 0}
          gifted={!!gifters[v.userId]}
        />
      ))}
    </group>
  );
}
