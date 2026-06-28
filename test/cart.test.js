const test = require("node:test");
const assert = require("node:assert");

const { tierFor, lineTotal } = require("../src/cart");

// Volume-pricing tiers: the applicable unit price is the highest tier whose
// threshold the quantity meets. A large order should land on the top tier.
test("a large-volume order uses the top pricing tier", () => {
  // 120 units >= the 100-unit threshold -> $7.00/unit.
  assert.strictEqual(tierFor(120), 700);
});

test("line total applies the volume price", () => {
  // 120 units @ $7.00 = $840.00.
  assert.strictEqual(lineTotal(120), 84000);
});
