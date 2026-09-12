/**
 * Shared wall geometry + pricing. Used by the seed script, API routes, and the
 * canvas renderer, so all three agree on square indices and prices without a DB round trip.
 */

export const WALL_WIDTH = 400;
export const WALL_HEIGHT = 250;
export const TOTAL_SQUARES = WALL_WIDTH * WALL_HEIGHT; // 100,000

export const PRICE_TIERS = [1, 1.5, 2, 3] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export function idToCoords(id: number): { x: number; y: number } {
  return { x: id % WALL_WIDTH, y: Math.floor(id / WALL_WIDTH) };
}

export function coordsToId(x: number, y: number): number {
  return y * WALL_WIDTH + x;
}

/**
 * Price is a function of distance from the wall's center: the innermost ring
 * is the most expensive, fading out towards the edges — like prime real estate.
 */
export function priceForCoords(x: number, y: number): PriceTier {
  const cx = (WALL_WIDTH - 1) / 2;
  const cy = (WALL_HEIGHT - 1) / 2;
  const maxDist = Math.max(cx, cy);
  const dist = Math.max(Math.abs(x - cx), Math.abs(y - cy)); // Chebyshev "ring"
  const ratio = dist / maxDist; // 0 (center) -> 1 (edge)

  if (ratio < 0.15) return 3;
  if (ratio < 0.4) return 2;
  if (ratio < 0.7) return 1.5;
  return 1;
}

export function priceForId(id: number): PriceTier {
  const { x, y } = idToCoords(id);
  return priceForCoords(x, y);
}

export function isValidId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < TOTAL_SQUARES;
}
