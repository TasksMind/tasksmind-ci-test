"use strict";

/**
 * Warehouse inventory manager.
 *
 * Tracks SKUs across multiple bins, computes reorder points, and produces
 * a restock plan. Run directly to print a restock report for the demo
 * dataset:
 *
 *   node --import tasksmind/catch src/inventory.js
 */

const DEFAULT_LEAD_TIME_DAYS = 7;
const DEFAULT_SAFETY_FACTOR = 1.25;

/**
 * A single stock-keeping unit.
 */
class Sku {
  constructor(code, name, opts = {}) {
    this.code = code;
    this.name = name;
    this.unitCost = opts.unitCost ?? 0;
    this.leadTimeDays = opts.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
    this.safetyFactor = opts.safetyFactor ?? DEFAULT_SAFETY_FACTOR;
  }

  toString() {
    return `${this.code} (${this.name})`;
  }
}

/**
 * A physical bin holding a quantity of a single SKU.
 */
class Bin {
  constructor(id, skuCode, quantity) {
    this.id = id;
    this.skuCode = skuCode;
    this.quantity = quantity;
  }
}

/**
 * Rolling daily-demand tracker. Keeps the last `window` days of demand
 * and exposes a smoothed average used for reorder math.
 */
class DemandHistory {
  constructor(window = 30) {
    this.window = window;
    this.samples = [];
  }

  record(units) {
    this.samples.push(units);
    if (this.samples.length > this.window) {
      this.samples.shift();
    }
  }

  average() {
    if (this.samples.length === 0) {
      return 0;
    }
    const total = this.samples.reduce((acc, n) => acc + n, 0);
    return total / this.samples.length;
  }

  peak() {
    return this.samples.reduce((max, n) => (n > max ? n : max), 0);
  }
}

class Warehouse {
  constructor(name) {
    this.name = name;
    this.skus = new Map();
    this.bins = [];
    this.demand = new Map();
  }

  registerSku(sku) {
    this.skus.set(sku.code, sku);
    if (!this.demand.has(sku.code)) {
      this.demand.set(sku.code, new DemandHistory());
    }
    return sku;
  }

  addBin(bin) {
    if (!this.skus.has(bin.skuCode)) {
      throw new Error(`Cannot add bin for unknown SKU: ${bin.skuCode}`);
    }
    this.bins.push(bin);
    return bin;
  }

  recordDemand(skuCode, units) {
    const history = this.demand.get(skuCode);
    if (!history) {
      throw new Error(`No demand history for SKU: ${skuCode}`);
    }
    history.record(units);
  }

  /**
   * Total on-hand quantity for a SKU across every bin.
   */
  onHand(skuCode) {
    return this.bins
      .filter((bin) => bin.skuCode === skuCode)
      .reduce((total, bin) => total + bin.quantity, 0);
  }

  /**
   * Reorder point = average daily demand * lead time * safety factor.
   */
  reorderPoint(skuCode) {
    const sku = this.skus.get(skuCode);
    const history = this.demand.get(skuCode);
    const avgDaily = history.average();
    return Math.ceil(avgDaily * sku.leadTimeDays * sku.safetyFactor);
  }

  /**
   * Suggested order quantity to bring stock back up to the reorder point.
   * Returns 0 when stock is already healthy.
   */
  suggestedOrder(skuCode) {
    const point = this.reorderPoint(skuCode);
    const have = this.onHand(skuCode);
    const deficit = point - have;
    return deficit > 0 ? deficit : 0;
  }

  /**
   * Build a restock plan for every registered SKU, sorted by the total
   * cost of the suggested order (most expensive first).
   */
  buildRestockPlan() {
    const lines = [];
    for (const skuCode of this.skus.keys()) {
      const orderQty = this.suggestedOrder(skuCode);
      if (orderQty > 0) {
        const sku = this.skus.get(skuCode);
        lines.push({
          skuCode,
          name: sku.name,
          orderQty,
          unitCost: sku.unitCost,
          totalCost: orderQty * sku.unitCost,
        });
      }
    }
    lines.sort((a, b) => b.totalCost - a.totalCost);
    return lines;
  }

  /**
   * Human-readable demand summary for one SKU. Pulls the SKU's bin list
   * out of a per-SKU index so the report can show where stock lives.
   */
  summarizeSku(skuCode) {
    const sku = this.skus.get(skuCode);
    const index = this.binIndex();
    const binsForSku = index[skuCode] ?? [];
    const binCount = binsForSku.length;
    const locations = binsForSku.map((bin) => bin.id).join(", ");
    return `${sku.name}: ${this.onHand(skuCode)} units across ${binCount} bin(s) [${locations}]`;
  }

  /**
   * Group bins by SKU code. Only SKUs that actually have bins appear.
   */
  binIndex() {
    const index = {};
    for (const bin of this.bins) {
      if (!index[bin.skuCode]) {
        index[bin.skuCode] = [];
      }
      index[bin.skuCode].push(bin);
    }
    return index;
  }
}

function buildDemoWarehouse() {
  const wh = new Warehouse("DEMO-WEST");

  wh.registerSku(new Sku("WIDGET-01", "Standard Widget", { unitCost: 4.5 }));
  wh.registerSku(new Sku("GIZMO-07", "Deluxe Gizmo", { unitCost: 19.0, leadTimeDays: 14 }));
  wh.registerSku(new Sku("CABLE-22", "USB-C Cable", { unitCost: 2.25 }));
  // SPARE-99 is registered but has no bins yet — freshly created SKU.
  wh.registerSku(new Sku("SPARE-99", "Spare Bracket", { unitCost: 0.75 }));

  wh.addBin(new Bin("A1", "WIDGET-01", 40));
  wh.addBin(new Bin("A2", "WIDGET-01", 12));
  wh.addBin(new Bin("B1", "GIZMO-07", 5));
  wh.addBin(new Bin("C1", "CABLE-22", 200));

  const demand = {
    "WIDGET-01": [8, 10, 12, 9, 11, 14, 7],
    "GIZMO-07": [1, 2, 0, 3, 2, 1, 2],
    "CABLE-22": [30, 25, 40, 35, 28, 33, 31],
    "SPARE-99": [0, 1, 0, 0, 0, 1, 0],
  };
  for (const [code, days] of Object.entries(demand)) {
    for (const units of days) {
      wh.recordDemand(code, units);
    }
  }

  return wh;
}

function main() {
  const wh = buildDemoWarehouse();

  console.log(`Restock report for ${wh.name}`);
  console.log("=".repeat(48));

  const plan = wh.buildRestockPlan();
  for (const line of plan) {
    console.log(
      `  ${line.skuCode.padEnd(12)} order ${String(line.orderQty).padStart(4)} @ $${line.unitCost.toFixed(2)} = $${line.totalCost.toFixed(2)}`
    );
  }

  console.log("-".repeat(48));
  for (const skuCode of wh.skus.keys()) {
    console.log("  " + wh.summarizeSku(skuCode));
  }
}

if (require.main === module) {
  main();
}

module.exports = { Warehouse, Sku, Bin, DemandHistory, buildDemoWarehouse };
