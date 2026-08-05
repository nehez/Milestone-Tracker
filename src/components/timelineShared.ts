import { statusOf } from "../lib/milestones";
import { AUTO_ROWS_ITEM_COUNT, AUTO_ROWS_NAME_LENGTH } from "../types";
import type { Milestone, MilestoneEntry, TimelineLayout } from "../types";

export const STATUS_COLOR: Record<string, string> = {
  "on-track": "#2f6feb",
  slipped: "#cf222e",
  "pulled-in": "#1a7f37",
  done: "#6e7781",
  unknown: "#9aa4b2",
};

export const springTransition = { type: "spring" as const, stiffness: 90, damping: 16 };

export interface MarkerData {
  milestone: Milestone;
  entry: MilestoneEntry;
  status: ReturnType<typeof statusOf>["status"];
  deltaDays: number;
}

export interface LaneGroup {
  key: string;
  label: string | null;
  markers: MarkerData[];
  bands: Map<string, number>;
  height: number;
  top: number;
  baselineY: number;
}

/** Non-milestone items with a real Start/Finish span render as a duration bar instead of a point. */
export function isBarMarker(m: MarkerData): boolean {
  return !m.entry.isMilestone && Boolean(m.entry.startDate) && m.entry.startDate !== m.entry.date;
}

/** Where a marker's label/connector anchors horizontally: the point for a milestone, the midpoint for a bar. */
export function markerAnchorX(m: MarkerData, x: (iso: string) => number): number {
  if (isBarMarker(m)) return (x(m.entry.startDate!) + x(m.entry.date!)) / 2;
  return x(m.entry.date!);
}

/**
 * Whether this item's date(s) differ between its very first recorded snapshot and
 * the snapshot currently on screen — i.e. whether a "moved from here" ghost has
 * anything to show. Used by the movement overlay, which is the only way a static
 * PNG/PDF export can convey the animation the live scrubber shows.
 */
export function hasMovement(m: MarkerData): boolean {
  const first = m.milestone.entries[0];
  if (!first) return false;
  if (isBarMarker(m)) {
    if (!first.startDate || !first.date) return false;
    return first.startDate !== m.entry.startDate || first.date !== m.entry.date;
  }
  if (!first.date) return false;
  return first.date !== m.entry.date;
}

/**
 * Compact labels sit in a ~112px slot under each marker, so long names truncate and
 * dense schedules stack into unreadable bands. Auto falls back to the row layout
 * once either becomes likely.
 */
export function resolveLayout(layout: TimelineLayout, markers: MarkerData[]): "compact" | "rows" {
  if (layout !== "auto") return layout;
  if (markers.length > AUTO_ROWS_ITEM_COUNT) return "rows";
  const longest = markers.reduce((max, m) => Math.max(max, (m.entry.name ?? "").length), 0);
  return longest > AUTO_ROWS_NAME_LENGTH ? "rows" : "compact";
}

/** Rough average glyph width for the UI font, used to fit names into a fixed-width SVG column. */
export function truncateToWidth(text: string, fontSize: number, availableWidth: number): string {
  const maxChars = Math.floor(availableWidth / (fontSize * 0.55));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

/** SVG <text> y for a glyph vertically centered on centerY — text y is the glyph baseline, not its middle. */
export function verticalCenterY(centerY: number, fontSize: number): number {
  return centerY + fontSize * 0.35;
}
