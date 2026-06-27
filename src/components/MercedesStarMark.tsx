'use client';

import { useId } from 'react';
import {
  MERCEDES_EMBLEM_CENTER,
  MERCEDES_RING_RADIUS,
  MERCEDES_RING_STROKE,
  MERLIN_LOGO_PALETTE,
  MERLIN_LOGO_VIEWBOX,
} from '@/lib/merlinLogo/palette';
import { MERCEDES_STAR_ARM, MERCEDES_STAR_SHINE } from '@/lib/merlinLogo/paths';

interface MercedesStarMarkProps {
  className?: string;
  /** Accessible label — omit when decorative (parent has text). */
  title?: string;
  /** Subtle pulsing glow — use on splash / loading surfaces. */
  animated?: boolean;
}

const P = MERLIN_LOGO_PALETTE;
const C = MERCEDES_EMBLEM_CENTER;

/** Official-style Mercedes-Benz emblem — silver three-pointed star inside the circle. */
export function MercedesStarMark({ className, title, animated = false }: MercedesStarMarkProps) {
  const uid = useId().replace(/:/g, '');
  const labelled = Boolean(title);

  const ids = {
    ring: `mb-ring-${uid}`,
    star: `mb-star-${uid}`,
    shine: `mb-shine-${uid}`,
    depth: `mb-depth-${uid}`,
  };

  const armRotations = [0, 120, 240];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${MERLIN_LOGO_VIEWBOX} ${MERLIN_LOGO_VIEWBOX}`}
      className={[className, animated ? 'merlin-logo-animated' : ''].filter(Boolean).join(' ') || undefined}
      role={labelled ? 'img' : 'presentation'}
      aria-hidden={labelled ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={ids.ring} x1="18%" y1="12%" x2="82%" y2="88%">
          <stop offset="0%" stopColor={P.ringHighlight} />
          <stop offset="35%" stopColor={P.ringMid} />
          <stop offset="100%" stopColor={P.ringShadow} />
        </linearGradient>
        <linearGradient id={ids.star} x1="30%" y1="8%" x2="70%" y2="92%">
          <stop offset="0%" stopColor={P.starHighlight} />
          <stop offset="40%" stopColor={P.starMid} />
          <stop offset="100%" stopColor={P.starShadow} />
        </linearGradient>
        <linearGradient id={ids.shine} x1="42%" y1="0%" x2="58%" y2="45%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={ids.depth} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>

      <rect width={MERLIN_LOGO_VIEWBOX} height={MERLIN_LOGO_VIEWBOX} fill={P.canvas} />

      <circle
        cx={C}
        cy={C}
        r={MERCEDES_RING_RADIUS}
        fill="none"
        stroke={`url(#${ids.ring})`}
        strokeWidth={MERCEDES_RING_STROKE}
      />
      <circle
        cx={C}
        cy={C}
        r={MERCEDES_RING_RADIUS - MERCEDES_RING_STROKE * 0.45}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
      />

      <g filter={`url(#${ids.depth})`}>
        {armRotations.map((rotation) => (
          <path
            key={rotation}
            fill={`url(#${ids.star})`}
            d={MERCEDES_STAR_ARM}
            transform={`rotate(${rotation} ${C} ${C})`}
          />
        ))}
        <path
          fill={`url(#${ids.shine})`}
          d={MERCEDES_STAR_SHINE}
          opacity="0.55"
          transform={`rotate(0 ${C} ${C})`}
        />
      </g>
    </svg>
  );
}