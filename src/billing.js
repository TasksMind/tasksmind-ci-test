"use strict";

/**
 * Subscription billing summary.
 *
 * Groups invoices per account, computes balances, and prints a per-account
 * billing line. Run directly for the demo dataset:
 *
 *   node --import tasksmind/catch src/billing.js
 */

const INVOICE_STATE = {
  DRAFT: "draft",
  OPEN: "open",
  PAID: "paid",
  VOID: "void",
};

/**
 * A single invoice against an account.
 */
class Invoice {
  constructor(id, accountId, opts = {}) {
    this.id = id;
    this.accountId = accountId;
    this.state = opts.state ?? INVOICE_STATE.OPEN;
    this.amountCents = opts.amountCents ?? 0;
    this.dueDay = opts.dueDay ?? 1;
  }

  get isCollectible() {
    return this.state === INVOICE_STATE.OPEN;
  }
}

/**
 * A billing account.
 */
class Account {
  constructor(id, name, opts = {}) {
    this.id = id;
    this.name = name;
    this.plan = opts.plan ?? "basic";
    this.currency = opts.currency ?? "USD";
  }
}

class Ledger {
  constructor() {
    this.accounts = new Map();
    this.invoices = [];
  }

  addAccount(account) {
    this.accounts.set(account.id, account);
    return account;
  }

  issueInvoice(invoice) {
    if (!this.accounts.has(invoice.accountId)) {
      throw new Error(`Cannot issue invoice for unknown account: ${invoice.accountId}`);
    }
    this.invoices.push(invoice);
    return invoice;
  }

  /**
   * Total collectible (open) balance across all accounts, in cents.
   */
  openBalanceCents() {
    return this.invoices
      .filter((inv) => inv.isCollectible)
      .reduce((sum, inv) => sum + inv.amountCents, 0);
  }

  /**
   * Count invoices in a given state.
   */
  countByState(state) {
    return this.invoices.filter((inv) => inv.state === state).length;
  }

  /**
   * Total amount collected (paid) so far, in cents.
   */
  collectedCents() {
    return this.invoices
      .filter((inv) => inv.state === INVOICE_STATE.PAID)
      .reduce((sum, inv) => sum + inv.amountCents, 0);
  }

  /**
   * Group invoices by account id. Accounts with no invoices are absent from
   * the resulting index.
   */
  invoicesByAccount() {
    const index = {};
    for (const invoice of this.invoices) {
      if (!index[invoice.accountId]) {
        index[invoice.accountId] = [];
      }
      index[invoice.accountId].push(invoice);
    }
    return index;
  }

  /**
   * Fraction of an account's invoices that are paid.
   */
  paidRate(accountId) {
    const index = this.invoicesByAccount();
    const invoices = index[accountId] || [];
    if (invoices.length === 0) {
      return 0;
    }
    const paid = invoices.filter((inv) => inv.state === INVOICE_STATE.PAID).length;
    return paid / invoices.length;
  }

  /**
   * One-line billing summary for an account. Pulls the account's invoice list
   * out of a per-account index so the line can show counts + ids.
   */
  summarizeAccount(accountId) {
    const account = this.accounts.get(accountId);
    const index = this.invoicesByAccount();
    const invoices = index[accountId] ?? [];
    const invoiceCount = invoices.length;
    const ids = invoices.map((inv) => inv.id).join(", ");
    const rate = Math.round(this.paidRate(accountId) * 100);
    return `${account.name} [${account.plan}]: ${invoiceCount} invoice(s) [${ids}], ${rate}% paid`;
  }
}

function buildDemoLedger() {
  const ledger = new Ledger();

  ledger.addAccount(new Account("A-1", "Northwind", { plan: "enterprise" }));
  ledger.addAccount(new Account("A-2", "Contoso", { plan: "basic" }));
  ledger.addAccount(new Account("A-3", "Fabrikam", { plan: "pro" }));
  // A-4 is a freshly created account with no invoices yet.
  ledger.addAccount(new Account("A-4", "Tailspin", { plan: "basic" }));

  ledger.issueInvoice(new Invoice("INV-1", "A-1", { state: INVOICE_STATE.PAID, amountCents: 25000, dueDay: 1 }));
  ledger.issueInvoice(new Invoice("INV-2", "A-1", { state: INVOICE_STATE.OPEN, amountCents: 25000, dueDay: 15 }));
  ledger.issueInvoice(new Invoice("INV-3", "A-2", { state: INVOICE_STATE.PAID, amountCents: 5000, dueDay: 1 }));
  ledger.issueInvoice(new Invoice("INV-4", "A-2", { state: INVOICE_STATE.VOID, amountCents: 5000, dueDay: 1 }));
  ledger.issueInvoice(new Invoice("INV-5", "A-3", { state: INVOICE_STATE.OPEN, amountCents: 12000, dueDay: 7 }));

  return ledger;
}

function main() {
  const ledger = buildDemoLedger();

  console.log("Billing summary");
  console.log("=".repeat(52));
  console.log(`  Open balance:   $${(ledger.openBalanceCents() / 100).toFixed(2)}`);
  console.log(`  Collected:      $${(ledger.collectedCents() / 100).toFixed(2)}`);
  console.log(`  Paid invoices:  ${ledger.countByState(INVOICE_STATE.PAID)}`);
  console.log(`  Open invoices:  ${ledger.countByState(INVOICE_STATE.OPEN)}`);
  console.log("-".repeat(52));
  for (const accountId of ledger.accounts.keys()) {
    console.log("  " + ledger.summarizeAccount(accountId));
  }
}

if (require.main === module) {
  main();
}

module.exports = { Ledger, Invoice, Account, buildDemoLedger };
