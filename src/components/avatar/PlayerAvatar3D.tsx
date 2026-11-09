'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import NameTag from './NameTag';
import * as THREE from 'three';
import type { Player, AnimationState } from '@/types';
import DanceSprite from './DanceSprite';
import { clipForPlayer, getClip } from './dances';

interface PlayerAvatar3DProps {
  player: Player;
  isLocal: boolean;
  /** When a track is playing, idle players dance on their own */
  musicPlaying?: boolean;
  /** Client timestamp this player arrived; drives the drop-in entrance */
  dropInAt?: number;
}

const DROP_HEIGHT = 9;
const DROP_MS = 900;

const SKIN_COLOR = '#d4a574';

/**
 * Tạm ẩn khối nhân vật 3D (hộp tay/chân/đầu) trong lúc chuyển sang sprite.
 * Đổi lại thành `true` để hiện như cũ. Tên và vòng sáng dưới chân vẫn giữ
 * để còn biết người chơi đang đứng đâu.
 */
const SHOW_BODY = false;

export default function PlayerAvatar3D({
  player,
  isLocal,
  musicPlaying,
  dropInAt,
}: PlayerAvatar3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const spriteRef = useRef<THREE.Group>(null);

  const av = player.avatar;
  const isFemale = av?.gender === 'female';
  const isDancing =
    player.animation === 'dancing' || (musicPlaying === true && player.animation === 'idle');

  // Stable per-player motion identity, derived from the id so it never
  // flickers between frames and every client agrees on it.
  const motion = useMemo(() => {
    let h = 0;
    for (let i = 0; i < player.id.length; i++) {
      h = (h * 31 + player.id.charCodeAt(i)) % 997;
    }
    // Seconds of offset: desyncs walk cycles, and starts dancers on
    // different frames of their clip
    return { phase: (h / 997) * Math.PI * 2 };
  }, [player.id]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + motion.phase;
    const raw = player.animation as AnimationState;
    // Music makes idle players dance, but never overrides a pose they chose
    // (sitting, walking, waving…) or one they toggled on themselves.
    const anim: AnimationState = musicPlaying && raw === 'idle' ? 'dancing' : raw;

    if (anim === 'walking') {
      const swing = Math.sin(t * 8) * 0.4;
      if (leftArmRef.current) leftArmRef.current.rotation.x = swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -swing;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = swing;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.03;
    } else if (anim === 'dancing') {
      const bounce = Math.sin(t * 6) * 0.08;
      const sway = Math.sin(t * 3) * 0.15;
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.abs(bounce);
        bodyRef.current.rotation.z = sway * 0.3;
      }
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(t * 6) * 0.8;
        leftArmRef.current.rotation.z = Math.sin(t * 3) * 0.3 - 0.3;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = Math.sin(t * 6 + 1) * 0.8;
        rightArmRef.current.rotation.z = -Math.sin(t * 3) * 0.3 + 0.3;
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t * 6) * 0.2;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(t * 6 + Math.PI) * 0.2;
    } else if (anim === 'waving') {
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.2;
        rightArmRef.current.rotation.z = Math.sin(t * 6) * 0.3 + 0.8;
      }
      if (leftArmRef.current) leftArmRef.current.rotation.set(0, 0, 0);
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (bodyRef.current) { bodyRef.current.position.y = 0; bodyRef.current.rotation.z = 0; }
    } else if (anim === 'cheering') {
      const pump = Math.sin(t * 8) * 0.3;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -2.5 + pump;
        leftArmRef.current.rotation.z = -0.2;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -2.5 + pump;
        rightArmRef.current.rotation.z = 0.2;
      }
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.04;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
    } else if (anim === 'sitting') {
      if (leftLegRef.current) leftLegRef.current.rotation.x = -Math.PI / 2;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.PI / 2;
      if (leftArmRef.current) leftArmRef.current.rotation.set(0, 0, 0);
      if (rightArmRef.current) rightArmRef.current.rotation.set(0, 0, 0);
      if (bodyRef.current) { bodyRef.current.position.y = -0.25; bodyRef.current.rotation.z = 0; }
    } else {
      // idle: gentle breathing
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.sin(t * 2) * 0.01;
        bodyRef.current.rotation.z = 0;
      }
      if (leftArmRef.current) leftArmRef.current.rotation.set(0, 0, Math.sin(t * 1.5) * 0.03);
      if (rightArmRef.current) rightArmRef.current.rotation.set(0, 0, -Math.sin(t * 1.5) * 0.03);
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
    }

    // Drop-in entrance. Squared falloff makes the fall accelerate toward the
    // floor rather than drifting down at a constant speed.
    if (groupRef.current) {
      let drop = 0;
      if (dropInAt) {
        const elapsed = Date.now() - dropInAt;
        if (elapsed < DROP_MS) {
          drop = DROP_HEIGHT * Math.pow(1 - elapsed / DROP_MS, 2.2);
        }
      }
      groupRef.current.position.y = drop;
    }

    if (spriteRef.current) {
      if (anim === 'dancing') {
        // The clip supplies all the motion — adding our own on top reads as
        // a stagger rather than a dance.
        spriteRef.current.position.set(0, 0, 0);
        spriteRef.current.rotation.z = 0;
      } else if (bodyRef.current) {
        // Otherwise the sprite reuses the body's bob/sway
        spriteRef.current.position.set(0, bodyRef.current.position.y, 0);
        spriteRef.current.rotation.z = bodyRef.current.rotation.z;
      }
    }
  });

  return (
    <group ref={groupRef} position={[player.position.x, 0, player.position.z]} rotation={[0, player.rotation, 0]}>
      <group ref={bodyRef} visible={SHOW_BODY}>
        {/* Legs (pivot at hip) */}
        <group position={[-0.12, 0.7, 0]}>
          <mesh ref={leftLegRef} position={[0, -0.35, 0]} castShadow>
            <boxGeometry args={[0.14, 0.7, 0.14]} />
            <meshStandardMaterial color={av?.bottomColor ?? '#1a1a2e'} />
          </mesh>
        </group>
        <group position={[0.12, 0.7, 0]}>
          <mesh ref={rightLegRef} position={[0, -0.35, 0]} castShadow>
            <boxGeometry args={[0.14, 0.7, 0.14]} />
            <meshStandardMaterial color={av?.bottomColor ?? '#1a1a2e'} />
          </mesh>
        </group>

        {/* Shoes */}
        <mesh position={[-0.12, 0.04, 0.03]}>
          <boxGeometry args={[0.16, 0.08, 0.22]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0.12, 0.04, 0.03]}>
          <boxGeometry args={[0.16, 0.08, 0.22]} />
          <meshStandardMaterial color="#222" />
        </mesh>

        {/* Torso */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={isFemale ? [0.36, 0.55, 0.2] : [0.4, 0.6, 0.22]} />
          <meshStandardMaterial
            color={av?.topColor ?? '#3b82f6'}
            emissive={isLocal ? '#7c3aed' : '#000'}
            emissiveIntensity={isLocal ? 0.2 : 0}
          />
        </mesh>

        {/* Arms (pivot at shoulder) */}
        <group position={[-0.26, 1.2, 0]}>
          <mesh ref={leftArmRef} position={[0, -0.25, 0]} castShadow>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color={av?.topColor ?? '#3b82f6'} />
          </mesh>
        </group>
        <group position={[0.26, 1.2, 0]}>
          <mesh ref={rightArmRef} position={[0, -0.25, 0]} castShadow>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color={av?.topColor ?? '#3b82f6'} />
          </mesh>
        </group>

        {/* Hands */}
        <mesh position={[-0.26, 0.67, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={SKIN_COLOR} />
        </mesh>
        <mesh position={[0.26, 0.67, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={SKIN_COLOR} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 1.32, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.08, 8]} />
          <meshStandardMaterial color={SKIN_COLOR} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.48, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.06, 1.5, 0.16]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.06, 1.5, 0.16]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>

        {/* Mouth */}
        <mesh position={[0, 1.42, 0.17]}>
          <boxGeometry args={[0.06, 0.015, 0.01]} />
          <meshStandardMaterial color="#c97a6a" />
        </mesh>

        {/* Hair */}
        {av?.hairstyle !== 'bald' && <Hair hairstyle={av?.hairstyle ?? 'short'} hairColor={av?.hairColor ?? '#1a1a1a'} />}

        {/* Accessories */}
        {av?.accessory === 'sunglasses' && (
          <group position={[0, 1.5, 0.17]}>
            <mesh position={[-0.06, 0, 0]}>
              <boxGeometry args={[0.07, 0.035, 0.015]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0.06, 0, 0]}>
              <boxGeometry args={[0.07, 0.035, 0.015]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh>
              <boxGeometry args={[0.03, 0.01, 0.015]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          </group>
        )}

        {av?.accessory === 'hat' && (
          <group position={[0, 1.66, 0]}>
            <mesh>
              <cylinderGeometry args={[0.2, 0.22, 0.14, 16]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0, -0.05, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.02, 16]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          </group>
        )}

        {av?.accessory === 'necklace' && (
          <mesh position={[0, 1.26, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.07, 0.008, 8, 16]} />
            <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
          </mesh>
        )}

        {av?.accessory === 'earrings' && (
          <>
            <mesh position={[-0.18, 1.44, 0]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0.18, 1.44, 0]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
            </mesh>
          </>
        )}

        {av?.accessory === 'watch' && (
          <mesh position={[-0.26, 0.72, 0.05]}>
            <boxGeometry args={[0.05, 0.025, 0.06]} />
            <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
          </mesh>
        )}
      </group>

      {/* Animated sprite, always facing the camera. Falls back to a clip
          derived from the player id if they somehow have no pick stored. */}
      <group ref={spriteRef}>
        <DanceSprite
          clip={av?.characterId ? getClip(av.characterId) : clipForPlayer(player.id)}
          phase={motion.phase}
        />
      </group>

      {/* Name tag (outside body group so it doesn't bounce) */}
      <NameTag
        text={player.nickname}
        position={[0, 1.9, 0]}
        color={isLocal ? '#e9d5ff' : '#ffffff'}
      />

      {/* Local player glow ring */}
      {isLocal && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.45, 32]} />
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={2} transparent opacity={0.4} />
        </mesh>
      )}

      {/* Dancing floor glow */}
      {isDancing && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.65, 32]} />
          <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={2} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function Hair({ hairstyle, hairColor }: { hairstyle: string; hairColor: string }) {
  const mat = <meshStandardMaterial color={hairColor} />;

  switch (hairstyle) {
    case 'long':
      return (
        <group position={[0, 1.53, -0.02]}>
          <mesh>{mat}<sphereGeometry args={[0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} /></mesh>
          <mesh position={[0, -0.15, -0.08]}>{mat}<boxGeometry args={[0.36, 0.35, 0.12]} /></mesh>
        </group>
      );
    case 'curly':
      return (
        <mesh position={[0, 1.55, 0]}>
          <sphereGeometry args={[0.24, 10, 10]} />
          {mat}
        </mesh>
      );
    case 'mohawk':
      return (
        <mesh position={[0, 1.65, 0]}>
          <boxGeometry args={[0.06, 0.22, 0.28]} />
          {mat}
        </mesh>
      );
    case 'medium':
      return (
        <group position={[0, 1.55, -0.02]}>
          <mesh><sphereGeometry args={[0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />{mat}</mesh>
          <mesh position={[0, -0.06, -0.05]}><boxGeometry args={[0.38, 0.12, 0.1]} />{mat}</mesh>
        </group>
      );
    default: // 'short'
      return (
        <mesh position={[0, 1.57, -0.02]}>
          <sphereGeometry args={[0.19, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          {mat}
        </mesh>
      );
  }
}
