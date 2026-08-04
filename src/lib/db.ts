import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AppSettings, ColumnMapping, Snapshot } from "../types";

interface MilestoneTrackerDB extends DBSchema {
  snapshots: { key: string; value: Snapshot };
  mappings: { key: string; value: ColumnMapping };
  settings: { key: string; value: AppSettings };
}

const DB_NAME = "milestone-tracker";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MilestoneTrackerDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MilestoneTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("snapshots", { keyPath: "id" });
        db.createObjectStore("mappings", { keyPath: "signature" });
        db.createObjectStore("settings");
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

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear("snapshots"),
    db.clear("mappings"),
    db.clear("settings"),
  ]);
}
