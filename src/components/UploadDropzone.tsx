import { useCallback, useRef, useState } from "react";
import clsx from "clsx";

interface Props {
  onFiles: (files: FileList | File[]) => void;
  compact?: boolean;
}

export function UploadDropzone({ onFiles, compact }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-colors",
        dragOver ? "border-accent bg-blue-50" : "border-line bg-white hover:bg-gray-50",
        compact ? "p-4" : "p-14"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className={clsx("rounded-full bg-blue-50 text-accent", compact ? "p-2" : "p-4")}>
        <svg xmlns="http://www.w3.org/2000/svg" width={compact ? 20 : 32} height={compact ? 20 : 32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <>
          <p className="text-base font-medium text-ink">
            Drop your MS Project Excel export{"s"} here
          </p>
          <p className="text-sm text-slate">
            or click to choose file(s) &mdash; .xlsx, .xls, or .csv
          </p>
        </>
      )}
      {compact && <p className="text-sm font-medium text-ink">Add another snapshot</p>}
    </div>
  );
}
