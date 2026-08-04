import { motion } from "framer-motion";
import { formatDate } from "../lib/dateScale";
import type { DisplayOptions } from "../types";
import type { LaneGroup, MarkerData } from "./timelineShared";
import { STATUS_COLOR, hasMovement, isBarMarker, springTransition } from "./timelineShared";
import { MovementGhost } from "./MovementGhost";

// Wide enough for a full real-world milestone title (e.g. "SVT MS: Blipty Squat Y
// section acceptance complete") on one line, with two-line wrap as the fallback.
export const NAME_COL_WIDTH = 380;
export const ROW_HEIGHT = 32;
export const LANE_HEADER_HEIGHT = 28;
export const ROWS_HEADER_HEIGHT = 28;

interface RowLayoutItem {
  kind: "lane" | "marker";
  key: string;
  label: string;
  marker?: MarkerData;
  laneIndex: number;
  top: number;
  height: number;
}

/** Flattens lane groups into a flat, ordered list of rendered rows (lane headers + one row per item). */
export function buildRows(lanes: LaneGroup[], grouped: boolean): RowLayoutItem[] {
  const rows: RowLayoutItem[] = [];
  let cursor = ROWS_HEADER_HEIGHT;
  lanes.forEach((lane, laneIndex) => {
    if (grouped) {
      rows.push({
        kind: "lane",
        key: `lane-${lane.key}`,
        label: lane.label ?? "",
        laneIndex,
        top: cursor,
        height: LANE_HEADER_HEIGHT,
      });
      cursor += LANE_HEADER_HEIGHT;
    }
    const sorted = [...lane.markers].sort((a, b) =>
      (a.entry.date ?? "").localeCompare(b.entry.date ?? "")
    );
    for (const m of sorted) {
      rows.push({
        kind: "marker",
        key: m.milestone.uid,
        label: m.entry.name || "(untitled)",
        marker: m,
        laneIndex,
        top: cursor,
        height: ROW_HEIGHT,
      });
      cursor += ROW_HEIGHT;
    }
  });
  return rows;
}

interface NameColumnProps {
  rows: RowLayoutItem[];
  svgHeight: number;
  laneBandColor: (i: number) => string | undefined;
  onSelectMilestone: (milestone: MarkerData["milestone"]) => void;
}

const NAME_FONT_SIZE = 11.5;
const LANE_FONT_SIZE = 10.5;
const NAME_INDENT = 20;
const LANE_INDENT = 12;

/** Rough average glyph width for the UI font, used to fit names to the column. */
function truncateToWidth(text: string, fontSize: number, availableWidth: number): string {
  const maxChars = Math.floor(availableWidth / (fontSize * 0.55));
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

/**
 * Name column: full titles get their own dedicated space instead of competing for
 * horizontal room under a marker. Rendered outside the horizontally-scrolling chart
 * so names stay put while the timeline scrolls.
 *
 * Drawn as SVG text rather than HTML: html2canvas vertically clips and misaligns
 * HTML text in fixed-height flex rows, so an HTML column exported differently than
 * it looked on screen. SVG <text> rasterizes identically in both.
 */
export function TimelineRowsNameColumn({ rows, svgHeight, laneBandColor, onSelectMilestone }: NameColumnProps) {
  return (
    <div className="flex-shrink-0 border-r border-line" style={{ width: NAME_COL_WIDTH }}>
      <svg width={NAME_COL_WIDTH} height={svgHeight} className="block">
        {rows.map((row) => {
          const bg = laneBandColor(row.laneIndex);
          return bg ? (
            <rect
              key={`bg-${row.key}`}
              x={0}
              y={row.top}
              width={NAME_COL_WIDTH}
              height={row.height}
              fill={bg}
            />
          ) : null;
        })}
        {rows.map((row) => {
          const isLane = row.kind === "lane";
          const fontSize = isLane ? LANE_FONT_SIZE : NAME_FONT_SIZE;
          const indent = isLane ? LANE_INDENT : NAME_INDENT;
          const text = truncateToWidth(
            isLane ? row.label.toUpperCase() : row.label,
            fontSize,
            NAME_COL_WIDTH - indent - 8
          );
          return (
            <g
              key={row.key}
              onClick={row.marker ? () => onSelectMilestone(row.marker!.milestone) : undefined}
              className={row.marker ? "cursor-pointer" : undefined}
            >
              {isLane && (
                <line x1={0} y1={row.top} x2={NAME_COL_WIDTH} y2={row.top} stroke="#d0d7de" strokeWidth={1} />
              )}
              {row.marker && (
                <rect x={0} y={row.top} width={NAME_COL_WIDTH} height={row.height} fill="transparent" />
              )}
              <text
                x={indent}
                y={row.top + row.height / 2 + fontSize * 0.35}
                fontSize={fontSize}
                fill={isLane ? "#57606a" : "#1c2128"}
                fontWeight={isLane ? 600 : 400}
                letterSpacing={isLane ? 0.4 : 0}
              >
                {text}
                <title>{row.label}</title>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface Props {
  rows: RowLayoutItem[];
  width: number;
  svgHeight: number;
  displayOptions: DisplayOptions;
  laneBandColor: (i: number) => string | undefined;
  x: (iso: string) => number;
  ticks: string[];
  todayIso: string;
  showToday: boolean;
  onSelectMilestone: (milestone: MarkerData["milestone"]) => void;
}

export function TimelineRowsChart({
  rows,
  width,
  svgHeight,
  displayOptions,
  laneBandColor,
  x,
  ticks,
  todayIso,
  showToday,
  onSelectMilestone,
}: Props) {
  return (
      <svg width={Math.max(width, 300)} height={svgHeight} className="block">
        {rows.map((row) => {
          const bg = laneBandColor(row.laneIndex);
          return bg ? (
            <rect key={`bg-${row.key}`} x={0} y={row.top} width={width} height={row.height} fill={bg} />
          ) : null;
        })}

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={ROWS_HEADER_HEIGHT - 8}
              x2={x(t)}
              y2={svgHeight - 4}
              stroke="#eaeef2"
              strokeWidth={1}
            />
            <text x={x(t) + 4} y={16} fontSize={11} fill="#57606a">
              {formatDate(t, false)}
            </text>
          </g>
        ))}

        {showToday && (
          <g>
            <line
              x1={x(todayIso)}
              y1={ROWS_HEADER_HEIGHT - 8}
              x2={x(todayIso)}
              y2={svgHeight - 4}
              stroke="#2f6feb"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            <text x={x(todayIso) + 4} y={svgHeight - 4} fontSize={10} fill="#2f6feb">
              Today
            </text>
          </g>
        )}

        {rows.map((row) => {
          if (row.kind === "lane") {
            return (
              <line
                key={`sep-${row.key}`}
                x1={0}
                y1={row.top}
                x2={width}
                y2={row.top}
                stroke="#d0d7de"
                strokeWidth={1}
              />
            );
          }

          const m = row.marker!;
          const { entry, status, deltaDays } = m;
          const midY = row.top + row.height / 2;
          const color = STATUS_COLOR[status];
          const bar = isBarMarker(m);
          const markerX = bar ? x(entry.startDate!) : x(entry.date!);
          const barWidth = bar ? Math.max(x(entry.date!) - x(entry.startDate!), 4) : 0;
          const fillWidth =
            bar && entry.percentComplete !== null ? barWidth * (entry.percentComplete / 100) : barWidth;

          // Trailing text sits just past the marker; with a row each, there is no
          // collision risk, so no truncation or band-packing is needed.
          const parts: string[] = [];
          if (displayOptions.showDate) {
            parts.push(
              bar ? `${formatDate(entry.startDate, false)} – ${formatDate(entry.date)}` : formatDate(entry.date)
            );
          }
          if (displayOptions.showPercentComplete && entry.percentComplete !== null) {
            parts.push(`${entry.percentComplete}%`);
          }
          displayOptions.visibleExtraFields.forEach((f) => {
            const v = entry.extra[f];
            if (v !== undefined && v !== null && v !== "") parts.push(String(v));
          });

          const first = m.milestone.entries[0];
          const showGhost = displayOptions.showMovement && hasMovement(m);

          // A pulled-in item's ghost sits to the right of its current marker (that's
          // where it used to be), the same side the trailing label normally goes —
          // flip the label to the left in that case so the two don't overlap.
          const newAnchor = bar ? markerX + barWidth / 2 : markerX;
          const oldAnchor =
            showGhost && first.date
              ? bar && first.startDate
                ? (x(first.startDate) + x(first.date)) / 2
                : x(first.date)
              : null;
          const ghostOnRight = oldAnchor !== null && oldAnchor > newAnchor;
          const textX = ghostOnRight ? markerX - 10 : (bar ? markerX + barWidth : markerX) + 10;

          return (
            <g
              key={row.key}
              onClick={() => onSelectMilestone(m.milestone)}
              className="cursor-pointer"
            >
              <rect x={0} y={row.top} width={width} height={row.height} fill="transparent" />
              <line
                x1={0}
                y1={row.top + row.height}
                x2={width}
                y2={row.top + row.height}
                stroke="#f0f3f6"
                strokeWidth={1}
              />
              {showGhost &&
                (bar
                  ? first.startDate &&
                    first.date && (
                      <MovementGhost
                        isBar
                        y={midY}
                        color={color}
                        oldStart={x(first.startDate)}
                        oldEnd={x(first.date)}
                        newStart={markerX}
                        newEnd={markerX + barWidth}
                      />
                    )
                  : first.date && (
                      <MovementGhost
                        isBar={false}
                        y={midY}
                        color={color}
                        oldStart={x(first.date)}
                        oldEnd={x(first.date)}
                        newStart={markerX}
                        newEnd={markerX}
                      />
                    ))}
              {bar ? (
                <>
                  <motion.rect
                    animate={{ x: markerX, width: barWidth }}
                    initial={{ x: markerX, width: barWidth }}
                    transition={springTransition}
                    y={midY - 4}
                    height={8}
                    rx={4}
                    fill="#d0d7de"
                  />
                  <motion.rect
                    animate={{ x: markerX, width: fillWidth }}
                    initial={{ x: markerX, width: fillWidth }}
                    transition={springTransition}
                    y={midY - 4}
                    height={8}
                    rx={4}
                    fill={color}
                  />
                </>
              ) : (
                <motion.g
                  animate={{ x: markerX }}
                  initial={{ x: markerX }}
                  transition={springTransition}
                >
                  <rect
                    x={-5}
                    y={midY - 5}
                    width={10}
                    height={10}
                    fill={color}
                    transform={`rotate(45 0 ${midY})`}
                  />
                </motion.g>
              )}

              <motion.text
                animate={{ x: textX }}
                initial={{ x: textX }}
                transition={springTransition}
                y={midY + 3.5}
                textAnchor={ghostOnRight ? "end" : "start"}
                fontSize={10}
                fill="#57606a"
              >
                {parts.join("  ·  ")}
                {status === "slipped" && (
                  <tspan fill="#cf222e" fontWeight={600}>
                    {parts.length ? "  ·  " : ""}+{deltaDays}d
                  </tspan>
                )}
                {status === "pulled-in" && (
                  <tspan fill="#1a7f37" fontWeight={600}>
                    {parts.length ? "  ·  " : ""}
                    {deltaDays}d
                  </tspan>
                )}
              </motion.text>
            </g>
          );
        })}
      </svg>
  );
}
