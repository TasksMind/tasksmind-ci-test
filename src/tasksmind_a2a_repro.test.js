"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { FulfillmentBook, Customer } = require("./orders.js");

test("summarizeCustomer handles a customer with zero orders", () => {
  const book = new FulfillmentBook();
  book.addCustomer(new Customer("C-400", "Umbrella", { tier: "standard" }));

  // Should not throw a TypeError when the customer has no orders.
  const line = book.summarizeCustomer("C-400");
  assert.match(line, /Umbrella/);
  assert.match(line, /0 order\(s\)/);
});
