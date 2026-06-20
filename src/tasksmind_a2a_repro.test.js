"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { FulfillmentBook, Customer } = require("./orders.js");

describe("summarizeCustomer - customer with no orders", () => {
  it("should not throw when a customer has no orders", () => {
    const book = new FulfillmentBook();
    book.addCustomer(new Customer("C-999", "No Orders Corp", { tier: "standard" }));
    // This should not throw TypeError: Cannot read properties of undefined (reading 'length')
    assert.doesNotThrow(() => book.summarizeCustomer("C-999"));
  });

  it("should return a summary with 0 orders for a customer with no orders", () => {
    const book = new FulfillmentBook();
    book.addCustomer(new Customer("C-999", "No Orders Corp", { tier: "standard" }));
    const summary = book.summarizeCustomer("C-999");
    assert.match(summary, /0 order\(s\)/);
  });
});
