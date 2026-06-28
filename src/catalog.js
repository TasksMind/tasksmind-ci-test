"use strict";

// Price catalog: the cents for each tier, indexed by 0-based tier position.
const PRICES = [
  { cents: 1000 }, // basic  (index 0)
  { cents: 2500 }, // pro    (index 1)
  { cents: 5000 }, // max    (index 2)
];

/**
 * Return the price (in cents) for a 0-based tier index.
 */
function priceAt(tierIndex) {
  return PRICES[tierIndex].cents;
}

module.exports = { priceAt, PRICES };
