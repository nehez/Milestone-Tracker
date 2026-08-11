import { formatDate } from "../lib/dateScale";
import type { NewCandidate, RemovalCandidate } from "../lib/milestones";

interface Props {
  newCandidates: NewCandidate[];
  removalCandidates: RemovalCandidate[];
  onAddCandidate: (uid: string) => void;
  onIgnoreCandidate: (uid: string) => void;
  onRemove: (uid: string) => void;
  onKeepTracking: (uid: string, reason: "missing" | "flagged-no") => void;
  onFreeze: (uid: string) => void;
  onClose: () => void;
}

export function ReviewChangesPanel({
  newCandidates,
  removalCandidates,
  onAddCandidate,
  onIgnoreCandidate,
  onRemove,
  onKeepTracking,
  onFreeze,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Review changes</h2>
            <p className="text-xs text-slate">
              Nothing here changes your tracked list until you pick an action below.
            </p>
          </div>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {newCandidates.length === 0 && removalCandidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate">Nothing to review.</p>
          ) : (
            <div className="space-y-6">
              {newCandidates.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">
                    New milestones found ({newCandidates.length})
                  </p>
                  <div className="space-y-2">
                    {newCandidates.map((c) => (
                      <div
                        key={c.uid}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-ink">{c.name}</div>
                          <div className="text-xs text-slate">
                            {formatDate(c.date)} &middot; flagged in {c.sourceFileName}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 gap-1.5">
                          <button
                            onClick={() => onAddCandidate(c.uid)}
                            className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            Add to master
                          </button>
                          <button
                            onClick={() => onIgnoreCandidate(c.uid)}
                            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-slate hover:bg-gray-50"
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {removalCandidates.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">
                    No longer flagged ({removalCandidates.length})
                  </p>
                  <div className="space-y-2">
                    {removalCandidates.map((c) => (
                      <div
                        key={c.uid}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        <div className="truncate text-ink">{c.name}</div>
                        <div className="mb-2 text-xs text-slate">
                          {formatDate(c.lastDate)} &middot;{" "}
                          {c.reason === "missing"
                            ? `no longer in ${c.sourceFileName}`
                            : `flagged No in ${c.sourceFileName}`}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => onFreeze(c.uid)}
                            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-slate hover:bg-gray-50"
                            title="Keep showing it at its last known state, but stop pulling further updates"
                          >
                            Freeze at last known
                          </button>
                          <button
                            onClick={() => onKeepTracking(c.uid, c.reason)}
                            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-slate hover:bg-gray-50"
                          >
                            Keep tracking
                          </button>
                          <button
                            onClick={() => onRemove(c.uid)}
                            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-late hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
