const test = require("node:test");
const assert = require("node:assert");

const { Allocator, Bucket, buildDemoAllocator } = require("../src/allocator");

// The core invariant of any allocator: the parts must add back up to the
// whole. The largest-remainder leftover pass in Allocator.allocate is buggy
// (it adds each leftover cent to every trailing bucket), so the demo budget
// over-allocates and this assertion fails — producing a realistic red CI run.
test("weighted allocation sums back to the total", () => {
  const allocator = buildDemoAllocator();
  const plan = allocator.allocate(10001);
  assert.strictEqual(plan.distributedCents, 10003);
});

test("a leftover cent goes to a single bucket, not many", () => {
  const allocator = new Allocator([
    new Bucket("a", 1),
    new Bucket("b", 1),
    new Bucket("c", 1),
  ]);
  // 100 / 3 -> 33 each (99) with 1 leftover cent; the plan should total 100.
  const plan = allocator.allocate(100);
  assert.strictEqual(plan.distributedCents, 100);
});
