"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { buildDemoAllocator, formatCents } = require("../src/allocator");

// A clean (no-leftover) allocation never enters the largest-remainder pass,
// so this baseline stays green even with the leftover bug present.
test("an exact-split allocation sums back to the total", () => {
  const a = buildDemoAllocator();
  const plan = a.allocate(1000); // 50/30/20 -> 500/300/200, leftover 0
  assert.strictEqual(plan.distributedCents, 1000);
});
test("formatCents renders dollars", () => {
  assert.strictEqual(formatCents(10001), "$100.01");
});
