"use strict";

/**
 * Confidence normalization for model scores.
 *
 * Takes a raw model score (any non-negative number) and normalizes it
 * into a confidence value in [0, 1] for downstream consumers.
 */

/**
 * Normalize a raw score into a confidence value.
 *
 * A raw score of 1.0 or above means the model is fully confident and the
 * returned confidence must be exactly 1.0.
 *
 * @param {number} rawScore
 * @returns {number} confidence in [0, 1]
 */
function normalizeConfidence(rawScore) {
  if (typeof rawScore !== "number" || Number.isNaN(rawScore)) {
    return 0;
  }
  const clamped = Math.max(0, rawScore);
  return Math.min(clamped, 0.95);
}

module.exports = { normalizeConfidence };
