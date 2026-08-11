import { toBool, toIsoDate, toNumber, toPercent } from "./excel";
import type {
  ColumnMapping,
  Milestone,
  MilestoneEntry,
  MilestoneOverride,
  RawRow,
  ReviewFlag,
  Snapshot,
} from "../types";

/** Builds UID-keyed milestone histories from a set of snapshots, each with its own column mapping. */
export function buildMilestones(
  snapshots: Snapshot[],
  mappingsBySignature: Record<string, ColumnMapping>
): Milestone[] {
  const byUid = new Map<string, MilestoneEntry[]>();

  for (const snapshot of snapshots) {
    const mapping = mappingsBySignature[headerSignatureOf(snapshot)];
    if (!mapping || !mapping.roles.uid) continue;

    for (const row of snapshot.rows) {
      const uid = readCell(row, mapping.roles.uid);
      if (uid === null || uid === "") continue;
      const uidKey = String(uid);

      const date = mapping.roles.finish ? toIsoDate(readCell(row, mapping.roles.finish)) : null;
      const startDate = mapping.roles.start ? toIsoDate(readCell(row, mapping.roles.start)) : null;
      const flagged = mapping.roles.isMilestone
        ? toBool(readCell(row, mapping.roles.isMilestone))
        : null;
      // MS Project's own definition of a milestone is a 0-duration task; treat those as
      // eligible by default too, even if the flag column was missed for that row.
      const zeroDuration = Boolean(startDate && date && startDate === date);

      const entry: MilestoneEntry = {
        snapshotId: snapshot.id,
        snapshotDate: snapshot.date,
        name: mapping.roles.name ? String(readCell(row, mapping.roles.name) ?? "") : "",
        date,
        startDate,
        percentComplete: mapping.roles.percentComplete
          ? toPercent(readCell(row, mapping.roles.percentComplete))
          : null,
        isMilestone: flagged === null ? true : flagged || zeroDuration,
        explicitFlag: flagged !== null,
        group: mapping.roles.group ? String(readCell(row, mapping.roles.group) ?? "").trim() || null : null,
        slack: mapping.roles.slack ? toNumber(readCell(row, mapping.roles.slack)) : null,
        extra: Object.fromEntries(mapping.extraFields.map((f) => [f, row[f]])),
      };

      if (!byUid.has(uidKey)) byUid.set(uidKey, []);
      byUid.get(uidKey)!.push(entry);
    }
  }

  const milestones: Milestone[] = [];
  for (const [uid, entries] of byUid) {
    entries.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    milestones.push({ uid, entries });
  }
  return milestones;
}

function readCell(row: RawRow, header: string) {
  return row[header];
}

/** Caps a frozen milestone's entries at its freeze point — later snapshots may still
 *  carry a row for that UID, but everything downstream (status, charts, export) should
 *  only ever see its last known state, not any changes that happened after freezing. */
export function applyFreeze(milestones: Milestone[], overrides: Record<string, MilestoneOverride>): Milestone[] {
  return milestones.map((m) => {
    const frozenAt = overrides[m.uid]?.frozenAtSnapshotId;
    if (!frozenAt) return m;
    const idx = m.entries.findIndex((e) => e.snapshotId === frozenAt);
    if (idx === -1) return m;
    return { ...m, entries: m.entries.slice(0, idx + 1) };
  });
}

export function headerSignatureOf(snapshot: Snapshot): string {
  return [...snapshot.headers].map((h) => h.trim().toLowerCase()).sort().join("|");
}

/** Latest entry (most recent snapshot) for a milestone — used for "current state" views. */
export function latestEntry(m: Milestone): MilestoneEntry | undefined {
  return m.entries[m.entries.length - 1];
}

/**
 * A manual override (set from "Manage milestones") always wins. Otherwise, the
 * "milestones only" display toggle decides based on the row's own spreadsheet flag.
 */
export function isEntryVisible(
  uid: string,
  entryIsMilestone: boolean,
  milestonesOnly: boolean,
  overrides: Record<string, MilestoneOverride>
): boolean {
  if (uid in overrides) return overrides[uid].visible;
  return milestonesOnly ? entryIsMilestone : true;
}

export type MilestoneStatus = "on-track" | "critical" | "done" | "unknown";

/**
 * Coloring by "has this date moved at all" flags nearly every item on a real schedule,
 * since a few days of drift is normal noise rather than a problem — the ghost overlay
 * already shows that movement visually. Instead, "critical" reads the schedule's own
 * Total Slack: 0 or negative means the item is on the critical path (MS Project's own
 * definition), which is a meaningful, threshold-free signal for what actually needs
 * attention. deltaDays (first snapshot's date vs. the latest) is still returned for
 * display as a neutral fact, independent of the critical/on-track color.
 */
export function statusOf(m: Milestone): { status: MilestoneStatus; deltaDays: number } {
  const first = m.entries[0];
  const last = latestEntry(m);
  if (!first || !last) return { status: "unknown", deltaDays: 0 };

  const deltaDays =
    first.date && last.date
      ? Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000)
      : 0;

  if (last.percentComplete !== null && last.percentComplete >= 100) {
    return { status: "done", deltaDays };
  }
  if (!first.date || !last.date) return { status: "unknown", deltaDays: 0 };
  if (last.slack !== null && last.slack <= 0) {
    return { status: "critical", deltaDays };
  }
  return { status: "on-track", deltaDays };
}

export interface NewCandidate {
  uid: string;
  name: string;
  date: string | null;
  sourceFileName: string;
}

export interface RemovalCandidate {
  uid: string;
  name: string;
  lastDate: string | null;
  reason: "missing" | "flagged-no";
  sourceFileName: string;
}

/**
 * UIDs with a genuine "this is a milestone" signal (an explicit Yes flag, or a 0-day
 * task) that aren't tracked yet and haven't already been dismissed. A file with no
 * flag column mapped never produces a signal here, even though its rows default to
 * isMilestone=true for display purposes — see MilestoneEntry.explicitFlag.
 */
export function findNewCandidates(
  milestones: Milestone[],
  snapshots: Snapshot[],
  overrides: Record<string, MilestoneOverride>,
  reviewFlags: Record<string, ReviewFlag>
): NewCandidate[] {
  const snapshotById = new Map(snapshots.map((s) => [s.id, s]));
  const result: NewCandidate[] = [];
  for (const m of milestones) {
    if (m.uid in overrides) continue;
    if (reviewFlags[m.uid]?.candidateDismissed) continue;
    // Most recent entry that actually carried the signal, for a meaningful "found in" file.
    const signal = [...m.entries].reverse().find((e) => e.explicitFlag && e.isMilestone);
    if (!signal) continue;
    const latest = latestEntry(m)!;
    result.push({
      uid: m.uid,
      name: latest.name || "(untitled)",
      date: latest.date,
      sourceFileName: snapshotById.get(signal.snapshotId)?.fileName ?? "",
    });
  }
  return result;
}

/**
 * Currently-tracked (override.visible, not frozen) UIDs that either dropped out of the
 * most recent snapshot entirely, or got explicitly flagged No there — treated the same
 * way, since both mean "this file no longer claims it's a milestone." Checked only
 * against the latest snapshot: what matters is whether it's still there *now*.
 */
export function findRemovalCandidates(
  milestones: Milestone[],
  snapshots: Snapshot[],
  overrides: Record<string, MilestoneOverride>,
  reviewFlags: Record<string, ReviewFlag>
): RemovalCandidate[] {
  const latestSnapshot = snapshots[snapshots.length - 1];
  if (!latestSnapshot) return [];
  const milestoneByUid = new Map(milestones.map((m) => [m.uid, m]));
  const result: RemovalCandidate[] = [];

  for (const [uid, override] of Object.entries(overrides)) {
    if (!override.visible || override.frozenAtSnapshotId) continue;
    const m = milestoneByUid.get(uid);
    const latest = m ? latestEntry(m) : undefined;
    const inLatestSnapshot = m?.entries.find((e) => e.snapshotId === latestSnapshot.id);

    let reason: RemovalCandidate["reason"] | null = null;
    if (!inLatestSnapshot) reason = "missing";
    else if (inLatestSnapshot.explicitFlag && !inLatestSnapshot.isMilestone) reason = "flagged-no";
    if (!reason) continue;

    if (reviewFlags[uid]?.removalDismissedReason === reason) continue;
    result.push({
      uid,
      name: latest?.name || "(untitled)",
      lastDate: latest?.date ?? null,
      reason,
      sourceFileName: latestSnapshot.fileName,
    });
  }
  return result;
}
