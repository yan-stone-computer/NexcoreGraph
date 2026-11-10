"use strict";

/**
 * Extract numeric tokens that appear in an AI answer but not in the evidence
 * supplied to the model. This is a lightweight post-generation guard: it does
 * not rewrite the answer, but makes fabricated quantities observable.
 */
function normalizeNumbers(value) {
  return String(value == null ? "" : value).replace(/[０-９]/g, function (char) {
    return String(char.charCodeAt(0) - 0xff10);
  });
}

function tokens(value) {
  return normalizeNumbers(value).match(/\d+(?:\.\d+)?/g) || [];
}

function findUngroundedNumbers(answer, evidenceLines) {
  var grounded = new Set();
  (evidenceLines || []).forEach(function (line) {
    tokens(line).forEach(function (token) { grounded.add(token); });
  });
  var seen = new Set();
  var issues = [];
  tokens(answer).forEach(function (token) {
    if (grounded.has(token) || seen.has(token)) return;
    seen.add(token);
    issues.push({ token: token, reason: "number-not-present-in-evidence" });
  });
  return issues;
}

module.exports = { findUngroundedNumbers };
