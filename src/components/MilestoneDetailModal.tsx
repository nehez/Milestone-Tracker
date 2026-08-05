import type { ReactNode } from "react";
import { daysBetween, formatDate } from "../lib/dateScale";
import { STATUS_COLOR } from "./timelineShared";
import { statusOf } from "../lib/milestones";
import type { Milestone } from "../types";

interface Props {
  milestone: Milestone;
  onClose: () => void;
}

const CHART_WIDTH = 460;
const CHART_HEIGHT = 160;
const PAD_LEFT = 70;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export function MilestoneDetailModal({ milestone, onClose }: Props) {
  const entries = milestone.entries;
  const latest = entries[entries.length - 1];
  const { status, deltaDays } = statusOf(milestone);
  const color = STATUS_COLOR[status];

  // The trend: for each snapshot, what Finish date did it promise? A line trending
  // up-and-right means the date keeps getting pushed further out with each report —
  // the classic "date creep" read PMs look for.
  const points = entries
    .map((e) => ({ snapshotDate: e.snapshotDate, finishDate: e.date }))
    .filter((p): p is { snapshotDate: string; finishDate: string } => p.finishDate !== null);

  const canChart = points.length >= 2;

  let chart: ReactNode = null;
  if (canChart) {
    const snapshotDates = points.map((p) => p.snapshotDate);
    const finishDates = points.map((p) => p.finishDate);
    const xMin = snapshotDates[0];
    const xMax = snapshotDates[snapshotDates.length - 1];
    const xRange = Math.max(1, daysBetween(xMin, xMax));
    const sortedFinish = [...finishDates].sort();
    const yMin = sortedFinish[0];
    const yMax = sortedFinish[sortedFinish.length - 1];
    const yRange = Math.max(1, daysBetween(yMin, yMax));

    const plotW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

    const px = (iso: string) => PAD_LEFT + (daysBetween(xMin, iso) / xRange) * plotW;
    // Later dates plot higher (smaller y) — a rising line reads as "slipping later".
    const py = (iso: string) => PAD_TOP + (daysBetween(iso, yMax) / yRange) * plotH;

    const linePoints = points.map((p) => `${px(p.snapshotDate)},${py(p.finishDate)}`).join(" ");

    chart = (
      <svg width={CHART_WIDTH} height={CHART_HEIGHT} className="mx-auto block">
        <text x={4} y={PAD_TOP + 4} fontSize={9} fill="#9aa4b2">
          {formatDate(yMax, false)}
        </text>
        <text x={4} y={PAD_TOP + plotH} fontSize={9} fill="#9aa4b2">
          {formatDate(yMin, false)}
        </text>
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={PAD_TOP + plotH}
          stroke="#eaeef2"
          strokeWidth={1}
        />
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP + plotH}
          x2={CHART_WIDTH - PAD_RIGHT}
          y2={PAD_TOP + plotH}
          stroke="#eaeef2"
          strokeWidth={1}
        />
        <polyline points={linePoints} fill="none" stroke="#2f6feb" strokeWidth={1.5} opacity={0.6} />
        {points.map((p, i) => (
          <g key={p.snapshotDate}>
            <circle
              cx={px(p.snapshotDate)}
              cy={py(p.finishDate)}
              r={i === points.length - 1 ? 4 : 3}
              fill={i === points.length - 1 ? color : "#2f6feb"}
            />
            <text
              x={px(p.snapshotDate)}
              y={PAD_TOP + plotH + 16}
              fontSize={9}
              fill="#57606a"
              textAnchor="middle"
            >
              {formatDate(p.snapshotDate, false)}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{latest.name || "(untitled)"}</h2>
            <p className="mt-0.5 text-xs text-slate">
              Currently {formatDate(latest.date)}
              {status === "critical" && (
                <span className="ml-1 font-medium text-late">
                  (critical{deltaDays !== 0 ? ` · ${deltaDays > 0 ? "+" : ""}${deltaDays}d vs. baseline` : ""})
                </span>
              )}
              {status === "on-track" && deltaDays !== 0 && (
                <span className="ml-1 text-slate">
                  ({deltaDays > 0 ? "+" : ""}
                  {deltaDays}d vs. baseline)
                </span>
              )}
              {status === "done" && <span className="ml-1 font-medium text-done">(done)</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <p className="mb-1 mt-5 text-xs font-medium uppercase tracking-wide text-slate">
          Promised date, by snapshot
        </p>
        {canChart ? (
          chart
        ) : (
          <p className="rounded-md bg-mist px-3 py-4 text-center text-sm text-slate">
            Only one snapshot has this item so far — upload another export to see how its date
            moves over time.
          </p>
        )}

        <p className="mb-1 mt-5 text-xs font-medium uppercase tracking-wide text-slate">
          Snapshot history
        </p>
        <div className="overflow-hidden rounded-md border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-mist text-slate">
              <tr>
                <th className="px-3 py-1.5 font-medium">Snapshot</th>
                <th className="px-3 py-1.5 font-medium">Finish</th>
                <th className="px-3 py-1.5 font-medium">Start</th>
                <th className="px-3 py-1.5 font-medium">% Complete</th>
                <th className="px-3 py-1.5 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const prev = i > 0 ? entries[i - 1] : null;
                const delta = prev && prev.date && e.date ? daysBetween(prev.date, e.date) : null;
                return (
                  <tr key={e.snapshotId} className="border-t border-line">
                    <td className="px-3 py-1.5 text-ink">{formatDate(e.snapshotDate)}</td>
                    <td className="px-3 py-1.5 text-ink">{formatDate(e.date)}</td>
                    <td className="px-3 py-1.5 text-slate">{formatDate(e.startDate)}</td>
                    <td className="px-3 py-1.5 text-slate">
                      {e.percentComplete !== null ? `${e.percentComplete}%` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {delta === null || delta === 0 ? (
                        <span className="text-slate">—</span>
                      ) : delta > 0 ? (
                        <span className="font-medium text-late">+{delta}d</span>
                      ) : (
                        <span className="font-medium text-good">{delta}d</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
