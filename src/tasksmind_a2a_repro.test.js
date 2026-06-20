"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Ledger, Account } = require("./billing");

test("summarizeAccount does not throw for an account with no invoices", () => {
  const ledger = new Ledger();
  ledger.addAccount(new Account("A-99", "NoInvoiceCo", { plan: "basic" }));
  // Should return a summary string, not throw TypeError on undefined.length
  const result = ledger.summarizeAccount("A-99");
  assert.ok(typeof result === "string", "expected a string summary");
  assert.match(result, /NoInvoiceCo/);
  assert.match(result, /0 invoice/);
});
