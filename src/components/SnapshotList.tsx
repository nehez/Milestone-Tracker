import { formatDate } from "../lib/dateScale";
import type { Snapshot } from "../types";

interface Props {
  snapshots: Snapshot[];
  onRemove: (id: string) => void;
  onUseAsMaster: (id: string) => void;
}

export function SnapshotList({ snapshots, onRemove, onUseAsMaster }: Props) {
  if (snapshots.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {snapshots.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs text-slate"
        >
          {formatDate(s.date)}
          <span className="text-slate/70">&middot; {s.fileName}</span>
          <button
            onClick={() => {
              if (
                confirm(
                  `Use "${s.fileName}" as the master list? Every item it flags as a milestone becomes permanently tracked, regardless of what later files say about it.`
                )
              ) {
                onUseAsMaster(s.id);
              }
            }}
            className="text-slate/70 underline hover:text-accent"
            title={`Use ${s.fileName} as the master list`}
          >
            use as master
          </button>
          <button
            onClick={() => onRemove(s.id)}
            className="text-slate hover:text-late"
            title={`Remove ${s.fileName}`}
            aria-label={`Remove ${s.fileName}`}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
