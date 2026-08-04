import type { DisplayOptions } from "../types";

interface Props {
  options: DisplayOptions;
  allExtraFields: string[];
  onChange: (updater: (prev: DisplayOptions) => DisplayOptions) => void;
  onClose: () => void;
}

export function DisplayOptionsPanel({ options, allExtraFields, onChange, onClose }: Props) {
  const toggle = (key: keyof DisplayOptions) =>
    onChange((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleExtra = (field: string) =>
    onChange((prev) => ({
      ...prev,
      visibleExtraFields: prev.visibleExtraFields.includes(field)
        ? prev.visibleExtraFields.filter((f) => f !== field)
        : [...prev.visibleExtraFields, field],
    }));

  return (
    <div className="absolute right-0 top-12 z-40 w-72 rounded-xl border border-line bg-white p-4 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Display options</h3>
        <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
          ✕
        </button>
      </div>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Show on each marker</p>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" checked={options.showName} onChange={() => toggle("showName")} />
        Task / milestone name
      </label>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" checked={options.showDate} onChange={() => toggle("showDate")} />
        Date
      </label>
      <label className="flex items-center gap-2 py-1 text-sm">
        <input
          type="checkbox"
          checked={options.showPercentComplete}
          onChange={() => toggle("showPercentComplete")}
        />
        % Complete
      </label>

      {allExtraFields.length > 0 && (
        <>
          <p className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-slate">
            Other columns from your file
          </p>
          {allExtraFields.map((f) => (
            <label key={f} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={options.visibleExtraFields.includes(f)}
                onChange={() => toggleExtra(f)}
              />
              {f}
            </label>
          ))}
        </>
      )}

      <hr className="my-3 border-line" />

      <label className="flex items-center gap-2 py-1 text-sm">
        <input
          type="checkbox"
          checked={options.milestonesOnly}
          onChange={() => toggle("milestonesOnly")}
        />
        Only show milestones (flagged "Yes", or 0-day tasks)
      </label>
      <p className="mt-1 text-xs text-slate">
        Turn this off to show every row in the file. Individual items can be overridden either way
        from "Manage milestones."
      </p>
    </div>
  );
}
