import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { addDays, clampZoom, daysBetween, formatDate, monthTicks } from "../lib/dateScale";
import { entryForSnapshot } from "../lib/scrubber";
import { isEntryVisible, statusOf } from "../lib/milestones";
import type { DisplayOptions, Milestone, MilestoneEntry, Snapshot } from "../types";

interface Props {
  milestones: Milestone[];
  snapshots: Snapshot[];
  activeSnapshotIndex: number;
  displayOptions: DisplayOptions;
  overrides: Record<string, boolean>;
}

const STATUS_COLOR: Record<string, string> = {
  "on-track": "#2f6feb",
  slipped: "#cf222e",
  "pulled-in": "#1a7f37",
  done: "#6e7781",
  unknown: "#9aa4b2",
};

const HEADER_HEIGHT = 28;
const LANE_BASELINE_PAD = 22;
const LANE_LABEL_GAP = 26;
const BAND_HEIGHT = 44;
const LANE_BOTTOM_PAD = 14;
const LABEL_MIN_GAP_PX = 118;
const LANE_LABEL_WIDTH = 128;

interface MarkerData {
  milestone: Milestone;
  entry: MilestoneEntry;
  status: ReturnType<typeof statusOf>["status"];
  deltaDays: number;
}

function assignBands(markers: MarkerData[], x: (iso: string) => number) {
  const sorted = [...markers].sort((a, b) => x(a.entry.date!) - x(b.entry.date!));
  const bandLastX: number[] = [];
  const assigned = new Map<string, number>();
  for (const m of sorted) {
    const mx = x(m.entry.date!);
    let band = 0;
    while (bandLastX[band] !== undefined && mx - bandLastX[band] < LABEL_MIN_GAP_PX) band++;
    bandLastX[band] = mx;
    assigned.set(m.milestone.uid, band);
  }
  const maxBand = assigned.size ? Math.max(...assigned.values()) : 0;
  return { bands: assigned, maxBand };
}

export function Timeline({ milestones, snapshots, activeSnapshotIndex, displayOptions, overrides }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSnapshot = snapshots[activeSnapshotIndex];

  const markers = useMemo<MarkerData[]>(() => {
    if (!activeSnapshot) return [];
    return milestones
      .map((m) => {
        const entry = entryForSnapshot(m, snapshots, activeSnapshotIndex);
        if (!entry || !entry.date) return null;
        if (!isEntryVisible(m.uid, entry.isMilestone, displayOptions.milestonesOnly, overrides)) return null;
        return { milestone: m, entry, ...statusOf(m) };
      })
      .filter((x): x is MarkerData => x !== null);
  }, [milestones, snapshots, activeSnapshotIndex, activeSnapshot, displayOptions.milestonesOnly, overrides]);

  const domain = useMemo(() => {
    const allDates = milestones.flatMap((m) => m.entries.map((e) => e.date)).filter(Boolean) as string[];
    if (allDates.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      return { start: addDays(today, -14), end: addDays(today, 30) };
    }
    const sorted = [...allDates].sort();
    return { start: addDays(sorted[0], -7), end: addDays(sorted[sorted.length - 1], 7) };
  }, [milestones]);

  const totalDays = Math.max(1, daysBetween(domain.start, domain.end));
  const [pxPerDay, setPxPerDay] = useState(6);
  const width = totalDays * pxPerDay;
  const x = (iso: string) => daysBetween(domain.start, iso) * pxPerDay;

  const lanes = useMemo(() => {
    const grouped = markers.some((m) => m.entry.group);
    const buckets = new Map<string, MarkerData[]>();
    for (const m of markers) {
      const key = grouped ? m.entry.group ?? "Ungrouped" : "";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(m);
    }
    const earliestDate = (key: string) =>
      buckets.get(key)!.reduce((min, m) => (m.entry.date! < min ? m.entry.date! : min), "9999");
    const keys = grouped
      ? [...buckets.keys()]
          .filter((k) => k !== "Ungrouped")
          .sort((a, b) => earliestDate(a).localeCompare(earliestDate(b)))
          .concat(buckets.has("Ungrouped") ? ["Ungrouped"] : [])
      : [...buckets.keys()];

    let cursor = HEADER_HEIGHT;
    return keys.map((key) => {
      const laneMarkers = buckets.get(key)!;
      const { bands, maxBand } = assignBands(laneMarkers, x);
      const height = LANE_BASELINE_PAD + LANE_LABEL_GAP + (maxBand + 1) * BAND_HEIGHT + LANE_BOTTOM_PAD;
      const top = cursor;
      const baselineY = top + LANE_BASELINE_PAD;
      cursor += height;
      return { key, label: grouped ? key : null, markers: laneMarkers, bands, height, top, baselineY };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, pxPerDay, domain.start]);

  const isGrouped = lanes.length > 0 && lanes[0].label !== null;
  const svgHeight = (lanes.length ? lanes[lanes.length - 1].top + lanes[lanes.length - 1].height : HEADER_HEIGHT) + 8;

  const ticks = useMemo(() => monthTicks(domain.start, domain.end), [domain]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const showToday = todayIso >= domain.start && todayIso <= domain.end;

  const zoom = (factor: number, clientX?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchorPx = clientX !== undefined ? clientX - rect.left + el.scrollLeft : el.scrollLeft + rect.width / 2;
    const anchorDay = anchorPx / pxPerDay;
    const next = clampZoom(pxPerDay * factor);
    setPxPerDay(next);
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft = anchorDay * next - (clientX !== undefined ? clientX - rect.left : rect.width / 2);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate">
          {markers.length} of {milestones.length} item{milestones.length === 1 ? "" : "s"} shown &middot;{" "}
          {activeSnapshot ? formatDate(activeSnapshot.date) : ""}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => zoom(0.75)}
            className="h-7 w-7 rounded-md border border-line bg-white text-sm text-slate hover:bg-gray-50"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => zoom(1.3333)}
            className="h-7 w-7 rounded-md border border-line bg-white text-sm text-slate hover:bg-gray-50"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex rounded-xl border border-line bg-white">
        {isGrouped && (
          <div className="w-32 flex-shrink-0 border-r border-line" style={{ width: LANE_LABEL_WIDTH }}>
            <div style={{ height: HEADER_HEIGHT }} />
            {lanes.map((lane) => (
              <div
                key={lane.key}
                style={{ height: lane.height }}
                className="flex items-center border-t border-line px-3 text-xs font-medium text-slate first:border-t-0"
              >
                <span className="truncate" title={lane.label ?? ""}>
                  {lane.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          ref={containerRef}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              zoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX);
            }
          }}
          className="w-full overflow-x-auto"
        >
          <svg width={Math.max(width, 300)} height={svgHeight} className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} y1={HEADER_HEIGHT - 8} x2={x(t)} y2={svgHeight - 4} stroke="#eaeef2" strokeWidth={1} />
                <text x={x(t) + 4} y={16} fontSize={11} fill="#57606a">
                  {formatDate(t, false)}
                </text>
              </g>
            ))}

            {showToday && (
              <g>
                <line x1={x(todayIso)} y1={HEADER_HEIGHT - 8} x2={x(todayIso)} y2={svgHeight - 4} stroke="#2f6feb" strokeDasharray="4 3" strokeWidth={1.5} />
                <text x={x(todayIso) + 4} y={svgHeight - 4} fontSize={10} fill="#2f6feb">
                  Today
                </text>
              </g>
            )}

            {lanes.map((lane) => (
              <g key={lane.key}>
                {lane.top > HEADER_HEIGHT && (
                  <line x1={0} y1={lane.top} x2={width} y2={lane.top} stroke="#eaeef2" strokeWidth={1} />
                )}
                <line x1={0} y1={lane.baselineY} x2={width} y2={lane.baselineY} stroke="#d0d7de" strokeWidth={2} />

                {lane.markers.map(({ milestone, entry, status, deltaDays }) => {
                  const mx = x(entry.date!);
                  const band = lane.bands.get(milestone.uid) ?? 0;
                  const labelY = lane.baselineY + LANE_LABEL_GAP + band * BAND_HEIGHT;
                  const color = STATUS_COLOR[status];
                  return (
                    <motion.g
                      key={milestone.uid}
                      animate={{ x: mx }}
                      initial={{ x: mx }}
                      transition={{ type: "spring", stiffness: 90, damping: 16 }}
                    >
                      <line x1={0} y1={lane.baselineY} x2={0} y2={labelY - 10} stroke={color} strokeWidth={1} opacity={0.5} />
                      <rect
                        x={-6}
                        y={lane.baselineY - 6}
                        width={12}
                        height={12}
                        fill={color}
                        transform={`rotate(45 0 ${lane.baselineY})`}
                      />
                      <foreignObject x={-56} y={labelY - 12} width={112} height={BAND_HEIGHT}>
                        <div className="text-center leading-tight">
                          {displayOptions.showName && (
                            <div className="truncate text-[11px] font-medium text-ink" title={entry.name}>
                              {entry.name || "(untitled)"}
                            </div>
                          )}
                          {displayOptions.showDate && (
                            <div className="text-[10px] text-slate">{formatDate(entry.date)}</div>
                          )}
                          {displayOptions.showPercentComplete && entry.percentComplete !== null && (
                            <div className="text-[10px] text-slate">{entry.percentComplete}%</div>
                          )}
                          {status === "slipped" && (
                            <div className="text-[10px] font-medium text-late">+{deltaDays}d</div>
                          )}
                          {status === "pulled-in" && (
                            <div className="text-[10px] font-medium text-good">{deltaDays}d</div>
                          )}
                          {displayOptions.visibleExtraFields.map((f) =>
                            entry.extra[f] !== undefined && entry.extra[f] !== null && entry.extra[f] !== "" ? (
                              <div key={f} className="truncate text-[10px] text-slate">
                                {String(entry.extra[f])}
                              </div>
                            ) : null
                          )}
                        </div>
                      </foreignObject>
                    </motion.g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
