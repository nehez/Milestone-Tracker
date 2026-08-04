import { useMemo, useState } from "react";
import { formatDate } from "../lib/dateScale";

export interface MilestoneSummary {
  uid: string;
  name: string;
  date: string | null;
  flagged: boolean;
  override: boolean | undefined;
}

interface Props {
  summaries: MilestoneSummary[];
  onSetOverride: (uid: string, visible: boolean | undefined) => void;
  onClose: () => void;
}

export function ManageMilestonesPanel({ summaries, onSetOverride, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const base = showAll ? summaries : summaries.filter((s) => s.flagged || s.override !== undefined);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((s) => s.name.toLowerCase().includes(q));
  }, [summaries, showAll, search]);

  const scopedCount = summaries.filter((s) => s.flagged || s.override !== undefined).length;
  const hiddenByScope = summaries.length - scopedCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Manage milestones</h2>
            <p className="text-xs text-slate">
              Choose exactly which items show on the timeline &mdash; this overrides your file's
              flag column, no re-upload needed. Milestones (flagged, or 0-day tasks) are listed by
              default; there usually aren't many.
            </p>
          </div>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={showAll ? "Search all tasks by name…" : "Search milestones by name…"}
            className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate">No items match.</p>
          ) : (
            filtered.map((s) => {
              const visible = s.override ?? s.flagged;
              return (
                <div
                  key={s.uid}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => onSetOverride(s.uid, e.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ink">{s.name}</div>
                    <div className="text-xs text-slate">
                      {formatDate(s.date)}
                      {s.override !== undefined && (
                        <span className="ml-2 text-accent">
                          overridden &middot;{" "}
                          <button
                            className="underline"
                            onClick={() => onSetOverride(s.uid, undefined)}
                          >
                            reset
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-line px-5 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show every row in the file, including non-milestone tasks
          </label>
          {!showAll && hiddenByScope > 0 && (
            <p className="mt-1 text-xs text-slate">
              {hiddenByScope} non-milestone task{hiddenByScope === 1 ? "" : "s"} hidden from this list.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
