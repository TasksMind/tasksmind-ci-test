"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Ledger, Account, Invoice } = require("./billing");

test("summarizeAccount does not throw for an account with no invoices", () => {
  const ledger = new Ledger();
  ledger.addAccount(new Account("A-1", "Tailspin", { plan: "basic" }));
  // No invoices issued for A-1.
  assert.doesNotThrow(() => ledger.summarizeAccount("A-1"));
  const summary = ledger.summarizeAccount("A-1");
  assert.ok(summary.includes("Tailspin"));
  assert.ok(summary.includes("0 invoice(s)"));
});
