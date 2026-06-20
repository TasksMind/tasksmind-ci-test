"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { buildDemoWarehouse } = require("../src/inventory");

test("on-hand sums quantity across bins", () => {
  const wh = buildDemoWarehouse();
  assert.strictEqual(wh.onHand("WIDGET-01"), 52);
});
test("suggested order is a non-negative number", () => {
  const wh = buildDemoWarehouse();
  assert.ok(wh.suggestedOrder("GIZMO-07") >= 0);
});
test("summary for a SKU with bins renders", () => {
  const wh = buildDemoWarehouse();
  assert.match(wh.summarizeSku("WIDGET-01"), /Standard Widget/);
});
