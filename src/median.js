"use strict";

/**
 * Rolling median — exact median over a window of recent samples.
 *
 * Keeps samples in a value-sorted array (binary-search insertion) so `median()`
 * is a couple of indexed reads rather than a sort per query. Each sample carries
 * the timestamp it was observed at, so `trim()` can drop everything older than a
 * cutoff and keep the window focused on recent behavior.
 *
 * The median is the "middle" value of the sorted window:
 *   - odd count  → the single middle element
 *   - even count → the AVERAGE of the two middle elements
 * That even-count averaging is the whole point of a median (it's what keeps the
 * median unbiased); a report that skips it reads systematically high.
 *
 * Run directly for a demo:
 *
 *   node --import tasksmind/catch src/median.js
 */

/** Round to 2 decimal places. */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/** A single observation: a value plus the time it was recorded at. */
class Sample {
  constructor(value, ts) {
    this.value = value;
    this.ts = ts;
  }
}

/**
 * A rolling-median digest for one series.
 *
 * Invariant: `_sorted` is always ascending by `.value`, maintained by
 * binary-search insertion in `record()` so reads never have to re-sort.
 */
class RollingMedian {
  constructor(name = "series") {
    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError("RollingMedian name must be a non-empty string");
    }
    this.name = name;
    /** @type {Sample[]} ascending by value */
    this._sorted = [];
    this._sum = 0;
  }

  /** Number of samples currently in the window. */
  get count() {
    return this._sorted.length;
  }

  /** Smallest retained value (0 when empty). */
  get min() {
    return this._sorted.length === 0 ? 0 : this._sorted[0].value;
  }

  /** Largest retained value (0 when empty). */
  get max() {
    return this._sorted.length === 0 ? 0 : this._sorted[this._sorted.length - 1].value;
  }

  /** Arithmetic mean of retained values (0 when empty). */
  get mean() {
    return this._sorted.length === 0 ? 0 : this._sum / this._sorted.length;
  }

  /**
   * Record one sample.
   *
   * @param {number} value  the measurement (finite number)
   * @param {number} [ts]   observation time in ms-since-epoch; defaults to a
   *   monotonic counter so callers that don't trim can omit it.
   */
  record(value, ts) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RangeError(`median sample must be a finite number, got ${value}`);
    }
    const sample = new Sample(value, ts ?? this._sorted.length);
    this._insertSorted(sample);
    this._sum += value;
    return this;
  }

  /** Binary-search insert that keeps `_sorted` ascending by value. */
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
   * The median of the current window.
   *
   * BUG: this is wrong in two coupled ways, and fixing only one leaves the other
   * broken (so there is no correct one-line fix):
   *   (1) no empty-window guard — when the window is empty, `this._sorted[mid]`
   *       is undefined and reading `.value` throws a TypeError right here.
   *   (2) even-count case is unhandled — for an even number of samples the median
   *       must be the AVERAGE of the two middle values, but this returns only the
   *       upper-middle element, biasing the median high.
   * A correct fix must add the empty guard AND the even-count averaging branch.
   */
  median() {
    if (this._sorted.length === 0) {
      return 0;
    }
    const mid = Math.floor(this._sorted.length / 2);
    if (this._sorted.length % 2 === 0) {
      return (this._sorted[mid - 1].value + this._sorted[mid].value) / 2;
    }
    return this._sorted[mid].value;
  }

  /**
   * Median absolute deviation around the median — a robust spread measure.
   * Builds on `median()`, so it inherits a correct median once that's fixed.
   */
  mad() {
    if (this._sorted.length === 0) {
      return 0;
    }
    const m = this.median();
    const deviations = this._sorted
      .map((s) => Math.abs(s.value - m))
      .sort((a, b) => a - b);
    const mid = Math.floor(deviations.length / 2);
    if (deviations.length % 2 === 0) {
      return (deviations[mid - 1] + deviations[mid]) / 2;
    }
    return deviations[mid];
  }

  /**
   * Drop every sample observed strictly before `cutoffTs`. Returns the number
   * removed. Keeps `_sum` in sync.
   */
  trim(cutoffTs) {
    if (typeof cutoffTs !== "number" || !Number.isFinite(cutoffTs)) {
      throw new RangeError(`trim cutoff must be a finite number, got ${cutoffTs}`);
    }
    let removed = 0;
    const survivors = [];
    for (const s of this._sorted) {
      if (s.ts < cutoffTs) {
        this._sum -= s.value;
        removed += 1;
      } else {
        survivors.push(s);
      }
    }
    this._sorted = survivors;
    return removed;
  }

  /** A serializable snapshot. */
  toJSON() {
    return {
      name: this.name,
      count: this.count,
      min: round2(this.min),
      max: round2(this.max),
      mean: round2(this.mean),
      median: round2(this.median()),
      mad: round2(this.mad()),
    };
  }

  /** One human-readable summary line. */
  summaryLine() {
    return (
      `${this.name.padEnd(12)} n=${String(this.count).padStart(4)}  ` +
      `median=${round2(this.median())}  mean=${round2(this.mean)}  ` +
      `min=${round2(this.min)}  max=${round2(this.max)}`
    );
  }
}

/**
 * Build a demo digest. The sample set has an EVEN count on purpose, so the
 * even-count median path is exercised by the report.
 */
function buildDemoMedian() {
  const m = new RollingMedian("requests");
  // 10 samples (even count): sorted middles are the 5th and 6th values.
  [12, 3, 7, 20, 5, 9, 14, 1, 8, 11].forEach((v, i) => m.record(v, i));
  return m;
}

function main() {
  const m = buildDemoMedian();
  console.log("Rolling median report");
  console.log("=".repeat(48));
  console.log("  " + m.summaryLine());
  console.log(`  JSON: ${JSON.stringify(m.toJSON())}`);

  // A digest whose window has been fully trimmed is empty; asking for its median
  // must be a safe 0, not a crash. Today it throws (defect 1) — straight out of
  // median(), so the crash localizes to the buggy method.
  const drained = new RollingMedian("drained");
  drained.record(5, 0);
  drained.trim(1); // ts 0 < cutoff 1 → removes the only sample → empty window
  console.log(`  drained median: ${drained.median()}`);
}

if (require.main === module) {
  main();
}

module.exports = { RollingMedian, Sample, round2, buildDemoMedian };
