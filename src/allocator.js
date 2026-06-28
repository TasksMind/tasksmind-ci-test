"use strict";

/**
 * Weighted budget allocator.
 *
 * Splits an integer amount of money (in cents) across a set of weighted
 * buckets so that, for example, a $100.00 marketing budget can be divided
 * 50/30/20 across three channels without ever losing or inventing a cent.
 *
 * Money is always tracked in integer cents to avoid floating-point drift;
 * the only place fractional cents appear is during the weighted split, where
 * we floor each bucket and then hand out the leftover cents one at a time.
 *
 * Run directly for a demo allocation:
 *
 *   node --import tasksmind/catch src/allocator.js
 */

/**
 * A single destination for funds, with a relative weight.
 */
class Bucket {
  constructor(name, weight, opts = {}) {
    if (typeof name !== "string" || name.length === 0) {
      throw new TypeError("Bucket name must be a non-empty string");
    }
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError(`Bucket "${name}" weight must be a non-negative number`);
    }
    this.name = name;
    this.weight = weight;
    // Optional hard floor: this bucket should never receive less than this
    // many cents even if its weight would round down to zero.
    this.minCents = opts.minCents ?? 0;
    // Optional label used purely for receipts / reporting.
    this.label = opts.label ?? name;
  }
}

/**
 * The immutable result of running an allocation: a frozen map of
 * bucket-name -> cents, plus the inputs that produced it.
 */
class AllocationPlan {
  constructor(totalCents, allocations) {
    this.totalCents = totalCents;
    this.allocations = Object.freeze({ ...allocations });
    Object.freeze(this);
  }

  /**
   * Cents assigned to a single bucket (0 if the bucket is unknown).
   */
  centsFor(name) {
    return this.allocations[name] ?? 0;
  }

  /**
   * Sum of every bucket's allocation. For a correct plan this must equal
   * `totalCents` exactly — that invariant is what the tests check.
   */
  get distributedCents() {
    let sum = 0;
    for (const name of Object.keys(this.allocations)) {
      sum += this.allocations[name];
    }
    return sum;
  }

  /**
   * Cents that were requested but not handed out. Should always be 0.
   */
  get leftoverCents() {
    return this.totalCents - this.distributedCents;
  }

  /**
   * Render the plan as dollar strings for a human-readable receipt.
   */
  toReceipt() {
    const lines = [];
    for (const name of Object.keys(this.allocations)) {
      lines.push(`${name}: ${formatCents(this.allocations[name])}`);
    }
    lines.push(`total: ${formatCents(this.totalCents)}`);
    return lines.join("\n");
  }
}

/**
 * Format an integer number of cents as a `$d.dd` string.
 */
function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars}.${String(remainder).padStart(2, "0")}`;
}

/**
 * The allocator itself. Holds a fixed set of buckets and can split any
 * integer cent amount across them according to their weights.
 */
class Allocator {
  constructor(buckets = []) {
    this.buckets = [];
    for (const b of buckets) {
      this.addBucket(b);
    }
  }

  /**
   * Register a bucket. Names must be unique within an allocator.
   */
  addBucket(bucket) {
    if (!(bucket instanceof Bucket)) {
      throw new TypeError("addBucket expects a Bucket instance");
    }
    if (this.buckets.some((b) => b.name === bucket.name)) {
      throw new Error(`Duplicate bucket name: ${bucket.name}`);
    }
    this.buckets.push(bucket);
    return this;
  }

  /**
   * Total weight across all buckets. Used as the denominator in the split.
   */
  get totalWeight() {
    let sum = 0;
    for (const b of this.buckets) {
      sum += b.weight;
    }
    return sum;
  }

  /**
   * Compute the integer-cent floor share for one bucket given a total.
   */
  _flooredShare(bucket, totalCents) {
    if (this.totalWeight === 0) {
      return 0;
    }
    const exact = (totalCents * bucket.weight) / this.totalWeight;
    return Math.floor(exact);
  }

  /**
   * Split `totalCents` across the buckets by weight.
   *
   * Strategy:
   *   1. Give each bucket the floor of its exact weighted share.
   *   2. Because flooring throws away fractional cents, some cents are left
   *      over. Distribute those leftover cents one-by-one to the buckets
   *      with the largest fractional remainder (largest-remainder method),
   *      so the parts always add back up to the whole.
   *
   * @param {number} totalCents non-negative integer cents to allocate
   * @returns {AllocationPlan}
   */
  allocate(totalCents) {
    if (!Number.isInteger(totalCents) || totalCents < 0) {
      throw new RangeError("totalCents must be a non-negative integer");
    }
    if (this.buckets.length === 0) {
      throw new Error("Cannot allocate with no buckets");
    }

    const totalWeight = this.totalWeight;
    if (totalWeight === 0) {
      // No weights at all: nothing can be distributed by weight.
      const empty = {};
      for (const b of this.buckets) {
        empty[b.name] = 0;
      }
      return new AllocationPlan(totalCents, empty);
    }

    // Step 1: floored shares, and remember each bucket's fractional part so
    // we can rank them for the leftover pass.
    const shares = {};
    const remainders = [];
    let distributed = 0;
    for (const b of this.buckets) {
      const exact = (totalCents * b.weight) / totalWeight;
      const floored = Math.floor(exact);
      shares[b.name] = floored;
      distributed += floored;
      remainders.push({ name: b.name, frac: exact - floored });
    }

    // Step 2: hand out the leftover cents to the largest remainders first.
    // Each leftover cent goes to exactly one bucket (the next-largest
    // remainder), so the parts always add back up to the whole.
    let leftover = totalCents - distributed;
    remainders.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < leftover; i++) {
      shares[remainders[i].name] += 1;
    }

    // Step 3: enforce per-bucket minimums (best-effort; does not re-balance).
    for (const b of this.buckets) {
      if (b.minCents > 0 && shares[b.name] < b.minCents) {
        shares[b.name] = b.minCents;
      }
    }

    return new AllocationPlan(totalCents, shares);
  }

  /**
   * Allocate the same total repeatedly across a schedule of periods,
   * returning one plan per period. Handy for monthly budget rollouts.
   */
  allocateSchedule(totalCents, periods) {
    if (!Number.isInteger(periods) || periods <= 0) {
      throw new RangeError("periods must be a positive integer");
    }
    const plans = [];
    for (let p = 0; p < periods; p++) {
      plans.push(this.allocate(totalCents));
    }
    return plans;
  }

  /**
   * Convenience: allocate a dollar amount given as a float (e.g. 100.5).
   * Converts to cents up front so the rest of the math stays integer.
   */
  allocateDollars(dollars) {
    const cents = Math.round(dollars * 100);
    return this.allocate(cents);
  }

  /**
   * Return each bucket's weight as a fraction of the whole, suitable for
   * display next to an allocation (e.g. "paid_search — 50.0%").
   */
  weightShares() {
    const total = this.totalWeight;
    const shares = {};
    for (const b of this.buckets) {
      shares[b.name] = total === 0 ? 0 : b.weight / total;
    }
    return shares;
  }

  /**
   * Produce a compact summary object for logging / dashboards: the bucket
   * names, their percentage weights, and the cents each would receive for a
   * given total. Does not mutate anything.
   */
  summarize(totalCents) {
    const plan = this.allocate(totalCents);
    const shares = this.weightShares();
    const rows = this.buckets.map((b) => ({
      name: b.name,
      label: b.label,
      percent: Math.round(shares[b.name] * 1000) / 10,
      cents: plan.centsFor(b.name),
    }));
    return {
      totalCents,
      distributedCents: plan.distributedCents,
      leftoverCents: plan.leftoverCents,
      rows,
    };
  }

  /**
   * Build a new Allocator whose weights are scaled by `factor`. Useful for
   * "double the content budget" style tweaks without mutating the original.
   */
  scaled(factor) {
    if (!Number.isFinite(factor) || factor < 0) {
      throw new RangeError("scale factor must be a non-negative number");
    }
    const next = new Allocator();
    for (const b of this.buckets) {
      next.addBucket(
        new Bucket(b.name, b.weight * factor, {
          minCents: b.minCents,
          label: b.label,
        })
      );
    }
    return next;
  }
}

/**
 * Build a representative allocator + run a demo allocation. Used by the
 * `node ... src/allocator.js` entry point and by the test suite as a
 * realistic fixture.
 */
function buildDemoAllocator() {
  return new Allocator([
    new Bucket("paid_search", 50, { label: "Paid Search" }),
    new Bucket("social", 30, { label: "Social" }),
    new Bucket("content", 20, { label: "Content", minCents: 100 }),
  ]);
}

/**
 * Run a demo allocation and print the receipt. Only executes when this file
 * is run directly, not when it is required as a module.
 */
function main() {
  const allocator = buildDemoAllocator();
  // $100.01 deliberately leaves a leftover cent so the largest-remainder
  // pass has something to do.
  const plan = allocator.allocate(10001);
  process.stdout.write(plan.toReceipt() + "\n");
  process.stdout.write(`leftover: ${plan.leftoverCents} cent(s)\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  Allocator,
  Bucket,
  AllocationPlan,
  buildDemoAllocator,
  formatCents,
};
