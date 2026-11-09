import { useCallback, useEffect, useRef, useState } from 'react';
import type { Vec3 } from '@/types';

const MOVE_SPEED = 4; // units per second
const EMIT_INTERVAL = 1000 / 15; // ~15 fps throttle

interface UsePlayerControlsOptions {
  /** Current local player position from game state */
  currentPosition: Vec3 | null;
  /** Callback to emit position to server */
  onMove: (position: Vec3, rotation: number) => void;
}

export function usePlayerControls({ currentPosition, onMove }: UsePlayerControlsOptions) {
  const [targetPosition, setTargetPosition] = useState<Vec3 | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const keysRef = useRef<Set<string>>(new Set());
  const lastEmitRef = useRef(0);
  const posRef = useRef<Vec3>(currentPosition ?? { x: 0, y: 0, z: 0 });
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // keep posRef in sync when server sends authoritative position
  useEffect(() => {
    if (currentPosition && !isMoving) {
      posRef.current = currentPosition;
    }
  }, [currentPosition, isMoving]);

  // ---- keyboard -----------------------------------------------------------

  useEffect(() => {
    // WASD doubles as movement and as ordinary letters. Without this guard the
    // listener swallows every "a"/"w"/"s"/"d" typed into a room name, nickname
    // or chat box, since it preventDefault()s on window.
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) {
        // Drop any held keys, otherwise focusing a field mid-stride leaves the
        // player walking with no keyup ever arriving to stop them.
        keysRef.current.clear();
        return;
      }
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        keysRef.current.add(key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ---- throttled emit -----------------------------------------------------

  const throttledEmit = useCallback(
    (pos: Vec3, rotation: number) => {
      const now = performance.now();
      if (now - lastEmitRef.current >= EMIT_INTERVAL) {
        lastEmitRef.current = now;
        onMove(pos, rotation);
      }
    },
    [onMove],
  );

  // ---- animation frame loop for keyboard movement -------------------------

  useEffect(() => {
    const loop = (time: number) => {
      frameRef.current = requestAnimationFrame(loop);

      const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = time;

      const keys = keysRef.current;
      if (keys.size === 0) {
        if (isMoving) setIsMoving(false);
        return;
      }

      let dx = 0;
      let dz = 0;
      if (keys.has('w') || keys.has('arrowup')) dz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dz += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      if (dx === 0 && dz === 0) return;

      // normalize diagonal
      const len = Math.sqrt(dx * dx + dz * dz);
      dx /= len;
      dz /= len;

      const pos = posRef.current;
      const newPos: Vec3 = {
        x: pos.x + dx * MOVE_SPEED * dt,
        y: pos.y,
        z: pos.z + dz * MOVE_SPEED * dt,
      };
      const rotation = Math.atan2(dx, dz);

      posRef.current = newPos;
      setTargetPosition(newPos);
      setIsMoving(true);
      throttledEmit(newPos, rotation);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isMoving, throttledEmit]);

  // ---- click-to-move handler (for Canvas onClick) -------------------------

  const handleFloorClick = useCallback(
    (point: Vec3) => {
      setTargetPosition(point);
      setIsMoving(true);

      const pos = posRef.current;
      const dx = point.x - pos.x;
      const dz = point.z - pos.z;
      const rotation = Math.atan2(dx, dz);

      // Set the position immediately (the 3D scene will lerp)
      posRef.current = point;
      onMove(point, rotation);
    },
    [onMove],
  );

  return { targetPosition, isMoving, handleFloorClick };
}
