import { useEffect, useState } from "react";
import { formatDate } from "../lib/dateScale";
import type { Snapshot } from "../types";

interface Props {
  snapshots: Snapshot[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function Scrubber({ snapshots, activeIndex, onChange }: Props) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      onChange(activeIndex + 1 >= snapshots.length ? 0 : activeIndex + 1);
    }, 1200);
    return () => window.clearInterval(id);
  }, [playing, activeIndex, snapshots.length, onChange]);

  if (snapshots.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
      <button
        onClick={() => setPlaying((p) => !p)}
        disabled={snapshots.length < 2}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-30"
        title={playing ? "Pause" : "Play through snapshots"}
        aria-label={playing ? "Pause" : "Play through snapshots"}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="1" y="1" width="3.5" height="10" />
            <rect x="7" y="1" width="3.5" height="10" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 1 L11 6 L1 11 Z" />
          </svg>
        )}
      </button>

      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={Math.max(0, snapshots.length - 1)}
          step={1}
          value={activeIndex}
          onChange={(e) => {
            setPlaying(false);
            onChange(Number(e.target.value));
          }}
          className="w-full accent-accent"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate">
          {snapshots.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setPlaying(false);
                onChange(i);
              }}
              className={i === activeIndex ? "font-semibold text-accent" : ""}
            >
              {formatDate(s.date)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
