import { useRef, useState } from "react";
import { useAppData } from "./lib/useAppData";
import { UploadDropzone } from "./components/UploadDropzone";
import { FolderConnect } from "./components/FolderConnect";
import { AddSnapshotModal } from "./components/AddSnapshotModal";
import { SnapshotList } from "./components/SnapshotList";
import { Timeline } from "./components/Timeline";
import { Scrubber } from "./components/Scrubber";
import { DisplayOptionsPanel } from "./components/DisplayOptionsPanel";
import { ManageMilestonesPanel } from "./components/ManageMilestonesPanel";
import { ColumnMappingPanel } from "./components/ColumnMappingPanel";
import { ReviewChangesPanel } from "./components/ReviewChangesPanel";
import { BackupPanel } from "./components/BackupPanel";
import { MilestoneDetailModal } from "./components/MilestoneDetailModal";
import { exportAsImage, exportAsPdf } from "./lib/exportImage";
import { headerSignature } from "./lib/columnMapping";
import { APP_VERSION } from "./version";
import type { Milestone } from "./types";

function App() {
  const data = useAppData();
  const [activeSnapshotIndex, setActiveSnapshotIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const hasData = data.snapshots.length > 0;
  const clampedIndex = Math.min(activeSnapshotIndex, Math.max(0, data.snapshots.length - 1));
  const pendingReviewCount = data.newCandidates.length + data.removalCandidates.length;

  const handleExport = async (kind: "pdf" | "png" | "jpeg") => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      if (kind === "pdf") await exportAsPdf(exportRef.current, "milestone-tracker");
      else await exportAsImage(exportRef.current, "milestone-tracker", kind);
    } finally {
      setExporting(false);
    }
  };

  if (!data.loaded) {
    return <div className="flex h-full items-center justify-center text-slate">Loading…</div>;
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-6 py-4">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-semibold text-ink">Milestone Tracker</h1>
              <span className="text-xs text-slate/70" title="App version">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate">Everything stays in this browser &mdash; nothing is uploaded.</p>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBackup(true)}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-gray-50"
            >
              Backup &amp; restore
            </button>
            {hasData && (
              <>
              {pendingReviewCount > 0 && (
                <button
                  onClick={() => setShowReview(true)}
                  className="rounded-md border border-accent bg-blue-50 px-3 py-2 text-sm font-medium text-accent hover:bg-blue-100"
                >
                  Review changes ({pendingReviewCount})
                </button>
              )}
              <button
                onClick={() => setShowManage(true)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-gray-50"
              >
                Manage milestones
              </button>
              <button
                onClick={() => setShowMapping(true)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-gray-50"
              >
                Column mapping
              </button>
              <button
                onClick={() => setShowOptions((s) => !s)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-gray-50"
              >
                Display options
              </button>
              {showOptions && (
                <DisplayOptionsPanel
                  options={data.displayOptions}
                  allExtraFields={data.allExtraFields}
                  hasSwimlanes={data.hasSwimlanes}
                  onChange={data.updateDisplayOptions}
                  onClose={() => setShowOptions(false)}
                />
              )}
              <button
                disabled={exporting}
                onClick={() => handleExport("png")}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink hover:bg-gray-50 disabled:opacity-50"
              >
                Save PNG
              </button>
              <button
                disabled={exporting}
                onClick={() => handleExport("pdf")}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Save PDF
              </button>
              <button
                onClick={() => {
                  if (confirm("Remove all uploaded files and settings from this browser?")) {
                    void data.clearAll();
                  }
                }}
                className="rounded-md px-3 py-2 text-sm text-slate hover:text-late"
              >
                Clear data
              </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {data.error && (
          <div className="mb-4 rounded-md border border-late/30 bg-red-50 px-4 py-2 text-sm text-late">
            {data.error}
          </div>
        )}

        {!hasData ? (
          <div className="mx-auto max-w-xl py-16">
            <UploadDropzone onFiles={data.addFiles} />
            <p className="mt-4 text-center text-sm text-slate">
              Export your schedule from Microsoft Project to Excel (any columns are fine), then
              drop the file above. Upload more exports later to track how milestones move over
              time.
            </p>
            <div className="mt-3 text-center">
              <FolderConnect
                supported={data.isFolderPickerSupported}
                watchedFolder={data.watchedFolder}
                folderPermission={data.folderPermission}
                scanning={data.folderScanning}
                onConnect={data.connectFolder}
                onRescan={data.rescanFolder}
                onDisconnect={data.disconnectFolder}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div ref={exportRef} className="space-y-6 rounded-xl bg-mist p-2">
              <Timeline
                milestones={data.milestones}
                snapshots={data.snapshots}
                activeSnapshotIndex={clampedIndex}
                displayOptions={data.displayOptions}
                overrides={data.overrides}
                onSelectMilestone={setSelectedMilestone}
              />
            </div>

            <Scrubber
              snapshots={data.snapshots}
              activeIndex={clampedIndex}
              onChange={setActiveSnapshotIndex}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SnapshotList
                snapshots={data.snapshots}
                onRemove={data.removeSnapshot}
                onUseAsMaster={data.useSnapshotAsMaster}
              />
              <div className="flex flex-col items-end gap-2">
                <UploadDropzone onFiles={data.addFiles} compact />
                <FolderConnect
                  supported={data.isFolderPickerSupported}
                  watchedFolder={data.watchedFolder}
                  folderPermission={data.folderPermission}
                  scanning={data.folderScanning}
                  onConnect={data.connectFolder}
                  onRescan={data.rescanFolder}
                  onDisconnect={data.disconnectFolder}
                  compact
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {data.pendingUploads.map((pending) => (
        <AddSnapshotModal
          key={pending.fileName + pending.headers.join(",")}
          pending={pending}
          knownMapping={data.mappings[headerSignature(pending.headers)]}
          onConfirm={(date, mapping) => data.confirmUpload(pending, date, mapping)}
          onCancel={() => data.cancelUpload(pending)}
        />
      ))}

      {showManage && (
        <ManageMilestonesPanel
          summaries={data.milestoneSummaries}
          onSetOverride={data.setOverride}
          onUnfreeze={data.unfreezeMilestone}
          onClose={() => setShowManage(false)}
        />
      )}

      {showReview && (
        <ReviewChangesPanel
          newCandidates={data.newCandidates}
          removalCandidates={data.removalCandidates}
          onAddCandidate={data.addCandidateToMaster}
          onIgnoreCandidate={data.ignoreCandidate}
          onRemove={data.removeFromMaster}
          onKeepTracking={data.keepTrackingItem}
          onFreeze={data.freezeMilestone}
          onClose={() => setShowReview(false)}
        />
      )}

      {showMapping && (
        <ColumnMappingPanel
          mappings={data.mappings}
          snapshots={data.snapshots}
          onUpdateMapping={data.updateMapping}
          onClose={() => setShowMapping(false)}
        />
      )}

      {showBackup && (
        <BackupPanel
          onExport={data.exportData}
          onImport={data.importData}
          onClose={() => setShowBackup(false)}
        />
      )}

      {selectedMilestone && (
        <MilestoneDetailModal
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
        />
      )}
    </div>
  );
}

export default App;
