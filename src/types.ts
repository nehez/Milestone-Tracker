export type FieldRole = "uid" | "name" | "start" | "finish" | "percentComplete" | "isMilestone";

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
    hint: "Only rows marked Yes here will show on the timeline. Leave unset to show every row in the file.",
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
  extra: Record<string, string | number | boolean | null | undefined>;
}

export interface Milestone {
  uid: string;
  entries: MilestoneEntry[]; // ordered by snapshotDate ascending
}

export interface DisplayOptions {
  showName: boolean;
  showDate: boolean;
  showPercentComplete: boolean;
  milestonesOnly: boolean;
  visibleExtraFields: string[];
}

export interface AppSettings {
  displayOptions: DisplayOptions;
}
