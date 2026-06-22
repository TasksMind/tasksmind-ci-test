"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { buildDemoLedger } = require("../src/billing");

// Reproduces: summarizeAccount crashes when the account has no invoices
// because index[accountId] is undefined and .length throws on undefined.
test("summarizeAccount works for an account with no invoices", () => {
  const l = buildDemoLedger();
  // A-4 (Tailspin) was added to the demo ledger but has no invoices.
  const summary = l.summarizeAccount("A-4");
  assert.match(summary, /Tailspin/);
  assert.match(summary, /0 invoice\(s\)/);
});
