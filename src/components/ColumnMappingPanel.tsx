import { FIELD_ROLES } from "../types";
import type { ColumnMapping, FieldRole, Snapshot } from "../types";
import { headerSignature } from "../lib/columnMapping";

interface Props {
  mappings: Record<string, ColumnMapping>;
  snapshots: Snapshot[];
  onUpdateMapping: (mapping: ColumnMapping) => void;
  onClose: () => void;
}

export function ColumnMappingPanel({ mappings, snapshots, onUpdateMapping, onClose }: Props) {
  const signatures = Object.keys(mappings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Column mapping</h2>
            <p className="text-xs text-slate">
              Which spreadsheet column means what &mdash; including which Flag field marks a
              milestone. Changes apply immediately, no re-upload needed.
            </p>
          </div>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {signatures.length === 0 ? (
            <p className="text-sm text-slate">No files uploaded yet.</p>
          ) : (
            signatures.map((sig) => {
              const mapping = mappings[sig];
              const fileNames = snapshots
                .filter((s) => headerSignature(s.headers) === sig)
                .map((s) => s.fileName);
              return (
                <MappingCard
                  key={sig}
                  mapping={mapping}
                  fileNames={fileNames}
                  onChange={onUpdateMapping}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MappingCard({
  mapping,
  fileNames,
  onChange,
}: {
  mapping: ColumnMapping;
  fileNames: string[];
  onChange: (m: ColumnMapping) => void;
}) {
  const flagColumns = mapping.headers.filter((h) => /^flag\s*\d+$/i.test(h.trim()));

  const setRole = (role: FieldRole, value: string) => {
    const roles = { ...mapping.roles, [role]: value || undefined };
    const extraFields = mapping.headers.filter((h) => !Object.values(roles).includes(h));
    onChange({ ...mapping, roles, extraFields });
  };

  return (
    <div className="rounded-lg border border-line p-4">
      <p className="mb-3 truncate text-xs font-medium uppercase tracking-wide text-slate" title={fileNames.join(", ")}>
        {fileNames.length ? fileNames.join(", ") : "Unused mapping"}
      </p>
      <div className="space-y-3">
        {FIELD_ROLES.map(({ role, label, required, hint }) => (
          <div key={role}>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate">
                {label}
                {required && <span className="text-late"> *</span>}
              </span>
              <select
                value={mapping.roles[role] ?? ""}
                onChange={(e) => setRole(role, e.target.value)}
                className="rounded-md border border-line px-2 py-1"
              >
                <option value="">&mdash; not in file &mdash;</option>
                {mapping.headers.map((h) => (
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
                pick whichever one your team uses to mark milestones.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
