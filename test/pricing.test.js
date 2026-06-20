"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { Cart, Product } = require("../src/pricing");

// Carts in a KNOWN region price correctly — the unknown-region path is not
// exercised here, so this baseline is green.
test("known region resolves a tax rate", () => {
  const cart = new Cart("US-CA");
  cart.add(new Product("P", "Thing", 1000), 1);
  assert.strictEqual(cart.taxRate(), 0.0725);
});
test("total is a positive integer for a known region", () => {
  const cart = new Cart("US-CA");
  cart.add(new Product("P", "Thing", 1000), 2);
  const total = cart.totalCents();
  assert.ok(Number.isInteger(total) && total > 0);
});
