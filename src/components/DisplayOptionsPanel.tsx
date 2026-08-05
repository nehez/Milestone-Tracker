import { LANE_BAND_PRESETS } from "../types";
import type { DisplayOptions, TimelineLayout } from "../types";

const LAYOUT_CHOICES: { value: TimelineLayout; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Rows when names are long or the chart is busy" },
  { value: "compact", label: "Compact", hint: "Labels under markers — best for a few short names" },
  { value: "rows", label: "Rows", hint: "One row each, full names — best for long titles" },
];

interface Props {
  options: DisplayOptions;
  allExtraFields: string[];
  hasSwimlanes: boolean;
  onChange: (updater: (prev: DisplayOptions) => DisplayOptions) => void;
  onClose: () => void;
}

export function DisplayOptionsPanel({ options, allExtraFields, hasSwimlanes, onChange, onClose }: Props) {
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

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Marker colors</p>
      <div className="mb-3 space-y-1 text-xs text-slate">
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px] bg-[#6e7781]" /> Done (100%)
        </p>
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px] border-2 border-[#cf222e] bg-white" />{" "}
          Critical (Total Slack ≤ 0, if mapped)
        </p>
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px] border-2 border-[#2f6feb] bg-white" />{" "}
          On track — everything else. Date movement shows via the ghost overlay below, not color.
        </p>
      </div>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate">Layout</p>
      <div className="mb-1 flex rounded-md border border-line p-0.5">
        {LAYOUT_CHOICES.map((choice) => (
          <button
            key={choice.value}
            onClick={() => onChange((prev) => ({ ...prev, layout: choice.value }))}
            title={choice.hint}
            className={`flex-1 rounded px-2 py-1 text-xs ${
              options.layout === choice.value
                ? "bg-accent font-medium text-white"
                : "text-slate hover:bg-gray-50"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-slate">
        {LAYOUT_CHOICES.find((c) => c.value === options.layout)?.hint}
      </p>

      <label className="mb-1 flex items-center gap-2 py-1 text-sm">
        <input
          type="checkbox"
          checked={options.showMovement}
          onChange={() => toggle("showMovement")}
        />
        Show movement (baseline → now)
      </label>
      <p className="mb-3 text-xs text-slate">
        A faded marker at the original date, with an arrow to where it stands now — so a slip or
        pull-in reads from a still PNG/PDF, not just the on-screen animation.
      </p>

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

      {hasSwimlanes && (
        <>
          <hr className="my-3 border-line" />
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={options.laneBands} onChange={() => toggle("laneBands")} />
            Alternating swimlane bands
          </label>
          {options.laneBands && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {LANE_BAND_PRESETS.map((preset) => {
                  const active =
                    options.laneBandColors[0] === preset.colors[0] &&
                    options.laneBandColors[1] === preset.colors[1];
                  return (
                    <button
                      key={preset.label}
                      onClick={() => onChange((prev) => ({ ...prev, laneBandColors: preset.colors }))}
                      title={preset.label}
                      aria-label={`Band colors: ${preset.label}`}
                      className={`flex h-7 w-9 overflow-hidden rounded border ${
                        active ? "border-accent ring-1 ring-accent" : "border-line"
                      }`}
                    >
                      <span className="h-full w-1/2" style={{ background: preset.colors[0] }} />
                      <span className="h-full w-1/2" style={{ background: preset.colors[1] }} />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate">
                {([0, 1] as const).map((i) => (
                  <label key={i} className="flex items-center gap-1">
                    <input
                      type="color"
                      value={options.laneBandColors[i]}
                      onChange={(e) =>
                        onChange((prev) => {
                          const next: [string, string] = [...prev.laneBandColors];
                          next[i] = e.target.value;
                          return { ...prev, laneBandColors: next };
                        })
                      }
                      className="h-6 w-8 cursor-pointer rounded border border-line"
                      aria-label={i === 0 ? "First band color" : "Second band color"}
                    />
                    {i === 0 ? "Odd lanes" : "Even lanes"}
                  </label>
                ))}
              </div>
            </div>
          )}
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
