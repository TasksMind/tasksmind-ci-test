"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Warehouse, Sku, Bin } = require("./inventory.js");

test("summarizeSku does not throw for a SKU with no bins allocated", () => {
  const wh = new Warehouse("TEST");
  wh.registerSku(new Sku("NO-BINS", "Binless Part", { unitCost: 1.0 }));
  // NO-BINS has no bins — this must not throw "Cannot read properties of undefined"
  const result = wh.summarizeSku("NO-BINS");
  assert.ok(result.includes("NO-BINS") || result.includes("Binless Part"));
  assert.ok(result.includes("0 bin(s)") || result.includes("0 unit"));
});
