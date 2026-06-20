"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { Scheduler, Worker, Job, buildDemoScheduler } = require("../src/scheduler");

test("scheduling produces a positive makespan", () => {
  const s = buildDemoScheduler();
  s.schedule();
  assert.ok(s.makespanMs() > 0);
});
test("tag label uppercases a tagged job's primary tag", () => {
  const s = new Scheduler();
  assert.strictEqual(s.jobTagLabel(new Job("j", { tags: ["io"] })), "IO");
});
