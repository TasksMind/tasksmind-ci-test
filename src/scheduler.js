"use strict";

/**
 * Round-robin job scheduler.
 *
 * Assigns queued jobs to a pool of workers, respecting per-worker
 * concurrency limits and job priorities, then prints the resulting
 * assignment plan. Run directly for a demo workload:
 *
 *   node --import tasksmind/catch src/scheduler.js
 */

const PRIORITY = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

/**
 * A unit of work to be scheduled.
 */
class Job {
  constructor(id, opts = {}) {
    this.id = id;
    this.priority = opts.priority ?? "normal";
    this.estimateMs = opts.estimateMs ?? 1000;
    this.tags = opts.tags ?? [];
  }

  get priorityRank() {
    return PRIORITY[this.priority] ?? PRIORITY.normal;
  }
}

/**
 * A worker that can run up to `concurrency` jobs at once.
 */
class Worker {
  constructor(id, concurrency = 1) {
    this.id = id;
    this.concurrency = concurrency;
    this.assigned = [];
  }

  get load() {
    return this.assigned.reduce((total, job) => total + job.estimateMs, 0);
  }

  hasCapacity() {
    return this.assigned.length < this.concurrency;
  }

  assign(job) {
    this.assigned.push(job);
  }
}

class Scheduler {
  constructor() {
    this.workers = [];
    this.queue = [];
  }

  addWorker(worker) {
    this.workers.push(worker);
    return worker;
  }

  submit(job) {
    this.queue.push(job);
    return job;
  }

  /**
   * Jobs sorted by priority (highest first), then by estimate (shortest
   * first) as a tie-breaker.
   */
  sortedQueue() {
    return [...this.queue].sort((a, b) => {
      if (b.priorityRank !== a.priorityRank) {
        return b.priorityRank - a.priorityRank;
      }
      return a.estimateMs - b.estimateMs;
    });
  }

  /**
   * Pick the worker with spare capacity and the lowest current load.
   * Returns null when every worker is saturated.
   */
  pickWorker() {
    const available = this.workers.filter((w) => w.hasCapacity());
    if (available.length === 0) {
      return null;
    }
    return available.reduce((best, w) => (w.load < best.load ? w : best));
  }

  /**
   * Assign as many queued jobs as capacity allows. Jobs that don't fit
   * are returned as the overflow list.
   */
  schedule() {
    const overflow = [];
    for (const job of this.sortedQueue()) {
      const worker = this.pickWorker();
      if (worker) {
        worker.assign(job);
      } else {
        overflow.push(job);
      }
    }
    return overflow;
  }

  /**
   * Estimated makespan: the load of the most heavily loaded worker.
   */
  makespanMs() {
    return this.workers.reduce((max, w) => (w.load > max ? w.load : max), 0);
  }

  /**
   * Per-worker breakdown of assigned jobs.
   */
  assignmentReport() {
    const lines = [];
    for (const worker of this.workers) {
      const jobIds = worker.assigned.map((j) => j.id).join(", ");
      lines.push(
        `  ${worker.id.padEnd(10)} ${worker.assigned.length}/${worker.concurrency} jobs, ${worker.load}ms  [${jobIds}]`
      );
    }
    return lines.join("\n");
  }

  /**
   * Average load across the worker pool, used for a balance metric.
   */
  averageLoadMs() {
    const total = this.workers.reduce((sum, w) => sum + w.load, 0);
    return Math.round(total / this.workers.length);
  }

  /**
   * Balance score: how far the busiest worker is above the average,
   * as a percentage. 0% means perfectly balanced.
   */
  balanceScore() {
    const avg = this.averageLoadMs();
    if (avg === 0) {
      return 0;
    }
    const peak = this.makespanMs();
    return Math.round(((peak - avg) / avg) * 100);
  }

  /**
   * Short uppercased label for a job, derived from its primary tag.
   * Used to annotate the scheduling plan.
   */
  jobTagLabel(job) {
    // BUG: jobs submitted without tags have an empty `tags` array, so
    // `tags[0]` is undefined and calling .toUpperCase() on it throws a
    // TypeError at this line.
    return job.tags[0].toUpperCase();
  }
}

function buildDemoScheduler() {
  const sched = new Scheduler();
  sched.addWorker(new Worker("worker-a", 2));
  sched.addWorker(new Worker("worker-b", 2));
  sched.addWorker(new Worker("worker-c", 1));

  sched.submit(new Job("ingest-logs", { priority: "high", estimateMs: 3000, tags: ["io"] }));
  sched.submit(new Job("resize-image", { priority: "normal", estimateMs: 1500 }));
  sched.submit(new Job("send-email", { priority: "low", estimateMs: 400 }));
  sched.submit(new Job("reindex", { priority: "urgent", estimateMs: 5000, tags: ["cpu"] }));
  sched.submit(new Job("warm-cache", { priority: "normal", estimateMs: 800 }));

  return sched;
}

function main() {
  const sched = buildDemoScheduler();
  const overflow = sched.schedule();

  console.log("Scheduling plan");
  console.log("=".repeat(48));
  console.log(sched.assignmentReport());
  console.log("-".repeat(48));
  console.log(`  Makespan:      ${sched.makespanMs()}ms`);
  console.log(`  Average load:  ${sched.averageLoadMs()}ms`);
  console.log(`  Balance score: ${sched.balanceScore()}%`);
  console.log("-".repeat(48));
  console.log("  Job labels:");
  for (const job of sched.sortedQueue()) {
    console.log(`    ${job.id.padEnd(16)} ${sched.jobTagLabel(job)}`);
  }
  if (overflow.length > 0) {
    console.log(`  Overflow:      ${overflow.map((j) => j.id).join(", ")}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { Scheduler, Worker, Job, buildDemoScheduler };
