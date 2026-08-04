import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearAllData,
  deleteOverride,
  deleteSnapshot,
  loadMapping,
  loadOverrides,
  loadSettings,
  loadSnapshots,
  saveMapping,
  saveOverride,
  saveSettings,
  saveSnapshot,
} from "./db";
import { parseExcelFile } from "./excel";
import { guessMapping, headerSignature } from "./columnMapping";
import { buildMilestones, latestEntry } from "./milestones";
import type { AppSettings, ColumnMapping, DisplayOptions, Snapshot } from "../types";

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showName: true,
  showDate: true,
  showPercentComplete: false,
  // Rows with no mapped flag column default to isMilestone=true (see milestones.ts),
  // so leaving this on is a no-op until the user maps a flag column, at which point
  // it immediately does the filtering they want instead of showing every task.
  milestonesOnly: true,
  visibleExtraFields: [],
};

export interface PendingUpload {
  fileName: string;
  headers: string[];
  rows: import("../types").RawRow[];
  suggestedDate: string;
  mapping: ColumnMapping;
  isKnownMapping: boolean;
}

export function useAppData() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [mappings, setMappings] = useState<Record<string, ColumnMapping>>({});
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(DEFAULT_DISPLAY_OPTIONS);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [snaps, settings, savedOverrides] = await Promise.all([
        loadSnapshots(),
        loadSettings(),
        loadOverrides(),
      ]);
      setSnapshots(snaps);
      if (settings) setDisplayOptions(settings.displayOptions);
      setOverrides(Object.fromEntries(savedOverrides.map((o) => [o.uid, o.visible])));

      const uniqueSignatures = new Set(
        snaps.map((s) => headerSignature(s.headers))
      );
      const entries = await Promise.all(
        [...uniqueSignatures].map(async (sig) => [sig, await loadMapping(sig)] as const)
      );
      const map: Record<string, ColumnMapping> = {};
      for (const [sig, mapping] of entries) if (mapping) map[sig] = mapping;
      setMappings(map);
      setLoaded(true);
    })();
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    const queued: PendingUpload[] = [];
    for (const file of fileArray) {
      try {
        const { headers, rows } = await parseExcelFile(file);
        const sig = headerSignature(headers);
        const known = mappings[sig];
        const mapping = known ?? guessMapping(headers);
        queued.push({
          fileName: file.name,
          headers,
          rows,
          suggestedDate: guessDateFromFileName(file.name),
          mapping,
          isKnownMapping: Boolean(known),
        });
      } catch (e) {
        setError(`Couldn't read "${file.name}": ${(e as Error).message}`);
      }
    }
    setPendingUploads((prev) => [...prev, ...queued]);
  }, [mappings]);

  const confirmUpload = useCallback(
    async (pending: PendingUpload, date: string, mapping: ColumnMapping) => {
      const snapshot: Snapshot = {
        id: crypto.randomUUID(),
        fileName: pending.fileName,
        date,
        createdAt: Date.now(),
        headers: pending.headers,
        rows: pending.rows,
      };
      await saveSnapshot(snapshot);
      await saveMapping(mapping);
      setSnapshots((prev) => [...prev, snapshot].sort((a, b) => a.date.localeCompare(b.date)));
      setMappings((prev) => ({ ...prev, [mapping.signature]: mapping }));
      setPendingUploads((prev) => prev.filter((p) => p !== pending));
    },
    []
  );

  const cancelUpload = useCallback((pending: PendingUpload) => {
    setPendingUploads((prev) => prev.filter((p) => p !== pending));
  }, []);

  const removeSnapshot = useCallback(async (id: string) => {
    await deleteSnapshot(id);
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateDisplayOptions = useCallback((updater: (prev: DisplayOptions) => DisplayOptions) => {
    setDisplayOptions((prev) => {
      const next = updater(prev);
      const settings: AppSettings = { displayOptions: next };
      void saveSettings(settings);
      return next;
    });
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllData();
    setSnapshots([]);
    setMappings({});
    setDisplayOptions(DEFAULT_DISPLAY_OPTIONS);
    setOverrides({});
    setPendingUploads([]);
  }, []);

  /** Pin a milestone's visibility, overriding whatever its spreadsheet flag says. Pass undefined to un-pin. */
  const setOverride = useCallback((uid: string, visible: boolean | undefined) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (visible === undefined) delete next[uid];
      else next[uid] = visible;
      return next;
    });
    if (visible === undefined) void deleteOverride(uid);
    else void saveOverride({ uid, visible });
  }, []);

  const milestones = useMemo(() => buildMilestones(snapshots, mappings), [snapshots, mappings]);

  const allExtraFields = useMemo(() => {
    const set = new Set<string>();
    Object.values(mappings).forEach((m) => m.extraFields.forEach((f) => set.add(f)));
    return [...set];
  }, [mappings]);

  /** One row per unique UID for the "Manage milestones" picker, using each milestone's most recent snapshot. */
  const milestoneSummaries = useMemo(
    () =>
      milestones
        .map((m) => {
          const latest = latestEntry(m);
          return {
            uid: m.uid,
            name: latest?.name || "(untitled)",
            date: latest?.date ?? null,
            flagged: latest?.isMilestone ?? true,
            override: overrides[m.uid],
          };
        })
        .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999")),
    [milestones, overrides]
  );

  return {
    loaded,
    snapshots,
    mappings,
    milestones,
    milestoneSummaries,
    allExtraFields,
    displayOptions,
    updateDisplayOptions,
    overrides,
    setOverride,
    pendingUploads,
    addFiles,
    confirmUpload,
    cancelUpload,
    removeSnapshot,
    clearAll,
    error,
    setError,
  };
}

function guessDateFromFileName(fileName: string): string {
  const match = fileName.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}
