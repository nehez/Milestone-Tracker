import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearAllData,
  clearFolderHandle,
  deleteOverride,
  deleteSnapshot,
  loadFolderHandle,
  loadMapping,
  loadOverrides,
  loadSettings,
  loadSnapshots,
  saveFolderHandle,
  saveMapping,
  saveOverride,
  saveSettings,
  saveSnapshot,
} from "./db";
import { parseExcelFile } from "./excel";
import { headerSignature } from "./columnMapping";
import { buildMilestones, latestEntry } from "./milestones";
import { isFolderPickerSupported, scanFolderForFiles } from "./folderScan";
import { DEFAULT_LANE_BAND_COLORS } from "../types";
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
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [watchedFolder, setWatchedFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderPermission, setFolderPermission] = useState<PermissionState | null>(null);
  const [folderScanning, setFolderScanning] = useState(false);

  useEffect(() => {
    (async () => {
      const [snaps, settings, savedOverrides] = await Promise.all([
        loadSnapshots(),
        loadSettings(),
        loadOverrides(),
      ]);
      setSnapshots(snaps);
      // Merge over defaults so settings saved before a new option existed still load.
      if (settings) setDisplayOptions({ ...DEFAULT_DISPLAY_OPTIONS, ...settings.displayOptions });
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

  const hasSwimlanes = useMemo(
    () => Object.values(mappings).some((m) => Boolean(m.roles.group)),
    [mappings]
  );

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
    hasSwimlanes,
    displayOptions,
    updateDisplayOptions,
    overrides,
    setOverride,
    pendingUploads,
    addFiles,
    confirmUpload,
    cancelUpload,
    updateMapping,
    removeSnapshot,
    clearAll,
    error,
    setError,
    isFolderPickerSupported: isFolderPickerSupported(),
    watchedFolder,
    folderPermission,
    folderScanning,
    connectFolder,
    rescanFolder,
    disconnectFolder,
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
