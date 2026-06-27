import {
  MERCEDES_EMBLEM_CENTER,
  MERCEDES_RING_RADIUS,
  MERCEDES_RING_STROKE,
  MERLIN_LOGO_PALETTE,
  MERLIN_LOGO_VIEWBOX,
} from './palette';
import { MERCEDES_STAR_ARM, MERCEDES_STAR_ROTATIONS } from './paths';

const P = MERLIN_LOGO_PALETTE;
const VB = MERLIN_LOGO_VIEWBOX;
const C = MERCEDES_EMBLEM_CENTER;

/** Full app-icon SVG for PNG rasterization (fixed ids — not for inline DOM duplication). */
export function renderMerlinLogoStaticSvg(): string {
  const arms = MERCEDES_STAR_ROTATIONS.map(
    (rotation) =>
      `<path fill="${P.star}" d="${MERCEDES_STAR_ARM}" transform="rotate(${rotation} ${C} ${C})"/>`
  ).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}">
  <rect width="${VB}" height="${VB}" fill="${P.canvas}"/>
  <circle cx="${C}" cy="${C}" r="${MERCEDES_RING_RADIUS}" fill="none" stroke="${P.ring}" stroke-width="${MERCEDES_RING_STROKE}"/>
  ${arms}
</svg>`;
}