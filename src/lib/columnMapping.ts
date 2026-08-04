import type { ColumnMapping, FieldRole } from "../types";

/** A stable signature for a header set, used to remember mappings across re-uploads of the same export shape. */
export function headerSignature(headers: string[]): string {
  return [...headers].map((h) => h.trim().toLowerCase()).sort().join("|");
}

const GUESS_PATTERNS: Record<FieldRole, RegExp[]> = {
  uid: [/^uid$/i, /^unique\s*id$/i, /^id$/i],
  name: [/^name$/i, /^task\s*name$/i, /^milestone\s*name$/i, /^title$/i],
  finish: [/^finish$/i, /^end\s*date$/i, /^due\s*date$/i, /^date$/i],
  start: [/^start$/i, /^start\s*date$/i],
  percentComplete: [/^%\s*complete$/i, /^percent\s*complete$/i, /^pct\s*complete$/i, /^% comp/i],
  isMilestone: [/^milestone$/i, /^is\s*milestone$/i],
};

export function guessMapping(headers: string[]): ColumnMapping {
  const roles: Partial<Record<FieldRole, string>> = {};
  const claimed = new Set<string>();

  (Object.keys(GUESS_PATTERNS) as FieldRole[]).forEach((role) => {
    const patterns = GUESS_PATTERNS[role];
    const match = headers.find(
      (h) => !claimed.has(h) && patterns.some((p) => p.test(h.trim()))
    );
    if (match) {
      roles[role] = match;
      claimed.add(match);
    }
  });

  const extraFields = headers.filter((h) => !claimed.has(h));

  return {
    signature: headerSignature(headers),
    headers,
    roles,
    extraFields,
  };
}

export function isMappingComplete(mapping: ColumnMapping): boolean {
  return Boolean(mapping.roles.uid && mapping.roles.name && mapping.roles.finish);
}
