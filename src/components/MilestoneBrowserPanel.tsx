import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "../lib/dateScale";

export interface MilestoneSummary {
  uid: string;
  name: string;
  date: string | null;
  group: string | null;
  percentComplete: number | null;
  flagged: boolean;
  override: boolean | undefined;
  frozen: boolean;
  extra: Record<string, string | number | boolean | null | undefined>;
}

interface Props {
  summaries: MilestoneSummary[];
  onSetOverride: (uid: string, visible: boolean | undefined) => void;
  onUnfreeze: (uid: string) => void;
  onClose: () => void;
}

type FilterChip = "all" | "tracked" | "flagged" | "hidden";
type SortKey = "tracked" | "name" | "date" | "group" | "percentComplete";

const ROW_HEIGHT = 44;
const OVERSCAN = 10;

/**
 * A searchable, sortable, filterable table over every row in the uploaded file(s) —
 * built for browsing a large spreadsheet and hand-picking what to track, rather than
 * relying on a flag column being reliable or pre-trimming the file yourself. Rows are
 * windowed (only what's in view gets a DOM node) so this stays fast at any file size.
 */
export function MilestoneBrowserPanel({ summaries, onSetOverride, onUnfreeze, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");
  const [sortKey, setSortKey] = useState<SortKey>("tracked");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(420);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasGroups = summaries.some((s) => s.group);
  const hasPercent = summaries.some((s) => s.percentComplete !== null);

  const q = search.trim().toLowerCase();
  const chipCounts = useMemo(
    () => ({
      all: summaries.length,
      tracked: summaries.filter((s) => s.override === true).length,
      flagged: summaries.filter((s) => s.flagged).length,
      hidden: summaries.filter((s) => s.override === false).length,
    }),
    [summaries]
  );

  const rows = useMemo(() => {
    let base = summaries;
    if (chip === "tracked") base = base.filter((s) => s.override === true);
    else if (chip === "flagged") base = base.filter((s) => s.flagged);
    else if (chip === "hidden") base = base.filter((s) => s.override === false);
    if (q) base = base.filter((s) => s.name.toLowerCase().includes(q));

    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...base].sort((a, b) => {
      switch (sortKey) {
        case "tracked": {
          const av = a.override === true ? 1 : 0;
          const bv = b.override === true ? 1 : 0;
          if (av !== bv) return (av - bv) * dir;
          return (a.date ?? "9999").localeCompare(b.date ?? "9999");
        }
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "date":
          return (a.date ?? "9999").localeCompare(b.date ?? "9999") * dir;
        case "group":
          return (a.group ?? "").localeCompare(b.group ?? "") * dir;
        case "percentComplete":
          return ((a.percentComplete ?? -1) - (b.percentComplete ?? -1)) * dir;
        default:
          return 0;
      }
    });
    return sorted;
  }, [summaries, chip, q, sortKey, sortDir]);

  const allVisibleTracked = rows.length > 0 && rows.every((s) => s.override ?? s.flagged);

  const totalHeight = rows.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(startIndex, endIndex);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "tracked" ? "desc" : "asc");
    }
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const chips: { key: FilterChip; label: string }[] = [
    { key: "all", label: `All (${chipCounts.all})` },
    { key: "tracked", label: `Tracked (${chipCounts.tracked})` },
    { key: "flagged", label: `Flagged in file (${chipCounts.flagged})` },
    { key: "hidden", label: `Hidden (${chipCounts.hidden})` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Browse &amp; track milestones</h2>
            <p className="text-xs text-slate">
              Every row from your file(s) &mdash; search, sort, and check what you want tracked.
              Checking always wins over the file's own flag; nothing changes on its own.
            </p>
          </div>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="min-w-[180px] flex-1 rounded-md border border-line px-3 py-1.5 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setChip(c.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  chip === c.key
                    ? "border-accent bg-accent text-white"
                    : "border-line text-slate hover:bg-gray-50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => rows.forEach((s) => onSetOverride(s.uid, !allVisibleTracked))}
            disabled={rows.length === 0}
            className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-slate hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={allVisibleTracked ? "Deselect all shown" : "Select all shown"}
          >
            {allVisibleTracked ? "Deselect all shown" : "Select all shown"}
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-line bg-mist px-5 py-2 text-xs font-medium uppercase tracking-wide text-slate">
          <span className="w-6 flex-shrink-0" />
          <button onClick={() => toggleSort("name")} className="flex-1 text-left hover:text-ink">
            Name{sortArrow("name")}
          </button>
          <button onClick={() => toggleSort("date")} className="w-24 flex-shrink-0 text-left hover:text-ink">
            Date{sortArrow("date")}
          </button>
          {hasGroups && (
            <button onClick={() => toggleSort("group")} className="w-28 flex-shrink-0 text-left hover:text-ink">
              Group{sortArrow("group")}
            </button>
          )}
          {hasPercent && (
            <button onClick={() => toggleSort("percentComplete")} className="w-14 flex-shrink-0 text-right hover:text-ink">
              %{sortArrow("percentComplete")}
            </button>
          )}
          <button onClick={() => toggleSort("tracked")} className="w-24 flex-shrink-0 text-right hover:text-ink">
            Tracked{sortArrow("tracked")}
          </button>
        </div>

        <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
          {rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-slate">No items match.</p>
          ) : (
            <div style={{ height: totalHeight, position: "relative" }}>
              {visibleRows.map((s, i) => {
                const rowIndex = startIndex + i;
                const visible = s.override ?? s.flagged;
                return (
                  <div
                    key={s.uid}
                    style={{ position: "absolute", top: rowIndex * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
                    className="flex items-center gap-2 border-b border-line px-5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      className="w-6 flex-shrink-0"
                      checked={visible}
                      onChange={(e) => onSetOverride(s.uid, e.target.checked)}
                    />
                    <div className="min-w-0 flex-1 truncate text-ink" title={s.name}>
                      {s.name}
                    </div>
                    <div className="w-24 flex-shrink-0 truncate text-xs text-slate">
                      {s.date ? (
                        formatDate(s.date)
                      ) : (
                        <span className="text-late" title="No Finish date — nothing to plot even if tracked.">
                          no date
                        </span>
                      )}
                    </div>
                    {hasGroups && (
                      <div className="w-28 flex-shrink-0 truncate text-xs text-slate" title={s.group ?? ""}>
                        {s.group ?? "—"}
                      </div>
                    )}
                    {hasPercent && (
                      <div className="w-14 flex-shrink-0 text-right text-xs text-slate">
                        {s.percentComplete !== null ? `${s.percentComplete}%` : "—"}
                      </div>
                    )}
                    <div className="w-24 flex-shrink-0 text-right text-xs">
                      {s.frozen ? (
                        <span className="text-slate" title="Not pulling further updates — showing its last known state">
                          ❄{" "}
                          <button className="underline" onClick={() => onUnfreeze(s.uid)}>
                            unfreeze
                          </button>
                        </span>
                      ) : s.override === true ? (
                        <span className="text-accent">
                          tracked ·{" "}
                          <button className="underline" onClick={() => onSetOverride(s.uid, undefined)}>
                            reset
                          </button>
                        </span>
                      ) : s.override === false ? (
                        <span className="text-late">
                          hidden ·{" "}
                          <button className="underline" onClick={() => onSetOverride(s.uid, undefined)}>
                            reset
                          </button>
                        </span>
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
