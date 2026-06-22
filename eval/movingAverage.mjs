// movingAverage.mjs
// Fixed-window moving average for streaming metrics (e.g. a rolling p50 latency
// feed). Self-contained, runnable:  node eval/movingAverage.mjs
//
// A MovingAverage keeps only the most-recent `maxSize` samples and reports the
// mean over that window. As new samples arrive, the OLDEST sample must be
// evicted so the average always reflects *recent* behavior — never the entire
// history. This is the property an alerting system relies on: a window that
// silently grows forever makes a latency spike look smaller than it is and
// suppresses the alert that should fire.
//
// @typedef {{ size: number, average: number }} WindowState

/** Round to 4 decimal places. */
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export class MovingAverage {
  /**
   * @param {number} maxSize  number of most-recent samples to average over
   */
  constructor(maxSize) {
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error(`maxSize must be a positive integer, got ${maxSize}`);
    }
    this.maxSize = maxSize;
    /** @type {number[]} oldest sample first, newest last */
    this.window = [];
    /** running sum of everything currently in `this.window` */
    this.sum = 0;
  }

  /**
   * Add a sample and return the current windowed average.
   *
   * Contract: once the window is full, adding a sample must evict the oldest one
   * so the window holds at most `maxSize` samples and `sum` stays in sync with
   * the window contents. The returned average therefore covers only the last
   * `maxSize` samples.
   */
  push(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`sample must be a number, got ${value}`);
    }
    this.window.push(value);
    this.sum += value;
    // Evict the oldest sample (and remove it from the running sum) whenever the
    // window has grown past maxSize, so the average always covers the last N.
    if (this.window.length > this.maxSize) {
      this.sum -= this.window.shift();
    }
    return round4(this.sum / this.window.length);
  }

  /** Current windowed average without adding a sample (NaN when empty). */
  average() {
    if (this.window.length === 0) return NaN;
    return round4(this.sum / this.window.length);
  }

  /** Number of samples currently in the window. */
  size() {
    return this.window.length;
  }

  /** @returns {WindowState} snapshot of the current window */
  state() {
    return { size: this.size(), average: this.average() };
  }
}

/**
 * Convenience: compute the final windowed average over a stream of samples.
 * @param {number[]} samples
 * @param {number} maxSize
 * @returns {number}
 */
export function rollingAverage(samples, maxSize) {
  const ma = new MovingAverage(maxSize);
  let avg = NaN;
  for (const s of samples) {
    avg = ma.push(s);
  }
  return avg;
}

// ── Demo / self-check ─────────────────────────────────────────────────────────
function main() {
  const ma = new MovingAverage(3);
  ma.push(10);
  ma.push(20);
  ma.push(30); // window full: [10, 20, 30], avg = 20
  const avg = ma.push(60); // must evict 10 → window [20, 30, 60], avg = 110/3

  console.log("Window state:", JSON.stringify(ma.state()));
  console.log("Average after 4th sample:", avg);

  // With a maxSize of 3, the window must never hold more than 3 samples.
  if (ma.size() !== 3) {
    throw new Error(
      `Window bug: expected size 3 after eviction, got ${ma.size()}`,
    );
  }
  // The 4th sample must push out the oldest (10), so the average is 110/3, not 120/4.
  const expected = round4(110 / 3);
  if (avg !== expected) {
    throw new Error(
      `Window bug: expected average ${expected} over the last 3 samples, got ${avg}`,
    );
  }
  console.log("OK: window stayed bounded at 3 and evicted the oldest sample.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
