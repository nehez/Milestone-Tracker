import { useEffect, useState } from "react";
import { FIELD_ROLES } from "../types";
import type { ColumnMapping, FieldRole } from "../types";
import { guessMapping, headerSignature, isMappingComplete } from "../lib/columnMapping";
import type { PendingUpload } from "../lib/useAppData";

interface Props {
  pending: PendingUpload;
  /**
   * A mapping already confirmed for this header shape, if any — checked fresh at
   * render time (not captured when the file was queued), so if you upload several
   * files with identical columns in one go, confirming the first one's mapping
   * immediately collapses the rest to the "looks familiar" shortcut too.
   */
  knownMapping: ColumnMapping | undefined;
  onConfirm: (date: string, mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export function AddSnapshotModal({ pending, knownMapping, onConfirm, onCancel }: Props) {
  const [date, setDate] = useState(pending.suggestedDate);
  const [roles, setRoles] = useState<Partial<Record<FieldRole, string>>>(
    () => (knownMapping ?? guessMapping(pending.headers)).roles
  );
  const [showMapping, setShowMapping] = useState(!knownMapping);
  // Multi-select uploads mount every modal in the batch before any of them has
  // been confirmed, so this one's `knownMapping` can go from undefined to defined
  // later (once a sibling with the same columns is confirmed) without a remount —
  // React matches these by key, so the useState initializers above only ran once.
  // Adopt it then, unless the person has already started reviewing this modal.
  const [userTookControl, setUserTookControl] = useState(false);
  useEffect(() => {
    if (knownMapping && !userTookControl) {
      setRoles(knownMapping.roles);
      setShowMapping(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownMapping]);

  const mapping: ColumnMapping = {
    signature: headerSignature(pending.headers),
    headers: pending.headers,
    roles,
    extraFields: pending.headers.filter((h) => !Object.values(roles).includes(h)),
  };
  const complete = isMappingComplete(mapping);

  // MS Project's generic custom fields ("Flag1" .. "Flag20") are user-repurposed —
  // e.g. Flag3 might mean "milestone" on one project and "at risk" on another — so
  // we deliberately never guess one automatically. When several are present, call
  // that out rather than leaving the person to guess why nothing got pre-selected.
  const flagColumns = pending.headers.filter((h) => /^flag\s*\d+$/i.test(h.trim()));

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

        {knownMapping && !showMapping ? (
          <button
            onClick={() => {
              setUserTookControl(true);
              setShowMapping(true);
            }}
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
                    onChange={(e) => {
                      setUserTookControl(true);
                      setRoles((prev) => ({ ...prev, [role]: e.target.value || undefined }));
                    }}
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
                {role === "isMilestone" && flagColumns.length > 1 && (
                  <p className="mt-0.5 text-xs text-accent">
                    This file has {flagColumns.length} Flag columns ({flagColumns.join(", ")}) &mdash;
                    MS Project's generic custom fields. Pick whichever one your team uses to mark
                    milestones.
                  </p>
                )}
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
