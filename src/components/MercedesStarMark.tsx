'use client';

import {
  MERCEDES_EMBLEM_CENTER,
  MERCEDES_RING_RADIUS,
  MERCEDES_RING_STROKE,
  MERLIN_LOGO_PALETTE,
  MERLIN_LOGO_VIEWBOX,
} from '@/lib/merlinLogo/palette';
import { MERCEDES_STAR_ARM, MERCEDES_STAR_ROTATIONS } from '@/lib/merlinLogo/paths';

interface MercedesStarMarkProps {
  className?: string;
  /** Accessible label — omit when decorative (parent has text). */
  title?: string;
  /** Subtle pulsing glow — use on splash / loading surfaces. */
  animated?: boolean;
}

const P = MERLIN_LOGO_PALETTE;
const C = MERCEDES_EMBLEM_CENTER;

/** Standard Mercedes-Benz emblem — three-pointed star inside a circle. */
export function MercedesStarMark({ className, title, animated = false }: MercedesStarMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${MERLIN_LOGO_VIEWBOX} ${MERLIN_LOGO_VIEWBOX}`}
      className={[className, animated ? 'merlin-logo-animated' : ''].filter(Boolean).join(' ') || undefined}
      role={labelled ? 'img' : 'presentation'}
      aria-hidden={labelled ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect width={MERLIN_LOGO_VIEWBOX} height={MERLIN_LOGO_VIEWBOX} fill={P.canvas} />
      <circle
        cx={C}
        cy={C}
        r={MERCEDES_RING_RADIUS}
        fill="none"
        stroke={P.ring}
        strokeWidth={MERCEDES_RING_STROKE}
      />
      {MERCEDES_STAR_ROTATIONS.map((rotation) => (
        <path
          key={rotation}
          fill={P.star}
          d={MERCEDES_STAR_ARM}
          transform={`rotate(${rotation} ${C} ${C})`}
        />
      ))}
    </svg>
  );
}