"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { buildDemoLedger } = require("../src/billing");

// Happy-path smoke tests: exercise accounts that DO have invoices. None of
// these touch the zero-invoice edge case, so the suite is green at baseline.
test("open balance sums the open invoices", () => {
  const l = buildDemoLedger();
  assert.strictEqual(l.openBalanceCents(), 37000);
});
test("collected sums the paid invoices", () => {
  const l = buildDemoLedger();
  assert.strictEqual(l.collectedCents(), 30000);
});
test("summary for an account with invoices renders", () => {
  const l = buildDemoLedger();
  assert.match(l.summarizeAccount("A-1"), /Northwind/);
});
