"use strict";

/**
 * Latency digest — streaming p50/p90/p95/p99 over a window of samples.
 *
 * Ingests individual latency measurements (in milliseconds) and answers
 * percentile / mean / stddev queries over everything currently in the window.
 * Designed for an in-process metrics endpoint that reports rolling tail latency
 * per route, so the hot path is `record()` and the read path is `summary()`.
 *
 * Samples are kept in a value-sorted array (binary-search insertion) so a
 * percentile is a single indexed read rather than a sort-per-query. Each sample
 * also carries the timestamp it was recorded at, so a caller can trim everything
 * older than a cutoff and keep the digest bounded to "recent" behavior.
 *
 * Run directly for a demo report:
 *
 *   node --import tasksmind/catch src/percentile.js
 */

/** Round to 2 decimal places (milliseconds are reported to the 1/100th ms). */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Format a millisecond value as a short, fixed-width string for a report
 * column, e.g. `12.30ms` or `1.00s` once it crosses a second.
 */
function formatMs(ms) {
  if (!Number.isFinite(ms)) {
    return "—";
  }
  if (ms >= 1000) {
    return `${round2(ms / 1000)}s`;
  }
  return `${round2(ms)}ms`;
}

/**
 * A single recorded measurement: the latency value plus the wall-clock time it
 * was observed at. `ts` is only used by `trim()` — percentile math ignores it.
 */
class Sample {
  constructor(value, ts) {
    this.value = value;
    this.ts = ts;
  }
}

/**
 * A rolling latency digest for a single series (e.g. one route).
 *
 * Invariants:
 *   - `_sorted` is always ascending by `.value`.
 *   - `_sum` equals the sum of every sample's value currently in `_sorted`.
 * Both are maintained incrementally by `record()` / `trim()` so the read path
 * stays O(1) (mean) or O(log n) (percentile index) without rescanning.
 */
class LatencyDigest {
  /**
   * @param {string} name  human label for this series (shown in the report)
   * @param {object} [opts]
   * @param {number} [opts.maxSamples] hard cap on retained samples; when set,
   *   recording past the cap evicts the oldest-by-insertion sample so the digest
   *   never grows without bound. Unset ⇒ unbounded (trim() controls size).
   */
  constructor(name, opts = {}) {
    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError("LatencyDigest name must be a non-empty string");
    }
    this.name = name;
    this.maxSamples = opts.maxSamples ?? null;
    /** @type {Sample[]} ascending by value */
    this._sorted = [];
    /** @type {Sample[]} insertion order — used only for maxSamples eviction */
    this._insertionOrder = [];
    this._sum = 0;
  }

  /** Number of samples currently held. */
  get count() {
    return this._sorted.length;
  }

  /** Smallest recorded value (0 when empty). */
  get min() {
    return this._sorted.length === 0 ? 0 : this._sorted[0].value;
  }

  /** Largest recorded value (0 when empty). */
  get max() {
    return this._sorted.length === 0 ? 0 : this._sorted[this._sorted.length - 1].value;
  }

  /** Arithmetic mean of all retained values (0 when empty). */
  get mean() {
    if (this._sorted.length === 0) {
      return 0;
    }
    return this._sum / this._sorted.length;
  }

  /**
   * Record one latency measurement.
   *
   * @param {number} value  latency in milliseconds (must be a finite number ≥ 0)
   * @param {number} [ts]   observation time in ms-since-epoch; defaults to a
   *   monotonic counter so callers that don't care about trimming can omit it.
   */
  record(value, ts) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`latency sample must be a finite number ≥ 0, got ${value}`);
    }
    const sample = new Sample(value, ts ?? this._sorted.length);
    this._insertSorted(sample);
    this._insertionOrder.push(sample);
    this._sum += value;

    if (this.maxSamples != null && this._insertionOrder.length > this.maxSamples) {
      const oldest = this._insertionOrder.shift();
      this._removeSorted(oldest);
      this._sum -= oldest.value;
    }
    return this;
  }

  /**
   * Insert a sample into `_sorted` at the position that keeps the array
   * ascending by value (binary search for the lower bound, then splice).
   */
  _insertSorted(sample) {
    let lo = 0;
    let hi = this._sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this._sorted[mid].value < sample.value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    this._sorted.splice(lo, 0, sample);
  }

  /**
   * Remove a specific sample object from `_sorted` (identity match). Used by
   * eviction and trimming, both of which already hold the Sample reference.
   */
  _removeSorted(sample) {
    const idx = this._sorted.indexOf(sample);
    if (idx >= 0) {
      this._sorted.splice(idx, 1);
    }
  }

  /**
   * The p-th percentile value (nearest-rank), e.g. `percentile(99)` for p99.
   *
   * @param {number} p  percentile in [0, 100]
   * @returns {number}  the value at that rank (0 when empty)
   */
  percentile(p) {
    if (this._sorted.length === 0) {
      return 0;
    }
    // Nearest-rank index for the p-th percentile.
    // BUG: round() can land on `length` for a high percentile over a small
    // sample (e.g. p99 of 20 samples → round(19.8) = 20), so this indexes one
    // past the end. `this._sorted[idx]` is then undefined and reading `.value`
    // throws a TypeError right here. The index must be clamped to [0, length-1].
    const idx = Math.round((p / 100) * (this._sorted.length - 1));
    return this._sorted[idx].value;
  }

  /**
   * Several percentiles at once, returned as a plain object keyed by `pNN`.
   * Convenience around `percentile()` for the common p50/p90/p95/p99 report.
   *
   * @param {number[]} [ps]
   * @returns {Record<string, number>}
   */
  percentiles(ps = [50, 90, 95, 99]) {
    const out = {};
    for (const p of ps) {
      out[`p${p}`] = this.percentile(p);
    }
    return out;
  }

  /**
   * Population standard deviation of the retained values (0 when fewer than two
   * samples — there's no spread to speak of yet).
   */
  stddev() {
    const n = this._sorted.length;
    if (n < 2) {
      return 0;
    }
    const mean = this.mean;
    let acc = 0;
    for (const s of this._sorted) {
      const d = s.value - mean;
      acc += d * d;
    }
    return Math.sqrt(acc / n);
  }

  /**
   * Fold another digest's samples into this one. The merged digest answers
   * percentiles over the union of both sample sets. The other digest is left
   * untouched (its samples are copied, not moved).
   */
  merge(other) {
    if (!(other instanceof LatencyDigest)) {
      throw new TypeError("merge expects another LatencyDigest");
    }
    for (const s of other._sorted) {
      this.record(s.value, s.ts);
    }
    return this;
  }

  /**
   * Drop every sample observed strictly before `cutoffTs`, keeping the digest
   * focused on recent behavior. Returns the number of samples evicted.
   *
   * @param {number} cutoffTs  samples with ts < cutoffTs are removed
   */
  trim(cutoffTs) {
    if (typeof cutoffTs !== "number" || !Number.isFinite(cutoffTs)) {
      throw new RangeError(`trim cutoff must be a finite number, got ${cutoffTs}`);
    }
    let removed = 0;
    const survivorsSorted = [];
    for (const s of this._sorted) {
      if (s.ts < cutoffTs) {
        this._sum -= s.value;
        removed += 1;
      } else {
        survivorsSorted.push(s);
      }
    }
    this._sorted = survivorsSorted;
    this._insertionOrder = this._insertionOrder.filter((s) => s.ts >= cutoffTs);
    return removed;
  }

  /**
   * A compact, serializable snapshot of the digest — handy for shipping to a
   * dashboard or asserting on in a test.
   */
  toJSON() {
    return {
      name: this.name,
      count: this.count,
      min: round2(this.min),
      max: round2(this.max),
      mean: round2(this.mean),
      stddev: round2(this.stddev()),
      ...this.percentiles(),
    };
  }

  /**
   * One human-readable summary line, e.g.
   *   `checkout  n=20  p50=12.30ms  p90=88.00ms  p99=240.00ms  max=240.00ms`
   */
  summaryLine() {
    const pct = this.percentiles([50, 90, 99]);
    return (
      `${this.name.padEnd(12)} n=${String(this.count).padStart(4)}  ` +
      `p50=${formatMs(pct.p50)}  p90=${formatMs(pct.p90)}  ` +
      `p99=${formatMs(pct.p99)}  max=${formatMs(this.max)}`
    );
  }
}

/**
 * A registry of named digests — one per series/route. Lazily creates a digest
 * the first time a series is recorded against, so callers don't pre-declare.
 */
class DigestRegistry {
  constructor(opts = {}) {
    this.opts = opts;
    /** @type {Map<string, LatencyDigest>} */
    this.byName = new Map();
  }

  /** Fetch (or lazily create) the digest for a series. */
  digest(name) {
    let d = this.byName.get(name);
    if (!d) {
      d = new LatencyDigest(name, this.opts);
      this.byName.set(name, d);
    }
    return d;
  }

  /** Record a sample against a named series. */
  record(name, value, ts) {
    return this.digest(name).record(value, ts);
  }

  /** Series names, ordered by descending p99 (worst tail latency first). */
  rankedByTail() {
    return [...this.byName.values()]
      .sort((a, b) => b.percentile(99) - a.percentile(99))
      .map((d) => d.name);
  }

  /** A multi-line report across every registered series. */
  report() {
    const lines = ["Latency report", "=".repeat(64)];
    for (const name of this.rankedByTail()) {
      lines.push("  " + this.byName.get(name).summaryLine());
    }
    return lines.join("\n");
  }
}

/**
 * Build a representative registry with a couple of routes' worth of samples.
 * The `checkout` series intentionally includes a long tail so p99 is well above
 * p50 — a realistic shape for a report.
 */
function buildDemoRegistry() {
  const reg = new DigestRegistry();

  // A tidy, low-variance route.
  const health = [3, 4, 4, 5, 5, 5, 6, 6, 7, 8, 8, 9, 9, 10, 11, 12, 12, 13, 14, 15];
  health.forEach((v, i) => reg.record("health", v, i));

  // A route with a heavy tail: most requests are fast, a few are very slow.
  const checkout = [
    8, 9, 10, 11, 12, 12, 13, 14, 15, 16, 18, 20, 24, 30, 42, 60, 90, 140, 200, 240,
  ];
  checkout.forEach((v, i) => reg.record("checkout", v, i));

  return reg;
}

function main() {
  const reg = buildDemoRegistry();
  // Printing the report computes p99 for each series. The checkout series has
  // 20 samples, so p99 indexes one past the end and the bug surfaces here.
  console.log(reg.report());
}

if (require.main === module) {
  main();
}

module.exports = {
  LatencyDigest,
  DigestRegistry,
  Sample,
  formatMs,
  round2,
  buildDemoRegistry,
};
