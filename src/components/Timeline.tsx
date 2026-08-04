import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { addDays, clampZoom, daysBetween, formatDate, monthTicks } from "../lib/dateScale";
import { entryForSnapshot } from "../lib/scrubber";
import { statusOf } from "../lib/milestones";
import type { DisplayOptions, Milestone, Snapshot } from "../types";

interface Props {
  milestones: Milestone[];
  snapshots: Snapshot[];
  activeSnapshotIndex: number;
  displayOptions: DisplayOptions;
}

const STATUS_COLOR: Record<string, string> = {
  "on-track": "#2f6feb",
  slipped: "#cf222e",
  "pulled-in": "#1a7f37",
  done: "#6e7781",
  unknown: "#9aa4b2",
};

const BASELINE_Y = 90;
const LABEL_GAP = 26;
const BAND_HEIGHT = 44;
const LABEL_MIN_GAP_PX = 118;

export function Timeline({ milestones, snapshots, activeSnapshotIndex, displayOptions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSnapshot = snapshots[activeSnapshotIndex];

  const markers = useMemo(() => {
    if (!activeSnapshot) return [];
    return milestones
      .map((m) => {
        const entry = entryForSnapshot(m, snapshots, activeSnapshotIndex);
        if (!entry || !entry.date) return null;
        if (displayOptions.milestonesOnly && !entry.isMilestone) return null;
        return { milestone: m, entry, ...statusOf(m) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [milestones, snapshots, activeSnapshotIndex, activeSnapshot, displayOptions.milestonesOnly]);

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

  const bands = useMemo(() => {
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
    return assigned;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, pxPerDay, domain.start]);

  const maxBand = markers.length ? Math.max(...markers.map((m) => bands.get(m.milestone.uid) ?? 0)) : 0;
  const svgHeight = BASELINE_Y + LABEL_GAP + (maxBand + 1) * BAND_HEIGHT + 20;

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

      <div
        ref={containerRef}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX);
          }
        }}
        className="w-full overflow-x-auto rounded-xl border border-line bg-white"
      >
        <svg width={Math.max(width, 300)} height={svgHeight} className="block">
          {/* month gridlines */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={20} x2={x(t)} y2={svgHeight - 10} stroke="#eaeef2" strokeWidth={1} />
              <text x={x(t) + 4} y={16} fontSize={11} fill="#57606a">
                {formatDate(t, false)}
              </text>
            </g>
          ))}

          {/* baseline */}
          <line x1={0} y1={BASELINE_Y} x2={width} y2={BASELINE_Y} stroke="#d0d7de" strokeWidth={2} />

          {/* today marker */}
          {showToday && (
            <g>
              <line x1={x(todayIso)} y1={20} x2={x(todayIso)} y2={svgHeight - 10} stroke="#2f6feb" strokeDasharray="4 3" strokeWidth={1.5} />
              <text x={x(todayIso) + 4} y={svgHeight - 4} fontSize={10} fill="#2f6feb">
                Today
              </text>
            </g>
          )}

          {markers.map(({ milestone, entry, status, deltaDays }) => {
            const mx = x(entry.date!);
            const band = bands.get(milestone.uid) ?? 0;
            const labelY = BASELINE_Y + LABEL_GAP + band * BAND_HEIGHT;
            const color = STATUS_COLOR[status];
            return (
              <motion.g
                key={milestone.uid}
                animate={{ x: mx }}
                initial={{ x: mx }}
                transition={{ type: "spring", stiffness: 90, damping: 16 }}
              >
                  <line x1={0} y1={BASELINE_Y} x2={0} y2={labelY - 10} stroke={color} strokeWidth={1} opacity={0.5} />
                  <rect
                    x={-6}
                    y={BASELINE_Y - 6}
                    width={12}
                    height={12}
                    fill={color}
                    transform={`rotate(45 0 ${BASELINE_Y})`}
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
        </svg>
      </div>
    </div>
  );
}
