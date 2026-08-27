import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AppSettings, ColumnMapping, MilestoneOverride, ReviewFlag, Snapshot } from "../types";

interface MilestoneTrackerDB extends DBSchema {
  snapshots: { key: string; value: Snapshot };
  mappings: { key: string; value: ColumnMapping };
  settings: { key: string; value: AppSettings };
  overrides: { key: string; value: MilestoneOverride };
  folderHandle: { key: string; value: FileSystemDirectoryHandle };
  reviewFlags: { key: string; value: ReviewFlag };
}

const DB_NAME = "milestone-tracker";
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<MilestoneTrackerDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MilestoneTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("snapshots", { keyPath: "id" });
          db.createObjectStore("mappings", { keyPath: "signature" });
          db.createObjectStore("settings");
        }
        if (oldVersion < 2) {
          db.createObjectStore("overrides", { keyPath: "uid" });
        }
        if (oldVersion < 3) {
          db.createObjectStore("folderHandle");
        }
        if (oldVersion < 4) {
          db.createObjectStore("reviewFlags", { keyPath: "uid" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await getDb();
  await db.put("snapshots", snapshot);
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("snapshots", id);
}

export async function loadSnapshots(): Promise<Snapshot[]> {
  const db = await getDb();
  const all = await db.getAll("snapshots");
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export async function saveMapping(mapping: ColumnMapping): Promise<void> {
  const db = await getDb();
  await db.put("mappings", mapping);
}

export async function loadMapping(signature: string): Promise<ColumnMapping | undefined> {
  const db = await getDb();
  return db.get("mappings", signature);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put("settings", settings, "app-settings");
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const db = await getDb();
  return db.get("settings", "app-settings");
}

export async function saveOverride(override: MilestoneOverride): Promise<void> {
  const db = await getDb();
  await db.put("overrides", override);
}

export async function deleteOverride(uid: string): Promise<void> {
  const db = await getDb();
  await db.delete("overrides", uid);
}

export async function loadOverrides(): Promise<MilestoneOverride[]> {
  const db = await getDb();
  return db.getAll("overrides");
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await getDb();
  await db.put("folderHandle", handle, "watched-folder");
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDb();
  return db.get("folderHandle", "watched-folder");
}

export async function clearFolderHandle(): Promise<void> {
  const db = await getDb();
  await db.delete("folderHandle", "watched-folder");
}

export async function saveReviewFlag(flag: ReviewFlag): Promise<void> {
  const db = await getDb();
  await db.put("reviewFlags", flag);
}

export async function deleteReviewFlag(uid: string): Promise<void> {
  const db = await getDb();
  await db.delete("reviewFlags", uid);
}

export async function loadReviewFlags(): Promise<ReviewFlag[]> {
  const db = await getDb();
  return db.getAll("reviewFlags");
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear("snapshots"),
    db.clear("mappings"),
    db.clear("settings"),
    db.clear("overrides"),
    db.clear("folderHandle"),
    db.clear("reviewFlags"),
  ]);
}

/** Everything portable between devices — the folder handle isn't included since a
 *  directory picker permission can't be serialized or meaningfully reused elsewhere. */
export interface ExportedData {
  version: 1;
  exportedAt: string;
  snapshots: Snapshot[];
  mappings: ColumnMapping[];
  overrides: MilestoneOverride[];
  reviewFlags: ReviewFlag[];
  settings: AppSettings | null;
}

export async function exportAllData(): Promise<ExportedData> {
  const db = await getDb();
  const [snapshots, mappings, overrides, reviewFlags, settings] = await Promise.all([
    db.getAll("snapshots"),
    db.getAll("mappings"),
    db.getAll("overrides"),
    db.getAll("reviewFlags"),
    db.get("settings", "app-settings"),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    snapshots,
    mappings,
    overrides,
    reviewFlags,
    settings: settings ?? null,
  };
}

/** Merges (upserts) into whatever's already on this device rather than replacing it —
 *  importing the same backup twice, or combining backups from two devices, is safe. */
export async function importAllData(data: ExportedData): Promise<void> {
  const db = await getDb();
  await Promise.all([
    ...data.snapshots.map((s) => db.put("snapshots", s)),
    ...data.mappings.map((m) => db.put("mappings", m)),
    ...data.overrides.map((o) => db.put("overrides", o)),
    ...data.reviewFlags.map((f) => db.put("reviewFlags", f)),
    data.settings ? db.put("settings", data.settings, "app-settings") : Promise.resolve(),
  ]);
}
