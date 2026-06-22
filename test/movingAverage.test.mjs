import { test } from "node:test";
import assert from "node:assert/strict";
import { MovingAverage } from "../eval/movingAverage.mjs";

test("push evicts the oldest sample once the window is full", () => {
  const ma = new MovingAverage(3);
  ma.push(10);
  ma.push(20);
  ma.push(30); // window full: [10, 20, 30]
  const avg = ma.push(60); // must evict 10 → window [20, 30, 60]

  // Window must stay bounded at maxSize.
  assert.equal(ma.size(), 3);
  // Average must cover only the last 3 samples: 110/3, not the whole history 120/4.
  assert.equal(avg, Math.round((110 / 3) * 10000) / 10000);
});
