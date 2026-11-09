'use client';

import type { CharacterDef, EarShape, FaceExpression } from './characters';

// ---------------------------------------------------------------------------
// Original chibi character artwork, drawn procedurally as SVG.
// Canvas is 100 x 120; the head is an ellipse centred at (50, 48) with
// rx 30 / ry 28, so its top edge sits at y = 20 and ears hang off that.
// ---------------------------------------------------------------------------

const INK = '#2b2430';
const STROKE = 2.5;

const EYE_L = 40;
const EYE_R = 60;
const EYE_Y = 46;

function Ears({ ear, fur, patch }: { ear: EarShape; fur: string; patch: string }) {
  const common = { fill: fur, stroke: INK, strokeWidth: STROKE, strokeLinejoin: 'round' as const };
  switch (ear) {
    case 'cat':
      return (
        <>
          <polygon points="28,32 33,8 48,25" {...common} />
          <polygon points="72,32 67,8 52,25" {...common} />
        </>
      );
    case 'rabbit':
      return (
        <>
          <ellipse cx={37} cy={13} rx={8} ry={21} {...common} />
          <ellipse cx={63} cy={13} rx={8} ry={21} {...common} />
          <ellipse cx={37} cy={14} rx={3.5} ry={14} fill={patch} />
          <ellipse cx={63} cy={14} rx={3.5} ry={14} fill={patch} />
        </>
      );
    case 'bear':
      return (
        <>
          <circle cx={27} cy={25} r={11} {...common} />
          <circle cx={73} cy={25} r={11} {...common} />
        </>
      );
    case 'mouse':
      return (
        <>
          <circle cx={25} cy={31} r={13} {...common} />
          <circle cx={75} cy={31} r={13} {...common} />
          <circle cx={25} cy={31} r={7} fill={patch} />
          <circle cx={75} cy={31} r={7} fill={patch} />
        </>
      );
    case 'horn':
      return (
        <>
          <polygon points="35,25 39,6 45,22" {...common} />
          <polygon points="65,25 61,6 55,22" {...common} />
        </>
      );
    case 'floppy':
      return (
        <>
          <ellipse cx={23} cy={46} rx={9} ry={17} {...common} />
          <ellipse cx={77} cy={46} rx={9} ry={17} {...common} />
        </>
      );
    default:
      return null;
  }
}

function Face({ face, patch }: { face: FaceExpression; patch: string }) {
  const line = {
    fill: 'none',
    stroke: INK,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
  };
  const mouth = <path d="M44,61 q6,6 12,0" {...line} />;

  switch (face) {
    case 'sleepy':
      return (
        <>
          <path d={`M${EYE_L - 6},${EYE_Y - 1} q6,7 12,0`} {...line} />
          <path d={`M${EYE_R - 6},${EYE_Y - 1} q6,7 12,0`} {...line} />
          {mouth}
        </>
      );
    case 'happy':
      return (
        <>
          <path d={`M${EYE_L - 6},${EYE_Y + 3} q6,-9 12,0`} {...line} />
          <path d={`M${EYE_R - 6},${EYE_Y + 3} q6,-9 12,0`} {...line} />
          <path d="M43,59 q7,9 14,0 z" fill={INK} />
        </>
      );
    case 'wink':
      return (
        <>
          <circle cx={EYE_L} cy={EYE_Y} r={4} fill={INK} />
          <path d={`M${EYE_R - 6},${EYE_Y + 3} q6,-9 12,0`} {...line} />
          {mouth}
        </>
      );
    case 'calm':
      return (
        <>
          <path d={`M${EYE_L - 5},${EYE_Y} h10`} {...line} />
          <path d={`M${EYE_R - 5},${EYE_Y} h10`} {...line} />
          <path d="M45,61 h10" {...line} />
        </>
      );
    case 'blush':
      return (
        <>
          <circle cx={EYE_L} cy={EYE_Y} r={4} fill={INK} />
          <circle cx={EYE_R} cy={EYE_Y} r={4} fill={INK} />
          <ellipse cx={28} cy={55} rx={7} ry={4.5} fill="#ff9bb5" opacity={0.75} />
          <ellipse cx={72} cy={55} rx={7} ry={4.5} fill="#ff9bb5" opacity={0.75} />
          {mouth}
        </>
      );
    case 'shock':
      return (
        <>
          <circle cx={EYE_L} cy={EYE_Y} r={6.5} fill="#fff" stroke={INK} strokeWidth={2} />
          <circle cx={EYE_R} cy={EYE_Y} r={6.5} fill="#fff" stroke={INK} strokeWidth={2} />
          <circle cx={EYE_L + 1} cy={EYE_Y} r={3} fill={INK} />
          <circle cx={EYE_R + 1} cy={EYE_Y} r={3} fill={INK} />
          <ellipse cx={50} cy={62} rx={4} ry={5} fill={INK} />
        </>
      );
    case 'grin':
      return (
        <>
          <circle cx={EYE_L} cy={EYE_Y} r={4} fill={INK} />
          <circle cx={EYE_R} cy={EYE_Y} r={4} fill={INK} />
          <path d="M40,59 q10,11 20,0 z" fill={INK} />
          <path d="M43,59 h14" stroke={patch} strokeWidth={2} />
        </>
      );
    default:
      return (
        <>
          <circle cx={EYE_L} cy={EYE_Y} r={4} fill={INK} />
          <circle cx={EYE_R} cy={EYE_Y} r={4} fill={INK} />
          {mouth}
        </>
      );
  }
}

function Accessory({ id }: { id: string }) {
  const s = { stroke: INK, strokeWidth: STROKE, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'party':
      return (
        <>
          <polygon points="50,0 38,26 62,26" fill="#ff7fb0" {...s} />
          <circle cx={50} cy={1} r={5} fill="#ffe066" {...s} />
        </>
      );
    case 'crown':
      return (
        <polygon points="30,24 34,6 42,16 50,2 58,16 66,6 70,24" fill="#ffd34d" {...s} />
      );
    case 'sunglasses':
      return (
        <>
          <rect x={27} y={38} width={19} height={14} rx={6} fill="#23202b" {...s} />
          <rect x={54} y={38} width={19} height={14} rx={6} fill="#23202b" {...s} />
          <path d="M46,44 h8" stroke={INK} strokeWidth={3} />
        </>
      );
    case 'headphones':
      return (
        <>
          <path d="M20,44 a30,30 0 0 1 60,0" fill="none" stroke={INK} strokeWidth={5} />
          <rect x={12} y={40} width={14} height={22} rx={6} fill="#ff5c8a" {...s} />
          <rect x={74} y={40} width={14} height={22} rx={6} fill="#ff5c8a" {...s} />
        </>
      );
    case 'bunny':
      return (
        <>
          <ellipse cx={38} cy={10} rx={7} ry={19} fill="#fff" {...s} />
          <ellipse cx={62} cy={10} rx={7} ry={19} fill="#fff" {...s} />
          <ellipse cx={38} cy={11} rx={3} ry={12} fill="#ffb3cd" />
          <ellipse cx={62} cy={11} rx={3} ry={12} fill="#ffb3cd" />
        </>
      );
    case 'halo':
      return (
        <ellipse cx={50} cy={10} rx={18} ry={6} fill="none" stroke="#ffe066" strokeWidth={5} />
      );
    case 'horns':
      return (
        <>
          <polygon points="30,26 30,6 42,20" fill="#e05c5c" {...s} />
          <polygon points="70,26 70,6 58,20" fill="#e05c5c" {...s} />
        </>
      );
    case 'bow':
      return (
        <>
          <polygon points="56,16 56,32 70,24" fill="#ff7fb0" {...s} />
          <polygon points="86,16 86,32 72,24" fill="#ff7fb0" {...s} />
          <circle cx={71} cy={24} r={5} fill="#ff5c8a" {...s} />
        </>
      );
    case 'flower':
      return (
        <>
          {[26, 38, 50, 62, 74].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy={24 - (i === 2 ? 8 : i === 1 || i === 3 ? 4 : 0)}
              r={6}
              fill={['#ff9bb5', '#ffe066', '#fff', '#c4a7ff', '#9be7c4'][i]}
              {...s}
            />
          ))}
        </>
      );
    case 'beanie':
      return (
        <>
          <path d="M22,30 a28,24 0 0 1 56,0 z" fill="#6c8cff" {...s} />
          <rect x={20} y={26} width={60} height={10} rx={5} fill="#9db3ff" {...s} />
          <circle cx={50} cy={4} r={6} fill="#9db3ff" {...s} />
        </>
      );
    default:
      return null;
  }
}

interface CharacterSpriteProps {
  character: CharacterDef;
  accessory?: string;
  className?: string;
  /** Needed when the SVG is serialised to a data URL for texture baking */
  width?: number;
  height?: number;
}

export default function CharacterSprite({
  character,
  accessory = 'none',
  className,
  width,
  height,
}: CharacterSpriteProps) {
  const { fur, patch, ear, face, shirt } = character;
  const body = { stroke: INK, strokeWidth: STROKE, strokeLinejoin: 'round' as const };

  return (
    <svg
      viewBox="0 0 100 120"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={character.name}
    >
      {/* Legs */}
      <rect x={36} y={98} width={10} height={16} rx={5} fill={fur} {...body} />
      <rect x={54} y={98} width={10} height={16} rx={5} fill={fur} {...body} />

      {/* Arms */}
      <rect x={21} y={76} width={10} height={24} rx={5} fill={fur} {...body} />
      <rect x={69} y={76} width={10} height={24} rx={5} fill={fur} {...body} />

      {/* Torso */}
      <rect x={30} y={70} width={40} height={34} rx={12} fill={shirt} {...body} />

      {/* Ears sit behind the head */}
      <Ears ear={ear} fur={fur} patch={patch} />

      {/* Head */}
      <ellipse cx={50} cy={48} rx={30} ry={28} fill={fur} {...body} />

      {/* Muzzle patch */}
      {ear !== 'duck' && <ellipse cx={50} cy={58} rx={17} ry={12} fill={patch} opacity={0.9} />}

      {/* Duck bill instead of a muzzle */}
      {ear === 'duck' && (
        <ellipse cx={50} cy={60} rx={13} ry={8} fill="#ff9f43" {...body} />
      )}

      {/* Frog eye bulges sit on top of the head */}
      {ear === 'frog' && (
        <>
          <circle cx={33} cy={22} r={12} fill={fur} {...body} />
          <circle cx={67} cy={22} r={12} fill={fur} {...body} />
          <circle cx={33} cy={22} r={5} fill={INK} />
          <circle cx={67} cy={22} r={5} fill={INK} />
        </>
      )}

      {ear === 'frog' ? (
        <path d="M38,56 q12,10 24,0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      ) : ear === 'duck' ? (
        <>
          <circle cx={EYE_L} cy={EYE_Y - 2} r={4} fill={INK} />
          <circle cx={EYE_R} cy={EYE_Y - 2} r={4} fill={INK} />
        </>
      ) : (
        <Face face={face} patch={patch} />
      )}

      <Accessory id={accessory} />
    </svg>
  );
}
