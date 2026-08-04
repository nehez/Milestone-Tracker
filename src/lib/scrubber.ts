import type { Milestone, MilestoneEntry, Snapshot } from "../types";

/**
 * Finds how a milestone looked as of a given snapshot: its entry from that exact
 * snapshot if present, otherwise the most recent earlier snapshot's entry.
 * Returns undefined if the milestone doesn't exist yet at that point in time.
 */
export function entryForSnapshot(
  milestone: Milestone,
  snapshots: Snapshot[],
  activeSnapshotIndex: number
): MilestoneEntry | undefined {
  const activeSnapshot = snapshots[activeSnapshotIndex];
  if (!activeSnapshot) return undefined;

  const exact = milestone.entries.find((e) => e.snapshotId === activeSnapshot.id);
  if (exact) return exact;

  let best: MilestoneEntry | undefined;
  for (const entry of milestone.entries) {
    if (entry.snapshotDate <= activeSnapshot.date) {
      if (!best || entry.snapshotDate > best.snapshotDate) best = entry;
    }
  }
  return best;
}
