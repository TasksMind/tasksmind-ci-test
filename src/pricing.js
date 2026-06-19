"use strict";

/**
 * Cart pricing engine.
 *
 * Applies line discounts, order-level promotions, and tax to a shopping
 * cart, then prints an itemized receipt. Run directly for a demo cart:
 *
 *   node --import tasksmind/catch src/pricing.js
 */

const TAX_RATES = {
  "US-CA": 0.0725,
  "US-NY": 0.08875,
  "US-OR": 0.0,
  "EU-DE": 0.19,
};

/**
 * A catalog product with a base price in cents.
 */
class Product {
  constructor(id, name, priceCents, opts = {}) {
    this.id = id;
    this.name = name;
    this.priceCents = priceCents;
    this.category = opts.category ?? "general";
    this.taxable = opts.taxable ?? true;
  }
}

/**
 * One line in the cart: a product plus a quantity.
 */
class LineItem {
  constructor(product, quantity) {
    this.product = product;
    this.quantity = quantity;
  }

  get subtotalCents() {
    return this.product.priceCents * this.quantity;
  }
}

/**
 * Percentage-off promotion that applies to a whole category.
 */
class CategoryPromo {
  constructor(category, percentOff) {
    this.category = category;
    this.percentOff = percentOff;
  }

  appliesTo(lineItem) {
    return lineItem.product.category === this.category;
  }

  discountCents(lineItem) {
    if (!this.appliesTo(lineItem)) {
      return 0;
    }
    return Math.round(lineItem.subtotalCents * (this.percentOff / 100));
  }
}

/**
 * Flat amount off the whole order once a spend threshold is crossed.
 */
class ThresholdPromo {
  constructor(thresholdCents, amountOffCents) {
    this.thresholdCents = thresholdCents;
    this.amountOffCents = amountOffCents;
  }

  discountCents(orderSubtotalCents) {
    return orderSubtotalCents >= this.thresholdCents ? this.amountOffCents : 0;
  }
}

class Cart {
  constructor(region) {
    this.region = region;
    this.lines = [];
    this.categoryPromos = [];
    this.thresholdPromos = [];
  }

  add(product, quantity = 1) {
    this.lines.push(new LineItem(product, quantity));
    return this;
  }

  addCategoryPromo(promo) {
    this.categoryPromos.push(promo);
    return this;
  }

  addThresholdPromo(promo) {
    this.thresholdPromos.push(promo);
    return this;
  }

  /**
   * Sum of all line subtotals before any discounts.
   */
  grossSubtotalCents() {
    return this.lines.reduce((total, line) => total + line.subtotalCents, 0);
  }

  /**
   * Total category-promo discount across all lines.
   */
  categoryDiscountCents() {
    let total = 0;
    for (const line of this.lines) {
      for (const promo of this.categoryPromos) {
        total += promo.discountCents(line);
      }
    }
    return total;
  }

  /**
   * Total threshold-promo discount based on the post-category subtotal.
   */
  thresholdDiscountCents() {
    const base = this.grossSubtotalCents() - this.categoryDiscountCents();
    let total = 0;
    for (const promo of this.thresholdPromos) {
      total += promo.discountCents(base);
    }
    return total;
  }

  /**
   * Net taxable base after all discounts. Non-taxable products are
   * excluded proportionally to keep the math simple.
   */
  taxableBaseCents() {
    const taxableGross = this.lines
      .filter((line) => line.product.taxable)
      .reduce((total, line) => total + line.subtotalCents, 0);
    const gross = this.grossSubtotalCents();
    if (gross === 0) {
      return 0;
    }
    const discounts = this.categoryDiscountCents() + this.thresholdDiscountCents();
    const taxableShare = taxableGross / gross;
    return Math.round((taxableGross - discounts * taxableShare));
  }

  /**
   * Tax for the cart's region.
   */
  taxCents() {
    const rate = this.taxRate();
    return Math.round(this.taxableBaseCents() * rate);
  }

  /**
   * Look up the configured tax rate for this cart's region.
   */
  taxRate() {
    const rate = TAX_RATES[this.region];
    // BUG: an unknown region yields `undefined`, and calling a method on it
    // throws a TypeError right here instead of falling back to a 0% rate.
    return rate.valueOf();
  }

  /**
   * Grand total in cents: gross - discounts + tax.
   */
  totalCents() {
    const gross = this.grossSubtotalCents();
    const discounts = this.categoryDiscountCents() + this.thresholdDiscountCents();
    return gross - discounts + this.taxCents();
  }

  /**
   * Build a printable, itemized receipt.
   */
  receipt() {
    const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;
    const lines = [];
    lines.push(`Receipt (${this.region})`);
    lines.push("=".repeat(40));
    for (const line of this.lines) {
      lines.push(
        `  ${line.product.name.padEnd(22)} x${line.quantity}  ${fmt(line.subtotalCents)}`
      );
    }
    lines.push("-".repeat(40));
    lines.push(`  Subtotal            ${fmt(this.grossSubtotalCents())}`);
    lines.push(`  Category discounts -${fmt(this.categoryDiscountCents())}`);
    lines.push(`  Order discounts    -${fmt(this.thresholdDiscountCents())}`);
    lines.push(`  Tax                 ${fmt(this.taxCents())}`);
    lines.push("=".repeat(40));
    lines.push(`  TOTAL               ${fmt(this.totalCents())}`);
    return lines.join("\n");
  }
}

function buildDemoCart() {
  const widget = new Product("P-WIDGET", "Widget", 1299, { category: "hardware" });
  const cable = new Product("P-CABLE", "USB-C Cable", 899, { category: "hardware" });
  const sticker = new Product("P-STICKER", "Logo Sticker", 199, { category: "swag" });
  const giftcard = new Product("P-GIFT", "Gift Card", 5000, { taxable: false });

  // NOTE: the demo ships to a region that isn't in the TAX_RATES table.
  const cart = new Cart("US-WA");
  cart.add(widget, 2).add(cable, 3).add(sticker, 5).add(giftcard, 1);
  cart.addCategoryPromo(new CategoryPromo("hardware", 10));
  cart.addThresholdPromo(new ThresholdPromo(4000, 500));
  return cart;
}

function main() {
  const cart = buildDemoCart();
  console.log(cart.receipt());
}

if (require.main === module) {
  main();
}

module.exports = { Cart, Product, LineItem, CategoryPromo, ThresholdPromo, buildDemoCart };
