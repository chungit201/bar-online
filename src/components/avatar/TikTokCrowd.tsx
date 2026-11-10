'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import DanceSprite from './DanceSprite';
import NameTag from './NameTag';
import TitleBadge, { titleForUser } from './TitleBadge';
import { clipForPlayer, getClip, type DanceClip } from './dances';
import type { TikTokAction, TikTokViewer } from '@/types';

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

// --- Gift effects ----------------------------------------------------------

/** How long the Doughnut gift leaves the sender oversized */
const GIANT_MS = 6000;
const GIANT_SCALE = 2;
/** Stagger between neighbours in the GG crowd hop, so it reads as a wave */
const CROWD_JUMP_STAGGER_MS = 45;
const HEARTS_MS = 4000;
const HEART_COUNT = 14;

/**
 * Heart outline built from a curve rather than loaded as a texture — it is a
 * handful of vertices, and it stays crisp at any distance the camera gets to.
 */
function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.9, 0.3, 0.45, 1.05, 0, 0.55);
  s.bezierCurveTo(-0.45, 1.05, -0.9, 0.3, 0, -0.5);
  return new THREE.ShapeGeometry(s, 12);
}

/**
 * Hearts streaming up around the sender, for the Finger Heart gift.
 *
 * Stays mounted while the gift is the latest one and simply hides itself once
 * its run is over. The alternative — unmounting on a timer — would need state
 * set from an effect, and the hearts are only 14 tiny meshes.
 */
function HeartStream({ burstKey }: { burstKey: string }) {
  const group = useRef<THREE.Group>(null);
  const seenKey = useRef('');
  const startedAt = useRef(-Infinity);
  const geo = useMemo(() => heartGeometry(), []);
  useEffect(() => () => geo.dispose(), [geo]);

  // Fixed per heart: a lane around the character and a speed, so they rise in
  // a loose spiral instead of a single column.
  //
  // Seeded on the first frame rather than during render — Math.random() is
  // impure, and a re-render would otherwise reshuffle every heart mid-flight.
  const seeds = useRef<
    { angle: number; radius: number; speed: number; delay: number; scale: number }[]
  >([]);

  useFrame(() => {
    if (!group.current) return;
    if (seeds.current.length !== HEART_COUNT) {
      seeds.current = Array.from({ length: HEART_COUNT }, (_, i) => ({
        angle: (i / HEART_COUNT) * Math.PI * 2 + Math.random(),
        radius: 0.35 + Math.random() * 0.45,
        speed: 0.9 + Math.random() * 0.7,
        delay: Math.random() * 1.4,
        scale: 0.1 + Math.random() * 0.08,
      }));
    }
    if (burstKey !== seenKey.current) {
      seenKey.current = burstKey;
      startedAt.current = performance.now();
    }

    const age = performance.now() - startedAt.current;
    if (age > HEARTS_MS) {
      // Run finished: park the whole stream rather than unmounting it
      if (group.current.visible) group.current.visible = false;
      return;
    }
    group.current.visible = true;

    const elapsed = age / 1000;
    group.current.children.forEach((child, i) => {
      const s = seeds.current[i];
      // The child is the Billboard's group; the heart mesh hangs under it, so
      // the transform goes on the group and the fade on the mesh's material.
      const mesh = child.children[0] as THREE.Mesh | undefined;
      if (!mesh) return;

      if (elapsed < s.delay) {
        child.visible = false;
        return;
      }
      child.visible = true;
      // Each heart loops its own rise, so the stream is continuous rather
      // than one volley that leaves the character bare afterwards.
      const local = (elapsed - s.delay) % 2.2;
      const spin = s.angle + local * 1.1;
      child.position.set(Math.cos(spin) * s.radius, 0.4 + local * s.speed, Math.sin(spin) * s.radius);
      child.scale.setScalar(s.scale);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - local / 2.2) * 0.9;
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: HEART_COUNT }, (_, i) => (
        <Billboard key={i}>
          <mesh geometry={geo}>
            <meshBasicMaterial color="#ff3b6b" transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}

// Follow spot thrown on whoever the camera is focusing
const SPOT_HEIGHT = 5.2;
const SPOT_RADIUS = 1.05;
/** How far the beam tilts either side of vertical */
const SPOT_SWEEP_RAD = 0.17;
/** Sweeps per second — slow enough to read as a moving head, not a strobe */
const SPOT_SWEEP_HZ = 0.32;

/** Beam tilt at time `t`, shared so the dancer and the light never drift apart */
const spotAngle = (t: number) => Math.sin(t * Math.PI * 2 * SPOT_SWEEP_HZ) * SPOT_SWEEP_RAD;

/**
 * Where the beam lands on the floor, relative to the rig directly overhead.
 * Rotating the apex-anchored cone by `angle` carries its base to
 * `height * sin(angle)`, so this is both the pool's offset and the distance
 * the dancer has to travel to stay lit.
 */
const spotSwayX = (t: number) => SPOT_HEIGHT * Math.sin(spotAngle(t));

/**
 * A cone of light over the focused character, swinging left and right.
 *
 * The cone pivots at its apex, the way a real moving head does, so the beam
 * stays pinned to the rig overhead while its pool slides across the floor.
 * Additive blending with no depth write keeps it reading as light rather than
 * as a solid object sitting over the dancer.
 */
function FocusSpotlight() {
  const beam = useRef<THREE.Group>(null);
  const pool = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beam.current) beam.current.rotation.z = spotAngle(t);
    if (pool.current) pool.current.position.x = spotSwayX(t);
  });

  return (
    <group>
      <group ref={beam} position={[0, SPOT_HEIGHT, 0]}>
        <mesh position={[0, -SPOT_HEIGHT / 2, 0]}>
          {/* Open-ended so the beam has no visible cap at either end */}
          <coneGeometry args={[SPOT_RADIUS, SPOT_HEIGHT, 28, 1, true]} />
          <meshBasicMaterial
            color="#eaf4ff"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Bright pool where the beam lands, lifted clear of the floor to
          avoid z-fighting with the dance tiles */}
      <mesh ref={pool} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[SPOT_RADIUS * 1.25, 28]} />
        <meshBasicMaterial
          color="#eaf4ff"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CrowdMember({
  viewer,
  clip,
  phase,
  jumpAt,
  barAt,
  likes,
  gifted,
  focused,
  hidden,
  giantKey,
  heartsKey,
  crowdJumpKey,
  jumpDelay,
}: {
  /** Identifies the Doughnut gift that swells this character; '' for none */
  giantKey: string;
  /** Identifies the Finger Heart gift that surrounds them; '' for none */
  heartsKey: string;
  /** Identifies a GG that makes the whole floor hop; '' for none */
  crowdJumpKey: string;
  /** This dancer's place in the crowd-hop wave */
  jumpDelay: number;
  /** The camera is on this person: light them up */
  focused: boolean;
  /** Someone else is being focused, so step out of the shot */
  hidden: boolean;
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
  // Gift effects latch the same way: remember the key, stamp the local clock
  const seenCrowdJump = useRef('');
  const seenGiant = useRef('');
  const giantStart = useRef(-Infinity);

  useFrame(({ clock }) => {
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

    // While focused, walk along under the beam. The sway goes on the inner
    // group, not on `root`: `root` is where the spotlight hangs, so moving it
    // would drag the light along too and the two would never separate.
    const sway = focused ? spotSwayX(clock.getElapsedTime()) : 0;
    group.current.position.x = sway;
    // Report the swayed position so the camera tracks it and keeps the dancer
    // centred in frame instead of letting them slide out of the shot.
    crowdLive.set(viewer.userId, { x: x + sway, z });

    // A like bounces this one person straight away…
    if (jumpAt > seenJumpAt.current) {
      seenJumpAt.current = jumpAt;
      jumpStart.current = now;
    }
    // …while a GG hops the whole floor, offset so it rolls as a wave.
    if (crowdJumpKey && crowdJumpKey !== seenCrowdJump.current) {
      seenCrowdJump.current = crowdJumpKey;
      jumpStart.current = now + jumpDelay;
    }

    if (giantKey && giantKey !== seenGiant.current) {
      seenGiant.current = giantKey;
      giantStart.current = now;
    }

    // Doughnut: swell, hold, shrink back. Eased at both ends so the character
    // inflates rather than snapping to double size.
    const g = now - giantStart.current;
    let grow = 1;
    if (g >= 0 && g < GIANT_MS) {
      const ramp = 400;
      const k =
        g < ramp ? ease(g / ramp)
        : g > GIANT_MS - ramp ? ease((GIANT_MS - g) / ramp)
        : 1;
      grow = 1 + (GIANT_SCALE - 1) * k;
    }
    group.current.scale.setScalar(grow);

    const elapsed = now - firstSeen.current;
    if (elapsed < DROP_MS) {
      // Squared falloff: accelerates toward the floor instead of drifting down
      group.current.position.y = DROP_HEIGHT * Math.pow(1 - elapsed / DROP_MS, 2.2);
      return;
    }

    const since = now - jumpStart.current;
    // `since < 0` is the staggered wait before this dancer's turn in the wave
    if (since >= 0 && since < JUMP_MS) {
      // sin() over half a period: leaves and lands at exactly 0, peaking
      // mid-flight, so repeat likes can restart it without a visible snap
      group.current.position.y = JUMP_HEIGHT * Math.sin((since / JUMP_MS) * Math.PI);
      return;
    }
    group.current.position.y = 0;
  });

  return (
    // `visible` rather than unmounting: the frame loop keeps running, so the
    // walk to the bar and `crowdLive` (which the camera follows) stay correct,
    // and nobody pops back in from the ceiling when the focus ends.
    <group ref={root} position={[viewer.position.x, 0, viewer.position.z]} visible={!hidden}>
      {focused && <FocusSpotlight />}
      {heartsKey && <HeartStream burstKey={heartsKey} />}
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
  focusUserId = null,
  effect = null,
}: {
  /** Latest gift effect; this component handles the ones tied to a character */
  effect?: TikTokAction | null;
  /**
   * The viewer the camera is holding on. Everyone else on the floor is hidden
   * for the duration so the shot isn't a wall of dancers.
   *
   * The top 3 are unaffected: they are rendered by StagePerformers inside
   * BarScene, not from this list.
   */
  focusUserId?: string | null;
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
  // Effects carry the server's clock, which cannot be compared against
  // performance.now(). Rather than translate between the two, each effect is
  // identified by a key string and the members latch it in their own frame
  // loop — the same way `jumpAt` and `barAt` already work.
  const effectKey = effect ? `${effect.effect}:${effect.userId}:${effect.at}` : '';
  const target = effect?.userId ?? '';

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
          focused={focusUserId === v.userId}
          hidden={!!focusUserId && focusUserId !== v.userId}
          // A crowd hop reaches everyone; the other two only reach the sender.
          crowdJumpKey={effect?.effect === 'crowdJump' ? effectKey : ''}
          // Stagger by index so the hop rolls across the floor as a wave
          jumpDelay={i * CROWD_JUMP_STAGGER_MS}
          giantKey={effect?.effect === 'giant' && target === v.userId ? effectKey : ''}
          heartsKey={effect?.effect === 'hearts' && target === v.userId ? effectKey : ''}
        />
      ))}
    </group>
  );
}
