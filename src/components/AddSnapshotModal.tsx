import { useState } from "react";
import { FIELD_ROLES } from "../types";
import type { ColumnMapping, FieldRole } from "../types";
import { headerSignature, isMappingComplete } from "../lib/columnMapping";
import type { PendingUpload } from "../lib/useAppData";

interface Props {
  pending: PendingUpload;
  onConfirm: (date: string, mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export function AddSnapshotModal({ pending, onConfirm, onCancel }: Props) {
  const [date, setDate] = useState(pending.suggestedDate);
  const [roles, setRoles] = useState<Partial<Record<FieldRole, string>>>(pending.mapping.roles);
  const [showMapping, setShowMapping] = useState(!pending.isKnownMapping);

  const mapping: ColumnMapping = {
    signature: headerSignature(pending.headers),
    headers: pending.headers,
    roles,
    extraFields: pending.headers.filter((h) => !Object.values(roles).includes(h)),
  };
  const complete = isMappingComplete(mapping);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink">Add snapshot: {pending.fileName}</h2>
        <p className="mt-1 text-sm text-slate">
          {pending.rows.length} row{pending.rows.length === 1 ? "" : "s"} found.
        </p>

        <label className="mt-4 block text-sm font-medium text-ink">
          Snapshot date (when this export was taken)
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </label>

        {pending.isKnownMapping && !showMapping ? (
          <button
            onClick={() => setShowMapping(true)}
            className="mt-4 text-sm text-accent underline"
          >
            This file looks like a format you've used before &mdash; edit column mapping
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-ink">
              Match your spreadsheet's columns to what the tracker needs:
            </p>
            {FIELD_ROLES.map(({ role, label, required, hint }) => (
              <div key={role}>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate">
                    {label}
                    {required && <span className="text-late"> *</span>}
                  </span>
                  <select
                    value={roles[role] ?? ""}
                    onChange={(e) =>
                      setRoles((prev) => ({ ...prev, [role]: e.target.value || undefined }))
                    }
                    className="rounded-md border border-line px-2 py-1"
                  >
                    <option value="">&mdash; not in file &mdash;</option>
                    {pending.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
                {hint && <p className="mt-0.5 text-xs text-slate">{hint}</p>}
              </div>
            ))}
            <p className="text-xs text-slate">
              Remaining columns ({mapping.extraFields.join(", ") || "none"}) will be kept as
              optional extra fields you can choose to display.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-line px-4 py-2 text-sm text-slate hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={!complete || !date}
            onClick={() => onConfirm(date, mapping)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Add snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
