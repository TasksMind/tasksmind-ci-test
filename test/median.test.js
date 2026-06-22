const test = require("node:test");
const assert = require("node:assert");

const { RollingMedian } = require("../src/median");

test("median() returns 0 on an empty window instead of throwing", () => {
  const m = new RollingMedian("empty");
  assert.strictEqual(m.median(), 0);
});

test("median() averages the two middle values for an even sample count", () => {
  const m = new RollingMedian("even");
  // sorted: [1, 3, 5, 7] → middles are 3 and 5 → median 4
  [3, 1, 7, 5].forEach((v, i) => m.record(v, i));
  assert.strictEqual(m.median(), 4);
});

test("median() returns the single middle value for an odd sample count", () => {
  const m = new RollingMedian("odd");
  // sorted: [1, 3, 5] → median 3
  [3, 1, 5].forEach((v, i) => m.record(v, i));
  assert.strictEqual(m.median(), 3);
});
