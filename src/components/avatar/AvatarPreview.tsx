'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { AvatarConfig } from '@/types';

function AvatarModel({ avatar }: { avatar: AvatarConfig }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  const skinColor = '#d4a574';
  const isFemale = avatar.gender === 'female';

  return (
    <group ref={groupRef} position={[0, -1.2, 0]}>
      {/* Legs */}
      <mesh position={[-0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.16, 0.7, 0.16]} />
        <meshStandardMaterial color={avatar.bottomColor} />
      </mesh>
      <mesh position={[0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.16, 0.7, 0.16]} />
        <meshStandardMaterial color={avatar.bottomColor} />
      </mesh>

      {/* Shoes */}
      <mesh position={[-0.12, 0.04, 0.04]} castShadow>
        <boxGeometry args={[0.18, 0.08, 0.24]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.12, 0.04, 0.04]} castShadow>
        <boxGeometry args={[0.18, 0.08, 0.24]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={isFemale ? [0.38, 0.55, 0.22] : [0.42, 0.6, 0.24]} />
        <meshStandardMaterial color={avatar.topColor} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.28, 0.95, 0]} castShadow>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={avatar.topColor} />
      </mesh>
      <mesh position={[0.28, 0.95, 0]} castShadow>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={avatar.topColor} />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.28, 0.67, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh position={[0.28, 0.67, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.1, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.07, 1.57, 0.17]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.07, 1.57, 0.17]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Hair */}
      {avatar.hairstyle !== 'bald' && (
        <mesh position={[0, avatar.hairstyle === 'long' ? 1.6 : 1.65, avatar.hairstyle === 'mohawk' ? 0 : -0.02]} castShadow>
          {avatar.hairstyle === 'mohawk' ? (
            <boxGeometry args={[0.06, 0.25, 0.3]} />
          ) : avatar.hairstyle === 'long' ? (
            <boxGeometry args={[0.42, 0.35, 0.3]} />
          ) : avatar.hairstyle === 'curly' ? (
            <sphereGeometry args={[0.24, 12, 12]} />
          ) : (
            <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          )}
          <meshStandardMaterial color={avatar.hairColor} />
        </mesh>
      )}

      {/* Accessory: sunglasses */}
      {avatar.accessory === 'sunglasses' && (
        <group position={[0, 1.57, 0.18]}>
          <mesh position={[-0.07, 0, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.02]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0.07, 0, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.02]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.04, 0.01, 0.02]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      )}

      {/* Accessory: hat */}
      {avatar.accessory === 'hat' && (
        <group position={[0, 1.75, 0]}>
          <mesh>
            <cylinderGeometry args={[0.22, 0.24, 0.15, 16]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.02, 16]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      )}

      {/* Accessory: necklace */}
      {avatar.accessory === 'necklace' && (
        <mesh position={[0, 1.28, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.08, 0.01, 8, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
        </mesh>
      )}

      {/* Accessory: earrings */}
      {avatar.accessory === 'earrings' && (
        <>
          <mesh position={[-0.2, 1.5, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0.2, 1.5, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
          </mesh>
        </>
      )}

      {/* Accessory: watch */}
      {avatar.accessory === 'watch' && (
        <mesh position={[-0.28, 0.72, 0.06]}>
          <boxGeometry args={[0.06, 0.03, 0.08]} />
          <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}

export default function AvatarPreview({ avatar }: { avatar: AvatarConfig }) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 2.5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 2]} intensity={1} />
      <pointLight position={[-2, 2, -1]} intensity={0.4} color="#a855f7" />
      <AvatarModel avatar={avatar} />
      <Environment preset="studio" />
    </Canvas>
  );
}
