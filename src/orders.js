"use strict";

/**
 * Order fulfillment summary.
 *
 * Groups a customer's orders, computes fulfillment stats, and prints a
 * per-customer summary line. Run directly for the demo dataset:
 *
 *   node --import tasksmind/catch src/orders.js
 */

const STATUS = {
  PENDING: "pending",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

/**
 * A single customer order.
 */
class Order {
  constructor(id, customerId, opts = {}) {
    this.id = id;
    this.customerId = customerId;
    this.status = opts.status ?? STATUS.PENDING;
    this.totalCents = opts.totalCents ?? 0;
    this.items = opts.items ?? [];
  }

  get itemCount() {
    return this.items.reduce((n, it) => n + (it.qty ?? 1), 0);
  }
}

/**
 * A customer record.
 */
class Customer {
  constructor(id, name, opts = {}) {
    this.id = id;
    this.name = name;
    this.tier = opts.tier ?? "standard";
    this.joinedYear = opts.joinedYear ?? 2024;
  }
}

class FulfillmentBook {
  constructor() {
    this.customers = new Map();
    this.orders = [];
  }

  addCustomer(customer) {
    this.customers.set(customer.id, customer);
    return customer;
  }

  placeOrder(order) {
    if (!this.customers.has(order.customerId)) {
      throw new Error(`Cannot place order for unknown customer: ${order.customerId}`);
    }
    this.orders.push(order);
    return order;
  }

  /**
   * Total revenue from non-cancelled orders.
   */
  revenueCents() {
    return this.orders
      .filter((o) => o.status !== STATUS.CANCELLED)
      .reduce((sum, o) => sum + o.totalCents, 0);
  }

  /**
   * Count orders in a given status.
   */
  countByStatus(status) {
    return this.orders.filter((o) => o.status === status).length;
  }

  /**
   * Average order value across non-cancelled orders, in cents.
   */
  averageOrderCents() {
    const active = this.orders.filter((o) => o.status !== STATUS.CANCELLED);
    if (active.length === 0) {
      return 0;
    }
    const total = active.reduce((sum, o) => sum + o.totalCents, 0);
    return Math.round(total / active.length);
  }

  /**
   * Group orders by customer id. Customers with no orders are absent from
   * the resulting index.
   */
  ordersByCustomer() {
    const index = {};
    for (const order of this.orders) {
      if (!index[order.customerId]) {
        index[order.customerId] = [];
      }
      index[order.customerId].push(order);
    }
    return index;
  }

  /**
   * Fraction of a customer's orders that reached "delivered".
   */
  deliveryRate(customerId) {
    const index = this.ordersByCustomer();
    const orders = index[customerId] || [];
    if (orders.length === 0) {
      return 0;
    }
    const delivered = orders.filter((o) => o.status === STATUS.DELIVERED).length;
    return delivered / orders.length;
  }

  /**
   * One-line fulfillment summary for a customer. Pulls the customer's order
   * list out of a per-customer index so the line can show counts + ids.
   */
  summarizeCustomer(customerId) {
    const customer = this.customers.get(customerId);
    const index = this.ordersByCustomer();
    const orders = index[customerId];
    const orderCount = orders.length;
    const ids = orders.map((o) => o.id).join(", ");
    const rate = Math.round(this.deliveryRate(customerId) * 100);
    return `${customer.name} [${customer.tier}]: ${orderCount} order(s) [${ids}], ${rate}% delivered`;
  }
}

function buildDemoBook() {
  const book = new FulfillmentBook();

  book.addCustomer(new Customer("C-100", "Acme Corp", { tier: "gold" }));
  book.addCustomer(new Customer("C-200", "Globex", { tier: "standard" }));
  book.addCustomer(new Customer("C-300", "Initech", { tier: "silver" }));
  // C-400 is a freshly onboarded customer with no orders yet.
  book.addCustomer(new Customer("C-400", "Umbrella", { tier: "standard" }));

  book.placeOrder(new Order("O-1", "C-100", { status: STATUS.DELIVERED, totalCents: 12000, items: [{ sku: "A", qty: 2 }] }));
  book.placeOrder(new Order("O-2", "C-100", { status: STATUS.SHIPPED, totalCents: 4500, items: [{ sku: "B", qty: 1 }] }));
  book.placeOrder(new Order("O-3", "C-200", { status: STATUS.DELIVERED, totalCents: 8000, items: [{ sku: "C", qty: 3 }] }));
  book.placeOrder(new Order("O-4", "C-200", { status: STATUS.CANCELLED, totalCents: 2000, items: [{ sku: "D", qty: 1 }] }));
  book.placeOrder(new Order("O-5", "C-300", { status: STATUS.PENDING, totalCents: 15000, items: [{ sku: "E", qty: 5 }] }));

  return book;
}

function main() {
  const book = buildDemoBook();

  console.log("Fulfillment summary");
  console.log("=".repeat(52));
  console.log(`  Revenue:        $${(book.revenueCents() / 100).toFixed(2)}`);
  console.log(`  Avg order:      $${(book.averageOrderCents() / 100).toFixed(2)}`);
  console.log(`  Delivered:      ${book.countByStatus(STATUS.DELIVERED)}`);
  console.log(`  Shipped:        ${book.countByStatus(STATUS.SHIPPED)}`);
  console.log(`  Pending:        ${book.countByStatus(STATUS.PENDING)}`);
  console.log("-".repeat(52));
  for (const customerId of book.customers.keys()) {
    console.log("  " + book.summarizeCustomer(customerId));
  }
}

if (require.main === module) {
  main();
}

module.exports = { FulfillmentBook, Order, Customer, buildDemoBook };
