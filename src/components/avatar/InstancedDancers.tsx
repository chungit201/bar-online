'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { atlasGrid, atlasUrl, getClip, type DanceClip } from './dances';

// ---------------------------------------------------------------------------
// Crowd renderer.
//
// One draw call per *clip* instead of one per dancer: all dancers sharing a
// clip live in a single InstancedBufferGeometry, and the shader picks which
// atlas cell to sample from the instance's own phase. A thousand dancers
// across 33 clips is 33 draw calls.
//
// The quad is billboarded in the vertex shader (offset in view space) rather
// than by rotating objects on the CPU, so there is no per-frame JS work at all
// — only a single uTime uniform update.
// ---------------------------------------------------------------------------

export interface Dancer {
  x: number;
  z: number;
  clipId: string;
  /** Seconds of offset into the clip, so neighbours aren't frame-locked */
  phase: number;
}

const VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aPhase;

  uniform float uTime;
  uniform float uFps;
  uniform float uFrames;
  uniform float uCols;
  uniform float uRows;
  uniform vec2  uSize;

  varying vec2 vUv;

  void main() {
    // Billboard: take the instance origin into view space, then expand the
    // quad on the view plane so it always faces the camera.
    vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
    mv.xy += (position.xy + vec2(0.0, 0.5)) * uSize;
    gl_Position = projectionMatrix * mv;

    float f   = mod(floor((uTime + aPhase) * uFps), uFrames);
    float col = mod(f, uCols);
    // Atlas rows are packed top-down; UV v runs bottom-up.
    float row = uRows - 1.0 - floor(f / uCols);

    vUv = (uv + vec2(col, row)) / vec2(uCols, uRows);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;

  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.25) discard;
    gl_FragColor = c;
    #include <colorspace_fragment>
  }
`;

const atlasCache = new Map<string, THREE.Texture>();
const atlasPending = new Set<string>();

function useAtlas(clipId: string) {
  const [, bump] = useState(0);
  const texture = atlasCache.get(clipId) ?? null;

  useEffect(() => {
    if (atlasCache.has(clipId) || atlasPending.has(clipId)) return;
    atlasPending.add(clipId);

    let cancelled = false;
    new THREE.TextureLoader().load(atlasUrl(clipId), (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      // No mipmaps: they would bleed neighbouring frames into each other at
      // distance, since every cell shares one texture.
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      atlasCache.set(clipId, tex);
      atlasPending.delete(clipId);
      if (!cancelled) bump((v) => v + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [clipId]);

  return texture;
}

function ClipCrowd({
  clip,
  dancers,
  height,
}: {
  clip: DanceClip;
  dancers: Dancer[];
  height: number;
}) {
  const atlas = useAtlas(clip.id);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute('position', plane.attributes.position);
    geo.setAttribute('uv', plane.attributes.uv);

    const offsets = new Float32Array(dancers.length * 3);
    const phases = new Float32Array(dancers.length);
    dancers.forEach((d, i) => {
      offsets[i * 3] = d.x;
      offsets[i * 3 + 1] = 0;
      offsets[i * 3 + 2] = d.z;
      phases[i] = d.phase;
    });

    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    geo.instanceCount = dancers.length;
    // Instances are scattered far beyond the base quad's bounds, so let the
    // renderer skip culling rather than compute a wrong bounding sphere.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    plane.dispose();
    return geo;
  }, [dancers]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => {
    const { cols, rows } = atlasGrid(clip.frames);
    return {
      uMap: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uFps: { value: clip.fps },
      uFrames: { value: clip.frames },
      uCols: { value: cols },
      uRows: { value: rows },
      uSize: {
        value: new THREE.Vector2((height * clip.width) / clip.height, height),
      },
    };
  }, [clip, height]);

  useFrame(({ clock }) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = clock.getElapsedTime();
    // Bound here rather than during render: the uniforms object comes from
    // useMemo, and writing to it while rendering is not allowed.
    if (mat.uniforms.uMap.value !== atlas) mat.uniforms.uMap.value = atlas;
  });

  if (!atlas) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function InstancedDancers({
  dancers,
  height = 1.7,
}: {
  dancers: Dancer[];
  height?: number;
}) {
  const byClip = useMemo(() => {
    const groups = new Map<string, Dancer[]>();
    for (const d of dancers) {
      const list = groups.get(d.clipId);
      if (list) list.push(d);
      else groups.set(d.clipId, [d]);
    }
    return [...groups.entries()];
  }, [dancers]);

  return (
    <group>
      {byClip.map(([clipId, list]) => (
        <ClipCrowd key={clipId} clip={getClip(clipId)} dancers={list} height={height} />
      ))}
    </group>
  );
}
