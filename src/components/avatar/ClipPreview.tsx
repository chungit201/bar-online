'use client';

import { useEffect, useState } from 'react';
import { frameUrl, type DanceClip } from './dances';

/**
 * DOM preview of a clip for the picker UI.
 *
 * `animated` is opt-in: the grid renders dozens of these, and running dozens
 * of timers plus dozens of frame sequences would stall the picker. Tiles show
 * a single still; only the big preview actually plays.
 */
export default function ClipPreview({
  clip,
  animated = false,
  className,
}: {
  clip: DanceClip;
  animated?: boolean;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animated) return;
    const id = setInterval(() => setFrame((f) => f + 1), Math.round(1000 / clip.fps));
    return () => clearInterval(id);
  }, [animated, clip]);

  // Wrap at render time rather than resetting state in the effect: switching
  // to a shorter clip would otherwise leave `frame` out of range for a tick.
  const shown = animated ? frame % clip.frames : 0;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={frameUrl(clip.id, shown)}
      alt={clip.id}
      className={className}
      draggable={false}
    />
  );
}
