import type { PriceTier } from "@/lib/grid";

/** Available squares: a subtle cold gradient — brighter (still restrained) toward the
 * center where price rises, so the pricing structure reads visually without any
 * gambling-style color coding. */
export const AVAILABLE_COLORS: Record<PriceTier, string> = {
  1: "#262a35",
  1.5: "#2b3149",
  2: "#333e6b",
  3: "#4256a0",
};

export const OWNED_DEFAULT_COLOR = "#2a2c33";
export const LISTED_ACCENT = "#d4a24c"; // gold
export const OWN_SQUARE_RING = "#7dd3fc"; // accent-2 cyan

export const STATUS_AVAILABLE = 0;
export const STATUS_OWNED = 1;
export const STATUS_LISTED = 2;
