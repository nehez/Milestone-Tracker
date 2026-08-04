import { toBool, toIsoDate, toPercent } from "./excel";
import type { ColumnMapping, Milestone, MilestoneEntry, RawRow, Snapshot } from "../types";

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

      const entry: MilestoneEntry = {
        snapshotId: snapshot.id,
        snapshotDate: snapshot.date,
        name: mapping.roles.name ? String(readCell(row, mapping.roles.name) ?? "") : "",
        date: mapping.roles.finish ? toIsoDate(readCell(row, mapping.roles.finish)) : null,
        startDate: mapping.roles.start ? toIsoDate(readCell(row, mapping.roles.start)) : null,
        percentComplete: mapping.roles.percentComplete
          ? toPercent(readCell(row, mapping.roles.percentComplete))
          : null,
        isMilestone: mapping.roles.isMilestone
          ? toBool(readCell(row, mapping.roles.isMilestone))
          : true,
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

export function headerSignatureOf(snapshot: Snapshot): string {
  return [...snapshot.headers].map((h) => h.trim().toLowerCase()).sort().join("|");
}

/** Latest entry (most recent snapshot) for a milestone — used for "current state" views. */
export function latestEntry(m: Milestone): MilestoneEntry | undefined {
  return m.entries[m.entries.length - 1];
}

export type MilestoneStatus = "on-track" | "slipped" | "pulled-in" | "done" | "unknown";

/** Compares the first and latest snapshot dates to classify how a milestone has moved. */
export function statusOf(m: Milestone): { status: MilestoneStatus; deltaDays: number } {
  const first = m.entries[0];
  const last = latestEntry(m);
  if (!first || !last) return { status: "unknown", deltaDays: 0 };
  if (last.percentComplete !== null && last.percentComplete >= 100) {
    return { status: "done", deltaDays: 0 };
  }
  if (!first.date || !last.date) return { status: "unknown", deltaDays: 0 };
  const deltaDays = Math.round(
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000
  );
  if (deltaDays > 0) return { status: "slipped", deltaDays };
  if (deltaDays < 0) return { status: "pulled-in", deltaDays };
  return { status: "on-track", deltaDays: 0 };
}
