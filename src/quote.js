"use strict";

const { priceAt } = require("./catalog");

// Tier names in the same 0-based order as the price catalog.
const TIER_NAMES = ["basic", "pro", "max"];

/**
 * Price an order for the named tier, in cents.
 */
function quoteFor(tierName) {
  const idx = TIER_NAMES.indexOf(tierName) + 1;
  return priceAt(idx);
}

module.exports = { quoteFor, TIER_NAMES };
