// Pure helpers for turning a machine's CUMULATIVE counter (a register that only
// counts up, like a PLC part counter) into per-event DELTAS the cloud expects.
//
// Real machines rarely emit "one part done" events; they expose a running total
// that you poll. The edge must diff consecutive reads, and cope with two nasty
// real-world cases:
//   - RESET: the machine/PLC was power-cycled and the counter restarted at 0.
//   - OVERFLOW: a fixed-width register (e.g. 16-bit) wrapped past its max to 0.

/**
 * Delta between two cumulative counter reads.
 * @param {number|null|undefined} prev  last seen total (null on first read)
 * @param {number} curr                 current total
 * @param {number|null} [max]           register rollover max (e.g. 65535); null = no wrap
 * @returns {number} non-negative parts produced since `prev`
 */
export function computeDelta(prev, curr, max = null) {
  if (!Number.isFinite(curr) || curr < 0) return 0;
  if (prev == null || !Number.isFinite(prev)) return 0; // baseline read, no delta
  if (curr >= prev) return curr - prev; // normal forward count

  // Counter went backwards: overflow (known register width) or a reset.
  if (max != null && max > 0) {
    return max - prev + curr + 1; // wrapped: prev..max then 0..curr
  }
  return curr; // assume reset to 0; count parts made since the reset
}

/**
 * Accumulates good/scrap deltas over a time window so the gateway sends ONE
 * ingest event per machine per window instead of one HTTP call per part.
 */
export class WindowAggregator {
  constructor() {
    this.buckets = new Map(); // code -> { good, scrap }
  }
  add(code, good, scrap) {
    const b = this.buckets.get(code) ?? { good: 0, scrap: 0 };
    b.good += good;
    b.scrap += scrap;
    this.buckets.set(code, b);
  }
  /** Returns and clears all non-empty buckets: [{ code, good, scrap }]. */
  drain() {
    const out = [];
    for (const [code, b] of this.buckets) {
      if (b.good > 0 || b.scrap > 0) out.push({ code, ...b });
    }
    this.buckets.clear();
    return out;
  }
}

/** Deterministic per-window event id so retries dedupe cloud-side. */
export function windowEventId(code, now = Date.now(), windowMs = 5000) {
  return `${code}-w${Math.floor(now / windowMs) * windowMs}`;
}
