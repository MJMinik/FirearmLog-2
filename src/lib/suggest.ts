// Type-ahead suggestions (pure, unit-tested). Used by the session form's
// "Where" field; built generically so any text field can reuse it.

/**
 * Distinct past values, most recently used first. `rows` should already be
 * whatever order the caller wants broken ties by; we sort by `date` descending
 * and keep the casing of the most recent use.
 */
export function recentValues(rows: { date: string; value: string }[]): string[] {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of sorted) {
    const v = r.value.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Filter suggestions as the user types: matches that START with what they
 * typed come first (type "S", get the S locations), then matches that merely
 * contain it. Case doesn't matter. An exact match is hidden — nothing to
 * suggest once it's already typed. Capped at `limit`.
 */
export function rankSuggestions(values: string[], query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase();
  if (q === '') return values.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const v of values) {
    const lower = v.toLowerCase();
    if (lower === q) continue;
    if (lower.startsWith(q)) starts.push(v);
    else if (lower.includes(q)) contains.push(v);
  }
  return [...starts, ...contains].slice(0, limit);
}
