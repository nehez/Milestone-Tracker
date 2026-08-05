import { useState } from "react";

interface Props {
  supported: boolean;
  watchedFolder: FileSystemDirectoryHandle | null;
  folderPermission: PermissionState | null;
  scanning: boolean;
  onConnect: () => void;
  onRescan: () => Promise<number>;
  onDisconnect: () => void;
  compact?: boolean;
}

/** Lets the app read straight from a local folder (e.g. a SharePoint/OneDrive folder that's
 *  synced to disk) instead of picking files by hand each time. Chrome/Edge only — the File
 *  System Access API this needs isn't implemented in Firefox or Safari. */
export function FolderConnect({
  supported,
  watchedFolder,
  folderPermission,
  scanning,
  onConnect,
  onRescan,
  onDisconnect,
  compact,
}: Props) {
  const [lastResult, setLastResult] = useState<string | null>(null);

  if (!supported) return null;

  if (!watchedFolder) {
    return (
      <button onClick={onConnect} className="text-sm text-accent underline">
        {compact ? "Connect a local folder" : "Or connect a local folder to watch for new snapshots"}
      </button>
    );
  }

  const needsPermission = folderPermission !== "granted";

  const handleRescan = async () => {
    const count = await onRescan();
    setLastResult(count === 0 ? "No new files found" : `Found ${count} new file${count === 1 ? "" : "s"}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-md border border-line bg-white px-2.5 py-1.5 text-ink" title={watchedFolder.name}>
        📁 {watchedFolder.name}
      </span>
      <button
        onClick={handleRescan}
        disabled={scanning}
        className="rounded-md border border-line bg-white px-2.5 py-1.5 text-slate hover:bg-gray-50 disabled:opacity-50"
      >
        {scanning ? "Scanning…" : needsPermission ? "Reconnect" : "Rescan for new files"}
      </button>
      <button onClick={onDisconnect} className="text-xs text-slate underline hover:text-late">
        Disconnect
      </button>
      {lastResult && !scanning && <span className="text-xs text-slate">{lastResult}</span>}
    </div>
  );
}
