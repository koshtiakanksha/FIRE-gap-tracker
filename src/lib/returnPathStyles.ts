/**
 * Single source of truth for how each return path is represented visually,
 * shared by the growth chart and the FIRE-age range cards. Keeping this in
 * one place is what guarantees "the orange line in the chart" and "the
 * orange card" are always the same path — if the chart and the cards each
 * picked their own colors, they'd be free to silently drift apart.
 */

import type { ReturnPathKey } from "../types/fire";

export interface ReturnPathStyle {
  label: string;
  /** Hex color used for the chart line/dot and for inline accents. */
  color: string;
  /** SVG dash pattern for the chart line. Undefined means a solid line. */
  dashArray?: string;
}

export const RETURN_PATH_STYLES: Record<ReturnPathKey, ReturnPathStyle> = {
  conservative: { label: "Conservative", color: "#d2691e", dashArray: "6 4" }, // orange, dashed
  base: { label: "Base", color: "#2563eb" }, // blue, solid
  optimistic: { label: "Optimistic", color: "#1f9d55", dashArray: "1 3" }, // green, lightly dotted
};

export const FIRE_TARGET_STYLE: ReturnPathStyle = {
  label: "FIRE number (future $)",
  color: "#7c6f9c", // muted purple-gray, clearly distinct from all three paths
  dashArray: "4 4",
};
