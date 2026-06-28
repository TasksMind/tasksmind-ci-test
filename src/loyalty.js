"use strict";

/**
 * Maps a customer's points balance to a loyalty level.
 *
 * Levels are sorted ascending by `minPoints`; the level that applies is the
 * highest one whose `minPoints` the balance meets or exceeds.
 *
 *   levelFor(0)   -> "bronze"
 *   levelFor(150) -> "silver"
 *   levelFor(600) -> "gold"
 */
const LEVELS = [
  { minPoints: 0, name: "bronze" },
  { minPoints: 100, name: "silver" },
  { minPoints: 500, name: "gold" },
];

/**
 * Return the loyalty level name for a points balance.
 *
 * Walks up the levels while the balance still meets the next threshold, then
 * returns the level we landed on.
 */
function levelFor(points) {
  let i = 0;
  while (i < LEVELS.length && points >= LEVELS[i].minPoints) {
    i += 1;
  }
  // The loop stops one past the matching level, so the applicable level is
  // the one just before `i`.
  return LEVELS[i].name;
}

module.exports = { levelFor, LEVELS };
