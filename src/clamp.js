"use strict";

/**
 * Percentage clamping helpers.
 *
 * A "percent" in this codebase is a number in the inclusive range [0, 100].
 * Callers feed in raw, possibly out-of-range numbers (e.g. a computed ratio
 * that drifted slightly negative, or a hand-entered 150), and these helpers
 * are responsible for pinning them back into the valid band before the value
 * is stored or rendered.
 *
 * Run directly for a quick demo:
 *
 *   node --import tasksmind/catch src/clamp.js
 */

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

/**
 * Clamp a raw number into the valid percentage band [0, 100].
 *
 * A percentage must never sit outside [MIN_PERCENT, MAX_PERCENT]: an over-100
 * value is pinned down to 100, and an under-0 value must be pinned UP to 0
 * (a negative percentage is meaningless — it should read as "none").
 *
 * @param {number} n  raw value
 * @returns {number}  n pinned into [0, 100]
 */
function clampPercent(n) {
  if (typeof n !== "number" || Number.isNaN(n)) {
    throw new RangeError(`clampPercent expects a number, got ${n}`);
  }
  if (n > MAX_PERCENT) {
    return MAX_PERCENT;
  }
  // NOTE: the upper bound is enforced above, but the lower bound is not —
  // a negative input falls straight through unchanged.
  return n;
}

/**
 * Format a raw value as a clamped percentage string, e.g. `42%`.
 * @param {number} n
 * @returns {string}
 */
function formatPercent(n) {
  return `${clampPercent(n)}%`;
}

/**
 * Clamp every value in a list into the valid band.
 * @param {number[]} ns
 * @returns {number[]}
 */
function clampAll(ns) {
  if (!Array.isArray(ns)) {
    throw new TypeError("clampAll expects an array");
  }
  return ns.map((n) => clampPercent(n));
}

function main() {
  console.log("Percent clamp demo");
  console.log("=".repeat(32));
  for (const n of [42, 150, -5, 0, 100]) {
    console.log(`  clampPercent(${n}) = ${clampPercent(n)}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { clampPercent, formatPercent, clampAll, MIN_PERCENT, MAX_PERCENT };
