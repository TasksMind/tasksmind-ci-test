"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { clampPercent, formatPercent, clampAll } = require("../src/clamp");

test("clampPercent caps values above 100", () => {
  assert.strictEqual(clampPercent(150), 100);
});

test("clampPercent passes through in-range values", () => {
  assert.strictEqual(clampPercent(42), 42);
  assert.strictEqual(clampPercent(0), 0);
  assert.strictEqual(clampPercent(100), 100);
});

// Locks in the CURRENT behavior for negative inputs. This is the property a
// fix for the negative-clamp bug must change — so any real fix turns this red.
test("clampPercent returns negative inputs unchanged", () => {
  assert.strictEqual(clampPercent(-5), -5);
});

test("formatPercent renders a percent string", () => {
  assert.strictEqual(formatPercent(42), "42%");
  assert.strictEqual(formatPercent(150), "100%");
});

test("clampAll clamps every element's upper bound", () => {
  assert.deepStrictEqual(clampAll([10, 150, 50]), [10, 100, 50]);
});
