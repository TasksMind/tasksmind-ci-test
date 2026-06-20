"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { Warehouse, Sku } = require("./inventory");

test("summarizeSku does not throw for a SKU with no bins allocated", () => {
  const wh = new Warehouse("TEST");
  wh.registerSku(new Sku("NO-BINS", "Binless Part", { unitCost: 1.0 }));
  // Must not throw — SKU exists but has zero bins in the index
  assert.doesNotThrow(() => wh.summarizeSku("NO-BINS"));
  const result = wh.summarizeSku("NO-BINS");
  assert.match(result, /Binless Part/);
  assert.match(result, /0 bin\(s\)/);
});
