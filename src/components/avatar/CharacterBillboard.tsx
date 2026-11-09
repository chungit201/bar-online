'use client';

import { useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import CharacterSprite from './CharacterSprite';
import { getCharacter } from './characters';

// The sprite is vector art, so bake it at a comfortable size and let mipmaps
// handle minification rather than paying for a huge texture.
const TEX_W = 256;
const TEX_H = 308; // keeps the 100 x 120 viewBox aspect

/**
 * One texture per (character, accessory) pair, shared by every player using it —
 * a room full of the same character costs a single upload.
 */
const textureCache = new Map<string, THREE.Texture>();

function useCharacterTexture(characterId: string | undefined, accessory: string) {
  const key = `${characterId ?? 'default'}|${accessory}`;
  // Read the cache during render so a cache hit needs no state update at all;
  // the counter only ticks from the loader callback, which is async by then.
  const [, bumpVersion] = useState(0);
  const texture = textureCache.get(key) ?? null;

  useEffect(() => {
    if (textureCache.has(key)) return;

    const markup = renderToStaticMarkup(
      <CharacterSprite
        character={getCharacter(characterId)}
        accessory={accessory}
        width={TEX_W}
        height={TEX_H}
      />,
    );
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

    let cancelled = false;
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      textureCache.set(key, tex);
      if (!cancelled) bumpVersion((v) => v + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [key, characterId, accessory]);

  return texture;
}

interface CharacterBillboardProps {
  characterId?: string;
  accessory?: string | null;
  /** World height of the sprite, feet at y = 0 */
  height?: number;
}

export default function CharacterBillboard({
  characterId,
  accessory,
  height = 1.7,
}: CharacterBillboardProps) {
  const texture = useCharacterTexture(characterId, accessory ?? 'none');
  if (!texture) return null;

  const width = height * (100 / 120);

  return (
    <Billboard position={[0, height / 2, 0]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          alphaTest={0.4}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}
