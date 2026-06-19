const test = require("node:test");
const assert = require("node:assert");

// Intentional bug so CI fails with a realistic assertion in the logs.
function sum(a, b) {
  return a + b;
}

test("sum adds two numbers", () => {
  assert.strictEqual(sum(2, 3), 5);
});
