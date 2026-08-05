export type FieldRole =
  | "uid"
  | "name"
  | "start"
  | "finish"
  | "percentComplete"
  | "isMilestone"
  | "group"
  | "slack";

export const FIELD_ROLES: { role: FieldRole; label: string; required: boolean; hint?: string }[] = [
  { role: "uid", label: "Unique ID (UID)", required: true },
  { role: "name", label: "Task / Milestone name", required: true },
  { role: "finish", label: "Date (Finish)", required: true },
  { role: "start", label: "Start date", required: false },
  { role: "percentComplete", label: "% Complete", required: false },
  {
    role: "isMilestone",
    label: "Milestone flag (Yes/No column)",
    required: false,
    hint: "Rows marked Yes here show by default, along with any 0-day tasks (Start = Finish) even if unflagged. Fine-tune individual items later from “Manage milestones” without re-uploading. Leave unset to default to every row in the file.",
  },
  {
    role: "group",
    label: "Group / swimlane (optional)",
    required: false,
    hint: "Splits the timeline into horizontal lanes by this column (e.g. phase, workstream, summary task) so a busy schedule doesn't crowd onto one line. Leave unset for a single timeline line.",
  },
  {
    role: "slack",
    label: "Total Slack (optional)",
    required: false,
    hint: "Marks an item critical (colored) when slack is 0 or negative, i.e. on the critical path — instead of coloring by how much a date has moved, which flags nearly everything on a schedule with any drift. Leave unset to skip critical-path coloring; date movement is still visible via the ghost overlay.",
  },
];

/** Maps a source spreadsheet column name to a known role, or leaves it as a free-form extra field. */
export interface ColumnMapping {
  /** header signature this mapping was learned from, e.g. sorted joined header list */
  signature: string;
  headers: string[];
  roles: Partial<Record<FieldRole, string>>;
  /** headers not mapped to a role are kept as extra fields, shown by their own header name */
  extraFields: string[];
}

export interface RawRow {
  [header: string]: string | number | boolean | null | undefined;
}

export interface Snapshot {
  id: string;
  fileName: string;
  /** as-of date for this snapshot, editable by the user */
  date: string; // ISO yyyy-mm-dd
  createdAt: number;
  headers: string[];
  rows: RawRow[];
}

export interface MilestoneEntry {
  snapshotId: string;
  snapshotDate: string;
  name: string;
  date: string | null; // ISO date, from `finish` role
  startDate: string | null;
  percentComplete: number | null;
  isMilestone: boolean;
  group: string | null;
  /** Total Slack in days, from the `slack` role. <= 0 means on the critical path. */
  slack: number | null;
  extra: Record<string, string | number | boolean | null | undefined>;
}

export interface Milestone {
  uid: string;
  entries: MilestoneEntry[]; // ordered by snapshotDate ascending
}

/**
 * "compact" packs labels under the markers — a dense poster view that only works
 * for short names. "rows" gives every item its own row with a full-width name
 * column, which is what long titles and high item counts actually need.
 * "auto" picks between them based on the data.
 */
export type TimelineLayout = "auto" | "compact" | "rows";

export interface DisplayOptions {
  showName: boolean;
  showDate: boolean;
  showPercentComplete: boolean;
  milestonesOnly: boolean;
  visibleExtraFields: string[];
  /** Alternating background bands tying each swimlane's rows back to its header. */
  laneBands: boolean;
  /** The two colors alternated across lanes when laneBands is on. */
  laneBandColors: [string, string];
  layout: TimelineLayout;
  /** Ghost marker at the original date + arrow to the current one, for items that moved. */
  showMovement: boolean;
}

/** Above either threshold, compact labels collide or truncate, so "auto" switches to rows. */
export const AUTO_ROWS_NAME_LENGTH = 26;
export const AUTO_ROWS_ITEM_COUNT = 14;

export const DEFAULT_LANE_BAND_COLORS: [string, string] = ["#ffffff", "#f6f8fa"];

/** Preset pairs offered in Display options, alongside a free-form color picker. */
export const LANE_BAND_PRESETS: { label: string; colors: [string, string] }[] = [
  { label: "Subtle gray", colors: ["#ffffff", "#f6f8fa"] },
  { label: "Cool blue", colors: ["#ffffff", "#eff6ff"] },
  { label: "Warm sand", colors: ["#ffffff", "#fdf6ec"] },
  { label: "Mint", colors: ["#ffffff", "#effaf3"] },
];

export interface AppSettings {
  displayOptions: DisplayOptions;
}

/** A manual per-UID visibility pin, set from the "Manage milestones" picker. Overrides the spreadsheet flag either way. */
export interface MilestoneOverride {
  uid: string;
  visible: boolean;
}
