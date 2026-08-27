import { useMemo, useState } from "react";
import { formatDate } from "../lib/dateScale";

export interface MilestoneSummary {
  uid: string;
  name: string;
  date: string | null;
  flagged: boolean;
  override: boolean | undefined;
  frozen: boolean;
}

interface Props {
  summaries: MilestoneSummary[];
  onSetOverride: (uid: string, visible: boolean | undefined) => void;
  onUnfreeze: (uid: string) => void;
  onClose: () => void;
}

export function ManageMilestonesPanel({ summaries, onSetOverride, onUnfreeze, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const q = search.trim().toLowerCase();
  const matchesSearch = (s: MilestoneSummary) => !q || s.name.toLowerCase().includes(q);

  // Pinned — "master" in spirit, this is the whole answer to "what am I actually
  // tracking right now, regardless of what any file says." Its own section, always
  // visible, so it's never just an invisible flag buried inside a checkbox list.
  const masterItems = useMemo(
    () =>
      summaries
        .filter((s) => s.override === true && matchesSearch(s))
        .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summaries, q]
  );

  // Everything else — items not pinned into the tracked list above. Checking one here
  // promotes it (it'll then show up in the section above instead); this list itself is
  // just for finding and deciding, not the tracked set.
  const filtered = useMemo(() => {
    const notMaster = summaries.filter((s) => s.override !== true);
    // A search is an explicit "find this specific item" — search across every row in
    // the file, not just the milestone-only scope, or a task you know by name but
    // that isn't flagged yet would silently never appear no matter what you typed.
    // The scope toggle only limits the unfiltered browse list.
    const base = q || showAll ? notMaster : notMaster.filter((s) => s.flagged || s.override !== undefined);
    if (!q) return base;
    return base.filter(matchesSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, showAll, q]);

  const scopedCount = summaries.filter((s) => s.override !== true && (s.flagged || s.override !== undefined)).length;
  const notMasterCount = summaries.filter((s) => s.override !== true).length;
  const hiddenByScope = notMasterCount - scopedCount;

  // A single toggle: once every currently-listed item is visible, the button flips to
  // "Deselect all"; otherwise it offers to select everything currently in view (i.e.
  // respecting the active search/scope filters, not the full unfiltered list).
  const allVisible = filtered.length > 0 && filtered.every((s) => s.override ?? s.flagged);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Manage milestones</h2>
            <p className="text-xs text-slate">
              Choose exactly which items show on the timeline &mdash; this overrides your file's
              flag column, no re-upload needed.
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
            placeholder="Search all tasks by name…"
            className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => filtered.forEach((s) => onSetOverride(s.uid, !allVisible))}
            disabled={filtered.length === 0}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-slate hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={allVisible ? "Deselect all" : "Select all"}
          >
            <span
              className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                allVisible ? "border-accent bg-accent text-white" : "border-slate"
              }`}
            >
              {allVisible && (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                  <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {allVisible ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate">
            Tracked ({masterItems.length}) &mdash; stays, regardless of what any file says
          </p>
          {masterItems.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-slate">
              Nothing pinned yet. Check an item below to add it here, or use "use as master" on a
              snapshot to pin everything it flags at once.
            </p>
          ) : (
            masterItems.map((s) => (
              <div key={s.uid} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
                <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border border-accent bg-accent text-white">
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                    <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{s.name}</div>
                  <div className="text-xs text-slate">
                    {s.date ? (
                      formatDate(s.date)
                    ) : (
                      <span className="text-late" title="No Finish date in its most recent snapshot — nothing to plot.">
                        no date on file — won't show on the timeline
                      </span>
                    )}
                    {s.frozen && (
                      <span className="ml-2 text-slate" title="Not pulling further updates — showing its last known state">
                        ❄ frozen &middot;{" "}
                        <button className="underline" onClick={() => onUnfreeze(s.uid)}>
                          unfreeze
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="flex-shrink-0 text-xs text-slate underline hover:text-late"
                  onClick={() => onSetOverride(s.uid, undefined)}
                  title="Stop pinning — it'll follow whatever this file's own flag says instead"
                >
                  Remove from tracked
                </button>
              </div>
            ))
          )}

          <p className="mt-3 border-t border-line px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-slate">
            Everything else &mdash; check to add to tracked
          </p>
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
                      {s.date ? (
                        formatDate(s.date)
                      ) : (
                        <span className="text-late" title="No Finish date in its most recent snapshot — nothing to plot, so checking this box alone won't make it appear.">
                          no date on file — won't show on the timeline
                        </span>
                      )}
                      {s.override !== undefined && (
                        <span className="ml-2 text-late">
                          hidden &middot;{" "}
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
              {q
                ? "Search looks across every task, milestone or not."
                : `${hiddenByScope} non-milestone task${hiddenByScope === 1 ? "" : "s"} hidden from this list.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
