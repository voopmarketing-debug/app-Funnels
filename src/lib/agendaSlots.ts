// Pure slot math (no server imports), shared by the public page, the booking and the tests.

export type BusyRange = { start: number; end: number }; // minutes since the day's midnight, in the business's zone

/** Whether [start, end) overlaps any busy range. */
export function overlapsAny(busy: BusyRange[], start: number, end: number): boolean {
  return busy.some((b) => b.start < end && b.end > start);
}

/**
 * Start times (minutes) of a day on the agenda's grid where an appointment of `duration` minutes fits
 * inside the opening hours and does not overlap an existing booking. `notBefore` hides times already past.
 */
export function freeStarts(params: { startMin: number; endMin: number; gridMinutes: number; duration: number; busy: BusyRange[]; notBefore?: number }): number[] {
  const out: number[] = [];
  for (let m = params.startMin; m + params.duration <= params.endMin; m += params.gridMinutes) {
    if (params.notBefore !== undefined && m <= params.notBefore) continue;
    if (overlapsAny(params.busy, m, m + params.duration)) continue;
    out.push(m);
  }
  return out;
}
