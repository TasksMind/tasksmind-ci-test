import { test } from "node:test";
import assert from "node:assert/strict";
import { MovingAverage } from "../eval/movingAverage.mjs";

test("window is bounded at maxSize after eviction", () => {
  const ma = new MovingAverage(3);
  ma.push(10);
  ma.push(20);
  ma.push(30);
  // 4th push must evict 10 → window [20, 30, 60]
  const avg = ma.push(60);

  assert.strictEqual(ma.size(), 3, "window must not grow past maxSize");
  const expected = Math.round((110 / 3) * 10000) / 10000;
  assert.strictEqual(avg, expected, "average must cover only the last 3 samples");
});
