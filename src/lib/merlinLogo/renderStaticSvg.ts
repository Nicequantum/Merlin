import {
  MERCEDES_EMBLEM_CENTER,
  MERCEDES_RING_RADIUS,
  MERCEDES_RING_STROKE,
  MERLIN_LOGO_PALETTE,
  MERLIN_LOGO_VIEWBOX,
} from './palette';
import { MERCEDES_STAR_ARM, MERCEDES_STAR_SHINE } from './paths';

const P = MERLIN_LOGO_PALETTE;
const VB = MERLIN_LOGO_VIEWBOX;
const C = MERCEDES_EMBLEM_CENTER;

/** Full app-icon SVG for PNG rasterization (fixed ids — not for inline DOM duplication). */
export function renderMerlinLogoStaticSvg(): string {
  const arms = [0, 120, 240]
    .map(
      (rotation) =>
        `<path fill="url(#mb-star)" d="${MERCEDES_STAR_ARM}" transform="rotate(${rotation} ${C} ${C})"/>`
    )
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}">
  <defs>
    <linearGradient id="mb-ring" x1="18%" y1="12%" x2="82%" y2="88%">
      <stop offset="0%" stop-color="${P.ringHighlight}"/>
      <stop offset="35%" stop-color="${P.ringMid}"/>
      <stop offset="100%" stop-color="${P.ringShadow}"/>
    </linearGradient>
    <linearGradient id="mb-star" x1="30%" y1="8%" x2="70%" y2="92%">
      <stop offset="0%" stop-color="${P.starHighlight}"/>
      <stop offset="40%" stop-color="${P.starMid}"/>
      <stop offset="100%" stop-color="${P.starShadow}"/>
    </linearGradient>
    <linearGradient id="mb-shine" x1="42%" y1="0%" x2="58%" y2="45%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="mb-depth" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect width="${VB}" height="${VB}" fill="${P.canvas}"/>
  <circle cx="${C}" cy="${C}" r="${MERCEDES_RING_RADIUS}" fill="none" stroke="url(#mb-ring)" stroke-width="${MERCEDES_RING_STROKE}"/>
  <circle cx="${C}" cy="${C}" r="${MERCEDES_RING_RADIUS - MERCEDES_RING_STROKE * 0.45}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3"/>

  <g filter="url(#mb-depth)">
    ${arms}
    <path fill="url(#mb-shine)" d="${MERCEDES_STAR_SHINE}" opacity="0.55" transform="rotate(0 ${C} ${C})"/>
  </g>
</svg>`;
}