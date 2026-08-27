import { useRef, useState } from "react";

interface Props {
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onClose: () => void;
}

export function BackupPanel({ onExport, onImport, onClose }: Props) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImporting(true);
    setImportError(null);
    setImportSuccess(false);
    try {
      await onImport(file);
      setImportSuccess(true);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">Backup &amp; restore</h2>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate">
          Move your tracked data to another computer without any server in between: this page is
          already the same one at the same link everywhere — a backup file is just how its data
          travels between browsers. Nothing is uploaded anywhere by this button.
        </p>

        <div className="mt-5 rounded-lg border border-line p-4">
          <p className="text-sm font-medium text-ink">Download a backup</p>
          <p className="mt-0.5 text-xs text-slate">
            Every snapshot, column mapping, master list, and setting on this device, as one file.
          </p>
          <button
            onClick={() => void onExport()}
            className="mt-3 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Download backup file
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-line p-4">
          <p className="text-sm font-medium text-ink">Restore from a backup</p>
          <p className="mt-0.5 text-xs text-slate">
            Open this same page on the other device, then pick the file you downloaded. Merges
            into whatever's already here &mdash; it won't erase existing data.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="mt-3 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-50"
          >
            {importing ? "Restoring…" : "Choose backup file…"}
          </button>
          {importError && <p className="mt-2 text-xs text-late">{importError}</p>}
          {importSuccess && <p className="mt-2 text-xs text-good">Restored successfully.</p>}
        </div>
      </div>
    </div>
  );
}
