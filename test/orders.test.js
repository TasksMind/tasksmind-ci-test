"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { buildDemoBook, STATUS } = require("../src/orders");

test("revenue excludes cancelled orders", () => {
  const b = buildDemoBook();
  assert.strictEqual(b.revenueCents(), 39500);
});
test("delivered count is correct", () => {
  const b = buildDemoBook();
  assert.strictEqual(b.countByStatus("delivered"), 2);
});
test("summary for a customer with orders renders", () => {
  const b = buildDemoBook();
  assert.match(b.summarizeCustomer("C-100"), /Acme Corp/);
});
