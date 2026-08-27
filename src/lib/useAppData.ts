import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearAllData,
  clearFolderHandle,
  deleteOverride,
  deleteSnapshot,
  exportAllData,
  importAllData,
  loadFolderHandle,
  loadMapping,
  loadOverrides,
  loadReviewFlags,
  loadSettings,
  loadSnapshots,
  saveFolderHandle,
  saveMapping,
  saveOverride,
  saveReviewFlag,
  saveSettings,
  saveSnapshot,
  type ExportedData,
} from "./db";
import { parseExcelFile } from "./excel";
import { headerSignature } from "./columnMapping";
import { applyFreeze, buildMilestones, findNewCandidates, findRemovalCandidates, latestEntry } from "./milestones";
import { isFolderPickerSupported, scanFolderForFiles } from "./folderScan";
import { DEFAULT_LANE_BAND_COLORS } from "../types";
import type { AppSettings, ColumnMapping, DisplayOptions, MilestoneOverride, ReviewFlag, Snapshot } from "../types";

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showName: true,
  showDate: true,
  showPercentComplete: false,
  // Rows with no mapped flag column default to isMilestone=true (see milestones.ts),
  // so leaving this on is a no-op until the user maps a flag column, at which point
  // it immediately does the filtering they want instead of showing every task.
  milestonesOnly: true,
  visibleExtraFields: [],
  laneBands: true,
  laneBandColors: DEFAULT_LANE_BAND_COLORS,
  layout: "auto",
  showMovement: true,
};

export interface PendingUpload {
  fileName: string;
  headers: string[];
  rows: import("../types").RawRow[];
  suggestedDate: string;
}

export function useAppData() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [mappings, setMappings] = useState<Record<string, ColumnMapping>>({});
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(DEFAULT_DISPLAY_OPTIONS);
  const [overrides, setOverrides] = useState<Record<string, MilestoneOverride>>({});
  const [reviewFlags, setReviewFlags] = useState<Record<string, ReviewFlag>>({});
  const [loaded, setLoaded] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [watchedFolder, setWatchedFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderPermission, setFolderPermission] = useState<PermissionState | null>(null);
  const [folderScanning, setFolderScanning] = useState(false);

  // Pulls current IndexedDB state into React state — used on mount, and again after an
  // import merges new data in, so the app reflects it without a page reload.
  const loadAllFromDb = useCallback(async () => {
    const [snaps, settings, savedOverrides, savedReviewFlags] = await Promise.all([
      loadSnapshots(),
      loadSettings(),
      loadOverrides(),
      loadReviewFlags(),
    ]);
    setSnapshots(snaps);
    // Merge over defaults so settings saved before a new option existed still load.
    if (settings) setDisplayOptions({ ...DEFAULT_DISPLAY_OPTIONS, ...settings.displayOptions });
    setOverrides(Object.fromEntries(savedOverrides.map((o) => [o.uid, o])));
    setReviewFlags(Object.fromEntries(savedReviewFlags.map((f) => [f.uid, f])));

    const uniqueSignatures = new Set(snaps.map((s) => headerSignature(s.headers)));
    const entries = await Promise.all(
      [...uniqueSignatures].map(async (sig) => [sig, await loadMapping(sig)] as const)
    );
    const map: Record<string, ColumnMapping> = {};
    for (const [sig, mapping] of entries) if (mapping) map[sig] = mapping;
    setMappings(map);
  }, []);

  useEffect(() => {
    void loadAllFromDb().then(() => setLoaded(true));

    // A directory handle survives IndexedDB across reloads, but the browser always
    // re-checks permission on each page load rather than remembering "granted" — so
    // this can come back "prompt", requiring a click (via rescanFolder) to reconnect.
    (async () => {
      if (!isFolderPickerSupported()) return;
      const handle = await loadFolderHandle();
      if (!handle) return;
      setWatchedFolder(handle);
      setFolderPermission(await handle.queryPermission({ mode: "read" }));
    })();
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    const queued: PendingUpload[] = [];
    for (const file of fileArray) {
      try {
        const { headers, rows } = await parseExcelFile(file);
        queued.push({
          fileName: file.name,
          headers,
          rows,
          suggestedDate: guessDateFromFileName(file.name),
        });
      } catch (e) {
        setError(`Couldn't read "${file.name}": ${(e as Error).message}`);
      }
    }
    // Column mapping is resolved per-modal at render time (see App.tsx), not here —
    // selecting several files in one picker action queues them all before any of
    // this batch has been confirmed, so a mapping learned from the first file in
    // the batch wouldn't yet be visible to a snapshot taken here for the second.
    setPendingUploads((prev) => [...prev, ...queued]);
  }, []);

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

  /** Re-maps an already-uploaded file shape (e.g. switching which Flag column means "milestone")
   *  without re-uploading — every snapshot sharing that header signature picks it up immediately. */
  const updateMapping = useCallback(async (mapping: ColumnMapping) => {
    await saveMapping(mapping);
    setMappings((prev) => ({ ...prev, [mapping.signature]: mapping }));
  }, []);

  // Scans a connected folder and queues only files this app hasn't already ingested
  // (by file name) — so reconnecting or re-scanning a folder that's still accumulating
  // new dated exports doesn't re-prompt for ones already added as snapshots.
  const scanAndQueue = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      setFolderScanning(true);
      try {
        const files = await scanFolderForFiles(handle);
        const known = new Set([...snapshots.map((s) => s.fileName), ...pendingUploads.map((p) => p.fileName)]);
        const fresh = files.filter((f) => !known.has(f.name));
        if (fresh.length) await addFiles(fresh);
        return fresh.length;
      } finally {
        setFolderScanning(false);
      }
    },
    [snapshots, pendingUploads, addFiles]
  );

  const connectFolder = useCallback(async () => {
    if (!isFolderPickerSupported()) return;
    setError(null);
    try {
      const handle = await window.showDirectoryPicker({ id: "milestone-tracker-folder", mode: "read" });
      setWatchedFolder(handle);
      setFolderPermission("granted");
      // Persisting the handle is a nice-to-have (lets a later reload reconnect
      // without re-picking) — if IndexedDB can't store it for some reason, the
      // folder should still work for the rest of this session.
      try {
        await saveFolderHandle(handle);
      } catch {
        /* non-fatal */
      }
      await scanAndQueue(handle);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(`Couldn't open that folder: ${(e as Error).message}`);
      }
    }
  }, [scanAndQueue]);

  const rescanFolder = useCallback(async () => {
    if (!watchedFolder) return 0;
    // requestPermission only works from a real user gesture (a click), which is
    // exactly the context this is always called from — never on a timer.
    let permission = await watchedFolder.queryPermission({ mode: "read" });
    if (permission !== "granted") permission = await watchedFolder.requestPermission({ mode: "read" });
    setFolderPermission(permission);
    if (permission !== "granted") return 0;
    return scanAndQueue(watchedFolder);
  }, [watchedFolder, scanAndQueue]);

  const disconnectFolder = useCallback(async () => {
    await clearFolderHandle();
    setWatchedFolder(null);
    setFolderPermission(null);
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
    setReviewFlags({});
    setPendingUploads([]);
  }, []);

  /** Downloads everything as one JSON file — the portability mechanism for moving
   *  tracked data to another device without any server in between: the same page is
   *  already reachable from anywhere, this file is just how its data travels. */
  const exportData = useCallback(async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milestone-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /** Merges a backup file into whatever's already on this device. Throws on a malformed
   *  file so the caller (BackupPanel) can show the error inline rather than it vanishing
   *  into the general error banner behind the modal. */
  const importData = useCallback(
    async (file: File) => {
      const text = await file.text();
      let data: ExportedData;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      if (!data || typeof data !== "object" || !Array.isArray(data.snapshots)) {
        throw new Error("That doesn't look like a Milestone Tracker backup file.");
      }
      await importAllData(data);
      await loadAllFromDb();
    },
    [loadAllFromDb]
  );

  const milestonesRaw = useMemo(() => buildMilestones(snapshots, mappings), [snapshots, mappings]);

  /** Pin a milestone's visibility, overriding whatever its spreadsheet flag says. Pass
   *  undefined to un-pin. A fresh visibility choice always clears any freeze — if you're
   *  manually re-deciding an item, stale "frozen at an old snapshot" state shouldn't linger. */
  const setOverride = useCallback((uid: string, visible: boolean | undefined) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (visible === undefined) delete next[uid];
      else next[uid] = { uid, visible };
      return next;
    });
    if (visible === undefined) void deleteOverride(uid);
    else void saveOverride({ uid, visible });
  }, []);

  /** Stops pulling further updates for a tracked milestone, keeping it visible at its
   *  last known state — for e.g. a completed item whose flag later flips to "No". */
  const freezeMilestone = useCallback(
    (uid: string) => {
      const m = milestonesRaw.find((x) => x.uid === uid);
      const last = m?.entries[m.entries.length - 1];
      if (!last) return;
      setOverrides((prev) => {
        const override: MilestoneOverride = { uid, visible: true, frozenAtSnapshotId: last.snapshotId };
        void saveOverride(override);
        return { ...prev, [uid]: override };
      });
    },
    [milestonesRaw]
  );

  const unfreezeMilestone = useCallback((uid: string) => {
    setOverrides((prev) => {
      const existing = prev[uid];
      if (!existing) return prev;
      const override: MilestoneOverride = { uid, visible: existing.visible };
      void saveOverride(override);
      return { ...prev, [uid]: override };
    });
  }, []);

  /** Bulk-seeds "always tracked" overrides from everything a chosen snapshot flags as a
   *  milestone — the "use this file as master" shortcut so archived files with reliable
   *  flags don't need to be curated one row at a time in Manage milestones. */
  const useSnapshotAsMaster = useCallback(
    (snapshotId: string) => {
      for (const m of milestonesRaw) {
        const entry = m.entries.find((e) => e.snapshotId === snapshotId);
        if (entry?.isMilestone) setOverride(m.uid, true);
      }
    },
    [milestonesRaw, setOverride]
  );

  const setReviewFlag = useCallback((uid: string, patch: Partial<Omit<ReviewFlag, "uid">>) => {
    setReviewFlags((prev) => {
      const next: ReviewFlag = { ...prev[uid], uid, ...patch };
      void saveReviewFlag(next);
      return { ...prev, [uid]: next };
    });
  }, []);

  /** Review queue actions. */
  const addCandidateToMaster = useCallback((uid: string) => setOverride(uid, true), [setOverride]);
  const ignoreCandidate = useCallback(
    (uid: string) => setReviewFlag(uid, { candidateDismissed: true }),
    [setReviewFlag]
  );
  const removeFromMaster = useCallback((uid: string) => setOverride(uid, false), [setOverride]);
  const keepTrackingItem = useCallback(
    (uid: string, reason: "missing" | "flagged-no") => setReviewFlag(uid, { removalDismissedReason: reason }),
    [setReviewFlag]
  );

  const milestones = useMemo(() => applyFreeze(milestonesRaw, overrides), [milestonesRaw, overrides]);

  const newCandidates = useMemo(
    () => findNewCandidates(milestonesRaw, snapshots, overrides, reviewFlags),
    [milestonesRaw, snapshots, overrides, reviewFlags]
  );
  const removalCandidates = useMemo(
    () => findRemovalCandidates(milestonesRaw, snapshots, overrides, reviewFlags),
    [milestonesRaw, snapshots, overrides, reviewFlags]
  );

  const allExtraFields = useMemo(() => {
    const set = new Set<string>();
    Object.values(mappings).forEach((m) => m.extraFields.forEach((f) => set.add(f)));
    return [...set];
  }, [mappings]);

  const hasSwimlanes = useMemo(
    () => Object.values(mappings).some((m) => Boolean(m.roles.group)),
    [mappings]
  );

  /** One row per unique UID for the browse/track table, using each milestone's most
   *  recent snapshot — carries every column the table can show (group, % complete,
   *  extra fields), not just what a simple checkbox list needed. */
  const milestoneSummaries = useMemo(
    () =>
      milestones
        .map((m) => {
          const latest = latestEntry(m);
          return {
            uid: m.uid,
            name: latest?.name || "(untitled)",
            date: latest?.date ?? null,
            group: latest?.group ?? null,
            percentComplete: latest?.percentComplete ?? null,
            flagged: latest?.isMilestone ?? true,
            override: overrides[m.uid]?.visible,
            frozen: Boolean(overrides[m.uid]?.frozenAtSnapshotId),
            extra: latest?.extra ?? {},
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
    hasSwimlanes,
    displayOptions,
    updateDisplayOptions,
    overrides,
    setOverride,
    unfreezeMilestone,
    pendingUploads,
    addFiles,
    confirmUpload,
    cancelUpload,
    updateMapping,
    removeSnapshot,
    clearAll,
    exportData,
    importData,
    error,
    setError,
    isFolderPickerSupported: isFolderPickerSupported(),
    watchedFolder,
    folderPermission,
    folderScanning,
    connectFolder,
    rescanFolder,
    disconnectFolder,
    useSnapshotAsMaster,
    newCandidates,
    removalCandidates,
    addCandidateToMaster,
    ignoreCandidate,
    removeFromMaster,
    keepTrackingItem,
    freezeMilestone,
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
