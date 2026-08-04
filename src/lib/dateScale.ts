const MS_PER_DAY = 86_400_000;

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function clampZoom(px: number): number {
  return Math.min(200, Math.max(2, px));
}

export function formatDate(iso: string | null, includeYear = true): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  });
}

export function monthTicks(startIso: string, endIso: string): string[] {
  const ticks: string[] = [];
  const d = new Date(startIso + "T00:00:00");
  d.setDate(1);
  const end = new Date(endIso + "T00:00:00");
  while (d <= end) {
    ticks.push(d.toISOString().slice(0, 10));
    d.setMonth(d.getMonth() + 1);
  }
  return ticks;
}
